import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LOCALE_STORAGE_KEY, type Locale, localeToSlug, t } from "../../packages/i18n/src/index.ts";

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
};

type PageSpec = {
  route: string;
  filePath?: string;
  title: string;
  description: string;
  body: string;
  jsonLd: unknown;
};

const REPO_URL = "https://github.com/YSCJRH/ai-visibility-auditor";
const DESCRIPTION = "AnswerLens is a CLI-first AI visibility auditor for product websites.";
const TAGLINE = "CI for AI discoverability.";
const DEFAULT_REPOSITORY = "YSCJRH/ai-visibility-auditor";

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

function formatReadableDate(value: string | undefined, fallback: string): string {
  const date = new Date(value ?? fallback);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(date);
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
    ["Docs", "文档"],
    ["Releases", "发布"],
    ["Examples", "示例"],
    ["Playbooks", "操作手册"],
    ["AnswerLens makes AI discoverability reviewable in GitHub.", "AnswerLens 让 AI 可发现性在 GitHub 里变得可审阅。"],
    ["AI visibility audit reports and demo entry points", "AI 可见性审计报告与演示入口"],
    ["Docs index, concepts, and activation references", "文档索引、概念与激活参考"],
    ["Release notes and downloadable distribution assets", "发布说明与可下载分发资产"],
    ["Demo report artifacts and fixture outputs", "演示报告产物与 fixture 输出"],
    ["Starter bundle for external GitHub repositories", "面向外部 GitHub 仓库的 starter bundle"],
    ["Open-source pricing and packaging", "开源定价与打包方式"],
    ["Security, trust, and review guardrails", "安全、信任与审阅边界"],
    ["First-run FAQ and guardrails", "首次试用 FAQ 与边界说明"],
    ["AnswerLens compared with Profound, Peec AI, and Otterly", "AnswerLens 与 Profound、Peec AI、Otterly 的对比"],
    ["GitHub, provider, and validation integrations", "GitHub、provider 与验证集成"],
    ["Use case for product marketing teams", "面向产品营销团队的使用场景"],
    ["Use case for developer advocacy teams", "面向开发者关系团队的使用场景"],
    ["Use case for open-source maintainers", "面向开源维护者的使用场景"],
    ["Fix playbooks from current audit artifacts", "基于当前审计产物的修复手册"],
    ["Canonical documentation", "规范文档"],
    ["Versioned distribution", "版本化分发"],
    ["Example dataset", "示例数据集"],
    ["Pricing and packaging", "定价与打包"],
    ["Security and trust", "安全与信任"],
    ["First-run FAQ", "首次试用 FAQ"],
    ["Compare", "对比"],
    ["Integrations", "集成"],
    ["Use case", "使用场景"],
    ["Fixes and playbooks", "修复与手册"],
    ["Recommended first-run path", "推荐首次试用路径"],
    ["Public proof block", "公开证明区块"],
    ["Public proof pages", "公开证明页面"],
    ["Use-case coverage", "用例覆盖"],
    ["Proof page map", "证明页面地图"],
    ["Artifact order", "产物顺序"],
    ["Use the latest release", "使用最新发布"],
    ["Latest demo run", "最新演示运行"],
    ["What to do after the demo", "看完演示后做什么"],
    ["Starter example run", "starter 示例运行"],
    ["What to do next", "下一步怎么做"],
    ["What costs $0", "哪些成本为 $0"],
    ["Where variable cost appears", "变量成本出现在哪里"],
    ["Packaging choices", "打包方式"],
    ["Trust model", "信任模型"],
    ["Review and deployment model", "审阅与部署模型"],
    ["Known limits", "已知限制"],
    ["Common questions", "常见问题"],
    ["Related proof pages", "相关证明页面"],
    ["Declared comparison set", "公开对比对象"],
    ["How the workflow differs", "工作流有何不同"],
    ["When AnswerLens fits", "何时适合使用 AnswerLens"],
    ["Current integration surfaces", "当前集成面"],
    ["How teams usually adopt", "团队常见采用路径"],
    ["Starter bundle", "starter bundle"],
    ["Where teams start", "团队从哪里开始"],
    ["Where teams focus", "团队关注点"],
    ["Why maintainers use it", "维护者为什么使用它"],
    ["Current recommendations", "当前建议"],
    ["Recommended reading", "推荐阅读"],
    ["Built by YSCJRH from repo-native docs, releases, and artifacts. No consumer AI UI scraping. No ranking promises.", "由 YSCJRH 基于仓库内文档、发布记录与产物构建。无消费级 AI 界面抓取，不承诺答案面排名。"],
    ["Open the live demo report", "打开在线演示报告"],
    ["Run the 60-second fixture demo", "运行 60 秒 fixture 演示"],
    ["Run a 5-minute real-site audit", "运行 5 分钟真实站点审计"],
    ["Add the GitHub Action", "添加 GitHub Action"],
    ["Open canonical Markdown", "打开规范 Markdown"],
    ["Start here", "从这里开始"],
    ["Artifact proof", "产物证明"],
    ["Coverage", "覆盖面"],
    ["Team fit", "团队适配"],
    ["What to open next", "接下来打开什么"],
    ["Cross-linking", "互链"],
    ["What ships now", "当前已交付"],
    ["Suggested path", "建议路径"],
    ["External adoption", "外部采用"],
    ["Workflow", "工作流"],
    ["What to strengthen", "该强化什么"],
    ["What to connect", "该连接什么"],
    ["GitHub-native distribution", "GitHub-native 分发"],
    ["Concept support", "概念支持"],
    ["Activation funnel", "激活漏斗"],
    ["Review flow", "审阅流"],
    ["Public comparison", "当前公开对比"],
    ["Decision criteria", "决策标准"],
    ["What this connects to", "这与什么相连"],
    ["Current public comparison", "当前公开对比"],
    ["What people ask first", "大家首先会问什么"],
    ["What it does", "它能做什么"],
    ["Canonical docs, concepts, scoring notes, activation guidance, and distribution references for AnswerLens.", "AnswerLens 的规范文档、概念说明、评分说明、激活指南与分发参考。"],
    ["Public starter-bundle overview for copying AnswerLens into another repository with a GitHub-native layout.", "面向外部仓库的 starter bundle 总览，用于以 GitHub-native 方式复制 AnswerLens。"],
    ["How AnswerLens differs from dashboard-first AI visibility tools such as Profound, Peec AI, and Otterly.", "说明 AnswerLens 与 Profound、Peec AI、Otterly 等 dashboard-first AI 可见性工具的区别。"],
    ["Static-good demo artifacts, share summaries, and example report outputs.", "static-good demo 的 artifacts、share summaries 与示例报告输出。"],
    ["How developer advocacy teams can use AnswerLens to strengthen docs, examples, and self-serve proof pages.", "说明开发者关系团队如何使用 AnswerLens 强化文档、示例与自助 proof pages。"],
    ["How open-source maintainers can use AnswerLens on README, Pages, releases, and demo artifacts.", "说明开源维护者如何在 README、Pages、releases 与 demo artifacts 上使用 AnswerLens。"],
    ["Public starter-bundle overview for external GitHub repositories.", "面向外部 GitHub 仓库的 starter bundle 总览。"],
    ["Canonical docs, concepts, scoring notes, activation guidance, and distribution references for AnswerLens.", "AnswerLens 的规范文档、概念说明、评分说明、激活指南与分发参考。"],
    ["AnswerLens docs stay in Markdown and compile to an indexable layer.", "AnswerLens 文档继续以 Markdown 作为编写面，并编译成可索引页面层。"],
    ["AnswerLens keeps repo docs as the authoring surface and compiles this page to make them easier for search engines, AI systems, and external teams to discover.", "AnswerLens 保持以 repo docs 作为 authoring surface，并把这一页编译成更容易被搜索引擎、AI 系统和外部团队发现的公开层。"],
    ["Current operating focus for public entry points and adoption.", "当前围绕公开入口与 adoption 的运营重点。"],
    ["GitHub-native packaging, funnel, and community strategy.", "GitHub-native 的包装、漏斗与社区策略。"],
    ["How AnswerLens uses its own audit mindset on public source-material surfaces.", "说明 AnswerLens 如何把自己的审计思路用在公开 source-material surfaces 上。"],
    ["Run one real-site audit before you wire CI.", "在接入 CI 之前先跑一轮真实站点审计。"],
    ["Public external-repo layout for the GitHub Action adoption path.", "面向 GitHub Action adoption 路径的公开 external-repo 布局。"],
    ["Canonical public roadmap and issue sequencing.", "规范公开 roadmap 与 issue 顺序。"],
    ["P0, P1, and P2 distribution surfaces and metrics.", "P0、P1、P2 的分发面与指标。"],
    ["Minimal GitHub, npm, and Pages setup checklist.", "最小 GitHub、npm 与 Pages 设置清单。"],
    ["Reusable `uses: owner/repo@vX` contract and outputs.", "可复用的 `uses: owner/repo@vX` 契约与 outputs。"],
    ["Public scoring model and output contract.", "公开评分模型与输出契约。"],
    ["How run outputs become copy-ready public assets.", "说明 run outputs 如何变成可直接复用的公开资产。"],
    ["Use these proof pages when you want buyer-facing context beyond the demo report.", "当你需要 demo report 之外、面向买家的上下文时，请使用这些 proof pages。"],
    ["Use the public funnel in this order:", "按这个公开漏斗顺序开始："],
    ["to understand the artifact flow.", "用来理解 artifact 流程。"],
    ["to reproduce the same artifact set locally.", "在本地复现同一组 artifacts。"],
    ["before wiring CI.", "再去接 CI。"],
    ["when you want the same artifact contract in pull requests and workflow runs.", "当你想在 pull requests 和 workflow runs 中复用同一套 artifact 契约时再接入。"],
    ["If you arrive here already knowing you want CI, the Action docs remain public, but the clearest first run still moves through the demo and one local audit first.", "如果你一开始就知道自己想直接接 CI，Action 文档当然仍然可用；但最清晰的首次路径仍然应该先经过 demo 和一轮本地审计。"],
    ["Use the latest release as the second public front door.", "把 latest release 当作第二个公开入口。"],
    ["At every step, start with <code>share-summary.md</code>, then <code>scorecard.md</code>, then <code>recommendations.md</code>.", "每一步都先看 <code>share-summary.md</code>，然后是 <code>scorecard.md</code>，最后是 <code>recommendations.md</code>。"],
    ["Demo site:", "演示站点："],
    ["Top issue:", "核心问题："],
    ["Top fix:", "优先修复："],
    ["Open artifacts in order:", "按这个顺序打开 artifacts："],
    ["AnswerLens now publishes public proof surfaces that explain packaging, trust, FAQs, comparisons, and integrations without drifting into dashboard-first packaging.", "AnswerLens 现在会发布公开 proof surfaces，用来解释打包方式、信任、FAQ、对比与集成，而不把项目重新包装成 dashboard-first 产品。"],
    ["These use-case pages explain where AnswerLens fits before a team adopts it in CI.", "这些 use-case 页面会先解释在团队把 AnswerLens 接入 CI 之前，它最适合用在哪些场景。"],
    ["AnswerLens FAQ for new visitors and evaluators.", "面向新访客和评估者的 AnswerLens FAQ。"],
    ["This page answers the recurring first-run questions in visible, citable language so teams can understand the workflow before they wire it into GitHub or compare it with dashboard-first tools.", "这页会用可见、可引用的语言回答高频首次试用问题，帮助团队在接入 GitHub 或和 dashboard-first 工具比较之前先理解工作流。"],
    ["What does AnswerLens audit?", "AnswerLens 审计什么？"],
    ["AnswerLens audits whether a product site is easy for AI systems to read, cite, compare, and recommend through reviewable artifacts such as share summaries, scorecards, and recommendations.", "AnswerLens 审计的是：一个产品网站是否足够容易被 AI 系统读取、引用、比较与推荐，并通过可审阅的 share summaries、scorecards 与 recommendations 呈现出来。"],
    ["Does AnswerLens scrape consumer AI apps?", "AnswerLens 会抓取消费级 AI 应用吗？"],
    ["No. AnswerLens keeps the non-goal explicit: no consumer AI UI scraping and no ranking guarantees on answer surfaces.", "不会。AnswerLens 明确把这件事列为非目标：不抓取消费级 AI UI，也不承诺答案面的排名结果。"],
    ["Do I need provider API keys to try it?", "试用时需要 provider API key 吗？"],
    ["Not for a basic audit run. Provider keys are only needed when you want eval-mode benchmarking on top of the core site audit.", "基础的 audit run 不需要。只有当你想在核心站点审计之上再做 eval benchmarking 时，才需要 provider key。"],
    ["How do I start in under five minutes?", "怎样在 5 分钟内开始？"],
    ["Start with the live demo report, then run the 60-second fixture demo, then use the 5-minute real-site quickstart before wiring the GitHub Action.", "先看 live demo report，再跑 60 秒 fixture demo，然后在接 GitHub Action 之前完成 5 分钟真实站点 quickstart。"],
    ["How does pricing work today?", "当前的定价模式是怎样的？"],
    ["The project is open source, the CLI and Pages docs are public, and eval costs follow a BYOK model because provider usage stays in your own account.", "项目本身是开源的，CLI 和 Pages 文档公开可见；eval 的成本遵循 BYOK 模式，因为 provider 使用量会留在你自己的账户里。"],
    ["see the open-source and BYOK packaging model.", "查看开源与 BYOK 的打包模型。"],
    ["review trust, secrets, and guardrails.", "查看信任、密钥与边界说明。"],
    ["understand how AnswerLens differs from Profound, Peec AI, and Otterly.", "理解 AnswerLens 与 Profound、Peec AI、Otterly 的区别。"],
    ["review the GitHub-native workflow path.", "查看 GitHub-native 工作流路径。"],
    ["go deeper on activation, scoring, and Action usage.", "进一步了解 activation、scoring 与 Action 使用方式。"],
    ["Fixture outputs are treated as public example artifacts.", "fixture 输出会被当作公开示例 artifacts。"],
    ["The static-good fixture is the stable source for share summaries, scorecards, recommendations, and HTML report outputs.", "static-good fixture 是 share summaries、scorecards、recommendations 与 HTML report outputs 的稳定来源。"],
    ["if you want the same artifact set locally.", "如果你想在本地拿到同一组 artifacts。"],
    ["against your own public site.", "面向你自己的公开站点。"],
    ["Open the starter bundle overview", "打开 starter bundle 总览"],
    ["only after one useful local real-site run.", "前提是你已经有一轮真正有用的本地真实站点运行。"],
    ["Keep the review order stable:", "保持固定的审阅顺序："],
    ["The starter bundle is the public adoption asset for external repositories.", "starter bundle 是面向外部仓库的公开 adoption 资产。"],
    ["Use this page when you want to explain the AnswerLens GitHub Action path before sending someone into raw repo files. It keeps the external layout, artifact order, and next step visible in one place.", "当你想先解释 AnswerLens GitHub Action 路径，而不是直接把人扔进 raw repo files 时，就该用这一页。它把 external layout、artifact order 和 next step 放在了同一个页面里。"],
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
    ["This public example uses the consumer-repo starter bundle against the stable fixture so external adopters can inspect the resulting artifacts before wiring their own site.", "这个公开示例会把 consumer-repo starter bundle 跑在稳定 fixture 上，让外部 adopter 在接自己站点之前，先看到最终 artifacts 长什么样。"],
    ["if you have not done that yet.", "如果你还没做过这一步。"],
    ["Copy the starter files into the repository you want to audit.", "把 starter 文件复制到你准备审计的仓库里。"],
    ["Move into the GitHub Action path", "进入 GitHub Action 路径"],
    ["when the local run already feels reviewable.", "前提是本地运行已经足够可审阅。"],
    ["That keeps the starter bundle positioned as proof of adoption readiness, not as a separate product surface.", "这样能把 starter bundle 保持在“证明 adoption readiness”的位置，而不是变成另一套独立产品面。"],
    ["see the live demo artifact set first.", "先看 live demo artifact set。"],
    ["activation references, scoring notes, and canonical Markdown.", "查看 activation references、scoring notes 与 canonical Markdown。"],
    ["see how the starter bundle fits into the GitHub-native workflow.", "看 starter bundle 如何嵌入 GitHub-native 工作流。"],
    ["use release assets as the second public front door.", "把 release assets 当作第二个公开入口。"],
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
    ["AnswerLens is designed so that teams can audit public product sites and review results inside GitHub-native workflows without sending their repo history or provider keys to a separate AnswerLens SaaS. It keeps the guardrails explicit: no consumer AI UI scraping, no ranking guarantees, and no dashboard-first rewrite.", "AnswerLens 的设计目标，是让团队能在 GitHub-native 工作流中审计公开产品站点并审阅结果，而不必把仓库历史或 provider key 发给单独的 AnswerLens SaaS。它也把边界写得很明确：不抓取消费级 AI UI、不承诺排名、不做 dashboard-first 重写。"],
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
    ["The integration surface is intentionally narrow: keep the core audit contract stable, add eval providers when you need them, and layer validation imports on top without turning the project into a dashboard-first SaaS.", "集成面是刻意收敛的：保持核心 audit 契约稳定，在确有需要时再加 eval providers，并把验证导入叠加在其上，而不是把项目扩成 dashboard-first SaaS。"],
    ["Runs the same artifact contract in pull requests, workflow_dispatch runs, and artifact uploads.", "在 pull requests、workflow_dispatch runs 和 artifact uploads 中运行同一套 artifact 契约。"],
    ["Run one real-site audit locally.", "先在本地跑一轮真实站点审计。"],
    ["Move the same artifact contract into the GitHub Action.", "再把同一套 artifact 契约搬进 GitHub Action。"],
    ["That sequencing keeps integrations understandable and reviewable instead of turning each surface into a separate product.", "这种顺序能让集成面保持可理解、可审阅，而不是把每个 surface 都变成独立产品。"],
    ["The external-repo path is public and copyable, not hidden in internal fixtures.", "external-repo 路径是公开且可复制的，不会藏在内部 fixtures 里。"],
    ["Use the starter bundle overview when you need a citable explanation of the <code>.github/answerlens/</code> layout before handing someone the raw example files.", "当你需要先给出一份可引用的 <code>.github/answerlens/</code> 布局说明，而不是直接把 raw example files 扔给别人时，请使用 starter bundle overview。"],
    ["That keeps the Action path legible for forks, releases, and external setup guides.", "这样能让 Action 路径在 forks、releases 与外部 setup guide 中都保持清晰。"],
    ["AnswerLens is a CLI-first AI visibility auditor for product websites. It turns audits into share summaries, PR-ready snippets, static reports, release assets, and indexable pages without falling back to dashboard-only workflows.", "AnswerLens 是一个面向产品网站的 CLI-first AI visibility auditor。它会把审计结果转成 share summaries、PR-ready snippets、静态报告、release assets 和可索引页面，而不是退回到只靠 dashboard 的工作方式。"],
    ["Why AI may still miss the site", "为什么 AI 仍然可能错过这个站点"],
    ["What teams can ship next", "团队下一步最值得做什么"],
    ["Frequently asked questions about what AnswerLens is, how it works, and what it does not claim.", "关于 AnswerLens 是什么、如何工作，以及它不承诺什么的常见问题。"],
    ["Open-source pricing, packaging, BYOK evaluation, and release-asset distribution for AnswerLens.", "AnswerLens 的开源定价、打包方式、BYOK 评估与 release-asset 分发说明。"],
    ["GitHub Action, provider adapters, Search Console import, and helper integrations for AnswerLens.", "AnswerLens 的 GitHub Action、provider adapters、Search Console 导入与辅助集成说明。"],
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
    ["Repo-native vs dashboard-first", "Repo-native 与 dashboard-first"],
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
    ["Dashboard-first AI visibility tools", "dashboard-first AI 可见性工具"],
    ["Primary output", "核心产出"],
    ["Repo-native reports, scorecards, and fix lists", "Repo-native 报告、scorecard 和修复清单"],
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
    ["这个公开示例会把 consumer-repo starter bundle 跑在稳定 fixture 上，让外部 adopter 在接自己站点之前，先看到最终 artifacts 长什么样。", "这个公开示例会把 consumer-repo starter bundle 跑在稳定 fixture 上，让外部采用者在接自己站点之前，先看到最终产物长什么样。"],
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

function renderLayout(siteUrl: string, page: PageSpec, updatedAt: string, locale: Locale): string {
  const localizedRoute = localizePath(page.route, locale);
  const canonical = new URL(localizedRoute, siteUrl).href;
  const xDefaultHref = new URL(page.route, siteUrl).href;
  const ogImage = new URL("assets/social-preview.png", siteUrl).href;
  const documentTitle = page.title.includes("AnswerLens") ? page.title : `${page.title} | AnswerLens`;

  const rendered = `<!doctype html>
<html lang="${locale === "zh-CN" ? "zh-CN" : "en"}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(documentTitle)}</title>
    <meta name="description" content="${escapeHtml(page.description)}" />
    <link rel="canonical" href="${escapeHtml(canonical)}" />
    <link rel="alternate" hreflang="en" href="${escapeHtml(new URL(localizePath(page.route, "en"), siteUrl).href)}" />
    <link rel="alternate" hreflang="zh-CN" href="${escapeHtml(new URL(localizePath(page.route, "zh-CN"), siteUrl).href)}" />
    <link rel="alternate" hreflang="x-default" href="${escapeHtml(xDefaultHref)}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapeHtml(documentTitle)}" />
    <meta property="og:description" content="${escapeHtml(page.description)}" />
    <meta property="og:url" content="${escapeHtml(canonical)}" />
    <meta property="og:image" content="${escapeHtml(ogImage)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(documentTitle)}" />
    <meta name="twitter:description" content="${escapeHtml(page.description)}" />
    <meta name="twitter:image" content="${escapeHtml(ogImage)}" />
    <meta name="last-modified" content="${escapeHtml(updatedAt)}" />
    <style>
      :root{color-scheme:dark;--bg:#081225;--panel:rgba(16,28,52,.9);--line:rgba(120,168,255,.2);--ink:#eef5ff;--muted:#adc3de;--accent:#7df0d2}
      *{box-sizing:border-box}body{margin:0;font-family:"Segoe UI",system-ui,sans-serif;background:radial-gradient(circle at top left,rgba(96,120,255,.16),transparent 24%),radial-gradient(circle at bottom right,rgba(125,240,210,.14),transparent 20%),linear-gradient(180deg,#0b1630 0%,var(--bg) 100%);color:var(--ink)}
      a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}.shell{width:min(1180px,calc(100vw - 32px));margin:0 auto;padding:24px 0 56px}.topbar,.hero,.panel,.metric{border:1px solid var(--line);border-radius:22px;background:var(--panel);box-shadow:0 20px 40px rgba(2,8,18,.35)}
      .topbar{display:flex;gap:16px;justify-content:space-between;align-items:center;padding:16px 20px}.nav{display:flex;gap:12px;flex-wrap:wrap}.nav a{padding:10px 14px;border-radius:999px;border:1px solid var(--line)}
      .locale-switcher{display:flex;align-items:center;gap:8px;color:var(--muted);font-size:.92rem}
      .hero,.panel,.metric{padding:22px}.hero h1{margin:0 0 12px;font-size:clamp(2rem,5vw,3.2rem);line-height:1.05}.hero p,.muted{color:var(--muted)}.eyebrow{margin:0 0 10px;color:var(--accent);text-transform:uppercase;letter-spacing:.08em;font-size:.78rem}
      .section{margin-top:24px}.grid{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}.metric-value{margin:0;font-size:2rem;font-weight:700}
      .panel h2{margin-top:0}.markdown{margin:0;padding:16px;border:1px solid var(--line);border-radius:16px;background:rgba(8,18,37,.95);white-space:pre-wrap;overflow:auto;font-family:"Consolas","SFMono-Regular",monospace;line-height:1.5}
      .footer{margin-top:28px;text-align:center;color:var(--muted)}
    </style>
    <script type="application/ld+json">${JSON.stringify(page.jsonLd)}</script>
  </head>
  <body>
    <div class="shell">
      <header class="topbar">
        <div>
          <strong>AnswerLens</strong>
          <p class="muted">${escapeHtml(t(locale, "brand.description"))} ${escapeHtml(t(locale, "brand.tagline"))}</p>
        </div>
        <nav class="nav">
          <a href="${escapeHtml(new URL(localizePath("", locale), siteUrl).href)}">${escapeHtml(t(locale, "nav.home"))}</a>
          <a href="${escapeHtml(new URL(localizePath("docs/", locale), siteUrl).href)}">${escapeHtml(t(locale, "nav.docs"))}</a>
          <a href="${escapeHtml(new URL(localizePath("releases/", locale), siteUrl).href)}">${escapeHtml(t(locale, "nav.releases"))}</a>
          <a href="${escapeHtml(new URL(localizePath("examples/", locale), siteUrl).href)}">${escapeHtml(t(locale, "nav.examples"))}</a>
          <a href="${escapeHtml(new URL(localizePath("playbooks/", locale), siteUrl).href)}">${escapeHtml(t(locale, "nav.playbooks"))}</a>
          <a href="${escapeHtml(REPO_URL)}">${escapeHtml(t(locale, "nav.github"))}</a>
        </nav>
      </header>
      ${renderLanguageSelector(siteUrl, page.route, locale)}
      ${page.body}
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

function localizeAbsoluteSiteLinks(html: string, siteUrl: string, locale: Locale): string {
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

  const [shareSummary, runManifest, shareSummaryMarkdown, recommendationsMarkdown, exampleMarkdown, releases, consumerShareSummary, consumerRunManifest] = await Promise.all([
    readJson<ShareSummary>(path.join(demoRunDir, "share-summary.json")),
    readJson<RunManifest>(path.join(demoRunDir, "run.json")),
    readFile(path.join(demoRunDir, "share-summary.md"), "utf8"),
    readFile(path.join(demoRunDir, "recommendations.md"), "utf8"),
    readFile(path.resolve("examples/shareable-summary.md"), "utf8"),
    readJson<ReleaseEntry[]>(releasesPath),
    readJson<ShareSummary>(path.join(consumerRunDir, "share-summary.json")),
    readJson<RunManifest>(path.join(consumerRunDir, "run.json"))
  ]);

  const updatedAt = formatDate(releases[0]?.published_at, shareSummary.run.generatedAt);

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

  const docsCards = [
    ["docs/activation-plan.md", "Activation plan", "Current operating focus for public entry points and adoption."],
    ["docs/github-growth-plan.md", "Growth plan", "GitHub-native packaging, funnel, and community strategy."],
    ["docs/self-dogfooding.md", "Self-dogfooding", "How AnswerLens uses its own audit mindset on public source-material surfaces."],
    ["docs/quickstart.md", "Quickstart", "Run one real-site audit before you wire CI."],
    ["docs/starter-bundle.md", "Starter bundle", "Public external-repo layout for the GitHub Action adoption path."],
    ["docs/roadmap.md", "Roadmap", "Canonical public roadmap and issue sequencing."],
    ["docs/distribution-plan.md", "Distribution plan", "P0, P1, and P2 distribution surfaces and metrics."],
    ["docs/manual-steps.md", "Manual steps", "Minimal GitHub, npm, and Pages setup checklist."],
    ["docs/github-action.md", "GitHub Action", "Reusable `uses: owner/repo@vX` contract and outputs."],
    ["docs/scoring.md", "Scoring", "Public scoring model and output contract."],
    ["docs/shareable-summary.md", "Shareable summary", "How run outputs become copy-ready public assets."]
  ]
    .map(([file, title, text]) => renderPanel(title, "Docs", `<p>${escapeHtml(text)}</p><p><a href="${escapeHtml(repoBlob(file))}">Open canonical Markdown</a></p>`))
    .join("");

  const releaseCards = releases.length
    ? releases
        .map((release) =>
          renderPanel(
            release.name ?? release.tag_name,
            formatReadableDate(release.published_at, updatedAt),
            `<p>${escapeHtml(excerpt(release.body, 320) || "Release metadata is available on GitHub.")}</p><p><a href="${escapeHtml(release.html_url)}">Open GitHub release</a></p>`
          )
        )
        .join("")
    : renderPanel("No releases yet", "Releases", "<p>Release metadata has not been compiled yet.</p>");

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
        <tr><th>Surface</th><th>Cost model</th><th>Notes</th></tr>
      </thead>
      <tbody>
        <tr><td>CLI audit</td><td>$0 provider cost</td><td>Basic <code>audit</code> runs do not require provider API keys.</td></tr>
        <tr><td>Eval runs</td><td>Bring your own provider bill</td><td>OpenAI and Perplexity usage stays in your own account.</td></tr>
        <tr><td>GitHub Action</td><td>Your repository runner minutes</td><td>The Action keeps the same artifact contract used by local runs.</td></tr>
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
        <tr><td>Review trail</td><td>Use pull requests, Action logs, uploaded artifacts, and repo history as the audit trail.</td></tr>
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
        <tr><td>Review workflow</td><td>PRs, release notes, Pages, and artifacts</td><td>Vendor UI plus exported summaries</td></tr>
        <tr><td>Guardrails</td><td>No consumer UI scraping and no ranking promises</td><td>Varies by vendor and monitoring method</td></tr>
      </tbody>
    </table>`;
  const integrationsTable = `
    <table>
      <thead>
        <tr><th>Integration surface</th><th>What it does</th></tr>
      </thead>
      <tbody>
        <tr><td>GitHub Action</td><td>Runs the same artifact contract in pull requests, workflow_dispatch runs, and artifact uploads.</td></tr>
        <tr><td>OpenAI and Perplexity eval</td><td>Adds eval-mode benchmarking when you want answer quality checks on top of audit.</td></tr>
        <tr><td>Search Console import</td><td>Validates key-page evidence against imported page-level Search Console exports.</td></tr>
        <tr><td>Bing / IndexNow helper</td><td>Adds helper-mode validation and candidate URL preparation without live submission.</td></tr>
        <tr><td>Release assets and Pages</td><td>Turns demo outputs and docs into reusable public distribution surfaces.</td></tr>
      </tbody>
    </table>`;
  const faqQuestions = [
    {
      question: "What does AnswerLens audit?",
      answer:
        "AnswerLens audits whether a product site is easy for AI systems to read, cite, compare, and recommend through reviewable artifacts such as share summaries, scorecards, and recommendations."
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
        "Start with the live demo report, then run the 60-second fixture demo, then use the 5-minute real-site quickstart before wiring the GitHub Action."
    },
    {
      question: "How does pricing work today?",
      answer:
        "The project is open source, the CLI and Pages docs are public, and eval costs follow a BYOK model because provider usage stays in your own account."
    }
  ];

  const pages: PageSpec[] = [
    {
      route: "",
      filePath: path.join(outDir, "index.html"),
      title: "AI visibility audit reports and demo entry points",
      description: `${DESCRIPTION} ${TAGLINE}`,
      body: `<section class="hero"><p class="eyebrow">${escapeHtml(TAGLINE)}</p><h1>AnswerLens makes AI discoverability reviewable in GitHub.</h1><p>${escapeHtml(DESCRIPTION)} It turns audits into share summaries, PR-ready snippets, static reports, release assets, and indexable pages without falling back to dashboard-only workflows.</p></section>
        <section class="section grid">
          <article class="metric"><p class="eyebrow">overallScore</p><p class="metric-value">${escapeHtml(String(shareSummary.metrics.overallScore ?? "pending"))}</p></article>
          <article class="metric"><p class="eyebrow">vavr</p><p class="metric-value">${escapeHtml(String(shareSummary.metrics.vavr ?? "pending"))}</p></article>
          <article class="metric"><p class="eyebrow">keyPageCount</p><p class="metric-value">${escapeHtml(String(shareSummary.metrics.keyPageCount ?? "pending"))}</p></article>
          <article class="metric"><p class="eyebrow">latestRelease</p><p class="metric-value">${escapeHtml(releases[0]?.tag_name ?? "pending")}</p></article>
        </section>
        <section class="section grid">
          ${renderPanel("Why AI may still miss the site", "Top issues", `<ul>${renderList(shareSummary.topIssues.map((item) => `<strong>${escapeHtml(item.title)}</strong> (${escapeHtml(item.severity)}): ${escapeHtml(item.fixHint)}`))}</ul>`)}
          ${renderPanel("What teams can ship next", "Top fixes", `<ul>${renderList(shareSummary.topRecommendations.map((item) => `<strong>${escapeHtml(item.title)}</strong>: ${escapeHtml(item.expectedOutcome)}`))}</ul>`)}
        </section>
        <section class="section grid">
          ${renderPanel("Recommended first-run path", "Activation funnel", `<p>Use the public funnel in this order:</p><ol><li><a href="${escapeHtml(new URL("examples/static-good/index.html", siteUrl).href)}">Open the live demo report</a> to understand the artifact flow.</li><li><a href="${escapeHtml(REPO_URL)}#run-the-60-second-fixture-demo">Run the 60-second fixture demo</a> to reproduce the same artifact set locally.</li><li><a href="${escapeHtml(repoBlob("docs/quickstart.md"))}">Run a 5-minute real-site audit</a> before wiring CI.</li><li><a href="${escapeHtml(repoBlob("docs/github-action.md"))}">Add the GitHub Action</a> when you want the same artifact contract in pull requests and workflow runs.</li></ol><p>If you arrive here already knowing you want CI, the Action docs remain public, but the clearest first run still moves through the demo and one local audit first. Use <a href="${escapeHtml(new URL("releases/", siteUrl).href)}">the latest release</a> as the second public front door.</p><p>At every step, start with <code>share-summary.md</code>, then <code>scorecard.md</code>, then <code>recommendations.md</code>.</p>`)}
          ${renderPanel("Public proof block", "Artifact proof", `${renderSiteIdentity(shareSummary.site)}${firstIssue ? `<p><strong>Top issue:</strong> ${escapeHtml(firstIssue.title)} (${escapeHtml(firstIssue.severity)}) - ${escapeHtml(firstIssue.fixHint)}</p>` : "<p><strong>Top issue:</strong> none</p>"}${firstFix ? `<p><strong>Top fix:</strong> ${escapeHtml(firstFix.title)} - ${escapeHtml(firstFix.expectedOutcome)}</p>` : "<p><strong>Top fix:</strong> none</p>"}<p>Open artifacts in order: <code>share-summary.md</code>, then <code>scorecard.md</code>, then <code>recommendations.md</code>.</p><ul>${publicArtifactLinks}</ul>`)}
        </section>
        <section class="section grid">
          ${renderPanel("Public proof pages", "Coverage", `<p>AnswerLens now publishes public proof surfaces that explain packaging, trust, FAQs, comparisons, and integrations without drifting into dashboard-first packaging.</p><ul>${renderList([
            `<a href="${escapeHtml(proofPageUrls.pricing)}">Pricing and packaging</a>: explain the open-source, BYOK, and release-asset cost model.`,
            `<a href="${escapeHtml(proofPageUrls.security)}">Security and trust</a>: explain secrets, review flow, and non-goals in one page.`,
            `<a href="${escapeHtml(new URL("docs/", siteUrl).href)}">Docs index</a>: activation references, scoring notes, and GitHub Action usage.`,
            `<a href="${escapeHtml(proofPageUrls.starter)}">Starter bundle</a>: show the external <code>.github/answerlens/</code> layout before CI adoption.`,
            `<a href="${escapeHtml(proofPageUrls.faq)}">FAQ</a>: answer first-run questions in visible, citable language.`,
            `<a href="${escapeHtml(proofPageUrls.compare)}">Compare</a>: explain how AnswerLens differs from dashboard-first AI visibility tools.`,
            `<a href="${escapeHtml(proofPageUrls.integrations)}">Integrations</a>: show the GitHub-native and validation surfaces together.`
          ])}</ul>`)}
          ${renderPanel("Use-case coverage", "Team fit", `<p>These use-case pages explain where AnswerLens fits before a team adopts it in CI.</p><ul>${renderList([
            `<a href="${escapeHtml(proofPageUrls.productMarketing)}">Product marketing teams</a>: turn homepage, pricing, and comparison gaps into reviewable fixes.`,
            `<a href="${escapeHtml(proofPageUrls.developerAdvocacy)}">Developer advocacy teams</a>: strengthen docs, proof pages, and self-serve evaluation paths.`,
            `<a href="${escapeHtml(proofPageUrls.openSource)}">Open-source maintainers</a>: use README, releases, Pages, and artifacts as the public distribution stack.`
          ])}</ul>`)}
        </section>`,
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "AnswerLens",
          applicationCategory: "DeveloperApplication",
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
      title: "Docs index, concepts, and activation references",
      description: "Canonical docs, concepts, scoring notes, activation guidance, and distribution references for AnswerLens.",
      body: `<section class="hero"><p class="eyebrow">Canonical documentation</p><h1>AnswerLens docs stay in Markdown and compile to an indexable layer.</h1><p>AnswerLens keeps repo docs as the authoring surface and compiles this page to make them easier for search engines, AI systems, and external teams to discover.</p></section><section class="section grid">${docsCards}</section><section class="section grid">${renderPanel("Proof page map", "Where to go next", `<p>Use these proof pages when you want buyer-facing context beyond the demo report.</p><ul>${renderList([
        `<a href="${escapeHtml(proofPageUrls.pricing)}">Pricing</a>: open-source packaging, BYOK costs, and adoption surfaces.`,
        `<a href="${escapeHtml(proofPageUrls.security)}">Security</a>: secrets, review flow, and trust guardrails.`,
        `<a href="${escapeHtml(proofPageUrls.faq)}">FAQ</a>: first-run questions in visible, citable language.`,
        `<a href="${escapeHtml(proofPageUrls.compare)}">Compare</a>: how AnswerLens differs from Profound, Peec AI, and Otterly.`,
        `<a href="${escapeHtml(proofPageUrls.integrations)}">Integrations</a>: GitHub Action, providers, and validation helpers.`,
        `<a href="${escapeHtml(proofPageUrls.starter)}">Starter bundle</a>: external-repo layout and artifact review order.`,
        `<a href="${escapeHtml(proofPageUrls.productMarketing)}">Product marketing teams</a>: homepage and proof-page hardening.`,
        `<a href="${escapeHtml(proofPageUrls.developerAdvocacy)}">Developer advocacy teams</a>: docs, examples, and self-serve proof.`,
        `<a href="${escapeHtml(proofPageUrls.openSource)}">Open-source maintainers</a>: README, Pages, releases, and artifact-first distribution.`
      ])}</ul>`)}${renderPanel("Artifact order", "Review flow", `<p>After you read the docs, move back into the artifact flow in the same order used everywhere else:</p><ol><li><a href="${escapeHtml(new URL("examples/static-good/share-summary.md", siteUrl).href)}"><code>share-summary.md</code></a></li><li><a href="${escapeHtml(new URL("examples/static-good/scorecard.md", siteUrl).href)}"><code>scorecard.md</code></a></li><li><a href="${escapeHtml(new URL("examples/static-good/recommendations.md", siteUrl).href)}"><code>recommendations.md</code></a></li></ol><p>Then continue to the <a href="${escapeHtml(repoBlob("docs/quickstart.md"))}">real-site quickstart</a> or the <a href="${escapeHtml(repoBlob("docs/github-action.md"))}">GitHub Action path</a>.</p>`)}</section>`,
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "AnswerLens docs",
        description: "Canonical docs index for AnswerLens.",
        url: new URL("docs/", siteUrl).href
      }
    },
    {
      route: "releases/",
      filePath: path.join(outDir, "releases", "index.html"),
      title: "Release notes and downloadable distribution assets",
      description: "Release index, version notes, and distribution surfaces compiled from GitHub metadata.",
      body: `<section class="hero"><p class="eyebrow">Versioned distribution</p><h1>Release notes should work like a second front door, not a changelog graveyard.</h1><p>This page is compiled from release metadata so the public version line stays machine-readable, easy to index, and useful for first-run visitors.</p></section>
        <section class="section grid">
          ${renderPanel("Use the latest release", "Start here", `<p>The release page is the second public front door, but the first-run path stays sequential:</p><ol><li><a href="${escapeHtml(new URL("examples/static-good/index.html", siteUrl).href)}">Open the live demo report</a></li><li><a href="${escapeHtml(REPO_URL)}#run-the-60-second-fixture-demo">Run the 60-second fixture demo</a></li><li><a href="${escapeHtml(repoBlob("docs/quickstart.md"))}">Run a 5-minute real-site audit</a></li><li><a href="${escapeHtml(repoBlob("docs/github-action.md"))}">Add the GitHub Action</a></li><li>${releases[0]?.html_url ? `<a href="${escapeHtml(releases[0].html_url)}">Download the latest release assets</a>` : "Download the latest release assets"}</li></ol><p>Review artifacts in the same order each time: <code>share-summary.md</code>, <code>scorecard.md</code>, then <code>recommendations.md</code>.</p>`)}
        </section>
        <section class="section grid">${releaseCards}</section>`,
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
      title: "Demo report artifacts and fixture outputs",
      description: "Static-good demo artifacts, share summaries, and example report outputs.",
      body: `<section class="hero"><p class="eyebrow">Example dataset</p><h1>Fixture outputs are treated as public example artifacts.</h1><p>The static-good fixture is the stable source for share summaries, scorecards, recommendations, and HTML report outputs.</p></section>
        <section class="section grid">
          ${renderPanel("Latest demo run", "Run metadata", `<ul>${renderList([
            `Site: ${escapeHtml(siteLabel(runManifest.site))}`,
            `Mode: ${escapeHtml(runManifest.kind)}`,
            `Generated: ${escapeHtml(formatReadableDate(runManifest.generatedAt, shareSummary.run.generatedAt))}`,
            `Artifact version: ${escapeHtml(shareSummary.run.artifactVersion)}`,
            `Rule version: ${escapeHtml(shareSummary.run.ruleVersion)}`
          ])}</ul>${fixtureHostNote(runManifest.site.baseUrl) ? `<p>${fixtureHostNote(runManifest.site.baseUrl)}</p>` : ""}`)}
          ${renderPanel("Example files", "Artifacts", `<ul>${artifactLinks}</ul>`)}
        </section>
        <section class="section grid">
          ${renderPanel("Share summary contract", "Example", `<pre class="markdown">${escapeHtml(exampleMarkdown.trim())}</pre>`)}
          ${renderPanel("Latest run excerpt", "Artifacts", `<pre class="markdown">${escapeHtml(shareSummaryMarkdown.trim())}</pre>`)}
        </section>
        <section class="section grid">
          ${renderPanel("What to do after the demo", "Next step", `<ol><li><a href="${escapeHtml(REPO_URL)}#run-the-60-second-fixture-demo">Run the 60-second fixture demo</a> if you want the same artifact set locally.</li><li><a href="${escapeHtml(repoBlob("docs/quickstart.md"))}">Run a 5-minute real-site audit</a> against your own public site.</li><li><a href="${escapeHtml(proofPageUrls.starter)}">Open the starter bundle overview</a> before you hand this path to another repository.</li><li><a href="${escapeHtml(repoBlob("docs/github-action.md"))}">Add the GitHub Action</a> only after one useful local real-site run.</li></ol><p>Keep the review order stable: <code>share-summary.md</code>, then <code>scorecard.md</code>, then <code>recommendations.md</code>.</p>`)}
        </section>`,
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "Dataset",
        name: "AnswerLens static-good fixture report",
        description: "Example AnswerLens report artifacts generated from the static-good fixture.",
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
      title: "Starter bundle for external GitHub repositories",
      description: "Public starter-bundle overview for copying AnswerLens into another repository with a GitHub-native layout.",
      body: `<section class="hero"><p class="eyebrow">Starter bundle</p><h1>The starter bundle is the public adoption asset for external repositories.</h1><p>Use this page when you want to explain the AnswerLens GitHub Action path before sending someone into raw repo files. It keeps the external layout, artifact order, and next step visible in one place.</p></section>
        <section class="section grid">
          ${renderPanel("Copy this layout", "External repo shape", `<pre class="markdown">.github/\n  answerlens/\n    brand.yaml\n    competitors.yaml\n    prompts.yaml\n  workflows/\n    answerlens.yml</pre><p>This is the same layout used by <a href="${escapeHtml(repoBlob("examples/consumer-repo/README.md"))}">examples/consumer-repo</a>.</p>`)}
          ${renderPanel("What each file does", "File roles", `<ul>${renderList([
            "<code>brand.yaml</code>: product name, domain, proof-page hints, and optional <code>site_display_name</code>.",
            "<code>competitors.yaml</code>: the declared comparison set for the category you actually sell into.",
            "<code>prompts.yaml</code>: buyer, comparison, and citation questions for your real audience.",
            "<code>answerlens.yml</code>: the GitHub Action workflow that runs the same artifact contract in CI."
          ])}</ul>`)}
        </section>
        <section class="section grid">
          ${renderPanel("Starter files", "Copyable sources", `<ul>${renderList([
            `<a href="${escapeHtml(repoBlob("examples/consumer-repo/.github/answerlens/brand.yaml"))}">brand.yaml</a>`,
            `<a href="${escapeHtml(repoBlob("examples/consumer-repo/.github/answerlens/competitors.yaml"))}">competitors.yaml</a>`,
            `<a href="${escapeHtml(repoBlob("examples/consumer-repo/.github/answerlens/prompts.yaml"))}">prompts.yaml</a>`,
            `<a href="${escapeHtml(repoBlob("examples/consumer-repo/.github/workflows/answerlens.yml"))}">answerlens.yml</a>`
          ])}</ul>`)}
          ${renderPanel("Artifact review order", "Review flow", `<ol><li><code>share-summary.md</code></li><li><code>scorecard.md</code></li><li><code>recommendations.md</code></li></ol><p>Then use <code>pr-snippet.md</code> for GitHub copy and <code>run.json</code> for machine-readable metadata.</p>`)}
        </section>
        <section class="section grid">
          ${renderPanel("Starter example run", "Public proof", `<p><strong>Example site:</strong> ${escapeHtml(siteLabel(consumerRunManifest.site))}</p><p>This public example uses the consumer-repo starter bundle against the stable fixture so external adopters can inspect the resulting artifacts before wiring their own site.</p><ul>${starterArtifactLinks}</ul>`)}
          ${renderPanel("What to do next", "Activation path", `<ol><li><a href="${escapeHtml(repoBlob("docs/quickstart.md"))}">Run a 5-minute real-site audit</a> if you have not done that yet.</li><li>Copy the starter files into the repository you want to audit.</li><li><a href="${escapeHtml(repoBlob("docs/github-action.md"))}">Move into the GitHub Action path</a> when the local run already feels reviewable.</li></ol><p>That keeps the starter bundle positioned as proof of adoption readiness, not as a separate product surface.</p>`)}
          ${renderPanel("Related proof pages", "What this connects to", `<ul>${renderList([
            `<a href="${escapeHtml(new URL("examples/", siteUrl).href)}">Examples</a>: see the live demo artifact set first.`,
            `<a href="${escapeHtml(new URL("docs/", siteUrl).href)}">Docs</a>: activation references, scoring notes, and canonical Markdown.`,
            `<a href="${escapeHtml(proofPageUrls.integrations)}">Integrations</a>: see how the starter bundle fits into the GitHub-native workflow.`,
            `<a href="${escapeHtml(new URL("releases/", siteUrl).href)}">Releases</a>: use release assets as the second public front door.`
          ])}</ul>`)}
        </section>`,
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: "AnswerLens starter bundle",
        description: "Public starter-bundle overview for external GitHub repositories.",
        url: new URL("starter/", siteUrl).href
      }
    },
    {
      route: "pricing/",
      filePath: path.join(outDir, "pricing", "index.html"),
      title: "Open-source pricing and packaging",
      description: "Open-source pricing, packaging, BYOK evaluation, and release-asset distribution for AnswerLens.",
      body: `<section class="hero"><p class="eyebrow">Pricing and packaging</p><h1>Pricing for AnswerLens is open-source, BYOK, and artifact-first.</h1><p>AnswerLens is not a hosted dashboard with seat-based licensing. The code, Pages docs, example reports, and release assets are public. The only variable costs appear when you choose to run eval-mode benchmarking with your own provider account or consume your own GitHub runner minutes.</p></section>
        <section class="section grid">
          ${renderPanel("What costs $0", "Open surfaces", `<ul>${renderList([
            "The open-source repository, Pages site, and live demo report.",
            "The CLI workflow for a basic `audit` run with no provider key.",
            "The reusable GitHub Action contract and release asset downloads.",
            "Local fixture demos, report bundles, and static review artifacts."
          ])}</ul>`)}
          ${renderPanel("Where variable cost appears", "BYOK model", pricingTable)}
        </section>
        <section class="section grid">
          ${renderPanel("Packaging choices", "How teams adopt", `<p>Teams usually start with the live demo report, move to one local real-site audit, and then wire the same output contract into the GitHub Action. The package and release surfaces are intentionally simple:</p><ul>${renderList([
            "<code>@answerlens/cli</code> for CLI installs and dry-run packaging.",
            "The root GitHub Action for pull-request and workflow-based adoption.",
            "Release assets for tarballs, demo bundles, and the compiled site bundle.",
            "Pages as the public proof surface for docs, examples, playbooks, pricing, and trust."
          ])}</ul><p>That model keeps pricing legible: open source for the product surface, BYOK for optional eval usage, and no hosted AnswerLens control plane fee today.</p>`)}
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
      description: "Security and trust model for AnswerLens: BYOK secrets, no hosted control plane, and reviewable GitHub artifacts.",
      body: `<section class="hero"><p class="eyebrow">Security and trust</p><h1>Security for AnswerLens starts with no hosted control plane.</h1><p>AnswerLens is designed so that teams can audit public product sites and review results inside GitHub-native workflows without sending their repo history or provider keys to a separate AnswerLens SaaS. It keeps the guardrails explicit: no consumer AI UI scraping, no ranking guarantees, and no dashboard-first rewrite.</p></section>
        <section class="section grid">
          ${renderPanel("Trust model", "What stays under your control", `<ul>${renderList([
            "Provider API keys stay in your own shell, CI environment, or GitHub Actions secrets.",
            "The core `audit` workflow can run without provider keys at all.",
            "AnswerLens writes reviewable artifacts such as `share-summary.md`, `scorecard.md`, and `recommendations.md` into your own run directory.",
            "Public sharing should use summary artifacts, while raw provider payloads stay private."
          ])}</ul>`)}
          ${renderPanel("Review and deployment model", "Operational detail", securityTable)}
        </section>
        <section class="section grid">
          ${renderPanel("Known limits", "Guardrails", `<ul>${renderList([
            "AnswerLens does not claim SOC 2, ISO 27001, HIPAA, or other compliance programs for a hosted service because it is not operating as a hosted AnswerLens SaaS today.",
            "The project does not scrape consumer AI interfaces to fabricate visibility claims.",
            "The product does not promise rankings or placement on answer surfaces.",
            "Teams should still review artifacts before posting them to public issues, PRs, or release notes."
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
      body: `<section class="hero"><p class="eyebrow">First-run FAQ</p><h1>AnswerLens FAQ for new visitors and evaluators.</h1><p>This page answers the recurring first-run questions in visible, citable language so teams can understand the workflow before they wire it into GitHub or compare it with dashboard-first tools.</p></section>
        <section class="section grid">
          ${renderPanel("Common questions", "What people ask first", faqQuestions.map((entry) => `<h2>${escapeHtml(entry.question)}</h2><p>${escapeHtml(entry.answer)}</p>`).join(""))}
          ${renderPanel("Related proof pages", "What to open next", `<ul>${renderList([
            `<a href="${escapeHtml(proofPageUrls.pricing)}">Pricing</a>: see the open-source and BYOK packaging model.`,
            `<a href="${escapeHtml(proofPageUrls.security)}">Security</a>: review trust, secrets, and guardrails.`,
            `<a href="${escapeHtml(proofPageUrls.compare)}">Compare</a>: understand how AnswerLens differs from Profound, Peec AI, and Otterly.`,
            `<a href="${escapeHtml(proofPageUrls.integrations)}">Integrations</a>: review the GitHub-native workflow path.`,
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
      title: "AnswerLens compared with Profound, Peec AI, and Otterly",
      description: "How AnswerLens differs from dashboard-first AI visibility tools such as Profound, Peec AI, and Otterly.",
      body: `<section class="hero"><p class="eyebrow">Compare</p><h1>AnswerLens compared with Profound, Peec AI, and Otterly for GitHub-native teams.</h1><p>Compared with Profound, Peec AI, and Otterly, AnswerLens fits teams that want repo-native audits instead of dashboard-first packaging. Those tools may fit teams that want managed monitoring or broader hosted visibility products. AnswerLens keeps a different posture: CLI-first, GitHub-native, artifact-backed, and explicit about BYOK evaluation.</p></section>
        <section class="section grid">
          ${renderPanel("Declared comparison set", "Current public comparison", `<ul>${renderList([
            "Profound: AI visibility platform with a hosted monitoring posture.",
            "Peec AI: AI search monitoring workflow with a productized SaaS surface.",
            "Otterly: AI visibility monitoring aimed at managed, ongoing tracking."
          ])}</ul>`)}
          ${renderPanel("How the workflow differs", "Repo-native vs dashboard-first", compareTable)}
        </section>
        <section class="section grid">
          ${renderPanel("When AnswerLens fits", "Decision criteria", `<ul>${renderList([
            "You want reports, scorecards, and fix lists that move through pull requests, issues, release notes, and Pages.",
            "You want provider usage to stay in your own account rather than hidden behind a hosted vendor surface.",
            "You care more about improving source-material quality than claiming rank positions on answer surfaces.",
            "You want compare-ready, FAQ-ready, and proof-ready content gaps to be visible as artifacts, not only in a monitoring dashboard."
          ])}</ul>`)}
          ${renderPanel("Related proof pages", "Cross-linking", `<ul>${renderList([
            `<a href="${escapeHtml(proofPageUrls.pricing)}">Pricing</a>: compare packaging and cost posture.`,
            `<a href="${escapeHtml(proofPageUrls.security)}">Security</a>: compare trust and review models.`,
            `<a href="${escapeHtml(proofPageUrls.faq)}">FAQ</a>: compare first-run and guardrail answers.`,
            `<a href="${escapeHtml(proofPageUrls.integrations)}">Integrations</a>: compare GitHub-native workflow surfaces.`,
            `<a href="${escapeHtml(proofPageUrls.productMarketing)}">Product marketing teams</a>: see the fit for homepage and proof-page work.`,
            `<a href="${escapeHtml(proofPageUrls.developerAdvocacy)}">Developer advocacy teams</a>: see the fit for docs and self-serve evaluation.`
          ])}</ul>`)}
        </section>`,
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
      body: `<section class="hero"><p class="eyebrow">Integrations</p><h1>AnswerLens integrations stay GitHub-native and artifact-backed.</h1><p>The integration surface is intentionally narrow: keep the core audit contract stable, add eval providers when you need them, and layer validation imports on top without turning the project into a dashboard-first SaaS.</p></section>
        <section class="section grid">
          ${renderPanel("Current integration surfaces", "What ships now", integrationsTable)}
          ${renderPanel("How teams usually adopt", "Suggested path", `<ol><li>Open the live demo report.</li><li>Run the 60-second fixture demo.</li><li>Run one real-site audit locally.</li><li>Move the same artifact contract into the GitHub Action.</li></ol><p>That sequencing keeps integrations understandable and reviewable instead of turning each surface into a separate product.</p>`)}
          ${renderPanel("Starter bundle", "External adoption", `<p>The external-repo path is public and copyable, not hidden in internal fixtures.</p><p>Use the <a href="${escapeHtml(proofPageUrls.starter)}">starter bundle overview</a> when you need a citable explanation of the <code>.github/answerlens/</code> layout before handing someone the raw example files.</p><p>That keeps the Action path legible for forks, releases, and external setup guides.</p>`)}
          ${renderPanel("Related proof pages", "What this connects to", `<ul>${renderList([
            `<a href="${escapeHtml(proofPageUrls.faq)}">FAQ</a>: answer first-run workflow questions.`,
            `<a href="${escapeHtml(proofPageUrls.compare)}">Compare</a>: explain how the GitHub-native path differs from dashboard-first products.`,
            `<a href="${escapeHtml(proofPageUrls.pricing)}">Pricing</a>: explain where Action and eval usage create variable cost.`,
            `<a href="${escapeHtml(proofPageUrls.security)}">Security</a>: explain secret handling and review trail expectations.`,
            `<a href="${escapeHtml(proofPageUrls.starter)}">Starter bundle</a>: show the external-repo layout and artifact review order.`,
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
      body: `<section class="hero"><p class="eyebrow">Use case</p><h1>AnswerLens for product marketing teams.</h1><p>Product marketing teams use AnswerLens when they need a concrete view of why an AI system might miss the category, flatten the positioning, or skip the proof pages that support a buying decision.</p></section>
        <section class="section grid">
          ${renderPanel("Where teams start", "Workflow", `<h2>Audit the public story</h2><p>Start with the homepage, docs, pricing, and compare surfaces. Review the share summary and scorecard first, then move into the recommendations.</p><h2>What gets shipped</h2><p>Teams usually respond by tightening category language, improving proof density, and publishing better pricing, FAQ, and compare content.</p><h2>What improves</h2><p>The result is not a ranking promise. It is stronger source material that gives AI systems better evidence to cite, compare, and recommend.</p>`)}
          ${renderPanel("Related proof pages", "What to strengthen", `<ul>${renderList([
            `<a href="${escapeHtml(proofPageUrls.pricing)}">Pricing</a>: clarify packaging, BYOK cost, and download surfaces.`,
            `<a href="${escapeHtml(proofPageUrls.compare)}">Compare</a>: explicitly name Profound, Peec AI, and Otterly with clearer fit guidance.`,
            `<a href="${escapeHtml(proofPageUrls.faq)}">FAQ</a>: answer recurring objections in visible language.`,
            `<a href="${escapeHtml(proofPageUrls.security)}">Security</a>: keep trust and deployment expectations legible.`,
            `<a href="${escapeHtml(new URL("docs/", siteUrl).href)}">Docs</a>: connect proof pages back to canonical implementation notes.`
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
      body: `<section class="hero"><p class="eyebrow">Use case</p><h1>AnswerLens for developer advocacy teams.</h1><p>Developer advocacy teams use AnswerLens to see whether docs, examples, integrations, and product proof pages are strong enough for AI-mediated discovery and evaluation.</p></section>
        <section class="section grid">
          ${renderPanel("Where teams focus", "Docs and proof", `<h2>Strengthen docs visibility</h2><p>Review whether the docs index, setup guidance, and API references are public, scannable, and linked from the homepage and adjacent proof pages.</p><h2>Ship example artifacts</h2><p>Use Pages examples, release bundles, and fixture reports as public teaching tools that can be linked directly in GitHub.</p><h2>Reduce first-run friction</h2><p>Keep the quickstart and GitHub Action path aligned so that new developers can move from the demo to their own repository without guesswork.</p>`)}
          ${renderPanel("Related proof pages", "What to connect", `<ul>${renderList([
            `<a href="${escapeHtml(new URL("docs/", siteUrl).href)}">Docs</a>: keep activation references and implementation notes visible.`,
            `<a href="${escapeHtml(proofPageUrls.integrations)}">Integrations</a>: explain the GitHub Action, providers, and validation layers together.`,
            `<a href="${escapeHtml(proofPageUrls.faq)}">FAQ</a>: answer first-run setup questions before CI adoption.`,
            `<a href="${escapeHtml(proofPageUrls.compare)}">Compare</a>: explain why a repo-native workflow differs from dashboard-first tools.`,
            `<a href="${escapeHtml(proofPageUrls.security)}">Security</a>: set expectations for secrets, artifacts, and public sharing.`
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
      description: "How open-source maintainers can use AnswerLens on README, Pages, releases, and demo artifacts.",
      body: `<section class="hero"><p class="eyebrow">Use case</p><h1>AnswerLens for open-source maintainers.</h1><p>Open-source maintainers use AnswerLens when the repository itself is the product entry point and the project needs better README, Pages, release, and artifact surfaces before it needs more product modules.</p></section>
        <section class="section grid">
          ${renderPanel("Why maintainers use it", "GitHub-native distribution", `<h2>Audit the repository as public source material</h2><p>Use the README as the canonical home, Pages as the audit target, and release notes as the second front door.</p><h2>Review artifacts in GitHub</h2><p>AnswerLens turns unclear packaging problems into artifacts that can be discussed in issues, pull requests, and Discussions announcements.</p><h2>Repeat the loop</h2><p>That makes self-dogfooding practical: improve public proof pages, rerun the audit, and track whether the next round of feedback is more meaningful.</p>`)}
          ${renderPanel("Related proof pages", "What to keep aligned", `<ul>${renderList([
            `<a href="${escapeHtml(proofPageUrls.pricing)}">Pricing</a>: keep packaging claims concrete and citable.`,
            `<a href="${escapeHtml(proofPageUrls.security)}">Security</a>: keep trust language honest and reviewable.`,
            `<a href="${escapeHtml(proofPageUrls.compare)}">Compare</a>: explain the public positioning against adjacent tools.`,
            `<a href="${escapeHtml(proofPageUrls.integrations)}">Integrations</a>: keep the GitHub-native adoption path visible.`,
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
      title: "Fix playbooks from current audit artifacts",
      description: "Fix-oriented pages built from current recommendations and concept docs.",
      body: `<section class="hero"><p class="eyebrow">Fixes and playbooks</p><h1>Playbooks should be grounded in audit artifacts, not generic AI SEO advice.</h1><p>This page compiles the latest example recommendations and points back to the concept docs that explain why those fixes matter.</p></section>
        <section class="section grid">
          ${renderPanel("Current recommendations", "From the latest demo run", `<pre class="markdown">${escapeHtml(recommendationsMarkdown.trim())}</pre>`)}
          ${renderPanel("Recommended reading", "Concept support", `<ul>${renderList([
            `<a href="${escapeHtml(repoBlob("docs/concepts/schema-text-consistency.md"))}">Schema-text consistency</a>`,
            `<a href="${escapeHtml(repoBlob("docs/concepts/evidence-density.md"))}">Evidence density</a>`,
            `<a href="${escapeHtml(repoBlob("docs/github-action.md"))}">GitHub Action usage</a>`,
            `<a href="${escapeHtml(repoBlob("docs/distribution-plan.md"))}">Distribution plan</a>`
          ])}</ul>`)}
        </section>`,
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "AnswerLens playbooks",
        description: "Fix-oriented playbooks compiled from AnswerLens artifacts.",
        url: new URL("playbooks/", siteUrl).href
      }
    }
  ];

  await writeFile(path.join(outDir, "index.html"), renderLocaleRedirectPage(siteUrl, ""), "utf8");

  for (const page of pages) {
    await mkdir(path.dirname(page.filePath ?? path.join(outDir, page.route, "index.html")), { recursive: true });
    await writeFile(page.filePath ?? path.join(outDir, page.route, "index.html"), renderLocaleRedirectPage(siteUrl, page.route), "utf8");
    await mkdir(path.dirname(localeIndexPath(outDir, page.route, "en")), { recursive: true });
    await mkdir(path.dirname(localeIndexPath(outDir, page.route, "zh-CN")), { recursive: true });
    await writeFile(localeIndexPath(outDir, page.route, "en"), renderLayout(siteUrl, page, updatedAt, "en"), "utf8");
    await writeFile(localeIndexPath(outDir, page.route, "zh-CN"), renderLayout(siteUrl, page, updatedAt, "zh-CN"), "utf8");
  }

  const sitemap = pages
    .flatMap((page) => [
      `<url><loc>${escapeHtml(new URL(localizePath(page.route, "en"), siteUrl).href)}</loc><lastmod>${escapeHtml(updatedAt)}</lastmod></url>`,
      `<url><loc>${escapeHtml(new URL(localizePath(page.route, "zh-CN"), siteUrl).href)}</loc><lastmod>${escapeHtml(updatedAt)}</lastmod></url>`
    ])
    .join("");
  await writeFile(
    path.join(outDir, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemap}</urlset>\n`,
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
