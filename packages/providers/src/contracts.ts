export type ProviderName = "openai" | "perplexity" | "manual";

export interface Citation {
  url: string;
  domain: string;
  title?: string;
  owned: boolean;
  trusted: boolean;
}

export interface SearchResult {
  url: string;
  title?: string;
  date?: string;
  snippet?: string;
  source?: string;
}

export interface ProviderResponse {
  provider: ProviderName;
  model: string;
  promptId: string;
  answerText: string;
  citations: Citation[];
  searchResults: SearchResult[];
  rawPayload: unknown;
  requestedAt: string;
  locale: string | null;
  sampleIndex: number;
  runCount: number;
  holdout: boolean;
  rankPosition: number | null;
}

export interface EvalRequest {
  promptId: string;
  prompt: string;
  brandDomain: string;
  trustedDomains: string[];
  expectedSignal?: string;
  locale?: string;
  sampleIndex?: number;
  runCount?: number;
  holdout?: boolean;
}

export interface ProviderRunOptions {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  timeoutMs?: number;
  locale?: string;
  sampleIndex?: number;
  runCount?: number;
  holdout?: boolean;
}
