import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { loadBrandConfig, loadCompetitorsConfig, loadPromptsConfig, runAudit } from "./index.ts";
import { rankPositionToCompetitivePositionScore, scoreEvalResponses } from "./eval.ts";
import type { ProviderResponse } from "../../providers/src/contracts.ts";

function makeResponse(promptId: string, answerText: string, sampleIndex = 0, rankPosition: number | null = null): ProviderResponse {
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
    rawPayload: { ok: true, promptId, sampleIndex },
    requestedAt: new Date().toISOString(),
    locale: "en-US",
    sampleIndex,
    runCount: 2,
    holdout: false,
    rankPosition
  };
}

test("rankPositionToCompetitivePositionScore maps ranked answers to bounded CPS values", () => {
  assert.equal(rankPositionToCompetitivePositionScore(1), 1);
  assert.equal(rankPositionToCompetitivePositionScore(2), 0.75);
  assert.equal(rankPositionToCompetitivePositionScore(3), 0.5);
  assert.equal(rankPositionToCompetitivePositionScore(4), 0.25);
  assert.equal(rankPositionToCompetitivePositionScore(5), 0);
  assert.equal(rankPositionToCompetitivePositionScore(null), null);
});

test("scoreEvalResponses computes richer summary metrics and brief recommendations", async () => {
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
      "Acme is a developer analytics platform for product and engineering teams, and it provides public docs, self-serve onboarding, and transparent pricing.",
      0
    ),
    makeResponse(
      "developer-analytics-vs-mixpanel",
      "Acme is a developer analytics platform for product and engineering teams, and it is a better fit than Mixpanel when self-serve onboarding and activation tracking matter most.",
      0
    ),
    makeResponse(
      "developer-analytics-security",
      "Acme is a developer analytics platform for product and engineering teams, and it is worth considering when teams need clear pricing and documented security controls.",
      1
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
  assert.equal(result.summary.sampleCount, 3);
  assert.equal(result.summary.locale, "en-US");
  assert.ok(result.summary.vavr > 0);
  assert.ok(result.summary.mentionRate >= 100);
  assert.ok(result.summary.accurateMentionRate >= 100);
  assert.ok(result.summary.factCoverageScore > 0);
  assert.ok(result.briefs.some((brief) => brief.type === "faq"));
  assert.ok(result.briefs.some((brief) => brief.type === "compare"));
  assert.ok(result.prompts.every((promptResult) => promptResult.rawPayloadFile.includes(path.join("raw", "openai"))));
  assert.ok(result.prompts.some((promptResult) => promptResult.sampleIndex === 1));
  assert.equal(result.summary.competitivePositionScore, null);
  assert.equal(result.summary.rankCoverageRate, 0);
});

test("scoreEvalResponses computes CPS from manual rank inputs and excludes holdouts from top-level summary", async () => {
  const [brand, competitors, prompts] = await Promise.all([
    loadBrandConfig(path.resolve("examples/acme/brand.yaml")),
    loadCompetitorsConfig(path.resolve("examples/acme/competitors.yaml")),
    loadPromptsConfig(path.resolve("examples/acme/prompts.yaml"))
  ]);

  const audit = await runAudit({
    siteInput: "./examples/fixtures/static-good",
    brand,
    competitors,
    prompts
  });

  const answer =
    "Acme is a developer analytics platform for product and engineering teams, and it provides public docs, transparent pricing, and self-serve onboarding.";
  const responses = [
    makeResponse("best-developer-analytics", answer, 0, 1),
    makeResponse("best-developer-analytics", answer, 1, null),
    makeResponse("developer-analytics-vs-mixpanel", `${answer} Acme is a better fit than Mixpanel for developer experience teams.`, 0, 2),
    {
      ...makeResponse("holdout-best-for-fintech", answer, 0, 4),
      holdout: true
    }
  ];

  const result = scoreEvalResponses({
    brand,
    competitors,
    prompts,
    audit,
    responses,
    rawPayloadRoot: path.resolve("runs/test-eval/raw")
  });

  assert.equal(result.summary.promptCount, 2);
  assert.equal(result.summary.holdoutPromptCount, 1);
  assert.equal(result.summary.competitivePositionScore, 0.88);
  assert.equal(result.summary.rankCoverageRate, 67);
  assert.equal(result.prompts[0]?.scores.competitivePositionScore, 1);
  assert.equal(result.prompts[0]?.scores.rankCoverageRate, 1);
  assert.equal(result.prompts[1]?.scores.competitivePositionScore, null);
  assert.equal(result.prompts[1]?.scores.rankCoverageRate, 0);
  assert.equal(result.prompts[3]?.holdout, true);
});
