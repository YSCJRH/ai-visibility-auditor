import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runPublicSurfaceCheck } from "./public-surface-check.ts";

const STABLE_VERSION = "0.3.5";
const STABLE_TAG = `v${STABLE_VERSION}`;
const SHOW_AND_TELL_DISCUSSION_URL = "https://github.com/YSCJRH/ai-visibility-auditor/discussions/new?category=show-and-tell";

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

test("public-surface-check rejects Pages workflows without live postdeploy smoke checks", async () => {
  const rootDir = await createPublicSurfaceFixture();
  await writeFixtureFile(
    rootDir,
    ".github/workflows/pages.yml",
    [
      "name: Pages",
      "jobs:",
      "  deploy:",
      "    steps:",
      "      - id: deployment",
      "        uses: actions/deploy-pages@v5"
    ].join("\n")
  );

  const findings = await runPublicSurfaceCheck({ rootDir });
  const ruleIds = findings.map((finding) => finding.ruleId);

  assert.ok(ruleIds.includes("pages-postdeploy-smoke-check"));
});

test("public-surface-check rejects release snapshot freshness gates that are not wired into package and CI", async () => {
  const rootDir = await createPublicSurfaceFixture();
  await writeFixtureFile(
    rootDir,
    "package.json",
    JSON.stringify(
      {
        name: "answerlens-workspace",
        version: STABLE_VERSION,
        scripts: {
          "pages:smoke": "node --experimental-strip-types scripts/distribution/pages-smoke-check.ts",
          test: "node --test scripts/distribution/public-surface-check.test.ts"
        }
      },
      null,
      2
    )
  );
  await writeFixtureFile(
    rootDir,
    ".github/workflows/ci.yml",
    [
      "steps:",
      "  - uses: actions/checkout@v5",
      "  - uses: actions/setup-node@v5",
      "  - uses: actions/github-script@v8",
      "  - uses: actions/upload-artifact@v6"
    ].join("\n")
  );

  const findings = await runPublicSurfaceCheck({ rootDir });
  const ruleIds = findings.map((finding) => finding.ruleId);

  assert.ok(ruleIds.includes("release-snapshot-freshness-gate"));
});

test("public-surface-check rejects release snapshot CI without an authenticated GitHub token", async () => {
  const rootDir = await createPublicSurfaceFixture();
  await writeFixtureFile(
    rootDir,
    ".github/workflows/ci.yml",
    [
      "steps:",
      "  - uses: actions/checkout@v5",
      "  - uses: actions/setup-node@v5",
      "  - uses: actions/github-script@v8",
      "  - uses: actions/upload-artifact@v6",
      "  - run: pnpm release:snapshot:check"
    ].join("\n")
  );

  const findings = await runPublicSurfaceCheck({ rootDir });
  const ruleIds = findings.map((finding) => finding.ruleId);

  assert.ok(ruleIds.includes("release-snapshot-freshness-gate"));
});

test("public-surface-check rejects release surfaces without asset checklist boundaries", async () => {
  const rootDir = await createPublicSurfaceFixture();
  await writeFixtureFile(rootDir, "docs/manual-steps.md", `Use the reviewed release tag YSCJRH/ai-visibility-auditor@${STABLE_TAG}.\n`);

  const findings = await runPublicSurfaceCheck({ rootDir });
  const ruleIds = findings.map((finding) => finding.ruleId);

  assert.ok(ruleIds.includes("release-asset-checklist-boundary"));
});

test("public-surface-check rejects release workflows without asset manifest generation", async () => {
  const rootDir = await createPublicSurfaceFixture();
  await writeFixtureFile(
    rootDir,
    ".github/workflows/release-distribution.yml",
    [
      "name: Release Distribution",
      "permissions:",
      "  actions: write",
      "  contents: write",
      "  id-token: write",
      "jobs:",
      "  release:",
      "    steps:",
      "      - run: echo \"## Release asset checklist\"",
      "      - run: echo \"answerlens-cli-*.tgz\"",
      "      - run: echo \"`answerlens-demo-audit.tar.gz`\"",
      "      - run: echo \"`answerlens-site.tar.gz`\"",
      "      - run: echo \"If `npm view @answerlens/cli` returns `404`, keep release assets or local checkout as the public path\"",
      "      - run: gh workflow run pages.yml --ref main"
    ].join("\n")
  );

  const findings = await runPublicSurfaceCheck({ rootDir });
  const ruleIds = findings.map((finding) => finding.ruleId);

  assert.ok(ruleIds.includes("release-asset-manifest-gate"));
});

test("public-surface-check rejects release workflows without manifest job summary evidence", async () => {
  const rootDir = await createPublicSurfaceFixture();
  await writeFixtureFile(
    rootDir,
    ".github/workflows/release-distribution.yml",
    [
      "name: Release Distribution",
      "permissions:",
      "  actions: write",
      "  contents: write",
      "  id-token: write",
      "jobs:",
      "  release:",
      "    steps:",
      "      - run: echo \"## Release asset checklist\"",
      "      - run: echo \"answerlens-cli-*.tgz\"",
      "      - run: echo \"`answerlens-demo-audit.tar.gz`\"",
      "      - run: echo \"`answerlens-site.tar.gz`\"",
      "      - run: pnpm release:assets:manifest -- --out dist/release-assets-manifest.json dist/packages/*.tgz dist/answerlens-demo-audit.tar.gz dist/answerlens-site.tar.gz",
      "      - run: pnpm release:assets:manifest -- --verify dist/release-assets-manifest.json",
      "      - run: echo \"`release-assets-manifest.json`: verify asset sizes and SHA-256 checksums\"",
      "      - run: gh release upload \"$RELEASE_TAG\" dist/packages/*.tgz dist/answerlens-demo-audit.tar.gz dist/answerlens-site.tar.gz dist/release-assets-manifest.json --clobber",
      "      - uses: actions/upload-artifact@v6",
      "        with:",
      "          path: |",
      "            dist/release-assets-manifest.json",
      "      - run: echo \"If `npm view @answerlens/cli` returns `404`, keep release assets or local checkout as the public path\"",
      "      - run: gh workflow run pages.yml --ref main"
    ].join("\n")
  );

  const findings = await runPublicSurfaceCheck({ rootDir });
  const ruleIds = findings.map((finding) => finding.ruleId);

  assert.ok(ruleIds.includes("release-asset-manifest-gate"));
});

test("public-surface-check rejects release workflows that do not upload the summary to GitHub releases", async () => {
  const rootDir = await createPublicSurfaceFixture();
  await writeFixtureFile(
    rootDir,
    ".github/workflows/release-distribution.yml",
    [
      "name: Release Distribution",
      "permissions:",
      "  actions: write",
      "  contents: write",
      "  id-token: write",
      "jobs:",
      "  release:",
      "    steps:",
      "      - run: echo \"## Release asset checklist\"",
      "      - run: echo \"answerlens-cli-*.tgz\"",
      "      - run: echo \"`answerlens-demo-audit.tar.gz`\"",
      "      - run: echo \"`answerlens-site.tar.gz`\"",
      "      - run: echo \"`release-assets-summary.md`: read the verified asset table\"",
      "      - run: pnpm release:assets:manifest -- --out dist/release-assets-manifest.json dist/packages/*.tgz dist/answerlens-demo-audit.tar.gz dist/answerlens-site.tar.gz",
      "      - run: pnpm release:assets:manifest -- --verify dist/release-assets-manifest.json --summary-out dist/release-assets-summary.md",
      "      - run: cat dist/release-assets-summary.md >> \"$GITHUB_STEP_SUMMARY\"",
      "      - run: echo \"`release-assets-manifest.json`: verify asset sizes and SHA-256 checksums\"",
      "      - run: gh release upload \"$RELEASE_TAG\" dist/packages/*.tgz dist/answerlens-demo-audit.tar.gz dist/answerlens-site.tar.gz dist/release-assets-manifest.json --clobber",
      "      - uses: actions/upload-artifact@v6",
      "        with:",
      "          path: |",
      "            dist/release-assets-manifest.json",
      "            dist/release-assets-summary.md",
      "      - run: echo \"If `npm view @answerlens/cli` returns `404`, keep release assets or local checkout as the public path\"",
      "      - run: gh workflow run pages.yml --ref main"
    ].join("\n")
  );

  const findings = await runPublicSurfaceCheck({ rootDir });
  const ruleIds = findings.map((finding) => finding.ruleId);

  assert.ok(ruleIds.includes("release-asset-manifest-gate"));
});

test("public-surface-check rejects release asset docs without downloaded manifest verification", async () => {
  const rootDir = await createPublicSurfaceFixture();
  await writeFixtureFile(
    rootDir,
    "docs/release-bump-playbook.md",
    [
      "If public:check fails with stable-version-*, fix the drift instead of weakening the rule.",
      "Run corepack pnpm release:snapshot:refresh -- --write after GitHub publishes the release.",
      "Run corepack pnpm release:snapshot:check after refreshing the snapshot.",
      "Use the helper to replace guessed fields such as published_at with GitHub metadata.",
      "Include a release asset checklist with CLI tarball, `answerlens-demo-audit.tar.gz`, `answerlens-site.tar.gz`, `release-assets-manifest.json`, `release-assets-summary.md`, and `share-summary.md`, then `scorecard.md`, then `recommendations.md`."
    ].join("\n")
  );

  const findings = await runPublicSurfaceCheck({ rootDir });
  const ruleIds = findings.map((finding) => finding.ruleId);

  assert.ok(ruleIds.includes("release-asset-checklist-boundary"));
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

test("public-surface-check rejects first-run story templates without explicit reuse permission", async () => {
  const rootDir = await createPublicSurfaceFixture();
  await writeFixtureFile(
    rootDir,
    "docs/first-run-story.md",
    [
      "# First-Run Story",
      artifactOrderText(),
      "Share any first run as adoption proof."
    ].join("\n")
  );

  const findings = await runPublicSurfaceCheck({ rootDir });
  const ruleIds = findings.map((finding) => finding.ruleId);

  assert.ok(ruleIds.includes("first-run-story-boundary"));
});

test("public-surface-check rejects teardown templates without release asset evidence boundaries", async () => {
  const rootDir = await createPublicSurfaceFixture();
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

  const findings = await runPublicSurfaceCheck({ rootDir });
  const ruleIds = findings.map((finding) => finding.ruleId);

  assert.ok(ruleIds.includes("first-run-story-boundary"));
});

test("public-surface-check rejects discussion templates without first-run safety boundaries", async () => {
  const rootDir = await createPublicSurfaceFixture();
  await writeFixtureFile(
    rootDir,
    ".github/DISCUSSION_TEMPLATE/show-and-tell.yml",
    [
      "title: \"[First run] \"",
      "body:",
      "  - type: textarea",
      "    id: result",
      "    attributes:",
      "      label: Result",
      "      description: Share anything from the run."
    ].join("\n")
  );

  const findings = await runPublicSurfaceCheck({ rootDir });
  const ruleIds = findings.map((finding) => finding.ruleId);

  assert.ok(ruleIds.includes("first-run-story-boundary"));
  assert.ok(ruleIds.includes("artifact-review-order"));
});

test("public-surface-check rejects first-run sharing surfaces without direct Show and tell routing", async () => {
  const rootDir = await createPublicSurfaceFixture();
  await writeFixtureFile(
    rootDir,
    "docs/quickstart.md",
    [
      artifactOrderText(),
      "Basic `audit` does not require provider API keys.",
      "You only need provider API keys when you choose to run `eval`.",
      "Use the Adopter kit checklist and PR review packet for the first CI pull request.",
      "Open a general GitHub Discussion after the run."
    ].join("\n")
  );

  const findings = await runPublicSurfaceCheck({ rootDir });
  const ruleIds = findings.map((finding) => finding.ruleId);

  assert.ok(ruleIds.includes("first-run-discussion-routing"));
});

test("public-surface-check rejects release and Pages surfaces without direct Show and tell routing", async () => {
  const rootDir = await createPublicSurfaceFixture();
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
      "      - run: echo \"## Release asset checklist\"",
      "      - run: echo \"answerlens-cli-*.tgz\"",
      "      - run: echo \"`answerlens-demo-audit.tar.gz`\"",
      "      - run: echo \"`answerlens-site.tar.gz`\"",
      "      - run: echo \"If `npm view @answerlens/cli` returns `404`, keep release assets or local checkout as the public path\"",
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
    [
      `const fallback = releases[0]?.tag_name ?? "${STABLE_TAG}";`,
      `const pin = "YSCJRH/ai-visibility-auditor@${STABLE_TAG}";`,
      "const starterPanel = 'PR review packet';",
      "const preview = 'starter-packet-preview.svg';",
      "const artifactCopy = 'Public-safe artifact: answerlens-report';",
      "const rawCopy = 'raw/** is excluded by default';",
      "const boundaryCopy = 'No consumer AI UI scraping. No ranking or answer-placement guarantee.';",
      "const releaseChecklist = 'Release asset checklist answerlens-demo-audit.tar.gz answerlens-site.tar.gz share-summary.md</code>, then <code>scorecard.md</code>, then <code>recommendations.md</code> npm view @answerlens/cli';"
    ].join("\n")
  );

  const findings = await runPublicSurfaceCheck({ rootDir });
  const paths = findings.filter((finding) => finding.ruleId === "first-run-discussion-routing").map((finding) => finding.path).sort();

  assert.deepEqual(paths, [
    ".github/workflows/release-distribution.yml",
    "scripts/distribution/build-site.ts",
    "scripts/distribution/releases-snapshot.json"
  ]);
});

test("public-surface-check rejects starter bundle surfaces without adopter-kit review boundaries", async () => {
  const rootDir = await createPublicSurfaceFixture();
  await writeFixtureFile(
    rootDir,
    "docs/starter-bundle.md",
    `${artifactOrderText()}\nThe current starter workflow uses YSCJRH/ai-visibility-auditor@${STABLE_TAG}.\n`
  );

  const findings = await runPublicSurfaceCheck({ rootDir });
  const ruleIds = findings.map((finding) => finding.ruleId);

  assert.ok(ruleIds.includes("starter-adopter-kit-boundary"));
});

test("public-surface-check rejects generated share layers without first-run sharing boundaries", async () => {
  const rootDir = await createPublicSurfaceFixture();
  await writeFixtureFile(rootDir, "docs/shareable-summary.md", artifactOrderText());

  const findings = await runPublicSurfaceCheck({ rootDir });
  const ruleIds = findings.map((finding) => finding.ruleId);

  assert.ok(ruleIds.includes("share-layer-propagation-boundary"));
});

test("public-surface-check rejects starter packet preview drift", async () => {
  const rootDir = await createPublicSurfaceFixture();
  await writeFixtureFile(rootDir, "assets/starter-packet-preview.svg", "<svg><title>AnswerLens starter packet preview</title></svg>\n");

  const findings = await runPublicSurfaceCheck({ rootDir });
  const ruleIds = findings.map((finding) => finding.ruleId);

  assert.ok(ruleIds.includes("starter-adopter-kit-boundary"));
});

test("public-surface-check rejects visual assets without a share-summary-first packet", async () => {
  const rootDir = await createPublicSurfaceFixture();
  await writeFixtureFile(rootDir, "assets/social-preview.svg", "<svg><text>scorecard.md recommendations.md</text></svg>\n");

  const findings = await runPublicSurfaceCheck({ rootDir });
  const ruleIds = findings.map((finding) => finding.ruleId);

  assert.ok(ruleIds.includes("visual-share-packet-boundary"));
});

test("public-surface-check rejects Action docs without first-CI PR packet boundaries", async () => {
  const rootDir = await createPublicSurfaceFixture();
  await writeFixtureFile(
    rootDir,
    "docs/github-action.md",
    `${artifactOrderText()}\nUse YSCJRH/ai-visibility-auditor@${STABLE_TAG}; currently \`${STABLE_TAG}\`.\n`
  );

  const findings = await runPublicSurfaceCheck({ rootDir });
  const ruleIds = findings.map((finding) => finding.ruleId);

  assert.ok(ruleIds.includes("starter-adopter-kit-boundary"));
});

test("public-surface-check rejects self-dogfood entries without explicit no-claim boundaries", async () => {
  const rootDir = await createPublicSurfaceFixture();
  await writeFixtureFile(
    rootDir,
    "docs/self-dogfood-log.md",
    [
      "# Self-Dogfood Log",
      "## Entries",
      "### 2026-06-19: Drifted Entry",
      "- Audited surface: Pages.",
      "- Things not claimed: this run improved the project."
    ].join("\n")
  );

  const findings = await runPublicSurfaceCheck({ rootDir });
  const ruleIds = findings.map((finding) => finding.ruleId);

  assert.ok(ruleIds.includes("self-dogfood-log-boundary"));
});

async function createPublicSurfaceFixture(): Promise<string> {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "answerlens-public-surface-"));
  await writeFixtureFile(
    rootDir,
    "package.json",
    JSON.stringify(
      {
        name: "answerlens-workspace",
        version: STABLE_VERSION,
        scripts: {
          "pages:smoke": "node --experimental-strip-types scripts/distribution/pages-smoke-check.ts",
          "release:assets:manifest": "node --experimental-strip-types scripts/distribution/release-assets-manifest.ts",
          "release:snapshot:check": "node --experimental-strip-types scripts/distribution/release-snapshot-check.ts",
          "release:snapshot:refresh": "node --experimental-strip-types scripts/distribution/release-snapshot-refresh.ts",
          test: "node --experimental-strip-types --experimental-test-isolation=none --test scripts/distribution/public-surface-check.test.ts scripts/distribution/release-assets-manifest.test.ts scripts/distribution/release-snapshot-check.test.ts scripts/distribution/release-snapshot-refresh.test.ts"
        }
      },
      null,
      2
    )
  );
  await writeFixtureFile(rootDir, "apps/cli/package.json", JSON.stringify({ name: "@answerlens/cli", version: STABLE_VERSION }, null, 2));
  await writeFixtureFile(
    rootDir,
    "README.md",
    [
      "# AnswerLens",
      artifactOrderText(),
      "No ranking guarantees and no consumer AI UI scraping.",
      "![AnswerLens starter packet preview](assets/starter-packet-preview.svg)",
      "Use the Adopter kit checklist and PR review packet to show which artifact to open and which raw payloads stay private.",
      `Share first runs with ${SHOW_AND_TELL_DISCUSSION_URL}.`
    ].join("\n")
  );
  await writeFixtureFile(
    rootDir,
    "README.zh-CN.md",
    [
      "# AnswerLens",
      artifactOrderText(),
      "不承诺排名，不抓取消费级 AI UI。",
      "![AnswerLens starter packet preview](assets/starter-packet-preview.svg)",
      "使用 Adopter kit checklist 和 PR review packet，说明哪些 raw payloads 不能公开。",
      `用 ${SHOW_AND_TELL_DISCUSSION_URL} 分享 first-run story。`
    ].join("\n")
  );
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
      "      value: Review safe artifacts in order: share-summary.md, then scorecard.md, then recommendations.md. Please avoid raw provider payloads, private analytics, consumer AI UI scraping, and ranking guarantees.",
      "  - type: textarea",
      "    id: artifacts",
      "    attributes:",
      "      label: Public artifacts",
      "      description: If the run used release assets, include the release tag, asset names, and `release-assets-summary.md` when present; do not use release asset downloads as npm activation proof.",
      "      placeholder: answerlens-demo-audit.tar.gz and answerlens-site.tar.gz and release-assets-manifest.json if present and release-assets-summary.md if present"
    ].join("\n")
  );
  await writeFixtureFile(
    rootDir,
    ".github/ISSUE_TEMPLATE/config.yml",
    [
      "blank_issues_enabled: false",
      "contact_links:",
      "  - name: Share your first run",
      `    url: ${SHOW_AND_TELL_DISCUSSION_URL}`,
      "    about: Use the Show and tell form to share artifacts, screenshots, or what you learned from your first AnswerLens run."
    ].join("\n")
  );
  await writeFixtureFile(
    rootDir,
    ".github/DISCUSSION_TEMPLATE/show-and-tell.yml",
    [
      "title: \"[First run] \"",
      "body:",
      "  - type: markdown",
      "    attributes:",
      "      value: Share a first AnswerLens run that is safe for public discussion. Start with `share-summary.md`, then `scorecard.md`, then `recommendations.md`. Do not paste API keys, private analytics, raw provider payloads.",
      "  - type: textarea",
      "    id: primary-artifacts",
      "    attributes:",
      "      label: Primary artifacts opened in order",
      "      value: |",
      "        - share-summary.md:",
      "        - scorecard.md:",
      "        - recommendations.md:",
      "  - type: textarea",
      "    id: release-asset-evidence",
      "    attributes:",
      "      label: Release asset evidence, if relevant",
      "      value: |",
      "        - GitHub release tag URL:",
      "        - `answerlens-demo-audit.tar.gz`:",
      "        - `answerlens-site.tar.gz`:",
      "        - `release-assets-manifest.json`, if present on that release:",
      "        - `release-assets-summary.md`, if present on that release:",
      "        - I opened `share-summary.md`, then `scorecard.md`, then `recommendations.md` from the unpacked demo audit bundle",
      "        - I am not treating release assets as npm activation proof while `npm view @answerlens/cli` returns `404`",
      "  - type: checkboxes",
      "    id: safety-boundary",
      "    attributes:",
      "      label: Public sharing boundary",
      "      options:",
      "        - label: This post does not claim ranking lift, traffic lift, answer-surface placement, or external adoption proof.",
      "          required: true",
      "        - label: Basic `audit` needs no provider key; optional `eval` is BYOK and uses my own provider account.",
      "          required: true",
      "        - label: AnswerLens audits public source material; it does not scrape consumer AI UIs or guarantee rankings.",
      "          required: true",
      "  - type: dropdown",
      "    id: reuse-permission",
      "    attributes:",
      "      label: Permission to quote or reuse publicly",
      "      description: A first-run story is not external adoption proof unless you explicitly authorize public reuse.",
      "      options:",
      "        - \"yes, with these safe links or screenshots only\"",
      "        - \"no, keep this as feedback only\""
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
  await writeFixtureFile(rootDir, "docs/demo-report.md", `${artifactOrderText()}\nShare first runs with ${SHOW_AND_TELL_DISCUSSION_URL}.`);
  await writeFixtureFile(rootDir, "docs/shareable-summary.md", shareLayerContractText());
  await writeFixtureFile(
    rootDir,
    "docs/github-action.md",
    [
      artifactOrderText(),
      `Use YSCJRH/ai-visibility-auditor@${STABLE_TAG}; currently \`${STABLE_TAG}\`.`,
      "### Adopter kit",
      "### Safe sharing boundary",
      "## First CI PR packet",
      "Use the `Adopter kit` and `Safe sharing boundary` blocks in `GITHUB_STEP_SUMMARY`.",
      "The packet says no consumer AI UI scraping and no ranking or answer-placement guarantee."
    ].join("\n")
  );
  await writeFixtureFile(
    rootDir,
    "docs/zh/github-action.md",
    [
      artifactOrderText(),
      `使用 YSCJRH/ai-visibility-auditor@${STABLE_TAG}。`,
      "Adopter kit",
      "Safe sharing boundary",
      "## 第一次 CI 的 PR 审阅包",
      "`share-summary.md`，然后 `scorecard.md`，最后 `recommendations.md`",
      "不抓取消费级 AI UI，不承诺排名或答案展示位置"
    ].join("\n")
  );
  await writeFixtureFile(
    rootDir,
    "docs/starter-bundle.md",
    [
      artifactOrderText(),
      `The current starter workflow uses YSCJRH/ai-visibility-auditor@${STABLE_TAG}.`,
      "## Adopter kit checklist",
      "Copy `.github/answerlens/` and `.github/workflows/answerlens.yml` into the repository you want to audit.",
      "Put provider keys only in GitHub secrets or local environment variables.",
      "Review `share-summary.md`, then `scorecard.md`, then `recommendations.md` before you paste `pr-snippet.md`.",
      "## PR review packet",
      "![AnswerLens starter packet preview](../assets/starter-packet-preview.svg)",
      "Do not attach `raw/**` to public pull requests, issues, releases, or Discussions.",
      "No consumer AI UI scraping. No ranking or answer-placement guarantee."
    ].join("\n")
  );
  await writeFixtureFile(
    rootDir,
    "docs/release-bump-playbook.md",
    [
      "If public:check fails with stable-version-*, fix the drift instead of weakening the rule.",
      "Run corepack pnpm release:snapshot:refresh -- --write after GitHub publishes the release.",
      "Run corepack pnpm release:snapshot:check after refreshing the snapshot.",
      "Use the helper to replace guessed fields such as published_at with GitHub metadata.",
      "Include a release asset checklist with CLI tarball, `answerlens-demo-audit.tar.gz`, `answerlens-site.tar.gz`, `release-assets-manifest.json`, `release-assets-summary.md`, and `share-summary.md`, then `scorecard.md`, then `recommendations.md`.",
      "Run gh release download vX.Y.Z with release-assets-summary.md before corepack pnpm release:assets:manifest -- --verify.",
      "If an older release does not have release-assets-manifest.json or release-assets-summary.md, do not imply checksum coverage for that release.",
      "In the Release Distribution workflow summary, review the Release asset manifest verified table before reusing downloaded release assets."
    ].join("\n")
  );
  await writeFixtureFile(
    rootDir,
    "docs/manual-steps.md",
    [
      `Use the reviewed release tag YSCJRH/ai-visibility-auditor@${STABLE_TAG}.`,
      "## Release asset checklist",
      "CLI tarball",
      "answerlens-demo-audit.tar.gz",
      "answerlens-site.tar.gz",
      "release-assets-manifest.json",
      "release-assets-summary.md",
      "SHA-256",
      "gh release download vX.Y.Z",
      "corepack pnpm release:assets:manifest -- --verify",
      "Open by opening `share-summary.md`, then `scorecard.md`, then `recommendations.md`.",
      "If a release predates release-assets-manifest.json or release-assets-summary.md, do not backfill a checksum claim.",
      "If `npm view @answerlens/cli` returns `404`, do not present npm as activated."
    ].join("\n")
  );
  await writeFixtureFile(
    rootDir,
    "docs/zh/manual-steps.md",
    [
      `使用经过 review 的 release tag YSCJRH/ai-visibility-auditor@${STABLE_TAG}。`,
      "## release assets 检查清单",
      "CLI tarball",
      "answerlens-demo-audit.tar.gz",
      "answerlens-site.tar.gz",
      "release-assets-manifest.json",
      "release-assets-summary.md",
      "SHA-256",
      "gh release download vX.Y.Z",
      "corepack pnpm release:assets:manifest -- --verify",
      "`share-summary.md`、`scorecard.md`、`recommendations.md`",
      "不要把 checksum claim 回填进公开 release story",
      "如果 `npm view @answerlens/cli` 返回 `404`，不要把 npm 描述成已激活。"
    ].join("\n")
  );
  await writeFixtureFile(
    rootDir,
    "examples/consumer-repo/README.md",
    [
      artifactOrderText(),
      `Pin YSCJRH/ai-visibility-auditor@${STABLE_TAG}.`,
      "## Adopter kit checklist",
      "Copy `.github/answerlens/` and `.github/workflows/answerlens.yml` into the repository you want to audit.",
      "Put provider keys only in GitHub secrets or local environment variables.",
      "Review `share-summary.md`, then `scorecard.md`, then `recommendations.md` before you paste `pr-snippet.md`.",
      "## PR review packet",
      "Do not attach `raw/**` to public pull requests, issues, releases, or Discussions.",
      "No consumer AI UI scraping. No ranking or answer-placement guarantee."
    ].join("\n")
  );
  await writeFixtureFile(
    rootDir,
    "examples/consumer-repo/.github/workflows/answerlens.yml",
    [
      artifactOrderText(),
      "steps:",
      "  - uses: actions/checkout@v5",
      `  - uses: YSCJRH/ai-visibility-auditor@${STABLE_TAG}`,
      "  - run: |",
      '      echo "### Adopter kit"',
      '      echo "- To reuse this setup, copy \\`.github/answerlens/\\` and \\`.github/workflows/answerlens.yml\\`, then replace the brand, competitors, prompts, and \\`site:\\` URL."',
      '      echo "- Keep non-secret eval defaults in \\`runtime.yaml\\`; put provider keys in GitHub secrets or local environment variables."',
      '      echo "- Review \\`share-summary.md\\`, then \\`scorecard.md\\`, then \\`recommendations.md\\` before pasting \\`pr-snippet.md\\`."',
      '      echo "### Safe sharing boundary"',
      '      echo "- Public PRs should link the summary, scorecard, and recommendations; \\`raw/**\\` is excluded from the uploaded artifact."',
      '      echo "- AnswerLens audits public source material. No consumer AI UI scraping. No ranking or answer-placement guarantee."',
      "  - uses: actions/upload-artifact@v6",
      "    with:",
      "      path: |",
      "        ${{ steps.answerlens.outputs.out-dir }}",
      "        !${{ steps.answerlens.outputs.out-dir }}/raw/**"
    ].join("\n")
  );
  await writeFixtureFile(
    rootDir,
    ".github/workflows/ci.yml",
    "steps:\n  - uses: actions/checkout@v5\n  - uses: actions/setup-node@v5\n  - uses: actions/github-script@v8\n  - uses: actions/upload-artifact@v6\n  - run: pnpm release:snapshot:check\n    env:\n      GITHUB_TOKEN: ${{ github.token }}\n"
  );
  await writeFixtureFile(
    rootDir,
    "scripts/distribution/release-snapshot-check.ts",
    [
      "const rule = 'release-snapshot-freshness';",
      "const url = `https://api.github.com/repos/${repository}/releases?per_page=20`;",
      "const stable = draft !== true && release.prerelease !== true;"
    ].join("\n")
  );
  await writeFixtureFile(
    rootDir,
    "scripts/distribution/release-snapshot-refresh.ts",
    [
      "export async function runReleaseSnapshotRefresh() {}",
      "const userAgent = 'answerlens-release-snapshot-refresh';",
      "const publicRelease = release.draft !== true;",
      "await writeFile(snapshotPath, nextText, 'utf8');",
      "console.log('Re-run with --write to update scripts/distribution/releases-snapshot.json.');"
    ].join("\n")
  );
  await writeFixtureFile(
    rootDir,
    "scripts/distribution/release-assets-manifest.ts",
    [
      "const kind = 'answerlens-release-assets-manifest';",
      "const checksum = 'sha256';",
      "const cli = 'answerlens-cli-*.tgz';",
      "const demo = 'answerlens-demo-audit.tar.gz';",
      "const site = 'answerlens-site.tar.gz';",
      "const boundary = 'do not present npm as activated';",
      "function formatReleaseAssetsSummary() { return 'Release asset manifest verified'; }"
    ].join("\n")
  );
  await writeFixtureFile(
    rootDir,
    ".github/workflows/pages.yml",
    [
      "name: Pages",
      "jobs:",
      "  deploy:",
      "    permissions:",
      "      contents: read",
      "    steps:",
      "      - id: deployment",
      "        uses: actions/deploy-pages@v5",
      "      - name: Smoke check live Pages",
      "        env:",
      "          PAGE_URL: ${{ steps.deployment.outputs.page_url }}",
      "        run: pnpm pages:smoke -- --site-url \"$PAGE_URL\""
    ].join("\n")
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
      "      - run: echo \"## Release asset checklist\"",
      "      - run: echo \"answerlens-cli-*.tgz\"",
      "      - run: echo \"`answerlens-demo-audit.tar.gz`\"",
      "      - run: echo \"`answerlens-site.tar.gz`\"",
      "      - run: pnpm release:assets:manifest -- --out dist/release-assets-manifest.json dist/packages/*.tgz dist/answerlens-demo-audit.tar.gz dist/answerlens-site.tar.gz",
      "      - run: pnpm release:assets:manifest -- --verify dist/release-assets-manifest.json --summary-out dist/release-assets-summary.md",
      "      - run: cat dist/release-assets-summary.md >> \"$GITHUB_STEP_SUMMARY\"",
      "      - run: echo \"`release-assets-manifest.json`: verify asset sizes and SHA-256 checksums\"",
      "      - run: echo \"`release-assets-summary.md`: read the verified asset table\"",
      "      - run: gh release upload \"$RELEASE_TAG\" dist/packages/*.tgz dist/answerlens-demo-audit.tar.gz dist/answerlens-site.tar.gz dist/release-assets-manifest.json dist/release-assets-summary.md --clobber",
      "      - uses: actions/upload-artifact@v6",
      "        with:",
      "          path: |",
      "            dist/release-assets-manifest.json",
      "            dist/release-assets-summary.md",
      "      - run: echo \"If `npm view @answerlens/cli` returns `404`, keep release assets or local checkout as the public path\"",
      `      - run: echo \"Share first runs with ${SHOW_AND_TELL_DISCUSSION_URL}.\"`,
      "      - run: gh workflow run pages.yml --ref main"
    ].join("\n")
  );
  await writeFixtureFile(
    rootDir,
    "scripts/distribution/releases-snapshot.json",
    JSON.stringify([{ tag_name: STABLE_TAG, body: `Release notes for ${STABLE_TAG}. Share first runs with ${SHOW_AND_TELL_DISCUSSION_URL}.` }], null, 2)
  );
  await writeFixtureFile(
    rootDir,
    "scripts/distribution/build-site.ts",
    [
      `const fallback = releases[0]?.tag_name ?? "${STABLE_TAG}";`,
      `const pin = "YSCJRH/ai-visibility-auditor@${STABLE_TAG}";`,
      "const starterPanel = 'PR review packet';",
      "const preview = 'starter-packet-preview.svg';",
      "const artifactCopy = 'Public-safe artifact: answerlens-report';",
      "const rawCopy = 'raw/** is excluded by default';",
      "const boundaryCopy = 'No consumer AI UI scraping. No ranking or answer-placement guarantee.';",
      "const releaseChecklist = 'Release asset checklist answerlens-demo-audit.tar.gz answerlens-site.tar.gz share-summary.md</code>, then <code>scorecard.md</code>, then <code>recommendations.md</code> npm view @answerlens/cli';",
      `const firstRunDiscussion = "${SHOW_AND_TELL_DISCUSSION_URL}";`
    ].join("\n")
  );
  await writeFixtureFile(rootDir, "assets/starter-packet-preview.svg", starterPacketPreviewSvg());
  await writeFixtureFile(rootDir, "assets/readme-cover.svg", visualSharePacketSvg());
  await writeFixtureFile(rootDir, "assets/readme-artifacts-preview.svg", visualSharePacketSvg());
  await writeFixtureFile(rootDir, "assets/social-preview.svg", visualSharePacketSvg());
  await writeFixtureFile(rootDir, "scripts/distribution/seo-check.ts", `const FALLBACK_LATEST_RELEASE = "${STABLE_TAG}";\n`);
  await writeFixtureFile(rootDir, "scripts/distribution/site-seo.ts", `const releaseCopy = { "${STABLE_TAG}": "Stable release" };\n`);
  await writeFixtureFile(
    rootDir,
    "docs/quickstart.md",
    [
      artifactOrderText(),
      "Basic `audit` does not require provider API keys.",
      "You only need provider API keys when you choose to run `eval`.",
      "Use the Adopter kit checklist and PR review packet for the first CI pull request.",
      `Share first runs with ${SHOW_AND_TELL_DISCUSSION_URL}.`
    ].join("\n")
  );
  await writeFixtureFile(
    rootDir,
    "docs/zh/quickstart.md",
    [
      artifactOrderText(),
      "基础 `audit` 不需要 provider API key。",
      "只有在你要跑 `eval` 时才需要 provider API key。",
      "第一次 CI 接入 PR 使用 Adopter kit checklist 和 PR review packet。",
      `用 ${SHOW_AND_TELL_DISCUSSION_URL} 分享 first-run story。`
    ].join("\n")
  );
  await writeFixtureFile(
    rootDir,
    "docs/first-run-story.md",
    [
      artifactOrderText(),
      "Permission to quote or reuse publicly",
      "yes, with these safe links or screenshots only",
      "no, keep this as feedback only",
      "no external adoption proof unless I explicitly authorize reuse",
      "no private analytics or raw provider payloads",
      "Do not present a first-run story as external adoption proof unless the user explicitly authorized public reuse",
      "Release asset evidence, if relevant",
      "GitHub release tag URL",
      "`answerlens-demo-audit.tar.gz`",
      "`answerlens-site.tar.gz`",
      "`release-assets-manifest.json`, if present on that release",
      "`release-assets-summary.md`, if present on that release",
      "I opened `share-summary.md`, then `scorecard.md`, then `recommendations.md` from the unpacked demo audit bundle",
      "I am not treating release assets as npm activation proof while `npm view @answerlens/cli` returns `404`",
      `Use ${SHOW_AND_TELL_DISCUSSION_URL} for first-run stories.`
    ].join("\n")
  );
  await writeFixtureFile(rootDir, "docs/trust-and-safety.md", artifactOrderText());
  await writeFixtureFile(
    rootDir,
    "docs/self-dogfood-log.md",
    [
      "# Self-Dogfood Log",
      "## Entries",
      "### 2026-06-19: Compliant Entry",
      "- Things not claimed: no ranking lift, no traffic lift, no answer-surface placement, and no external adoption proof."
    ].join("\n")
  );
  await writeFixtureFile(rootDir, ".github/answerlens/runtime.yaml", safeRuntimeYaml());
  await writeFixtureFile(rootDir, "examples/acme/runtime.yaml", safeRuntimeYaml());
  await writeFixtureFile(rootDir, "examples/consumer-repo/.github/answerlens/runtime.yaml", safeRuntimeYaml());
  await writeFixtureFile(
    rootDir,
    "packages/report/src/index.ts",
    [
      "const FIRST_RUN_STORY_URL = 'https://github.com/YSCJRH/ai-visibility-auditor/blob/main/docs/first-run-story.md';",
      `const SHOW_AND_TELL_DISCUSSION_URL = '${SHOW_AND_TELL_DISCUSSION_URL}';`,
      "const nextStep = t(locale, \"report.next.firstRun\");",
      "const boundary = t(locale, \"brand.publicShareBoundary\");",
      "const htmlPanel = 'reviewPacket Review and share this run';",
      "const prLine = 'First-run story template and Show and tell Discussion form';"
    ].join("\n")
  );
  await writeFixtureFile(
    rootDir,
    "packages/i18n/src/index.ts",
    [
      "Keep API keys, private analytics, and raw provider payloads out of public PRs, issues, release notes, and Discussions.",
      "If this first run is safe to discuss, use the first-run story template and Show and tell Discussion form.",
      "raw provider payloads"
    ].join("\n")
  );
  await writeFixtureFile(
    rootDir,
    "packages/report/src/index.test.ts",
    [
      "assert.match(htmlReport, /Review and share this run/);",
      "assert.match(shareSummaryMarkdown, /first-run-story.md/);",
      "assert.match(prSnippet, /discussions\\/new\\?category=show-and-tell/);",
      "assert.match(prSnippet, /raw provider payloads/);",
      "assert.match(prSnippet, /private analytics/);"
    ].join("\n")
  );
  return rootDir;
}

function artifactOrderText(): string {
  return "Review share-summary.md first, then scorecard.md, then recommendations.md.";
}

function shareLayerContractText(): string {
  return [
    artifactOrderText(),
    "Use the AnswerLens starter bundle when this workflow is ready to move into another repository: https://github.com/YSCJRH/ai-visibility-auditor/blob/main/docs/starter-bundle.md",
    `If this first run is safe to discuss, use the first-run story template and Show and tell Discussion form: https://github.com/YSCJRH/ai-visibility-auditor/blob/main/docs/first-run-story.md and ${SHOW_AND_TELL_DISCUSSION_URL}`,
    "Keep API keys, private analytics, and raw provider payloads out of public PRs, issues, release notes, and Discussions."
  ].join("\n");
}

function safeRuntimeYaml(): string {
  return "runtime:\n  provider: openai\n  model: gpt-5.1-mini\n";
}

function starterPacketPreviewSvg(): string {
  return [
    "<svg>",
    "<title>AnswerLens starter packet preview</title>",
    "<text>Adopter kit</text>",
    "<text>PR review packet</text>",
    "<text>share-summary.md</text>",
    "<text>scorecard.md</text>",
    "<text>recommendations.md</text>",
    "<text>raw/** is excluded by default</text>",
    "<text>No consumer AI UI scraping</text>",
    "<text>No ranking or answer-placement guarantee</text>",
    "</svg>"
  ].join("\n");
}

function visualSharePacketSvg(): string {
  return [
    "<svg>",
    "<title>AnswerLens visual share packet</title>",
    "<text>Review packet</text>",
    "<text>share-summary.md</text>",
    "<text>scorecard.md</text>",
    "<text>recommendations.md</text>",
    "<text>pr-snippet.md</text>",
    "<text>Show and tell</text>",
    "<text>first-run story</text>",
    "<text>raw/** stays private</text>",
    "</svg>"
  ].join("\n");
}

async function writeFixtureFile(rootDir: string, relativePath: string, contents: string): Promise<void> {
  const filePath = path.join(rootDir, relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, contents, "utf8");
}
