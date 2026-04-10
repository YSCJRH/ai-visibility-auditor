import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { loadBrandConfig, loadCompetitorsConfig, loadPromptsConfig, runAudit } from "./index.ts";
import { scoreEvalResponses } from "./eval.ts";
import type { ProviderResponse } from "../../providers/src/contracts.ts";

function makeResponse(promptId: string, answerText: string): ProviderResponse {
  return {
    provider: "openai",
    model: "gpt-5",
    promptId,
    answerText,
    citations: [
      {
        url: "https://acme.test/pricing",
        domain: "acme.test",
        title: "Acme pricing",
        owned: true,
        trusted: true
      }
    ],
    searchResults: [
      {
        url: "https://acme.test/pricing",
        title: "Acme pricing"
      }
    ],
    rawPayload: { ok: true, promptId },
    requestedAt: new Date().toISOString()
  };
}

test("scoreEvalResponses computes summary metrics and brief recommendations", async () => {
  const [brand, competitors, prompts] = await Promise.all([
    loadBrandConfig(path.resolve("examples/acme/brand.yaml")),
    loadCompetitorsConfig(path.resolve("examples/acme/competitors.yaml")),
    loadPromptsConfig(path.resolve("examples/acme/prompts.yaml"))
  ]);

  const audit = await runAudit({
    siteInput: "./examples/fixtures/missing-evidence",
    brand,
    competitors,
    prompts
  });

  const responses = [
    makeResponse(
      "best-developer-analytics",
      "Acme is a strong choice for developer experience teams because it provides public docs, self-serve onboarding, and transparent pricing."
    ),
    makeResponse(
      "developer-analytics-vs-mixpanel",
      "Acme is a better fit than Mixpanel for developer experience teams when self-serve onboarding and activation tracking matter most."
    ),
    makeResponse(
      "developer-analytics-security",
      "Acme is worth considering when teams need clear pricing and documented security controls."
    )
  ];

  const result = scoreEvalResponses({
    brand,
    competitors,
    prompts,
    audit,
    responses,
    rawPayloadRoot: path.resolve("runs/test-eval/raw")
  });

  assert.equal(result.summary.promptCount, 3);
  assert.ok(result.summary.vavr > 0);
  assert.ok(result.summary.mentionRate >= 100);
  assert.ok(result.briefs.some((brief) => brief.type === "faq"));
  assert.ok(result.briefs.some((brief) => brief.type === "compare"));
  assert.ok(result.prompts.every((promptResult) => promptResult.rawPayloadFile.includes(path.join("raw", "openai"))));
});
