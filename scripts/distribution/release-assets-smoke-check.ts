import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { runDemoFixtureArtifactCheck } from "./demo-fixture-artifact-check.ts";
import { runReleaseAssetsManifest } from "./release-assets-manifest.ts";

export type ReleaseAssetsSmokeFinding = {
  ruleId: string;
  path: string;
  message: string;
};

export type ReleaseAssetsSmokeOptions = {
  assetsDir?: string;
  workDir?: string;
  keepWorkDir?: boolean;
  summaryOutPath?: string;
};

export type ReleaseAssetsSmokeSummary = {
  assetsDir: string;
  checkedAt: string;
  artifactReviewOrder: ["share-summary.md", "scorecard.md", "recommendations.md"];
  checks: string[];
};

const execFileAsync = promisify(execFile);

const REQUIRED_ASSET_FILES = [
  "answerlens-demo-audit.tar.gz",
  "answerlens-site.tar.gz",
  "release-assets-manifest.json",
  "release-assets-summary.md"
] as const;

const SITE_ENTRYPOINTS = [
  {
    path: "index.html",
    snippets: ["AnswerLens"]
  },
  {
    path: "en/releases/index.html",
    snippets: [
      "answerlens-demo-audit.tar.gz",
      "answerlens-site.tar.gz",
      "share-summary.md",
      "scorecard.md",
      "recommendations.md",
      "npm view @answerlens/cli"
    ]
  },
  {
    path: "zh/releases/index.html",
    snippets: [
      "answerlens-demo-audit.tar.gz",
      "answerlens-site.tar.gz",
      "share-summary.md",
      "scorecard.md",
      "recommendations.md"
    ]
  },
  {
    path: "examples/static-good/index.html",
    snippets: ["share-summary.md", "scorecard.md", "recommendations.md"]
  }
] as const;

export async function runReleaseAssetsSmokeCheck(
  options: ReleaseAssetsSmokeOptions = {}
): Promise<ReleaseAssetsSmokeFinding[]> {
  const assetsDir = path.resolve(options.assetsDir ?? "dist");
  const findings: ReleaseAssetsSmokeFinding[] = [];

  for (const file of REQUIRED_ASSET_FILES) {
    await requireFile(path.join(assetsDir, file), "release-asset-file", findings);
  }
  await requireCliTarball(assetsDir, findings);

  await verifyManifest(assetsDir, findings);
  await verifySummary(assetsDir, findings);

  const workDir = options.workDir
    ? path.resolve(options.workDir)
    : await mkdtemp(path.join(os.tmpdir(), "answerlens-release-assets-smoke-"));
  const shouldCleanup = !options.keepWorkDir;

  try {
    await verifyDemoAuditBundle(assetsDir, workDir, findings);
    await verifySiteBundle(assetsDir, workDir, findings);
  } finally {
    if (shouldCleanup) {
      await rm(workDir, { recursive: true, force: true });
    }
  }

  if (options.summaryOutPath && findings.length === 0) {
    const summaryPath = path.resolve(options.summaryOutPath);
    await mkdir(path.dirname(summaryPath), { recursive: true });
    await writeFile(summaryPath, formatReleaseAssetsSmokeSummary(buildSmokeSummary(assetsDir)), "utf8");
  }

  return findings;
}

function buildSmokeSummary(assetsDir: string): ReleaseAssetsSmokeSummary {
  return {
    assetsDir: displayPath(assetsDir),
    checkedAt: new Date().toISOString(),
    artifactReviewOrder: ["share-summary.md", "scorecard.md", "recommendations.md"],
    checks: [
      "verified release-assets-manifest.json checksums against downloaded files",
      "checked release-assets-summary.md boundary text",
      "unpacked answerlens-demo-audit.tar.gz and validated the first-run packet",
      "checked answerlens-site.tar.gz release and demo entrypoints",
      "confirmed a versioned answerlens-cli-*.tgz is present for pinned local CLI runs while npm is not visible"
    ]
  };
}

export function formatReleaseAssetsSmokeSummary(summary: ReleaseAssetsSmokeSummary): string {
  return [
    "## Release asset smoke check passed",
    "",
    `- Assets directory: \`${summary.assetsDir}\``,
    `- Checked at: ${summary.checkedAt}`,
    `- Review order: \`${summary.artifactReviewOrder[0]}\`, then \`${summary.artifactReviewOrder[1]}\`, then \`${summary.artifactReviewOrder[2]}\``,
    "- npm boundary: if `npm view @answerlens/cli` returns `404`, keep release assets or a local checkout as the public path; do not present npm as activated.",
    "- Public sharing boundary: do not attach raw provider payloads to public release reviews, PRs, issues, or Discussions.",
    "",
    "| Check | Result |",
    "| --- | --- |",
    ...summary.checks.map((check) => `| ${check} | pass |`),
    ""
  ].join("\n");
}

async function requireFile(filePath: string, ruleId: string, findings: ReleaseAssetsSmokeFinding[]): Promise<boolean> {
  try {
    const stats = await stat(filePath);
    if (stats.isFile()) {
      return true;
    }
  } catch {
    // Report below.
  }

  findings.push({
    ruleId,
    path: displayPath(filePath),
    message: "Release asset smoke check requires this downloaded file."
  });
  return false;
}

async function requireCliTarball(assetsDir: string, findings: ReleaseAssetsSmokeFinding[]): Promise<void> {
  const directories = [assetsDir, path.join(assetsDir, "packages")];
  try {
    for (const directory of directories) {
      const entries = await readdir(directory, { withFileTypes: true });
      if (entries.some((entry) => entry.isFile() && /^answerlens-cli-.+\.tgz$/.test(entry.name))) {
        return;
      }
    }
  } catch {
    // Fall through to one targeted missing-CLI finding.
  }

  findings.push({
    ruleId: "release-asset-file",
    path: displayPath(path.join(assetsDir, "answerlens-cli-*.tgz")),
    message: "Downloaded release assets must include the versioned CLI tarball."
  });
}

async function verifyManifest(assetsDir: string, findings: ReleaseAssetsSmokeFinding[]): Promise<void> {
  const manifestPath = path.join(assetsDir, "release-assets-manifest.json");
  try {
    await runReleaseAssetsManifest({
      outPath: manifestPath,
      verifyPath: manifestPath,
      releaseTag: null,
      filePatterns: []
    });
  } catch (error) {
    findings.push({
      ruleId: "release-asset-manifest",
      path: displayPath(manifestPath),
      message: `Unable to verify release asset manifest checksums: ${errorMessage(error)}`
    });
  }
}

async function verifySummary(assetsDir: string, findings: ReleaseAssetsSmokeFinding[]): Promise<void> {
  const summaryPath = path.join(assetsDir, "release-assets-summary.md");
  let summary: string;
  try {
    summary = await readFile(summaryPath, "utf8");
  } catch (error) {
    findings.push({
      ruleId: "release-asset-summary",
      path: displayPath(summaryPath),
      message: `Unable to read release asset summary: ${errorMessage(error)}`
    });
    return;
  }

  for (const snippet of [
    "Release asset manifest verified",
    "Review order: `share-summary.md`, then `scorecard.md`, then `recommendations.md`",
    "do not present npm as activated",
    "answerlens-demo-audit.tar.gz",
    "answerlens-site.tar.gz"
  ]) {
    if (!summary.includes(snippet)) {
      findings.push({
        ruleId: "release-asset-summary",
        path: displayPath(summaryPath),
        message: `Release asset summary is missing expected public review text: ${snippet}`
      });
    }
  }
}

async function verifyDemoAuditBundle(
  assetsDir: string,
  workDir: string,
  findings: ReleaseAssetsSmokeFinding[]
): Promise<void> {
  const bundlePath = path.join(assetsDir, "answerlens-demo-audit.tar.gz");
  const extractDir = path.join(workDir, "demo-audit");
  if (!(await extractTarball(bundlePath, extractDir, "release-demo-audit-bundle", findings))) {
    return;
  }

  const demoFindings = await runDemoFixtureArtifactCheck({
    rootDir: extractDir,
    outDir: "runs/static-good"
  });
  for (const finding of demoFindings) {
    findings.push({
      ruleId: `release-${finding.ruleId}`,
      path: `${displayPath(bundlePath)}:${finding.path}`,
      message: finding.message
    });
  }
}

async function verifySiteBundle(
  assetsDir: string,
  workDir: string,
  findings: ReleaseAssetsSmokeFinding[]
): Promise<void> {
  const bundlePath = path.join(assetsDir, "answerlens-site.tar.gz");
  const extractDir = path.join(workDir, "site");
  if (!(await extractTarball(bundlePath, extractDir, "release-site-bundle", findings))) {
    return;
  }

  const siteRoot = await findSiteRoot(extractDir);
  if (!siteRoot) {
    findings.push({
      ruleId: "release-site-bundle",
      path: displayPath(bundlePath),
      message: "Compiled site bundle must contain dist/site with public Pages entrypoints."
    });
    return;
  }

  for (const entrypoint of SITE_ENTRYPOINTS) {
    const filePath = path.join(siteRoot, entrypoint.path);
    let body: string;
    try {
      body = await readFile(filePath, "utf8");
    } catch (error) {
      findings.push({
        ruleId: "release-site-bundle",
        path: displayPath(filePath),
        message: `Unable to read compiled site entrypoint: ${errorMessage(error)}`
      });
      continue;
    }

    for (const snippet of entrypoint.snippets) {
      if (!body.includes(snippet)) {
        findings.push({
          ruleId: "release-site-bundle",
          path: displayPath(filePath),
          message: `Compiled site entrypoint is missing expected release/adoption text: ${snippet}`
        });
      }
    }
  }
}

async function extractTarball(
  tarballPath: string,
  extractDir: string,
  ruleId: string,
  findings: ReleaseAssetsSmokeFinding[]
): Promise<boolean> {
  if (!(await requireFile(tarballPath, ruleId, findings))) {
    return false;
  }

  let entries: string[];
  try {
    const listing = await execFileAsync("tar", ["-tzf", tarballPath], { maxBuffer: 16 * 1024 * 1024 });
    entries = listing.stdout.split(/\r?\n/).filter(Boolean);
  } catch (error) {
    findings.push({
      ruleId,
      path: displayPath(tarballPath),
      message: `Unable to list tarball contents: ${errorMessage(error)}`
    });
    return false;
  }

  const unsafeEntry = entries.find((entry) => isUnsafeTarEntry(entry));
  if (unsafeEntry) {
    findings.push({
      ruleId,
      path: displayPath(tarballPath),
      message: `Tarball contains an unsafe path: ${unsafeEntry}`
    });
    return false;
  }

  try {
    await mkdir(extractDir, { recursive: true });
    await execFileAsync("tar", ["-xzf", tarballPath, "-C", extractDir], { maxBuffer: 16 * 1024 * 1024 });
    return true;
  } catch (error) {
    findings.push({
      ruleId,
      path: displayPath(tarballPath),
      message: `Unable to extract tarball: ${errorMessage(error)}`
    });
    return false;
  }
}

function isUnsafeTarEntry(entry: string): boolean {
  return (
    path.isAbsolute(entry) ||
    /^[A-Za-z]:/.test(entry) ||
    entry.startsWith("\\\\") ||
    entry.split(/[\\/]+/).includes("..")
  );
}

async function findSiteRoot(extractDir: string): Promise<string | null> {
  const candidates = [path.join(extractDir, "dist", "site"), path.join(extractDir, "site"), extractDir];
  for (const candidate of candidates) {
    try {
      const stats = await stat(path.join(candidate, "index.html"));
      if (stats.isFile()) {
        return candidate;
      }
    } catch {
      // Try the next likely archive shape.
    }
  }
  return null;
}

function displayPath(filePath: string): string {
  return path.relative(process.cwd(), path.resolve(filePath)).split(path.sep).join("/");
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function parseArgs(argv: string[]): ReleaseAssetsSmokeOptions {
  const options: ReleaseAssetsSmokeOptions = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--") {
      continue;
    }
    if (token === "--dir" || token === "--assets-dir") {
      options.assetsDir = requiredValue(argv, index);
      index += 1;
      continue;
    }
    if (token === "--work-dir") {
      options.workDir = requiredValue(argv, index);
      index += 1;
      continue;
    }
    if (token === "--summary-out") {
      options.summaryOutPath = requiredValue(argv, index);
      index += 1;
      continue;
    }
    if (token === "--keep-work-dir") {
      options.keepWorkDir = true;
      continue;
    }
    if (token === "--help" || token === "-h") {
      console.log(
        "Usage: node --experimental-strip-types scripts/distribution/release-assets-smoke-check.ts --dir <downloaded-assets-dir> [--summary-out release-assets-smoke-summary.md]"
      );
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  return options;
}

function requiredValue(argv: string[], index: number): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${argv[index]} requires a value`);
  }
  return value;
}

async function main(): Promise<void> {
  const findings = await runReleaseAssetsSmokeCheck(parseArgs(process.argv.slice(2)));
  if (findings.length === 0) {
    console.log("Release asset smoke check passed. Open release-assets-summary.md, then the demo audit share-summary.md, scorecard.md, and recommendations.md.");
    return;
  }

  console.error(`Release asset smoke check failed with ${findings.length} finding(s).`);
  for (const finding of findings) {
    console.error(`- ${finding.ruleId} (${finding.path}): ${finding.message}`);
  }
  process.exitCode = 1;
}

const isCliEntrypoint =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isCliEntrypoint) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
