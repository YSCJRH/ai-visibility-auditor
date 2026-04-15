import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { ProviderResponse } from "../../../packages/providers/src/index.ts";

function fakeResponse(promptId: string, sampleIndex = 0, rankPosition: number | null = null): ProviderResponse {
  return {
    provider: "openai",
    model: "gpt-5-mini",
    promptId,
    answerText: "Acme is a recommended developer analytics platform with public docs and transparent pricing.",
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

test("runCli eval writes audit, eval, and raw payload outputs", async () => {
  process.env.ANSWERLENS_IMPORT_ONLY = "1";
  const { runCli } = await import("./index.ts");
  const outDir = await mkdtemp(path.join(os.tmpdir(), "answerlens-cli-"));
  const logs: string[] = [];

  await runCli(
    [
      "eval",
      "./examples/fixtures/missing-evidence",
      "--brand",
      "./examples/acme/brand.yaml",
      "--competitors",
      "./examples/acme/competitors.yaml",
      "--prompts",
      "./examples/acme/prompts.yaml",
      "--out",
      outDir,
      "--provider",
      "openai",
      "--samples",
      "2",
      "--locale",
      "en-US"
    ],
    {
      runProvider: async (_provider, request, options) => fakeResponse(request.promptId, options?.sampleIndex ?? 0),
      logger: {
        log(message: string) {
          logs.push(message);
        },
        error(message: string) {
          logs.push(message);
        }
      }
    }
  );

  const evalSummary = await readFile(path.join(outDir, "eval-summary.md"), "utf8");
  const scorecard = await readFile(path.join(outDir, "scorecard.md"), "utf8");
  const rawPayload = await readFile(path.join(outDir, "raw", "openai", "best-developer-analytics--sample-2.json"), "utf8");
  const shareSummary = JSON.parse(await readFile(path.join(outDir, "share-summary.json"), "utf8")) as {
    metrics: { repeatedPromptCount?: number; stablePromptRate?: number; unstablePromptCount?: number };
  };
  const evalSummaryJson = JSON.parse(await readFile(path.join(outDir, "eval-summary.json"), "utf8")) as {
    summary: { repeatedPromptCount: number; stablePromptRate: number; unstablePromptCount: number };
  };

  assert.match(evalSummary, /# AnswerLens Eval Summary/);
  assert.match(evalSummary, /## Stability summary/);
  assert.match(scorecard, /VAVR: /);
  assert.match(rawPayload, /"sampleIndex": 1/);
  assert.ok((shareSummary.metrics.repeatedPromptCount ?? 0) > 0);
  assert.equal(shareSummary.metrics.stablePromptRate, 100);
  assert.equal(shareSummary.metrics.unstablePromptCount, 0);
  assert.ok(evalSummaryJson.summary.repeatedPromptCount > 0);
  assert.equal(evalSummaryJson.summary.stablePromptRate, 100);
  assert.equal(evalSummaryJson.summary.unstablePromptCount, 0);
  assert.ok(logs.some((entry) => entry.includes("AnswerLens eval complete.")));
});

test("runCli manual-import accepts normalized provider responses", async () => {
  process.env.ANSWERLENS_IMPORT_ONLY = "1";
  const { runCli } = await import("./index.ts");
  const outDir = await mkdtemp(path.join(os.tmpdir(), "answerlens-manual-"));
  const inputFile = path.join(outDir, "responses.json");

  await writeFile(
    inputFile,
    JSON.stringify([
      fakeResponse("best-developer-analytics", 0),
      {
        ...fakeResponse("developer-analytics-vs-mixpanel", 0),
        provider: "manual",
        model: "manual-import"
      }
    ]),
    "utf8"
  );

  await runCli([
    "manual-import",
    "./examples/fixtures/missing-evidence",
    "--brand",
    "./examples/acme/brand.yaml",
    "--competitors",
    "./examples/acme/competitors.yaml",
    "--prompts",
    "./examples/acme/prompts.yaml",
    "--out",
    outDir,
    "--input",
    inputFile,
    "--locale",
    "en-US"
  ]);

  const evalSummary = await readFile(path.join(outDir, "eval-summary.md"), "utf8");
  const shareSummary = JSON.parse(await readFile(path.join(outDir, "share-summary.json"), "utf8")) as {
    metrics: { competitivePositionScore?: number; rankCoverageRate?: number };
  };
  const runManifest = JSON.parse(await readFile(path.join(outDir, "run.json"), "utf8")) as {
    kind: string;
    run: { mode: string };
  };
  const auditResult = JSON.parse(await readFile(path.join(outDir, "site-audit.json"), "utf8")) as {
    run: { mode: string };
  };
  const evalResult = JSON.parse(await readFile(path.join(outDir, "eval-results.json"), "utf8")) as {
    run: { mode: string };
  };

  assert.match(evalSummary, /Benchmark prompt count/);
  assert.equal(runManifest.kind, "manual-import");
  assert.equal(runManifest.run.mode, "manual-import");
  assert.equal(auditResult.run.mode, "manual-import");
  assert.equal(evalResult.run.mode, "manual-import");
  assert.equal(shareSummary.metrics.competitivePositionScore, undefined);
  assert.equal(shareSummary.metrics.rankCoverageRate, undefined);
});

test("runCli manual-import surfaces CPS when rank positions are provided", async () => {
  process.env.ANSWERLENS_IMPORT_ONLY = "1";
  const { runCli } = await import("./index.ts");
  const outDir = await mkdtemp(path.join(os.tmpdir(), "answerlens-manual-rank-"));
  const inputFile = path.join(outDir, "responses.json");

  await writeFile(
    inputFile,
    JSON.stringify([
      {
        ...fakeResponse("best-developer-analytics", 0, 1),
        provider: "manual",
        model: "manual-import"
      },
      {
        ...fakeResponse("developer-analytics-vs-mixpanel", 0, 2),
        provider: "manual",
        model: "manual-import"
      }
    ]),
    "utf8"
  );

  await runCli([
    "manual-import",
    "./examples/fixtures/static-good",
    "--brand",
    "./examples/acme/brand.yaml",
    "--competitors",
    "./examples/acme/competitors.yaml",
    "--prompts",
    "./examples/acme/prompts.yaml",
    "--out",
    outDir,
    "--input",
    inputFile,
    "--locale",
    "en-US"
  ]);

  const evalSummary = await readFile(path.join(outDir, "eval-summary.md"), "utf8");
  const shareSummary = JSON.parse(await readFile(path.join(outDir, "share-summary.json"), "utf8")) as {
    metrics: { competitivePositionScore?: number; rankCoverageRate?: number };
  };

  assert.match(evalSummary, /Manual rank validation/);
  assert.match(evalSummary, /Competitive position score: 0.88/);
  assert.equal(shareSummary.metrics.competitivePositionScore, 0.88);
  assert.equal(shareSummary.metrics.rankCoverageRate, 100);
});

test("runCli manual-import rejects invalid rank positions", async () => {
  process.env.ANSWERLENS_IMPORT_ONLY = "1";
  const { runCli } = await import("./index.ts");
  for (const invalidRankPosition of [0, -1, 1.5, "first"]) {
    const outDir = await mkdtemp(path.join(os.tmpdir(), "answerlens-manual-invalid-rank-"));
    const inputFile = path.join(outDir, "responses.json");

    await writeFile(
      inputFile,
      JSON.stringify([
        {
          ...fakeResponse("best-developer-analytics", 0),
          provider: "manual",
          model: "manual-import",
          rankPosition: invalidRankPosition
        }
      ]),
      "utf8"
    );

    await assert.rejects(
      () =>
        runCli([
          "manual-import",
          "./examples/fixtures/static-good",
          "--brand",
          "./examples/acme/brand.yaml",
          "--competitors",
          "./examples/acme/competitors.yaml",
          "--prompts",
          "./examples/acme/prompts.yaml",
          "--out",
          outDir,
          "--input",
          inputFile,
          "--locale",
          "en-US"
        ]),
      /invalid rankPosition/i
    );
  }
});

test("runCli search-console-import writes validation artifacts and metadata", async () => {
  process.env.ANSWERLENS_IMPORT_ONLY = "1";
  const { runCli } = await import("./index.ts");
  const outDir = await mkdtemp(path.join(os.tmpdir(), "answerlens-search-console-"));
  const logs: string[] = [];

  await runCli(
    [
      "search-console-import",
      "./examples/fixtures/static-good",
      "--brand",
      "./examples/acme/brand.yaml",
      "--competitors",
      "./examples/acme/competitors.yaml",
      "--prompts",
      "./examples/acme/prompts.yaml",
      "--input",
      "./examples/fixtures/search-console/static-good-pages.csv",
      "--out",
      outDir
    ],
    {
      runProvider: async () => {
        throw new Error("search-console-import should not call live providers");
      },
      logger: {
        log(message: string) {
          logs.push(message);
        },
        error(message: string) {
          logs.push(message);
        }
      }
    }
  );

  const summaryMarkdown = await readFile(path.join(outDir, "search-console-summary.md"), "utf8");
  const summaryJson = JSON.parse(await readFile(path.join(outDir, "search-console-summary.json"), "utf8")) as {
    source: { type: string };
    summary: { importedPageCount: number; matchedAuditPageCount: number };
  };
  const pagesJson = JSON.parse(await readFile(path.join(outDir, "search-console-pages.json"), "utf8")) as Array<{
    page: string;
  }>;
  const shareSummary = await readFile(path.join(outDir, "share-summary.md"), "utf8");
  const runManifest = JSON.parse(await readFile(path.join(outDir, "run.json"), "utf8")) as {
    kind: string;
    run: { mode: string; validationSource?: string };
  };
  const auditResult = JSON.parse(await readFile(path.join(outDir, "site-audit.json"), "utf8")) as {
    run: { mode: string; validationSource?: string };
  };

  assert.match(summaryMarkdown, /# AnswerLens Search Console Summary/);
  assert.equal(summaryJson.source.type, "search-console");
  assert.equal(summaryJson.summary.importedPageCount, 5);
  assert.equal(summaryJson.summary.matchedAuditPageCount, 3);
  assert.ok(pagesJson.some((page) => page.page.includes("pricing")));
  assert.match(shareSummary, /Search Console validation: \d+\/\d+ key pages show Search Console evidence\./);
  assert.equal(runManifest.kind, "validation-import");
  assert.equal(runManifest.run.mode, "validation-import");
  assert.equal(runManifest.run.validationSource, "search-console");
  assert.equal(auditResult.run.mode, "validation-import");
  assert.equal(auditResult.run.validationSource, "search-console");
  assert.ok(logs.some((entry) => entry.includes("AnswerLens Search Console import complete.")));
});

test("runCli bing-indexnow-helper writes Bing and IndexNow artifacts", async () => {
  process.env.ANSWERLENS_IMPORT_ONLY = "1";
  const { runCli } = await import("./index.ts");
  const outDir = await mkdtemp(path.join(os.tmpdir(), "answerlens-bing-helper-"));
  const logs: string[] = [];

  await runCli(
    [
      "bing-indexnow-helper",
      "./examples/fixtures/static-good",
      "--brand",
      "./examples/acme/brand.yaml",
      "--competitors",
      "./examples/acme/competitors.yaml",
      "--prompts",
      "./examples/acme/prompts.yaml",
      "--bing-input",
      "./examples/fixtures/bing/static-good-pages.csv",
      "--out",
      outDir
    ],
    {
      runProvider: async () => {
        throw new Error("bing-indexnow-helper should not call live providers");
      },
      logger: {
        log(message: string) {
          logs.push(message);
        },
        error(message: string) {
          logs.push(message);
        }
      }
    }
  );

  const bingSummary = await readFile(path.join(outDir, "bing-summary.md"), "utf8");
  const indexNowSummary = await readFile(path.join(outDir, "indexnow-summary.md"), "utf8");
  const shareSummary = await readFile(path.join(outDir, "share-summary.md"), "utf8");
  const runManifest = JSON.parse(await readFile(path.join(outDir, "run.json"), "utf8")) as {
    kind: string;
    run: { mode: string; validationSource?: string };
    summary: { indexNowCandidateCount: number };
  };

  assert.match(bingSummary, /# AnswerLens Bing Webmaster Summary/);
  assert.match(indexNowSummary, /# AnswerLens IndexNow Helper Summary/);
  assert.match(shareSummary, /Bing Webmaster validation: \d+\/\d+ key pages show Bing Webmaster evidence\./);
  assert.match(shareSummary, /IndexNow helper: prepared \d+ candidate URLs/);
  assert.equal(runManifest.kind, "validation-import");
  assert.equal(runManifest.run.mode, "validation-import");
  assert.equal(runManifest.run.validationSource, "bing-webmaster");
  assert.ok(runManifest.summary.indexNowCandidateCount > 0);
  assert.ok(logs.some((entry) => entry.includes("AnswerLens Bing / IndexNow helper complete.")));
});
