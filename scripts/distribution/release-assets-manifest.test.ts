import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runReleaseAssetsManifest } from "./release-assets-manifest.ts";

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
      releaseTag: "v1.2.3",
      filePatterns: []
    });

    const saved = JSON.parse(await readFile(manifestPath, "utf8")) as { assets: Array<{ sha256: string; sizeBytes: number }> };
    assert.equal(saved.assets[0]?.sha256.length, 64);
    assert.equal(saved.assets[0]?.sizeBytes, "cli tarball".length);
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
