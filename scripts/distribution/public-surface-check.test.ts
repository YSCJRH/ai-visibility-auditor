import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runPublicSurfaceCheck } from "./public-surface-check.ts";

const STABLE_VERSION = "0.3.5";
const STABLE_TAG = `v${STABLE_VERSION}`;

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

test("public-surface-check rejects implicit npm install copy and raw payload artifact uploads", async () => {
  const rootDir = await createPublicSurfaceFixture();
  await writeFixtureFile(rootDir, "scripts/distribution/build-site.ts", "<code>@answerlens/cli</code> for CLI installs and dry-run packaging.");
  await writeFixtureFile(
    rootDir,
    "examples/consumer-repo/.github/workflows/answerlens.yml",
    `${artifactOrderText()}\nsteps:\n  - uses: actions/upload-artifact@v6\n    with:\n      path: \${{ steps.answerlens.outputs.out-dir }}\n`
  );

  const findings = await runPublicSurfaceCheck({ rootDir });
  const ruleIds = findings.map((finding) => finding.ruleId);

  assert.ok(ruleIds.includes("public-npm-install-claim"));
  assert.ok(ruleIds.includes("raw-payload-upload-exposure"));
});

test("public-surface-check rejects default run artifact uploads without raw exclusion", async () => {
  const rootDir = await createPublicSurfaceFixture();
  await writeFixtureFile(
    rootDir,
    ".github/workflows/ci.yml",
    [
      "steps:",
      "  - uses: actions/checkout@v5",
      "  - uses: actions/upload-artifact@v6",
      "    with:",
      "      name: answerlens-demo-runs",
      "      path: |",
      "        runs/static-good",
      "        runs/consumer-repo"
    ].join("\n")
  );

  const findings = await runPublicSurfaceCheck({ rootDir });
  const ruleIds = findings.map((finding) => finding.ruleId);

  assert.ok(ruleIds.includes("raw-payload-upload-exposure"));
});

test("public-surface-check rejects local absolute paths in public contribution surfaces", async () => {
  const rootDir = await createPublicSurfaceFixture();
  await writeFixtureFile(rootDir, "CONTRIBUTING.md", "Read [docs/rule-authoring.md](/D:/SEO/docs/rule-authoring.md).\n");

  const findings = await runPublicSurfaceCheck({ rootDir });
  const ruleIds = findings.map((finding) => finding.ruleId);

  assert.ok(ruleIds.includes("public-local-absolute-path"));
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

test("public-surface-check rejects artifact order drift in GitHub intake templates", async () => {
  const rootDir = await createPublicSurfaceFixture();
  await writeFixtureFile(
    rootDir,
    ".github/ISSUE_TEMPLATE/audit-teardown.yml",
    "description: Link recommendations.md, then scorecard.md, then share-summary.md.\n"
  );

  const findings = await runPublicSurfaceCheck({ rootDir });
  const ruleIds = findings.map((finding) => finding.ruleId);

  assert.ok(ruleIds.includes("artifact-review-order"));
});

test("public-surface-check rejects release workflows that cannot refresh Pages after publishing", async () => {
  const rootDir = await createPublicSurfaceFixture();
  await writeFixtureFile(
    rootDir,
    ".github/workflows/release-distribution.yml",
    [
      "name: Release Distribution",
      "permissions:",
      "  contents: write",
      "  id-token: write",
      "jobs:",
      "  release:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - run: gh release upload \"$RELEASE_TAG\" dist/packages/*.tgz --clobber"
    ].join("\n")
  );

  const findings = await runPublicSurfaceCheck({ rootDir });
  const ruleIds = findings.map((finding) => finding.ruleId);

  assert.ok(ruleIds.includes("release-pages-refresh-permission"));
  assert.ok(ruleIds.includes("release-pages-refresh-dispatch"));
});

test("public-surface-check rejects stable version drift across release and adoption surfaces", async () => {
  const rootDir = await createPublicSurfaceFixture();
  await writeFixtureFile(rootDir, "apps/cli/package.json", JSON.stringify({ name: "@answerlens/cli", version: "0.3.6" }, null, 2));
  await writeFixtureFile(
    rootDir,
    "examples/consumer-repo/.github/workflows/answerlens.yml",
    `${artifactOrderText()}\nsteps:\n  - uses: YSCJRH/ai-visibility-auditor@v0.3.4\n`
  );

  const findings = await runPublicSurfaceCheck({ rootDir });
  const ruleIds = findings.map((finding) => finding.ruleId);

  assert.ok(ruleIds.includes("stable-version-package-drift"));
  assert.ok(ruleIds.includes("stable-version-release-snapshot"));
  assert.ok(ruleIds.includes("stable-version-surface-pin"));
});

async function createPublicSurfaceFixture(): Promise<string> {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "answerlens-public-surface-"));
  await writeFixtureFile(rootDir, "package.json", JSON.stringify({ name: "answerlens-workspace", version: STABLE_VERSION }, null, 2));
  await writeFixtureFile(rootDir, "apps/cli/package.json", JSON.stringify({ name: "@answerlens/cli", version: STABLE_VERSION }, null, 2));
  await writeFixtureFile(rootDir, "README.md", `# AnswerLens\n${artifactOrderText()}\nNo ranking guarantees and no consumer AI UI scraping.\n`);
  await writeFixtureFile(rootDir, "README.zh-CN.md", `# AnswerLens\n${artifactOrderText()}\n不承诺排名，不抓取消费级 AI UI。\n`);
  await writeFixtureFile(
    rootDir,
    "CONTRIBUTING.md",
    [
      "# Contributing",
      "Read [docs/rule-authoring.md](docs/rule-authoring.md).",
      "Read [docs/provider-contract.md](docs/provider-contract.md)."
    ].join("\n")
  );
  await writeFixtureFile(
    rootDir,
    ".github/pull_request_template.md",
    [
      "Review generated artifacts in order: `share-summary.md`, then `scorecard.md`, then `recommendations.md`.",
      "No consumer AI UI scraping is presented as a product capability.",
      "Do not paste raw provider payloads from `raw/**` into public PRs."
    ].join("\n")
  );
  await writeFixtureFile(
    rootDir,
    ".github/ISSUE_TEMPLATE/audit-teardown.yml",
    [
      "name: Audit teardown",
      "description: Share an AnswerLens run.",
      "body:",
      "  - type: markdown",
      "    attributes:",
      "      value: Review safe artifacts in order: share-summary.md, then scorecard.md, then recommendations.md. Please avoid raw provider payloads, private analytics, consumer AI UI scraping, and ranking guarantees."
    ].join("\n")
  );
  await writeFixtureFile(rootDir, ".agents/plugins/marketplace.json", "{\"name\":\"answerlens-codex\",\"plugins\":[]}\n");
  await writeFixtureFile(
    rootDir,
    "plugins/answerlens-codex/skills/answerlens-activation/SKILL.md",
    [
      "# AnswerLens Activation",
      "No ranking guarantees.",
      "## What To Block",
      "Block or rewrite public copy that claims or implies:",
      "- guaranteed AI rankings",
      "- guaranteed ChatGPT answer-surface placement",
      "- consumer AI UI scraping as a product capability",
      "It must not imply:",
      "- must not imply unauthorized customer proof"
    ].join("\n")
  );
  await writeFixtureFile(rootDir, "action.yml", artifactOrderText());
  await writeFixtureFile(rootDir, "docs/demo-report.md", artifactOrderText());
  await writeFixtureFile(rootDir, "docs/shareable-summary.md", artifactOrderText());
  await writeFixtureFile(
    rootDir,
    "docs/github-action.md",
    `${artifactOrderText()}\nUse YSCJRH/ai-visibility-auditor@${STABLE_TAG}; currently \`${STABLE_TAG}\`.\n`
  );
  await writeFixtureFile(
    rootDir,
    "docs/zh/github-action.md",
    `${artifactOrderText()}\n使用 YSCJRH/ai-visibility-auditor@${STABLE_TAG}。\n`
  );
  await writeFixtureFile(
    rootDir,
    "docs/starter-bundle.md",
    `${artifactOrderText()}\nThe current starter workflow uses YSCJRH/ai-visibility-auditor@${STABLE_TAG}.\n`
  );
  await writeFixtureFile(
    rootDir,
    "docs/release-bump-playbook.md",
    "If public:check fails with stable-version-*, fix the drift instead of weakening the rule.\n"
  );
  await writeFixtureFile(
    rootDir,
    "docs/manual-steps.md",
    `Use the reviewed release tag YSCJRH/ai-visibility-auditor@${STABLE_TAG}.\n`
  );
  await writeFixtureFile(
    rootDir,
    "docs/zh/manual-steps.md",
    `使用经过 review 的 release tag YSCJRH/ai-visibility-auditor@${STABLE_TAG}。\n`
  );
  await writeFixtureFile(rootDir, "examples/consumer-repo/README.md", `${artifactOrderText()}\nPin YSCJRH/ai-visibility-auditor@${STABLE_TAG}.\n`);
  await writeFixtureFile(
    rootDir,
    "examples/consumer-repo/.github/workflows/answerlens.yml",
    `${artifactOrderText()}\nsteps:\n  - uses: actions/checkout@v5\n  - uses: YSCJRH/ai-visibility-auditor@${STABLE_TAG}\n  - uses: actions/upload-artifact@v6\n    with:\n      path: |\n        \${{ steps.answerlens.outputs.out-dir }}\n        !\${{ steps.answerlens.outputs.out-dir }}/raw/**\n`
  );
  await writeFixtureFile(
    rootDir,
    ".github/workflows/ci.yml",
    "steps:\n  - uses: actions/checkout@v5\n  - uses: actions/setup-node@v5\n  - uses: actions/github-script@v8\n  - uses: actions/upload-artifact@v6\n"
  );
  await writeFixtureFile(
    rootDir,
    ".github/workflows/release-distribution.yml",
    [
      "name: Release Distribution",
      "permissions:",
      "  actions: write",
      "  contents: write",
      "  id-token: write",
      "on:",
      "  workflow_dispatch:",
      "    inputs:",
      "      tag-name:",
      `        description: \"Optional semver tag to simulate or publish, for example ${STABLE_TAG}.\"`,
      "jobs:",
      "  release:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      `      - run: echo \"Starter bundle pinned to ${STABLE_TAG}\"`,
      "      - run: gh workflow run pages.yml --ref main"
    ].join("\n")
  );
  await writeFixtureFile(
    rootDir,
    "scripts/distribution/releases-snapshot.json",
    JSON.stringify([{ tag_name: STABLE_TAG, body: `Release notes for ${STABLE_TAG}.` }], null, 2)
  );
  await writeFixtureFile(
    rootDir,
    "scripts/distribution/build-site.ts",
    `const fallback = releases[0]?.tag_name ?? "${STABLE_TAG}";\nconst pin = "YSCJRH/ai-visibility-auditor@${STABLE_TAG}";\n`
  );
  await writeFixtureFile(rootDir, "scripts/distribution/seo-check.ts", `const fallback = releases[0]?.tag_name ?? "${STABLE_TAG}";\n`);
  await writeFixtureFile(rootDir, "scripts/distribution/site-seo.ts", `const releaseCopy = { "${STABLE_TAG}": "Stable release" };\n`);
  await writeFixtureFile(
    rootDir,
    "docs/quickstart.md",
    `${artifactOrderText()}\nBasic \`audit\` does not require provider API keys.\nYou only need provider API keys when you choose to run \`eval\`.\n`
  );
  await writeFixtureFile(
    rootDir,
    "docs/zh/quickstart.md",
    `${artifactOrderText()}\n基础 \`audit\` 不需要 provider API key。\n只有在你要跑 \`eval\` 时才需要 provider API key。\n`
  );
  await writeFixtureFile(rootDir, "docs/first-run-story.md", artifactOrderText());
  await writeFixtureFile(rootDir, "docs/trust-and-safety.md", artifactOrderText());
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
