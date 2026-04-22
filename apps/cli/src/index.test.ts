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
  assert.ok(logs.some((entry) => entry.includes("Provider: openai")));
  assert.ok(logs.some((entry) => entry.includes("Model: gpt-5-mini")));
});

test("runCli eval flags override runtime defaults", async () => {
  process.env.ANSWERLENS_IMPORT_ONLY = "1";
  const { runCli } = await import("./index.ts");
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "answerlens-cli-runtime-"));
  const runtimePath = path.join(tempDir, "runtime.yaml");
  await writeFile(
    runtimePath,
    `runtime:
  eval:
    provider: openai
    model: gpt-5-mini
    locale: en-US
    samples: 1
    timeout_ms: 60000
  providers:
    openai:
      base_url: https://api.openai.com/v1
    perplexity:
      base_url: https://api.perplexity.ai
`,
    "utf8"
  );

  const calls: Array<{
    provider: string;
    model?: string;
    locale?: string;
    timeoutMs?: number;
    baseUrl?: string;
    sampleIndex?: number;
    runCount?: number;
  }> = [];

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
      tempDir,
      "--runtime",
      runtimePath,
      "--provider",
      "perplexity",
      "--model",
      "sonar-pro",
      "--samples",
      "2",
      "--locale",
      "en-US",
      "--timeout-ms",
      "30000",
      "--base-url",
      "https://perplexity.example"
    ],
    {
      runProvider: async (provider, request, options) => {
        calls.push({
          provider,
          model: options?.model,
          locale: options?.locale,
          timeoutMs: options?.timeoutMs,
          baseUrl: options?.baseUrl,
          sampleIndex: options?.sampleIndex,
          runCount: options?.runCount
        });
        return fakeResponse(request.promptId, options?.sampleIndex ?? 0);
      },
      logger: {
        log() {},
        error() {}
      }
    }
  );

  assert.ok(calls.length > 0);
  assert.equal(calls[0]?.provider, "perplexity");
  assert.equal(calls[0]?.model, "sonar-pro");
  assert.equal(calls[0]?.locale, "en-US");
  assert.equal(calls[0]?.timeoutMs, 30000);
  assert.equal(calls[0]?.baseUrl, "https://perplexity.example");
  assert.equal(calls[0]?.runCount, 2);
});

test("runCli eval profile alias supplies recommended defaults", async () => {
  process.env.ANSWERLENS_IMPORT_ONLY = "1";
  const { runCli } = await import("./index.ts");
  const outDir = await mkdtemp(path.join(os.tmpdir(), "answerlens-cli-profile-"));
  const calls: Array<{
    provider: string;
    model?: string;
    locale?: string;
    timeoutMs?: number;
    runCount?: number;
  }> = [];

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
      "--profile",
      "high-confidence-review"
    ],
    {
      runProvider: async (provider, request, options) => {
        calls.push({
          provider,
          model: options?.model,
          locale: options?.locale,
          timeoutMs: options?.timeoutMs,
          runCount: options?.runCount
        });
        return fakeResponse(request.promptId, options?.sampleIndex ?? 0);
      },
      logger: {
        log() {},
        error() {}
      }
    }
  );

  assert.ok(calls.length > 0);
  assert.equal(calls[0]?.provider, "openai");
  assert.equal(calls[0]?.model, "gpt-5");
  assert.equal(calls[0]?.locale, "en-US");
  assert.equal(calls[0]?.timeoutMs, 60000);
  assert.equal(calls[0]?.runCount, 1);
});

test("runCli eval perplexity profile alias switches provider defaults", async () => {
  process.env.ANSWERLENS_IMPORT_ONLY = "1";
  const { runCli } = await import("./index.ts");
  const outDir = await mkdtemp(path.join(os.tmpdir(), "answerlens-cli-perplexity-profile-"));
  const calls: Array<{
    provider: string;
    model?: string;
    locale?: string;
    timeoutMs?: number;
    runCount?: number;
  }> = [];

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
      "--profile",
      "perplexity-cross-check"
    ],
    {
      runProvider: async (provider, request, options) => {
        calls.push({
          provider,
          model: options?.model,
          locale: options?.locale,
          timeoutMs: options?.timeoutMs,
          runCount: options?.runCount
        });
        return fakeResponse(request.promptId, options?.sampleIndex ?? 0);
      },
      logger: {
        log() {},
        error() {}
      }
    }
  );

  assert.ok(calls.length > 0);
  assert.equal(calls[0]?.provider, "perplexity");
  assert.equal(calls[0]?.model, "sonar");
  assert.equal(calls[0]?.locale, "en-US");
  assert.equal(calls[0]?.timeoutMs, 60000);
  assert.equal(calls[0]?.runCount, 1);
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

test("consumer repo starter bundle stays self-consistent", async () => {
  process.env.ANSWERLENS_IMPORT_ONLY = "1";
  const { runCli } = await import("./index.ts");
  const outDir = await mkdtemp(path.join(os.tmpdir(), "answerlens-consumer-repo-"));

  await runCli([
    "audit",
    "./examples/fixtures/static-good",
    "--brand",
    "./examples/consumer-repo/.github/answerlens/brand.yaml",
    "--competitors",
    "./examples/consumer-repo/.github/answerlens/competitors.yaml",
    "--prompts",
    "./examples/consumer-repo/.github/answerlens/prompts.yaml",
    "--out",
    outDir
  ]);

  const [workflow, runtimeConfig, shareSummary, scorecard, recommendations, runManifest] = await Promise.all([
    readFile("./examples/consumer-repo/.github/workflows/answerlens.yml", "utf8"),
    readFile("./examples/consumer-repo/.github/answerlens/runtime.yaml", "utf8"),
    readFile(path.join(outDir, "share-summary.md"), "utf8"),
    readFile(path.join(outDir, "scorecard.md"), "utf8"),
    readFile(path.join(outDir, "recommendations.md"), "utf8"),
    readFile(path.join(outDir, "run.json"), "utf8")
  ]);

  assert.match(workflow, /actions\/checkout@v5/);
  assert.match(workflow, /actions\/upload-artifact@v6/);
  assert.match(workflow, /runtime\.yaml/);
  assert.match(workflow, /\.github\/answerlens\/brand\.yaml/);
  assert.match(workflow, /\.github\/answerlens\/competitors\.yaml/);
  assert.match(workflow, /\.github\/answerlens\/prompts\.yaml/);
  assert.match(runtimeConfig, /provider: openai/);
  assert.match(runtimeConfig, /model: gpt-5-mini/);
  assert.match(workflow, /YSCJRH\/ai-visibility-auditor@v0\.3\.0/);
  assert.match(workflow, /Artifact review order/);
  assert.match(workflow, /scorecard-path/);
  assert.match(workflow, /recommendations-path/);
  assert.match(shareSummary, /# AnswerLens Share Summary/);
  assert.match(shareSummary, /Demo site: Example Product public site/);
  assert.match(scorecard, /Demo site: Example Product public site/);
  assert.match(recommendations, /Demo site: Example Product public site/);
  assert.match(runManifest, /"display": "Example Product public site"/);
});
