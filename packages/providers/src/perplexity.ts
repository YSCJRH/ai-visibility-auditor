import type { EvalRequest, ProviderResponse } from "./contracts.ts";

export async function runPerplexityEval(_request: EvalRequest): Promise<ProviderResponse> {
  throw new Error("Perplexity eval adapter is scaffolded but not enabled in this build yet.");
}
