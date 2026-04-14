import test from "node:test";
import assert from "node:assert/strict";
import { access, mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildSite } from "./build-site.ts";

test("build-site writes indexable pages and metadata", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "answerlens-site-"));
  await buildSite({
    outDir,
    demoRunDir: "runs/static-good",
    releasesPath: "scripts/distribution/releases-snapshot.json"
  });

  await Promise.all([
    access(path.join(outDir, "index.html")),
    access(path.join(outDir, "docs", "index.html")),
    access(path.join(outDir, "releases", "index.html")),
    access(path.join(outDir, "examples", "index.html")),
    access(path.join(outDir, "playbooks", "index.html")),
    access(path.join(outDir, "sitemap.xml")),
    access(path.join(outDir, "feed.xml")),
    access(path.join(outDir, "robots.txt"))
  ]);

  const [home, examples, feed, sitemap] = await Promise.all([
    readFile(path.join(outDir, "index.html"), "utf8"),
    readFile(path.join(outDir, "examples", "index.html"), "utf8"),
    readFile(path.join(outDir, "feed.xml"), "utf8"),
    readFile(path.join(outDir, "sitemap.xml"), "utf8")
  ]);

  assert.match(home, /<link rel="canonical" href="https:\/\/yscjrh\.github\.io\/ai-visibility-auditor\/"/);
  assert.match(home, /twitter:card/);
  assert.match(home, /SoftwareApplication/);
  assert.match(home, /Organization/);
  assert.match(examples, /"@type":"Dataset"/);
  assert.match(feed, /AnswerLens releases/);
  assert.match(sitemap, /https:\/\/yscjrh\.github\.io\/ai-visibility-auditor\/examples\//);
  assert.doesNotMatch(home, /鈥/);
});
