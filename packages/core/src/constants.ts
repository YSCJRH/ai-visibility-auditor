import type { PageType, ScoreBucketId, Severity } from "./types.ts";

export const AI_BOTS = ["OAI-SearchBot", "PerplexityBot"] as const;

export const KEY_PAGE_TYPES: PageType[] = [
  "home",
  "product",
  "pricing",
  "security",
  "faq",
  "compare",
  "docs",
  "integrations",
  "use-case"
];

export const REQUIRED_PAGE_TYPES: Array<{
  pageType: PageType;
  title: string;
  severity: Severity;
  bucket: ScoreBucketId;
}> = [
  { pageType: "pricing", title: "Pricing page", severity: "error", bucket: "evidence" },
  { pageType: "security", title: "Security page", severity: "warn", bucket: "evidence" },
  { pageType: "docs", title: "Documentation page", severity: "warn", bucket: "evidence" },
  { pageType: "faq", title: "FAQ page", severity: "warn", bucket: "comparativeReadiness" },
  { pageType: "compare", title: "Compare page", severity: "warn", bucket: "comparativeReadiness" },
  { pageType: "integrations", title: "Integrations page", severity: "warn", bucket: "comparativeReadiness" }
];

export const BUCKET_LABELS: Record<ScoreBucketId, string> = {
  access: "Access",
  structure: "Structure",
  entityClarity: "Entity Clarity",
  evidence: "Evidence",
  comparativeReadiness: "Comparative Readiness"
};

export const SEVERITY_PENALTIES: Record<Severity, number> = {
  error: 18,
  warn: 8,
  info: 3
};

