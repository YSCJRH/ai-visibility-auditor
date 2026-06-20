import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { runReleaseAssetsManifest } from "./release-assets-manifest.ts";

const execFileAsync = promisify(execFile);
const SCRIPT_PATH = path.resolve("scripts/distribution/release-assets-manifest.ts");

test("release-assets-manifest writes and verifies release asset checksums", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "answerlens-release-assets-"));
  await mkdir(path.join(root, "dist", "packages"), { recursive: true });
  await writeFile(path.join(root, "dist", "packages", "answerlens-cli-1.2.3.tgz"), "cli tarball", "utf8");
  await writeFile(path.join(root, "dist", "answerlens-demo-audit.tar.gz"), "demo bundle", "utf8");
  await writeFile(path.join(root, "dist", "answerlens-site.tar.gz"), "site bundle", "utf8");

  const previousCwd = process.cwd();
  process.chdir(root);
  try {
    const manifestPath = path.join(root, "dist", "release-assets-manifest.json");
    const manifest = await runReleaseAssetsManifest({
      outPath: manifestPath,
      releaseTag: "v1.2.3",
      filePatterns: ["dist/packages/*.tgz", "dist/answerlens-demo-audit.tar.gz", "dist/answerlens-site.tar.gz"]
    });

    assert.equal(manifest?.kind, "answerlens-release-assets-manifest");
    assert.equal(manifest?.releaseTag, "v1.2.3");
    assert.deepEqual(manifest?.artifactReviewOrder, ["share-summary.md", "scorecard.md", "recommendations.md"]);
    assert.match(manifest?.npmVisibilityBoundary ?? "", /do not present npm as activated/);
    assert.deepEqual(
      manifest?.assets.map((asset) => asset.name),
      ["answerlens-cli-1.2.3.tgz", "answerlens-demo-audit.tar.gz", "answerlens-site.tar.gz"]
    );

    await runReleaseAssetsManifest({
      outPath: manifestPath,
      verifyPath: manifestPath,
      summaryOutPath: path.join(root, "dist", "release-assets-summary.md"),
      releaseTag: "v1.2.3",
      filePatterns: []
    });

    const saved = JSON.parse(await readFile(manifestPath, "utf8")) as { assets: Array<{ sha256: string; sizeBytes: number }> };
    assert.equal(saved.assets[0]?.sha256.length, 64);
    assert.equal(saved.assets[0]?.sizeBytes, "cli tarball".length);
    const summary = await readFile(path.join(root, "dist", "release-assets-summary.md"), "utf8");
    assert.match(summary, /## Release asset manifest verified/);
    assert.match(summary, /\| `answerlens-cli-1\.2\.3\.tgz` \| 11 B \| `[a-f0-9]{64}` \|/);
    assert.match(summary, /Review order: `share-summary\.md`, then `scorecard\.md`, then `recommendations\.md`/);
    assert.match(summary, /do not present npm as activated/);
  } finally {
    process.chdir(previousCwd);
  }
});

test("release-assets-manifest rejects missing required assets and checksum drift", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "answerlens-release-assets-bad-"));
  await mkdir(path.join(root, "dist", "packages"), { recursive: true });
  await writeFile(path.join(root, "dist", "packages", "answerlens-cli-1.2.3.tgz"), "cli tarball", "utf8");
  await writeFile(path.join(root, "dist", "answerlens-demo-audit.tar.gz"), "demo bundle", "utf8");

  const previousCwd = process.cwd();
  process.chdir(root);
  try {
    const manifestPath = path.join(root, "dist", "release-assets-manifest.json");
    await assert.rejects(
      runReleaseAssetsManifest({
        outPath: manifestPath,
        releaseTag: "v1.2.3",
        filePatterns: ["dist/packages/*.tgz", "dist/answerlens-demo-audit.tar.gz"]
      }),
      /answerlens-site\.tar\.gz/
    );

    await writeFile(path.join(root, "dist", "answerlens-site.tar.gz"), "site bundle", "utf8");
    await runReleaseAssetsManifest({
      outPath: manifestPath,
      releaseTag: "v1.2.3",
      filePatterns: ["dist/packages/*.tgz", "dist/answerlens-demo-audit.tar.gz", "dist/answerlens-site.tar.gz"]
    });
    await writeFile(path.join(root, "dist", "answerlens-site.tar.gz"), "tampered", "utf8");

    await assert.rejects(
      runReleaseAssetsManifest({
        outPath: manifestPath,
        verifyPath: manifestPath,
        releaseTag: "v1.2.3",
        filePatterns: []
      }),
      /checksum mismatch/
    );
  } finally {
    process.chdir(previousCwd);
  }
});

test("release-assets-manifest verifies downloaded assets next to the manifest before local build paths", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "answerlens-release-assets-download-"));
  await mkdir(path.join(root, "dist", "packages"), { recursive: true });
  await mkdir(path.join(root, "download"), { recursive: true });
  await writeFile(path.join(root, "dist", "packages", "answerlens-cli-1.2.3.tgz"), "downloaded cli tarball", "utf8");
  await writeFile(path.join(root, "dist", "answerlens-demo-audit.tar.gz"), "demo bundle", "utf8");
  await writeFile(path.join(root, "dist", "answerlens-site.tar.gz"), "site bundle", "utf8");

  const previousCwd = process.cwd();
  process.chdir(root);
  try {
    const manifestPath = path.join(root, "dist", "release-assets-manifest.json");
    await runReleaseAssetsManifest({
      outPath: manifestPath,
      releaseTag: "v1.2.3",
      filePatterns: ["dist/packages/*.tgz", "dist/answerlens-demo-audit.tar.gz", "dist/answerlens-site.tar.gz"]
    });

    await copyFile(manifestPath, path.join(root, "download", "release-assets-manifest.json"));
    await copyFile(path.join(root, "dist", "packages", "answerlens-cli-1.2.3.tgz"), path.join(root, "download", "answerlens-cli-1.2.3.tgz"));
    await copyFile(path.join(root, "dist", "answerlens-demo-audit.tar.gz"), path.join(root, "download", "answerlens-demo-audit.tar.gz"));
    await copyFile(path.join(root, "dist", "answerlens-site.tar.gz"), path.join(root, "download", "answerlens-site.tar.gz"));
    await writeFile(path.join(root, "dist", "packages", "answerlens-cli-1.2.3.tgz"), "stale local build tarball", "utf8");

    await runReleaseAssetsManifest({
      outPath: path.join(root, "download", "release-assets-manifest.json"),
      verifyPath: path.join(root, "download", "release-assets-manifest.json"),
      releaseTag: "v1.2.3",
      filePatterns: []
    });
  } finally {
    process.chdir(previousCwd);
  }
});

test("release-assets-manifest CLI accepts summary-out with pnpm-style separator", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "answerlens-release-assets-cli-"));
  await mkdir(path.join(root, "dist", "packages"), { recursive: true });
  await writeFile(path.join(root, "dist", "packages", "answerlens-cli-1.2.3.tgz"), "cli tarball", "utf8");
  await writeFile(path.join(root, "dist", "answerlens-demo-audit.tar.gz"), "demo bundle", "utf8");
  await writeFile(path.join(root, "dist", "answerlens-site.tar.gz"), "site bundle", "utf8");

  const previousCwd = process.cwd();
  process.chdir(root);
  try {
    await execFileAsync(process.execPath, [
      "--experimental-strip-types",
      SCRIPT_PATH,
      "--",
      "--out",
      "dist/release-assets-manifest.json",
      "--summary-out",
      "dist/release-assets-summary.md",
      "dist/packages/*.tgz",
      "dist/answerlens-demo-audit.tar.gz",
      "dist/answerlens-site.tar.gz"
    ]);

    const summary = await readFile(path.join(root, "dist", "release-assets-summary.md"), "utf8");
    assert.match(summary, /Release asset manifest verified/);
    assert.match(summary, /answerlens-cli-1\.2\.3\.tgz/);
  } finally {
    process.chdir(previousCwd);
  }
});
