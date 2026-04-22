export type RunKind = "audit" | "eval" | "manual-import" | "validation-import";
export type AdminRunStatus = "queued" | "running" | "completed" | "failed";
export type EvalProfileName = "fast-first-eval" | "self-dogfood-stability" | "high-confidence-review";

export interface EvalProfilePreset {
  id: EvalProfileName;
  label: string;
  description: string;
  defaults: {
    provider: "openai" | "perplexity";
    model: string;
    locale: string | null;
    samples: number;
    timeoutMs: number;
  };
}

export const EVAL_PROFILE_PRESETS: Record<EvalProfileName, EvalProfilePreset> = {
  "fast-first-eval": {
    id: "fast-first-eval",
    label: "Fast first eval",
    description: "Lowest-friction first benchmark pass for fixtures and external starter repositories.",
    defaults: {
      provider: "openai",
      model: "gpt-5-mini",
      locale: "en-US",
      samples: 1,
      timeoutMs: 60000
    }
  },
  "self-dogfood-stability": {
    id: "self-dogfood-stability",
    label: "Self-dogfood stability",
    description: "Adds one extra sample so maintainers can see instability earlier on repo self-audits.",
    defaults: {
      provider: "openai",
      model: "gpt-5-mini",
      locale: "en-US",
      samples: 2,
      timeoutMs: 60000
    }
  },
  "high-confidence-review": {
    id: "high-confidence-review",
    label: "High-confidence review",
    description: "Use a heavier model for smaller, messaging-sensitive adjudication passes.",
    defaults: {
      provider: "openai",
      model: "gpt-5",
      locale: "en-US",
      samples: 1,
      timeoutMs: 60000
    }
  }
};

export interface RunRecord {
  id: string;
  mode: RunKind;
  createdAt: string;
  completedAt: string;
  artifactVersion: string;
  ruleVersion: string;
  configHash?: string;
  sampleCount: number;
  locale: string | null;
  validationSource?: string;
}

export interface SiteRecord {
  kind: "remote" | "local";
  input: string;
  baseUrl: string;
  display?: string;
  generatedAt: string;
}

export interface RunManifest {
  kind: RunKind;
  run: RunRecord;
  generatedAt: string;
  site: SiteRecord;
  summary: Record<string, number | string | null | string[]>;
  artifacts: string[];
  provider?: {
    name: string;
    model: string;
    locale?: string | null;
    sampleCount?: number;
  };
}

export interface ShareSummary {
  project: "AnswerLens";
  tagline: "CI for AI discoverability.";
  positioning: string;
  disclaimer: string;
  run: Omit<RunRecord, "createdAt" | "completedAt" | "configHash" | "validationSource"> & {
    generatedAt: string;
  };
  site: SiteRecord;
  metrics: Record<string, number | string | null>;
  topIssues: Array<{
    severity: string;
    title: string;
    scope: string;
    fixHint: string;
  }>;
  topRecommendations: Array<{
    title: string;
    rationale: string;
    expectedOutcome: string;
  }>;
  artifacts: string[];
}

export interface AuditScoreBucket {
  score: number;
  issueCount: number;
  errorCount: number;
  warnCount: number;
  infoCount: number;
}

export interface AuditIssue {
  id: string;
  severity: string;
  scope: string;
  category: string;
  bucket: string;
  title: string;
  message: string;
  fixHint: string;
  pageUrl?: string;
}

export interface AuditRecommendation {
  id: string;
  title: string;
  rationale: string;
  expectedOutcome: string;
  relatedIssues: string[];
}

export interface AuditResult {
  run: RunRecord;
  site: SiteRecord;
  summary: Record<string, unknown>;
  scores: Record<string, AuditScoreBucket>;
  issues: AuditIssue[];
  recommendations: AuditRecommendation[];
  pages: Array<Record<string, unknown>>;
  robots?: Record<string, unknown>;
  configs?: Record<string, unknown>;
}

export interface EvalSummaryJson {
  run: RunRecord;
  site: SiteRecord;
  provider: {
    name: string;
    model: string;
    locale: string | null;
    sampleCount: number;
  };
  generatedAt: string;
  audit: Record<string, unknown>;
  summary: Record<string, unknown>;
  prompts: Array<{
    promptId: string;
    category: string;
    priority: string;
    prompt: string;
    expectedSignal: string;
    intent: string | null;
    holdout: boolean;
    provider: {
      name: string;
      model: string;
      locale: string | null;
      sampleCount: number;
    };
    model: string;
    locale: string | null;
    sampleIndex: number;
    rankPosition: number | null;
    citedCount: number;
    recommendation: boolean;
    misrepresented: boolean;
    matchedFacts: string[];
    competitorMentions: string[];
    scores: Record<string, number | boolean | null>;
  }>;
  promptGroups: Array<Record<string, unknown>>;
  briefs: Array<{
    id: string;
    type: string;
    title: string;
    audience: string;
    angle: string;
    cta: string;
  }>;
}

export interface SearchValidationSummaryJson {
  run: RunRecord;
  site: SiteRecord;
  source: {
    kind: string;
    label: string;
  };
  summary: Record<string, unknown>;
  findings: Array<Record<string, unknown>>;
  topPages: Array<Record<string, unknown>>;
}

export interface ArtifactEntry {
  name: string;
  path: string;
  contentType: "markdown" | "json" | "html" | "text";
}

export interface AdminRunListItem {
  id: string;
  kind: RunKind;
  status: AdminRunStatus;
  generatedAt: string;
  siteLabel: string;
  siteInput: string;
  overallScore: number | null;
  vavr: number | null;
  artifactCount: number;
}

export interface AdminRunDetail {
  id: string;
  manifest: RunManifest;
  shareSummary: ShareSummary | null;
  auditResult: AuditResult | null;
  evalSummary: EvalSummaryJson | null;
  searchValidationSummary: SearchValidationSummaryJson | null;
  artifacts: ArtifactEntry[];
}

export interface ConfigPresetSummary {
  id: string;
  label: string;
  description: string;
  defaultSiteInput: string;
  brandPath: string;
  competitorsPath: string;
  promptsPath: string;
  runtimePath?: string;
  runtimeDefaults?: {
    provider: "openai" | "perplexity";
    model: string;
    locale: string | null;
    samples: number;
    timeoutMs: number;
    baseUrl: string;
  } | null;
  recommendedProfile?: EvalProfileName | null;
  siteDisplayName?: string;
  domain: string;
}

export interface RunJobRecord {
  id: string;
  kind: "audit" | "eval";
  status: AdminRunStatus;
  site: string;
  presetId: string;
  provider?: string;
  runId?: string;
  error?: string;
  startedAt: string;
  updatedAt: string;
}

export interface CreateAuditRunInput {
  site: string;
  presetId: string;
}

export interface CreateEvalRunInput {
  site: string;
  presetId: string;
  profile?: EvalProfileName;
  provider?: "openai" | "perplexity";
  model?: string;
  samples?: number;
  locale?: string;
  runtimePath?: string;
  timeoutMs?: number;
  baseUrl?: string;
}
