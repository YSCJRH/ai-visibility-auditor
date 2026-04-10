import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { loadBrandConfig, loadCompetitorsConfig, loadPromptsConfig, runAudit } from "../../core/src/index.ts";
import { renderScorecardHtml, renderScorecardMarkdown } from "./index.ts";

test("report renderers expose expected sections", async () => {
  const [brand, competitors, prompts] = await Promise.all([
    loadBrandConfig(path.resolve("examples/acme/brand.yaml")),
    loadCompetitorsConfig(path.resolve("examples/acme/competitors.yaml")),
    loadPromptsConfig(path.resolve("examples/acme/prompts.yaml"))
  ]);

  const result = await runAudit({
    siteInput: "./examples/fixtures/static-good",
    brand,
    competitors,
    prompts
  });

  const markdown = renderScorecardMarkdown(result);
  const html = renderScorecardHtml(result);

  assert.match(markdown, /# AnswerLens Scorecard/);
  assert.match(markdown, /## Scores/);
  assert.match(html, /AnswerLens scorecard/);
  assert.match(html, /Missing coverage/);
});
