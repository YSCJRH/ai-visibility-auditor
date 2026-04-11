import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { ProviderResponse } from "../../../packages/providers/src/index.ts";

function fakeResponse(promptId: string, sampleIndex = 0): ProviderResponse {
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
    rankPosition: null
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

  assert.match(evalSummary, /# AnswerLens Eval Summary/);
  assert.match(scorecard, /VAVR: /);
  assert.match(rawPayload, /"sampleIndex": 1/);
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
});
