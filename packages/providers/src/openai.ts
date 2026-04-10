import type { EvalRequest, ProviderResponse } from "./contracts.ts";

export async function runOpenAIEval(_request: EvalRequest): Promise<ProviderResponse> {
  throw new Error("OpenAI eval adapter is scaffolded but not enabled in this build yet.");
}
