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
  audit.site = {
    ...audit.site,
    input: "/home/runner/work/ai-visibility-auditor/ai-visibility-auditor/examples/fixtures/static-good"
  };

  const demoRunDir = await mkdtemp(path.join(os.tmpdir(), "answerlens-demo-run-"));
  await writeAuditOutputs(demoRunDir, audit);
  return demoRunDir;
}

async function createConsumerRun(): Promise<string> {
  const [brand, competitors, prompts] = await Promise.all([
    loadBrandConfig(path.resolve("examples/consumer-repo/.github/answerlens/brand.yaml")),
    loadCompetitorsConfig(path.resolve("examples/consumer-repo/.github/answerlens/competitors.yaml")),
    loadPromptsConfig(path.resolve("examples/consumer-repo/.github/answerlens/prompts.yaml"))
  ]);

  const audit = await runAudit({
    siteInput: "./examples/fixtures/static-good",
    brand,
    competitors,
    prompts
  });

  const consumerRunDir = await mkdtemp(path.join(os.tmpdir(), "answerlens-consumer-run-"));
  await writeAuditOutputs(consumerRunDir, audit);
  return consumerRunDir;
}

test("build-site writes indexable pages and metadata", async () => {
  const [demoRunDir, consumerRunDir, outDir] = await Promise.all([
    createDemoRun(),
    createConsumerRun(),
    mkdtemp(path.join(os.tmpdir(), "answerlens-site-"))
  ]);

  await buildSite({
    outDir,
    demoRunDir,
    consumerRunDir,
    releasesPath: path.resolve("scripts/distribution/releases-snapshot.json")
  });

  await Promise.all([
    access(path.join(outDir, "index.html")),
    access(path.join(outDir, "docs", "index.html")),
    access(path.join(outDir, "starter", "index.html")),
    access(path.join(outDir, "starter", "example-run", "share-summary.md")),
    access(path.join(outDir, "pricing", "index.html")),
    access(path.join(outDir, "security", "index.html")),
    access(path.join(outDir, "faq", "index.html")),
    access(path.join(outDir, "compare", "index.html")),
    access(path.join(outDir, "integrations", "index.html")),
    access(path.join(outDir, "releases", "index.html")),
    access(path.join(outDir, "examples", "index.html")),
    access(path.join(outDir, "playbooks", "index.html")),
    access(path.join(outDir, "use-case", "product-marketing", "index.html")),
    access(path.join(outDir, "use-case", "developer-advocacy", "index.html")),
    access(path.join(outDir, "use-case", "open-source-maintainers", "index.html")),
    access(path.join(outDir, "sitemap.xml")),
    access(path.join(outDir, "feed.xml")),
    access(path.join(outDir, "robots.txt"))
  ]);

  const [home, docs, starter, pricing, security, faq, compare, integrations, productMarketing, developerAdvocacy, openSource, releases, examples, demoReport, feed, sitemap] = await Promise.all([
    readFile(path.join(outDir, "index.html"), "utf8"),
    readFile(path.join(outDir, "docs", "index.html"), "utf8"),
    readFile(path.join(outDir, "starter", "index.html"), "utf8"),
    readFile(path.join(outDir, "pricing", "index.html"), "utf8"),
    readFile(path.join(outDir, "security", "index.html"), "utf8"),
    readFile(path.join(outDir, "faq", "index.html"), "utf8"),
    readFile(path.join(outDir, "compare", "index.html"), "utf8"),
    readFile(path.join(outDir, "integrations", "index.html"), "utf8"),
    readFile(path.join(outDir, "use-case", "product-marketing", "index.html"), "utf8"),
    readFile(path.join(outDir, "use-case", "developer-advocacy", "index.html"), "utf8"),
    readFile(path.join(outDir, "use-case", "open-source-maintainers", "index.html"), "utf8"),
    readFile(path.join(outDir, "releases", "index.html"), "utf8"),
    readFile(path.join(outDir, "examples", "index.html"), "utf8"),
    readFile(path.join(outDir, "examples", "static-good", "index.html"), "utf8"),
    readFile(path.join(outDir, "feed.xml"), "utf8"),
    readFile(path.join(outDir, "sitemap.xml"), "utf8")
  ]);

  assert.match(home, /<link rel="canonical" href="https:\/\/yscjrh\.github\.io\/ai-visibility-auditor\/"/);
  assert.match(home, /assets\/social-preview\.png/);
  assert.match(home, /<title>AI visibility audit reports and demo entry points \| AnswerLens<\/title>/);
  assert.match(home, /AnswerLens makes AI discoverability reviewable in GitHub\./);
  assert.match(home, /latestRelease<\/p><p class="metric-value">v0\.3\.0/);
  assert.match(home, /Recommended first-run path/);
  assert.match(home, /Public proof block/);
  assert.match(home, /AnswerLens static-good fixture demo/);
  assert.match(home, /stable hostname inside the public demo fixture/);
  assert.match(home, /examples\/static-good\/share-summary\.md/);
  assert.match(home, /Public proof pages/);
  assert.match(home, /pricing\/"/);
  assert.match(home, /security\/"/);
  assert.match(home, /faq\/"/);
  assert.match(home, /compare\/"/);
  assert.match(home, /integrations\/"/);
  assert.match(home, /starter\/"/);
  assert.match(home, /use-case\/product-marketing\/"/);
  assert.match(home, /Built by YSCJRH from repo-native docs, releases, and artifacts\./);
  assert.match(home, /Use the public funnel in this order/);
  assert.match(home, /Run the 60-second fixture demo/);
  assert.match(home, /5-minute real-site audit/);
  assert.match(home, /Add the GitHub Action/);
  assert.match(home, /twitter:card/);
  assert.match(home, /SoftwareApplication/);
  assert.match(home, /Organization/);
  assert.match(docs, /Activation plan/);
  assert.match(docs, /<title>Docs index, concepts, and activation references \| AnswerLens<\/title>/);
  assert.match(docs, /AnswerLens docs stay in Markdown and compile to an indexable layer\./);
  assert.match(docs, /Growth plan/);
  assert.match(docs, /Self-dogfooding/);
  assert.match(docs, /Quickstart/);
  assert.match(docs, /Starter bundle/);
  assert.match(docs, /Proof page map/);
  assert.match(docs, /Starter bundle<\/a>: external-repo layout and artifact review order/);
  assert.match(docs, /Compare<\/a>: how AnswerLens differs from Profound, Peec AI, and Otterly/);
  assert.match(starter, /<title>Starter bundle for external GitHub repositories \| AnswerLens<\/title>/);
  assert.match(starter, /The starter bundle is the public adoption asset for external repositories\./);
  assert.match(starter, /\.github\//);
  assert.match(starter, /brand\.yaml/);
  assert.match(starter, /Starter example run/);
  assert.match(starter, /Example Product public site/);
  assert.match(starter, /starter\/example-run\/share-summary\.md/);
  assert.match(starter, /scorecard\.md/);
  assert.match(starter, /examples\/consumer-repo/);
  assert.match(pricing, /Pricing for AnswerLens is open-source, BYOK, and artifact-first\./);
  assert.match(pricing, /\$0 provider cost/);
  assert.match(pricing, /@answerlens\/cli/);
  assert.match(security, /Security for AnswerLens starts with no hosted control plane\./);
  assert.match(security, /no consumer AI UI scraping/);
  assert.match(faq, /AnswerLens FAQ for new visitors and evaluators\./);
  assert.match(faq, /FAQPage/);
  assert.match(faq, /Related proof pages/);
  assert.match(faq, /Compare<\/a>: understand how AnswerLens differs from Profound, Peec AI, and Otterly/);
  assert.match(compare, /Profound/);
  assert.match(compare, /Peec AI/);
  assert.match(compare, /Otterly/);
  assert.match(compare, /Compared with Profound, Peec AI, and Otterly, AnswerLens fits teams/);
  assert.match(compare, /Related proof pages/);
  assert.match(integrations, /GitHub-native and artifact-backed/);
  assert.match(integrations, /The external-repo path is public and copyable/);
  assert.match(integrations, /starter\/"/);
  assert.match(integrations, /Related proof pages/);
  assert.match(productMarketing, /AnswerLens for product marketing teams\./);
  assert.match(productMarketing, /Related proof pages/);
  assert.match(developerAdvocacy, /AnswerLens for developer advocacy teams\./);
  assert.match(developerAdvocacy, /Related proof pages/);
  assert.match(openSource, /AnswerLens for open-source maintainers\./);
  assert.match(openSource, /Related proof pages/);
  assert.match(releases, /v0\.3\.0/);
  assert.match(releases, /<title>Release notes and downloadable distribution assets \| AnswerLens<\/title>/);
  assert.match(releases, /Use the latest release/);
  assert.match(releases, /Run the 60-second fixture demo/);
  assert.match(examples, /<title>Demo report artifacts and fixture outputs \| AnswerLens<\/title>/);
  assert.match(examples, /"@type":"Dataset"/);
  assert.match(examples, /AnswerLens static-good fixture demo/);
  assert.match(examples, /What to do after the demo/);
  assert.match(examples, /Open the starter bundle overview/);
  assert.match(examples, /Add the GitHub Action/);
  assert.doesNotMatch(home, /\/home\/runner\/work\//);
  assert.doesNotMatch(examples, /\/home\/runner\/work\//);
  assert.doesNotMatch(demoReport, /\/home\/runner\/work\//);
  assert.match(demoReport, /AnswerLens static-good fixture demo/);
  assert.match(feed, /AnswerLens releases/);
  assert.match(sitemap, /https:\/\/yscjrh\.github\.io\/ai-visibility-auditor\/examples\//);
  assert.match(sitemap, /https:\/\/yscjrh\.github\.io\/ai-visibility-auditor\/pricing\//);
  assert.match(sitemap, /https:\/\/yscjrh\.github\.io\/ai-visibility-auditor\/security\//);
  assert.match(sitemap, /https:\/\/yscjrh\.github\.io\/ai-visibility-auditor\/faq\//);
  assert.match(sitemap, /https:\/\/yscjrh\.github\.io\/ai-visibility-auditor\/compare\//);
  assert.match(sitemap, /https:\/\/yscjrh\.github\.io\/ai-visibility-auditor\/integrations\//);
  assert.match(sitemap, /https:\/\/yscjrh\.github\.io\/ai-visibility-auditor\/starter\//);
  assert.match(sitemap, /https:\/\/yscjrh\.github\.io\/ai-visibility-auditor\/use-case\/product-marketing\//);
  assert.equal(home.includes("\uFFFD"), false);
  assert.equal(examples.includes("\uFFFD"), false);
  assert.equal(demoReport.includes("\uFFFD"), false);
  assert.equal(feed.includes("\uFFFD"), false);
});
