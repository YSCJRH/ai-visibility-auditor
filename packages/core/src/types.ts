export type Severity = "error" | "warn" | "info";
export type Scope = "site" | "page";
export type SiteKind = "remote" | "local";
export type RunMode = "audit" | "eval" | "manual-import" | "validation-import";
export type ValidationSource = "search-console" | "bing-webmaster";
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

export type PromptPriority = "high" | "medium" | "low";

export interface PromptCase {
  id: string;
  category: string;
  template: string;
  expected_signal: string;
  priority?: PromptPriority;
  intent?: string;
  holdout?: boolean;
  variables?: string[];
  locale?: string;
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

export type JsonLdRecordType = "FAQPage" | "Organization" | "SoftwareApplication" | "Product";

export interface JsonLdQuestionAnswer {
  question: string;
  answer: string;
}

export interface JsonLdRecord {
  type: JsonLdRecordType;
  name?: string;
  description?: string;
  url?: string;
  category?: string;
  questions?: JsonLdQuestionAnswer[];
}

export interface SchemaTextSignal {
  recordType: JsonLdRecordType;
  field: string;
  value: string;
  visible: boolean;
}

export interface EvidenceSignal {
  type: string;
  count: number;
  examples: string[];
}

export interface InternalLinkRecord {
  url: string;
  anchorText: string;
  sourceContext: string;
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
  internalLinkRecords: InternalLinkRecord[];
  internalLinks: string[];
  externalLinks: string[];
  lists: number;
  tables: number;
  hasJsonLd: boolean;
  jsonLdTypes: string[];
  jsonLdRecords: JsonLdRecord[];
  schemaTextSignals: SchemaTextSignal[];
  evidenceSignals: EvidenceSignal[];
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

export interface RunMetadata {
  id: string;
  mode: RunMode;
  createdAt: string;
  completedAt: string;
  artifactVersion: string;
  ruleVersion: string;
  configHash: string;
  sampleCount: number;
  locale: string | null;
  validationSource?: ValidationSource;
}

export interface AuditResult {
  run: RunMetadata;
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
    competitorNames: string[];
    prompts: number;
  };
}

export interface SearchValidationSourceDescriptor {
  type: ValidationSource;
  input: string;
  format: "csv";
}

export interface SearchValidationPageRecord {
  page: string;
  normalizedUrl: string;
  domain: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  outOfScope: boolean;
  matchedAuditPageUrl: string | null;
  matchedPageType: PageType | null;
  hasEvidence: boolean;
  hasClicks: boolean;
  auditIssueCount: number;
  highestAuditSeverity: Severity | null;
}

export interface SearchValidationFinding {
  id: string;
  severity: Severity;
  title: string;
  pageUrl: string;
  pageType: PageType | null;
  message: string;
  evidence?: string;
  relatedAuditIssueIds?: string[];
}

export interface SearchValidationKeyPageCoverage {
  pageUrl: string;
  pageType: PageType;
  hasEvidence: boolean;
  impressions: number;
  clicks: number;
}

export interface SearchValidationSummary {
  importedPageCount: number;
  matchedAuditPageCount: number;
  outOfScopePageCount: number;
  keyPagesWithEvidence: number;
  keyPagesWithoutEvidence: number;
  pagesWithClicks: number;
  pagesWithImpressions: number;
  totalClicks: number;
  totalImpressions: number;
}

export interface SearchValidationResult {
  run: RunMetadata;
  site: AuditResult["site"];
  source: SearchValidationSourceDescriptor;
  summary: SearchValidationSummary;
  findings: SearchValidationFinding[];
  keyPageCoverage: SearchValidationKeyPageCoverage[];
  topPages: SearchValidationPageRecord[];
  pages: SearchValidationPageRecord[];
}

export type SearchConsolePageRecord = SearchValidationPageRecord;
export type SearchConsoleFinding = SearchValidationFinding;
export type SearchConsoleKeyPageCoverage = SearchValidationKeyPageCoverage;
export type SearchConsoleValidationSummary = SearchValidationSummary;
export type SearchConsoleValidationResult = SearchValidationResult;

export interface IndexNowCandidate {
  url: string;
  pageType: PageType;
  reason: string;
}

export interface IndexNowHelperSummary {
  candidateCount: number;
  keyPageCandidateCount: number;
  host: string;
  endpoint: string;
}

export interface IndexNowHelperResult {
  site: AuditResult["site"];
  generatedAt: string;
  summary: IndexNowHelperSummary;
  candidates: IndexNowCandidate[];
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

