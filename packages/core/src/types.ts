export type Severity = "error" | "warn" | "info";
export type Scope = "site" | "page";
export type SiteKind = "remote" | "local";
export type PageType =
  | "home"
  | "product"
  | "pricing"
  | "security"
  | "faq"
  | "compare"
  | "docs"
  | "integrations"
  | "use-case"
  | "other";

export type ScoreBucketId =
  | "access"
  | "structure"
  | "entityClarity"
  | "evidence"
  | "comparativeReadiness";

export type IssueCategory =
  | "crawlability"
  | "indexability"
  | "structure"
  | "schema"
  | "positioning"
  | "evidence"
  | "comparison"
  | "coverage"
  | "accessibility";

export interface CanonicalFact {
  id: string;
  type: string;
  text: string;
}

export interface BrandDetails {
  name: string;
  domain: string;
  category: string;
  one_liner: string;
  target_personas: string[];
  key_use_cases: string[];
  competitors: string[];
  canonical_facts: CanonicalFact[];
  trusted_domains: string[];
}

export interface BrandConfig {
  brand: BrandDetails;
}

export interface CompetitorEntry {
  name: string;
  domain?: string;
  category?: string;
}

export interface CompetitorsConfig {
  competitors: CompetitorEntry[];
}

export interface PromptCase {
  id: string;
  category: string;
  template: string;
  expected_signal: string;
  priority?: "high" | "medium" | "low";
}

export interface PromptsConfig {
  prompts: PromptCase[];
}

export interface SiteSource {
  kind: SiteKind;
  input: string;
  baseUrl: string;
  rootDir?: string;
}

export interface RobotsSnapshot {
  exists: boolean;
  text: string;
  blockedAll: boolean;
  blockedAiBots: string[];
  sitemapHints: string[];
}

export interface FetchedPage {
  url: string;
  status: number;
  html: string;
  contentType: string;
  fetchError?: string;
}

export interface PageRecord {
  url: string;
  pathname: string;
  status: number;
  pageType: PageType;
  title: string;
  metaDescription: string;
  h1: string;
  h1Count: number;
  headings: string[];
  wordCount: number;
  internalLinks: string[];
  externalLinks: string[];
  lists: number;
  tables: number;
  hasJsonLd: boolean;
  jsonLdTypes: string[];
  ariaLabeledControls: number;
  interactiveControls: number;
  canonical: string | null;
  noindex: boolean;
  hasDate: boolean;
  hasVersion: boolean;
  hasTrustSignals: boolean;
  hasNumbers: boolean;
  jsHeavy: boolean;
  textSnippet: string;
  fetchError?: string;
}

export interface Issue {
  id: string;
  severity: Severity;
  scope: Scope;
  category: IssueCategory;
  bucket: ScoreBucketId;
  title: string;
  message: string;
  fixHint: string;
  pageUrl?: string;
  evidence?: string;
}

export interface Recommendation {
  id: string;
  title: string;
  rationale: string;
  expectedOutcome: string;
  relatedIssues: string[];
}

export interface BucketScore {
  score: number;
  issueCount: number;
  errorCount: number;
  warnCount: number;
  infoCount: number;
}

export interface AuditSummary {
  overallScore: number;
  vavr: number | null;
  missingPageTypes: string[];
  crawledPages: number;
  discoveredUrls: number;
  keyPageCount: number;
}

export interface AuditResult {
  site: {
    kind: SiteKind;
    input: string;
    baseUrl: string;
    generatedAt: string;
  };
  summary: AuditSummary;
  scores: Record<ScoreBucketId, BucketScore>;
  issues: Issue[];
  recommendations: Recommendation[];
  pages: PageRecord[];
  robots: RobotsSnapshot;
  configs: {
    brand: Pick<
      BrandDetails,
      "name" | "domain" | "category" | "target_personas" | "key_use_cases" | "trusted_domains"
    >;
    competitors: number;
    prompts: number;
  };
}

export interface CrawlOptions {
  siteInput: string;
  sitemapUrl?: string;
  includePatterns: string[];
  excludePatterns: string[];
  maxPages: number;
}

export interface CrawlResult {
  source: SiteSource;
  robots: RobotsSnapshot;
  discoveredUrls: string[];
  pages: FetchedPage[];
}

export interface AuditInput {
  siteInput: string;
  sitemapUrl?: string;
  includePatterns?: string[];
  excludePatterns?: string[];
  maxPages?: number;
  brand: BrandConfig;
  competitors: CompetitorsConfig;
  prompts: PromptsConfig;
}

