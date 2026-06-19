import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

type ReleaseAsset = {
  name: string;
  path: string;
  sizeBytes: number;
  sha256: string;
};

type ReleaseAssetsManifest = {
  kind: "answerlens-release-assets-manifest";
  schemaVersion: 1;
  generatedAt: string;
  releaseTag: string | null;
  artifactReviewOrder: ["share-summary.md", "scorecard.md", "recommendations.md"];
  npmVisibilityBoundary: string;
  assets: ReleaseAsset[];
};

type Options = {
  outPath: string;
  verifyPath?: string;
  summaryOutPath?: string;
  releaseTag: string | null;
  filePatterns: string[];
};

const REQUIRED_ASSET_NAMES = ["answerlens-demo-audit.tar.gz", "answerlens-site.tar.gz"];
const CLI_TARBALL_PATTERN = /^answerlens-cli-.+\.tgz$/;
const NPM_VISIBILITY_BOUNDARY =
  "If npm view @answerlens/cli returns 404, use release assets or a local checkout; do not present npm as activated.";

function parseArgs(argv: string[]): Options {
  const filePatterns: string[] = [];
  let outPath = "dist/release-assets-manifest.json";
  let verifyPath: string | undefined;
  let summaryOutPath: string | undefined;
  let releaseTag = process.env.RELEASE_TAG?.trim() || null;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--") {
      continue;
    }
    if (token === "--out") {
      outPath = requiredValue(argv, index);
      index += 1;
      continue;
    }
    if (token === "--verify") {
      verifyPath = requiredValue(argv, index);
      index += 1;
      continue;
    }
    if (token === "--summary-out") {
      summaryOutPath = requiredValue(argv, index);
      index += 1;
      continue;
    }
    if (token === "--release-tag") {
      releaseTag = requiredValue(argv, index);
      index += 1;
      continue;
    }
    if (token.startsWith("--")) {
      throw new Error(`Unknown option: ${token}`);
    }
    filePatterns.push(token);
  }

  return { outPath, verifyPath, summaryOutPath, releaseTag, filePatterns };
}

function requiredValue(argv: string[], index: number): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${argv[index]}`);
  }
  return value;
}

async function buildManifest(options: Options): Promise<ReleaseAssetsManifest> {
  const files = await expandFilePatterns(options.filePatterns);
  if (files.length === 0) {
    throw new Error("No release assets matched the provided file patterns.");
  }

  const assets = await Promise.all(files.map((file) => assetForFile(file)));
  assets.sort((left, right) => left.name.localeCompare(right.name) || left.path.localeCompare(right.path));
  assertRequiredAssets(assets);

  return {
    kind: "answerlens-release-assets-manifest",
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    releaseTag: options.releaseTag,
    artifactReviewOrder: ["share-summary.md", "scorecard.md", "recommendations.md"],
    npmVisibilityBoundary: NPM_VISIBILITY_BOUNDARY,
    assets
  };
}

async function expandFilePatterns(patterns: string[]): Promise<string[]> {
  const files = new Set<string>();
  for (const pattern of patterns) {
    for (const file of await expandFilePattern(pattern)) {
      files.add(path.normalize(file));
    }
  }
  return [...files].sort();
}

async function expandFilePattern(pattern: string): Promise<string[]> {
  if (!pattern.includes("*")) {
    return [pattern];
  }

  const normalized = path.normalize(pattern);
  const directory = path.dirname(normalized);
  const basenamePattern = path.basename(normalized);
  const regex = globNameRegex(basenamePattern);
  const entries = await readdir(directory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && regex.test(entry.name))
    .map((entry) => path.join(directory, entry.name));
}

function globNameRegex(pattern: string): RegExp {
  const escaped = pattern
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${escaped}$`);
}

async function assetForFile(file: string): Promise<ReleaseAsset> {
  const stats = await stat(file);
  if (!stats.isFile()) {
    throw new Error(`Release asset is not a file: ${file}`);
  }

  const body = await readFile(file);
  return {
    name: path.basename(file),
    path: normalizePath(file),
    sizeBytes: stats.size,
    sha256: createHash("sha256").update(body).digest("hex")
  };
}

function assertRequiredAssets(assets: ReleaseAsset[]): void {
  const names = new Set(assets.map((asset) => asset.name));
  const missing = REQUIRED_ASSET_NAMES.filter((name) => !names.has(name));
  if (!assets.some((asset) => CLI_TARBALL_PATTERN.test(asset.name))) {
    missing.unshift("answerlens-cli-*.tgz");
  }
  if (missing.length > 0) {
    throw new Error(`Release asset manifest is missing required asset(s): ${missing.join(", ")}`);
  }
}

async function verifyManifest(manifestPath: string): Promise<ReleaseAssetsManifest> {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as ReleaseAssetsManifest;
  if (manifest.kind !== "answerlens-release-assets-manifest" || manifest.schemaVersion !== 1 || !Array.isArray(manifest.assets)) {
    throw new Error("Release asset manifest has an unsupported shape.");
  }
  if (
    JSON.stringify(manifest.artifactReviewOrder) !== JSON.stringify(["share-summary.md", "scorecard.md", "recommendations.md"]) ||
    !manifest.npmVisibilityBoundary.includes("do not present npm as activated")
  ) {
    throw new Error("Release asset manifest is missing the public review-order or npm-visibility boundary.");
  }

  assertRequiredAssets(manifest.assets);
  const manifestDir = path.dirname(manifestPath);
  for (const asset of manifest.assets) {
    const candidate = await resolveAssetPath(asset, manifestDir);
    const actual = await assetForFile(candidate);
    if (actual.sizeBytes !== asset.sizeBytes || actual.sha256 !== asset.sha256) {
      throw new Error(`Release asset checksum mismatch for ${asset.name}.`);
    }
  }
  return manifest;
}

async function resolveAssetPath(asset: ReleaseAsset, manifestDir: string): Promise<string> {
  const candidates = [asset.path, path.join(manifestDir, asset.name)];
  for (const candidate of candidates) {
    try {
      const stats = await stat(candidate);
      if (stats.isFile()) {
        return candidate;
      }
    } catch {
      // Try the next candidate.
    }
  }
  throw new Error(`Release asset listed in manifest is missing: ${asset.name}`);
}

function normalizePath(file: string): string {
  return path.relative(process.cwd(), path.resolve(file)).split(path.sep).join("/");
}

export async function runReleaseAssetsManifest(options: Options): Promise<ReleaseAssetsManifest | null> {
  if (options.verifyPath) {
    const manifest = await verifyManifest(options.verifyPath);
    if (options.summaryOutPath) {
      await writeFile(options.summaryOutPath, formatReleaseAssetsSummary(manifest), "utf8");
    }
    return null;
  }

  const manifest = await buildManifest(options);
  await writeFile(options.outPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  if (options.summaryOutPath) {
    await writeFile(options.summaryOutPath, formatReleaseAssetsSummary(manifest), "utf8");
  }
  return manifest;
}

export function formatReleaseAssetsSummary(manifest: ReleaseAssetsManifest): string {
  const releaseTag = manifest.releaseTag ? `\`${manifest.releaseTag}\`` : "not set";
  const rows = manifest.assets
    .map((asset) => `| \`${asset.name}\` | ${formatBytes(asset.sizeBytes)} | \`${asset.sha256}\` |`)
    .join("\n");

  return [
    "## Release asset manifest verified",
    "",
    `- Release tag: ${releaseTag}`,
    `- Review order: \`${manifest.artifactReviewOrder[0]}\`, then \`${manifest.artifactReviewOrder[1]}\`, then \`${manifest.artifactReviewOrder[2]}\``,
    `- npm boundary: ${manifest.npmVisibilityBoundary}`,
    "",
    "| Asset | Size | SHA-256 |",
    "| --- | ---: | --- |",
    rows,
    ""
  ].join("\n");
}

function formatBytes(sizeBytes: number): string {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }
  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KiB`;
  }
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MiB`;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const manifest = await runReleaseAssetsManifest(options);
  if (manifest) {
    console.log(`Release asset manifest written to ${options.outPath} with ${manifest.assets.length} asset(s).`);
  } else {
    console.log(`Release asset manifest verified: ${options.verifyPath}`);
  }
}

const isCliEntrypoint =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isCliEntrypoint) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
