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

  const filesToCheck = [
    "index.html",
    "en/index.html",
    "zh/index.html",
    "docs/index.html",
    "en/docs/index.html",
    "starter/index.html",
    "en/starter/index.html",
    "pricing/index.html",
    "en/pricing/index.html",
    "security/index.html",
    "en/security/index.html",
    "faq/index.html",
    "en/faq/index.html",
    "compare/index.html",
    "en/compare/index.html",
    "integrations/index.html",
    "en/integrations/index.html",
    "releases/index.html",
    "en/releases/index.html",
    "examples/index.html",
    "en/examples/index.html",
    "use-case/product-marketing/index.html",
    "en/use-case/product-marketing/index.html",
    "use-case/developer-advocacy/index.html",
    "en/use-case/developer-advocacy/index.html",
    "use-case/open-source-maintainers/index.html",
    "en/use-case/open-source-maintainers/index.html",
    "starter/example-run/share-summary.md",
    "zh/starter/example-run/share-summary.md",
    "examples/static-good/index.html",
    "zh/examples/static-good/index.html",
    "sitemap.xml",
    "feed.xml",
    "robots.txt"
  ].map((relativePath) => access(path.join(outDir, relativePath)));

  await Promise.all(filesToCheck);

  const load = (relativePath: string) => readFile(path.join(outDir, relativePath), "utf8");

  const [
    homeRedirect,
    home,
    zhHome,
    docsRedirect,
    docs,
    starterRedirect,
    starter,
    pricingRedirect,
    pricing,
    securityRedirect,
    security,
    faqRedirect,
    faq,
    compareRedirect,
    compare,
    integrationsRedirect,
    integrations,
    productMarketingRedirect,
    productMarketing,
    developerAdvocacyRedirect,
    developerAdvocacy,
    openSourceRedirect,
    openSource,
    releasesRedirect,
    releases,
    examplesRedirect,
    examples,
    demoReport,
    zhDemoReport,
    feed,
    sitemap
  ] = await Promise.all([
    load("index.html"),
    load("en/index.html"),
    load("zh/index.html"),
    load("docs/index.html"),
    load("en/docs/index.html"),
    load("starter/index.html"),
    load("en/starter/index.html"),
    load("pricing/index.html"),
    load("en/pricing/index.html"),
    load("security/index.html"),
    load("en/security/index.html"),
    load("faq/index.html"),
    load("en/faq/index.html"),
    load("compare/index.html"),
    load("en/compare/index.html"),
    load("integrations/index.html"),
    load("en/integrations/index.html"),
    load("use-case/product-marketing/index.html"),
    load("en/use-case/product-marketing/index.html"),
    load("use-case/developer-advocacy/index.html"),
    load("en/use-case/developer-advocacy/index.html"),
    load("use-case/open-source-maintainers/index.html"),
    load("en/use-case/open-source-maintainers/index.html"),
    load("releases/index.html"),
    load("en/releases/index.html"),
    load("examples/index.html"),
    load("en/examples/index.html"),
    load("examples/static-good/index.html"),
    load("zh/examples/static-good/index.html"),
    load("feed.xml"),
    load("sitemap.xml")
  ]);

  assert.match(homeRedirect, /window\.location\.replace/);
  assert.match(homeRedirect, /ai-visibility-auditor\/en\//);
  assert.match(homeRedirect, /ai-visibility-auditor\/zh\//);
  assert.match(home, /<link rel="canonical" href="https:\/\/yscjrh\.github\.io\/ai-visibility-auditor\/en\/"/);
  assert.match(home, /hreflang="zh-CN"/);
  assert.match(home, /assets\/social-preview\.png/);
  assert.match(home, /AnswerLens makes AI discoverability reviewable in GitHub\./);
  assert.match(home, /Recommended first-run path/);
  assert.match(home, /Public proof block/);
  assert.match(home, /AnswerLens static-good fixture demo/);
  assert.match(home, /examples\/static-good\/share-summary\.md/);
  assert.match(home, /Built by YSCJRH from repo-native docs, releases, and artifacts\./);
  assert.match(home, /Use the public funnel in this order/);
  assert.match(home, /Run the 60-second fixture demo/);
  assert.match(home, /5-minute real-site audit/);
  assert.match(home, /Add the GitHub Action/);
  assert.match(home, /SoftwareApplication/);
  assert.match(home, /Organization/);
  assert.match(zhHome, /zh\/examples\/static-good\/index\.html/);
  assert.match(zhHome, /locale-switcher/);

  for (const redirectPage of [
    docsRedirect,
    starterRedirect,
    pricingRedirect,
    securityRedirect,
    faqRedirect,
    compareRedirect,
    integrationsRedirect,
    productMarketingRedirect,
    developerAdvocacyRedirect,
    openSourceRedirect,
    releasesRedirect,
    examplesRedirect
  ]) {
    assert.match(redirectPage, /window\.location\.replace/);
  }

  assert.match(docs, /Activation plan/);
  assert.match(docs, /Proof page map/);
  assert.match(docs, /Starter bundle<\/a>: external-repo layout and artifact review order/);
  assert.match(starter, /Starter example run/);
  assert.match(starter, /Example Product public site/);
  assert.match(starter, /starter\/example-run\/share-summary\.md/);
  assert.match(pricing, /Pricing for AnswerLens is open-source, BYOK, and artifact-first\./);
  assert.match(pricing, /\$0 provider cost/);
  assert.match(security, /Security for AnswerLens starts with no hosted control plane\./);
  assert.match(security, /no consumer AI UI scraping/);
  assert.match(faq, /AnswerLens FAQ for new visitors and evaluators\./);
  assert.match(faq, /FAQPage/);
  assert.match(compare, /Profound/);
  assert.match(compare, /Peec AI/);
  assert.match(compare, /Otterly/);
  assert.match(integrations, /GitHub-native and artifact-backed/);
  assert.match(productMarketing, /AnswerLens for product marketing teams\./);
  assert.match(developerAdvocacy, /AnswerLens for developer advocacy teams\./);
  assert.match(openSource, /AnswerLens for open-source maintainers\./);
  assert.match(releases, /v0\.3\.0/);
  assert.match(releases, /Use the latest release/);
  assert.match(examples, /AnswerLens static-good fixture demo/);
  assert.match(examples, /What to do after the demo/);
  assert.match(demoReport, /AnswerLens static-good fixture demo/);
  assert.match(zhDemoReport, /AnswerLens/);
  assert.match(feed, /AnswerLens releases/);
  assert.match(sitemap, /https:\/\/yscjrh\.github\.io\/ai-visibility-auditor\/en\/examples\//);
  assert.match(sitemap, /https:\/\/yscjrh\.github\.io\/ai-visibility-auditor\/zh\/examples\//);
  assert.match(sitemap, /https:\/\/yscjrh\.github\.io\/ai-visibility-auditor\/en\/pricing\//);
  assert.match(sitemap, /https:\/\/yscjrh\.github\.io\/ai-visibility-auditor\/zh\/pricing\//);
  assert.doesNotMatch(home, /\/home\/runner\/work\//);
  assert.doesNotMatch(examples, /\/home\/runner\/work\//);
  assert.doesNotMatch(demoReport, /\/home\/runner\/work\//);
  assert.equal(home.includes("\uFFFD"), false);
  assert.equal(examples.includes("\uFFFD"), false);
  assert.equal(demoReport.includes("\uFFFD"), false);
  assert.equal(feed.includes("\uFFFD"), false);
});
