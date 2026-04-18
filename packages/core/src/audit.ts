import { createHash, randomUUID } from "node:crypto";
import {
  ARTIFACT_VERSION,
  BUCKET_LABELS,
  RULE_VERSION,
  SEVERITY_PENALTIES
} from "./constants.ts";
import { crawlSite } from "./crawl.ts";
import { normalizePages } from "./extract.ts";
import { pageQualityRules } from "./rules/page-quality.ts";
import { discoverabilityRules } from "./rules/discoverability.ts";
import type { IncomingLinkReference } from "./rules/registry.ts";
import { addIssue, runFinalRules, runPageRules, runSiteRules } from "./rules/registry.ts";
import { siteAccessRules, siteFinalRules } from "./rules/site-access.ts";
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
import { clamp } from "./utils.ts";

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
      rationale: "Answer engines need comparison-ready source material plus contextual internal linking, not just a homepage.",
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

function mapIncomingLinks(pages: PageRecord[]): Map<string, IncomingLinkReference[]> {
  const incomingLinks = new Map<string, IncomingLinkReference[]>();
  const knownUrls = new Set(pages.map((page) => page.url));

  for (const page of pages) {
    const seen = new Set<string>();

    for (const record of page.internalLinkRecords) {
      if (!knownUrls.has(record.url) || record.url === page.url) {
        continue;
      }

      const dedupeKey = `${record.url}::${record.anchorText.toLowerCase()}::${record.sourceContext.toLowerCase()}`;
      if (seen.has(dedupeKey)) {
        continue;
      }
      seen.add(dedupeKey);

      const current = incomingLinks.get(record.url) ?? [];
      current.push({
        sourceUrl: page.url,
        sourcePageType: page.pageType,
        ...record
      });
      incomingLinks.set(record.url, current);
    }
  }

  return incomingLinks;
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
  const incomingLinks = mapIncomingLinks(pages);
  const context = {
    input,
    crawl,
    pages,
    issues,
    pageTypes,
    byUrl,
    incomingLinks,
    missingPageTypes: [] as string[]
  };

  runSiteRules(siteAccessRules, context);

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

    runPageRules(pageQualityRules, context, page);
  }

  runFinalRules(siteFinalRules, context);
  runFinalRules(discoverabilityRules, context);

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
      display: input.brand.brand.site_display_name,
      generatedAt: completedAt
    },
    summary: {
      overallScore,
      vavr: null,
      missingPageTypes: context.missingPageTypes,
      crawledPages: pages.length,
      discoveredUrls: crawl.discoveredUrls.length,
      keyPageCount: pages.filter((page) => page.pageType !== "other").length
    },
    scores,
    issues,
    recommendations: summarizeRecommendations(issues, context.missingPageTypes),
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
