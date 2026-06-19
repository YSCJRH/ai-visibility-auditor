import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LOCALE_STORAGE_KEY, type Locale, localeToSlug, t } from "../../packages/i18n/src/index.ts";
import {
  buildSeoPage,
  generateSitemap,
  localizedReleaseSummary,
  renderJsonLd,
  renderSeoHead,
  type SeoPage,
  type SeoPageKind
} from "./site-seo.ts";

type ShareSummary = {
  project: string;
  tagline: string;
  positioning: string;
  site: {
    input: string;
    baseUrl: string;
    display?: string;
  };
  disclaimer: string;
  run: {
    generatedAt: string;
    artifactVersion: string;
    ruleVersion: string;
    mode: string;
  };
  metrics: Record<string, number | string | null>;
  topIssues: Array<{ severity: string; title: string; fixHint: string }>;
  topRecommendations: Array<{ title: string; expectedOutcome: string }>;
  artifacts: string[];
};

type RunManifest = {
  kind: string;
  generatedAt: string;
  site: {
    input: string;
    baseUrl: string;
    display?: string;
  };
};

type ReleaseEntry = {
  tag_name: string;
  name?: string;
  html_url: string;
  published_at?: string;
  body?: string;
  draft?: boolean;
  prerelease?: boolean;
};

type LocalizedText = string | Partial<Record<Locale, string>>;

type PageSpec = {
  route: string;
  filePath?: string;
  title: LocalizedText;
  description: LocalizedText;
  body: LocalizedText;
  jsonLd: unknown;
  seoKind?: SeoPageKind;
};

const REPO_URL = "https://github.com/YSCJRH/ai-visibility-auditor";
const DESCRIPTION = "AnswerLens is a CLI-first AI visibility auditor for product websites.";
const TAGLINE = "CI for AI discoverability.";
const DEFAULT_REPOSITORY = "YSCJRH/ai-visibility-auditor";
const SHOW_AND_TELL_DISCUSSION_URL = "https://github.com/YSCJRH/ai-visibility-auditor/discussions/new?category=show-and-tell";

type BuildSiteOptions = {
  repository?: string;
  siteUrl?: string;
  outDir?: string;
  demoRunDir?: string;
  consumerRunDir?: string;
  releasesPath?: string;
};

function parseArgs(argv: string[]): Map<string, string> {
  const flags = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      flags.set(key, "true");
      continue;
    }

    flags.set(key, next);
    index += 1;
  }

  return flags;
}

function defaultSiteUrl(repository: string): string {
  const [owner, repo] = repository.split("/");
  return `https://${owner.toLowerCase()}.github.io/${repo}/`;
}

function withTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function excerpt(value: string | undefined, max = 220): string {
  const compact = (value ?? "").replace(/\s+/g, " ").trim();
  if (compact.length <= max) {
    return compact;
  }

  return `${compact.slice(0, max - 3).trimEnd()}...`;
}

function formatDate(value: string | undefined, fallback: string): string {
  const date = new Date(value ?? fallback);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

function resolveLocalizedText(value: LocalizedText, locale: Locale): string {
  if (typeof value === "string") {
    return value;
  }

  return value[locale] ?? value.en ?? "";
}

function formatReadableDate(value: string | undefined, fallback: string, locale: Locale = "en"): string {
  const date = new Date(value ?? fallback);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return new Intl.DateTimeFormat(locale === "zh-CN" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: locale === "zh-CN" ? "numeric" : "short",
    day: "numeric"
  }).format(date);
}

function isStableReleaseTag(tagName: string): boolean {
  return /^v\d+\.\d+\.\d+$/.test(tagName);
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

function repoBlob(relativePath: string): string {
  return `${REPO_URL}/blob/main/${relativePath.replace(/\\/g, "/")}`;
}

function renderList(items: string[]): string {
  return items.map((item) => `<li>${item}</li>`).join("");
}

function renderPanel(title: string, eyebrow: string, body: string): string {
  return `<article class="panel"><p class="eyebrow">${escapeHtml(eyebrow)}</p><h2>${escapeHtml(title)}</h2>${body}</article>`;
}

function renderMetric(label: string, value: string, helper: string): string {
  return `<article class="metric"><p class="metric-label">${escapeHtml(label)}</p><p class="metric-value">${escapeHtml(value)}</p><p class="metric-helper">${escapeHtml(helper)}</p></article>`;
}

function renderJourneyStep(index: string, title: string, body: string, href: string, linkLabel: string): string {
  return `<li class="journeyStep"><span class="stepNumber">${escapeHtml(index)}</span><h3>${escapeHtml(title)}</h3><p>${body}</p><a href="${escapeHtml(href)}">${escapeHtml(linkLabel)}</a></li>`;
}

function renderCtaCard(title: string, eyebrow: string, body: string, href: string, linkLabel: string, tone: "primary" | "secondary" = "primary"): string {
  const className = tone === "primary" ? "ctaLink" : "ctaLink ctaLinkSecondary";
  return `<article class="panel ctaCard"><div><p class="eyebrow">${escapeHtml(eyebrow)}</p><h2>${escapeHtml(title)}</h2><p>${body}</p></div><a class="${className}" href="${escapeHtml(href)}">${escapeHtml(linkLabel)}</a></article>`;
}

function siteLabel(site: { input: string; display?: string }): string {
  const display = site.display?.trim();
  return display && display.length > 0 ? display : site.input;
}

function fixtureHostNote(baseUrl: string): string | null {
  if (baseUrl !== "https://fixture.local") {
    return null;
  }

  return "<code>https://fixture.local</code> is the stable hostname inside the public demo fixture, not the AnswerLens site URL.";
}

function renderSiteIdentity(site: { input: string; baseUrl: string; display?: string }): string {
  const lines = [`<p><strong>Demo site:</strong> ${escapeHtml(siteLabel(site))}</p>`];

  const note = fixtureHostNote(site.baseUrl);
  if (note) {
    lines.push(`<p>${note}</p>`);
  }

  return lines.join("");
}

function localizePath(route: string, locale: Locale): string {
  const slug = localeToSlug(locale);
  return route.length === 0 ? `${slug}/` : `${slug}/${route}`;
}

function otherLocale(locale: Locale): Locale {
  return locale === "zh-CN" ? "en" : "zh-CN";
}

function translateSiteHtml(html: string): string {
  const replacements: Array<[string, string]> = [
    ["Home", "首页"],
    ["Docs and examples", "文档与示例"],
    ["Docs", "文档"],
    ["Releases", "发布"],
    ["Examples", "示例"],
    ["Playbooks", "操作手册"],
    ["Check whether AI assistants can understand your product pages. Run AnswerLens from the CLI, then review a share summary, scorecard, and fix list in GitHub.", "检查 AI 助手能不能读懂你的产品网站。你从命令行运行 AnswerLens，再在 GitHub 里查看摘要、评分卡和修复清单。"],
    ["Open the demo report, reproduce it locally with the sample site, run a quick audit on one public site, then add the same check to GitHub Actions when the result is useful.", "先打开在线演示报告，再用示例站点在本地复现一次。确认结果有用后，在一个公开产品站点上跑 quickstart；最后再接入 GitHub Action。"],
    ["You get a report set your team can actually review.", "你会得到一组团队真的能审阅的报告。"],
    ["The useful output is simple: a short summary, a scorecard, and a fix list you can discuss in product, docs, or PR review.", "结果不需要重新整理：一份摘要、一份评分卡、一份修复清单，产品、文档和 PR 审阅都能直接使用。"],
    ["Have a report open? Pick the next doc by task.", "报告已打开？<br>下一步读哪篇？"],
    ["Start with share-summary.md, then scorecard.md. Then choose the document that explains the issue, helps you edit one page, or moves the same report into CI.", "先看 share-summary.md，再看 scorecard.md，然后按你要做的事选择文档：解释问题、改一个页面，或把同一组报告接入 CI。"],
    ["See the report before you run anything.", "先看报告，再决定要不要运行。"],
    ["The static-good demo shows the finished AnswerLens output: what changed, what is trustworthy, and which file to open first. Use it to decide whether the workflow is worth trying on one public site.", "static-good 演示展示的是 AnswerLens 完成后的输出：哪里有问题、哪些证据可信、第一份文件该打开什么。先用它判断这套工作流是否值得跑到一个公开站点上。"],
    ["Turn one useful local audit into a GitHub Action.", "把一轮有用的本地审计变成 GitHub Action。"],
    ["Use this page after the demo and one real-site run. It shows the files to copy, where secrets belong, and how to review the first CI result.", "看完演示、跑过一次真实站点之后，再使用这一页。它会说明该复制哪些文件、密钥放在哪里，以及第一次 CI 结果该怎么看。"],
    ["AnswerLens is open source. You bring the provider keys you choose.", "AnswerLens 是开源工具。你使用自己选择的模型服务账户。"],
    ["There is no hosted AnswerLens dashboard or seat-based license today. Basic audits run locally without provider keys; optional eval benchmarks use your own provider account and your own GitHub runner minutes.", "当前没有托管版 AnswerLens 看板，也没有按席位收费。基础审计可以在本地运行，不需要模型服务 API key；可选评估会使用你自己的模型服务账户和 GitHub 运行分钟数。"],
    ["The open-source repository, Pages site, and live demo report.", "开源仓库、Pages 站点与在线演示报告。"],
    ["The CLI workflow for a basic `audit` run with no provider key.", "无需模型服务 key 的基础 `audit` CLI 工作流。"],
    ["The reusable GitHub Action and release downloads.", "可复用的 GitHub Action 与发布下载。"],
    ["Local sample-site demos, report bundles, and static review files.", "本地示例站点演示、报告包和静态审阅文件。"],
    ["AnswerLens lets teams audit public product sites and review results inside GitHub without sending repo history or provider keys to a separate AnswerLens SaaS. It keeps the guardrails explicit: no consumer AI UI scraping, no ranking guarantees, and no dashboard-first rewrite.", "AnswerLens 让团队可以审计公开产品站点，并在 GitHub 中审阅结果；不需要把仓库历史或模型服务 key 发给单独的 AnswerLens SaaS。它也把边界写得很明确：不抓取消费级 AI UI、不承诺排名、不做看板优先重写。"],
    ["Provider API keys stay in your own shell, CI environment, or GitHub Actions secrets.", "模型服务 API key 保留在你自己的 shell、CI 环境或 GitHub Actions secrets 中。"],
    ["The core `audit` workflow can run without provider keys at all.", "核心 `audit` 工作流完全不需要模型服务 key。"],
    ["AnswerLens writes reviewable files such as `share-summary.md`, `scorecard.md`, and `recommendations.md` into your own run directory.", "AnswerLens 会把 `share-summary.md`、`scorecard.md`、`recommendations.md` 这类可审阅文件写进你自己的运行目录。"],
    ["Public sharing should use summary files, while raw provider payloads stay private.", "对外分享时优先使用摘要文件，原始模型服务响应应保持私有。"],
    ["Security for AnswerLens starts with no hosted control plane.", "AnswerLens 的安全起点，是没有托管控制平面。"],
    ["Read manual steps", "阅读人工设置清单"],
    ["Area", "项目"],
    ["$0 provider cost", "模型服务成本为 $0"],
    ["Basic <code>audit</code> runs do not require provider API keys.", "基础 <code>audit</code> 运行不需要模型服务 API key。"],
    ["Eval runs", "模型评估运行"],
    ["Bring your own provider bill", "使用你自己的模型服务账单"],
    ["OpenAI and Perplexity usage stays in your own account.", "OpenAI 和 Perplexity 的用量留在你自己的账户中。"],
    ["Your repository runner minutes", "你自己的 GitHub Actions 运行分钟数"],
    ["The Action uploads review-safe report files and excludes raw payloads by default.", "Action 默认上传适合审阅的报告文件，并排除 raw payload。"],
    ["Release tarballs or a local checkout for CLI runs until the npm package is visible.", "在 npm package 可见之前，使用 release tarball 或本地 checkout 跑 CLI。"],
    ["The root GitHub Action for pull requests and manual workflow runs.", "根目录 GitHub Action 用于 PR 检查和手动运行。"],
    ["Release assets for tarballs, demo bundles, and the compiled site bundle.", "发布下载包含 tarball、演示包和编译后的站点包。"],
    ["That keeps pricing simple: the product is open source, optional eval uses your own API keys, and there is no hosted AnswerLens control plane fee today.", "这样定价更容易理解：产品本身开源，可选模型评估使用你自己的模型服务 key，当前没有托管版 AnswerLens 控制平面费用。"],
    ["Use pull requests, Action logs, uploaded reports, and repo history as the audit trail.", "把 pull request、Action 日志、上传的报告和仓库历史作为审阅轨迹。"],
    ["Provider keys stay in your own shell, CI environment, or Actions secrets.", "模型服务 key 保留在你自己的 shell、CI 环境或 Actions secrets 中。"],
    ["Teams should still review reports before posting them to public issues, PRs, or release notes.", "把报告发到公开 issue、PR 或发布说明之前，团队仍应先审阅一遍。"],
    ["Connect AnswerLens where your team already reviews work.", "把 AnswerLens 接到团队已经在审阅工作的地方。"],
    ["Start with GitHub Actions for PR checks. Add provider-based evals, Search Console imports, or Bing helpers only when they help validate what the basic audit already found.", "先用 GitHub Actions 做 PR 检查。只有当它们能验证基础审计发现的问题时，再添加模型评估、Search Console 导入或 Bing 辅助工具。"],
    ["Use one recommendation to improve one page.", "用一条建议改好一个页面。"],
    ["Playbooks are for the moment after you have a report open. Pick one recommendation, confirm the evidence, change the page, then rerun the audit so the next reviewer sees a fresh result.", "这一页是给已经打开报告的人使用的。先选一条建议，核对证据，再改页面，最后重新运行审计，让下一位审阅者看到新的结果。"],
    ["Download the latest AnswerLens release.", "下载最新 AnswerLens 发布版本。"],
    ["This page keeps the current version, release notes, demo bundles, and compiled site bundle in one place.", "这一页集中展示当前版本、发布说明、demo bundle 和编译后的站点 bundle。"],
    ["Use these answers before you run quickstart, add GitHub Actions, or compare AnswerLens with hosted dashboard tools.", "在做 5 分钟检查、添加 GitHub Actions，或把 AnswerLens 和托管看板工具做对比之前，可以先看这些回答。"],
    ["Compare options", "查看对比"],
    ["see the open-source package and provider-cost model.", "查看开源打包方式和模型服务成本。"],
    ["review the GitHub Actions setup path.", "查看 GitHub Actions 设置路径。"],
    ["Report package", "报告文件"],
    ["Product pages", "产品页面"],
    ["Example report", "示例报告"],
    ["What to look at", "先看什么"],
    ["Start with the summary, then check the scorecard and fixes.", "先读摘要，再查评分卡和修复建议。"],
    ["Reports", "报告文件"],
    ["Report excerpt", "报告摘录"],
    ["CI setup", "CI 设置"],
    ["Setup files", "设置文件"],
    ["Report review order", "报告审阅顺序"],
    ["Starter example result", "starter 示例结果"],
    ["Public example", "公开示例"],
    ["Set up your repo", "设置你的仓库"],
    ["Included", "包含内容"],
    ["Your accounts", "你的账户"],
    ["How teams start", "团队如何开始"],
    ["Current integrations", "当前集成"],
    ["External setup", "外部设置"],
    ["GitHub-first teams", "GitHub-first 团队"],
    ["GitHub distribution", "GitHub 分发"],
    ["Current generated recommendation", "当前生成的建议"],
    ["Demo result", "演示结果"],
    ["Run sample", "运行示例"],
    ["Run sample locally", "本地运行示例"],
    ["Open fix list", "打开修复清单"],
    ["AnswerLens turns public-site clarity into GitHub-ready reports.", "AnswerLens 把公开站点的清晰度变成可在 GitHub 审阅的报告。"],
    ["AnswerLens public-site audit reports for GitHub teams", "面向 GitHub 团队的 AnswerLens 公开站点审计报告"],
    ["Docs for acting on an AnswerLens report", "拿到 AnswerLens 报告后该读什么"],
    ["Release notes and downloadable distribution assets", "发布说明与可下载分发资产"],
    ["Demo report for evaluating AnswerLens", "用于评估 AnswerLens 的演示报告"],
    ["Copy AnswerLens into a GitHub repository", "把 AnswerLens 接入 GitHub 仓库"],
    ["Open-source pricing and packaging", "开源定价与打包方式"],
    ["Security, trust, and review guardrails", "安全、信任与审阅边界"],
    ["First-run FAQ and guardrails", "首次试用 FAQ 与边界说明"],
    ["AnswerLens compared with Profound, Peec AI, and Otterly", "AnswerLens 与 Profound、Peec AI、Otterly 的对比"],
    ["GitHub, provider, and validation integrations", "GitHub、模型服务与验证集成"],
    ["Use case for product marketing teams", "面向产品营销团队的使用场景"],
    ["Use case for developer advocacy teams", "面向开发者关系团队的使用场景"],
    ["Use case for open-source maintainers", "面向开源维护者的使用场景"],
    ["Fix one product page from an AnswerLens report", "根据 AnswerLens 报告修好一个产品页面"],
    ["Product docs", "产品文档"],
    ["Versioned distribution", "版本化分发"],
    ["Example report", "示例报告"],
    ["Pricing and packaging", "定价与打包"],
    ["Security and trust", "安全与信任"],
    ["First-run FAQ", "首次试用 FAQ"],
    ["Compare", "对比"],
    ["Integrations", "集成"],
    ["Use case", "使用场景"],
    ["Fixes and playbooks", "页面修复"],
    ["Recommended first-run path", "推荐首次试用路径"],
    ["Does AnswerLens fit your site?", "AnswerLens 是否适合你的站点？"],
    ["Check the public story", "检查公开叙事"],
    ["Review the evidence", "审阅证据"],
    ["Best fit", "适合谁"],
    ["Try it in this order", "按这个顺序试用"],
    ["See the output before setup", "先看输出，再设置"],
    ["Run one real page", "跑一个真实页面"],
    ["Public proof block", "公开证明区块"],
    ["Public proof pages", "公开证明页面"],
    ["Use-case coverage", "用例覆盖"],
    ["Choose the next product page", "选择下一页产品说明"],
    ["Choose by what you need to do", "按下一步选择"],
    ["Use docs to answer the question in front of you.", "用文档回答眼前这个问题。"],
    ["Report files", "报告文件"],
    ["Use the latest release", "使用最新发布版本"],
    ["Latest demo run", "最新演示运行"],
    ["After the demo", "看完演示后"],
    ["Make the demo useful on your own site.", "把演示用到你的站点上。"],
    ["Starter example result", "starter 示例结果"],
    ["What to do next", "下一步怎么做"],
    ["What costs $0", "哪些成本为 $0"],
    ["Where paid usage can appear", "可能产生费用的地方"],
    ["Packaging choices", "打包方式"],
    ["Trust model", "信任模型"],
    ["Review and deployment model", "审阅与部署模型"],
    ["Known limits", "已知限制"],
    ["Common questions", "常见问题"],
    ["Related proof pages", "相关证明页面"],
    ["Declared comparison set", "公开对比对象"],
    ["How the workflow differs", "工作流有何不同"],
    ["When AnswerLens fits", "何时适合使用 AnswerLens"],
    ["Current integrations", "当前集成"],
    ["How teams usually start", "团队通常如何开始"],
    ["Starter files", "starter 文件"],
    ["Where teams start", "团队从哪里开始"],
    ["Where teams focus", "团队关注点"],
    ["Why maintainers use it", "维护者为什么使用它"],
    ["Current generated recommendation", "当前生成的建议"],
    ["Recommended reading", "推荐阅读"],
    ["Open live demo", "打开在线演示"],
    ["View starter", "查看接入文件"],
    ["Open playbooks", "查看修复建议"],
    ["Open docs", "打开文档"],
    ["View examples", "查看演示"],
    ["Open releases", "打开下载页"],
    ["Open Action docs", "打开 Action 文档"],
    ["Run quickstart", "开始 5 分钟检查"],
    ["Compare options", "比较选项"],
    ["Review pricing", "查看定价"],
    ["AnswerLens for product marketing teams.", "面向产品营销团队的 AnswerLens。"],
    ["Use AnswerLens when product pages need to be easier for AI assistants to explain. It highlights category, positioning, proof, pricing, and comparison gaps that can make AI answers vague or incomplete.", "当产品页面需要被 AI 助手更清楚地解释时，用 AnswerLens 检查分类、定位、证据、定价和对比内容的缺口。"],
    ["Find the pages that undersell you", "找出没有讲清价值的页面"],
    ["Start with the homepage, docs, pricing, and comparison pages. Review the summary and scorecard first, then turn the recommendations into page-level fixes.", "从首页、文档、定价和对比页开始。先读摘要和评分卡，再把建议变成具体页面修改。"],
    ["Ship clearer buying evidence", "补上更清楚的购买证据"],
    ["Teams usually tighten category language, add proof, and make pricing, FAQ, and comparison content easier to cite.", "团队通常会收紧品类表述，补充证据，并让定价、FAQ 和对比内容更容易被引用。"],
    ["Improve the source material", "改进公开内容本身"],
    ["The result is not a ranking promise. It is stronger public content that AI systems can quote, compare, and recommend more accurately.", "这不是排名承诺，而是让公开内容更清楚，使 AI 系统更容易准确引用、比较和推荐。"],
    ["AnswerLens for developer advocacy teams.", "面向开发者关系团队的 AnswerLens。"],
    ["Use AnswerLens to make docs, examples, and setup guides easier to find and cite. It shows whether a developer can move from curiosity to a working first run without guessing.", "用 AnswerLens 检查文档、示例和安装指南是否容易找到、容易引用，也能看出开发者能否从好奇顺利走到第一次跑通。"],
    ["Make setup easier to follow", "让设置步骤更容易跟上"],
    ["Review whether the docs index, setup guide, and API references are public, scannable, and linked from the homepage.", "检查文档索引、设置指南和 API 参考是否公开、容易扫读，并且能从首页找到。"],
    ["Ship examples people can inspect", "提供能直接查看的示例"],
    ["Use Pages examples, release bundles, and sample-site reports as teaching material that can be linked directly from GitHub.", "把 Pages 示例、release 包和示例站点报告作为可直接从 GitHub 分享的材料。"],
    ["Reduce first-run friction", "降低第一次跑通的摩擦"],
    ["Keep quickstart and GitHub Actions aligned so new developers can move from the demo to their own repository without guesswork.", "让 5 分钟检查和 GitHub Actions 保持一致，新开发者就能从演示顺利走到自己的仓库。"],
    ["AnswerLens for open-source maintainers.", "面向开源维护者的 AnswerLens。"],
    ["Use AnswerLens when your README, Pages site, and releases are the front door. It helps you find unclear packaging, setup, and trust signals before adding more product surface area.", "当 README、Pages 站点和 release 是项目门面时，用 AnswerLens 检查打包、设置和信任信号是否讲清楚，再决定是否增加更多产品页面。"],
    ["Check the repository as the product entry point", "把仓库当作产品入口来检查"],
    ["Use the README as the canonical home, Pages as the audit target, and release notes as a versioned entry point.", "把 README 当作主入口，把 Pages 当作审计目标，把 release notes 当作带版本的入口。"],
    ["Review reports in GitHub", "在 GitHub 里审阅报告"],
    ["AnswerLens turns unclear packaging problems into report files that can be discussed in issues, pull requests, and Discussions announcements.", "AnswerLens 会把不清楚的打包问题变成报告文件，方便在 issue、pull request 和 Discussions 里讨论。"],
    ["Repeat the check", "重复检查"],
    ["Improve public pages, run the audit again, and track whether the next round of feedback is easier to act on.", "改进公开页面后再跑一次审计，看看下一轮反馈是否更容易执行。"],
    ["AnswerLens integrations stay GitHub-native and artifact-backed.", "AnswerLens 的集成保持围绕 GitHub 和报告文件。"],
    ["The integration surface is intentionally narrow: keep the core audit contract stable, add eval providers when you need them, and layer validation imports on top without turning the project into a dashboard-first SaaS.", "集成面刻意保持收敛：先稳定核心审计，再按需要加入模型评估和验证导入，不把项目扩成看板式 SaaS。"],
    ["How teams usually start", "团队通常如何开始"],
    ["Open the live demo report.", "先看在线演示报告。"],
    ["Run the sample-site demo locally.", "在本地跑一次示例站点演示。"],
    ["Run one real-site audit.", "审计一个真实公开站点。"],
    ["Add the GitHub Action when the report is useful.", "当报告有用时，再添加 GitHub Action。"],
    ["That order keeps setup understandable without turning every integration into a separate product.", "这个顺序能让设置路径保持清楚，不会把每个集成都变成单独产品。"],
    ["The external-repo setup is public and copyable.", "外部仓库接入方式是公开且可复制的。"],
    ["Use the ", "使用"],
    ["starter overview", "接入文件总览"],
    [" when you need a citable explanation of the <code>.github/answerlens/</code> layout before handing someone the raw example files.", "，在交付原始示例文件前，先解释 <code>.github/answerlens/</code> 目录应该怎么放。"],
    ["That keeps the Action setup clear for forks, releases, and external guides.", "这样 fork、release 和外部指南里的 Action 设置都会更清楚。"],
    ["Starter bundle", "接入文件"],
    ["Starter files", "接入文件"],
    ["starter 文件", "接入文件"],
    ["starter 示例结果", "接入示例结果"],
    ["starter bundle", "接入文件"],
    ["live demo report", "在线演示报告"],
    ["live demo 的 artifact 组合", "在线演示报告"],
    ["artifact 审阅顺序", "报告审阅顺序"],
    ["artifact 契约", "报告文件"],
    ["artifact 组合", "报告文件"],
    ["artifacts", "报告文件"],
    ["GitHub-native", "GitHub 原生"],
    ["dashboard-first", "看板式"],
    ["打开 quickstart", "开始 5 分钟检查"],
    ["Teams usually look at the demo, run one local audit, and then add GitHub Actions. The package is intentionally simple:", "团队通常先看演示，再跑一次本地审计，然后添加 GitHub Actions。打包方式刻意保持简单："],
    ["The root GitHub Action for pull requests and manual workflow runs.", "根目录 GitHub Action 用于 pull request 和手动 workflow 运行。"],
    ["Release assets for tarballs, demo bundles, and the compiled site bundle.", "release assets 提供 tarball、演示包和编译后的站点包。"],
    ["Pages for docs, examples, playbooks, pricing, and trust pages.", "Pages 承载文档、演示、修复建议、定价和信任页面。"],
    ["That keeps pricing simple: the product is open source, optional eval uses your own API keys, and there is no hosted AnswerLens control plane fee today.", "这样定价更容易理解：产品本身开源，可选评估使用你自己的 API key，当前没有托管版 AnswerLens 控制平面费用。"],
    ["Runs AnswerLens in pull requests, workflow_dispatch runs, and artifact uploads.", "在 pull request、手动 workflow 和上传报告文件时运行 AnswerLens。"],
    ["Calls OpenAI or Perplexity for optional eval benchmarks when provider keys are configured.", "配置模型服务 key 后，可调用 OpenAI 或 Perplexity 做可选评估。"],
    ["Adds helper-mode validation and candidate URL preparation without live submission.", "提供辅助验证和候选 URL 准备，不会直接提交。"],
    ["Marketing pages", "营销页面"],
    ["的 接入文件", "的接入文件"],
    ["复制 接入文件", "复制接入文件"],
    ["可直接复制的 接入文件", "可直接复制的接入文件"],
    ["把 接入文件", "把接入文件"],
    ["先看 在线演示报告", "先看在线演示报告"],
    ["看 接入文件 如何嵌进 GitHub 原生 工作流", "看接入文件如何进入 GitHub Actions 工作流"],
    ["这样能把 接入文件 保持在“证明 adoption readiness”的位置，而不是变成另一套独立产品面。", "这样接入文件只承担“可复制上手”的作用，不会变成另一套产品页面。"],
    ["查看 activation references、scoring notes 与 canonical Markdown。", "查看上手路径、评分说明和规范文档。"],
    ["当你想先解释 AnswerLens GitHub Action 路径，而不是直接把人扔进 raw repo files 时，就该用这一页。它把 external layout、artifact order 和 next step 放在了同一个页面里。", "当你需要说明 AnswerLens 的 GitHub Action 接入路径时，先用这一页讲清 .github/answerlens/ 目录、报告顺序和下一步，再把读者带到示例文件。"],
    ["当你需要先给出一份可引用的 <code>.github/answerlens/</code> 布局说明，而不是直接把 raw example files 扔给别人时，请使用 接入文件 overview。", "当你需要先说明 <code>.github/answerlens/</code> 目录该怎么放，再把示例文件交给别人时，请使用接入文件总览。"],
    ["activation 参考、评分说明和规范 Markdown", "评分说明和产品文档"],
    ["release assets", "release 下载"],
    ["Pricing", "定价"],
    ["Security", "安全"],
    ["answer first-run workflow questions.", "回答第一次试用和工作流设置问题。"],
    ["explain how the GitHub workflow differs from hosted dashboard products.", "说明 GitHub 工作流和托管看板产品的差异。"],
    ["explain where Action and eval usage create variable cost.", "说明 Action 和评估使用会在哪里产生费用。"],
    ["explain secret handling and review expectations.", "说明密钥处理和审阅预期。"],
    ["show the external-repo layout and report review order.", "展示外部仓库目录和报告审阅顺序。"],
    ["connect integrations to docs and examples.", "把集成路径连接到文档和演示。"],
    ["</a>:", "</a>："],
    ["</a>： ", "</a>："],
    ["把配置文件和 workflow 复制到你要审计的仓库里。", "把配置文件和工作流复制到你要审计的仓库里。"],
    ["打开 workflow", "打开工作流"],
    ["先跑一次本地审计，再添加 workflow。", "先跑一次本地审计，再添加工作流。"],
    ["把 .github/answerlens 文件和 workflow 移到你要审计的仓库里。", "把 .github/answerlens 文件和工作流移到你要审计的仓库里。"],
    ["secret 放在哪里", "密钥放在哪里"],
    ["非 secret", "非密钥"],
    ["非密钥 的", "非密钥的"],
    ["eval 默认值", "评估默认值"],
    ["provider、model、locale、samples 和 timeout", "模型服务、模型、语言、样本数和超时设置"],
    ["当前 starter workflow", "当前接入工作流"],
    ["release notes", "发布说明"],
    ["pin 到", "固定到"],
    ["pin。", "固定。"],
    ["GitHub Actions workflow", "GitHub Actions 工作流"],
    ["这次 接入示例结果", "这次接入示例结果"],
    ["release 下载 提供", "release 下载提供"],
    ["把 release 下载 当作第二个公开入口", "把 release 下载作为第二个公开入口"],
    ["继续看 评分说明和产品文档", "继续看评分说明和产品文档"],
    ["What to keep aligned", "需要保持一致的内容"],
    ["keep activation references and implementation notes visible.", "保持上手路径和实现说明可见。"],
    ["explain GitHub Actions, providers, and validation helpers together.", "把 GitHub Actions、模型服务和验证辅助工具放在一起说明。"],
    ["answer first-run setup questions before CI adoption.", "在接入 CI 前回答第一次设置问题。"],
    ["explain why a GitHub workflow differs from hosted dashboard tools.", "说明 GitHub 工作流为什么不同于托管看板工具。"],
    ["set expectations for secrets, reports, and public sharing.", "说明密钥、报告和公开分享的边界。"],
    ["clarify packaging, provider costs, and download options.", "讲清打包方式、模型服务成本和下载选项。"],
    ["explicitly name Profound, Peec AI, and Otterly with clearer fit guidance.", "明确对比 Profound、Peec AI 和 Otterly，并说明适用场景。"],
    ["answer recurring objections in visible language.", "用清楚可见的语言回答常见疑虑。"],
    ["keep trust and deployment expectations legible.", "让信任和部署预期保持清楚。"],
    ["connect product claims back to implementation notes.", "把产品表述连接回实现说明。"],
    ["keep packaging claims concrete and citable.", "让打包方式的表述具体、可引用。"],
    ["keep trust language honest and reviewable.", "让信任表述诚实且可审阅。"],
    ["explain the public positioning against adjacent tools.", "说明相邻工具之间的公开定位差异。"],
    ["keep the GitHub Actions setup visible.", "让 GitHub Actions 设置路径保持可见。"],
    ["keep first-run questions cheap to answer.", "让第一次试用问题更容易回答。"],
    ["Built by YSCJRH from repo docs, releases, and reports. No consumer AI UI scraping. No ranking promises.", "由 YSCJRH 基于仓库文档、发布记录与报告构建。无消费级 AI 界面抓取，不承诺答案面排名。"],
    ["Open the live demo report", "打开在线演示报告"],
    ["Run the sample-site demo locally", "本地运行示例站点演示"],
    ["Run a 5-minute real-site audit", "运行 5 分钟真实站点审计"],
    ["Add the GitHub Action", "添加 GitHub Action"],
    ["Open doc", "打开文档"],
    ["Start here", "从这里开始"],
    ["Report proof", "报告示例"],
    ["Coverage", "覆盖面"],
    ["Team fit", "团队适配"],
    ["What to open next", "接下来打开什么"],
    ["Cross-linking", "互链"],
    ["What ships now", "当前已交付"],
    ["Suggested path", "建议路径"],
    ["External setup", "外部设置"],
    ["Workflow", "工作流"],
    ["What to strengthen", "该强化什么"],
    ["What to connect", "该连接什么"],
    ["GitHub distribution", "GitHub 分发"],
    ["Concept support", "概念支持"],
    ["Start here", "从这里开始"],
    ["Review order", "审阅顺序"],
    ["Public comparison", "当前公开对比"],
    ["Decision criteria", "决策标准"],
    ["What this connects to", "这与什么相连"],
    ["Current public comparison", "当前公开对比"],
    ["What people ask first", "大家首先会问什么"],
    ["What it does", "它能做什么"],
    ["Choose the next AnswerLens doc by task: understand a scorecard, fix one page, run your site, or add GitHub Actions.", "按任务选择下一篇 AnswerLens 文档：读懂评分卡、修一个页面、审计自己的站点，或接入 GitHub Actions。"],
    ["Turn one useful local AnswerLens audit into a GitHub Actions workflow with copyable config files and a pinned Action.", "把一轮有用的本地 AnswerLens 审计，变成可复制配置文件和固定版本 Action 组成的 GitHub Actions 工作流。"],
    ["How AnswerLens differs from dashboard-first AI visibility tools such as Profound, Peec AI, and Otterly.", "说明 AnswerLens 与 Profound、Peec AI、Otterly 等看板式 AI 可见性工具的区别。"],
    ["Open a finished AnswerLens report, see the evidence your team would review, then run the same sample locally before trying your site.", "先打开一份完成的 AnswerLens 报告，看清团队会审阅哪些证据，再本地复现示例并尝试自己的站点。"],
    ["How developer advocacy teams can use AnswerLens to strengthen docs, examples, and self-serve proof pages.", "说明开发者关系团队如何使用 AnswerLens 强化文档、示例与自助试用路径。"],
    ["How open-source maintainers can use AnswerLens on README, Pages, releases, and demo reports.", "说明开源维护者如何在 README、Pages、releases 与演示报告上使用 AnswerLens。"],
    ["Copyable setup for moving one useful local AnswerLens audit into GitHub Actions.", "把一轮有用的本地 AnswerLens 审计搬进 GitHub Actions 的可复制设置。"],
    ["Docs for understanding AnswerLens reports and choosing the next action.", "帮助读懂 AnswerLens 报告并选择下一步的文档。"],
    ["AnswerLens docs stay in Markdown and compile to an indexable layer.", "AnswerLens 文档继续以 Markdown 编写，并编译成可索引页面。"],
    ["AnswerLens keeps repo docs as the authoring surface and compiles this page to make them easier for search engines, AI systems, and external teams to discover.", "AnswerLens 保持以仓库文档为来源，并把这一页编译成更容易被搜索引擎、AI 系统和外部团队发现的公开页面。"],
    ["Current operating focus for public entry points and adoption.", "当前围绕公开入口和接入体验的运营重点。"],
    ["GitHub-native packaging, funnel, and community strategy.", "GitHub 打包、首次试用与社区策略。"],
    ["How AnswerLens uses its own audit mindset on public source-material surfaces.", "说明 AnswerLens 如何用自己的审计思路改进公开内容。"],
    ["Run one real-site audit before you wire CI.", "在接入 CI 之前先跑一轮真实站点审计。"],
    ["Public external-repo layout for GitHub Actions setup.", "面向 GitHub Action 设置的公开外部仓库布局。"],
    ["Canonical public roadmap and issue sequencing.", "规范公开 roadmap 与 issue 顺序。"],
    ["P0, P1, and P2 distribution pages and metrics.", "P0、P1、P2 的分发页面与指标。"],
    ["Minimal GitHub, npm, and Pages setup checklist.", "最小 GitHub、npm 与 Pages 设置清单。"],
    ["Reusable `uses: owner/repo@vX` contract and outputs.", "可复用的 `uses: owner/repo@vX` 配置与输出。"],
    ["Public scoring model and output contract.", "公开评分模型与输出说明。"],
    ["How report outputs become copy-ready public summaries.", "说明报告输出如何变成可直接复用的公开摘要。"],
    ["Open these pages when the report raises a buyer, trust, setup, or positioning question.", "当报告引出购买、信任、设置或定位问题时，就继续看这些页面。"],
    ["Start in this order:", "按这个顺序开始："],
    ["to understand the report flow.", "用来理解报告流程。"],
    ["to reproduce the same report set locally.", "在本地复现同一组报告。"],
    ["before wiring CI.", "再去接 CI。"],
    ["when you want the same reports in pull requests and workflow runs.", "当你想在 pull requests 和 workflow runs 中复用同一组报告时再接入。"],
    ["If you arrive here already knowing you want CI, the Action docs remain public, but the clearest first run still moves through the demo and one local audit first.", "如果你一开始就知道自己想直接接 CI，Action 文档当然仍然可用；但最清晰的首次试用仍然应该先看 demo，再跑一轮本地审计。"],
    ["Use the latest release as the second public front door.", "把 latest release 当作第二个公开入口。"],
    ["At every step, start with <code>share-summary.md</code>, then <code>scorecard.md</code>, then <code>recommendations.md</code>.", "每一步都先看 <code>share-summary.md</code>，然后是 <code>scorecard.md</code>，最后是 <code>recommendations.md</code>。"],
    ["Demo site:", "演示站点："],
    ["Top issue:", "核心问题："],
    ["Top fix:", "优先修复："],
    ["Open reports in order:", "按这个顺序打开报告："],
    ["AnswerLens now publishes public pages that explain packaging, trust, FAQs, comparisons, and integrations without drifting into dashboard-first packaging.", "AnswerLens 现在会发布公开页面，用来解释打包方式、信任、FAQ、对比与集成，而不把项目重新包装成看板优先的产品。"],
    ["These use-case pages show the jobs teams usually try first.", "这些使用场景会展示团队最常用的第一批任务。"],
    ["AnswerLens FAQ for new visitors and evaluators.", "面向新访客和评估者的 AnswerLens FAQ。"],
    ["This page answers the recurring first-run questions in visible, citable language so teams can understand the workflow before they wire it into GitHub or compare it with dashboard-first tools.", "这页会用可见、可引用的语言回答高频首次试用问题，帮助团队在接入 GitHub 或和看板式工具比较之前先理解工作方式。"],
    ["What does AnswerLens audit?", "AnswerLens 审计什么？"],
    ["AnswerLens audits whether a product site is easy for AI systems to read, cite, compare, and recommend. It writes a share summary, scorecard, and recommendations your team can review.", "AnswerLens 审计的是：一个产品网站是否足够容易被 AI 系统读取、引用、比较与推荐，并输出团队可以审阅的摘要、评分卡和修复建议。"],
    ["Does AnswerLens scrape consumer AI apps?", "AnswerLens 会抓取消费级 AI 应用吗？"],
    ["No. AnswerLens keeps the non-goal explicit: no consumer AI UI scraping and no ranking guarantees on answer surfaces.", "不会。AnswerLens 明确把这件事列为非目标：不抓取消费级 AI UI，也不承诺答案面的排名结果。"],
    ["Do I need provider API keys to try it?", "试用时需要模型服务 key 吗？"],
    ["Not for a basic audit run. Provider keys are only needed when you want eval-mode benchmarking on top of the core site audit.", "基础审计不需要。只有当你想在核心站点检查之外增加模型评估时，才需要模型服务 key。"],
    ["How do I start in under five minutes?", "怎样在 5 分钟内开始？"],
    ["Start with the live demo report, run the sample-site demo locally, then use the 5-minute real-site quickstart before adding the GitHub Action.", "先看在线演示报告，再在本地跑示例站点演示，然后用 5 分钟 quickstart 审计真实站点，最后再添加 GitHub Action。"],
    ["Start with the 在线演示报告, run the sample-site demo locally, then use the 5-minute real-site quickstart before adding the GitHub Action.", "先看在线演示报告，再在本地跑示例站点演示，然后用 5 分钟 quickstart 审计真实站点，最后再添加 GitHub Action。"],
    ["How does pricing work today?", "当前的定价模式是怎样的？"],
    ["The project is open source, the CLI and Pages docs are public, and optional eval costs stay in your own provider account.", "项目本身是开源的，CLI 和 Pages 文档公开可见；可选模型评估的费用会留在你自己的模型服务账户里。"],
    ["see the open-source and BYOK packaging model.", "查看开源与 BYOK 的打包模型。"],
    ["review trust, secrets, and guardrails.", "查看信任、密钥与边界说明。"],
    ["understand how AnswerLens differs from Profound, Peec AI, and Otterly.", "理解 AnswerLens 与 Profound、Peec AI、Otterly 的区别。"],
    ["review the GitHub-native workflow path.", "查看 GitHub 工作流路径。"],
    ["go deeper on activation, scoring, and Action usage.", "进一步了解激活计划、评分与 Action 使用方式。"],
    ["Fixture outputs are treated as public example artifacts.", "fixture 输出会被当作公开示例 artifacts。"],
    ["The static-good fixture is the stable source for share summaries, scorecards, recommendations, and HTML report outputs.", "static-good fixture 是 share summaries、scorecards、recommendations 与 HTML report outputs 的稳定来源。"],
    ["if you want the same artifact set locally.", "如果你想在本地拿到同一组 artifacts。"],
    ["against your own public site.", "面向你自己的公开站点。"],
    ["Open the starter bundle overview", "打开接入文件总览"],
    ["only after one useful local real-site run.", "前提是你已经有一轮真正有用的本地真实站点运行。"],
    ["Keep the review order stable:", "保持固定的审阅顺序："],
    ["The setup gives you the same report set in CI: site settings, competitors, prompts, runtime defaults, and a pinned Action.", "这套设置会在 CI 中生成同一组报告：站点设置、竞品、提示词、runtime 默认值，以及固定版本的 Action。"],
    ["Use this page when you want to explain the AnswerLens GitHub Action path before sending someone into raw repo files. It keeps the external layout, artifact order, and next step visible in one place.", "当你需要说明 AnswerLens 的 GitHub Action 接入路径时，先用这一页讲清 <code>.github/answerlens/</code> 目录、报告顺序和下一步，再把读者带到示例文件。"],
    ["External repo shape", "外部仓库结构"],
    ["Copy this layout", "复制这套布局"],
    ["This is the same layout used by ", "这就是下列示例所使用的同一套布局："],
    ["File roles", "文件职责"],
    ["What each file does", "每个文件分别做什么"],
    ["the GitHub Action workflow that runs the same artifact contract in CI.", "在 CI 中运行同一套 artifact 契约的 GitHub Action workflow。"],
    ["Starter files", "starter 文件"],
    ["Artifact review order", "artifact 审阅顺序"],
    ["Then use <code>pr-snippet.md</code> for GitHub copy and <code>run.json</code> for machine-readable metadata.", "然后再用 <code>pr-snippet.md</code> 写 GitHub 文案，用 <code>run.json</code> 提供机器可读元数据。"],
    ["Example site:", "示例站点："],
    ["This public example uses the consumer-repo starter bundle against the stable fixture so external adopters can inspect the resulting artifacts before wiring their own site.", "这个公开示例会把 consumer-repo 接入文件跑在稳定示例站点上，让外部采用者在接自己站点之前，先看到最终产物长什么样。"],
    ["if you have not done that yet.", "如果你还没做过这一步。"],
    ["Copy the starter files into the repository you want to audit.", "把 starter 文件复制到你准备审计的仓库里。"],
    ["Move into the GitHub Action path", "进入 GitHub Action 路径"],
    ["when the local run already feels reviewable.", "前提是本地运行已经足够可审阅。"],
    ["That keeps the starter bundle positioned as proof of adoption readiness, not as a separate product surface.", "这样接入文件只承担“可复制上手”的作用，不会变成另一套产品页面。"],
    ["see the live demo artifact set first.", "先看在线演示报告。"],
    ["activation references, scoring notes, and canonical Markdown.", "查看上手路径、评分说明和规范文档。"],
    ["see how the starter bundle fits into the GitHub-native workflow.", "看接入文件如何进入 GitHub Actions 工作流。"],
    ["use release assets as the second public front door.", "把发布资源当作第二个公开入口。"],
    ["Pricing for AnswerLens is open-source, BYOK, and artifact-first.", "AnswerLens 的定价与打包方式是开源、BYOK、artifact-first。"],
    ["AnswerLens is not a hosted dashboard with seat-based licensing. The code, Pages docs, example reports, and release assets are public. The only variable costs appear when you choose to run eval-mode benchmarking with your own provider account or consume your own GitHub runner minutes.", "AnswerLens 不是一个按 seat 计费的托管 dashboard。代码、Pages 文档、示例报告和 release assets 都是公开的。变量成本只会在你决定用自己的 provider 账户运行 eval benchmarking，或者消耗自己的 GitHub runner minutes 时出现。"],
    ["Open surfaces", "公开面"],
    ["The open-source repository, Pages site, and live demo report.", "开源仓库、Pages 站点与 live demo report。"],
    ["The CLI workflow for a basic `audit` run with no provider key.", "无需 provider key 的基础 `audit` CLI 工作流。"],
    ["The reusable GitHub Action contract and release asset downloads.", "可复用的 GitHub Action 契约与 release asset 下载。"],
    ["Local fixture demos, report bundles, and static review artifacts.", "本地 fixture demo、report bundle 和静态审阅 artifacts。"],
    ["Your repository runner minutes", "你自己的仓库 runner minutes"],
    ["The Action keeps the same artifact contract used by local runs.", "Action 复用了和本地 run 相同的 artifact 契约。"],
    ["How teams adopt", "团队如何采用"],
    ["Teams usually start with the live demo report, move to one local real-site audit, and then wire the same output contract into the GitHub Action. The package and release surfaces are intentionally simple:", "团队通常会从 live demo report 开始，再跑一轮本地真实站点审计，然后把同一套输出契约接进 GitHub Action。这套打包与发布面是刻意保持简单的："],
    ["for CLI installs and dry-run packaging.", "用于 CLI 安装与 dry-run 打包。"],
    ["The root GitHub Action for pull-request and workflow-based adoption.", "根 GitHub Action，用于 pull request 和 workflow 场景下的 adoption。"],
    ["Release assets for tarballs, demo bundles, and the compiled site bundle.", "用于 tarball、demo bundle 和编译站点 bundle 的 release assets。"],
    ["Pages as the public proof surface for docs, examples, playbooks, pricing, and trust.", "Pages 是 docs、examples、playbooks、pricing 与 trust 的公开 proof surface。"],
    ["That model keeps pricing legible: open source for the product surface, BYOK for optional eval usage, and no hosted AnswerLens control plane fee today.", "这种模型让定价叙事保持清晰：产品面本身开源，eval 使用走 BYOK，当前也没有托管版 AnswerLens 控制平面费用。"],
    ["Security for AnswerLens starts with no hosted control plane.", "AnswerLens 的安全叙事起点，是没有托管控制平面。"],
    ["AnswerLens is designed so that teams can audit public product sites and review results inside GitHub-native workflows without sending their repo history or provider keys to a separate AnswerLens SaaS. It keeps the guardrails explicit: no consumer AI UI scraping, no ranking guarantees, and no dashboard-first rewrite.", "AnswerLens 的设计目标，是让团队在 GitHub 工作流中审计公开产品站点并审阅结果，而不必把仓库历史或模型服务 key 发给单独的 AnswerLens SaaS。它也把边界写得很明确：不抓取消费级 AI UI、不承诺排名、不改成看板式产品。"],
    ["What stays under your control", "哪些内容仍由你掌控"],
    ["Provider API keys stay in your own shell, CI environment, or GitHub Actions secrets.", "Provider API key 会保留在你自己的 shell、CI 环境或 GitHub Actions secrets 中。"],
    ["The core `audit` workflow can run without provider keys at all.", "核心 `audit` 工作流可以完全不依赖 provider key。"],
    ["AnswerLens writes reviewable artifacts such as `share-summary.md`, `scorecard.md`, and `recommendations.md` into your own run directory.", "AnswerLens 会把 `share-summary.md`、`scorecard.md`、`recommendations.md` 这类可审阅 artifacts 写进你自己的 run 目录。"],
    ["Public sharing should use summary artifacts, while raw provider payloads stay private.", "对外分享时优先使用 summary artifacts，而 raw provider payload 应保持私有。"],
    ["Review trail", "审阅轨迹"],
    ["Use pull requests, Action logs, uploaded artifacts, and repo history as the audit trail.", "把 pull request、Action 日志、上传的 artifacts 与 repo history 当作审计轨迹。"],
    ["Guardrails", "边界与约束"],
    ["AnswerLens does not claim SOC 2, ISO 27001, HIPAA, or other compliance programs for a hosted service because it is not operating as a hosted AnswerLens SaaS today.", "由于当前并不存在托管版 AnswerLens SaaS，项目不会宣称自己具备 SOC 2、ISO 27001、HIPAA 等托管服务合规能力。"],
    ["The project does not scrape consumer AI interfaces to fabricate visibility claims.", "项目不会通过抓取消费级 AI 界面来制造可见性声明。"],
    ["The product does not promise rankings or placement on answer surfaces.", "产品不会承诺答案面的排名或展示位置。"],
    ["Teams should still review artifacts before posting them to public issues, PRs, or release notes.", "团队在把 artifacts 发到公开 issue、PR 或 release notes 前，仍然应该先自行审阅。"],
    ["That keeps the trust story direct: use your own deployment path, your own secrets handling, and your own repository review process.", "这能让信任叙事保持直接：使用你自己的部署路径、密钥处理方式和仓库审阅流程。"],
    ["AnswerLens integrations stay GitHub-native and artifact-backed.", "AnswerLens 的集成面保持 GitHub-native 和 artifact-backed。"],
    ["The integration surface is intentionally narrow: keep the core audit contract stable, add eval providers when you need them, and layer validation imports on top without turning the project into a dashboard-first SaaS.", "集成面是刻意收敛的：保持核心审计契约稳定，在确有需要时再加模型评估，并把验证导入叠加在其上，而不是把项目扩成看板式 SaaS。"],
    ["Runs the same artifact contract in pull requests, workflow_dispatch runs, and artifact uploads.", "在 pull requests、workflow_dispatch runs 和 artifact uploads 中运行同一套 artifact 契约。"],
    ["Run one real-site audit locally.", "先在本地跑一轮真实站点审计。"],
    ["Move the same artifact contract into the GitHub Action.", "再把同一套 artifact 契约搬进 GitHub Action。"],
    ["That sequencing keeps integrations understandable and reviewable instead of turning each surface into a separate product.", "这种顺序能让集成面保持可理解、可审阅，而不是把每个 surface 都变成独立产品。"],
    ["The external-repo path is public and copyable, not hidden in internal fixtures.", "external-repo 路径是公开且可复制的，不会藏在内部 fixtures 里。"],
    ["Use the starter bundle overview when you need a citable explanation of the <code>.github/answerlens/</code> layout before handing someone the raw example files.", "当你需要先说明 <code>.github/answerlens/</code> 目录该怎么放，再把示例文件交给别人时，请使用接入文件总览。"],
    ["That keeps the Action path legible for forks, releases, and external setup guides.", "这样 fork、发布页和外部设置指南里的 Action 路径都会更清楚。"],
    ["AnswerLens is a CLI-first AI visibility auditor for product websites. It turns audits into share summaries, PR-ready snippets, static reports, release assets, and indexable pages without falling back to dashboard-only workflows.", "AnswerLens 是一个面向产品网站的 CLI-first AI 可见性审计器。它会把审计结果转成分享摘要、PR 可复用片段、静态报告、发布资源和可索引页面，而不是退回到只靠看板的工作方式。"],
    ["Why AI may still miss the site", "为什么 AI 仍然可能错过这个站点"],
    ["What teams can ship next", "团队下一步最值得做什么"],
    ["Frequently asked questions about what AnswerLens is, how it works, and what it does not claim.", "关于 AnswerLens 是什么、如何工作，以及它不承诺什么的常见问题。"],
    ["Open-source pricing, packaging, BYOK evaluation, and release-asset distribution for AnswerLens.", "AnswerLens 的开源定价、打包方式、BYOK 评估与 release-asset 分发说明。"],
    ["GitHub Action, provider adapters, Search Console import, and helper integrations for AnswerLens.", "AnswerLens 的 GitHub Action、模型服务适配、Search Console 导入与辅助验证说明。"],
    ["Release index, version notes, and distribution surfaces compiled from GitHub metadata.", "基于 GitHub metadata 编译出的 release index、版本说明与分发页面。"],
    ["Release notes should work like a second front door, not a changelog graveyard.", "Release notes 应该像第二个公开入口，而不是一座 changelog 坟场。"],
    ["This page is compiled from release metadata so the public version line stays machine-readable, easy to index, and useful for first-run visitors.", "这一页由 release metadata 编译而成，目的是让公开版本线保持 machine-readable、易于索引，并且对首次访客有用。"],
    ["Activation plan", "激活计划"],
    ["Growth plan", "增长计划"],
    ["Self-dogfooding", "自我应用"],
    ["Quickstart", "快速开始"],
    ["Roadmap", "路线图"],
    ["Distribution plan", "分发计划"],
    ["Manual steps", "人工步骤"],
    ["Scoring", "评分说明"],
    ["Shareable summary", "可分享摘要"],
    ["Where to go next", "接下来去哪里"],
    ["Product marketing teams", "产品营销团队"],
    ["Developer advocacy teams", "开发者关系团队"],
    ["Open-source maintainers", "开源维护者"],
    ["AnswerLens for product marketing teams.", "面向产品营销团队的 AnswerLens。"],
    ["AnswerLens for developer advocacy teams.", "面向开发者关系团队的 AnswerLens。"],
    ["AnswerLens for open-source maintainers.", "面向开源维护者的 AnswerLens。"],
    ["Current local runs", "当前本地运行"],
    ["Current integration surfaces", "当前集成面"],
    ["Current public comparison", "当前公开对比"],
    ["Current recommendations", "当前建议"],
    ["Run metadata", "运行元数据"],
    ["Example", "示例"],
    ["Share summary contract", "share summary 契约"],
    ["PR-ready summary", "PR 可直接复用的摘要"],
    ["Public proof", "公开证明"],
    ["Top issues", "主要问题"],
    ["Top fixes", "优先修复"],
    ["Next step", "下一步"],
    ["Operational detail", "操作细节"],
    ["Repo-native vs dashboard-first", "仓库内审阅 vs 看板式监测"],
    ["Copyable sources", "可复制来源"],
    ["Latest run excerpt", "最新运行摘录"],
    ["Example files", "示例文件"],
    ["Artifacts", "产物"],
    ["Shareable artifacts", "可分享产物"],
    ["Site:", "站点："],
    ["Mode:", "模式："],
    ["Generated:", "生成时间："],
    ["Artifact version:", "产物版本："],
    ["Rule version:", "规则版本："],
    ["Release notes 应该像第二个公开入口，而不是一座 changelog 坟场。", "发布说明应该像第二个公开入口，而不是一座更新日志坟场。"],
    ["这一页由 release metadata 编译而成，目的是让公开版本线保持 machine-readable、易于索引，并且对首次访客有用。", "这一页由发布元数据编译而成，目的是让公开版本线保持机器可读、易于索引，并且对首次访客有用。"],
    ["The open-source repository, Pages site, and live demo report.", "开源仓库、Pages 站点与在线演示报告。"],
    ["What it does", "它能做什么"],
    ["Surface", "入口"],
    ["Cost model", "成本模型"],
    ["Notes", "说明"],
    ["CLI audit", "CLI 审计"],
    ["$0 provider cost", "provider 成本为 $0"],
    ["Basic <code>audit</code> runs do not require provider API keys.", "基础 <code>audit</code> 运行不需要 provider API key。"],
    ["Eval runs", "Eval 运行"],
    ["Bring your own provider bill", "自带 provider 账单"],
    ["OpenAI and Perplexity usage stays in your own account.", "OpenAI 和 Perplexity 的使用量保留在你自己的账户中。"],
    ["Your repository runner minutes", "你的仓库 runner 分钟数"],
    ["The Action keeps the same artifact contract used by local runs.", "这个 Action 复用了与本地运行相同的 artifact 契约。"],
    ["$0 to download", "下载成本为 $0"],
    ["Demo bundles, the compiled site, and docs stay publicly accessible.", "demo bundle、编译后站点和文档保持公开可访问。"],
    ["Integration", "集成方式"],
    ["OpenAI and Perplexity eval", "OpenAI 与 Perplexity 评估"],
    ["Release assets and Pages", "发布资源与 Pages 站点"],
    ["Turns demo outputs and docs into reusable public pages and downloads.", "把演示输出和文档整理成可复用的公开页面与下载资源。"],
    ["Concern", "关注点"],
    ["AnswerLens approach", "AnswerLens 方式"],
    ["Secrets", "密钥"],
    ["Provider keys stay in your own shell, CI environment, or Actions secrets.", "provider key 保留在你自己的 shell、CI 环境或 Actions secrets 中。"],
    ["Hosted control plane", "托管控制平面"],
    ["No hosted AnswerLens SaaS is required for the CLI, the GitHub Action, or the static report flow.", "无论 CLI、GitHub Action 还是静态报告流，都不需要托管式 AnswerLens SaaS。"],
    ["Review trail", "审阅轨迹"],
    ["Use pull requests, Action logs, uploaded artifacts, and repo history as the audit trail.", "可用 pull request、Action 日志、上传产物和仓库历史作为审计轨迹。"],
    ["Public sharing", "公开分享"],
    ["Share <code>share-summary.md</code> or <code>pr-snippet.md</code> and keep raw payloads private.", "公开分享时优先使用 <code>share-summary.md</code> 或 <code>pr-snippet.md</code>，原始 payload 保持私有。"],
    ["Dimension", "维度"],
    ["Dashboard-first AI visibility tools", "看板式 AI 可见性工具"],
    ["Primary output", "核心产出"],
    ["Repo-native reports, scorecards, and fix lists", "仓库内报告、评分卡和修复清单"],
    ["Managed monitoring views and dashboards", "托管式监测视图和 dashboard"],
    ["Operating model", "运行模式"],
    ["Usually hosted and dashboard-centered", "通常为托管式、以 dashboard 为中心"],
    ["Review workflow", "审阅工作流"],
    ["PRs, release notes, Pages, and artifacts", "PR、release notes、Pages 和 artifacts"],
    ["Vendor UI plus exported summaries", "厂商 UI 加导出的摘要"],
    ["No consumer UI scraping and no ranking promises", "不抓取消费级 UI，也不承诺排名"],
    ["Varies by vendor and monitoring method", "因厂商和监测方式而异"],
    ["Runs the same artifact contract in pull requests, workflow_dispatch runs, and artifact uploads.", "在 pull request、workflow_dispatch 运行和产物上传中复用同一套 artifact 契约。"],
    ["Adds eval-mode benchmarking when you want answer quality checks on top of audit.", "当你希望在 audit 之上增加答案质量检查时，补充 eval 模式基准。"],
    ["Validates key-page evidence against imported page-level Search Console exports.", "用导入的页面级 Search Console 导出结果来校验关键页面证据。"],
    ["Adds helper-mode validation and candidate URL preparation without live submission.", "在不实时提交的前提下，补充辅助验证和候选 URL 准备。"],
    ["Turns demo outputs and docs into reusable public distribution surfaces.", "把 demo 输出和文档转成可复用的公开分发表面。"],
    ["Thin key page", "关键页面内容过薄"],
    ["Add plain-language explanations, evidence blocks, and stronger sections.", "补充通俗解释、证据模块和更强的章节结构。"],
    ["Tighten structure and schema alignment on key pages", "强化关键页面的结构与 schema 对齐"],
    ["Higher extraction quality and fewer ambiguous summaries.", "提高抽取质量，减少含糊总结。"],
    ["pending eval", "待评估"],
    ["<code>https://fixture.local</code> is the stable hostname inside the public demo fixture, not the AnswerLens site URL.", "<code>https://fixture.local</code> 是公开演示 fixture 中使用的稳定主机名，不是 AnswerLens 的官网地址。"],
    ["static-good demo 的 artifacts、share summaries 与示例报告输出。", "static-good demo 的产物、share summary 与示例报告输出。"],
    ["示例 AnswerLens report artifacts generated from the static-good fixture.", "由 static-good fixture 生成的 AnswerLens 示例报告产物。"],
    ["fixture 输出会被当作公开示例 artifacts。", "fixture 输出会被当作公开示例产物。"],
    ["static-good fixture 是 share summaries、scorecards、recommendations 与 HTML report outputs 的稳定来源。", "static-good fixture 是 share summary、scorecard、recommendations 和 HTML 报告输出的稳定来源。"],
    ["这个公开示例会把 consumer-repo starter bundle 跑在稳定 fixture 上，让外部 adopter 在接自己站点之前，先看到最终 artifacts 长什么样。", "这个公开示例会把 consumer-repo 接入文件跑在稳定示例站点上，让外部采用者在接自己站点之前，先看到最终产物长什么样。"],
    ["before you hand this path to another repository.", "再把这条路径交给另一个仓库。"],
    ["保持固定的审阅顺序： <code>share-summary.md</code>, then <code>scorecard.md</code>, then <code>recommendations.md</code>.", "保持固定的审阅顺序：先看 <code>share-summary.md</code>，再看 <code>scorecard.md</code>，最后看 <code>recommendations.md</code>。"],
    ["示例 files", "示例文件"],
    ["add plain-language explanations, evidence blocks, and stronger sections.", "补充通俗解释、证据模块和更强的章节结构。"],
    ["模式： audit", "模式：审计"],
    ["Integration surface 它能做什么", "集成入口 它能做什么"],
    ["公开分享 公开分享时优先使用", "公开分享 优先使用"]
  ];

  return replacements.reduce((current, [from, to]) => current.split(from).join(to), html);
}

function renderLanguageSelector(siteUrl: string, route: string, locale: Locale): string {
  const current = localeToSlug(locale);
  const alternate = localeToSlug(otherLocale(locale));
  return `<div class="locale-switcher"><span>${escapeHtml(t(locale, "lang.label"))}:</span> <a href="${escapeHtml(new URL(localizePath(route, locale), siteUrl).href)}">${escapeHtml(current === "en" ? t(locale, "lang.english") : t(locale, "lang.chinese"))}</a> / <a href="${escapeHtml(new URL(localizePath(route, otherLocale(locale)), siteUrl).href)}">${escapeHtml(alternate === "en" ? t(locale, "lang.english") : t(locale, "lang.chinese"))}</a></div>`;
}

function buildPageSeo(siteUrl: string, page: PageSpec, updatedAt: string, locale: Locale): SeoPage {
  return buildSeoPage({
    siteUrl,
    route: page.route,
    locale,
    title: resolveLocalizedText(page.title, locale),
    description: resolveLocalizedText(page.description, locale),
    lastModified: updatedAt,
    kind: page.seoKind,
    ogImage: new URL("assets/social-preview.png", siteUrl).href,
    ogImageAlt:
      locale === "zh-CN"
        ? "AnswerLens AI 可发现性审计报告截图，展示 scorecard、share summary 和 recommendations。"
        : "AnswerLens AI visibility audit report screenshot showing scorecard, share summary, and recommendations."
  });
}

function renderStartBar(siteUrl: string, locale: Locale): string {
  const demoHref = new URL(localizePath("examples/", locale), siteUrl).href;
  const quickstartHref = repoBlob(locale === "zh-CN" ? "docs/zh/quickstart.md" : "docs/quickstart.md");
  const copy =
    locale === "zh-CN"
      ? "第一次来？先看在线演示报告，再在你的公开站点上做一次 5 分钟检查。"
      : "New here? Open the demo report, then run a 5-minute check on one public site.";
  const demoLabel = locale === "zh-CN" ? "看演示" : "Open demo";
  const quickstartLabel = locale === "zh-CN" ? "开始 5 分钟检查" : "Start 5-minute check";
  return `<aside class="startBar"><p>${escapeHtml(copy)}</p><div class="startActions"><a href="${escapeHtml(demoHref)}">${escapeHtml(demoLabel)}</a><a href="${escapeHtml(quickstartHref)}">${escapeHtml(quickstartLabel)}</a></div></aside>`;
}

function renderLayout(siteUrl: string, page: PageSpec, updatedAt: string, locale: Locale, latestReleaseVersion: string): string {
  const pageBody = resolveLocalizedText(page.body, locale);
  const seoPage = buildPageSeo(siteUrl, page, updatedAt, locale);
  const ogImage = seoPage.ogImage;
  const navLink = (route: string, label: string): string => {
    const currentAttr = page.route === route ? ' aria-current="page"' : "";
    return `<a href="${escapeHtml(new URL(localizePath(route, locale), siteUrl).href)}"${currentAttr}>${escapeHtml(label)}</a>`;
  };

  const rendered = `<!doctype html>
<html lang="${locale === "zh-CN" ? "zh-CN" : "en"}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    ${renderSeoHead(seoPage)}
    <style>
      :root{color-scheme:light;--bg:#f6f8fb;--bg-accent:#eef7f4;--surface:#ffffff;--surface-strong:#ffffff;--surface-soft:#eef4f1;--line:#d8dee8;--line-strong:#0f766e;--ink:#111827;--muted:#5d6678;--accent:#0f766e;--accent-strong:#134e4a;--accent-warm:#b45309;--shadow:0 18px 46px rgba(16,24,40,.08)}
      *{box-sizing:border-box}
      html{background:var(--bg)}
      body{margin:0;min-height:100vh;overflow-x:hidden;font-family:"Segoe UI Variable Display","Aptos","Segoe UI",system-ui,-apple-system,BlinkMacSystemFont,sans-serif;line-height:1.6;letter-spacing:0;background:linear-gradient(180deg,#ffffff 0%,var(--bg) 46%,var(--bg-accent) 100%);color:var(--ink);-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
      body::before{content:"";position:fixed;inset:0;pointer-events:none;opacity:.32;background-image:linear-gradient(rgba(15,23,42,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(15,23,42,.035) 1px,transparent 1px);background-size:56px 56px}
      a{color:var(--accent-strong);text-decoration-color:rgba(15,118,110,.28);text-underline-offset:.18em}
      a:hover{text-decoration-color:rgba(15,118,110,.72)}
      strong{color:var(--ink)}
      code{padding:.16em .42em;border:1px solid rgba(15,118,110,.16);border-radius:6px;background:rgba(15,118,110,.08);color:#134e4a;font-family:"Cascadia Code","SFMono-Regular",Consolas,monospace;font-size:.92em}
      *:focus-visible{outline:2px solid rgba(15,118,110,.72);outline-offset:3px;border-radius:6px}
      .shell{position:relative;z-index:1;width:calc(100% - 32px);max-width:1180px;margin:0 auto;padding:24px 0 80px}
      .topbar,.hero,.panel,.metric{position:relative;overflow:hidden;border:1px solid var(--line);background:var(--surface);box-shadow:var(--shadow)}
      .topbar{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:24px;align-items:end;padding:16px 18px;border-radius:8px;background:rgba(255,255,255,.9);backdrop-filter:blur(14px)}
      .brand{display:grid;gap:6px;max-width:44rem}
      .brand-name{display:inline-flex;align-items:center;gap:12px;width:max-content;color:var(--ink);text-decoration:none;font-size:1.04rem;font-weight:700;letter-spacing:0}
      .brand-name::before{content:"";width:12px;height:12px;border-radius:3px;background:#0f766e;box-shadow:0 0 0 5px rgba(15,118,110,.12)}
      .brand-copy{margin:0;color:var(--muted);font-size:.96rem;line-height:1.6}
      .nav{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:flex-end}
      .nav a{display:inline-flex;align-items:center;min-height:38px;padding:0 12px;border:1px solid transparent;border-radius:8px;color:var(--muted);text-decoration:none;transition:background .18s ease,border-color .18s ease,color .18s ease,transform .18s ease}
      .nav a:hover{color:var(--ink);border-color:rgba(15,118,110,.22);background:rgba(15,118,110,.08);transform:translateY(-1px)}
      .nav a[aria-current="page"]{color:var(--accent-strong);border-color:rgba(15,118,110,.26);background:rgba(15,118,110,.1);font-weight:700}
      .locale-switcher{display:inline-flex;align-items:center;gap:8px;margin:14px 4px 0;padding:8px 12px;border:1px solid var(--line);border-radius:8px;background:rgba(255,255,255,.72);backdrop-filter:blur(12px);color:var(--muted);font-size:.9rem}
      .locale-switcher a{color:var(--ink)}
      .startBar{display:flex;align-items:center;justify-content:space-between;gap:14px;margin:14px 4px 0;padding:12px 14px;border:1px solid rgba(15,118,110,.18);border-radius:8px;background:#f0f8f5;color:var(--ink)}
      .startBar p{margin:0;color:var(--muted)}
      .startActions{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:flex-end}
      .startActions a{display:inline-flex;align-items:center;justify-content:center;min-height:34px;padding:0 11px;border:1px solid rgba(15,118,110,.22);border-radius:8px;background:#ffffff;color:var(--accent-strong);font-weight:700;text-decoration:none}
      .startActions a:first-child{background:#0f766e;color:#ffffff;border-color:#0f766e}
      .content{display:grid;gap:28px;margin-top:24px;min-width:0}
      .content>.section{margin-top:0}
      .hero{display:grid;gap:16px;align-content:end;min-height:300px;padding:42px 44px;border-radius:8px;background:var(--surface)}
      .productHero{min-height:390px;border:0;box-shadow:none;color:#ffffff;background-image:linear-gradient(90deg,rgba(7,18,28,.98) 0%,rgba(7,18,28,.94) 44%,rgba(7,18,28,.42) 100%),url("${escapeHtml(new URL("assets/social-preview.png", siteUrl).href)}");background-size:cover;background-position:center right}
      .hero h1{position:relative;margin:0;max-width:18ch;font-size:3.55rem;line-height:1.06;font-weight:760;letter-spacing:0}
      .productHero h1{max-width:14ch;font-size:4.4rem;line-height:1}
      .locale-zh .hero h1{max-width:14ch;font-size:3.2rem;line-height:1.12;letter-spacing:0}
      .locale-zh .productHero h1{max-width:10ch;font-size:4rem;line-height:1.08}
      .hero p,.muted{position:relative;color:var(--muted)}
      .hero p{margin:0;max-width:62ch;font-size:1.05rem;line-height:1.75}
      .locale-zh .hero p{max-width:48ch}
      .productHero p{color:rgba(255,255,255,.88)}
      .productHero .eyebrow{color:#99f6e4}
      .heroActions{position:relative;display:flex;flex-wrap:wrap;gap:12px;margin-top:6px}
      .productHero .ctaLinkSecondary{background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.42);color:#ffffff}
      .productHero .ctaLinkSecondary:hover{background:rgba(255,255,255,.16);border-color:rgba(255,255,255,.68)}
      .eyebrow{position:relative;margin:0;color:var(--accent-strong);font-size:.76rem;font-weight:700;letter-spacing:0;text-transform:uppercase}
      .section{margin-top:30px;min-width:0}
      .sectionHeader{display:grid;gap:8px;width:100%;max-width:760px;margin-bottom:16px}
      .sectionHeader h2{margin:0;font-size:1.65rem;line-height:1.2;letter-spacing:0}
      .sectionHeader p:not(.eyebrow){margin:0;color:var(--muted)}
      .sectionHeader h2,.sectionHeader p,.hero p,.panel p,.journeyStep p{overflow-wrap:break-word}
      .grid{display:grid;gap:20px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));align-items:stretch}
      .panel,.metric{padding:24px 24px 26px;border-radius:8px}
      .panel>h2{margin:0 0 14px;font-size:1.18rem;line-height:1.2;letter-spacing:0}
      .panel h2:not(:first-child){margin-top:24px;font-size:1rem}
      .panel p{margin:0 0 14px}
      .panel> :last-child{margin-bottom:0}
      .panel p,.panel li,.panel td,.metric-helper,.footer{color:var(--muted)}
      .panel ul,.panel ol{margin:0;padding-left:1.2rem}
      .panel li+li{margin-top:10px}
      .panel table{width:100%;border-collapse:collapse}
      .panel th,.panel td{padding:12px 0;border-bottom:1px solid rgba(148,163,184,.12);text-align:left;vertical-align:top}
      .panel th{color:var(--ink);font-size:.84rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase}
      .panel tbody tr:last-child td{border-bottom:none;padding-bottom:0}
      .metric{display:grid;gap:12px;align-content:start;min-height:180px}
      .metric-label{margin:0;color:var(--accent-strong);font-size:.75rem;font-weight:700;letter-spacing:0;text-transform:uppercase}
      .metric-value{margin:0;font-size:3rem;line-height:1;letter-spacing:0;font-weight:740;color:var(--ink)}
      .metric-helper{margin:0;max-width:26ch;font-size:.97rem;line-height:1.65}
      .ctaGrid{display:grid;gap:20px;grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}
      .ctaCard{display:flex;flex-direction:column;justify-content:space-between;min-height:100%}
      .ctaCard p{color:var(--muted)}
      .ctaLink{display:inline-flex;align-items:center;justify-content:center;gap:8px;width:max-content;max-width:100%;min-height:48px;margin-top:22px;padding:0 16px;border-radius:8px;border:1px solid rgba(15,118,110,.28);background:#0f766e;color:#ffffff;text-decoration:none;font-weight:700;box-shadow:0 14px 30px rgba(15,118,110,.18);transition:transform .18s ease,filter .18s ease,border-color .18s ease,background .18s ease}
      .ctaLink:hover{text-decoration:none;transform:translateY(-1px);filter:brightness(1.04)}
      .ctaLinkSecondary{background:#ffffff;color:var(--accent-strong);box-shadow:none}
      .ctaLinkSecondary:hover{border-color:rgba(15,118,110,.44);background:#f1f8f5}
      .journey{padding:0}
      .stepGrid{display:grid;gap:14px;grid-template-columns:repeat(4,minmax(0,1fr));list-style:none;margin:0;padding:0}
      .journeyStep{display:grid;gap:10px;align-content:start;min-height:230px;padding:20px;border:1px solid var(--line);border-radius:8px;background:var(--surface);box-shadow:var(--shadow)}
      .journeyStep h3{margin:0;font-size:1.05rem;line-height:1.25}
      .journeyStep p{margin:0;color:var(--muted)}
      .journeyStep a{align-self:end;font-weight:700;text-decoration-thickness:1px}
      .stepNumber{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:8px;background:#0f766e;color:#ffffff;font-weight:760}
      .artifactRail{display:grid;gap:12px;grid-template-columns:repeat(3,minmax(0,1fr));margin-top:14px}
      .artifactItem{padding:16px;border:1px solid var(--line);border-radius:8px;background:#f8fafc}
      .artifactItem strong{display:block;margin-bottom:6px}
      .artifactItem p{margin:0;color:var(--muted)}
      .starterPreview{display:block;width:100%;height:auto;margin:0 0 16px;border:1px solid var(--line);border-radius:8px;background:#ffffff}
      .callout{margin-top:16px;padding:30px;background:#f0f8f5;border-color:rgba(15,118,110,.22)}
      .callout h2{font-size:1.34rem}
      .markdown{margin:0;padding:18px 20px;border:1px solid var(--line);border-radius:8px;background:#0f172a;color:#e5edf7;white-space:pre-wrap;overflow:auto;font-family:"Cascadia Code","SFMono-Regular",Consolas,monospace;font-size:.94rem;line-height:1.62}
      .footer{margin:4px 0 0;padding:8px 4px 0;font-size:.92rem;line-height:1.6}
      @media (max-width:980px){.topbar{grid-template-columns:1fr;align-items:start}.nav{justify-content:flex-start}.hero{min-height:280px}.stepGrid{grid-template-columns:repeat(2,minmax(0,1fr))}.artifactRail{grid-template-columns:1fr}.productHero{min-height:400px}}
      @media (max-width:720px){.brand-copy{display:none}.nav{gap:6px}.nav a{min-height:34px;padding:0 10px;font-size:.92rem}.startBar{align-items:flex-start;flex-direction:column}.startActions{justify-content:flex-start}.panel table{display:block;overflow-x:auto;white-space:nowrap}}
      @media (max-width:640px){.shell{width:calc(100% - 20px);padding:10px 0 56px}.topbar{gap:10px;padding:12px 14px}.brand-copy{display:none}.nav{flex-wrap:nowrap;gap:4px;width:100%;overflow-x:auto;padding-bottom:2px;scrollbar-width:none}.nav::-webkit-scrollbar{display:none}.locale-zh .nav{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:2px;overflow:visible}.nav a{flex:0 0 auto;min-height:31px;padding:0 9px;font-size:.86rem}.locale-zh .nav a{justify-content:center;min-width:0;padding:0 2px;font-size:.8rem}.locale-switcher{margin-top:10px;padding:7px 10px}.startBar{margin-top:10px;padding:10px 12px}.startActions{display:grid;grid-template-columns:1fr;width:100%}.locale-zh .startActions{grid-template-columns:repeat(2,minmax(0,1fr))}.startActions a{width:100%;min-height:32px;white-space:nowrap}.locale-zh .startActions a{padding:0 8px;font-size:.94rem}.content{gap:18px;margin-top:18px}.hero{gap:12px;min-height:auto;padding:18px 16px}.productHero{min-height:360px;background-image:linear-gradient(90deg,rgba(7,18,28,.98) 0%,rgba(7,18,28,.94) 100%),url("${escapeHtml(new URL("assets/social-preview.png", siteUrl).href)}");background-position:66% center}.hero .eyebrow{order:1}.hero h1{order:2;max-width:unset;font-size:1.86rem;line-height:1.1;text-wrap:balance}.hero p:not(.eyebrow){order:3}.heroActions{order:4;display:grid;grid-template-columns:1fr;width:100%;margin-top:0;gap:8px}.productHero h1{font-size:2.7rem;line-height:1.04}.locale-zh .hero h1{font-size:1.58rem;line-height:1.16}.locale-zh .productHero h1{font-size:2.24rem;line-height:1.12}.hero p{font-size:.95rem;line-height:1.5}.locale-zh .hero p{font-size:.9rem;line-height:1.48}.sectionHeader h2{font-size:1.36rem;line-height:1.24}.panel,.metric,.journeyStep{padding:20px}.grid,.ctaGrid,.stepGrid{grid-template-columns:1fr}.ctaLink{width:100%}.heroActions .ctaLink{min-height:42px;margin-top:0}.metric-value{font-size:2.35rem}}
    </style>
    ${renderJsonLd(seoPage, { pageJsonLd: page.jsonLd, latestReleaseVersion })}
  </head>
  <body class="${locale === "zh-CN" ? "locale-zh" : "locale-en"}">
    <div class="shell">
      <header class="topbar">
        <div class="brand">
          <a class="brand-name" href="${escapeHtml(new URL(localizePath("", locale), siteUrl).href)}">AnswerLens</a>
          <p class="brand-copy">${escapeHtml(t(locale, "brand.siteSummary"))}</p>
        </div>
        <nav class="nav">
          ${navLink("", t(locale, "nav.home"))}
          ${navLink("examples/", t(locale, "nav.examples"))}
          ${navLink("docs/", t(locale, "nav.docs"))}
          ${navLink("playbooks/", t(locale, "nav.playbooks"))}
          ${navLink("starter/", t(locale, "nav.starter"))}
          ${navLink("releases/", t(locale, "nav.releases"))}
          <a href="${escapeHtml(REPO_URL)}">${escapeHtml(t(locale, "nav.github"))}</a>
        </nav>
      </header>
      ${renderLanguageSelector(siteUrl, page.route, locale)}
      ${renderStartBar(siteUrl, locale)}
      <main class="content">
        ${pageBody}
      </main>
      <p class="footer">${escapeHtml(t(locale, "footer.distribution"))}</p>
    </div>
  </body>
</html>`;

  const localizedLinks = localizeAbsoluteSiteLinks(rendered, siteUrl, locale);
  const localizedDocs = localizeRepoDocLinks(localizedLinks, locale);
  return locale === "zh-CN" ? translateSiteHtml(localizedDocs) : localizedDocs;
}

function localeIndexPath(outDir: string, route: string, locale: Locale): string {
  return path.join(outDir, localizePath(route, locale), "index.html");
}

async function copyLocalizedRun(sourceDir: string, targetDir: string, locale: Locale): Promise<void> {
  await rm(targetDir, { recursive: true, force: true });
  await cp(sourceDir, targetDir, { recursive: true, force: true });

  if (locale === "en") {
    return;
  }

  const localizedMarkdownFiles = [
    "share-summary",
    "scorecard",
    "recommendations",
    "pr-snippet",
    "eval-summary",
    "before-after-diff",
    "citation-gap-matrix",
    "search-console-summary",
    "bing-summary",
    "indexnow-summary"
  ];

  for (const baseName of localizedMarkdownFiles) {
    const zhPath = path.join(targetDir, `${baseName}.zh.md`);
    const basePath = path.join(targetDir, `${baseName}.md`);
    try {
      await cp(zhPath, basePath, { force: true });
    } catch {
      // ignore when that artifact does not exist for this run type
    }
  }

  try {
    await cp(path.join(targetDir, "index.zh.html"), path.join(targetDir, "index.html"), { force: true });
  } catch {
    // ignore when the localized HTML report has not been emitted
  }
}

function renderLocaleRedirectPage(siteUrl: string, route: string): string {
  const fallback = new URL(localizePath(route, "en"), siteUrl).href;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="refresh" content="0; url=${escapeHtml(fallback)}" />
    <link rel="canonical" href="${escapeHtml(fallback)}" />
    <script>
      (function () {
        var stored = window.localStorage.getItem(${JSON.stringify(LOCALE_STORAGE_KEY)});
        var preferred = stored || (navigator.languages && navigator.languages[0]) || navigator.language || "en";
        var target = /^zh/i.test(preferred) ? ${JSON.stringify(new URL(localizePath(route, "zh-CN"), siteUrl).href)} : ${JSON.stringify(fallback)};
        window.location.replace(target);
      })();
    </script>
    <title>AnswerLens locale redirect</title>
  </head>
  <body>
    <p><a href="${escapeHtml(fallback)}">Continue</a></p>
  </body>
</html>`;
}

function renderFixedRedirectPage(targetUrl: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="refresh" content="0; url=${escapeHtml(targetUrl)}" />
    <link rel="canonical" href="${escapeHtml(targetUrl)}" />
    <script>window.location.replace(${JSON.stringify(targetUrl)});</script>
    <title>AnswerLens redirect</title>
  </head>
  <body>
    <p><a href="${escapeHtml(targetUrl)}">Continue</a></p>
  </body>
</html>`;
}

function localizeAbsoluteSiteLinks(html: string, siteUrl: string, locale: Locale): string {
  const headClose = html.indexOf("</head>");
  if (headClose === -1) {
    return localizeAbsoluteSiteLinksInFragment(html, siteUrl, locale);
  }

  const headEnd = headClose + "</head>".length;
  return `${html.slice(0, headEnd)}${localizeAbsoluteSiteLinksInFragment(html.slice(headEnd), siteUrl, locale)}`;
}

function localizeAbsoluteSiteLinksInFragment(html: string, siteUrl: string, locale: Locale): string {
  const slug = localeToSlug(locale);
  const escapedBase = siteUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.replace(
    new RegExp(`(href|src)="${escapedBase}(?!assets/|feed\\.xml|sitemap\\.xml|robots\\.txt|en/|zh/)([^"]*)"`, "g"),
    (match, attr: string, route: string) => {
      if (route.length === 0) {
        return match;
      }
      return `${attr}="${siteUrl}${slug}/${route}"`;
    }
  );
}

function localizeRepoDocLinks(html: string, locale: Locale): string {
  if (locale !== "zh-CN") {
    return html;
  }

  const replacements: Array<[string, string]> = [
    ["/blob/main/docs/quickstart.md", "/blob/main/docs/zh/quickstart.md"],
    ["/blob/main/docs/github-action.md", "/blob/main/docs/zh/github-action.md"],
    ["/blob/main/docs/manual-steps.md", "/blob/main/docs/zh/manual-steps.md"],
    ["/blob/main/docs/activation-plan.md", "/blob/main/docs/zh/activation-plan.md"],
    ["/blob/main/docs/distribution-plan.md", "/blob/main/docs/zh/distribution-plan.md"],
    ["/blob/main/docs/model-runtime.md", "/blob/main/docs/zh/model-runtime.md"],
    ["/blob/main/docs/admin-console.md", "/blob/main/docs/zh/admin-console.md"],
    ["/blob/main/README.md", "/blob/main/README.zh-CN.md"]
  ];

  return replacements.reduce((current, [from, to]) => current.split(from).join(to), html);
}

export async function buildSite(options: BuildSiteOptions = {}): Promise<void> {
  const repository = options.repository ?? process.env.GITHUB_REPOSITORY ?? DEFAULT_REPOSITORY;
  const siteUrl = withTrailingSlash(options.siteUrl ?? process.env.ANSWERLENS_SITE_URL ?? defaultSiteUrl(repository));
  const outDir = path.resolve(options.outDir ?? "dist/site");
  const demoRunDir = path.resolve(options.demoRunDir ?? "runs/static-good");
  const consumerRunDir = path.resolve(options.consumerRunDir ?? "runs/consumer-repo");
  const releasesPath = path.resolve(options.releasesPath ?? "scripts/distribution/releases-snapshot.json");

  const [
    shareSummary,
    runManifest,
    shareSummaryMarkdown,
    shareSummaryMarkdownZh,
    recommendationsMarkdown,
    recommendationsMarkdownZh,
    exampleMarkdown,
    exampleMarkdownZh,
    releases,
    consumerShareSummary,
    consumerRunManifest
  ] = await Promise.all([
    readJson<ShareSummary>(path.join(demoRunDir, "share-summary.json")),
    readJson<RunManifest>(path.join(demoRunDir, "run.json")),
    readFile(path.join(demoRunDir, "share-summary.md"), "utf8"),
    readFile(path.join(demoRunDir, "share-summary.zh.md"), "utf8"),
    readFile(path.join(demoRunDir, "recommendations.md"), "utf8"),
    readFile(path.join(demoRunDir, "recommendations.zh.md"), "utf8"),
    readFile(path.resolve("examples/shareable-summary.md"), "utf8"),
    readFile(path.resolve("examples/shareable-summary.zh.md"), "utf8"),
    readJson<ReleaseEntry[]>(releasesPath),
    readJson<ShareSummary>(path.join(consumerRunDir, "share-summary.json")),
    readJson<RunManifest>(path.join(consumerRunDir, "run.json"))
  ]);

  const updatedAt = formatDate(releases[0]?.published_at, shareSummary.run.generatedAt);
  const latestReleaseVersion = releases[0]?.tag_name ?? "v0.3.5";

  await mkdir(path.join(outDir, "docs"), { recursive: true });
  await mkdir(path.join(outDir, "releases"), { recursive: true });
  await mkdir(path.join(outDir, "examples"), { recursive: true });
  await mkdir(path.join(outDir, "starter"), { recursive: true });
  await mkdir(path.join(outDir, "playbooks"), { recursive: true });
  await mkdir(path.join(outDir, "en"), { recursive: true });
  await mkdir(path.join(outDir, "zh"), { recursive: true });
  await cp(path.resolve("assets"), path.join(outDir, "assets"), { recursive: true, force: true });
  await rm(path.join(outDir, "examples", "static-good"), { recursive: true, force: true });
  await rm(path.join(outDir, "starter", "example-run"), { recursive: true, force: true });
  await cp(demoRunDir, path.join(outDir, "examples", "static-good"), { recursive: true, force: true });
  await cp(consumerRunDir, path.join(outDir, "starter", "example-run"), { recursive: true, force: true });
  await copyLocalizedRun(demoRunDir, path.join(outDir, "en", "examples", "static-good"), "en");
  await copyLocalizedRun(demoRunDir, path.join(outDir, "zh", "examples", "static-good"), "zh-CN");
  await copyLocalizedRun(consumerRunDir, path.join(outDir, "en", "starter", "example-run"), "en");
  await copyLocalizedRun(consumerRunDir, path.join(outDir, "zh", "starter", "example-run"), "zh-CN");

  const docsIndexItems = [
    {
      file: "docs/activation-plan.md",
      title: { en: "Activation plan", "zh-CN": "激活计划" },
      text: {
        en: "Current operating focus for public entry points and adoption.",
        "zh-CN": "围绕公开入口和 adoption 的当前运营重点。"
      },
      group: { en: "Operate", "zh-CN": "运营" }
    },
    {
      file: "docs/quickstart.md",
      title: { en: "Quickstart", "zh-CN": "Quickstart" },
      text: {
        en: "Run one real-site audit before you wire CI.",
        "zh-CN": "在接 CI 之前，先跑一轮真实站点审计。"
      },
      group: { en: "Try", "zh-CN": "试用" }
    },
    {
      file: "docs/scoring.md",
      title: { en: "Scoring", "zh-CN": "评分" },
      text: {
        en: "Public scoring model and output contract.",
        "zh-CN": "公开评分模型和输出契约。"
      },
      group: { en: "Understand", "zh-CN": "理解" }
    },
    {
      file: "docs/concepts/schema-text-consistency.md",
      title: { en: "Schema-text consistency", "zh-CN": "Schema-text 一致性" },
      text: {
        en: "Why structured data and visible copy need to tell the same story.",
        "zh-CN": "解释结构化数据和可见文案为什么要讲同一个故事。"
      },
      group: { en: "Understand", "zh-CN": "理解" }
    },
    {
      file: "docs/concepts/evidence-density.md",
      title: { en: "Evidence density", "zh-CN": "证据密度" },
      text: {
        en: "How proof blocks help AI systems cite and compare pages.",
        "zh-CN": "说明 proof blocks 如何帮助 AI 系统引用和比较页面。"
      },
      group: { en: "Understand", "zh-CN": "理解" }
    },
    {
      file: "docs/github-action.md",
      title: { en: "GitHub Action", "zh-CN": "GitHub Action" },
      text: {
        en: "Reusable Action inputs, outputs, and review order.",
        "zh-CN": "可复用 Action 的输入、输出和审阅顺序。"
      },
      group: { en: "Adopt", "zh-CN": "接入" }
    },
    {
      file: "docs/starter-bundle.md",
      title: { en: "Starter bundle", "zh-CN": "Starter bundle" },
      text: {
        en: "Public external-repo layout for GitHub Actions setup.",
        "zh-CN": "面向 GitHub Action 设置的外部仓库布局。"
      },
      group: { en: "Adopt", "zh-CN": "接入" }
    },
    {
      file: "docs/model-runtime.md",
      title: { en: "Model runtime", "zh-CN": "模型运行配置" },
      text: {
        en: "Repository eval defaults, runtime.yaml precedence, and secret boundaries.",
        "zh-CN": "仓库内 eval 默认值、runtime.yaml 优先级和 secret 边界。"
      },
      group: { en: "Adopt", "zh-CN": "接入" }
    },
    {
      file: "docs/shareable-summary.md",
      title: { en: "Shareable summary", "zh-CN": "可分享摘要" },
      text: {
        en: "How report outputs become copy-ready public summaries.",
        "zh-CN": "说明报告输出如何变成可直接复用的公开摘要。"
      },
      group: { en: "Share", "zh-CN": "分享" }
    },
    {
      file: "docs/trust-and-safety.md",
      title: { en: "Trust and safety", "zh-CN": "信任与安全" },
      text: {
        en: "Secrets, raw payloads, BYOK, scoring, and public sharing boundaries.",
        "zh-CN": "说明 secrets、raw payload、BYOK、评分和公开分享边界。"
      },
      group: { en: "Trust", "zh-CN": "信任" }
    },
    {
      file: "docs/first-run-story.md",
      title: { en: "First-run story", "zh-CN": "首次运行故事" },
      text: {
        en: "Template for sharing a first run without turning it into a ranking claim.",
        "zh-CN": "用于分享首次运行、但不变成排名声明的模板。"
      },
      group: { en: "Share", "zh-CN": "分享" }
    },
    {
      file: "docs/self-dogfood-log.md",
      title: { en: "Self-dogfood log", "zh-CN": "自我应用日志" },
      text: {
        en: "Public-source-material improvement loop for AnswerLens itself.",
        "zh-CN": "AnswerLens 自身公开 source material 的改进循环记录。"
      },
      group: { en: "Operate", "zh-CN": "运营" }
    },
    {
      file: "docs/roadmap.md",
      title: { en: "Roadmap", "zh-CN": "路线图" },
      text: {
        en: "Canonical public roadmap and issue sequencing.",
        "zh-CN": "规范公开 roadmap 与 issue 顺序。"
      },
      group: { en: "Operate", "zh-CN": "运营" }
    },
    {
      file: "docs/distribution-plan.md",
      title: { en: "Distribution plan", "zh-CN": "分发计划" },
      text: {
        en: "P0, P1, and P2 distribution pages and metrics.",
        "zh-CN": "P0、P1、P2 分发页面与指标。"
      },
      group: { en: "Operate", "zh-CN": "运营" }
    },
    {
      file: "docs/manual-steps.md",
      title: { en: "Manual steps", "zh-CN": "人工步骤" },
      text: {
        en: "Minimal GitHub, npm, and Pages setup checklist.",
        "zh-CN": "最小 GitHub、npm 和 Pages 设置清单。"
      },
      group: { en: "Operate", "zh-CN": "运营" }
    }
  ];

  const localizedDocFiles = new Set([
    "docs/activation-plan.md",
    "docs/quickstart.md",
    "docs/github-action.md",
    "docs/model-runtime.md",
    "docs/distribution-plan.md",
    "docs/manual-steps.md"
  ]);
  const docFileForLocale = (file: string, locale: Locale): string =>
    locale === "zh-CN" && localizedDocFiles.has(file) ? file.replace("docs/", "docs/zh/") : file;

  const renderDocsCards = (locale: Locale): string =>
    docsIndexItems
      .map(({ file, title, text, group }) =>
        renderPanel(
          title[locale],
          group[locale],
        `<p>${escapeHtml(text[locale])}</p><p><a href="${escapeHtml(repoBlob(docFileForLocale(file, locale)))}">${escapeHtml(locale === "zh-CN" ? "打开文档" : "Open doc")}</a></p>`
        )
      )
      .join("");

  const renderReleaseCards = (locale: Locale): string =>
    releases.length
      ? releases
          .map((release) =>
            renderPanel(
              release.name ?? release.tag_name,
              formatReadableDate(release.published_at, updatedAt, locale),
              `<p>${escapeHtml(localizedReleaseSummary(release, locale))}</p><p><a href="${escapeHtml(release.html_url)}">${escapeHtml(locale === "zh-CN" ? "打开 GitHub 发布页" : "Open GitHub release")}</a></p>`
            )
          )
          .join("")
      : renderPanel(
          locale === "zh-CN" ? "暂无发布版本" : "No releases yet",
          locale === "zh-CN" ? "发布" : "Releases",
          locale === "zh-CN"
            ? "<p>还没有编译到可展示的发布元数据。</p>"
            : "<p>Release metadata has not been compiled yet.</p>"
        );

  const renderReleaseMetadataPanel = (locale: Locale): string => {
    const latestRelease = releases[0];
    const stableReleaseCount = releases.filter((release) => isStableReleaseTag(release.tag_name)).length;
    const latestSummary =
      latestRelease === undefined
        ? locale === "zh-CN"
          ? "待编译"
          : "pending"
        : `${latestRelease.tag_name} (${formatReadableDate(latestRelease.published_at, updatedAt, locale)})`;

    if (locale === "zh-CN") {
      return renderPanel(
        "发布元数据",
        "索引健康度",
        `<p>这个索引从 GitHub 发布元数据编译，并在 Pages 发布前由 SEO gate 检查数量、日期和排序。</p><ul>${renderList([
          `<strong>最新发布：</strong> ${escapeHtml(latestSummary)}`,
          `<strong>已编译发布数：</strong> ${String(releases.length)}`,
          `<strong>稳定 semver 发布数：</strong> ${String(stableReleaseCount)}`,
          "报告审阅顺序保持不变：<code>share-summary.md</code>、<code>scorecard.md</code>、<code>recommendations.md</code>。"
        ])}</ul>`
      );
    }

    return renderPanel(
      "Release metadata",
      "Snapshot health",
      `<p>This index is compiled from GitHub Releases metadata, then checked by the Pages SEO gate for count, dates, and ordering before publication.</p><ul>${renderList([
        `<strong>Latest release:</strong> ${escapeHtml(latestSummary)}`,
        `<strong>Compiled releases:</strong> ${String(releases.length)}`,
        `<strong>Stable semver releases:</strong> ${String(stableReleaseCount)}`,
        "The report review order stays fixed: <code>share-summary.md</code>, <code>scorecard.md</code>, then <code>recommendations.md</code>."
      ])}</ul>`
    );
  };

  const artifactLinks = shareSummary.artifacts
    .map((artifact) => `<li><a href="../examples/static-good/${escapeHtml(artifact)}">${escapeHtml(artifact)}</a></li>`)
    .join("");
  const firstIssue = shareSummary.topIssues[0];
  const firstFix = shareSummary.topRecommendations[0];
  const publicArtifactLinks = [
    "share-summary.md",
    "scorecard.md",
    "recommendations.md"
  ]
    .map(
      (artifact) =>
        `<li><a href="${escapeHtml(new URL(`examples/static-good/${artifact}`, siteUrl).href)}">${escapeHtml(artifact)}</a></li>`
    )
    .join("");
  const starterArtifactLinks = [
    "share-summary.md",
    "scorecard.md",
    "recommendations.md"
  ]
    .map(
      (artifact) =>
        `<li><a href="${escapeHtml(new URL(`starter/example-run/${artifact}`, siteUrl).href)}">${escapeHtml(artifact)}</a></li>`
    )
    .join("");
  const starterPacketPreviewUrl = new URL("assets/starter-packet-preview.svg", siteUrl).href;
  const proofPageUrls = {
    pricing: new URL("pricing/", siteUrl).href,
    security: new URL("security/", siteUrl).href,
    faq: new URL("faq/", siteUrl).href,
    compare: new URL("compare/", siteUrl).href,
    integrations: new URL("integrations/", siteUrl).href,
    starter: new URL("starter/", siteUrl).href,
    productMarketing: new URL("use-case/product-marketing/", siteUrl).href,
    developerAdvocacy: new URL("use-case/developer-advocacy/", siteUrl).href,
    openSource: new URL("use-case/open-source-maintainers/", siteUrl).href
  };
  const pricingTable = `
    <table>
      <thead>
        <tr><th>Area</th><th>Cost model</th><th>Notes</th></tr>
      </thead>
      <tbody>
        <tr><td>CLI audit</td><td>$0 provider cost</td><td>Basic <code>audit</code> runs do not require provider API keys.</td></tr>
        <tr><td>Eval runs</td><td>Bring your own provider bill</td><td>OpenAI and Perplexity usage stays in your own account.</td></tr>
        <tr><td>GitHub Action</td><td>Your repository runner minutes</td><td>The Action uploads review-safe report files and excludes raw payloads by default.</td></tr>
        <tr><td>Release assets and Pages</td><td>$0 to download</td><td>Demo bundles, the compiled site, and docs stay publicly accessible.</td></tr>
      </tbody>
    </table>`;
  const securityTable = `
    <table>
      <thead>
        <tr><th>Concern</th><th>AnswerLens approach</th></tr>
      </thead>
      <tbody>
        <tr><td>Secrets</td><td>Provider keys stay in your own shell, CI environment, or Actions secrets.</td></tr>
        <tr><td>Hosted control plane</td><td>No hosted AnswerLens SaaS is required for the CLI, the GitHub Action, or the static report flow.</td></tr>
        <tr><td>Review trail</td><td>Use pull requests, Action logs, uploaded reports, and repo history as the audit trail.</td></tr>
        <tr><td>Public sharing</td><td>Share <code>share-summary.md</code> or <code>pr-snippet.md</code> and keep raw payloads private.</td></tr>
      </tbody>
    </table>`;
  const compareTable = `
    <table>
      <thead>
        <tr><th>Dimension</th><th>AnswerLens</th><th>Dashboard-first AI visibility tools</th></tr>
      </thead>
      <tbody>
        <tr><td>Primary output</td><td>Repo-native reports, scorecards, and fix lists</td><td>Managed monitoring views and dashboards</td></tr>
        <tr><td>Operating model</td><td>CLI-first, GitHub-native, and BYOK</td><td>Usually hosted and dashboard-centered</td></tr>
        <tr><td>Review workflow</td><td>PRs, release notes, Pages, and report files</td><td>Vendor UI plus exported summaries</td></tr>
        <tr><td>Guardrails</td><td>No consumer UI scraping and no ranking promises</td><td>Varies by vendor and monitoring method</td></tr>
      </tbody>
    </table>`;
  const compareTableZh = `
    <table>
      <thead>
        <tr><th>维度</th><th>AnswerLens</th><th>看板式 AI 可见性工具</th></tr>
      </thead>
      <tbody>
        <tr><td>主要输出</td><td>仓库内可审阅的报告、评分卡和修复清单</td><td>托管式监测视图和看板</td></tr>
        <tr><td>工作方式</td><td>CLI、本地仓库和 GitHub Actions</td><td>通常是托管式、以看板为中心</td></tr>
        <tr><td>协作位置</td><td>PR、发布说明、Pages 与报告文件</td><td>厂商 UI 加导出摘要</td></tr>
        <tr><td>边界</td><td>不抓取消费级 AI UI，也不承诺答案面排名</td><td>取决于厂商与监测方式</td></tr>
      </tbody>
    </table>`;
  const integrationsTable = `
    <table>
      <thead>
        <tr><th>Integration</th><th>What it does</th></tr>
      </thead>
      <tbody>
        <tr><td>GitHub Action</td><td>Runs AnswerLens in pull requests, workflow_dispatch runs, and artifact uploads.</td></tr>
        <tr><td>OpenAI and Perplexity eval</td><td>Adds eval-mode benchmarking when you want answer quality checks on top of audit.</td></tr>
        <tr><td>Search Console import</td><td>Validates key-page evidence against imported page-level Search Console exports.</td></tr>
        <tr><td>Bing / IndexNow helper</td><td>Adds helper-mode validation and candidate URL preparation without live submission.</td></tr>
        <tr><td>Release assets and Pages</td><td>Turns demo outputs and docs into reusable public pages and downloads.</td></tr>
      </tbody>
    </table>`;
  const faqQuestions = [
    {
      question: "What does AnswerLens audit?",
      answer:
        "AnswerLens audits whether a product site is easy for AI systems to read, cite, compare, and recommend. It writes a share summary, scorecard, and recommendations your team can review."
    },
    {
      question: "Does AnswerLens scrape consumer AI apps?",
      answer:
        "No. AnswerLens keeps the non-goal explicit: no consumer AI UI scraping and no ranking guarantees on answer surfaces."
    },
    {
      question: "Do I need provider API keys to try it?",
      answer:
        "Not for a basic audit run. Provider keys are only needed when you want eval-mode benchmarking on top of the core site audit."
    },
    {
      question: "How do I start in under five minutes?",
      answer:
        "Start with the live demo report, run the sample-site demo locally, then use the 5-minute real-site quickstart before adding the GitHub Action."
    },
    {
      question: "How does pricing work today?",
      answer:
        "The project is open source, the CLI and Pages docs are public, and optional eval costs stay in your own provider account."
    }
  ];

  const pages: PageSpec[] = [
    {
      route: "",
      filePath: path.join(outDir, "index.html"),
      title: {
        en: "AnswerLens: CLI-first AI visibility auditor for product websites",
        "zh-CN": "AnswerLens：AI 可发现性审计器与 GitHub 原生报告工作流"
      },
      description: {
        en: "AnswerLens is a CLI-first AI visibility auditor for product websites that checks whether public pages are clear, evidenced, and easy to review.",
        "zh-CN": "AnswerLens 检查公开产品页面是否清楚、有证据、便于审阅，并生成可进入 GitHub 工作流的报告。"
      },
      body: {
        en: `<section class="hero productHero"><p class="eyebrow">${escapeHtml(TAGLINE)}</p><h1>AnswerLens</h1><p>AnswerLens is a CLI-first AI visibility auditor for product websites. Use it when your website is the source material for AI answers. It checks whether public product pages are clear, evidenced, and easy to review, then writes GitHub-ready report files.</p><div class="heroActions"><a class="ctaLink" href="${escapeHtml(new URL("examples/static-good/index.html", siteUrl).href)}">Open demo report</a><a class="ctaLink ctaLinkSecondary" href="${escapeHtml(repoBlob("docs/quickstart.md"))}">Run your site</a></div></section>
        <section class="section">
          <div class="sectionHeader"><p class="eyebrow">Product fit</p><h2>Does AnswerLens fit your site?</h2><p>It is built for teams that want public pages and GitHub review to stay in sync. It is not a hosted monitoring dashboard, a ranking tool, or a consumer AI scraper.</p></div>
          <div class="grid">
            ${renderPanel("Check the public story", "What it checks", "<p>Can someone understand your category, proof, pricing, comparisons, and setup path from the public page alone? AnswerLens checks those signals, plus schema and internal links.</p>")}
            ${renderPanel("Review the evidence", "What it outputs", "<p>The product surface is the report set: <code>share-summary.md</code>, <code>scorecard.md</code>, <code>recommendations.md</code>, and JSON results your team can review in PRs or issues.</p>")}
            ${renderPanel("Best fit", "Who should use it", "<p>Use it when product marketing, docs, developer advocacy, or open-source maintainers share responsibility for pages that need to stay understandable and citable.</p>")}
          </div>
        </section>
        <section class="section journey">
          <div class="sectionHeader"><p class="eyebrow">Try it in this order</p><h2>See the output before setup, then run one real page.</h2><p>Start with a finished report, recreate it locally, run one public product site, and add GitHub Actions only after the report is worth reviewing again.</p></div>
          <ol class="stepGrid">
            ${renderJourneyStep("1", "Open the demo report", "Inspect the finished HTML report, summary, scorecard, and recommendations before installing anything.", new URL("examples/static-good/index.html", siteUrl).href, "Open demo")}
            ${renderJourneyStep("2", "Run the sample site", "Recreate the same output locally so the command and report files are familiar before you use your own URL.", `${REPO_URL}#run-the-60-second-fixture-demo`, "Run sample")}
            ${renderJourneyStep("3", "Audit one public site", "Run the quickstart against one product page set and read the summary before changing copy or wiring CI.", repoBlob("docs/quickstart.md"), "Open quickstart")}
            ${renderJourneyStep("4", "Add the Action", "Move the same report set into pull requests with the pinned starter workflow.", repoBlob("docs/github-action.md"), "Open Action docs")}
          </ol>
        </section>
        <section class="section grid">
          ${renderMetric("Demo score", String(shareSummary.metrics.overallScore ?? "pending"), "Current score from the stable public sample site.")}
          ${renderMetric("Key pages", String(shareSummary.metrics.keyPageCount ?? "pending"), "Critical pages found in the demo site.")}
          ${renderMetric("First report", "share-summary.md", "Start here before reading the scorecard and recommendations.")}
          ${renderMetric("Latest release", releases[0]?.tag_name ?? "pending", "Current published version line.")}
        </section>
        <section class="section">
          <article class="panel callout"><p class="eyebrow">Report package</p><h2>You get a report set your team can actually review.</h2><p>The useful output is simple: a short summary, a scorecard, and a fix list you can discuss in product, docs, or PR review.</p><div class="artifactRail"><div class="artifactItem"><strong>share-summary.md</strong><p>Share the audit in a PR, issue, or team note.</p></div><div class="artifactItem"><strong>scorecard.md</strong><p>Inspect the score, page coverage, and failed checks.</p></div><div class="artifactItem"><strong>recommendations.md</strong><p>Turn gaps into copy, proof, and structure fixes.</p></div></div><p>When you need a versioned download, open <a href="${escapeHtml(new URL("releases/", siteUrl).href)}">the latest release</a>.</p></article>
        </section>
        <section class="section grid">
          ${renderPanel("What the demo says right now", "Current signal", `${renderSiteIdentity(shareSummary.site)}${firstIssue ? `<p><strong>Top issue:</strong> ${escapeHtml(firstIssue.title)} (${escapeHtml(firstIssue.severity)}) - ${escapeHtml(firstIssue.fixHint)}</p>` : "<p><strong>Top issue:</strong> none</p>"}${firstFix ? `<p><strong>Top fix:</strong> ${escapeHtml(firstFix.title)} - ${escapeHtml(firstFix.expectedOutcome)}</p>` : "<p><strong>Top fix:</strong> none</p>"}<p>Open reports in order: <code>share-summary.md</code>, then <code>scorecard.md</code>, then <code>recommendations.md</code>.</p><ul>${publicArtifactLinks}</ul>`)}
          ${renderPanel("What to read next", "Product pages", `<p>Open these pages when you need pricing, trust, FAQ, comparison, or setup context beyond the demo report.</p><ul>${renderList([
            `<a href="${escapeHtml(proofPageUrls.pricing)}">Pricing and packaging</a>: open-source, BYOK, and release-asset cost model.`,
            `<a href="${escapeHtml(proofPageUrls.security)}">Security and trust</a>: secrets, review flow, and non-goals in one page.`,
            `<a href="${escapeHtml(new URL("docs/", siteUrl).href)}">Docs index</a>: activation references, scoring notes, and GitHub Action usage.`,
            `<a href="${escapeHtml(proofPageUrls.starter)}">Starter bundle</a>: external <code>.github/answerlens/</code> layout before CI setup.`,
            `<a href="${escapeHtml(proofPageUrls.faq)}">FAQ</a>: first-run questions in visible, citable language.`,
            `<a href="${escapeHtml(proofPageUrls.compare)}">Compare</a>: how AnswerLens differs from dashboard-first AI visibility tools.`,
            `<a href="${escapeHtml(proofPageUrls.integrations)}">Integrations</a>: GitHub Actions and validation helpers together.`
          ])}</ul>`)}
        </section>
        <section class="section grid">
          ${renderPanel("Who usually reads next", "Team fit", `<p>These use-case pages show the jobs teams usually try first.</p><ul>${renderList([
            `<a href="${escapeHtml(proofPageUrls.productMarketing)}">Product marketing teams</a>: turn homepage, pricing, and comparison gaps into reviewable fixes.`,
            `<a href="${escapeHtml(proofPageUrls.developerAdvocacy)}">Developer advocacy teams</a>: strengthen docs, proof pages, and self-serve evaluation paths.`,
            `<a href="${escapeHtml(proofPageUrls.openSource)}">Open-source maintainers</a>: use README, releases, Pages, and reports as the public distribution stack.`
          ])}</ul>`)}
        </section>`,
        "zh-CN": `<section class="hero productHero"><p class="eyebrow">面向 AI 可发现性的 CI。</p><h1>AnswerLens</h1><p>当你的网站会成为 AI 回答的素材时，用 AnswerLens 检查公开产品页面是否清楚、有证据、便于审阅，并生成可进入 GitHub 工作流的报告。</p><div class="heroActions"><a class="ctaLink" href="${escapeHtml(new URL("examples/static-good/index.html", siteUrl).href)}">打开演示报告</a><a class="ctaLink ctaLinkSecondary" href="${escapeHtml(repoBlob("docs/zh/quickstart.md"))}">审计你的站点</a></div></section>
        <section class="section">
          <div class="sectionHeader"><p class="eyebrow">产品适配</p><h2>AnswerLens 是否适合你的站点？</h2><p>它适合希望公开页面和 GitHub 审阅保持同步的团队。它不是托管监测看板，不是排名工具，也不会抓取消费级 AI 应用界面。</p></div>
          <div class="grid">
            ${renderPanel("检查公开叙事", "它检查什么", "<p>别人只看公开页面，能不能理解你的品类、证据、定价、对比和上手路径？AnswerLens 会检查这些信号，也会看 schema 和内部链接。</p>")}
            ${renderPanel("审阅证据", "它输出什么", "<p>产品表面是一组报告：<code>share-summary.md</code>、<code>scorecard.md</code>、<code>recommendations.md</code> 和 JSON 结果，可以放进 PR 或 issue 审阅。</p>")}
            ${renderPanel("适合谁", "谁应该使用", "<p>适合由产品营销、文档、开发者关系或开源维护者共同负责的公开页面；这些页面需要保持可理解、可引用、可修复。</p>")}
          </div>
        </section>
        <section class="section journey">
          <div class="sectionHeader"><p class="eyebrow">按这个顺序试用</p><h2>先看输出，再设置；然后跑一个真实页面。</h2><p>先看一份完成的报告，在本地复现一次，再审计一个公开产品站点；只有当报告值得反复审阅时，再接入 GitHub Action。</p></div>
          <ol class="stepGrid">
            ${renderJourneyStep("1", "打开演示报告", "先看完成后的 HTML 报告、摘要、评分卡和修复建议，不需要安装任何东西。", new URL("examples/static-good/index.html", siteUrl).href, "打开演示")}
            ${renderJourneyStep("2", "运行示例站点", "在本地复现同一组输出，先熟悉命令和报告文件，再换成自己的网址。", `${REPO_URL}#run-the-60-second-fixture-demo`, "运行示例")}
            ${renderJourneyStep("3", "审计一个公开站点", "用 quickstart 跑一组公开产品页面，先读摘要，再决定是否改文案或接 CI。", repoBlob("docs/zh/quickstart.md"), "打开 quickstart")}
            ${renderJourneyStep("4", "添加 Action", "用固定版本的 starter workflow，把同一组报告放进 PR 审阅。", repoBlob("docs/zh/github-action.md"), "打开 Action 文档")}
          </ol>
        </section>
        <section class="section grid">
          ${renderMetric("演示分数", String(shareSummary.metrics.overallScore ?? "待生成"), "稳定公开示例站点的当前得分。")}
          ${renderMetric("关键页面数", String(shareSummary.metrics.keyPageCount ?? "待生成"), "这次演示里识别出的关键页面数量。")}
          ${renderMetric("先看哪份报告", "share-summary.md", "先看它，再看 scorecard 和 recommendations。")}
          ${renderMetric("最新版本", releases[0]?.tag_name ?? "待生成", "当前公开发布的版本线。")}
        </section>
        <section class="section">
          <article class="panel callout"><p class="eyebrow">报告文件</p><h2>你会得到一组团队真的能审阅的报告。</h2><p>结果不需要重新整理：一份摘要、一份评分卡、一份修复清单，产品、文档和 PR 审阅都能直接使用。</p><div class="artifactRail"><div class="artifactItem"><strong>share-summary.md</strong><p>把这轮审计放进 PR、issue 或团队记录。</p></div><div class="artifactItem"><strong>scorecard.md</strong><p>查看分数、页面覆盖和失败检查。</p></div><div class="artifactItem"><strong>recommendations.md</strong><p>把缺口转成文案、证明和结构修复。</p></div></div><p>需要固定版本下载时，再打开 <a href="${escapeHtml(new URL("releases/", siteUrl).href)}">最新发布</a>。</p></article>
        </section>
        <section class="section grid">
          ${renderPanel("这轮演示现在说明了什么", "当前信号", `${renderSiteIdentity(shareSummary.site)}${firstIssue ? `<p><strong>核心问题：</strong> ${escapeHtml(firstIssue.title)} (${escapeHtml(firstIssue.severity)}) - ${escapeHtml(firstIssue.fixHint)}</p>` : "<p><strong>核心问题：</strong> 无</p>"}${firstFix ? `<p><strong>优先修复：</strong> ${escapeHtml(firstFix.title)} - ${escapeHtml(firstFix.expectedOutcome)}</p>` : "<p><strong>优先修复：</strong> 无</p>"}<p>报告打开顺序保持固定：<code>share-summary.md</code>，然后 <code>scorecard.md</code>，最后 <code>recommendations.md</code>。</p><ul>${publicArtifactLinks}</ul>`)}
          ${renderPanel("接下来该读哪些公开页", "产品页面", `<p>如果你需要定价、信任、FAQ、对比和接入说明，而不只是演示报告，就继续看这些页面。</p><ul>${renderList([
            `<a href="${escapeHtml(proofPageUrls.pricing)}">定价与打包</a>：看开源、BYOK 和 release 资产的成本边界。`,
            `<a href="${escapeHtml(proofPageUrls.security)}">安全与信任</a>：把 secrets、审阅流和非目标放到同一页。`,
            `<a href="${escapeHtml(new URL("docs/", siteUrl).href)}">文档索引</a>：继续看快速开始、评分说明和 GitHub Action 用法。`,
            `<a href="${escapeHtml(proofPageUrls.starter)}">接入文件</a>：在接 CI 之前先看外部 <code>.github/answerlens/</code> 布局。`,
            `<a href="${escapeHtml(proofPageUrls.faq)}">FAQ</a>：用可引用的语言回答首次试用问题。`,
            `<a href="${escapeHtml(proofPageUrls.compare)}">对比页</a>：看 AnswerLens 和托管看板类工具的差异。`,
            `<a href="${escapeHtml(proofPageUrls.integrations)}">集成页</a>：把 GitHub Action 和验证辅助工具放到一起看。`
          ])}</ul>`)}
        </section>
        <section class="section grid">
          ${renderPanel("哪些团队通常会继续往下看", "团队适配", `<p>这些使用场景会展示团队最常用的第一批任务。</p><ul>${renderList([
            `<a href="${escapeHtml(proofPageUrls.productMarketing)}">产品营销团队</a>：把首页、定价页和对比内容缺口变成可审阅的修复项。`,
            `<a href="${escapeHtml(proofPageUrls.developerAdvocacy)}">开发者关系团队</a>：强化文档、示例和自助试用路径。`,
            `<a href="${escapeHtml(proofPageUrls.openSource)}">开源维护者</a>：把 README、release、Pages 和报告当作公开分发栈。`
          ])}</ul>`)}
        </section>`
      },
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "AnswerLens",
          applicationCategory: "AI visibility auditor for product websites",
          description: `${DESCRIPTION} ${TAGLINE}`,
          operatingSystem: "Cross-platform",
          url: new URL("", siteUrl).href,
          codeRepository: REPO_URL
        },
        {
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "YSCJRH",
          url: REPO_URL
        }
      ]
    },
    {
      route: "docs/",
      filePath: path.join(outDir, "docs", "index.html"),
      title: {
        en: "Docs for acting on an AnswerLens report",
        "zh-CN": "拿到 AnswerLens 报告后该读什么"
      },
      description: {
        en: "Choose the next AnswerLens doc by task: understand a scorecard, fix one page, run your site, or add GitHub Actions.",
        "zh-CN": "按任务选择下一篇 AnswerLens 文档：读懂评分卡、修一个页面、审计自己的站点，或接入 GitHub Actions。"
      },
      body: {
        en: `<section class="hero"><p class="eyebrow">Product docs</p><h1>Have a report open? Pick the next doc by task.</h1><p>Start with share-summary.md, then scorecard.md. Then choose the document that explains the issue, helps you edit one page, or moves the same report into CI.</p><div class="heroActions"><a class="ctaLink" href="${escapeHtml(repoBlob("docs/quickstart.md"))}">Run your site</a><a class="ctaLink ctaLinkSecondary" href="${escapeHtml(new URL("playbooks/", siteUrl).href)}">Fix one page</a></div></section>
        <section class="section journey">
          <div class="sectionHeader"><p class="eyebrow">Choose by what you need to do</p><h2>Use docs to answer the question in front of you.</h2><p>Every path starts from the same report files: summary, scorecard, recommendations. Pick one action, read the matching doc, then come back to the report.</p></div>
          <ol class="stepGrid">
            ${renderJourneyStep("1", "Understand the score", "Use scoring notes to understand what the summary and scorecard are telling you.", repoBlob("docs/scoring.md"), "Open scoring")}
            ${renderJourneyStep("2", "Explain a failed check", "Use concept docs when schema, evidence, or page-structure problems need context.", repoBlob("docs/concepts/schema-text-consistency.md"), "Open concepts")}
            ${renderJourneyStep("3", "Run your own site", "Use quickstart after the demo so the docs turn into one real audit.", repoBlob("docs/quickstart.md"), "Open quickstart")}
            ${renderJourneyStep("4", "Add the Action", "Use the Action only after the local report already feels reviewable.", repoBlob("docs/github-action.md"), "Open Action docs")}
          </ol>
        </section>
        <section class="section grid">${renderDocsCards("en")}</section>
        <section class="section grid">${renderPanel("Choose the next product page", "Where to go next", `<p>Open these pages when the report raises a buyer, trust, setup, or positioning question.</p><ul>${renderList([
          `<a href="${escapeHtml(proofPageUrls.pricing)}">Pricing</a>: open-source packaging, provider costs, and setup paths.`,
          `<a href="${escapeHtml(proofPageUrls.security)}">Security</a>: secrets, review flow, and trust guardrails.`,
          `<a href="${escapeHtml(proofPageUrls.faq)}">FAQ</a>: first-run questions in visible, citable language.`,
          `<a href="${escapeHtml(proofPageUrls.compare)}">Compare</a>: how AnswerLens differs from Profound, Peec AI, and Otterly.`,
          `<a href="${escapeHtml(proofPageUrls.integrations)}">Integrations</a>: GitHub Action, providers, and validation helpers.`,
          `<a href="${escapeHtml(proofPageUrls.starter)}">Starter bundle</a>: external-repo layout and report review order.`,
          `<a href="${escapeHtml(proofPageUrls.productMarketing)}">Product marketing teams</a>: homepage and proof-page hardening.`,
          `<a href="${escapeHtml(proofPageUrls.developerAdvocacy)}">Developer advocacy teams</a>: docs, examples, and self-serve proof.`,
          `<a href="${escapeHtml(proofPageUrls.openSource)}">Open-source maintainers</a>: README, Pages, releases, and report-first distribution.`
        ])}</ul>`)}${renderPanel("Report files", "Review order", `<p>After you read the docs, go back to the report files in the same order used everywhere else:</p><div class="artifactRail"><div class="artifactItem"><strong><a href="${escapeHtml(new URL("examples/static-good/share-summary.md", siteUrl).href)}">share-summary.md</a></strong><p>Start with the human-readable audit summary.</p></div><div class="artifactItem"><strong><a href="${escapeHtml(new URL("examples/static-good/scorecard.md", siteUrl).href)}">scorecard.md</a></strong><p>Inspect coverage, checks, and scoring.</p></div><div class="artifactItem"><strong><a href="${escapeHtml(new URL("examples/static-good/recommendations.md", siteUrl).href)}">recommendations.md</a></strong><p>Turn issues into fixes.</p></div></div><p>Then continue to the <a href="${escapeHtml(repoBlob("docs/quickstart.md"))}">real-site quickstart</a> or the <a href="${escapeHtml(repoBlob("docs/github-action.md"))}">GitHub Action path</a>.</p>`)}</section>`,
        "zh-CN": `<section class="hero"><p class="eyebrow">产品文档</p><h1>报告已打开？<br>下一步读哪篇？</h1><p>先看 share-summary.md，再看 scorecard.md，然后按你要做的事选择文档：解释问题、改一个页面，或把同一组报告接入 CI。</p><div class="heroActions"><a class="ctaLink" href="${escapeHtml(repoBlob("docs/zh/quickstart.md"))}">审计你的站点</a><a class="ctaLink ctaLinkSecondary" href="${escapeHtml(new URL("playbooks/", siteUrl).href)}">修一个页面</a></div></section>
        <section class="section journey">
          <div class="sectionHeader"><p class="eyebrow">按下一步选择</p><h2>用文档回答眼前这个问题。</h2><p>每条路径都从同一组报告文件开始：摘要、评分卡、修复建议。先选一个动作，读对应文档，再回到报告继续审阅。</p></div>
          <ol class="stepGrid">
            ${renderJourneyStep("1", "读懂分数", "用评分说明理解摘要和评分卡到底在提醒什么。", repoBlob("docs/scoring.md"), "打开评分说明")}
            ${renderJourneyStep("2", "解释失败项", "当结构化数据、证据或页面结构问题需要上下文时，继续看概念文档。", repoBlob("docs/concepts/schema-text-consistency.md"), "打开概念文档")}
            ${renderJourneyStep("3", "跑自己的站点", "看完演示后用 quickstart，把文档转成一次真实审计。", repoBlob("docs/zh/quickstart.md"), "打开 quickstart")}
            ${renderJourneyStep("4", "接入 Action", "本地报告已经能审阅之后，再进入 Action 路径。", repoBlob("docs/zh/github-action.md"), "打开 Action 文档")}
          </ol>
        </section>
        <section class="section grid">${renderDocsCards("zh-CN")}</section>
        <section class="section grid">${renderPanel("报告提出了产品问题？", "继续读哪里", `<p>如果报告暴露的是价格、信任、定位或接入问题，就打开对应页面继续看。</p><ul>${renderList([
          `<a href="${escapeHtml(proofPageUrls.pricing)}">定价</a>：开源打包、自带 API key 的成本和接入方式。`,
          `<a href="${escapeHtml(proofPageUrls.security)}">安全</a>：secrets、审阅流和信任边界。`,
          `<a href="${escapeHtml(proofPageUrls.faq)}">FAQ</a>：用可引用的语言回答首次试用问题。`,
          `<a href="${escapeHtml(proofPageUrls.compare)}">对比</a>：AnswerLens 与托管看板类工具的差异。`,
          `<a href="${escapeHtml(proofPageUrls.integrations)}">集成</a>：GitHub Action、模型评估和验证辅助工具。`,
          `<a href="${escapeHtml(proofPageUrls.starter)}">接入文件</a>：外部仓库布局和报告审阅顺序。`,
          `<a href="${escapeHtml(proofPageUrls.productMarketing)}">产品营销团队</a>：强化首页、定价页和对比页。`,
          `<a href="${escapeHtml(proofPageUrls.developerAdvocacy)}">开发者关系团队</a>：强化文档、示例和自助试用。`,
          `<a href="${escapeHtml(proofPageUrls.openSource)}">开源维护者</a>：把 README、Pages、releases 和报告变成公开入口。`
        ])}</ul>`)}${renderPanel("报告文件", "审阅顺序", `<p>读完文档之后，继续按同一个顺序回到报告文件：</p><div class="artifactRail"><div class="artifactItem"><strong><a href="${escapeHtml(new URL("examples/static-good/share-summary.md", siteUrl).href)}">share-summary.md</a></strong><p>先看人能直接读懂的审计摘要。</p></div><div class="artifactItem"><strong><a href="${escapeHtml(new URL("examples/static-good/scorecard.md", siteUrl).href)}">scorecard.md</a></strong><p>检查覆盖、规则和得分。</p></div><div class="artifactItem"><strong><a href="${escapeHtml(new URL("examples/static-good/recommendations.md", siteUrl).href)}">recommendations.md</a></strong><p>把问题转成修复动作。</p></div></div><p>然后继续进入 <a href="${escapeHtml(repoBlob("docs/zh/quickstart.md"))}">真实站点 quickstart</a> 或 <a href="${escapeHtml(repoBlob("docs/zh/github-action.md"))}">GitHub Action 路径</a>。</p>`)}</section>`
      },
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "AnswerLens docs",
        description: "Docs for understanding AnswerLens reports and choosing the next action.",
        url: new URL("docs/", siteUrl).href
      }
    },
    {
      route: "releases/",
      filePath: path.join(outDir, "releases", "index.html"),
      title: {
        en: "Release notes and downloadable distribution assets",
        "zh-CN": "AnswerLens 发布说明与下载资源"
      },
      description: {
        en: "Release index, version notes, and downloadable assets compiled from GitHub metadata.",
        "zh-CN": "从 GitHub 元数据生成的 AnswerLens 发布索引、版本说明和可下载资源。"
      },
      body: {
        en: `<section class="hero"><p class="eyebrow">Versioned distribution</p><h1>Download the latest AnswerLens release.</h1><p>This page keeps the current version, release notes, demo bundles, and compiled site bundle in one place.</p><div class="heroActions"><a class="ctaLink" href="${escapeHtml(releases[0]?.html_url ?? `${REPO_URL}/releases`)}">Open latest release</a><a class="ctaLink ctaLinkSecondary" href="${escapeHtml(new URL("examples/static-good/index.html", siteUrl).href)}">Open live demo</a></div></section>
        <section class="section grid">
          ${renderPanel("Use the latest release", "Start here", `<p>If you already know you need a versioned download, start here. If you are evaluating AnswerLens for the first time, open the demo report first.</p><ol><li><a href="${escapeHtml(new URL("examples/static-good/index.html", siteUrl).href)}">Open the live demo report</a></li><li><a href="${escapeHtml(REPO_URL)}#run-the-60-second-fixture-demo">Run the sample-site demo locally</a></li><li><a href="${escapeHtml(repoBlob("docs/quickstart.md"))}">Run a 5-minute real-site audit</a></li><li><a href="${escapeHtml(repoBlob("docs/github-action.md"))}">Add the GitHub Action</a></li><li>${releases[0]?.html_url ? `<a href="${escapeHtml(releases[0].html_url)}">Download the latest release assets</a>` : "Download the latest release assets"}</li></ol><p>Review reports in the same order each time: <code>share-summary.md</code>, <code>scorecard.md</code>, then <code>recommendations.md</code>.</p><p>After a safe first run, share artifacts through the <a href="${escapeHtml(SHOW_AND_TELL_DISCUSSION_URL)}">Show and tell Discussion form</a>.</p>`)}
          ${renderPanel("Release asset checklist", "What to download", `<p>Use release assets as the second public front door after the demo, fixture, real-site audit, and Action path make sense.</p><ul>${renderList([
            "<strong>CLI tarball</strong>: use the versioned package tarball when you need a pinned local CLI before npm is visible.",
            "<strong>answerlens-demo-audit.tar.gz</strong>: unpack the fixture report and review <code>share-summary.md</code>, then <code>scorecard.md</code>, then <code>recommendations.md</code>.",
            "<strong>answerlens-site.tar.gz</strong>: inspect the compiled Pages bundle when you need the exact docs, examples, starter, and release pages from that tag."
          ])}</ul><p>If <code>npm view @answerlens/cli</code> returns <code>404</code>, keep using release assets or a local checkout; do not present npm as activated.</p>`)}
          ${renderReleaseMetadataPanel("en")}
        </section>
        <section class="section grid">${renderReleaseCards("en")}</section>`,
        "zh-CN": `<section class="hero"><p class="eyebrow">版本化分发</p><h1>下载最新的 AnswerLens 发布版本。</h1><p>这个页面把当前版本、发布说明、demo bundle 和编译后的站点 bundle 放在同一个入口里，方便你按固定顺序评估和下载。</p><div class="heroActions"><a class="ctaLink" href="${escapeHtml(releases[0]?.html_url ?? `${REPO_URL}/releases`)}">打开最新发布</a><a class="ctaLink ctaLinkSecondary" href="${escapeHtml(new URL("examples/static-good/index.html", siteUrl).href)}">打开在线演示</a></div></section>
        <section class="section grid">
          ${renderPanel("使用最新发布版本", "从这里开始", `<p>如果你已经确定需要一个固定版本的下载包，可以从这里开始。如果你是第一次评估 AnswerLens，建议先打开在线演示报告。</p><ol><li><a href="${escapeHtml(new URL("examples/static-good/index.html", siteUrl).href)}">打开在线演示报告</a></li><li><a href="${escapeHtml(REPO_URL)}#run-the-60-second-fixture-demo">在本地运行 fixture 演示</a></li><li><a href="${escapeHtml(repoBlob("docs/zh/quickstart.md"))}">在真实公开站点上跑 5 分钟 quickstart</a></li><li><a href="${escapeHtml(repoBlob("docs/zh/github-action.md"))}">添加 GitHub Action</a></li><li>${releases[0]?.html_url ? `<a href="${escapeHtml(releases[0].html_url)}">下载最新发布资源</a>` : "下载最新发布资源"}</li></ol><p>每次都按同一顺序审阅报告：<code>share-summary.md</code>、<code>scorecard.md</code>，然后是 <code>recommendations.md</code>。</p><p>完成一次可公开讨论的 first run 后，可以用 <a href="${escapeHtml(SHOW_AND_TELL_DISCUSSION_URL)}">Show and tell Discussion form</a> 分享安全 artifact。</p>`)}
          ${renderPanel("release assets 检查清单", "下载什么", `<p>把 release assets 当作第二个公开入口：先看演示、跑 fixture、审计真实站点、理解 Action 路径，再下载固定版本资源。</p><ul>${renderList([
            "<strong>CLI tarball</strong>：npm package 可见之前，用版本化 tarball 跑固定版本 CLI。",
            "<strong>answerlens-demo-audit.tar.gz</strong>：解压 fixture 报告，并按 <code>share-summary.md</code>、<code>scorecard.md</code>、<code>recommendations.md</code> 的顺序审阅。",
            "<strong>answerlens-site.tar.gz</strong>：需要核对某个 tag 对应的 docs、examples、starter 和 release 页面时，查看编译后的 Pages bundle。"
          ])}</ul><p>如果 <code>npm view @answerlens/cli</code> 返回 <code>404</code>，继续使用 release assets 或本地 checkout；不要把 npm 描述成已激活。</p>`)}
          ${renderReleaseMetadataPanel("zh-CN")}
        </section>
        <section class="section grid">${renderReleaseCards("zh-CN")}</section>`
      },
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "AnswerLens releases",
        description: "Versioned release index for AnswerLens.",
        url: new URL("releases/", siteUrl).href
      }
    },
    {
      route: "examples/",
      filePath: path.join(outDir, "examples", "index.html"),
      title: {
        en: "Demo report for evaluating AnswerLens",
        "zh-CN": "用于评估 AnswerLens 的演示报告"
      },
      description: {
        en: "Open a finished AnswerLens report, see the evidence your team would review, then run the same sample locally before trying your site.",
        "zh-CN": "先打开一份完成的 AnswerLens 报告，看清团队会审阅哪些证据，再本地复现示例并尝试自己的站点。"
      },
      body: {
        en: `<section class="hero"><p class="eyebrow">Demo report</p><h1>See the report before you run anything.</h1><p>The static-good demo shows the finished AnswerLens output: what changed, what is trustworthy, and which file to open first. Use it to decide whether the workflow is worth trying on one public site.</p><div class="heroActions"><a class="ctaLink" href="${escapeHtml(new URL("examples/static-good/index.html", siteUrl).href)}">Open demo report</a><a class="ctaLink ctaLinkSecondary" href="${escapeHtml(REPO_URL)}#run-the-60-second-fixture-demo">Run sample locally</a></div></section>
        <section class="section grid">
          ${renderMetric("Demo score", String(shareSummary.metrics.overallScore ?? "pending"), "The current sample-site score.")}
          ${renderMetric("Key pages", String(shareSummary.metrics.keyPageCount ?? "pending"), "Critical pages found in the demo site.")}
          ${renderMetric("Run kind", runManifest.kind, "The demo uses the core audit path.")}
          ${renderMetric("Report schema", shareSummary.run.artifactVersion, "Report artifact contract, not the package release.")}
        </section>
        <section class="section">
          <article class="panel callout"><p class="eyebrow">What to look at</p><h2>Start with the summary, then check the scorecard and fixes.</h2><p>The demo is here to answer three visitor questions: what do I get, can I trust the evidence, and what would I do next?</p><div class="artifactRail"><div class="artifactItem"><strong><a href="${escapeHtml(new URL("examples/static-good/share-summary.md", siteUrl).href)}">share-summary.md</a></strong><p>Start here for the plain-language audit story.</p></div><div class="artifactItem"><strong><a href="${escapeHtml(new URL("examples/static-good/scorecard.md", siteUrl).href)}">scorecard.md</a></strong><p>Use this to verify coverage, checks, and score drivers.</p></div><div class="artifactItem"><strong><a href="${escapeHtml(new URL("examples/static-good/recommendations.md", siteUrl).href)}">recommendations.md</a></strong><p>Use this to turn gaps into page changes.</p></div></div></article>
        </section>
        <section class="section grid">
          ${renderPanel("Latest demo run", "Run metadata", `<ul>${renderList([
            `Site: ${escapeHtml(siteLabel(runManifest.site))}`,
            `Mode: ${escapeHtml(runManifest.kind)}`,
            `Generated: ${escapeHtml(formatReadableDate(runManifest.generatedAt, shareSummary.run.generatedAt))}`,
            `Artifact schema version: ${escapeHtml(shareSummary.run.artifactVersion)}`,
            `Rule version: ${escapeHtml(shareSummary.run.ruleVersion)}`
          ])}</ul>${fixtureHostNote(runManifest.site.baseUrl) ? `<p>${fixtureHostNote(runManifest.site.baseUrl)}</p>` : ""}`)}
          ${renderPanel("All generated files", "Reports", `<ul>${artifactLinks}</ul>`)}
        </section>
        <section class="section grid">
          ${renderPanel("Share summary contract", "Example", `<pre class="markdown">${escapeHtml(exampleMarkdown.trim())}</pre>`)}
          ${renderPanel("Latest run excerpt", "Report excerpt", `<pre class="markdown">${escapeHtml(shareSummaryMarkdown.trim())}</pre>`)}
        </section>
        <section class="section journey">
          <div class="sectionHeader"><p class="eyebrow">After the demo</p><h2>Make the demo useful on your own site.</h2><p>Once the output makes sense, recreate it locally, run one public product site, then move the same report set into GitHub Actions.</p></div>
          <ol class="stepGrid">
            ${renderJourneyStep("1", "Recreate the sample locally", "Generate the same report files on your machine and confirm the CLI path works.", `${REPO_URL}#run-the-60-second-fixture-demo`, "Run sample")}
            ${renderJourneyStep("2", "Audit one public site", "Use the 5-minute quickstart on a product site your team can inspect.", repoBlob("docs/quickstart.md"), "Open quickstart")}
            ${renderJourneyStep("3", "Review the first real report", "Read the summary, scorecard, and fixes before turning the path into CI.", proofPageUrls.starter, "Open starter")}
            ${renderJourneyStep("4", "Add the Action", "Put the same report files into pull requests after the local audit feels useful.", repoBlob("docs/github-action.md"), "Open Action docs")}
          </ol>
        </section>`,
        "zh-CN": `<section class="hero"><p class="eyebrow">演示报告</p><h1>先看报告，再决定要不要运行。</h1><p>static-good 演示展示的是 AnswerLens 完成后的输出：哪里有问题、哪些证据可信、第一份文件该打开什么。先用它判断这套工作流是否值得跑到一个公开站点上。</p><div class="heroActions"><a class="ctaLink" href="${escapeHtml(new URL("examples/static-good/index.html", siteUrl).href)}">打开演示报告</a><a class="ctaLink ctaLinkSecondary" href="${escapeHtml(REPO_URL)}#run-the-60-second-fixture-demo">本地运行示例</a></div></section>
        <section class="section grid">
          ${renderMetric("演示分数", String(shareSummary.metrics.overallScore ?? "待生成"), "当前示例站点得分。")}
          ${renderMetric("关键页面数", String(shareSummary.metrics.keyPageCount ?? "待生成"), "这次演示识别出的关键页面数量。")}
          ${renderMetric("运行类型", runManifest.kind === "audit" ? "audit" : runManifest.kind, "演示使用核心审计能力。")}
          ${renderMetric("报告格式", shareSummary.run.artifactVersion, "报告产物契约版本，不是软件发布版本。")}
        </section>
        <section class="section">
          <article class="panel callout"><p class="eyebrow">先看什么</p><h2>先读摘要，再查评分卡和修复建议。</h2><p>演示页要回答三个访客问题：我会得到什么、证据能不能相信、下一步该做什么？</p><div class="artifactRail"><div class="artifactItem"><strong><a href="${escapeHtml(new URL("examples/static-good/share-summary.md", siteUrl).href)}">share-summary.md</a></strong><p>先看这里，理解这轮审计在说什么。</p></div><div class="artifactItem"><strong><a href="${escapeHtml(new URL("examples/static-good/scorecard.md", siteUrl).href)}">scorecard.md</a></strong><p>用它核对覆盖范围、检查项和分数来源。</p></div><div class="artifactItem"><strong><a href="${escapeHtml(new URL("examples/static-good/recommendations.md", siteUrl).href)}">recommendations.md</a></strong><p>用它把缺口变成页面改动。</p></div></div></article>
        </section>
        <section class="section grid">
          ${renderPanel("最新演示运行", "运行元数据", `<ul>${renderList([
            `站点：${escapeHtml(siteLabel(runManifest.site))}`,
            `模式：${escapeHtml(runManifest.kind === "audit" ? "审计" : runManifest.kind)}`,
            `生成时间：${escapeHtml(formatReadableDate(runManifest.generatedAt, shareSummary.run.generatedAt, "zh-CN"))}`,
            `报告格式版本：${escapeHtml(shareSummary.run.artifactVersion)}`,
            `规则版本：${escapeHtml(shareSummary.run.ruleVersion)}`
          ])}</ul>${runManifest.site.baseUrl === "https://fixture.local" ? "<p><code>https://fixture.local</code> 是公开演示 fixture 中使用的稳定主机名，不是 AnswerLens 的官网地址。</p>" : ""}`)}
          ${renderPanel("这次演示会生成哪些文件", "报告文件", `<ul>${artifactLinks}</ul>`)}
        </section>
        <section class="section grid">
          ${renderPanel("分享摘要示例", "示例", `<pre class="markdown">${escapeHtml(exampleMarkdownZh.trim())}</pre>`)}
          ${renderPanel("本次运行的摘要摘录", "报告摘录", `<pre class="markdown">${escapeHtml(shareSummaryMarkdownZh.trim())}</pre>`)}
        </section>
        <section class="section journey">
          <div class="sectionHeader"><p class="eyebrow">看完演示后</p><h2>把演示用到你的站点上。</h2><p>输出已经看懂后，先在本地复现示例，再审计一个公开产品站点，最后把同一组报告接入 GitHub Actions。</p></div>
          <ol class="stepGrid">
            ${renderJourneyStep("1", "本地复现示例", "在你的机器上生成同一组报告，确认 CLI 路径可以跑通。", `${REPO_URL}#run-the-60-second-fixture-demo`, "运行示例")}
            ${renderJourneyStep("2", "审计一个公开站点", "用 5 分钟 quickstart 跑一个团队能查看的产品站点。", repoBlob("docs/zh/quickstart.md"), "打开 quickstart")}
            ${renderJourneyStep("3", "审阅第一份真实报告", "先读摘要、评分卡和修复建议，再把这条路径交给 CI。", proofPageUrls.starter, "打开接入文件")}
            ${renderJourneyStep("4", "添加 Action", "当本地运行已经足够可审阅时，再把同一组报告放进 pull request。", repoBlob("docs/zh/github-action.md"), "打开 Action 文档")}
          </ol>
        </section>`
      },
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "Dataset",
        name: "AnswerLens static-good fixture report",
        description: "Example AnswerLens reports generated from the sample site.",
        url: new URL("examples/", siteUrl).href,
        creator: {
          "@type": "Organization",
          name: "YSCJRH"
        }
      }
    },
    {
      route: "starter/",
      filePath: path.join(outDir, "starter", "index.html"),
      title: {
        en: "Copy AnswerLens into a GitHub repository",
        "zh-CN": "把 AnswerLens 接入 GitHub 仓库"
      },
      description: {
        en: "Turn one useful local AnswerLens audit into a GitHub Actions workflow with copyable config files and a pinned Action.",
        "zh-CN": "把一轮有用的本地 AnswerLens 审计，变成可复制配置文件和固定版本 Action 组成的 GitHub Actions 工作流。"
      },
      body: {
        en: `<section class="hero"><p class="eyebrow">CI handoff</p><h1>Turn one useful local audit into a GitHub Action.</h1><p>Use this page after the demo and one real-site run. It shows the files to copy, where secrets belong, and how to review the first CI result.</p><div class="heroActions"><a class="ctaLink" href="${escapeHtml(repoBlob("examples/consumer-repo/.github/workflows/answerlens.yml"))}">Open workflow</a><a class="ctaLink ctaLinkSecondary" href="${escapeHtml(new URL("starter/example-run/index.html", siteUrl).href)}">View example result</a></div></section>
        <section class="section journey">
          <div class="sectionHeader"><p class="eyebrow">CI setup</p><h2>Use these files after the local report makes sense.</h2><p>The setup gives you the same report set in CI: site settings, competitors, prompts, runtime defaults, and a pinned Action.</p></div>
          <ol class="stepGrid">
            ${renderJourneyStep("1", "Run a real-site audit", "Start with one useful local audit so the reports already make sense.", repoBlob("docs/quickstart.md"), "Open quickstart")}
            ${renderJourneyStep("2", "Copy the starter files", "Move the .github/answerlens files and workflow into the repository you want to audit.", repoBlob("examples/consumer-repo/.github"), "Open sources")}
            ${renderJourneyStep("3", "Set runtime defaults", "Keep non-secret eval defaults in runtime.yaml and keep provider keys in secrets.", repoBlob("examples/consumer-repo/.github/answerlens/runtime.yaml"), "Open runtime")}
            ${renderJourneyStep("4", "Use the pinned Action", "Run the reviewed stable release tag in pull requests or workflow_dispatch runs.", repoBlob("examples/consumer-repo/.github/workflows/answerlens.yml"), "Open workflow")}
          </ol>
        </section>
        <section class="section grid">
          ${renderPanel("Setup files", "External repo layout", `<pre class="markdown">.github/\n  answerlens/\n    brand.yaml\n    competitors.yaml\n    prompts.yaml\n    runtime.yaml\n  workflows/\n    answerlens.yml</pre><p>This is the same layout used by <a href="${escapeHtml(repoBlob("examples/consumer-repo/README.md"))}">examples/consumer-repo</a>.</p>`)}
          ${renderPanel("What each file does", "File roles", `<ul>${renderList([
            "<code>brand.yaml</code>: product name, domain, proof-page hints, and optional <code>site_display_name</code>.",
            "<code>competitors.yaml</code>: the declared comparison set for the category you actually sell into.",
            "<code>prompts.yaml</code>: buyer, comparison, and citation questions for your real audience.",
            "<code>runtime.yaml</code>: non-secret eval defaults for provider, model, locale, samples, timeout, and optional base URL.",
            "<code>answerlens.yml</code>: the GitHub Actions workflow that runs AnswerLens in CI and uploads the same report files, pinned to the current stable Action release."
          ])}</ul><p>The current starter workflow uses <code>YSCJRH/ai-visibility-auditor@v0.3.5</code>; after a newer release, update that pin only after reviewing the release notes.</p><p>Keep API keys in GitHub secrets or local environment variables, not in <code>runtime.yaml</code>.</p>`)}
        </section>
        <section class="section grid">
          ${renderPanel("Files to copy", "Copyable sources", `<ul>${renderList([
            `<a href="${escapeHtml(repoBlob("examples/consumer-repo/.github/answerlens/brand.yaml"))}">brand.yaml</a>`,
            `<a href="${escapeHtml(repoBlob("examples/consumer-repo/.github/answerlens/competitors.yaml"))}">competitors.yaml</a>`,
            `<a href="${escapeHtml(repoBlob("examples/consumer-repo/.github/answerlens/prompts.yaml"))}">prompts.yaml</a>`,
            `<a href="${escapeHtml(repoBlob("examples/consumer-repo/.github/answerlens/runtime.yaml"))}">runtime.yaml</a>`,
            `<a href="${escapeHtml(repoBlob("examples/consumer-repo/.github/workflows/answerlens.yml"))}">answerlens.yml</a>`
          ])}</ul>`)}
          ${renderPanel("Report review order", "Review flow", `<div class="artifactRail"><div class="artifactItem"><strong>share-summary.md</strong><p>Use this for the audit overview and PR summary.</p></div><div class="artifactItem"><strong>scorecard.md</strong><p>Use this to inspect coverage, checks, and scoring.</p></div><div class="artifactItem"><strong>recommendations.md</strong><p>Use this as the fix list after review.</p></div></div><p>Then use <code>pr-snippet.md</code> for GitHub copy and <code>run.json</code> for machine-readable metadata.</p>`)}
          ${renderPanel("PR review packet", "Copy into review", `<img class="starterPreview" src="${escapeHtml(starterPacketPreviewUrl)}" alt="AnswerLens starter packet preview" loading="lazy"><p>Use this after the first CI run so teammates know what to open and what not to publish.</p><pre class="markdown">AnswerLens first run:
- Start with share-summary.md, then open scorecard.md, then recommendations.md.
- Public-safe artifact: answerlens-report; raw/** is excluded by default.
- Boundary: AnswerLens audits public source material. No consumer AI UI scraping. No ranking or answer-placement guarantee.</pre>`)}
        </section>
        <section class="section grid">
          ${renderPanel("Starter example result", "Public example", `<p><strong>Example site:</strong> ${escapeHtml(siteLabel(consumerRunManifest.site))}</p><p>This public example runs the starter files against the sample site so external teams can inspect the reports before wiring their own site.</p><ul>${starterArtifactLinks}</ul>`)}
          ${renderPanel("What to do next", "Set up your repo", `<p>After the files are copied, keep the first run intentionally small:</p><ol><li>Replace the example product, domain, competitors, and prompts.</li><li>Set non-secret eval defaults in <code>runtime.yaml</code> and keep API keys in secrets.</li><li>If you want the lowest-friction first eval before hand-tuning fields, start with <code>profile: fast-first-eval</code>.</li><li>If you already have one readable OpenAI baseline and want a search-shaped second opinion, use <code>profile: perplexity-cross-check</code> as a temporary override.</li><li><a href="${escapeHtml(repoBlob("docs/github-action.md"))}">Move into GitHub Actions</a> when the local run already feels reviewable.</li></ol>`)}
          ${renderPanel("Related proof pages", "What this connects to", `<ul>${renderList([
            `<a href="${escapeHtml(new URL("examples/", siteUrl).href)}">Examples</a>: see the live demo report files first.`,
            `<a href="${escapeHtml(new URL("docs/", siteUrl).href)}">Docs</a>: activation references, scoring notes, and canonical Markdown.`,
            `<a href="${escapeHtml(proofPageUrls.integrations)}">Integrations</a>: see how the starter files fit into GitHub Actions.`,
            `<a href="${escapeHtml(new URL("releases/", siteUrl).href)}">Releases</a>: use release assets as the second public front door.`
          ])}</ul>`)}
        </section>`,
        "zh-CN": `<section class="hero"><p class="eyebrow">CI 交接</p><h1>把一轮有用的本地审计变成 GitHub Action。</h1><p>看完演示、跑过一次真实站点之后，再使用这一页。它会说明该复制哪些文件、密钥放在哪里，以及第一次 CI 结果该怎么看。</p><div class="heroActions"><a class="ctaLink" href="${escapeHtml(repoBlob("examples/consumer-repo/.github/workflows/answerlens.yml"))}">打开 workflow</a><a class="ctaLink ctaLinkSecondary" href="${escapeHtml(new URL("starter/example-run/index.html", siteUrl).href)}">查看示例结果</a></div></section>
        <section class="section journey">
          <div class="sectionHeader"><p class="eyebrow">CI 设置</p><h2>本地报告已经看懂之后，再复制这些文件。</h2><p>这套设置会在 CI 中生成同一组报告：站点设置、竞品、提示词、runtime 默认值，以及固定版本的 Action。</p></div>
          <ol class="stepGrid">
            ${renderJourneyStep("1", "先跑真实站点审计", "先有一轮有用的本地审计，让报告内容变得可理解。", repoBlob("docs/zh/quickstart.md"), "打开 quickstart")}
            ${renderJourneyStep("2", "复制接入文件", "把 .github/answerlens 文件和工作流移到你要审计的仓库里。", repoBlob("examples/consumer-repo/.github"), "打开来源")}
            ${renderJourneyStep("3", "设置 runtime 默认值", "把非密钥的评估默认值放进 runtime.yaml，把模型服务 key 留在 secrets。", repoBlob("examples/consumer-repo/.github/answerlens/runtime.yaml"), "打开 runtime")}
            ${renderJourneyStep("4", "使用固定版本的 Action", "在 pull request 或 workflow_dispatch 里运行经过审阅的稳定 release tag。", repoBlob("examples/consumer-repo/.github/workflows/answerlens.yml"), "打开工作流")}
          </ol>
        </section>
        <section class="section grid">
          ${renderPanel("设置文件", "外部仓库布局", `<pre class="markdown">.github/\n  answerlens/\n    brand.yaml\n    competitors.yaml\n    prompts.yaml\n    runtime.yaml\n  workflows/\n    answerlens.yml</pre><p>这就是 <a href="${escapeHtml(repoBlob("examples/consumer-repo/README.md"))}">examples/consumer-repo</a> 使用的同一套目录结构。</p>`)}
          ${renderPanel("每个文件分别负责什么", "文件职责", `<ul>${renderList([
            "<code>brand.yaml</code>：定义产品名、域名、proof-page 提示，以及可选的 <code>site_display_name</code>。",
            "<code>competitors.yaml</code>：声明你真正要打进去的竞品集合。",
            "<code>prompts.yaml</code>：写给真实买家与评估场景的比较、引用和推荐问题。",
            "<code>runtime.yaml</code>：保存非 secret 的 eval 默认值，例如 provider、model、locale、samples 和 timeout。",
            "<code>answerlens.yml</code>：在 CI 里运行 AnswerLens、上传同一组报告文件，并 pin 到当前稳定 Action release 的 GitHub Actions workflow。"
          ])}</ul><p>当前 starter workflow 使用 <code>YSCJRH/ai-visibility-auditor@v0.3.5</code>；有新 release 后，先读 release notes，再更新这个 pin。</p><p>API keys 继续放在 GitHub secrets 或本地环境变量里，不要写进 <code>runtime.yaml</code>。</p>`)}
        </section>
        <section class="section grid">
          ${renderPanel("需要复制的文件", "可复制来源", `<ul>${renderList([
            `<a href="${escapeHtml(repoBlob("examples/consumer-repo/.github/answerlens/brand.yaml"))}">brand.yaml</a>`,
            `<a href="${escapeHtml(repoBlob("examples/consumer-repo/.github/answerlens/competitors.yaml"))}">competitors.yaml</a>`,
            `<a href="${escapeHtml(repoBlob("examples/consumer-repo/.github/answerlens/prompts.yaml"))}">prompts.yaml</a>`,
            `<a href="${escapeHtml(repoBlob("examples/consumer-repo/.github/answerlens/runtime.yaml"))}">runtime.yaml</a>`,
            `<a href="${escapeHtml(repoBlob("examples/consumer-repo/.github/workflows/answerlens.yml"))}">answerlens.yml</a>`
          ])}</ul>`)}
          ${renderPanel("先按这个顺序审阅", "审阅顺序", `<div class="artifactRail"><div class="artifactItem"><strong>share-summary.md</strong><p>用于审计概览和 PR 摘要。</p></div><div class="artifactItem"><strong>scorecard.md</strong><p>用于检查覆盖、规则和得分。</p></div><div class="artifactItem"><strong>recommendations.md</strong><p>用于审阅后的修复清单。</p></div></div><p>看完这三份之后，再用 <code>pr-snippet.md</code> 处理 GitHub 文案，用 <code>run.json</code> 处理机器可读元数据。</p>`)}
          ${renderPanel("PR 审阅包", "复制到审阅里", `<img class="starterPreview" src="${escapeHtml(starterPacketPreviewUrl)}" alt="AnswerLens starter packet preview" loading="lazy"><p>第一次 CI 跑完后，用这一小段告诉团队先看什么、哪些内容不要公开。</p><pre class="markdown">AnswerLens first run:
- 先看 share-summary.md，再看 scorecard.md，最后看 recommendations.md。
- 可公开审阅的 artifact：answerlens-report；默认排除 raw/**。
- 边界：AnswerLens 审计公开 source material，不抓取消费级 AI UI，不承诺排名或答案展示位置。</pre>`)}
        </section>
        <section class="section grid">
          ${renderPanel("先看这次 starter 示例结果", "公开示例", `<p><strong>示例站点：</strong> ${escapeHtml(siteLabel(consumerRunManifest.site))}</p><p>这个公开示例会把 starter 文件跑在示例站点上，让外部团队在接自己站点之前，先看清最终报告会是什么样。</p><ul>${starterArtifactLinks}</ul>`)}
          ${renderPanel("把它接进真实仓库时怎么走", "设置你的仓库", `<p>文件复制完成后，第一轮保持小而清晰：</p><ol><li>替换示例产品、域名、竞品和 prompts。</li><li>把非 secret 的 eval 默认值放进 <code>runtime.yaml</code>，API keys 留在 secrets。</li><li>如果想先用最低摩擦的 eval，可以从 <code>profile: fast-first-eval</code> 开始。</li><li>如果已经有一轮可读的 OpenAI baseline，并想临时加一个 search-shaped 第二意见，可以使用 <code>profile: perplexity-cross-check</code>。</li><li>本地结果已经足够可审阅之后，<a href="${escapeHtml(repoBlob("docs/zh/github-action.md"))}">再进入 GitHub Action</a>。</li></ol>`)}
          ${renderPanel("这页应该和哪些公开页一起看", "相关证明页面", `<ul>${renderList([
            `<a href="${escapeHtml(new URL("examples/", siteUrl).href)}">示例页</a>：先看 live demo 的 artifact 组合。`,
            `<a href="${escapeHtml(new URL("docs/", siteUrl).href)}">文档页</a>：继续看上手路径、评分说明和规范文档。`,
            `<a href="${escapeHtml(proofPageUrls.integrations)}">集成页</a>：看接入文件如何进入 GitHub Actions 工作流。`,
            `<a href="${escapeHtml(new URL("releases/", siteUrl).href)}">发布页</a>：把发布资源当作第二个公开入口。`
          ])}</ul>`)}
        </section>`
      },
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: "AnswerLens GitHub Action handoff",
        description: "Copyable setup for moving one useful local AnswerLens audit into GitHub Actions.",
        url: new URL("starter/", siteUrl).href
      }
    },
    {
      route: "pricing/",
      filePath: path.join(outDir, "pricing", "index.html"),
      title: "Open-source pricing and packaging",
      description: "Open-source pricing, packaging, BYOK evaluation, and release-asset distribution for AnswerLens.",
      body: `<section class="hero"><p class="eyebrow">Pricing and packaging</p><h1>AnswerLens is open source. You bring the provider keys you choose.</h1><p>There is no hosted AnswerLens dashboard or seat-based license today. Basic audits run locally without provider keys; optional eval benchmarks use your own provider account and your own GitHub runner minutes.</p><div class="heroActions"><a class="ctaLink" href="${escapeHtml(new URL("examples/static-good/index.html", siteUrl).href)}">Open live demo</a><a class="ctaLink ctaLinkSecondary" href="${escapeHtml(proofPageUrls.starter)}">View starter</a></div></section>
        <section class="section grid">
          ${renderPanel("What costs $0", "Included", `<ul>${renderList([
            "The open-source repository, Pages site, and live demo report.",
            "The CLI workflow for a basic `audit` run with no provider key.",
            "The reusable GitHub Action and release downloads.",
            "Local sample-site demos, report bundles, and static review files."
          ])}</ul>`)}
          ${renderPanel("Where paid usage can appear", "Your accounts", pricingTable)}
        </section>
        <section class="section grid">
          ${renderPanel("Packaging choices", "How teams start", `<p>Teams usually look at the demo, run one local audit, and then add GitHub Actions. The package is intentionally simple:</p><ul>${renderList([
            "Release tarballs or a local checkout for CLI runs until the npm package is visible.",
            "The root GitHub Action for pull requests and manual workflow runs.",
            "Release assets for tarballs, demo bundles, and the compiled site bundle.",
            "Pages for docs, examples, playbooks, pricing, and trust pages."
          ])}</ul><p>That keeps pricing simple: the product is open source, optional eval uses your own API keys, and there is no hosted AnswerLens control plane fee today.</p>`)}
        </section>`,
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: "AnswerLens pricing and packaging",
        description: "Open-source pricing and packaging details for AnswerLens.",
        url: new URL("pricing/", siteUrl).href
      }
    },
    {
      route: "security/",
      filePath: path.join(outDir, "security", "index.html"),
      title: "Security, trust, and review guardrails",
      description: "Security and trust model for AnswerLens: your secrets, no hosted control plane, and reviewable GitHub reports.",
      body: `<section class="hero"><p class="eyebrow">Security and trust</p><h1>Security for AnswerLens starts with no hosted control plane.</h1><p>AnswerLens lets teams audit public product sites and review results inside GitHub without sending repo history or provider keys to a separate AnswerLens SaaS. It keeps the guardrails explicit: no consumer AI UI scraping, no ranking guarantees, and no dashboard-first rewrite.</p><div class="heroActions"><a class="ctaLink" href="${escapeHtml(proofPageUrls.starter)}">View starter</a><a class="ctaLink ctaLinkSecondary" href="${escapeHtml(repoBlob("docs/manual-steps.md"))}">Read manual steps</a></div></section>
        <section class="section grid">
          ${renderPanel("Trust model", "What stays under your control", `<ul>${renderList([
            "Provider API keys stay in your own shell, CI environment, or GitHub Actions secrets.",
            "The core `audit` workflow can run without provider keys at all.",
            "AnswerLens writes reviewable files such as `share-summary.md`, `scorecard.md`, and `recommendations.md` into your own run directory.",
            "Public sharing should use summary files, while raw provider payloads stay private."
          ])}</ul>`)}
          ${renderPanel("Review and deployment model", "Operational detail", securityTable)}
        </section>
        <section class="section grid">
          ${renderPanel("Known limits", "Guardrails", `<ul>${renderList([
            "AnswerLens does not claim SOC 2, ISO 27001, HIPAA, or other compliance programs for a hosted service because it is not operating as a hosted AnswerLens SaaS today.",
            "The project does not scrape consumer AI interfaces to fabricate visibility claims.",
            "The product does not promise rankings or placement on answer surfaces.",
            "Teams should still review reports before posting them to public issues, PRs, or release notes."
          ])}</ul><p>That keeps the trust story direct: use your own deployment path, your own secrets handling, and your own repository review process.</p>`)}
        </section>`,
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: "AnswerLens security and trust",
        description: "Security and trust model for AnswerLens.",
        url: new URL("security/", siteUrl).href
      }
    },
    {
      route: "faq/",
      filePath: path.join(outDir, "faq", "index.html"),
      title: "First-run FAQ and guardrails",
      description: "Frequently asked questions about what AnswerLens is, how it works, and what it does not claim.",
      body: `<section class="hero"><p class="eyebrow">First-run FAQ</p><h1>AnswerLens FAQ for new visitors and evaluators.</h1><p>Use these answers before you run quickstart, add GitHub Actions, or compare AnswerLens with hosted dashboard tools.</p><div class="heroActions"><a class="ctaLink" href="${escapeHtml(repoBlob("docs/quickstart.md"))}">Run quickstart</a><a class="ctaLink ctaLinkSecondary" href="${escapeHtml(proofPageUrls.compare)}">Compare options</a></div></section>
        <section class="section grid">
          ${renderPanel("Common questions", "What people ask first", faqQuestions.map((entry) => `<h2>${escapeHtml(entry.question)}</h2><p>${escapeHtml(entry.answer)}</p>`).join(""))}
          ${renderPanel("Related proof pages", "What to open next", `<ul>${renderList([
            `<a href="${escapeHtml(proofPageUrls.pricing)}">Pricing</a>: see the open-source package and provider-cost model.`,
            `<a href="${escapeHtml(proofPageUrls.security)}">Security</a>: review trust, secrets, and guardrails.`,
            `<a href="${escapeHtml(proofPageUrls.compare)}">Compare</a>: understand how AnswerLens differs from Profound, Peec AI, and Otterly.`,
            `<a href="${escapeHtml(proofPageUrls.integrations)}">Integrations</a>: review the GitHub Actions setup path.`,
            `<a href="${escapeHtml(new URL("docs/", siteUrl).href)}">Docs</a>: go deeper on activation, scoring, and Action usage.`
          ])}</ul>`)}
        </section>`,
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqQuestions.map((entry) => ({
            "@type": "Question",
            name: entry.question,
            acceptedAnswer: {
              "@type": "Answer",
              text: entry.answer
            }
          }))
        }
      ]
    },
    {
      route: "compare/",
      filePath: path.join(outDir, "compare", "index.html"),
      title: {
        en: "AnswerLens compared with Profound, Peec AI, and Otterly",
        "zh-CN": "AnswerLens 与 Profound、Peec AI、Otterly 的对比"
      },
      description: {
        en: "How AnswerLens differs from dashboard-first AI visibility tools such as Profound, Peec AI, and Otterly.",
        "zh-CN": "说明 AnswerLens 与 Profound、Peec AI、Otterly 等看板式 AI 可见性工具的区别。"
      },
      body: {
        en: `<section class="hero"><p class="eyebrow">Compare</p><h1>AnswerLens compared with Profound, Peec AI, and Otterly for GitHub-first teams.</h1><p>AnswerLens fits teams that want local audits, GitHub review, and clear fix lists instead of a hosted monitoring dashboard. Profound, Peec AI, and Otterly may fit teams that want managed monitoring or broader hosted visibility products.</p><div class="heroActions"><a class="ctaLink" href="${escapeHtml(new URL("examples/static-good/index.html", siteUrl).href)}">Open live demo</a><a class="ctaLink ctaLinkSecondary" href="${escapeHtml(proofPageUrls.pricing)}">Review pricing</a></div></section>
        <section class="section grid">
          ${renderPanel("Declared comparison set", "Current public comparison", `<ul>${renderList([
            "Profound: AI visibility platform with a hosted monitoring posture.",
            "Peec AI: AI search monitoring workflow with a productized SaaS dashboard.",
            "Otterly: AI visibility monitoring aimed at managed, ongoing tracking."
          ])}</ul>`)}
          ${renderPanel("How the workflow differs", "Repo-native vs dashboard-first", compareTable)}
        </section>
        <section class="section grid">
          ${renderPanel("When AnswerLens fits", "Decision criteria", `<ul>${renderList([
            "You want reports, scorecards, and fix lists that move through pull requests, issues, release notes, and Pages.",
            "You want provider usage to stay in your own account rather than hidden behind a hosted vendor product.",
            "You care more about improving source-material quality than claiming rank positions in AI answers.",
            "You want compare-ready, FAQ-ready, and proof-ready content gaps to be visible as report files, not only in a monitoring dashboard."
          ])}</ul>`)}
          ${renderPanel("Related proof pages", "Cross-linking", `<ul>${renderList([
            `<a href="${escapeHtml(proofPageUrls.pricing)}">Pricing</a>: compare packaging and cost posture.`,
            `<a href="${escapeHtml(proofPageUrls.security)}">Security</a>: compare trust and review models.`,
            `<a href="${escapeHtml(proofPageUrls.faq)}">FAQ</a>: compare first-run and guardrail answers.`,
            `<a href="${escapeHtml(proofPageUrls.integrations)}">Integrations</a>: compare GitHub Actions and validation helpers.`,
            `<a href="${escapeHtml(proofPageUrls.productMarketing)}">Product marketing teams</a>: see the fit for homepage and proof-page work.`,
            `<a href="${escapeHtml(proofPageUrls.developerAdvocacy)}">Developer advocacy teams</a>: see the fit for docs and self-serve evaluation.`
          ])}</ul>`)}
        </section>`,
        "zh-CN": `<section class="hero"><p class="eyebrow">对比</p><h1>AnswerLens 更适合想在 GitHub 里评审结果的团队。</h1><p>如果你要的是本地审计、可进 PR 的报告文件，以及围绕 README、Pages 和 release 展开的公开协作路径，AnswerLens 会更贴近这类工作方式。像 Profound、Peec AI、Otterly 这类工具，更适合偏托管监测或看板式产品的使用习惯。</p></section>
        <section class="section grid">
          ${renderPanel("当前公开对比对象", "公开对比对象", `<ul>${renderList([
            "Profound：更偏托管式 AI 可见性平台，强调持续监测与平台视图。",
            "Peec AI：更像产品化的 AI 搜索监测 SaaS，重心在持续追踪与外部界面。",
            "Otterly：偏向持续监控型工具，适合长期跟踪而非仓库内审阅。"
          ])}</ul>`)}
          ${renderPanel("工作流最核心的区别", "仓库内审阅 vs 看板式监测", compareTableZh)}
        </section>
        <section class="section grid">
          ${renderPanel("什么时候更适合选 AnswerLens", "决策标准", `<ul>${renderList([
            "你需要的是能进入 pull request、issue、发布说明和 Pages 的报告、评分卡与修复清单。",
            "你希望模型服务用量留在自己的账户里，而不是被包在托管厂商表面之后。",
            "你更在意把源材料写清楚、补齐证据和对比能力，而不是追求一个平台上的“排名承诺”。",
            "你想让对比页、FAQ 和证明页这类内容缺口，以报告文件的形式暴露出来，而不是只出现在监控看板里。"
          ])}</ul>`)}
          ${renderPanel("相关公开页应该一起看", "互链", `<ul>${renderList([
            `<a href="${escapeHtml(proofPageUrls.pricing)}">定价页</a>：对比打包方式和成本姿态。`,
            `<a href="${escapeHtml(proofPageUrls.security)}">安全页</a>：对比信任模型和审阅方式。`,
            `<a href="${escapeHtml(proofPageUrls.faq)}">FAQ</a>：对比首次试用问题与边界说明。`,
            `<a href="${escapeHtml(proofPageUrls.integrations)}">集成页</a>：对比 GitHub 工作流入口。`,
            `<a href="${escapeHtml(proofPageUrls.productMarketing)}">产品营销团队</a>：看首页、定价页和证明页这类场景是否更贴合。`,
            `<a href="${escapeHtml(proofPageUrls.developerAdvocacy)}">开发者关系团队</a>：看文档、示例和自助试用路径的适配度。`
          ])}</ul>`)}
        </section>`
      },
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: "AnswerLens compare page",
        description: "Comparison page for AnswerLens versus dashboard-first AI visibility tools.",
        url: new URL("compare/", siteUrl).href
      }
    },
    {
      route: "integrations/",
      filePath: path.join(outDir, "integrations", "index.html"),
      title: "GitHub, provider, and validation integrations",
      description: "GitHub Action, provider adapters, Search Console import, and helper integrations for AnswerLens.",
      body: `<section class="hero"><p class="eyebrow">Integrations</p><h1>Connect AnswerLens where your team already reviews work.</h1><p>Start with GitHub Actions for PR checks. Add provider-based evals, Search Console imports, or Bing helpers only when they help validate what the basic audit already found.</p><div class="heroActions"><a class="ctaLink" href="${escapeHtml(repoBlob("docs/github-action.md"))}">Open Action docs</a><a class="ctaLink ctaLinkSecondary" href="${escapeHtml(proofPageUrls.starter)}">View starter</a></div></section>
        <section class="section grid">
          ${renderPanel("Current integrations", "What ships now", integrationsTable)}
          ${renderPanel("How teams usually start", "Suggested path", `<ol><li>Open the live demo report.</li><li>Run the sample-site demo locally.</li><li>Run one real-site audit.</li><li>Add the GitHub Action when the report is useful.</li></ol><p>That order keeps setup understandable without turning every integration into a separate product.</p>`)}
          ${renderPanel("Starter files", "External setup", `<p>The external-repo setup is public and copyable.</p><p>Use the <a href="${escapeHtml(proofPageUrls.starter)}">starter overview</a> when you need a citable explanation of the <code>.github/answerlens/</code> layout before handing someone the raw example files.</p><p>That keeps the Action setup clear for forks, releases, and external guides.</p>`)}
          ${renderPanel("Related proof pages", "What this connects to", `<ul>${renderList([
            `<a href="${escapeHtml(proofPageUrls.faq)}">FAQ</a>: answer first-run workflow questions.`,
            `<a href="${escapeHtml(proofPageUrls.compare)}">Compare</a>: explain how the GitHub workflow differs from hosted dashboard products.`,
            `<a href="${escapeHtml(proofPageUrls.pricing)}">Pricing</a>: explain where Action and eval usage create variable cost.`,
            `<a href="${escapeHtml(proofPageUrls.security)}">Security</a>: explain secret handling and review expectations.`,
            `<a href="${escapeHtml(proofPageUrls.starter)}">Starter bundle</a>: show the external-repo layout and report review order.`,
            `<a href="${escapeHtml(proofPageUrls.developerAdvocacy)}">Developer advocacy teams</a>: connect integrations to docs and examples.`
          ])}</ul>`)}
        </section>`,
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: "AnswerLens integrations",
        description: "Integration surfaces for AnswerLens.",
        url: new URL("integrations/", siteUrl).href
      }
    },
    {
      route: "use-case/product-marketing/",
      filePath: path.join(outDir, "use-case", "product-marketing", "index.html"),
      title: "Use case for product marketing teams",
      description: "How product marketing teams can use AnswerLens to tighten homepage, proof, and comparison content.",
      body: `<section class="hero"><p class="eyebrow">Use case</p><h1>AnswerLens for product marketing teams.</h1><p>Use AnswerLens when product pages need to be easier for AI assistants to explain. It highlights category, positioning, proof, pricing, and comparison gaps that can make AI answers vague or incomplete.</p><div class="heroActions"><a class="ctaLink" href="${escapeHtml(new URL("examples/static-good/index.html", siteUrl).href)}">Open live demo</a><a class="ctaLink ctaLinkSecondary" href="${escapeHtml(new URL("playbooks/", siteUrl).href)}">Open playbooks</a></div></section>
        <section class="section grid">
          ${renderPanel("Where teams start", "Marketing pages", `<h2>Find the pages that undersell you</h2><p>Start with the homepage, docs, pricing, and comparison pages. Review the summary and scorecard first, then turn the recommendations into page-level fixes.</p><h2>Ship clearer buying evidence</h2><p>Teams usually tighten category language, add proof, and make pricing, FAQ, and comparison content easier to cite.</p><h2>Improve the source material</h2><p>The result is not a ranking promise. It is stronger public content that AI systems can quote, compare, and recommend more accurately.</p>`)}
          ${renderPanel("Related proof pages", "What to strengthen", `<ul>${renderList([
            `<a href="${escapeHtml(proofPageUrls.pricing)}">Pricing</a>: clarify packaging, provider costs, and download options.`,
            `<a href="${escapeHtml(proofPageUrls.compare)}">Compare</a>: explicitly name Profound, Peec AI, and Otterly with clearer fit guidance.`,
            `<a href="${escapeHtml(proofPageUrls.faq)}">FAQ</a>: answer recurring objections in visible language.`,
            `<a href="${escapeHtml(proofPageUrls.security)}">Security</a>: keep trust and deployment expectations legible.`,
            `<a href="${escapeHtml(new URL("docs/", siteUrl).href)}">Docs</a>: connect product claims back to implementation notes.`
          ])}</ul>`)}
        </section>`,
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: "AnswerLens for product marketing teams",
        description: "Use-case page for product marketing teams evaluating AnswerLens.",
        url: new URL("use-case/product-marketing/", siteUrl).href
      }
    },
    {
      route: "use-case/developer-advocacy/",
      filePath: path.join(outDir, "use-case", "developer-advocacy", "index.html"),
      title: "Use case for developer advocacy teams",
      description: "How developer advocacy teams can use AnswerLens to strengthen docs, examples, and self-serve proof pages.",
      body: `<section class="hero"><p class="eyebrow">Use case</p><h1>AnswerLens for developer advocacy teams.</h1><p>Use AnswerLens to make docs, examples, and setup guides easier to find and cite. It shows whether a developer can move from curiosity to a working first run without guessing.</p><div class="heroActions"><a class="ctaLink" href="${escapeHtml(new URL("docs/", siteUrl).href)}">Open docs</a><a class="ctaLink ctaLinkSecondary" href="${escapeHtml(new URL("examples/", siteUrl).href)}">View examples</a></div></section>
        <section class="section grid">
          ${renderPanel("Where teams focus", "Docs and examples", `<h2>Make setup easier to follow</h2><p>Review whether the docs index, setup guide, and API references are public, scannable, and linked from the homepage.</p><h2>Ship examples people can inspect</h2><p>Use Pages examples, release bundles, and sample-site reports as teaching material that can be linked directly from GitHub.</p><h2>Reduce first-run friction</h2><p>Keep quickstart and GitHub Actions aligned so new developers can move from the demo to their own repository without guesswork.</p>`)}
          ${renderPanel("Related proof pages", "What to connect", `<ul>${renderList([
            `<a href="${escapeHtml(new URL("docs/", siteUrl).href)}">Docs</a>: keep activation references and implementation notes visible.`,
            `<a href="${escapeHtml(proofPageUrls.integrations)}">Integrations</a>: explain GitHub Actions, providers, and validation helpers together.`,
            `<a href="${escapeHtml(proofPageUrls.faq)}">FAQ</a>: answer first-run setup questions before CI adoption.`,
            `<a href="${escapeHtml(proofPageUrls.compare)}">Compare</a>: explain why a GitHub workflow differs from hosted dashboard tools.`,
            `<a href="${escapeHtml(proofPageUrls.security)}">Security</a>: set expectations for secrets, reports, and public sharing.`
          ])}</ul>`)}
        </section>`,
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: "AnswerLens for developer advocacy teams",
        description: "Use-case page for developer advocacy teams evaluating AnswerLens.",
        url: new URL("use-case/developer-advocacy/", siteUrl).href
      }
    },
    {
      route: "use-case/open-source-maintainers/",
      filePath: path.join(outDir, "use-case", "open-source-maintainers", "index.html"),
      title: "Use case for open-source maintainers",
      description: "How open-source maintainers can use AnswerLens on README, Pages, releases, and demo reports.",
      body: `<section class="hero"><p class="eyebrow">Use case</p><h1>AnswerLens for open-source maintainers.</h1><p>Use AnswerLens when your README, Pages site, and releases are the front door. It helps you find unclear packaging, setup, and trust signals before adding more product surface area.</p><div class="heroActions"><a class="ctaLink" href="${escapeHtml(proofPageUrls.starter)}">View starter</a><a class="ctaLink ctaLinkSecondary" href="${escapeHtml(new URL("releases/", siteUrl).href)}">Open releases</a></div></section>
        <section class="section grid">
          ${renderPanel("Why maintainers use it", "GitHub distribution", `<h2>Check the repository as the product entry point</h2><p>Use the README as the canonical home, Pages as the audit target, and release notes as a versioned entry point.</p><h2>Review reports in GitHub</h2><p>AnswerLens turns unclear packaging problems into report files that can be discussed in issues, pull requests, and Discussions announcements.</p><h2>Share safe first-run evidence</h2><p>Route screenshots or public artifacts through the <a href="${escapeHtml(SHOW_AND_TELL_DISCUSSION_URL)}">Show and tell Discussion form</a> so reuse permission and raw-payload boundaries stay explicit.</p><h2>Repeat the check</h2><p>Improve public pages, run the audit again, and track whether the next round of feedback is easier to act on.</p>`)}
          ${renderPanel("Related proof pages", "What to keep aligned", `<ul>${renderList([
            `<a href="${escapeHtml(proofPageUrls.pricing)}">Pricing</a>: keep packaging claims concrete and citable.`,
            `<a href="${escapeHtml(proofPageUrls.security)}">Security</a>: keep trust language honest and reviewable.`,
            `<a href="${escapeHtml(proofPageUrls.compare)}">Compare</a>: explain the public positioning against adjacent tools.`,
            `<a href="${escapeHtml(proofPageUrls.integrations)}">Integrations</a>: keep the GitHub Actions setup visible.`,
            `<a href="${escapeHtml(proofPageUrls.faq)}">FAQ</a>: keep first-run questions cheap to answer.`
          ])}</ul>`)}
        </section>`,
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: "AnswerLens for open-source maintainers",
        description: "Use-case page for open-source maintainers evaluating AnswerLens.",
        url: new URL("use-case/open-source-maintainers/", siteUrl).href
      }
    },
    {
      route: "playbooks/",
      filePath: path.join(outDir, "playbooks", "index.html"),
      title: {
        en: "Fix one product page from an AnswerLens report",
        "zh-CN": "根据 AnswerLens 报告修好一个产品页面"
      },
      description: {
        en: "Choose one recommendation, update the page evidence or structure, then rerun AnswerLens before sharing the result.",
        "zh-CN": "从一条建议开始，更新页面证据或结构，再重新运行 AnswerLens 后分享结果。"
      },
      body: {
        en: `<section class="hero"><p class="eyebrow">Page fix</p><h1>Use one recommendation to improve one page.</h1><p>Playbooks are for the moment after you have a report open. Pick one recommendation, confirm the evidence, change the page, then rerun the audit so the next reviewer sees a fresh result.</p><div class="heroActions"><a class="ctaLink" href="${escapeHtml(new URL("examples/static-good/recommendations.md", siteUrl).href)}">Open fix list</a><a class="ctaLink ctaLinkSecondary" href="${escapeHtml(new URL("examples/static-good/index.html", siteUrl).href)}">Open demo report</a></div></section>
        <section class="section grid">
          ${renderPanel("Know what you are fixing", "Start here", `<p>Use this page after you have opened a demo or real-site report. Read the summary first, use the scorecard to confirm the issue, then choose one recommendation.</p><ul>${renderList([
            `<a href="${escapeHtml(new URL("examples/static-good/index.html", siteUrl).href)}">Open the demo report</a>`,
            `<a href="${escapeHtml(new URL("examples/static-good/share-summary.md", siteUrl).href)}">Read the plain-language summary</a>`,
            `<a href="${escapeHtml(repoBlob("docs/quickstart.md"))}">Run the 5-minute check on your site</a>`
          ])}</ul>`)}
          ${renderPanel("What the report found", "From the demo", `${firstIssue ? `<p><strong>${escapeHtml(firstIssue.title)}</strong></p><p>${escapeHtml(firstIssue.fixHint)}</p>` : "<p>No current demo issue.</p>"}`)}
          ${renderPanel("First page change", "Recommended action", `${firstFix ? `<p><strong>${escapeHtml(firstFix.title)}</strong></p><p>${escapeHtml(firstFix.expectedOutcome)}</p>` : "<p>No current recommendation.</p>"}`)}
        </section>
        <section class="section journey">
          <div class="sectionHeader"><p class="eyebrow">One-page fix path</p><h2>Confirm the issue, make the edit, rerun AnswerLens.</h2><p>Keep the work small enough to review: one issue, one page, one fresh report before the result moves into a pull request or team note.</p></div>
          <ol class="stepGrid">
            ${renderJourneyStep("1", "Start with the summary", "Use the short summary to explain the audit and decide whether the issue is worth acting on.", new URL("examples/static-good/share-summary.md", siteUrl).href, "Open summary")}
            ${renderJourneyStep("2", "Check the scorecard evidence", "Inspect the affected checks, pages, and evidence before changing copy.", new URL("examples/static-good/scorecard.md", siteUrl).href, "Open scorecard")}
            ${renderJourneyStep("3", "Change one page", "Use the recommendation to update page copy, proof, or structure.", new URL("examples/static-good/recommendations.md", siteUrl).href, "Open fix list")}
            ${renderJourneyStep("4", "Rerun before sharing", "Run the sample or a real-site audit again before moving the result into review.", repoBlob("docs/quickstart.md"), "Start 5-minute check")}
          </ol>
        </section>
        <section class="section grid">
          ${renderPanel("Current generated recommendation", "Demo report", `${firstFix ? `<p><strong>${escapeHtml(firstFix.title)}</strong></p><p>${escapeHtml(firstFix.expectedOutcome)}</p>` : "<p>No current recommendation.</p>"}<p>Open the <a href="${escapeHtml(new URL("examples/static-good/recommendations.md", siteUrl).href)}">full generated fix list</a>.</p>`)}
          ${renderPanel("Read this when the fix needs context", "Concept support", `<ul>${renderList([
            `<a href="${escapeHtml(repoBlob("docs/concepts/schema-text-consistency.md"))}">Keep structured data aligned</a>: match visible page copy with machine-readable data.`,
            `<a href="${escapeHtml(repoBlob("docs/concepts/evidence-density.md"))}">Add citeable evidence</a>: make proof easier to quote and compare.`,
            `<a href="${escapeHtml(repoBlob("docs/scoring.md"))}">Read the scorecard</a>: understand how issues affect the report.`,
            `<a href="${escapeHtml(repoBlob("docs/github-action.md"))}">Set up GitHub Actions</a>: put the same check into code review.`
          ])}</ul>`)}
        </section>`,
        "zh-CN": `<section class="hero"><p class="eyebrow">页面修复</p><h1>用一条建议改好一个页面。</h1><p>这一页是给已经打开报告的人使用的。先选一条建议，核对证据，再改页面，最后重新运行审计，让下一位审阅者看到新的结果。</p><div class="heroActions"><a class="ctaLink" href="${escapeHtml(new URL("examples/static-good/recommendations.md", siteUrl).href)}">打开修复清单</a><a class="ctaLink ctaLinkSecondary" href="${escapeHtml(new URL("examples/static-good/index.html", siteUrl).href)}">打开演示报告</a></div></section>
        <section class="section grid">
          ${renderPanel("先弄清要修什么", "从这里开始", `<p>请在打开演示或真实站点报告之后使用这一页。先读摘要，再用评分卡确认问题，最后只选择一条建议处理。</p><ul>${renderList([
            `<a href="${escapeHtml(new URL("examples/static-good/index.html", siteUrl).href)}">打开在线演示报告</a>`,
            `<a href="${escapeHtml(new URL("examples/static-good/share-summary.md", siteUrl).href)}">阅读摘要报告</a>`,
            `<a href="${escapeHtml(repoBlob("docs/zh/quickstart.md"))}">在你的站点上做 5 分钟检查</a>`
          ])}</ul>`)}
          ${renderPanel("报告发现了什么", "演示报告", `${firstIssue ? `<p><strong>${escapeHtml(firstIssue.title)}</strong></p><p>${escapeHtml(firstIssue.fixHint)}</p>` : "<p>当前演示没有问题。</p>"}`)}
          ${renderPanel("第一处页面改动", "建议动作", `${firstFix ? `<p><strong>${escapeHtml(firstFix.title)}</strong></p><p>${escapeHtml(firstFix.expectedOutcome)}</p>` : "<p>当前没有修复建议。</p>"}`)}
        </section>
        <section class="section journey">
          <div class="sectionHeader"><p class="eyebrow">一次只修一个页面</p><h2>确认问题，改页面，再重新运行 AnswerLens。</h2><p>这样改动足够小，团队容易审阅，也能看到下一轮报告是否变清楚。</p></div>
          <ol class="stepGrid">
            ${renderJourneyStep("1", "先看摘要", "用简短摘要说明这轮审计，并判断问题是否值得处理。", new URL("examples/static-good/share-summary.md", siteUrl).href, "打开摘要")}
            ${renderJourneyStep("2", "核对评分卡证据", "改文案前，先检查受影响的检查项、页面和证据。", new URL("examples/static-good/scorecard.md", siteUrl).href, "打开评分卡")}
            ${renderJourneyStep("3", "只改一个页面", "用修复建议更新页面文案、证明或结构。", new URL("examples/static-good/recommendations.md", siteUrl).href, "打开修复清单")}
            ${renderJourneyStep("4", "分享前重新运行", "把结果交给团队评审之前，先重新跑示例或真实站点审计。", repoBlob("docs/zh/quickstart.md"), "开始 5 分钟检查")}
          </ol>
        </section>
        <section class="section grid">
          ${renderPanel("当前生成的建议", "演示报告", `${firstFix ? `<p><strong>${escapeHtml(firstFix.title)}</strong></p><p>${escapeHtml(firstFix.expectedOutcome)}</p>` : "<p>当前没有修复建议。</p>"}<p>查看<a href="${escapeHtml(new URL("examples/static-good/recommendations.md", siteUrl).href)}">完整生成修复清单</a>。</p>`)}
          ${renderPanel("需要背景时再读", "概念支撑", `<ul>${renderList([
            `<a href="${escapeHtml(repoBlob("docs/concepts/schema-text-consistency.md"))}">对齐结构化数据</a>：让机器可读数据和页面文案说同一件事。`,
            `<a href="${escapeHtml(repoBlob("docs/concepts/evidence-density.md"))}">补充可引用证据</a>：让证明更容易被引用和比较。`,
            `<a href="${escapeHtml(repoBlob("docs/scoring.md"))}">读懂评分卡</a>：理解问题如何影响报告结果。`,
            `<a href="${escapeHtml(repoBlob("docs/zh/github-action.md"))}">设置 GitHub Actions</a>：把同一套检查放进代码评审。`
          ])}</ul>`)}
        </section>`
      },
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "AnswerLens page fixes",
        description: "Fix-oriented page guidance compiled from AnswerLens reports.",
        url: new URL("playbooks/", siteUrl).href
      }
    }
  ];

  await writeFile(path.join(outDir, "index.html"), renderLocaleRedirectPage(siteUrl, ""), "utf8");

  const routeAliases = [
    {
      from: "use-case/open-source-maintainer/",
      to: "use-case/open-source-maintainers/"
    },
    {
      from: "use-cases/product-marketing/",
      to: "use-case/product-marketing/"
    },
    {
      from: "use-cases/developer-advocacy/",
      to: "use-case/developer-advocacy/"
    },
    {
      from: "use-cases/open-source-maintainers/",
      to: "use-case/open-source-maintainers/"
    }
  ];

  for (const page of pages) {
    await mkdir(path.dirname(page.filePath ?? path.join(outDir, page.route, "index.html")), { recursive: true });
    await writeFile(page.filePath ?? path.join(outDir, page.route, "index.html"), renderLocaleRedirectPage(siteUrl, page.route), "utf8");
    await mkdir(path.dirname(localeIndexPath(outDir, page.route, "en")), { recursive: true });
    await mkdir(path.dirname(localeIndexPath(outDir, page.route, "zh-CN")), { recursive: true });
    await writeFile(localeIndexPath(outDir, page.route, "en"), renderLayout(siteUrl, page, updatedAt, "en", latestReleaseVersion), "utf8");
    await writeFile(localeIndexPath(outDir, page.route, "zh-CN"), renderLayout(siteUrl, page, updatedAt, "zh-CN", latestReleaseVersion), "utf8");
  }

  for (const alias of routeAliases) {
    await mkdir(path.join(outDir, alias.from), { recursive: true });
    await writeFile(path.join(outDir, alias.from, "index.html"), renderLocaleRedirectPage(siteUrl, alias.to), "utf8");

    for (const locale of ["en", "zh-CN"] as const) {
      const aliasPath = localeIndexPath(outDir, alias.from, locale);
      const targetUrl = new URL(localizePath(alias.to, locale), siteUrl).href;
      await mkdir(path.dirname(aliasPath), { recursive: true });
      await writeFile(aliasPath, renderFixedRedirectPage(targetUrl), "utf8");
    }
  }

  const seoPages = pages.flatMap((page) => [
    buildPageSeo(siteUrl, page, updatedAt, "en"),
    buildPageSeo(siteUrl, page, updatedAt, "zh-CN")
  ]);
  await writeFile(
    path.join(outDir, "sitemap.xml"),
    generateSitemap({ siteUrl, pages: seoPages, lastModified: updatedAt }),
    "utf8"
  );

  const feedEntries = releases
    .map((release) => {
      const updated = formatDate(release.published_at, updatedAt);
      return `<entry><title>${escapeHtml(release.name ?? release.tag_name)}</title><id>${escapeHtml(release.html_url)}</id><link href="${escapeHtml(release.html_url)}" /><updated>${escapeHtml(updated)}</updated><summary>${escapeHtml(excerpt(release.body, 320) || release.tag_name)}</summary></entry>`;
    })
    .join("");
  await writeFile(
    path.join(outDir, "feed.xml"),
    `<?xml version="1.0" encoding="utf-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom"><title>AnswerLens releases</title><id>${escapeHtml(new URL("releases/", siteUrl).href)}</id><updated>${escapeHtml(updatedAt)}</updated><link href="${escapeHtml(new URL("feed.xml", siteUrl).href)}" rel="self" /><subtitle>${escapeHtml(DESCRIPTION)}</subtitle>${feedEntries}</feed>\n`,
    "utf8"
  );

  await writeFile(
    path.join(outDir, "robots.txt"),
    `User-agent: *\nAllow: /\nSitemap: ${new URL("sitemap.xml", siteUrl).href}\n`,
    "utf8"
  );
}

async function main(): Promise<void> {
  const flags = parseArgs(process.argv.slice(2));
  await buildSite({
    siteUrl: flags.get("site-url"),
    outDir: flags.get("out") ?? undefined,
    demoRunDir: flags.get("demo-run") ?? undefined,
    releasesPath: flags.get("releases") ?? undefined
  });
}

const isCliEntrypoint =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isCliEntrypoint && process.env.ANSWERLENS_IMPORT_ONLY !== "1") {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
