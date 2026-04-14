import { createHash, randomUUID } from "node:crypto";
import {
  ARTIFACT_VERSION,
  BUCKET_LABELS,
  KEY_PAGE_TYPES,
  REQUIRED_PAGE_TYPES,
  RULE_VERSION,
  SEVERITY_PENALTIES
} from "./constants.ts";
import { crawlSite } from "./crawl.ts";
import { normalizePages } from "./extract.ts";
import type {
  AuditInput,
  AuditResult,
  BucketScore,
  Issue,
  PageRecord,
  PageType,
  Recommendation,
  ScoreBucketId
} from "./types.ts";
import { clamp, keywordCoverage, slugify } from "./utils.ts";

type AuditContext = {
  input: AuditInput;
  crawl: Awaited<ReturnType<typeof crawlSite>>;
  pages: PageRecord[];
  issues: Issue[];
  pageTypes: Map<PageType, PageRecord[]>;
  byUrl: Map<string, PageRecord>;
  incomingLinkCounts: Map<string, number>;
};

function createIssue(issue: Omit<Issue, "id">): Issue {
  const pagePart = issue.pageUrl ? `-${slugify(issue.pageUrl)}` : "";
  return {
    id: `${slugify(issue.title)}${pagePart}`,
    ...issue
  };
}

function addIssue(issues: Issue[], issue: Omit<Issue, "id">): void {
  issues.push(createIssue(issue));
}

function isKeyPage(page: PageRecord): boolean {
  return KEY_PAGE_TYPES.includes(page.pageType);
}

function pageText(page: PageRecord): string {
  return `${page.title} ${page.h1} ${page.textSnippet}`.trim();
}

function signalExamples(page: PageRecord, type: string): string[] {
  return page.evidenceSignals.find((signal) => signal.type === type)?.examples ?? [];
}

function hasEvidenceSignal(page: PageRecord, ...types: string[]): boolean {
  return types.some((type) => (page.evidenceSignals.find((signal) => signal.type === type)?.count ?? 0) > 0);
}

function compactEvidence(values: string[]): string {
  return values.filter(Boolean).slice(0, 3).join("; ");
}

function summarizeMissingGroups(page: PageRecord, groups: Array<{ label: string; signals: string[] }>): string[] {
  return groups
    .filter((group) => !hasEvidenceSignal(page, ...group.signals))
    .map((group) => group.label);
}

function summarizePresentSignals(page: PageRecord, groups: Array<{ label: string; signals: string[] }>): string[] {
  return groups
    .filter((group) => hasEvidenceSignal(page, ...group.signals))
    .map((group) => {
      const examples = group.signals.flatMap((signal) => signalExamples(page, signal));
      return examples.length > 0 ? `${group.label}: ${compactEvidence(examples)}` : group.label;
    });
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
      title: "Tighten structure and schema alignment on key pages",
      rationale: "Thin, weakly segmented pages and mismatched schema make assistants less likely to interpret pages consistently.",
      expectedOutcome: "Higher extraction quality and fewer ambiguous summaries.",
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
      rationale: "Pricing, security, documentation, and outcome details create the evidence that grounded answers can cite.",
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

function mapPageTypes(pages: PageRecord[]): Map<PageType, PageRecord[]> {
  const pageTypes = new Map<PageType, PageRecord[]>();
  for (const page of pages) {
    const current = pageTypes.get(page.pageType) ?? [];
    current.push(page);
    pageTypes.set(page.pageType, current);
  }
  return pageTypes;
}

function mapIncomingLinkCounts(pages: PageRecord[]): Map<string, number> {
  const counts = new Map<string, number>();
  const knownUrls = new Set(pages.map((page) => page.url));

  for (const page of pages) {
    for (const link of page.internalLinks) {
      if (!knownUrls.has(link)) {
        continue;
      }
      counts.set(link, (counts.get(link) ?? 0) + 1);
    }
  }

  return counts;
}

function createConfigHash(input: AuditInput): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        siteInput: input.siteInput,
        sitemapUrl: input.sitemapUrl ?? null,
        includePatterns: input.includePatterns ?? [],
        excludePatterns: input.excludePatterns ?? [],
        maxPages: input.maxPages ?? 20,
        brand: input.brand,
        competitors: input.competitors,
        prompts: input.prompts
      })
    )
    .digest("hex")
    .slice(0, 16);
}

function applySiteAccessRules(context: AuditContext): void {
  const { crawl, issues } = context;

  if (!crawl.robots.exists) {
    addIssue(issues, {
      severity: "warn",
      scope: "site",
      category: "crawlability",
      bucket: "access",
      title: "Missing robots.txt",
      message: "No robots.txt file was discovered at the site root.",
      fixHint: "Add robots.txt and advertise your sitemap."
    });
  }

  if (crawl.discoveredUrls.length === 0) {
    addIssue(issues, {
      severity: "warn",
      scope: "site",
      category: "crawlability",
      bucket: "access",
      title: "Missing sitemap discovery",
      message: "No crawl targets were discovered from a sitemap or fallback scan.",
      fixHint: "Publish a sitemap.xml or expose crawlable HTML entrypoints."
    });
  }

  if (crawl.robots.blockedAll) {
    addIssue(issues, {
      severity: "error",
      scope: "site",
      category: "crawlability",
      bucket: "access",
      title: "Robots blocks all crawlers",
      message: "robots.txt blocks the entire site for the wildcard user agent.",
      fixHint: "Allow public product and docs content to be crawled."
    });
  }

  for (const bot of crawl.robots.blockedAiBots) {
    addIssue(issues, {
      severity: "warn",
      scope: "site",
      category: "crawlability",
      bucket: "access",
      title: `${bot} is blocked`,
      message: `${bot} is explicitly blocked in robots.txt.`,
      fixHint: `Allow ${bot} if you want discoverability on that answer surface.`
    });
  }
}

function applyKeyPageStructureRules(context: AuditContext, page: PageRecord): void {
  const { issues } = context;

  if (page.noindex && isKeyPage(page)) {
    addIssue(issues, {
      severity: "error",
      scope: "page",
      category: "indexability",
      bucket: "access",
      title: "Key page is noindex",
      message: "A key page contains a noindex directive.",
      fixHint: "Remove noindex from pages that should earn discovery and citations.",
      pageUrl: page.url
    });
  }

  if (!isKeyPage(page)) {
    return;
  }

  if (!page.title) {
    addIssue(issues, {
      severity: "error",
      scope: "page",
      category: "structure",
      bucket: "structure",
      title: "Missing page title",
      message: "A key page is missing a title element.",
      fixHint: "Add a descriptive page title.",
      pageUrl: page.url
    });
  }

  if (page.title.length > 0 && page.title.length < 20) {
    addIssue(issues, {
      severity: "warn",
      scope: "page",
      category: "structure",
      bucket: "structure",
      title: "Short page title",
      message: "A key page title is unusually short and low-context.",
      fixHint: "Expand the title with page purpose and product context.",
      pageUrl: page.url
    });
  }

  if (!page.metaDescription) {
    addIssue(issues, {
      severity: "warn",
      scope: "page",
      category: "structure",
      bucket: "structure",
      title: "Missing meta description",
      message: "A key page is missing a meta description.",
      fixHint: "Add a clear summary of who the page serves and what it proves.",
      pageUrl: page.url
    });
  }

  if (!page.h1) {
    addIssue(issues, {
      severity: "error",
      scope: "page",
      category: "structure",
      bucket: "structure",
      title: "Missing H1",
      message: "A key page does not have a primary heading.",
      fixHint: "Add one descriptive H1 per key page.",
      pageUrl: page.url
    });
  }

  if (page.h1Count > 1) {
    addIssue(issues, {
      severity: "warn",
      scope: "page",
      category: "structure",
      bucket: "structure",
      title: "Multiple H1 headings",
      message: "A key page contains more than one H1.",
      fixHint: "Use a single H1 and demote the rest to lower-level headings.",
      pageUrl: page.url
    });
  }

  const proofHeavyPage = ["home", "product", "pricing", "security", "docs"].includes(page.pageType);
  const compactReferencePage = ["faq", "compare", "integrations", "use-case"].includes(page.pageType);

  if ((proofHeavyPage && page.wordCount < 150) || (compactReferencePage && page.wordCount < 80 && page.lists === 0 && page.tables === 0)) {
    addIssue(issues, {
      severity: proofHeavyPage ? "warn" : "info",
      scope: "page",
      category: "structure",
      bucket: "structure",
      title: "Thin key page",
      message: "A key page has little extractable body text.",
      fixHint: "Add plain-language explanations, evidence blocks, and stronger sections.",
      pageUrl: page.url
    });
  }

  if (page.headings.length < 2) {
    addIssue(issues, {
      severity: "warn",
      scope: "page",
      category: "structure",
      bucket: "structure",
      title: "Weak heading structure",
      message: "A key page does not have enough H2/H3 sections to segment meaning clearly.",
      fixHint: "Break the page into sections with scannable headings.",
      pageUrl: page.url
    });
  }

  if (page.jsHeavy) {
    addIssue(issues, {
      severity: "warn",
      scope: "page",
      category: "structure",
      bucket: "structure",
      title: "JavaScript-heavy thin page",
      message: "A key page appears script-heavy with limited extractable HTML text.",
      fixHint: "Render critical content server-side or include HTML fallback text.",
      pageUrl: page.url
    });
  }

  if (page.interactiveControls > 0 && page.ariaLabeledControls / page.interactiveControls < 0.5) {
    addIssue(issues, {
      severity: "info",
      scope: "page",
      category: "accessibility",
      bucket: "structure",
      title: "Low ARIA coverage on controls",
      message: "Interactive controls are present but few expose aria-label metadata.",
      fixHint: "Add accessible labels to critical controls and buttons.",
      pageUrl: page.url
    });
  }
}

function applySchemaConsistencyRules(context: AuditContext, page: PageRecord): void {
  const { issues, input } = context;
  const visible = pageText(page);
  const faqSchema = page.jsonLdTypes.some((type) => type.toLowerCase() === "faqpage");
  const hasProductSchema = page.jsonLdTypes.some((type) => ["product", "softwareapplication", "service"].includes(type.toLowerCase()));
  const questionSignals = page.headings.filter((heading) => heading.includes("?")).length;
  const invisibleSignals = page.schemaTextSignals.filter((signal) => !signal.visible);
  const missingNames = invisibleSignals.filter((signal) => signal.field === "name");
  const missingDescriptions = invisibleSignals.filter((signal) => signal.field === "description");
  const missingQuestions = invisibleSignals.filter((signal) => signal.field === "faq.question");
  const missingAnswers = invisibleSignals.filter((signal) => signal.field === "faq.answer");

  if (missingNames.length > 0) {
    addIssue(issues, {
      severity: "warn",
      scope: "page",
      category: "schema",
      bucket: "structure",
      title: "Structured data name is not visible",
      message: "A JSON-LD name field is not reinforced by visible page text.",
      fixHint: "Mirror the structured entity name in visible headings or supporting copy.",
      pageUrl: page.url,
      evidence: compactEvidence(missingNames.map((signal) => `${signal.recordType}.${signal.field}: ${signal.value}`))
    });
  }

  if (missingDescriptions.length > 0) {
    addIssue(issues, {
      severity: "info",
      scope: "page",
      category: "schema",
      bucket: "structure",
      title: "Structured data description is not visible",
      message: "A JSON-LD description field is not supported by visible page text.",
      fixHint: "Keep structured descriptions aligned with visible product copy.",
      pageUrl: page.url,
      evidence: compactEvidence(missingDescriptions.map((signal) => `${signal.recordType}.${signal.field}: ${signal.value}`))
    });
  }

  if (missingQuestions.length > 0) {
    addIssue(issues, {
      severity: "warn",
      scope: "page",
      category: "schema",
      bucket: "structure",
      title: "FAQ schema does not match visible questions",
      message: "FAQPage JSON-LD contains questions that do not appear as visible page text.",
      fixHint: "Use visible FAQ headings or question rows that match the JSON-LD questions.",
      pageUrl: page.url,
      evidence: compactEvidence(missingQuestions.map((signal) => signal.value))
    });
  }

  if (missingAnswers.length > 0) {
    addIssue(issues, {
      severity: "info",
      scope: "page",
      category: "schema",
      bucket: "structure",
      title: "FAQ schema answers are not visible",
      message: "FAQPage JSON-LD contains answers that are not visible on the page.",
      fixHint: "Expose the same answer text in visible FAQ content, not only structured data.",
      pageUrl: page.url,
      evidence: compactEvidence(missingAnswers.map((signal) => signal.value))
    });
  }

  if (page.pageType === "home" && !page.hasJsonLd) {
    addIssue(issues, {
      severity: "info",
      scope: "page",
      category: "schema",
      bucket: "structure",
      title: "Homepage lacks JSON-LD",
      message: "The homepage has no JSON-LD structured data.",
      fixHint: "Add Organization or Product JSON-LD that matches visible text.",
      pageUrl: page.url
    });
  }

  if (page.pageType === "faq" && !faqSchema) {
    addIssue(issues, {
      severity: "info",
      scope: "page",
      category: "schema",
      bucket: "structure",
      title: "FAQ page lacks FAQ schema",
      message: "A discovered FAQ page does not expose FAQPage structured data.",
      fixHint: "Add FAQPage JSON-LD that mirrors visible questions and answers.",
      pageUrl: page.url
    });
  }

  if (faqSchema && questionSignals === 0 && page.lists === 0) {
    addIssue(issues, {
      severity: "warn",
      scope: "page",
      category: "schema",
      bucket: "structure",
      title: "FAQ schema is not reinforced by visible Q&A structure",
      message: "FAQPage schema is present, but the page does not visibly read like a scannable FAQ.",
      fixHint: "Expose visible questions, headings, and answer sections that match the structured data.",
      pageUrl: page.url
    });
  }

  if ((page.pageType === "home" || page.pageType === "product") && hasProductSchema && keywordCoverage(visible, input.brand.brand.category) < 0.4) {
    addIssue(issues, {
      severity: "info",
      scope: "page",
      category: "schema",
      bucket: "structure",
      title: "Structured data is not reinforced by visible category text",
      message: "Product-like schema exists, but visible copy does not clearly restate the product category.",
      fixHint: "Repeat the product category and positioning in visible headings and supporting copy.",
      pageUrl: page.url
    });
  }
}

function applyEvidenceRules(context: AuditContext, page: PageRecord): void {
  const { issues } = context;
  const requirements: Partial<
    Record<
      PageType,
      {
        title: string;
        severity: "warn" | "info";
        minGroups: number;
        groups: Array<{ label: string; signals: string[] }>;
        fixHint: string;
      }
    >
  > = {
    pricing: {
      title: "Pricing page evidence density is low",
      severity: "warn",
      minGroups: 3,
      groups: [
        { label: "numeric prices or ranges", signals: ["numbers"] },
        { label: "plan or packaging terms", signals: ["pricing-proof"] },
        { label: "tables or scannable lists", signals: ["tables", "lists"] },
        { label: "supporting body depth", signals: ["body-depth"] }
      ],
      fixHint: "Add concrete plans, ranges, packaging qualifiers, and scannable proof blocks."
    },
    security: {
      title: "Security page evidence density is low",
      severity: "warn",
      minGroups: 2,
      groups: [
        { label: "trust markers", signals: ["trust-markers"] },
        { label: "controls lists or tables", signals: ["lists", "tables"] },
        { label: "implementation or workflow detail", signals: ["workflow-proof", "body-depth"] }
      ],
      fixHint: "Add compliance markers, controls, deployment details, and buyer-facing trust answers."
    },
    docs: {
      title: "Docs page evidence density is low",
      severity: "info",
      minGroups: 2,
      groups: [
        { label: "freshness or version markers", signals: ["freshness", "versions"] },
        { label: "API, SDK, or guide terms", signals: ["docs-proof"] },
        { label: "workflow or setup detail", signals: ["workflow-proof", "lists", "tables"] }
      ],
      fixHint: "Add updated dates, versions, setup steps, API references, and example-driven documentation."
    },
    compare: {
      title: "Compare page evidence density is low",
      severity: "info",
      minGroups: 2,
      groups: [
        { label: "comparison criteria", signals: ["comparison-criteria"] },
        { label: "tables or scannable lists", signals: ["tables", "lists"] },
        { label: "pricing, docs, or proof context", signals: ["pricing-proof", "docs-proof", "trust-markers"] }
      ],
      fixHint: "Add comparison tables, decision criteria, fit guidance, and proof-oriented bullet lists."
    },
    "use-case": {
      title: "Use-case page evidence density is low",
      severity: "info",
      minGroups: 2,
      groups: [
        { label: "workflow or rollout detail", signals: ["workflow-proof"] },
        { label: "outcomes or success criteria", signals: ["outcome-proof", "numbers"] },
        { label: "supporting proof context", signals: ["pricing-proof", "docs-proof", "trust-markers", "body-depth"] }
      ],
      fixHint: "Add audience-specific workflows, before/after outcomes, and measurable success criteria."
    }
  };

  const requirement = requirements[page.pageType];
  if (!requirement) {
    return;
  }

  const missingGroups = summarizeMissingGroups(page, requirement.groups);
  const presentGroups = summarizePresentSignals(page, requirement.groups);
  const presentCount = requirement.groups.length - missingGroups.length;

  if (presentCount >= requirement.minGroups) {
    return;
  }

  addIssue(issues, {
    severity: presentCount === 0 ? "warn" : requirement.severity,
    scope: "page",
    category: "evidence",
    bucket: "evidence",
    title: requirement.title,
    message: `The ${page.pageType} page only satisfies ${presentCount}/${requirement.groups.length} expected evidence signal groups.`,
    fixHint: requirement.fixHint,
    pageUrl: page.url,
    evidence: `Missing: ${missingGroups.join(", ")}. Present: ${presentGroups.length > 0 ? presentGroups.join("; ") : "none"}.`
  });
}

function applyComparativeRules(context: AuditContext, page: PageRecord): void {
  const { issues, input } = context;
  const visible = pageText(page).toLowerCase();

  if (page.pageType === "faq") {
    const faqSignals = page.headings.filter((heading) => heading.includes("?")).length;
    if (faqSignals < 2 && page.lists === 0) {
      addIssue(issues, {
        severity: "info",
        scope: "page",
        category: "coverage",
        bucket: "comparativeReadiness",
        title: "FAQ page lacks scannable question structure",
        message: "The FAQ page exists, but it is not strongly organized around visible questions and answers.",
        fixHint: "Use explicit question headings and concise answer blocks for recurring buyer concerns.",
        pageUrl: page.url
      });
    }
  }

  if (page.pageType === "compare") {
    const mentionsCompetitor = input.competitors.competitors.some((competitor) => visible.includes(competitor.name.toLowerCase()));

    if (!mentionsCompetitor) {
      addIssue(issues, {
        severity: "warn",
        scope: "page",
        category: "comparison",
        bucket: "comparativeReadiness",
        title: "Compare page does not name declared competitors",
        message: "A compare-oriented page exists, but it does not explicitly mention any declared competitors.",
        fixHint: "Name the highest-priority competitors and explain fit differences directly on the page.",
        pageUrl: page.url
      });
    }

    if (page.headings.length < 2) {
      addIssue(issues, {
        severity: "info",
        scope: "page",
        category: "comparison",
        bucket: "comparativeReadiness",
        title: "Compare page lacks decision-making structure",
        message: "The compare page should segment trade-offs, fit guidance, and evidence into clear sections.",
        fixHint: "Add sections for buyer fit, trade-offs, migration paths, and decision criteria.",
        pageUrl: page.url
      });
    }
  }

  if (page.pageType === "use-case" && page.headings.length < 2) {
    addIssue(issues, {
      severity: "info",
      scope: "page",
      category: "coverage",
      bucket: "comparativeReadiness",
      title: "Use-case page lacks contextual structure",
      message: "A use-case page should explain problem, workflow, and outcomes in separate sections.",
      fixHint: "Add sections for the problem, the recommended workflow, and expected outcomes.",
      pageUrl: page.url
    });
  }
}

function applyConnectivityRules(context: AuditContext): void {
  const { issues, pages, incomingLinkCounts } = context;
  const keyPages = pages.filter((page) => isKeyPage(page) && page.pageType !== "home");

  for (const page of keyPages) {
    const incoming = incomingLinkCounts.get(page.url) ?? 0;
    if (incoming === 0) {
      const criticalProofPage = ["pricing", "security", "docs", "faq", "compare"].includes(page.pageType);
      addIssue(issues, {
        severity: criticalProofPage ? "warn" : "info",
        scope: "page",
        category: "coverage",
        bucket: "comparativeReadiness",
        title: "Key proof page is weakly linked",
        message: "A key page is discovered, but other pages do not link to it within the crawled site.",
        fixHint: "Link to this page from the homepage, docs, or related buyer-path pages.",
        pageUrl: page.url
      });
    }
  }
}

function applyHomepageRules(context: AuditContext): void {
  const { issues, input, pages } = context;
  const homepage = context.pageTypes.get("home")?.[0];
  if (!homepage) {
    addIssue(issues, {
      severity: "error",
      scope: "site",
      category: "coverage",
      bucket: "access",
      title: "Homepage was not crawled",
      message: "The crawl did not yield a homepage record.",
      fixHint: "Ensure the homepage is public and discoverable."
    });
    return;
  }

  const homeText = pageText(homepage);

  if (keywordCoverage(homeText, input.brand.brand.category) < 0.5) {
    addIssue(issues, {
      severity: "warn",
      scope: "page",
      category: "positioning",
      bucket: "entityClarity",
      title: "Homepage category signal is weak",
      message: "The homepage does not clearly reinforce the declared product category.",
      fixHint: "Name the category directly in the hero or early supporting copy.",
      pageUrl: homepage.url
    });
  }

  if (
    input.brand.brand.target_personas.length > 0 &&
    !input.brand.brand.target_personas.some((persona) => keywordCoverage(homeText, persona) >= 0.5)
  ) {
    addIssue(issues, {
      severity: "info",
      scope: "page",
      category: "positioning",
      bucket: "entityClarity",
      title: "Homepage persona fit is implicit",
      message: "Target personas are not clearly named on the homepage.",
      fixHint: "Call out the primary team or buyer in visible homepage text.",
      pageUrl: homepage.url
    });
  }

  if (
    input.brand.brand.key_use_cases.length > 0 &&
    !input.brand.brand.key_use_cases.some((useCase) => keywordCoverage(homeText, useCase) >= 0.5)
  ) {
    addIssue(issues, {
      severity: "info",
      scope: "page",
      category: "positioning",
      bucket: "entityClarity",
      title: "Homepage use cases are underspecified",
      message: "The homepage does not clearly mention the product's primary jobs to be done.",
      fixHint: "Add use-case language near the hero and supporting sections.",
      pageUrl: homepage.url
    });
  }

  const linkedTypes = new Set(
    homepage.internalLinks
      .map((url) => pages.find((candidate) => candidate.url === url)?.pageType)
      .filter((pageType) => pageType !== undefined && pageType !== "home")
  );

  if (linkedTypes.size < 3) {
    addIssue(issues, {
      severity: "warn",
      scope: "page",
      category: "coverage",
      bucket: "comparativeReadiness",
      title: "Homepage under-links key proof pages",
      message: "The homepage links to too few key proof pages to drive strong downstream discovery.",
      fixHint: "Link from the homepage to pricing, docs, security, FAQ, or compare pages.",
      pageUrl: homepage.url
    });
  }
}

function applyCoverageRules(context: AuditContext): string[] {
  const { issues, pageTypes, input } = context;
  const missingPageTypes: string[] = [];

  for (const requirement of REQUIRED_PAGE_TYPES) {
    if ((pageTypes.get(requirement.pageType) ?? []).length === 0) {
      missingPageTypes.push(requirement.pageType);
      addIssue(issues, {
        severity: requirement.severity,
        scope: "site",
        category: "coverage",
        bucket: requirement.bucket,
        title: `Missing ${requirement.title}`,
        message: `No ${requirement.pageType} page was discovered.`,
        fixHint: `Add a dedicated ${requirement.pageType} page with clear, citable content.`
      });
    }
  }

  if ((pageTypes.get("use-case") ?? []).length < 3) {
    addIssue(issues, {
      severity: "info",
      scope: "site",
      category: "coverage",
      bucket: "comparativeReadiness",
      title: "Use-case coverage is thin",
      message: "Fewer than three use-case pages were discovered.",
      fixHint: "Add more use-case or solution pages for distinct buyer contexts."
    });
  }

  const comparePages = pageTypes.get("compare") ?? [];
  if (comparePages.length > 0 && input.competitors.competitors.length > 0) {
    const compareText = comparePages.map((page) => page.textSnippet.toLowerCase()).join(" ");
    const mentionsCompetitor = input.competitors.competitors.some((competitor) =>
      compareText.includes(competitor.name.toLowerCase())
    );

    if (!mentionsCompetitor) {
      addIssue(issues, {
        severity: "info",
        scope: "site",
        category: "comparison",
        bucket: "comparativeReadiness",
        title: "Compare pages do not mention declared competitors",
        message: "Compare-oriented pages exist, but they do not name any declared competitors.",
        fixHint: "Add explicit alternatives or versus pages for the highest-priority competitors."
      });
    }
  }

  return missingPageTypes;
}

export async function runAudit(input: AuditInput): Promise<AuditResult> {
  const createdAt = new Date().toISOString();
  const crawl = await crawlSite({
    siteInput: input.siteInput,
    sitemapUrl: input.sitemapUrl,
    includePatterns: input.includePatterns ?? [],
    excludePatterns: input.excludePatterns ?? [],
    maxPages: input.maxPages ?? 20
  });
  const pages = normalizePages(crawl.source, crawl.pages, input.brand.brand);
  const issues: Issue[] = [];
  const pageTypes = mapPageTypes(pages);
  const byUrl = new Map(pages.map((page) => [page.url, page]));
  const incomingLinkCounts = mapIncomingLinkCounts(pages);
  const context: AuditContext = {
    input,
    crawl,
    pages,
    issues,
    pageTypes,
    byUrl,
    incomingLinkCounts
  };

  applySiteAccessRules(context);

  for (const page of pages) {
    if (page.fetchError || page.status === 0) {
      addIssue(issues, {
        severity: "error",
        scope: "page",
        category: "crawlability",
        bucket: "access",
        title: "Page fetch failed",
        message: page.fetchError ?? "The page could not be fetched.",
        fixHint: "Make the page reachable without a browser-only session.",
        pageUrl: page.url
      });
      continue;
    }

    applyKeyPageStructureRules(context, page);
    applySchemaConsistencyRules(context, page);
    applyEvidenceRules(context, page);
    applyComparativeRules(context, page);
  }

  applyHomepageRules(context);
  applyConnectivityRules(context);
  const missingPageTypes = applyCoverageRules(context);

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
  const completedAt = new Date().toISOString();

  return {
    run: {
      id: randomUUID(),
      mode: "audit",
      createdAt,
      completedAt,
      artifactVersion: ARTIFACT_VERSION,
      ruleVersion: RULE_VERSION,
      configHash: createConfigHash(input),
      sampleCount: 0,
      locale: null
    },
    site: {
      kind: crawl.source.kind,
      input: input.siteInput,
      baseUrl: crawl.source.baseUrl,
      generatedAt: completedAt
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
      competitorNames: input.competitors.competitors.map((competitor) => competitor.name),
      prompts: input.prompts.prompts.length
    }
  };
}

export { BUCKET_LABELS };
