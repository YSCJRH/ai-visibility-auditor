export type ProviderName = "openai" | "perplexity";

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
}

export interface EvalRequest {
  promptId: string;
  prompt: string;
  brandDomain: string;
  trustedDomains: string[];
  expectedSignal?: string;
}

export interface ProviderRunOptions {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  timeoutMs?: number;
}
