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
    "zh/releases/index.html",
    "examples/index.html",
    "en/examples/index.html",
    "playbooks/index.html",
    "en/playbooks/index.html",
    "use-case/product-marketing/index.html",
    "en/use-case/product-marketing/index.html",
    "use-case/developer-advocacy/index.html",
    "en/use-case/developer-advocacy/index.html",
    "use-case/open-source-maintainers/index.html",
    "en/use-case/open-source-maintainers/index.html",
    "use-case/open-source-maintainer/index.html",
    "en/use-case/open-source-maintainer/index.html",
    "zh/use-case/open-source-maintainer/index.html",
    "use-cases/product-marketing/index.html",
    "en/use-cases/product-marketing/index.html",
    "zh/use-cases/product-marketing/index.html",
    "use-cases/developer-advocacy/index.html",
    "en/use-cases/developer-advocacy/index.html",
    "zh/use-cases/developer-advocacy/index.html",
    "use-cases/open-source-maintainers/index.html",
    "en/use-cases/open-source-maintainers/index.html",
    "zh/use-cases/open-source-maintainers/index.html",
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
    zhFaq,
    compareRedirect,
    compare,
    integrationsRedirect,
    integrations,
    zhIntegrations,
    productMarketingRedirect,
    productMarketing,
    developerAdvocacyRedirect,
    developerAdvocacy,
    openSourceRedirect,
    openSource,
    openSourceAliasRedirect,
    openSourceAliasEnRedirect,
    openSourceAliasZhRedirect,
    productMarketingPluralRedirect,
    developerAdvocacyPluralRedirect,
    openSourcePluralRedirect,
    openSourcePluralZhRedirect,
    releasesRedirect,
    releases,
    zhReleases,
    examplesRedirect,
    examples,
    playbooksRedirect,
    playbooks,
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
    load("zh/faq/index.html"),
    load("compare/index.html"),
    load("en/compare/index.html"),
    load("integrations/index.html"),
    load("en/integrations/index.html"),
    load("zh/integrations/index.html"),
    load("use-case/product-marketing/index.html"),
    load("en/use-case/product-marketing/index.html"),
    load("use-case/developer-advocacy/index.html"),
    load("en/use-case/developer-advocacy/index.html"),
    load("use-case/open-source-maintainers/index.html"),
    load("en/use-case/open-source-maintainers/index.html"),
    load("use-case/open-source-maintainer/index.html"),
    load("en/use-case/open-source-maintainer/index.html"),
    load("zh/use-case/open-source-maintainer/index.html"),
    load("use-cases/product-marketing/index.html"),
    load("use-cases/developer-advocacy/index.html"),
    load("use-cases/open-source-maintainers/index.html"),
    load("zh/use-cases/open-source-maintainers/index.html"),
    load("releases/index.html"),
    load("en/releases/index.html"),
    load("zh/releases/index.html"),
    load("examples/index.html"),
    load("en/examples/index.html"),
    load("playbooks/index.html"),
    load("en/playbooks/index.html"),
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
  assert.match(home, /<h1>AnswerLens<\/h1>/);
  assert.match(home, /productHero/);
  assert.match(home, /See the report once, then try it on your own site\./);
  assert.match(home, /Demo score/);
  assert.match(home, /First report/);
  assert.match(home, /Start here/);
  assert.match(home, /Report package/);
  assert.match(home, /ai-visibility-auditor\/en\/starter\/">CI setup<\/a>/);
  assert.match(home, /class="startBar"/);
  assert.match(home, /New here\? Open the demo report/);
  assert.match(home, /What the demo says right now/);
  assert.match(home, /AnswerLens static-good fixture demo/);
  assert.match(home, /examples\/static-good\/share-summary\.md/);
  assert.match(home, /Built by YSCJRH from repo docs, releases, and reports\./);
  assert.match(home, /Each audit gives your team three files to review\./);
  assert.match(home, /Run the sample-site demo/);
  assert.match(home, /Open quickstart/);
  assert.match(home, /Open Action docs/);
  assert.match(home, /SoftwareApplication/);
  assert.match(home, /Organization/);
  assert.match(home, /WebSite/);
  assert.match(home, /softwareVersion/);
  assert.match(home, /og:image:alt/);
  assert.match(home, /What it checks/);
  assert.match(home, /What it outputs/);
  assert.match(home, /Who should use it/);
  assert.match(zhHome, /zh\/examples\/static-good\/index\.html/);
  assert.match(zhHome, /locale-switcher/);
  assert.match(zhHome, /它检查什么/);
  assert.match(zhHome, /它输出什么/);
  assert.match(zhHome, /谁应该使用/);

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
    openSourceAliasRedirect,
    productMarketingPluralRedirect,
    developerAdvocacyPluralRedirect,
    openSourcePluralRedirect,
    openSourcePluralZhRedirect,
    releasesRedirect,
    examplesRedirect,
    playbooksRedirect
  ]) {
    assert.match(redirectPage, /window\.location\.replace/);
  }
  assert.match(openSourceAliasRedirect, /use-case\/open-source-maintainers\//);
  assert.match(openSourceAliasEnRedirect, /en\/use-case\/open-source-maintainers\//);
  assert.match(openSourceAliasZhRedirect, /zh\/use-case\/open-source-maintainers\//);
  assert.match(productMarketingPluralRedirect, /use-case\/product-marketing\//);
  assert.match(developerAdvocacyPluralRedirect, /use-case\/developer-advocacy\//);
  assert.match(openSourcePluralRedirect, /use-case\/open-source-maintainers\//);
  assert.match(openSourcePluralZhRedirect, /zh\/use-case\/open-source-maintainers\//);
  assert.match(playbooks, /aria-current="page">Fixes<\/a>/);
  assert.match(playbooks, /First visit/);
  assert.match(playbooks, /Run the 5-minute check on your site/);
  assert.match(zhFaq, /先看在线演示报告，再在本地跑示例站点演示/);
  assert.match(zhFaq, /查看对比/);
  assert.doesNotMatch(zhFaq, /Start with the 在线演示报告|对比 options|Compare options/);
  assert.match(zhIntegrations, /发布资源与 Pages 站点/);
  assert.match(zhIntegrations, /把演示输出和文档整理成可复用的公开页面与下载资源/);
  assert.doesNotMatch(zhIntegrations, /Release assets and Pages|Turns demo outputs|<th>Integration<\/th>|What it does/);

  assert.match(docs, /Activation plan/);
  assert.match(docs, /Find the doc that explains your score and decide the next fix\./);
  assert.match(docs, /When a report needs context/);
  assert.match(docs, /Read the result, then choose the next action\./);
  assert.match(docs, /Product page map/);
  assert.match(docs, /Starter bundle<\/a>: external-repo layout and report review order/);
  assert.match(docs, /Schema-text consistency/);
  assert.match(docs, /Evidence density/);
  assert.match(starter, /Add AnswerLens to another GitHub repository\./);
  assert.match(starter, /Start with one local audit, then add the workflow\./);
  assert.match(starter, /Copyable files/);
  assert.match(starter, /Starter example result/);
  assert.match(starter, /Example Product public site/);
  assert.match(starter, /runtime\.yaml/);
  assert.match(starter, /non-secret eval defaults/i);
  assert.match(starter, /YSCJRH\/ai-visibility-auditor@v0\.3\.2/);
  assert.match(starter, /starter\/example-run\/share-summary\.md/);
  assert.match(pricing, /AnswerLens is open source\. You bring the provider keys you choose\./);
  assert.match(pricing, /View starter/);
  assert.match(pricing, /\$0 provider cost/);
  assert.match(security, /Security for AnswerLens starts with no hosted control plane\./);
  assert.match(security, /Read manual steps/);
  assert.match(security, /no consumer AI UI scraping/);
  assert.match(faq, /AnswerLens FAQ for new visitors and evaluators\./);
  assert.match(faq, /Compare options/);
  assert.match(faq, /FAQPage/);
  assert.match(compare, /Profound/);
  assert.match(compare, /Peec AI/);
  assert.match(compare, /Otterly/);
  assert.match(compare, /Review pricing/);
  assert.match(integrations, /Connect AnswerLens where your team already reviews work/);
  assert.match(integrations, /Open Action docs/);
  assert.match(productMarketing, /AnswerLens for product marketing teams\./);
  assert.match(productMarketing, /Open playbooks/);
  assert.match(developerAdvocacy, /AnswerLens for developer advocacy teams\./);
  assert.match(developerAdvocacy, /View examples/);
  assert.match(openSource, /AnswerLens for open-source maintainers\./);
  assert.match(openSource, /Open releases/);
  assert.match(releases, /v0\.3\.0/);
  assert.match(releases, /Use the latest release/);
  assert.match(releases, /Open latest release/);
  assert.match(zhReleases, /打开 GitHub 发布页/);
  assert.match(zhReleases, /AnswerLens v0\.3\.2 延续/);
  assert.doesNotMatch(zhReleases, /What ships/);
  assert.doesNotMatch(zhReleases, /Known limits/);
  assert.match(examples, /AnswerLens static-good fixture demo/);
  assert.match(examples, /The demo report shows what your team will receive\./);
  assert.match(examples, /Demo report package/);
  assert.match(examples, /Open the report files in the order reviewers use\./);
  assert.match(examples, /What to do after the demo/);
  assert.match(examples, /Run the sample-site demo/);
  assert.match(playbooks, /After the report, fix one page issue\./);
  assert.match(playbooks, /Page fixes/);
  assert.match(playbooks, /View current fixes/);
  assert.match(playbooks, /Fix loop/);
  assert.match(playbooks, /Make one clear improvement at a time\./);
  assert.match(playbooks, /Latest fix list/);
  assert.match(playbooks, /Keep structured data aligned/);
  assert.match(demoReport, /AnswerLens static-good fixture demo/);
  assert.match(zhDemoReport, /AnswerLens/);
  assert.match(feed, /AnswerLens releases/);
  assert.match(sitemap, /https:\/\/yscjrh\.github\.io\/ai-visibility-auditor\/en\/examples\//);
  assert.match(sitemap, /https:\/\/yscjrh\.github\.io\/ai-visibility-auditor\/<\/loc>/);
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
