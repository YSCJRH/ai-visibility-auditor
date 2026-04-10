import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { ProviderResponse } from "../../../packages/providers/src/index.ts";

function fakeResponse(promptId: string): ProviderResponse {
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
    rawPayload: { ok: true, promptId },
    requestedAt: new Date().toISOString()
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
      "openai"
    ],
    {
      runProvider: async (_provider, request) => fakeResponse(request.promptId),
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
  const rawPayload = await readFile(path.join(outDir, "raw", "openai", "best-developer-analytics.json"), "utf8");

  assert.match(evalSummary, /# AnswerLens Eval Summary/);
  assert.match(scorecard, /VAVR: /);
  assert.match(rawPayload, /"ok": true/);
  assert.ok(logs.some((entry) => entry.includes("AnswerLens eval complete.")));
});
