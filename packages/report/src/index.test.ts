import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  loadBrandConfig,
  loadCompetitorsConfig,
  loadPromptsConfig,
  runAudit,
  buildBingWebmasterValidation,
  buildIndexNowHelper,
  buildSearchConsoleValidation,
  scoreEvalResponses,
  applyEvalSummaryToAudit
} from "../../core/src/index.ts";
import type { ProviderResponse } from "../../providers/src/contracts.ts";
import {
  readEvalResults,
  renderEvalDiffMarkdown,
  renderEvalSummaryMarkdown,
  renderBingSummaryMarkdown,
  renderIndexNowSummaryMarkdown,
  renderSearchConsoleSummaryMarkdown,
  renderScorecardMarkdown,
  renderScorecardHtml,
  writeAuditOutputs,
  writeBingIndexNowOutputs,
  writeEvalOutputs,
  writeValidationOutputs
} from "./index.ts";

function makeResponse(promptId: string, holdout = false, sampleIndex = 0, rankPosition: number | null = null): ProviderResponse {
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
    rawPayload: { ok: true, promptId, sampleIndex },
    requestedAt: new Date().toISOString(),
    locale: "en-US",
    sampleIndex,
    runCount: 1,
    holdout,
    rankPosition
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

  const responses = prompts.prompts.map((promptCase) => makeResponse(promptCase.id, promptCase.holdout ?? false));
  const evalResult = scoreEvalResponses({
    brand,
    competitors,
    prompts,
    audit,
    responses,
    rawPayloadRoot: path.resolve("runs/test-eval/raw")
  });

  const scorecard = renderScorecardMarkdown(applyEvalSummaryToAudit(audit, evalResult.summary));
  const scorecardHtml = renderScorecardHtml(applyEvalSummaryToAudit(audit, evalResult.summary));
  const fallbackScorecard = renderScorecardMarkdown({
    ...audit,
    site: {
      ...audit.site,
      display: undefined
    }
  });
  const evalSummary = renderEvalSummaryMarkdown(evalResult);
  const diff = renderEvalDiffMarkdown(evalResult, null);
  const expectedBenchmarkCount = prompts.prompts.filter((promptCase) => !promptCase.holdout).length;
  const expectedHoldoutCount = prompts.prompts.filter((promptCase) => promptCase.holdout).length;

  assert.equal(audit.site.display, "AnswerLens static-good fixture demo");
  assert.match(scorecard, /Site: AnswerLens static-good fixture demo/);
  assert.match(scorecard, /Demo host note: https:\/\/fixture\.local is the stable fixture hostname inside this public demo/);
  assert.match(scorecard, /VAVR: /);
  assert.match(scorecardHtml, /AnswerLens static-good fixture demo/);
  assert.match(scorecardHtml, /Overall score: <strong>/);
  assert.match(scorecardHtml, / \| VAVR: <strong>/);
  assert.equal(scorecardHtml.includes(String.fromCharCode(0x74ba)), false);
  assert.match(fallbackScorecard, /Site: \.\/examples\/fixtures\/static-good/);
  assert.match(evalSummary, /# AnswerLens Eval Summary/);
  assert.match(evalSummary, /Accurate mention rate/);
  assert.doesNotMatch(evalSummary, /Manual rank validation/);
  assert.doesNotMatch(evalSummary, /## Stability summary/);
  assert.match(diff, /becomes the baseline/);
  assert.equal(evalResult.summary.promptCount, expectedBenchmarkCount);
  assert.ok(prompts.prompts.length >= 34);
  assert.ok(expectedHoldoutCount >= 10);

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "answerlens-report-"));
  await writeAuditOutputs(tempDir, audit);
  await writeEvalOutputs(tempDir, evalResult, null);

  const written = await readEvalResults(path.join(tempDir, "eval-results.json"));
  const evalSummaryJson = JSON.parse(await readFile(path.join(tempDir, "eval-summary.json"), "utf8")) as {
    summary: { promptCount: number; locale: string | null; repeatedPromptCount: number; stablePromptRate: number; unstablePromptCount: number };
    promptGroups: Array<{ promptId: string; sampleCount: number; stable: boolean }>;
    briefs: unknown[];
  };
  const runManifest = JSON.parse(await readFile(path.join(tempDir, "run.json"), "utf8")) as {
    kind: string;
    provider?: { name: string };
    artifacts: string[];
  };
  const shareSummary = JSON.parse(await readFile(path.join(tempDir, "share-summary.json"), "utf8")) as {
    project: string;
    site: { display?: string };
    run: { mode: string };
    metrics: { overallScore: number; vavr: number | null };
    topIssues: unknown[];
    topRecommendations: unknown[];
    artifacts: string[];
  };
  const shareSummaryMarkdown = await readFile(path.join(tempDir, "share-summary.md"), "utf8");
  const prSnippet = await readFile(path.join(tempDir, "pr-snippet.md"), "utf8");
  const recommendations = await readFile(path.join(tempDir, "recommendations.md"), "utf8");
  const htmlReport = await readFile(path.join(tempDir, "index.html"), "utf8");
  const siteAudit = JSON.parse(await readFile(path.join(tempDir, "site-audit.json"), "utf8")) as {
    pages: Array<{
      internalLinkRecords?: unknown[];
      jsonLdRecords?: unknown[];
      schemaTextSignals?: unknown[];
      evidenceSignals?: unknown[];
    }>;
  };
  const readme = await readFile(path.resolve("README.md"), "utf8");
  const roadmap = await readFile(path.resolve("docs/roadmap.md"), "utf8");
  const githubBootstrap = await readFile(path.resolve("docs/github-bootstrap.md"), "utf8");
  const distributionPlan = await readFile(path.resolve("docs/distribution-plan.md"), "utf8");
  const manualSteps = await readFile(path.resolve("docs/manual-steps.md"), "utf8");
  const shareSummaryDocs = await readFile(path.resolve("docs/shareable-summary.md"), "utf8");
  const searchConsoleDocs = await readFile(path.resolve("docs/search-console.md"), "utf8");
  const bingIndexNowDocs = await readFile(path.resolve("docs/bing-indexnow.md"), "utf8");
  const badgesDocs = await readFile(path.resolve("docs/badges.md"), "utf8");
  const githubActionDocs = await readFile(path.resolve("docs/github-action.md"), "utf8");
  const actionDefinition = await readFile(path.resolve("action.yml"), "utf8");
  const citationFile = await readFile(path.resolve("CITATION.cff"), "utf8");
  const prTemplate = await readFile(path.resolve(".github/pull_request_template.md"), "utf8");
  const teardownTemplate = await readFile(path.resolve(".github/ISSUE_TEMPLATE/audit-teardown.yml"), "utf8");
  const packageJson = JSON.parse(await readFile(path.resolve("package.json"), "utf8")) as { scripts: Record<string, string> };
  const gitignore = await readFile(path.resolve(".gitignore"), "utf8");
  const coverSvg = await readFile(path.resolve("assets/readme-cover.svg"), "utf8");
  const scorecardPreviewSvg = await readFile(path.resolve("assets/readme-scorecard-preview.svg"), "utf8");
  const artifactPreviewSvg = await readFile(path.resolve("assets/readme-artifacts-preview.svg"), "utf8");
  const showcaseSvg = await readFile(path.resolve("assets/readme-before-after-showcase.svg"), "utf8");
  const normalizedPages = JSON.parse(await readFile(path.join(tempDir, "normalized-pages.json"), "utf8")) as Array<{
    internalLinkRecords?: unknown[];
  }>;
  const competitorDiff = await readFile(path.join(tempDir, "competitor-diff.md"), "utf8");
  const citationGapMatrix = JSON.parse(await readFile(path.join(tempDir, "citation-gap-matrix.json"), "utf8")) as {
    rows: unknown[];
    summary: { citationGapCount: number };
  };
  const citationGapMarkdown = await readFile(path.join(tempDir, "citation-gap-matrix.md"), "utf8");
  const firstBriefId = evalResult.briefs[0]?.id;
  const contentBrief = firstBriefId ? await readFile(path.join(tempDir, "content-briefs", `${firstBriefId}.md`), "utf8") : null;
  const legacyBrief = firstBriefId ? await readFile(path.join(tempDir, "briefs", `${firstBriefId}.md`), "utf8") : null;

  assert.equal(written?.summary.promptCount, expectedBenchmarkCount);
  assert.equal(evalSummaryJson.summary.promptCount, expectedBenchmarkCount);
  assert.equal(evalSummaryJson.summary.locale, "en-US");
  assert.equal(evalSummaryJson.summary.repeatedPromptCount, 0);
  assert.equal(evalSummaryJson.summary.stablePromptRate, 0);
  assert.equal(evalSummaryJson.summary.unstablePromptCount, 0);
  assert.equal(evalSummaryJson.promptGroups.length, prompts.prompts.length);
  assert.ok(evalSummaryJson.promptGroups.every((group) => group.sampleCount === 1));
  assert.equal(runManifest.kind, "eval");
  assert.equal(runManifest.provider?.name, "openai");
  assert.ok(runManifest.artifacts.includes("eval-summary.json"));
  assert.ok(runManifest.artifacts.includes("citation-gap-matrix.json"));
  assert.ok(runManifest.artifacts.includes("normalized-pages.json"));
  assert.ok(runManifest.artifacts.includes("share-summary.md"));
  assert.ok(runManifest.artifacts.includes("share-summary.json"));
  assert.ok(runManifest.artifacts.includes("pr-snippet.md"));
  assert.equal(shareSummary.project, "AnswerLens");
  assert.equal(shareSummary.site.display, "AnswerLens static-good fixture demo");
  assert.equal(shareSummary.run.mode, "eval");
  assert.equal(shareSummary.metrics.overallScore, audit.summary.overallScore);
  assert.equal(shareSummary.metrics.vavr, evalResult.summary.vavr);
  assert.equal("competitivePositionScore" in shareSummary.metrics, false);
  assert.equal("stablePromptRate" in shareSummary.metrics, false);
  assert.ok(shareSummary.topIssues.length > 0);
  assert.ok(shareSummary.topRecommendations.length > 0);
  assert.ok(shareSummary.artifacts.includes("pr-snippet.md"));
  assert.match(shareSummaryMarkdown, /# AnswerLens Share Summary/);
  assert.match(shareSummaryMarkdown, /Site: AnswerLens static-good fixture demo/);
  assert.doesNotMatch(shareSummaryMarkdown, /Source target:/);
  assert.match(shareSummaryMarkdown, /AI may miss this product because/);
  assert.match(shareSummaryMarkdown, /does not scrape consumer AI UIs/);
  assert.doesNotMatch(shareSummaryMarkdown, /Manual validation: CPS/);
  assert.doesNotMatch(shareSummaryMarkdown, /Stability:/);
  assert.match(prSnippet, /## AnswerLens audit/);
  assert.match(prSnippet, /CI for AI discoverability/);
  assert.match(prSnippet, /<details>/);
  assert.match(recommendations, /# AnswerLens Recommendations/);
  assert.match(recommendations, /Site: AnswerLens static-good fixture demo/);
  assert.match(htmlReport, / \| VAVR: <strong>/);
  assert.match(htmlReport, /AnswerLens static-good fixture demo/);
  assert.doesNotMatch(htmlReport, /Source target:/);
  assert.equal(htmlReport.includes(String.fromCharCode(0x74ba)), false);
  assert.ok(siteAudit.pages.some((page) => (page.internalLinkRecords ?? []).length > 0));
  assert.ok(siteAudit.pages.some((page) => (page.jsonLdRecords ?? []).length > 0));
  assert.ok(siteAudit.pages.some((page) => (page.schemaTextSignals ?? []).length > 0));
  assert.ok(siteAudit.pages.some((page) => (page.evidenceSignals ?? []).length > 0));
  assert.doesNotMatch(readme, /\/D:\/SEO/);
  assert.match(readme, /AnswerLens is a CLI-first, GitHub-native AI visibility auditor for product websites\./);
  assert.match(readme, /CI for AI discoverability\./);
  assert.match(readme, /share-summary\.md/);
  assert.match(readme, /pr-snippet\.md/);
  assert.match(readme, /search-console-import/);
  assert.match(readme, /search-console-summary\.json/);
  assert.match(readme, /bing-indexnow-helper/);
  assert.match(readme, /indexnow-summary\.json/);
  assert.match(readme, /AnswerLens focuses on explainable structure, evidence, and validation workflows rather than consumer UI scraping\./);
  assert.match(readme, /## Why AnswerLens/);
  assert.match(readme, /Full public roadmap: \[docs\/roadmap\.md\]/);
  assert.match(readme, /!\[AnswerLens cover\]\(assets\/readme-cover\.svg\)/);
  assert.match(readme, /!\[AnswerLens scorecard preview\]\(assets\/readme-scorecard-preview\.svg\)/);
  assert.match(readme, /!\[AnswerLens artifact preview\]\(assets\/readme-artifacts-preview\.svg\)/);
  assert.match(readme, /!\[AnswerLens before and after showcase\]\(assets\/readme-before-after-showcase\.svg\)/);
  assert.match(readme, /## Sample outputs/);
  assert.match(readme, /## Before \/ after showcase/);
  assert.match(roadmap, /# Public Roadmap/);
  assert.match(roadmap, /This document is the canonical public roadmap\./);
  assert.match(roadmap, /Distribution spine/);
  assert.match(roadmap, /#9/);
  assert.match(roadmap, /#10/);
  assert.match(roadmap, /#11/);
  assert.match(roadmap, /#12/);
  assert.match(roadmap, /#13/);
  assert.match(roadmap, /#14/);
  assert.match(roadmap, /implemented on `main` as an optional Bing validation and IndexNow helper layer/);
  assert.match(githubBootstrap, /canonical public roadmap/);
  assert.doesNotMatch(githubBootstrap, /\/D:\/SEO/);
  assert.match(distributionPlan, /# Distribution Plan/);
  assert.match(distributionPlan, /qualified distribution starts \/ 28d/);
  assert.match(distributionPlan, /Actions runtime changes can quietly erode reliability/);
  assert.match(distributionPlan, /npm trusted publishing/);
  assert.match(manualSteps, /@answerlens/);
  assert.match(manualSteps, /GitHub Pages/);
  assert.match(manualSteps, /Node 24-based JavaScript actions/);
  assert.match(manualSteps, /ANSWERLENS_ENABLE_NPM_TRUSTED_PUBLISH/);
  assert.match(shareSummaryDocs, /# Shareable Summary Contract/);
  assert.match(searchConsoleDocs, /# Search Console Validation Import/);
  assert.match(searchConsoleDocs, /Required columns/);
  assert.match(bingIndexNowDocs, /# Bing \/ IndexNow Helper/);
  assert.match(bingIndexNowDocs, /IndexNow helper outputs/);
  assert.match(badgesDocs, /AI discoverability audited with AnswerLens/);
  assert.match(githubActionDocs, /GITHUB_STEP_SUMMARY/);
  assert.match(githubActionDocs, /uses: YSCJRH\/ai-visibility-auditor@vX/);
  assert.match(githubActionDocs, /bing-indexnow-helper/);
  assert.match(githubActionDocs, /Node 24 transition/);
  assert.match(githubActionDocs, /Corepack/);
  assert.match(githubActionDocs, /scorecard-path/);
  assert.match(githubActionDocs, /recommendations-path/);
  assert.match(githubActionDocs, /Artifact review order/);
  assert.match(actionDefinition, /name: "AnswerLens"/);
  assert.match(actionDefinition, /share-summary-path/);
  assert.match(actionDefinition, /scorecard-path/);
  assert.match(actionDefinition, /recommendations-path/);
  assert.match(actionDefinition, /bing-input/);
  assert.match(actionDefinition, /actions\/setup-node@v5/);
  assert.match(actionDefinition, /corepack prepare/);
  assert.doesNotMatch(actionDefinition, /pnpm\/action-setup/);
  assert.match(actionDefinition, /FORCE_JAVASCRIPT_ACTIONS_TO_NODE24/);
  assert.match(citationFile, /title: "AnswerLens"/);
  assert.match(citationFile, /repository-code:/);
  assert.match(prTemplate, /AnswerLens share summary/);
  assert.match(teardownTemplate, /Audit teardown/);
  assert.equal(packageJson.scripts["manual-import"], "node --experimental-strip-types apps/cli/src/index.ts manual-import");
  assert.equal(packageJson.scripts["search-console-import"], "node --experimental-strip-types apps/cli/src/index.ts search-console-import");
  assert.equal(packageJson.scripts["bing-indexnow-helper"], "node --experimental-strip-types apps/cli/src/index.ts bing-indexnow-helper");
  assert.equal(
    packageJson.scripts["self-dogfood:pages"],
    "node --experimental-strip-types apps/cli/src/index.ts audit https://yscjrh.github.io/ai-visibility-auditor/ --brand ./.github/answerlens/brand.yaml --competitors ./.github/answerlens/competitors.yaml --prompts ./.github/answerlens/prompts.yaml --out ./runs/self-dogfood-pages"
  );
  assert.equal(packageJson.scripts["build:cli"], "corepack pnpm --dir apps/cli build");
  assert.equal(packageJson.scripts["pack:cli:dry-run"], "corepack pnpm --dir apps/cli pack --dry-run");
  assert.equal(packageJson.scripts["build:site"], "node --experimental-strip-types scripts/distribution/build-site.ts");
  assert.match(gitignore, /^seofull\.md$/m);
  assert.match(coverSvg, /<svg[^>]+1600[^>]+840/);
  assert.match(coverSvg, /AnswerLens/);
  assert.match(scorecardPreviewSvg, /Scorecard preview/);
  assert.match(artifactPreviewSvg, /Artifact preview/);
  assert.match(showcaseSvg, /Before and after showcase/);
  assert.ok(normalizedPages.length > 0);
  assert.ok(normalizedPages.some((page) => (page.internalLinkRecords ?? []).length > 0));
  assert.match(competitorDiff, /# AnswerLens Competitor Structure Diff/);
  assert.equal(citationGapMatrix.rows.length, prompts.prompts.length);
  assert.match(citationGapMarkdown, /# AnswerLens Citation Gap Matrix/);
  if (contentBrief && legacyBrief) {
    assert.match(contentBrief, /^# /);
    assert.match(legacyBrief, /^# /);
  } else {
    assert.match(evalSummary, /- none/);
  }
});

test("report outputs expose stability summaries for repeated eval samples", async () => {
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

  const responses = prompts.prompts.flatMap((promptCase) => [
    makeResponse(promptCase.id, promptCase.holdout ?? false, 0),
    makeResponse(promptCase.id, promptCase.holdout ?? false, 1)
  ]);
  const evalResult = scoreEvalResponses({
    brand,
    competitors,
    prompts,
    audit,
    responses,
    rawPayloadRoot: path.resolve("runs/test-eval/raw")
  });

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "answerlens-report-stability-"));
  await writeAuditOutputs(tempDir, audit);
  await writeEvalOutputs(tempDir, evalResult, null);

  const evalSummary = await readFile(path.join(tempDir, "eval-summary.md"), "utf8");
  const evalSummaryJson = JSON.parse(await readFile(path.join(tempDir, "eval-summary.json"), "utf8")) as {
    summary: { repeatedPromptCount: number; stablePromptRate: number; unstablePromptCount: number };
    promptGroups: Array<{ sampleCount: number; stable: boolean; consensusRate: number; spreadNote: string | null }>;
  };
  const shareSummary = JSON.parse(await readFile(path.join(tempDir, "share-summary.json"), "utf8")) as {
    metrics: { repeatedPromptCount?: number; stablePromptRate?: number; unstablePromptCount?: number };
  };
  const shareSummaryMarkdown = await readFile(path.join(tempDir, "share-summary.md"), "utf8");

  const expectedRepeatedPromptCount = prompts.prompts.filter((promptCase) => !promptCase.holdout).length;

  assert.match(evalSummary, /## Stability summary/);
  assert.match(evalSummary, /Stable repeated prompts: 100%/);
  assert.equal(evalSummaryJson.summary.repeatedPromptCount, expectedRepeatedPromptCount);
  assert.equal(evalSummaryJson.summary.stablePromptRate, 100);
  assert.equal(evalSummaryJson.summary.unstablePromptCount, 0);
  assert.ok(evalSummaryJson.promptGroups.every((group) => group.sampleCount === 2));
  assert.ok(evalSummaryJson.promptGroups.every((group) => group.stable === true));
  assert.ok(evalSummaryJson.promptGroups.every((group) => group.consensusRate === 100));
  assert.ok(evalSummaryJson.promptGroups.every((group) => group.spreadNote === null));
  assert.equal(shareSummary.metrics.repeatedPromptCount, expectedRepeatedPromptCount);
  assert.equal(shareSummary.metrics.stablePromptRate, 100);
  assert.equal(shareSummary.metrics.unstablePromptCount, 0);
  assert.match(shareSummaryMarkdown, /Stability: 100% of repeated prompt groups were stable/);
});

test("manual-import report outputs expose CPS only when ranked samples are present", async () => {
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

  const responses = [
    {
      ...makeResponse("best-developer-analytics", false, 0, 1),
      provider: "manual" as const,
      model: "manual-import"
    },
    {
      ...makeResponse("developer-analytics-vs-mixpanel", false, 0, 2),
      provider: "manual" as const,
      model: "manual-import"
    }
  ];

  const evalResult = scoreEvalResponses({
    brand,
    competitors,
    prompts,
    audit,
    responses,
    rawPayloadRoot: path.resolve("runs/test-eval/raw"),
    mode: "manual-import"
  });

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "answerlens-manual-report-"));
  await writeAuditOutputs(tempDir, applyEvalSummaryToAudit(audit, evalResult.summary, "manual-import"));
  await writeEvalOutputs(tempDir, evalResult, null);

  const evalSummary = await readFile(path.join(tempDir, "eval-summary.md"), "utf8");
  const evalSummaryJson = JSON.parse(await readFile(path.join(tempDir, "eval-summary.json"), "utf8")) as {
    summary: { competitivePositionScore: number | null; rankCoverageRate: number };
    prompts: Array<{ scores: { competitivePositionScore: number | null; rankCoverageRate: number } }>;
  };
  const shareSummary = JSON.parse(await readFile(path.join(tempDir, "share-summary.json"), "utf8")) as {
    run: { mode: string };
    metrics: { competitivePositionScore?: number; rankCoverageRate?: number };
  };
  const shareSummaryMarkdown = await readFile(path.join(tempDir, "share-summary.md"), "utf8");
  const prSnippet = await readFile(path.join(tempDir, "pr-snippet.md"), "utf8");
  const runManifest = JSON.parse(await readFile(path.join(tempDir, "run.json"), "utf8")) as {
    summary: { competitivePositionScore: number | null; rankCoverageRate: number };
  };

  assert.match(evalSummary, /Manual rank validation/);
  assert.match(evalSummary, /Competitive position score: 0.88/);
  assert.match(evalSummary, /Rank coverage: 100%/);
  assert.equal(evalSummaryJson.summary.competitivePositionScore, 0.88);
  assert.equal(evalSummaryJson.summary.rankCoverageRate, 100);
  assert.equal(evalSummaryJson.prompts[0]?.scores.competitivePositionScore, 1);
  assert.equal(evalSummaryJson.prompts[1]?.scores.competitivePositionScore, 0.75);
  assert.equal(shareSummary.run.mode, "manual-import");
  assert.equal(shareSummary.metrics.competitivePositionScore, 0.88);
  assert.equal(shareSummary.metrics.rankCoverageRate, 100);
  assert.match(shareSummaryMarkdown, /Manual validation: CPS 0.88 across 100% ranked samples\./);
  assert.match(prSnippet, /Manual validation: CPS 0.88 across 100% ranked samples\./);
  assert.equal(runManifest.summary.competitivePositionScore, 0.88);
  assert.equal(runManifest.summary.rankCoverageRate, 100);
});

test("validation outputs expose Search Console summaries without changing eval artifacts", async () => {
  const [brand, competitors, prompts, csvText] = await Promise.all([
    loadBrandConfig(path.resolve("examples/acme/brand.yaml")),
    loadCompetitorsConfig(path.resolve("examples/acme/competitors.yaml")),
    loadPromptsConfig(path.resolve("examples/acme/prompts.yaml")),
    readFile(path.resolve("examples/fixtures/search-console/static-good-pages.csv"), "utf8")
  ]);

  const audit = await runAudit({
    siteInput: "./examples/fixtures/static-good",
    brand,
    competitors,
    prompts
  });

  const validation = buildSearchConsoleValidation(
    audit,
    csvText,
    path.resolve("examples/fixtures/search-console/static-good-pages.csv")
  );

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "answerlens-search-console-report-"));
  await writeAuditOutputs(tempDir, validation.audit);
  await writeValidationOutputs(tempDir, validation.audit, validation.validation);

  const summaryMarkdown = await readFile(path.join(tempDir, "search-console-summary.md"), "utf8");
  const summaryJson = JSON.parse(await readFile(path.join(tempDir, "search-console-summary.json"), "utf8")) as {
    source: { type: string; format: string };
    summary: { importedPageCount: number; keyPagesWithEvidence: number; keyPagesWithoutEvidence: number };
    findings: Array<{ title: string }>;
    topPages: Array<{ page: string }>;
  };
  const pagesJson = JSON.parse(await readFile(path.join(tempDir, "search-console-pages.json"), "utf8")) as Array<{
    page: string;
    outOfScope: boolean;
  }>;
  const shareSummary = await readFile(path.join(tempDir, "share-summary.md"), "utf8");
  const runManifest = JSON.parse(await readFile(path.join(tempDir, "run.json"), "utf8")) as {
    kind: string;
    summary: { validationSource: string; importedPageCount: number };
  };
  const siteAudit = JSON.parse(await readFile(path.join(tempDir, "site-audit.json"), "utf8")) as {
    run: { mode: string; validationSource?: string };
  };

  assert.match(renderSearchConsoleSummaryMarkdown(validation.validation), /# AnswerLens Search Console Summary/);
  assert.match(summaryMarkdown, /## Key page evidence coverage/);
  assert.match(summaryMarkdown, /## Validation findings/);
  assert.equal(summaryJson.source.type, "search-console");
  assert.equal(summaryJson.source.format, "csv");
  assert.equal(summaryJson.summary.importedPageCount, 5);
  assert.ok(summaryJson.summary.keyPagesWithoutEvidence > 0);
  assert.ok(summaryJson.findings.some((finding) => finding.title === "Search Console page is not covered by crawl"));
  assert.ok(summaryJson.topPages.some((page) => page.page.includes("pricing")));
  assert.ok(pagesJson.some((page) => page.outOfScope));
  assert.match(shareSummary, /Search Console validation: \d+\/\d+ key pages show Search Console evidence\./);
  assert.equal(runManifest.kind, "validation-import");
  assert.equal(runManifest.summary.validationSource, "search-console");
  assert.equal(runManifest.summary.importedPageCount, 5);
  assert.equal(siteAudit.run.mode, "validation-import");
  assert.equal(siteAudit.run.validationSource, "search-console");
});

test("bing helper outputs expose Bing validation and IndexNow artifacts", async () => {
  const [brand, competitors, prompts, csvText] = await Promise.all([
    loadBrandConfig(path.resolve("examples/acme/brand.yaml")),
    loadCompetitorsConfig(path.resolve("examples/acme/competitors.yaml")),
    loadPromptsConfig(path.resolve("examples/acme/prompts.yaml")),
    readFile(path.resolve("examples/fixtures/bing/static-good-pages.csv"), "utf8")
  ]);

  const audit = await runAudit({
    siteInput: "./examples/fixtures/static-good",
    brand,
    competitors,
    prompts
  });

  const validation = buildBingWebmasterValidation(
    audit,
    csvText,
    path.resolve("examples/fixtures/bing/static-good-pages.csv")
  );
  const indexNow = buildIndexNowHelper(validation.audit);

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "answerlens-bing-helper-report-"));
  await writeAuditOutputs(tempDir, validation.audit);
  await writeBingIndexNowOutputs(tempDir, validation.audit, validation.validation, indexNow);

  const bingSummary = await readFile(path.join(tempDir, "bing-summary.md"), "utf8");
  const bingSummaryJson = JSON.parse(await readFile(path.join(tempDir, "bing-summary.json"), "utf8")) as {
    source: { type: string };
    summary: { importedPageCount: number };
  };
  const bingPages = JSON.parse(await readFile(path.join(tempDir, "bing-pages.json"), "utf8")) as Array<{ page: string }>;
  const indexNowSummary = await readFile(path.join(tempDir, "indexnow-summary.md"), "utf8");
  const indexNowSummaryJson = JSON.parse(await readFile(path.join(tempDir, "indexnow-summary.json"), "utf8")) as {
    summary: { candidateCount: number; endpoint: string };
  };
  const indexNowCandidates = JSON.parse(await readFile(path.join(tempDir, "indexnow-candidates.json"), "utf8")) as Array<{
    url: string;
    pageType: string;
  }>;
  const shareSummary = await readFile(path.join(tempDir, "share-summary.md"), "utf8");
  const runManifest = JSON.parse(await readFile(path.join(tempDir, "run.json"), "utf8")) as {
    summary: { validationSource: string; indexNowCandidateCount: number };
  };

  assert.match(renderBingSummaryMarkdown(validation.validation), /# AnswerLens Bing Webmaster Summary/);
  assert.match(renderIndexNowSummaryMarkdown(indexNow), /# AnswerLens IndexNow Helper Summary/);
  assert.match(bingSummary, /## Validation findings/);
  assert.equal(bingSummaryJson.source.type, "bing-webmaster");
  assert.equal(bingSummaryJson.summary.importedPageCount, 5);
  assert.ok(bingPages.some((page) => page.page.includes("pricing")));
  assert.match(indexNowSummary, /## Candidate URLs/);
  assert.equal(indexNowSummaryJson.summary.endpoint, "https://api.indexnow.org/indexnow");
  assert.ok(indexNowSummaryJson.summary.candidateCount > 0);
  assert.ok(indexNowCandidates.some((candidate) => candidate.pageType === "pricing"));
  assert.match(shareSummary, /Bing Webmaster validation: \d+\/\d+ key pages show Bing Webmaster evidence\./);
  assert.match(shareSummary, /IndexNow helper: prepared \d+ candidate URLs/);
  assert.equal(runManifest.summary.validationSource, "bing-webmaster");
  assert.ok(runManifest.summary.indexNowCandidateCount > 0);
});
