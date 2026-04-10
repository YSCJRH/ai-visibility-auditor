import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { loadBrandConfig, loadCompetitorsConfig, loadPromptsConfig } from "./config.ts";
import { runAudit } from "./audit.ts";

const brandPath = path.resolve("examples/acme/brand.yaml");
const competitorsPath = path.resolve("examples/acme/competitors.yaml");
const promptsPath = path.resolve("examples/acme/prompts.yaml");

async function loadFixtureConfigs() {
  const [brand, competitors, prompts] = await Promise.all([
    loadBrandConfig(brandPath),
    loadCompetitorsConfig(competitorsPath),
    loadPromptsConfig(promptsPath)
  ]);

  return { brand, competitors, prompts };
}

test("healthy fixture keeps required pages and strong score", async () => {
  const configs = await loadFixtureConfigs();
  const result = await runAudit({
    siteInput: "./examples/fixtures/static-good",
    ...configs
  });

  assert.equal(result.summary.missingPageTypes.length, 0);
  assert.ok(result.summary.overallScore >= 70);
  assert.equal(result.site.kind, "local");
});

test("blocked fixture reports crawl blockers", async () => {
  const configs = await loadFixtureConfigs();
  const result = await runAudit({
    siteInput: "./examples/fixtures/blocked-site",
    ...configs
  });

  assert.ok(result.issues.some((issue) => issue.title === "Robots blocks all crawlers"));
  assert.ok(result.scores.access.score < 100);
});

test("missing evidence fixture reports page gaps", async () => {
  const configs = await loadFixtureConfigs();
  const result = await runAudit({
    siteInput: "./examples/fixtures/missing-evidence",
    ...configs
  });

  assert.ok(result.summary.missingPageTypes.includes("pricing"));
  assert.ok(result.summary.missingPageTypes.includes("security"));
  assert.ok(result.recommendations.some((recommendation) => recommendation.id === "add-citable-evidence"));
});
