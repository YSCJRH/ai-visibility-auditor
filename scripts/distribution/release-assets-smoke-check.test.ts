import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { runReleaseAssetsManifest } from "./release-assets-manifest.ts";
import { formatReleaseAssetsSmokeSummary, runReleaseAssetsSmokeCheck } from "./release-assets-smoke-check.ts";

const execFileAsync = promisify(execFile);
const SCRIPT_PATH = path.resolve("scripts/distribution/release-assets-smoke-check.ts");

test("release-assets-smoke-check verifies downloaded release assets", async () => {
  const fixture = await createReleaseAssetsFixture();

  const findings = await runReleaseAssetsSmokeCheck({ assetsDir: fixture.assetsDir });

  assert.deepEqual(findings, []);
});

test("release-assets-smoke-check accepts workflow dist package layout", async () => {
  const fixture = await createReleaseAssetsFixture({ cliTarballInPackagesDir: true });

  const findings = await runReleaseAssetsSmokeCheck({ assetsDir: fixture.assetsDir });

  assert.deepEqual(findings, []);
});

test("release-assets-smoke-check rejects premature npm runner copy inside the CLI tarball README", async () => {
  const fixture = await createReleaseAssetsFixture({ brokenCliReadme: true });

  const findings = await runReleaseAssetsSmokeCheck({ assetsDir: fixture.assetsDir });
  const finding = findings.find((item) => item.ruleId === "release-cli-tarball-readme");

  assert.ok(finding);
  assert.match(finding.path, /answerlens-cli-1\.2\.3\.tgz:README\.md:/);
  assert.match(finding.message, /public claim boundaries/);
  assert.match(finding.message, /registry package is visible/);
});

test("release-assets-smoke-check rejects a release asset summary without the CLI tarball", async () => {
  const fixture = await createReleaseAssetsFixture({ brokenReleaseSummaryMissingCli: true });

  const findings = await runReleaseAssetsSmokeCheck({ assetsDir: fixture.assetsDir });
  const finding = findings.find((item) => item.ruleId === "release-asset-summary");

  assert.ok(finding);
  assert.match(finding.message, /answerlens-cli-/);
});

test("release-assets-smoke-check rejects a release asset summary without checksum table headers", async () => {
  const fixture = await createReleaseAssetsFixture({ brokenReleaseSummaryMissingChecksumHeader: true });

  const findings = await runReleaseAssetsSmokeCheck({ assetsDir: fixture.assetsDir });
  const finding = findings.find((item) => item.ruleId === "release-asset-summary");

  assert.ok(finding);
  assert.match(finding.message, /Asset \| Size \| SHA-256/);
});

test("release-assets-smoke-check rejects a release asset summary without adopter handoff", async () => {
  const fixture = await createReleaseAssetsFixture({ brokenReleaseSummaryMissingAdopterHandoff: true });

  const findings = await runReleaseAssetsSmokeCheck({ assetsDir: fixture.assetsDir });
  const finding = findings.find((item) => item.ruleId === "release-asset-summary");

  assert.ok(finding);
  assert.match(finding.message, /first-run story template|starter bundle|raw provider payloads/);
});

test("release-assets-smoke-check writes a release review summary on success", async () => {
  const fixture = await createReleaseAssetsFixture();
  const summaryPath = path.join(fixture.rootDir, "release-assets-smoke-summary.md");

  const findings = await runReleaseAssetsSmokeCheck({ assetsDir: fixture.assetsDir, summaryOutPath: summaryPath });

  assert.deepEqual(findings, []);
  const summary = await readFile(summaryPath, "utf8");
  assert.match(summary, /## Release asset smoke check passed/);
  assert.match(summary, /Release review path: Open `release-assets-summary\.md`, then the demo audit `share-summary\.md`, then `scorecard\.md`, then `recommendations\.md`\./);
  assert.match(summary, /Review order: `share-summary\.md`, then `scorecard\.md`, then `recommendations\.md`/);
  assert.match(summary, /do not present npm as activated/);
  assert.match(summary, /raw provider payloads/);
  assert.match(summary, /release-assets-manifest\.json/);
  assert.match(summary, /release-assets-summary\.md/);
  assert.match(summary, /adopter handoff and public sharing boundaries/);
  assert.match(summary, /answerlens-cli-\*\.tgz/);
  assert.match(summary, /package README public-claim boundary/);
  assert.match(summary, /answerlens-demo-audit\.tar\.gz/);
  assert.match(summary, /answerlens-site\.tar\.gz/);
});

test("release-assets-smoke-check rejects a demo bundle with drifted first-run artifacts", async () => {
  const fixture = await createReleaseAssetsFixture({ brokenDemoBundle: true });

  const findings = await runReleaseAssetsSmokeCheck({ assetsDir: fixture.assetsDir });
  const ruleIds = findings.map((finding) => finding.ruleId);

  assert.ok(ruleIds.includes("release-demo-fixture-share-boundary"));
});

test("release-assets-smoke-check rejects a site bundle without release entrypoints", async () => {
  const fixture = await createReleaseAssetsFixture({ brokenSiteBundle: true });

  const findings = await runReleaseAssetsSmokeCheck({ assetsDir: fixture.assetsDir });
  const ruleIds = findings.map((finding) => finding.ruleId);

  assert.ok(ruleIds.includes("release-site-bundle"));
});

test("release-assets-smoke-check CLI accepts pnpm-style separator", async () => {
  const fixture = await createReleaseAssetsFixture();
  const summaryPath = path.join(fixture.rootDir, "cli-smoke-summary.md");

  const { stdout } = await execFileAsync(process.execPath, [
    "--experimental-strip-types",
    SCRIPT_PATH,
    "--",
    "--dir",
    fixture.assetsDir,
    "--summary-out",
    summaryPath
  ]);

  assert.match(stdout, /Release asset smoke check passed/);
  assert.match(stdout, /Open `release-assets-summary\.md`, then the demo audit `share-summary\.md`, then `scorecard\.md`, then `recommendations\.md`\./);
  assert.match(await readFile(summaryPath, "utf8"), /Release asset smoke check passed/);
});

test("formatReleaseAssetsSmokeSummary preserves public boundaries", () => {
  const summary = formatReleaseAssetsSmokeSummary({
    assetsDir: "downloaded-assets",
    checkedAt: "2026-06-20T00:00:00.000Z",
    artifactReviewOrder: ["share-summary.md", "scorecard.md", "recommendations.md"],
    checks: ["verified demo bundle"]
  });

  assert.match(summary, /downloaded-assets/);
  assert.match(summary, /Release review path: Open `release-assets-summary\.md`, then the demo audit `share-summary\.md`, then `scorecard\.md`, then `recommendations\.md`\./);
  assert.match(summary, /share-summary\.md`, then `scorecard\.md`, then `recommendations\.md/);
  assert.match(summary, /npm view @answerlens\/cli/);
  assert.match(summary, /do not present npm as activated/);
  assert.match(summary, /raw provider payloads/);
});

async function createReleaseAssetsFixture(
  options: {
    brokenCliReadme?: boolean;
    brokenDemoBundle?: boolean;
    brokenReleaseSummaryMissingAdopterHandoff?: boolean;
    brokenReleaseSummaryMissingChecksumHeader?: boolean;
    brokenReleaseSummaryMissingCli?: boolean;
    brokenSiteBundle?: boolean;
    cliTarballInPackagesDir?: boolean;
  } = {}
): Promise<{ rootDir: string; assetsDir: string }> {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "answerlens-release-assets-smoke-"));
  const assetsDir = path.join(rootDir, "assets");
  const cliSource = path.join(rootDir, "cli-source");
  const demoSource = path.join(rootDir, "demo-source");
  const siteSource = path.join(rootDir, "site-source");

  await mkdir(assetsDir, { recursive: true });
  const cliTarballPath =
    options.cliTarballInPackagesDir === true
      ? path.join(assetsDir, "packages", "answerlens-cli-1.2.3.tgz")
      : path.join(assetsDir, "answerlens-cli-1.2.3.tgz");
  await mkdir(path.dirname(cliTarballPath), { recursive: true });
  await writeCliPackageFixture(path.join(cliSource, "package"), options.brokenCliReadme === true);
  await execFileAsync("tar", ["-czf", cliTarballPath, "-C", cliSource, "package"]);

  await writeDemoAuditFixture(path.join(demoSource, "runs", "static-good"), options.brokenDemoBundle === true);
  await execFileAsync("tar", ["-czf", path.join(assetsDir, "answerlens-demo-audit.tar.gz"), "-C", demoSource, "runs/static-good"]);

  await writeSiteFixture(path.join(siteSource, "dist", "site"), options.brokenSiteBundle === true);
  await execFileAsync("tar", ["-czf", path.join(assetsDir, "answerlens-site.tar.gz"), "-C", siteSource, "dist/site"]);

  const manifestPath = path.join(assetsDir, "release-assets-manifest.json");
  await runReleaseAssetsManifest({
    outPath: manifestPath,
    releaseTag: "v1.2.3",
    filePatterns: [
      cliTarballPath,
      path.join(assetsDir, "answerlens-demo-audit.tar.gz"),
      path.join(assetsDir, "answerlens-site.tar.gz")
    ]
  });
  await runReleaseAssetsManifest({
    outPath: manifestPath,
    verifyPath: manifestPath,
    summaryOutPath: path.join(assetsDir, "release-assets-summary.md"),
    releaseTag: "v1.2.3",
    filePatterns: []
  });
  if (options.brokenReleaseSummaryMissingCli === true) {
    await removeLinesContaining(path.join(assetsDir, "release-assets-summary.md"), "answerlens-cli-");
  }
  if (options.brokenReleaseSummaryMissingChecksumHeader === true) {
    await removeLinesContaining(path.join(assetsDir, "release-assets-summary.md"), "| Asset |");
    await removeLinesContaining(path.join(assetsDir, "release-assets-summary.md"), "| --- |");
  }
  if (options.brokenReleaseSummaryMissingAdopterHandoff === true) {
    await removeLinesContaining(path.join(assetsDir, "release-assets-summary.md"), "starter bundle");
    await removeLinesContaining(path.join(assetsDir, "release-assets-summary.md"), "first-run story template");
    await removeLinesContaining(path.join(assetsDir, "release-assets-summary.md"), "raw provider payloads");
  }

  return { rootDir, assetsDir };
}

async function removeLinesContaining(filePath: string, snippet: string): Promise<void> {
  const text = await readFile(filePath, "utf8");
  const filtered = text
    .split(/\r?\n/)
    .filter((line) => !line.includes(snippet))
    .join("\n");
  await writeFile(filePath, filtered.endsWith("\n") ? filtered : `${filtered}\n`, "utf8");
}

async function writeCliPackageFixture(packageDir: string, brokenReadme: boolean): Promise<void> {
  await mkdir(packageDir, { recursive: true });
  await writeFile(
    path.join(packageDir, "package.json"),
    JSON.stringify(
      {
        name: "@answerlens/cli",
        version: "1.2.3"
      },
      null,
      2
    ),
    "utf8"
  );
  await writeFile(
    path.join(packageDir, "README.md"),
    [
      "# AnswerLens CLI",
      "",
      "`@answerlens/cli` is the publish-ready package for AnswerLens.",
      brokenReadme ? "Run it with npx @answerlens/cli audit." : "Use the versioned release tarball for pinned local CLI runs before npm is visible.",
      "AnswerLens is a CLI-first AI visibility auditor for product websites."
    ].join("\n"),
    "utf8"
  );
}

async function writeDemoAuditFixture(outDir: string, broken: boolean): Promise<void> {
  await mkdir(outDir, { recursive: true });
  const artifacts = [
    "share-summary.md",
    "scorecard.md",
    "recommendations.md",
    "pr-snippet.md",
    "share-summary.json",
    "run.json",
    "index.html",
    "site-audit.json"
  ];
  const orderedText = "Open share-summary.md, then scorecard.md, then recommendations.md.";
  const shareBoundary = [
    orderedText,
    "AnswerLens starter bundle",
    "first-run story template",
    "Show and tell Discussion form",
    "raw provider payloads",
    "private analytics",
    "does not scrape consumer AI UIs",
    broken ? "ranking context omitted" : "does not guarantee answer-surface rankings"
  ].join("\n");

  await writeFile(path.join(outDir, "share-summary.md"), shareBoundary, "utf8");
  await writeFile(path.join(outDir, "scorecard.md"), orderedText, "utf8");
  await writeFile(path.join(outDir, "recommendations.md"), orderedText, "utf8");
  await writeFile(
    path.join(outDir, "pr-snippet.md"),
    [
      orderedText,
      "first-run story template",
      "Show and tell Discussion form",
      "raw provider payloads",
      "private analytics",
      "does not scrape consumer AI UIs",
      "does not guarantee answer-surface rankings"
    ].join("\n"),
    "utf8"
  );
  await writeFile(
    path.join(outDir, "share-summary.json"),
    JSON.stringify(
      {
        project: "AnswerLens",
        tagline: "CI for AI discoverability.",
        artifacts
      },
      null,
      2
    ),
    "utf8"
  );
  await writeFile(
    path.join(outDir, "run.json"),
    JSON.stringify(
      {
        kind: "audit",
        site: { baseUrl: "https://fixture.local" },
        artifacts
      },
      null,
      2
    ),
    "utf8"
  );
  await writeFile(path.join(outDir, "index.html"), `<html><body>${orderedText}</body></html>`, "utf8");
  await writeFile(path.join(outDir, "site-audit.json"), "{}\n", "utf8");
}

async function writeSiteFixture(siteRoot: string, broken: boolean): Promise<void> {
  await mkdir(siteRoot, { recursive: true });
  const releaseText = [
    "answerlens-demo-audit.tar.gz",
    "answerlens-site.tar.gz",
    "share-summary.md",
    "scorecard.md",
    "recommendations.md",
    "npm view @answerlens/cli"
  ].join("\n");
  const artifactText = "share-summary.md scorecard.md recommendations.md";
  await writeFile(path.join(siteRoot, "index.html"), "<html><body>AnswerLens</body></html>", "utf8");
  if (!broken) {
    await writeNestedFile(path.join(siteRoot, "en", "releases", "index.html"), releaseText);
  }
  await writeNestedFile(path.join(siteRoot, "zh", "releases", "index.html"), releaseText);
  await writeNestedFile(path.join(siteRoot, "examples", "static-good", "index.html"), artifactText);
  await writeNestedFile(path.join(siteRoot, "starter", "index.html"), artifactText);
}

async function writeNestedFile(filePath: string, body: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, body, "utf8");
}
