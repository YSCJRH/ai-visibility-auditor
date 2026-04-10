import type { EvalRequest, ProviderName, ProviderResponse, ProviderRunOptions } from "./contracts.ts";
import { runOpenAIEval } from "./openai.ts";
import { runPerplexityEval } from "./perplexity.ts";

export * from "./contracts.ts";
export * from "./openai.ts";
export * from "./perplexity.ts";

export async function runEvalProvider(
  provider: ProviderName,
  request: EvalRequest,
  options: ProviderRunOptions = {}
): Promise<ProviderResponse> {
  if (provider === "openai") {
    return runOpenAIEval(request, options);
  }

  if (provider === "perplexity") {
    return runPerplexityEval(request, options);
  }

  throw new Error(`Unsupported provider: ${provider}`);
}
