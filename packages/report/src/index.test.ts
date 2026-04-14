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
  scoreEvalResponses,
  applyEvalSummaryToAudit
} from "../../core/src/index.ts";
import type { ProviderResponse } from "../../providers/src/contracts.ts";
import {
  readEvalResults,
  renderEvalDiffMarkdown,
  renderEvalSummaryMarkdown,
  renderScorecardMarkdown,
  renderScorecardHtml,
  writeAuditOutputs,
  writeEvalOutputs
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
  const evalSummary = renderEvalSummaryMarkdown(evalResult);
  const diff = renderEvalDiffMarkdown(evalResult, null);
  const expectedBenchmarkCount = prompts.prompts.filter((promptCase) => !promptCase.holdout).length;
  const expectedHoldoutCount = prompts.prompts.filter((promptCase) => promptCase.holdout).length;

  assert.match(scorecard, /VAVR: /);
  assert.match(scorecardHtml, /Overall score: <strong>/);
  assert.match(scorecardHtml, / \| VAVR: <strong>/);
  assert.equal(scorecardHtml.includes(String.fromCharCode(0x74ba)), false);
  assert.match(evalSummary, /# AnswerLens Eval Summary/);
  assert.match(evalSummary, /Accurate mention rate/);
  assert.doesNotMatch(evalSummary, /Manual rank validation/);
  assert.match(diff, /becomes the baseline/);
  assert.equal(evalResult.summary.promptCount, expectedBenchmarkCount);
  assert.ok(prompts.prompts.length >= 34);
  assert.ok(expectedHoldoutCount >= 10);

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "answerlens-report-"));
  await writeAuditOutputs(tempDir, audit);
  await writeEvalOutputs(tempDir, evalResult, null);

  const written = await readEvalResults(path.join(tempDir, "eval-results.json"));
  const evalSummaryJson = JSON.parse(await readFile(path.join(tempDir, "eval-summary.json"), "utf8")) as {
    summary: { promptCount: number; locale: string | null };
    briefs: unknown[];
  };
  const runManifest = JSON.parse(await readFile(path.join(tempDir, "run.json"), "utf8")) as {
    kind: string;
    provider?: { name: string };
    artifacts: string[];
  };
  const shareSummary = JSON.parse(await readFile(path.join(tempDir, "share-summary.json"), "utf8")) as {
    project: string;
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
  const shareSummaryDocs = await readFile(path.resolve("docs/shareable-summary.md"), "utf8");
  const badgesDocs = await readFile(path.resolve("docs/badges.md"), "utf8");
  const githubActionDocs = await readFile(path.resolve("docs/github-action.md"), "utf8");
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
  assert.equal(runManifest.kind, "eval");
  assert.equal(runManifest.provider?.name, "openai");
  assert.ok(runManifest.artifacts.includes("eval-summary.json"));
  assert.ok(runManifest.artifacts.includes("citation-gap-matrix.json"));
  assert.ok(runManifest.artifacts.includes("normalized-pages.json"));
  assert.ok(runManifest.artifacts.includes("share-summary.md"));
  assert.ok(runManifest.artifacts.includes("share-summary.json"));
  assert.ok(runManifest.artifacts.includes("pr-snippet.md"));
  assert.equal(shareSummary.project, "AnswerLens");
  assert.equal(shareSummary.run.mode, "eval");
  assert.equal(shareSummary.metrics.overallScore, audit.summary.overallScore);
  assert.equal(shareSummary.metrics.vavr, evalResult.summary.vavr);
  assert.equal("competitivePositionScore" in shareSummary.metrics, false);
  assert.ok(shareSummary.topIssues.length > 0);
  assert.ok(shareSummary.topRecommendations.length > 0);
  assert.ok(shareSummary.artifacts.includes("pr-snippet.md"));
  assert.match(shareSummaryMarkdown, /# AnswerLens Share Summary/);
  assert.match(shareSummaryMarkdown, /AI may miss this product because/);
  assert.match(shareSummaryMarkdown, /does not scrape consumer AI UIs/);
  assert.doesNotMatch(shareSummaryMarkdown, /Manual validation: CPS/);
  assert.match(prSnippet, /## AnswerLens audit/);
  assert.match(prSnippet, /CI for AI discoverability/);
  assert.match(prSnippet, /<details>/);
  assert.match(recommendations, /# AnswerLens Recommendations/);
  assert.match(htmlReport, / \| VAVR: <strong>/);
  assert.equal(htmlReport.includes(String.fromCharCode(0x74ba)), false);
  assert.ok(siteAudit.pages.some((page) => (page.internalLinkRecords ?? []).length > 0));
  assert.ok(siteAudit.pages.some((page) => (page.jsonLdRecords ?? []).length > 0));
  assert.ok(siteAudit.pages.some((page) => (page.schemaTextSignals ?? []).length > 0));
  assert.ok(siteAudit.pages.some((page) => (page.evidenceSignals ?? []).length > 0));
  assert.doesNotMatch(readme, /\/D:\/SEO/);
  assert.match(readme, /AnswerLens is a CLI-first AI visibility auditor for product websites\./);
  assert.match(readme, /CI for AI discoverability\./);
  assert.match(readme, /share-summary\.md/);
  assert.match(readme, /pr-snippet\.md/);
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
  assert.match(githubBootstrap, /canonical public roadmap/);
  assert.doesNotMatch(githubBootstrap, /\/D:\/SEO/);
  assert.match(shareSummaryDocs, /# Shareable Summary Contract/);
  assert.match(badgesDocs, /AI discoverability audited with AnswerLens/);
  assert.match(githubActionDocs, /GITHUB_STEP_SUMMARY/);
  assert.match(prTemplate, /AnswerLens share summary/);
  assert.match(teardownTemplate, /Audit teardown/);
  assert.equal(packageJson.scripts["manual-import"], "node --experimental-strip-types apps/cli/src/index.ts manual-import");
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
