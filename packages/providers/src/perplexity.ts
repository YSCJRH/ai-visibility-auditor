import type { EvalRequest, ProviderResponse, ProviderRunOptions } from "./contracts.ts";

export async function runPerplexityEval(_request: EvalRequest, _options: ProviderRunOptions = {}): Promise<ProviderResponse> {
  throw new Error("Perplexity eval adapter is scaffolded but not enabled in this build yet.");
}
