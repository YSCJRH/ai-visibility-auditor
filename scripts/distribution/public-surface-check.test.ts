import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runPublicSurfaceCheck } from "./public-surface-check.ts";

test("public-surface-check passes a minimal compliant public surface", async () => {
  const rootDir = await createPublicSurfaceFixture();

  const findings = await runPublicSurfaceCheck({ rootDir });

  assert.deepEqual(findings, []);
});

test("public-surface-check rejects public overclaims, fake proof, premature npm install copy, robots drift, and workflow major drift", async () => {
  const rootDir = await createPublicSurfaceFixture();
  await writeFixtureFile(
    rootDir,
    "README.md",
    [
      "# AnswerLens",
      "AnswerLens guarantees #1 ranking and 42% traffic lift.",
      "AnswerLens supports consumer AI UI scraping for proof.",
      "Customers love the aggregateRating, testimonial, download count, and star count proof.",
      "Install it with npm install @answerlens/cli.",
      "The project robots.txt controls the host-level yscjrh.github.io/robots.txt behavior."
    ].join("\n")
  );
  await writeFixtureFile(rootDir, ".github/workflows/ci.yml", "steps:\n  - uses: actions/checkout@v4\n");

  const findings = await runPublicSurfaceCheck({ rootDir });
  const ruleIds = findings.map((finding) => finding.ruleId);

  assert.ok(ruleIds.includes("public-overclaim-ranking"));
  assert.ok(ruleIds.includes("public-consumer-ui-scraping"));
  assert.ok(ruleIds.includes("public-fake-proof"));
  assert.ok(ruleIds.includes("public-npm-install-claim"));
  assert.ok(ruleIds.includes("public-robots-host-claim"));
  assert.ok(ruleIds.includes("workflow-action-major"));
});

test("public-surface-check rejects runtime secrets, artifact order drift, and missing audit/eval key boundary", async () => {
  const rootDir = await createPublicSurfaceFixture();
  await writeFixtureFile(rootDir, ".github/answerlens/runtime.yaml", "runtime:\n  api_key: sk-testsecretvalue123\n");
  await writeFixtureFile(rootDir, "docs/github-action.md", "Open recommendations.md, then scorecard.md, then share-summary.md.");
  await writeFixtureFile(rootDir, "docs/quickstart.md", "Basic quickstart without the required key-boundary wording.");

  const findings = await runPublicSurfaceCheck({ rootDir });
  const ruleIds = findings.map((finding) => finding.ruleId);

  assert.ok(ruleIds.includes("runtime-secret-key"));
  assert.ok(ruleIds.includes("runtime-secret-value"));
  assert.ok(ruleIds.includes("artifact-review-order"));
  assert.ok(ruleIds.includes("audit-eval-key-boundary"));
});

async function createPublicSurfaceFixture(): Promise<string> {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "answerlens-public-surface-"));
  await writeFixtureFile(rootDir, "README.md", "# AnswerLens\nNo ranking guarantees and no consumer AI UI scraping.\n");
  await writeFixtureFile(rootDir, "README.zh-CN.md", "# AnswerLens\n不承诺排名，不抓取消费级 AI UI。\n");
  await writeFixtureFile(rootDir, "action.yml", artifactOrderText());
  await writeFixtureFile(rootDir, "docs/github-action.md", artifactOrderText());
  await writeFixtureFile(rootDir, "docs/zh/github-action.md", artifactOrderText());
  await writeFixtureFile(rootDir, "examples/consumer-repo/README.md", artifactOrderText());
  await writeFixtureFile(
    rootDir,
    "examples/consumer-repo/.github/workflows/answerlens.yml",
    `${artifactOrderText()}\nsteps:\n  - uses: actions/checkout@v5\n  - uses: actions/upload-artifact@v6\n`
  );
  await writeFixtureFile(
    rootDir,
    ".github/workflows/ci.yml",
    "steps:\n  - uses: actions/checkout@v5\n  - uses: actions/setup-node@v5\n  - uses: actions/github-script@v8\n  - uses: actions/upload-artifact@v6\n"
  );
  await writeFixtureFile(
    rootDir,
    "docs/quickstart.md",
    "Basic `audit` does not require provider API keys.\nYou only need provider API keys when you choose to run `eval`.\n"
  );
  await writeFixtureFile(
    rootDir,
    "docs/zh/quickstart.md",
    "基础 `audit` 不需要 provider API key。\n只有在你要跑 `eval` 时才需要 provider API key。\n"
  );
  await writeFixtureFile(rootDir, ".github/answerlens/runtime.yaml", safeRuntimeYaml());
  await writeFixtureFile(rootDir, "examples/acme/runtime.yaml", safeRuntimeYaml());
  await writeFixtureFile(rootDir, "examples/consumer-repo/.github/answerlens/runtime.yaml", safeRuntimeYaml());
  return rootDir;
}

function artifactOrderText(): string {
  return "Review share-summary.md first, then scorecard.md, then recommendations.md.";
}

function safeRuntimeYaml(): string {
  return "runtime:\n  provider: openai\n  model: gpt-5.1-mini\n";
}

async function writeFixtureFile(rootDir: string, relativePath: string, contents: string): Promise<void> {
  const filePath = path.join(rootDir, relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, contents, "utf8");
}
