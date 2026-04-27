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
    "zh/docs/index.html",
    "starter/index.html",
    "en/starter/index.html",
    "zh/starter/index.html",
    "pricing/index.html",
    "en/pricing/index.html",
    "security/index.html",
    "en/security/index.html",
    "faq/index.html",
    "en/faq/index.html",
    "compare/index.html",
    "en/compare/index.html",
    "zh/compare/index.html",
    "integrations/index.html",
    "en/integrations/index.html",
    "zh/integrations/index.html",
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
    "zh/use-case/developer-advocacy/index.html",
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
    zhDocs,
    starterRedirect,
    starter,
    zhStarter,
    pricingRedirect,
    pricing,
    zhPricing,
    securityRedirect,
    security,
    zhSecurity,
    faqRedirect,
    faq,
    zhFaq,
    compareRedirect,
    compare,
    zhCompare,
    integrationsRedirect,
    integrations,
    zhIntegrations,
    productMarketingRedirect,
    productMarketing,
    developerAdvocacyRedirect,
    developerAdvocacy,
    zhDeveloperAdvocacy,
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
    load("zh/docs/index.html"),
    load("starter/index.html"),
    load("en/starter/index.html"),
    load("zh/starter/index.html"),
    load("pricing/index.html"),
    load("en/pricing/index.html"),
    load("zh/pricing/index.html"),
    load("security/index.html"),
    load("en/security/index.html"),
    load("zh/security/index.html"),
    load("faq/index.html"),
    load("en/faq/index.html"),
    load("zh/faq/index.html"),
    load("compare/index.html"),
    load("en/compare/index.html"),
    load("zh/compare/index.html"),
    load("integrations/index.html"),
    load("en/integrations/index.html"),
    load("zh/integrations/index.html"),
    load("use-case/product-marketing/index.html"),
    load("en/use-case/product-marketing/index.html"),
    load("use-case/developer-advocacy/index.html"),
    load("en/use-case/developer-advocacy/index.html"),
    load("zh/use-case/developer-advocacy/index.html"),
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
  assert.match(home, /Use AnswerLens when your website is the source material for AI answers\./);
  assert.match(home, /Does AnswerLens fit your site\?/);
  assert.match(home, /not a hosted monitoring dashboard, a ranking tool, or a consumer AI scraper/);
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
  assert.match(home, /You get a report set your team can actually review\./);
  assert.match(home, /Run the sample site/);
  assert.match(home, /Open quickstart/);
  assert.match(home, /Open Action docs/);
  assert.match(home, /SoftwareApplication/);
  assert.match(home, /Organization/);
  assert.match(home, /WebSite/);
  assert.match(home, /softwareVersion/);
  assert.match(home, /og:image:alt/);
  assert.match(home, /Check the public story/);
  assert.match(home, /What it outputs/);
  assert.match(home, /Best fit/);
  assert.match(zhHome, /zh\/examples\/static-good\/index\.html/);
  assert.match(zhHome, /locale-switcher/);
  assert.match(zhHome, /检查公开叙事/);
  assert.match(zhHome, /它输出什么/);
  assert.match(zhHome, /适合谁/);
  assert.match(zhHome, /当你的网站会成为 AI 回答的素材时/);
  assert.match(zhHome, /先看输出，再设置/);
  assert.match(zhHome, /不是托管监测看板/);
  assert.match(zhHome, /不会抓取消费级 AI 应用界面/);
  assert.doesNotMatch(zhHome, /CLI-first|artifact-first|dashboard|答案页排名|漏斗/);

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
  assert.match(playbooks, /Have a report\?/);
  assert.match(playbooks, /Run the 5-minute check on your site/);
  assert.match(zhFaq, /先看在线演示报告，再在本地跑示例站点演示/);
  assert.match(zhFaq, /查看对比/);
  assert.doesNotMatch(zhFaq, /Start with the 在线演示报告|对比 options|Compare options/);
  assert.match(zhIntegrations, /发布资源与 Pages 站点/);
  assert.match(zhIntegrations, /把演示输出和文档整理成可复用的公开页面与下载资源/);
  assert.doesNotMatch(zhIntegrations, /Release assets and Pages|Turns demo outputs|<th>Integration<\/th>|What it does/);
  assert.match(zhDocs, /读懂 AnswerLens 报告的文档/);
  assert.match(zhDocs, /把文档放在报告旁边读/);
  assert.match(zhDocs, /用文档把结果变成动作/);
  assert.match(zhDocs, /接入文件<\/a>：外部仓库布局和报告审阅顺序/);
  assert.doesNotMatch(zhDocs, /activation references|canonical Markdown|Starter bundle/);
  assert.match(zhStarter, /把一轮有用的本地审计变成 GitHub Action/);
  assert.match(zhStarter, /本地报告已经看懂之后，再复制这些文件/);
  assert.match(zhStarter, /需要复制的文件/);
  assert.match(zhStarter, /看接入文件如何进入 GitHub Actions 工作流/);
  assert.doesNotMatch(zhStarter, /starter bundle|raw repo files|adoption readiness|live demo artifact set|activation references|canonical Markdown|GitHub-native workflow/);
  assert.match(zhCompare, /仓库内审阅 vs 看板式监测/);
  assert.match(zhCompare, /模型服务用量留在自己的账户/);
  assert.match(zhCompare, /对比页、FAQ 和证明页/);
  assert.doesNotMatch(zhCompare, /dashboard-first|Repo-native|provider 使用量|proof page|首页、pricing/);
  assert.match(zhDeveloperAdvocacy, /保持上手路径和实现说明可见/);
  assert.doesNotMatch(zhDeveloperAdvocacy, /activation references|and examples/);

  assert.match(docs, /Activation plan/);
  assert.match(docs, /Use the docs with a report in front of you\./);
  assert.match(docs, /Choose by task/);
  assert.match(docs, /Use docs to move from result to action\./);
  assert.match(docs, /Choose the next product page/);
  assert.match(docs, /Starter bundle<\/a>: external-repo layout and report review order/);
  assert.match(docs, /Schema-text consistency/);
  assert.match(docs, /Evidence density/);
  assert.match(starter, /Turn one useful local audit into a GitHub Action\./);
  assert.match(starter, /Use these files after the local report makes sense\./);
  assert.match(starter, /Setup files/);
  assert.match(starter, /Files to copy/);
  assert.match(starter, /Starter example result/);
  assert.match(starter, /Example Product public site/);
  assert.match(starter, /runtime\.yaml/);
  assert.match(starter, /non-secret eval defaults/i);
  assert.match(starter, /YSCJRH\/ai-visibility-auditor@v0\.3\.2/);
  assert.match(starter, /starter\/example-run\/share-summary\.md/);
  assert.match(pricing, /AnswerLens is open source\. You bring the provider keys you choose\./);
  assert.match(pricing, /View starter/);
  assert.match(pricing, /\$0 provider cost/);
  assert.doesNotMatch(
    zhPricing,
    /The open-source repository|The CLI workflow for a basic|The reusable GitHub Action and release downloads|Local sample-site demos|The Action uploads the same report files|Area/
  );
  assert.match(security, /Security for AnswerLens starts with no hosted control plane\./);
  assert.match(security, /Read manual steps/);
  assert.match(security, /no consumer AI UI scraping/);
  assert.doesNotMatch(
    zhSecurity,
    /AnswerLens lets teams audit public product sites|Security for AnswerLens starts|Provider API keys stay|The core `audit` workflow can run without provider keys|Public sharing should use summary files|Use pull requests, Action logs|Teams should still review reports|Read manual steps/
  );
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
  assert.match(playbooks, /Turn one recommendation into a page change\./);
  assert.match(playbooks, /Page fixes/);
  assert.match(playbooks, /View current fixes/);
  assert.match(playbooks, /Fix loop/);
  assert.match(playbooks, /Change one page, then rerun the report\./);
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
