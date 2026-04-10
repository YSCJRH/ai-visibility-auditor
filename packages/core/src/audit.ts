import { BUCKET_LABELS, KEY_PAGE_TYPES, REQUIRED_PAGE_TYPES, SEVERITY_PENALTIES } from "./constants.ts";
import { crawlSite } from "./crawl.ts";
import { normalizePages } from "./extract.ts";
import type { AuditInput, AuditResult, BucketScore, Issue, PageRecord, Recommendation, ScoreBucketId } from "./types.ts";
import { clamp, keywordCoverage, slugify } from "./utils.ts";

function createIssue(issue: Omit<Issue, "id">): Issue {
  const pagePart = issue.pageUrl ? `-${slugify(issue.pageUrl)}` : "";
  return {
    id: `${slugify(issue.title)}${pagePart}`,
    ...issue
  };
}

function isKeyPage(page: PageRecord): boolean {
  return KEY_PAGE_TYPES.includes(page.pageType);
}

function computeBucketScore(issues: Issue[], bucket: ScoreBucketId): BucketScore {
  const bucketIssues = issues.filter((issue) => issue.bucket === bucket);
  const penalty = bucketIssues.reduce((sum, issue) => sum + SEVERITY_PENALTIES[issue.severity], 0);

  return {
    score: clamp(100 - penalty, 0, 100),
    issueCount: bucketIssues.length,
    errorCount: bucketIssues.filter((issue) => issue.severity === "error").length,
    warnCount: bucketIssues.filter((issue) => issue.severity === "warn").length,
    infoCount: bucketIssues.filter((issue) => issue.severity === "info").length
  };
}

function summarizeRecommendations(issues: Issue[], missingPageTypes: string[]): Recommendation[] {
  const recommendations: Recommendation[] = [];

  const byBucket = (bucket: ScoreBucketId) => issues.filter((issue) => issue.bucket === bucket);
  const access = byBucket("access");
  const structure = byBucket("structure");
  const entity = byBucket("entityClarity");
  const evidence = byBucket("evidence");
  const comparative = byBucket("comparativeReadiness");

  if (access.length > 0) {
    recommendations.push({
      id: "remove-crawl-blockers",
      title: "Remove crawl and indexing blockers",
      rationale: "Answer-layer visibility starts with accessible HTML, permissive crawl controls, and discoverable pages.",
      expectedOutcome: "Better crawlability and cleaner downstream discovery.",
      relatedIssues: access.map((issue) => issue.id)
    });
  }

  if (structure.length > 0) {
    recommendations.push({
      id: "tighten-page-structure",
      title: "Tighten structure on key pages",
      rationale: "Thin, weakly segmented pages are harder to summarize and cite accurately.",
      expectedOutcome: "Higher extraction quality and more stable page-level interpretation.",
      relatedIssues: structure.map((issue) => issue.id)
    });
  }

  if (entity.length > 0) {
    recommendations.push({
      id: "clarify-homepage-positioning",
      title: "Clarify homepage positioning",
      rationale: "The homepage should state category, audience, and use cases plainly enough for assistants to quote them back.",
      expectedOutcome: "Stronger entity clarity ahead of eval-mode mention scoring.",
      relatedIssues: entity.map((issue) => issue.id)
    });
  }

  if (evidence.length > 0 || missingPageTypes.includes("pricing") || missingPageTypes.includes("security")) {
    recommendations.push({
      id: "add-citable-evidence",
      title: "Add citable pricing, trust, and documentation proof",
      rationale: "Pricing, security, and documentation pages create the structured evidence that answers can cite.",
      expectedOutcome: "More reliable evidence signals and stronger future citation coverage.",
      relatedIssues: evidence.map((issue) => issue.id)
    });
  }

  if (comparative.length > 0 || missingPageTypes.length > 0) {
    recommendations.push({
      id: "close-comparison-gaps",
      title: "Close FAQ, compare, integrations, and use-case gaps",
      rationale: "Answer engines need comparison and recommendation-ready source material, not just a homepage.",
      expectedOutcome: "Better readiness for shortlist, alternatives, and evaluation prompts.",
      relatedIssues: comparative.map((issue) => issue.id)
    });
  }

  return recommendations;
}

export async function runAudit(input: AuditInput): Promise<AuditResult> {
  const crawl = await crawlSite({
    siteInput: input.siteInput,
    sitemapUrl: input.sitemapUrl,
    includePatterns: input.includePatterns ?? [],
    excludePatterns: input.excludePatterns ?? [],
    maxPages: input.maxPages ?? 20
  });
  const pages = normalizePages(crawl.source, crawl.pages, input.brand.brand);
  const issues: Issue[] = [];

  if (!crawl.robots.exists) {
    issues.push(
      createIssue({
        severity: "warn",
        scope: "site",
        category: "crawlability",
        bucket: "access",
        title: "Missing robots.txt",
        message: "No robots.txt file was discovered at the site root.",
        fixHint: "Add robots.txt and advertise your sitemap."
      })
    );
  }

  if (crawl.discoveredUrls.length === 0) {
    issues.push(
      createIssue({
        severity: "warn",
        scope: "site",
        category: "crawlability",
        bucket: "access",
        title: "Missing sitemap discovery",
        message: "No crawl targets were discovered from a sitemap or fallback scan.",
        fixHint: "Publish a sitemap.xml or expose crawlable HTML entrypoints."
      })
    );
  }

  if (crawl.robots.blockedAll) {
    issues.push(
      createIssue({
        severity: "error",
        scope: "site",
        category: "crawlability",
        bucket: "access",
        title: "Robots blocks all crawlers",
        message: "robots.txt blocks the entire site for the wildcard user agent.",
        fixHint: "Allow public product and docs content to be crawled."
      })
    );
  }

  for (const bot of crawl.robots.blockedAiBots) {
    issues.push(
      createIssue({
        severity: "warn",
        scope: "site",
        category: "crawlability",
        bucket: "access",
        title: `${bot} is blocked`,
        message: `${bot} is explicitly blocked in robots.txt.`,
        fixHint: `Allow ${bot} if you want discoverability on that answer surface.`
      })
    );
  }

  const pageTypes = new Map<string, PageRecord[]>();
  for (const page of pages) {
    const current = pageTypes.get(page.pageType) ?? [];
    current.push(page);
    pageTypes.set(page.pageType, current);

    if (page.fetchError || page.status === 0) {
      issues.push(
        createIssue({
          severity: "error",
          scope: "page",
          category: "crawlability",
          bucket: "access",
          title: "Page fetch failed",
          message: page.fetchError ?? "The page could not be fetched.",
          fixHint: "Make the page reachable without a browser-only session.",
          pageUrl: page.url
        })
      );
      continue;
    }

    if (page.noindex && isKeyPage(page)) {
      issues.push(
        createIssue({
          severity: "error",
          scope: "page",
          category: "indexability",
          bucket: "access",
          title: "Key page is noindex",
          message: "A key page contains a noindex directive.",
          fixHint: "Remove noindex from pages that should earn discovery and citations.",
          pageUrl: page.url
        })
      );
    }

    if (isKeyPage(page) && !page.title) {
      issues.push(
        createIssue({
          severity: "error",
          scope: "page",
          category: "structure",
          bucket: "structure",
          title: "Missing page title",
          message: "A key page is missing a title element.",
          fixHint: "Add a descriptive page title.",
          pageUrl: page.url
        })
      );
    }

    if (isKeyPage(page) && page.title.length > 0 && page.title.length < 20) {
      issues.push(
        createIssue({
          severity: "warn",
          scope: "page",
          category: "structure",
          bucket: "structure",
          title: "Short page title",
          message: "A key page title is unusually short and low-context.",
          fixHint: "Expand the title with page purpose and product context.",
          pageUrl: page.url
        })
      );
    }

    if (isKeyPage(page) && !page.metaDescription) {
      issues.push(
        createIssue({
          severity: "warn",
          scope: "page",
          category: "structure",
          bucket: "structure",
          title: "Missing meta description",
          message: "A key page is missing a meta description.",
          fixHint: "Add a clear summary of who the page serves and what it proves.",
          pageUrl: page.url
        })
      );
    }

    if (isKeyPage(page) && !page.h1) {
      issues.push(
        createIssue({
          severity: "error",
          scope: "page",
          category: "structure",
          bucket: "structure",
          title: "Missing H1",
          message: "A key page does not have a primary heading.",
          fixHint: "Add one descriptive H1 per key page.",
          pageUrl: page.url
        })
      );
    }

    if (isKeyPage(page) && page.h1Count > 1) {
      issues.push(
        createIssue({
          severity: "warn",
          scope: "page",
          category: "structure",
          bucket: "structure",
          title: "Multiple H1 headings",
          message: "A key page contains more than one H1.",
          fixHint: "Use a single H1 and demote the rest to lower-level headings.",
          pageUrl: page.url
        })
      );
    }

    if (isKeyPage(page) && page.wordCount < 150) {
      issues.push(
        createIssue({
          severity: "warn",
          scope: "page",
          category: "structure",
          bucket: "structure",
          title: "Thin key page",
          message: "A key page has little extractable body text.",
          fixHint: "Add plain-language explanations, evidence blocks, and stronger sections.",
          pageUrl: page.url
        })
      );
    }

    if (isKeyPage(page) && page.headings.length < 2) {
      issues.push(
        createIssue({
          severity: "warn",
          scope: "page",
          category: "structure",
          bucket: "structure",
          title: "Weak heading structure",
          message: "A key page does not have enough H2/H3 sections to segment meaning clearly.",
          fixHint: "Break the page into sections with scannable headings.",
          pageUrl: page.url
        })
      );
    }

    if (isKeyPage(page) && page.jsHeavy) {
      issues.push(
        createIssue({
          severity: "warn",
          scope: "page",
          category: "structure",
          bucket: "structure",
          title: "JavaScript-heavy thin page",
          message: "A key page appears script-heavy with limited extractable HTML text.",
          fixHint: "Render critical content server-side or include HTML fallback text.",
          pageUrl: page.url
        })
      );
    }

    if (page.pageType === "home" && !page.hasJsonLd) {
      issues.push(
        createIssue({
          severity: "info",
          scope: "page",
          category: "schema",
          bucket: "structure",
          title: "Homepage lacks JSON-LD",
          message: "The homepage has no JSON-LD structured data.",
          fixHint: "Add Organization or Product JSON-LD that matches visible text.",
          pageUrl: page.url
        })
      );
    }

    if (page.interactiveControls > 0 && page.ariaLabeledControls / page.interactiveControls < 0.5) {
      issues.push(
        createIssue({
          severity: "info",
          scope: "page",
          category: "accessibility",
          bucket: "structure",
          title: "Low ARIA coverage on controls",
          message: "Interactive controls are present but few expose aria-label metadata.",
          fixHint: "Add accessible labels to critical controls and buttons.",
          pageUrl: page.url
        })
      );
    }

    if (page.pageType === "pricing" && (!page.hasNumbers || page.tables === 0)) {
      issues.push(
        createIssue({
          severity: "warn",
          scope: "page",
          category: "evidence",
          bucket: "evidence",
          title: "Pricing page lacks citable detail",
          message: "The pricing page has limited numeric or tabular evidence.",
          fixHint: "Add concrete plan details, ranges, or tables that can be cited.",
          pageUrl: page.url
        })
      );
    }

    if (page.pageType === "security" && !page.hasTrustSignals) {
      issues.push(
        createIssue({
          severity: "warn",
          scope: "page",
          category: "evidence",
          bucket: "evidence",
          title: "Security page lacks trust signals",
          message: "The security page does not mention common trust markers.",
          fixHint: "Add concrete compliance, deployment, and control statements.",
          pageUrl: page.url
        })
      );
    }

    if (page.pageType === "docs" && !page.hasDate && !page.hasVersion) {
      issues.push(
        createIssue({
          severity: "info",
          scope: "page",
          category: "evidence",
          bucket: "evidence",
          title: "Docs page lacks freshness markers",
          message: "The docs page does not expose last updated dates or versions.",
          fixHint: "Add updated timestamps or version markers to key docs.",
          pageUrl: page.url
        })
      );
    }
  }

  const homepage = pageTypes.get("home")?.[0];
  if (homepage) {
    const homeText = `${homepage.title} ${homepage.h1} ${homepage.textSnippet}`;

    if (keywordCoverage(homeText, input.brand.brand.category) < 0.5) {
      issues.push(
        createIssue({
          severity: "warn",
          scope: "page",
          category: "positioning",
          bucket: "entityClarity",
          title: "Homepage category signal is weak",
          message: "The homepage does not clearly reinforce the declared product category.",
          fixHint: "Name the category directly in the hero or early supporting copy.",
          pageUrl: homepage.url
        })
      );
    }

    if (
      input.brand.brand.target_personas.length > 0 &&
      !input.brand.brand.target_personas.some((persona) => keywordCoverage(homeText, persona) >= 0.5)
    ) {
      issues.push(
        createIssue({
          severity: "info",
          scope: "page",
          category: "positioning",
          bucket: "entityClarity",
          title: "Homepage persona fit is implicit",
          message: "Target personas are not clearly named on the homepage.",
          fixHint: "Call out the primary team or buyer in visible homepage text.",
          pageUrl: homepage.url
        })
      );
    }

    if (
      input.brand.brand.key_use_cases.length > 0 &&
      !input.brand.brand.key_use_cases.some((useCase) => keywordCoverage(homeText, useCase) >= 0.5)
    ) {
      issues.push(
        createIssue({
          severity: "info",
          scope: "page",
          category: "positioning",
          bucket: "entityClarity",
          title: "Homepage use cases are underspecified",
          message: "The homepage does not clearly mention the product's primary jobs to be done.",
          fixHint: "Add use-case language near the hero and supporting sections.",
          pageUrl: homepage.url
        })
      );
    }

    const linkedTypes = new Set(
      homepage.internalLinks
        .map((url) => pages.find((candidate) => candidate.url === url)?.pageType)
        .filter((pageType) => pageType !== undefined && pageType !== "home")
    );

    if (linkedTypes.size < 3) {
      issues.push(
        createIssue({
          severity: "warn",
          scope: "page",
          category: "coverage",
          bucket: "comparativeReadiness",
          title: "Homepage under-links key proof pages",
          message: "The homepage links to too few key proof pages to drive strong downstream discovery.",
          fixHint: "Link from the homepage to pricing, docs, security, FAQ, or compare pages.",
          pageUrl: homepage.url
        })
      );
    }
  } else {
    issues.push(
      createIssue({
        severity: "error",
        scope: "site",
        category: "coverage",
        bucket: "access",
        title: "Homepage was not crawled",
        message: "The crawl did not yield a homepage record.",
        fixHint: "Ensure the homepage is public and discoverable."
      })
    );
  }

  const missingPageTypes: string[] = [];
  for (const requirement of REQUIRED_PAGE_TYPES) {
    if ((pageTypes.get(requirement.pageType) ?? []).length === 0) {
      missingPageTypes.push(requirement.pageType);
      issues.push(
        createIssue({
          severity: requirement.severity,
          scope: "site",
          category: "coverage",
          bucket: requirement.bucket,
          title: `Missing ${requirement.title}`,
          message: `No ${requirement.pageType} page was discovered.`,
          fixHint: `Add a dedicated ${requirement.pageType} page with clear, citable content.`
        })
      );
    }
  }

  if ((pageTypes.get("use-case") ?? []).length < 3) {
    issues.push(
      createIssue({
        severity: "info",
        scope: "site",
        category: "coverage",
        bucket: "comparativeReadiness",
        title: "Use-case coverage is thin",
        message: "Fewer than three use-case pages were discovered.",
        fixHint: "Add more use-case or solution pages for distinct buyer contexts."
      })
    );
  }

  const comparePages = pageTypes.get("compare") ?? [];
  if (comparePages.length > 0 && input.competitors.competitors.length > 0) {
    const compareText = comparePages.map((page) => page.textSnippet.toLowerCase()).join(" ");
    const mentionsCompetitor = input.competitors.competitors.some((competitor) =>
      compareText.includes(competitor.name.toLowerCase())
    );

    if (!mentionsCompetitor) {
      issues.push(
        createIssue({
          severity: "info",
          scope: "site",
          category: "comparison",
          bucket: "comparativeReadiness",
          title: "Compare pages do not mention declared competitors",
          message: "Compare-oriented pages exist, but they do not name any declared competitors.",
          fixHint: "Add explicit alternatives or versus pages for the highest-priority competitors."
        })
      );
    }
  }

  const scores = {
    access: computeBucketScore(issues, "access"),
    structure: computeBucketScore(issues, "structure"),
    entityClarity: computeBucketScore(issues, "entityClarity"),
    evidence: computeBucketScore(issues, "evidence"),
    comparativeReadiness: computeBucketScore(issues, "comparativeReadiness")
  };

  const overallScore = Math.round(
    Object.values(scores).reduce((sum, bucket) => sum + bucket.score, 0) / Object.keys(scores).length
  );

  return {
    site: {
      kind: crawl.source.kind,
      input: input.siteInput,
      baseUrl: crawl.source.baseUrl,
      generatedAt: new Date().toISOString()
    },
    summary: {
      overallScore,
      vavr: null,
      missingPageTypes,
      crawledPages: pages.length,
      discoveredUrls: crawl.discoveredUrls.length,
      keyPageCount: pages.filter((page) => isKeyPage(page)).length
    },
    scores,
    issues,
    recommendations: summarizeRecommendations(issues, missingPageTypes),
    pages,
    robots: crawl.robots,
    configs: {
      brand: {
        name: input.brand.brand.name,
        domain: input.brand.brand.domain,
        category: input.brand.brand.category,
        target_personas: input.brand.brand.target_personas,
        key_use_cases: input.brand.brand.key_use_cases,
        trusted_domains: input.brand.brand.trusted_domains
      },
      competitors: input.competitors.competitors.length,
      prompts: input.prompts.prompts.length
    }
  };
}

export { BUCKET_LABELS };

