import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  createAuditRun,
  getRunDetail,
  getRunJob,
  listConfigPresets,
  listRuns,
  readRunArtifact
} from "./index.ts";

async function waitForJob(jobId: string, timeoutMs = 10000): Promise<void> {
  const started = Date.now();
  for (;;) {
    const job = getRunJob(jobId);
    if (job?.status === "completed") {
      return;
    }
    if (job?.status === "failed") {
      throw new Error(job.error ?? "job failed");
    }
    if (Date.now() - started > timeoutMs) {
      throw new Error(`Timed out waiting for job ${jobId}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

test("admin runtime lists presets from repo sources", async () => {
  const presets = await listConfigPresets({ repoRoot: path.resolve(".") });

  assert.equal(presets.length, 3);
  assert.ok(presets.some((preset) => preset.id === "repo-answerlens"));
  assert.ok(presets.some((preset) => preset.id === "example-acme"));
  assert.ok(presets.some((preset) => preset.id === "example-consumer-repo"));
  assert.equal(presets[0]?.runtimeDefaults?.provider, "openai");
  assert.equal(presets[0]?.runtimeDefaults?.model, "gpt-5-mini");
  assert.equal(presets[0]?.runtimeDefaults?.locale, "en-US");
  assert.equal(presets[0]?.runtimeDefaults?.samples, 2);
  assert.match(presets[0]?.runtimePath ?? "", /runtime\.yaml$/);
});

test("admin runtime creates and reads an audit run", async () => {
  const runsDir = await mkdtemp(path.join(os.tmpdir(), "answerlens-admin-runtime-"));
  const repoRoot = path.resolve(".");
  const job = await createAuditRun(
    {
      site: "./examples/fixtures/static-good",
      presetId: "example-consumer-repo"
    },
    { repoRoot, runsDir }
  );

  assert.equal(job.status, "queued");
  await waitForJob(job.id);

  const completed = getRunJob(job.id);
  assert.ok(completed?.runId);

  const runs = await listRuns({ repoRoot, runsDir });
  assert.equal(runs.length, 1);
  assert.equal(runs[0]?.kind, "audit");
  assert.equal(runs[0]?.status, "completed");
  assert.match(runs[0]?.siteLabel ?? "", /Example Product public site/);
  assert.equal(runs[0]?.overallScore, 87);

  const detail = await getRunDetail(completed!.runId!, { repoRoot, runsDir });
  assert.equal(detail.manifest.kind, "audit");
  assert.match(detail.shareSummary?.site.display ?? "", /Example Product public site/);
  assert.ok(detail.auditResult);
  assert.equal(detail.auditResult?.summary.overallScore, 87);
  assert.ok(detail.artifacts.some((artifact) => artifact.name === "share-summary.md"));
  assert.ok(detail.artifacts.some((artifact) => artifact.name === "scorecard.md"));

  const artifact = await readRunArtifact(completed!.runId!, "share-summary.md", { repoRoot, runsDir });
  assert.equal(artifact.entry.contentType, "markdown");
  assert.match(artifact.content, /# AnswerLens Share Summary/);
});
