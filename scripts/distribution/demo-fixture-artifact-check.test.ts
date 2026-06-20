import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runDemoFixtureArtifactCheck } from "./demo-fixture-artifact-check.ts";

const PRIMARY_ARTIFACTS = ["share-summary.md", "scorecard.md", "recommendations.md"];
const REQUIRED_ARTIFACTS = [
  ...PRIMARY_ARTIFACTS,
  "pr-snippet.md",
  "share-summary.json",
  "run.json",
  "index.html",
  "site-audit.json"
];

test("demo fixture artifact check passes a minimal first-run packet", async () => {
  const rootDir = await createDemoFixturePacket();

  const findings = await runDemoFixtureArtifactCheck({ rootDir });

  assert.deepEqual(findings, []);
});

test("demo fixture artifact check rejects missing required artifacts", async () => {
  const rootDir = await createDemoFixturePacket();
  await rm(path.join(rootDir, "runs/static-good/scorecard.md"));

  const findings = await runDemoFixtureArtifactCheck({ rootDir });
  const ruleIds = findings.map((finding) => finding.ruleId);

  assert.ok(ruleIds.includes("demo-fixture-artifact-missing"));
});

test("demo fixture artifact check rejects manifest order drift and raw payload paths", async () => {
  const rootDir = await createDemoFixturePacket({
    "run.json": JSON.stringify(
      {
        kind: "audit",
        site: { baseUrl: "https://fixture.local" },
        artifacts: ["recommendations.md", "scorecard.md", "share-summary.md", "raw/provider/prompt.json", ...REQUIRED_ARTIFACTS]
      },
      null,
      2
    )
  });

  const findings = await runDemoFixtureArtifactCheck({ rootDir });
  const ruleIds = findings.map((finding) => finding.ruleId);

  assert.ok(ruleIds.includes("demo-fixture-artifact-order"));
  assert.ok(ruleIds.includes("demo-fixture-raw-artifact"));
});

test("demo fixture artifact check rejects share boundary drift", async () => {
  const rootDir = await createDemoFixturePacket({
    "share-summary.md": ["# AnswerLens Share Summary", artifactLinks(), "## Guardrails", "AnswerLens report ready."].join("\n\n"),
    "pr-snippet.md": ["## AnswerLens audit", artifactLinks(), "Copyable starter: docs/starter-bundle.md"].join("\n\n")
  });

  const findings = await runDemoFixtureArtifactCheck({ rootDir });
  const ruleIds = findings.map((finding) => finding.ruleId);

  assert.ok(ruleIds.includes("demo-fixture-share-boundary"));
});

async function createDemoFixturePacket(overrides: Record<string, string> = {}): Promise<string> {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "answerlens-demo-fixture-"));
  const outDir = path.join(rootDir, "runs/static-good");
  await mkdir(outDir, { recursive: true });

  const artifacts = [...REQUIRED_ARTIFACTS];
  const files: Record<string, string> = {
    "run.json": JSON.stringify(
      {
        kind: "audit",
        site: { baseUrl: "https://fixture.local", display: "AnswerLens static-good fixture demo" },
        artifacts
      },
      null,
      2
    ),
    "share-summary.json": JSON.stringify(
      {
        project: "AnswerLens",
        tagline: "CI for AI discoverability.",
        disclaimer: "AnswerLens does not scrape consumer AI UIs, auto-post content, or guarantee answer-surface rankings.",
        artifacts
      },
      null,
      2
    ),
    "share-summary.md": [
      "# AnswerLens Share Summary",
      artifactLinks(),
      "## Next review steps",
      "Use the AnswerLens starter bundle.",
      "Use the first-run story template and Show and tell Discussion form.",
      "## Guardrails",
      "AnswerLens does not scrape consumer AI UIs or guarantee answer-surface rankings.",
      "Keep private analytics and raw provider payloads out of public PRs."
    ].join("\n\n"),
    "pr-snippet.md": [
      "## AnswerLens audit",
      artifactLinks(),
      "Copyable starter: AnswerLens starter bundle",
      "First-run story template: first-run story template",
      "Show and tell Discussion form: Show and tell Discussion form",
      "AnswerLens does not scrape consumer AI UIs or guarantee answer-surface rankings.",
      "Keep private analytics and raw provider payloads out of public PRs."
    ].join("\n\n"),
    "index.html": `<ol><li>share-summary.md</li><li>scorecard.md</li><li>recommendations.md</li></ol>`,
    "scorecard.md": "# Scorecard\n",
    "recommendations.md": "# Recommendations\n",
    "site-audit.json": "{}\n"
  };

  for (const artifact of REQUIRED_ARTIFACTS) {
    const contents = overrides[artifact] ?? files[artifact] ?? `${artifact}\n`;
    await writeFile(path.join(outDir, artifact), contents, "utf8");
  }

  return rootDir;
}

function artifactLinks(): string {
  return ["- [share-summary.md](share-summary.md)", "- [scorecard.md](scorecard.md)", "- [recommendations.md](recommendations.md)"].join("\n");
}
