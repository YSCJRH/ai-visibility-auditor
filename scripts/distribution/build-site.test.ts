import test from "node:test";
import assert from "node:assert/strict";
import { access, mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadBrandConfig, loadCompetitorsConfig, loadPromptsConfig, runAudit } from "../../packages/core/src/index.ts";
import { writeAuditOutputs } from "../../packages/report/src/index.ts";
import { buildSite } from "./build-site.ts";

async function createDemoRun(): Promise<string> {
  const [brand, competitors, prompts] = await Promise.all([
    loadBrandConfig(path.resolve("examples/acme/brand.yaml")),
    loadCompetitorsConfig(path.resolve("examples/acme/competitors.yaml")),
    loadPromptsConfig(path.resolve("examples/acme/prompts.yaml"))
  ]);

  const audit = await runAudit({
    siteInput: "./examples/fixtures/static-good",
    brand,
    competitors,
    prompts
  });

  const demoRunDir = await mkdtemp(path.join(os.tmpdir(), "answerlens-demo-run-"));
  await writeAuditOutputs(demoRunDir, audit);
  return demoRunDir;
}

test("build-site writes indexable pages and metadata", async () => {
  const [demoRunDir, outDir] = await Promise.all([
    createDemoRun(),
    mkdtemp(path.join(os.tmpdir(), "answerlens-site-"))
  ]);

  await buildSite({
    outDir,
    demoRunDir,
    releasesPath: path.resolve("scripts/distribution/releases-snapshot.json")
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

  const [home, docs, releases, examples, feed, sitemap] = await Promise.all([
    readFile(path.join(outDir, "index.html"), "utf8"),
    readFile(path.join(outDir, "docs", "index.html"), "utf8"),
    readFile(path.join(outDir, "releases", "index.html"), "utf8"),
    readFile(path.join(outDir, "examples", "index.html"), "utf8"),
    readFile(path.join(outDir, "feed.xml"), "utf8"),
    readFile(path.join(outDir, "sitemap.xml"), "utf8")
  ]);

  assert.match(home, /<link rel="canonical" href="https:\/\/yscjrh\.github\.io\/ai-visibility-auditor\/"/);
  assert.match(home, /assets\/social-preview\.png/);
  assert.match(home, /latestRelease<\/p><p class="metric-value">v0\.3\.0/);
  assert.match(home, /Recommended first-run path/);
  assert.match(home, /5-minute real-site audit/);
  assert.match(home, /twitter:card/);
  assert.match(home, /SoftwareApplication/);
  assert.match(home, /Organization/);
  assert.match(docs, /Activation plan/);
  assert.match(docs, /Quickstart/);
  assert.match(releases, /v0\.3\.0/);
  assert.match(releases, /Use the latest release/);
  assert.match(examples, /"@type":"Dataset"/);
  assert.match(feed, /AnswerLens releases/);
  assert.match(sitemap, /https:\/\/yscjrh\.github\.io\/ai-visibility-auditor\/examples\//);
  assert.equal(home.includes("\uFFFD"), false);
  assert.equal(feed.includes("\uFFFD"), false);
});
