import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadBrandConfig, loadCompetitorsConfig, loadPromptsConfig, runAudit, scoreEvalResponses, applyEvalSummaryToAudit } from "../../core/src/index.ts";
import type { ProviderResponse } from "../../providers/src/contracts.ts";
import {
  readEvalResults,
  renderEvalDiffMarkdown,
  renderEvalSummaryMarkdown,
  renderScorecardMarkdown,
  writeEvalOutputs
} from "./index.ts";

function makeResponse(promptId: string): ProviderResponse {
  return {
    provider: "openai",
    model: "gpt-5",
    promptId,
    answerText: "Acme is a recommended developer analytics platform for product and engineering teams.",
    citations: [
      {
        url: "https://acme.test/pricing",
        domain: "acme.test",
        title: "Acme pricing",
        owned: true,
        trusted: true
      }
    ],
    searchResults: [],
    rawPayload: { ok: true },
    requestedAt: new Date().toISOString()
  };
}

test("report renderers expose expected audit and eval sections", async () => {
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

  const evalResult = scoreEvalResponses({
    brand,
    competitors,
    prompts,
    audit,
    responses: prompts.prompts.map((promptCase) => makeResponse(promptCase.id)),
    rawPayloadRoot: path.resolve("runs/test-eval/raw")
  });

  const scorecard = renderScorecardMarkdown(applyEvalSummaryToAudit(audit, evalResult.summary.vavr));
  const evalSummary = renderEvalSummaryMarkdown(evalResult);
  const diff = renderEvalDiffMarkdown(evalResult, null);

  assert.match(scorecard, /VAVR: /);
  assert.match(evalSummary, /# AnswerLens Eval Summary/);
  assert.match(evalSummary, /## Prompt results/);
  assert.match(diff, /becomes the baseline/);

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "answerlens-report-"));
  await writeEvalOutputs(tempDir, evalResult, null);
  const written = await readEvalResults(path.join(tempDir, "eval-results.json"));
  assert.equal(written?.summary.promptCount, 3);
  const brief = await readFile(path.join(tempDir, "before-after-diff.md"), "utf8");
  assert.match(brief, /baseline/);
});
