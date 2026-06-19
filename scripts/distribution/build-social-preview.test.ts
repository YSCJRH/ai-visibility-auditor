import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildSocialPreview } from "./build-social-preview.ts";

test("build-social-preview renders a 1280x640 PNG", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "answerlens-social-preview-"));
  const outputPath = path.join(outDir, "social-preview.png");
  const sourceSvg = await readFile(path.resolve("assets/social-preview.svg"), "utf8");

  assert.match(sourceSvg, /Review packet/);
  assert.match(sourceSvg, /share-summary\.md[\s\S]*scorecard\.md[\s\S]*recommendations\.md/);
  assert.match(sourceSvg, /pr-snippet\.md/);
  assert.match(sourceSvg, /first-run story/);

  await buildSocialPreview({ outputPath });

  const png = await readFile(outputPath);
  assert.equal(png.toString("ascii", 1, 4), "PNG");
  assert.equal(png.readUInt32BE(16), 1280);
  assert.equal(png.readUInt32BE(20), 640);
  assert.ok(png.byteLength > 8_000);
});
