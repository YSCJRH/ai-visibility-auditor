export const DEFAULT_LOCALE = "en" as const;
export const LOCALE_STORAGE_KEY = "answerlens.locale";
export const LOCALE_COOKIE_KEY = "answerlens_locale";

export type Locale = "en" | "zh-CN";

type Values = Record<string, string | number>;

const messages: Record<Locale, Record<string, string>> = {
  en: {
    "lang.label": "Language",
    "lang.english": "English",
    "lang.chinese": "简体中文",
    "common.pending": "Pending",
    "common.openRaw": "Open raw",
    "common.download": "Download",
    "common.openPreview": "Open preview",
    "common.loadingArtifact": "Loading artifact...",
    "common.unableToLoadArtifact": "Unable to load {name}.",
    "admin.brandLabel": "Internal control console",
    "admin.brandSummary": "Orchestrate audits, inspect artifact trails, and keep the repo-native workflow visible without turning AnswerLens into a dashboard-first product.",
    "admin.topbar.title": "CI for AI discoverability",
    "admin.topbar.summary": "Vaporwave shell, calm data plane: internal orchestration for repo presets, file-backed runs, and report review.",
    "admin.nav.runs": "Runs",
    "admin.nav.presets": "Presets",
    "admin.scope.title": "V1 scope",
    "admin.scope.item1": "Runs as the primary workspace",
    "admin.scope.item2": "Artifact-first review order",
    "admin.scope.item3": "Thin BFF over repo presets and local runs",
    "admin.reviewOrder.title": "Review order",
    "admin.reviewOrder.item1": "Open `share-summary.md` first",
    "admin.reviewOrder.item2": "Then inspect `scorecard.md`",
    "admin.reviewOrder.item3": "Use `recommendations.md` for the fix path",
    "admin.launch": "Launch run",
    "admin.runs.eyebrow": "Runs workspace",
    "admin.runs.title": "Review the latest file-backed runs",
    "admin.runs.description": "The admin surface starts from completed artifacts, not charts. Use the run list to jump into the report trail, inspect score shifts, and open the three primary review artifacts in order.",
    "admin.runs.totalRuns": "Total runs",
    "admin.runs.totalRuns.helper": "All artifacts currently readable from `runs/*`.",
    "admin.runs.averageScore": "Average score",
    "admin.runs.averageScore.helper": "A quick pulse across the current local history.",
    "admin.runs.latestRun": "Latest run",
    "admin.runs.latestRun.helper": "Launch a run from the top bar to seed the workspace.",
    "admin.runs.mix": "Run mix",
    "admin.runs.mix.helper": "Audit to eval count across the local workspace.",
    "admin.runs.filter.all": "All runs",
    "admin.runs.filter.audit": "Audit only",
    "admin.runs.filter.eval": "Eval only",
    "admin.runs.loading": "Loading runs...",
    "admin.runs.error": "Unable to read the run workspace.",
    "admin.runs.empty": "No runs matched this filter yet. Launch a fresh audit to seed the workspace.",
    "admin.runs.guideEyebrow": "Current focus",
    "admin.runs.guideTitle": "Which run should you inspect first?",
    "admin.runs.guideBody": "Start from the latest completed run, confirm whether the score still looks healthy, and then move into the artifact trail in order.",
    "admin.runs.guideEmpty": "As soon as the first audit lands, this page becomes the operator index for the whole workspace.",
    "admin.runs.guideOpen": "Open run detail",
    "admin.runs.nextEyebrow": "Next move",
    "admin.runs.nextTitle": "How to use this page",
    "admin.runs.nextBody": "Use the list as triage, not as a dashboard. The goal is to pick the next run worth reviewing, then move into artifact-backed detail.",
    "admin.runs.nextStep1": "Start with the newest useful run instead of scanning every row equally.",
    "admin.runs.nextStep2": "Filter to audit or eval only when you are answering one specific question.",
    "admin.runs.nextStep3": "After you open a run, keep the sequence fixed: share summary, scorecard, then recommendations.",
    "admin.table.run": "Run",
    "admin.table.site": "Site",
    "admin.table.kind": "Kind",
    "admin.table.score": "Score",
    "admin.table.status": "Status",
    "admin.table.generated": "Generated",
    "admin.detail.loading": "Loading run detail...",
    "admin.detail.error": "Unable to load that run. Return to the runs list and try again.",
    "admin.detail.eyebrow": "Run detail",
    "admin.detail.description": "{kind} run generated {date}. Review the artifact order first, then inspect audit issues and score buckets.",
    "admin.detail.overallScore": "Overall score",
    "admin.detail.vavr": "VAVR",
    "admin.detail.vavr.helper": "Only populated after eval-backed review.",
    "admin.detail.artifacts": "Artifacts",
    "admin.detail.artifacts.helper": "Includes Markdown, HTML, and JSON outputs.",
    "admin.detail.keyPages": "Key pages",
    "admin.detail.keyPages.helper": "Derived from `site-audit.json` when available.",
    "admin.detail.signalEyebrow": "Current signal",
    "admin.detail.signalTitle": "What this run says right now",
    "admin.detail.signalBody": "Use the share summary to frame the run, then confirm one issue and one next fix before you dive into the full artifact set.",
    "admin.detail.topIssue": "Top issue",
    "admin.detail.topFix": "Top fix",
    "admin.detail.none": "none",
    "admin.detail.nextEyebrow": "Next move",
    "admin.detail.nextTitle": "How to review this run",
    "admin.detail.nextBody": "Keep the same sequence every time so the run stays understandable to both operators and teammates.",
    "admin.detail.nextStep1": "Open `share-summary.md` to understand the run in one screen.",
    "admin.detail.nextStep2": "Use `scorecard.md` to confirm bucket-level structure and issue density.",
    "admin.detail.nextStep3": "Use `recommendations.md` to decide what should ship next.",
    "admin.detail.nextStep4": "Only then use `pr-snippet.md`, HTML preview, or raw JSON for distribution and deeper debugging.",
    "admin.detail.workspaceEyebrow": "Artifact workspace",
    "admin.detail.workspaceTitle": "Open the report trail in order",
    "admin.detail.workspaceBody": "Start with {order}. Use the HTML report for full browsing, then drop back to the raw JSON artifacts if you need machine-contract detail.",
    "admin.detail.issuesEyebrow": "Audit issues",
    "admin.detail.issuesTitle": "Top issues",
    "admin.detail.issuesBody": "These come directly from `site-audit.json`, so the UI stays aligned with the artifact contract.",
    "admin.detail.fixEyebrow": "Fix path",
    "admin.detail.fixTitle": "Recommendations",
    "admin.detail.contextEyebrow": "Run manifest",
    "admin.detail.contextTitle": "Context",
    "admin.detail.runId": "Run id",
    "admin.detail.siteInput": "Site input",
    "admin.detail.baseUrl": "Base URL",
    "admin.detail.artifactVersion": "Artifact version",
    "admin.detail.ruleVersion": "Rule version",
    "admin.detail.bucketsEyebrow": "Score buckets",
    "admin.detail.bucketsTitle": "Audit breakdown",
    "admin.detail.bucketsEmpty": "No bucket scores were available for this run.",
    "admin.detail.bucketMeta": "{issues} issues | {warnings} warnings | {info} info",
    "admin.issues.empty": "No current issues in the audit artifact.",
    "admin.issues.severity": "Severity",
    "admin.issues.issue": "Issue",
    "admin.issues.scope": "Scope",
    "admin.issues.fixHint": "Fix hint",
    "admin.recommendation.eyebrow": "Recommendation",
    "admin.recommendation.empty": "No recommendation artifact was available for this run.",
    "admin.presets.eyebrow": "Preset registry",
    "admin.presets.title": "Repo-native configuration sources",
    "admin.presets.description": "The admin console reads the same preset families that power the public demo, self-dogfooding loop, and consumer-repo starter bundle. These are the sources the launcher can use without editing YAML in the browser.",
    "admin.presets.count": "Preset count",
    "admin.presets.count.helper": "Current configuration sources visible to the BFF.",
    "admin.presets.primary": "Primary target",
    "admin.presets.primary.empty": "No preset loaded yet.",
    "admin.presets.loading": "Loading presets...",
    "admin.presets.error": "Unable to load the preset registry.",
    "admin.presets.defaultSite": "Default site",
    "admin.presets.displayName": "Display name",
    "admin.presets.displayName.empty": "Not set",
    "admin.presets.domain": "Domain",
    "admin.presets.files": "Files",
    "admin.presets.guideEyebrow": "Preset ladder",
    "admin.presets.guideTitle": "Which preset matches which workflow?",
    "admin.presets.guideBody": "These presets line up with the same real paths you already see in the public funnel: fixture demo, AnswerLens self-dogfooding, and external starter adoption.",
    "admin.presets.purpose": "Best used for",
    "admin.presets.nextMove": "Next move",
    "admin.presets.use.fixture": "Use this for the fastest local reproduction of the public demo path.",
    "admin.presets.use.repo": "Use this to audit the live AnswerLens Pages surface with the repo’s own config.",
    "admin.presets.use.starter": "Use this to explain or validate the external consumer-repo starter path.",
    "admin.presets.next.fixture": "After this preset, move into one real-site audit before you wire CI.",
    "admin.presets.next.repo": "After this preset, compare the result with the public Pages copy and self-dogfood backlog.",
    "admin.presets.next.starter": "After this preset, copy the same layout into the repository you actually want to adopt.",
    "admin.launcher.eyebrow": "Run launcher",
    "admin.launcher.title": "Start an AnswerLens run",
    "admin.launcher.summary": "Choose a repo preset, set the target site, and let the BFF write a fresh file-backed run into `runs/*`.",
    "admin.launcher.close": "Close run launcher",
    "admin.launcher.mode.audit": "Audit",
    "admin.launcher.mode.eval": "Eval",
    "admin.launcher.preset": "Preset",
    "admin.launcher.site": "Site input",
    "admin.launcher.site.placeholder": "https://example.com or ./examples/fixtures/static-good",
    "admin.launcher.provider": "Provider",
    "admin.launcher.samples": "Samples",
    "admin.launcher.model": "Model override",
    "admin.launcher.model.placeholder": "Optional, defaults to the provider's standard model",
    "admin.launcher.defaultTarget": "Default target",
    "admin.launcher.files": "Files",
    "admin.launcher.loadingPresets": "Loading presets...",
    "admin.launcher.selectPresetError": "Select a preset before launching a run.",
    "admin.launcher.launching": "Launching...",
    "admin.launcher.start": "Start {mode}",
    "admin.launcher.presetGuide": "This preset is best used for",
    "admin.launcher.nextMove": "After this run",
    "admin.launcher.use.fixture": "Reproducing the public fixture demo locally.",
    "admin.launcher.use.repo": "Auditing the live AnswerLens Pages surface with the repo’s own config.",
    "admin.launcher.use.starter": "Explaining or validating the external starter-bundle adoption path.",
    "admin.launcher.next.fixture": "Move into one real-site audit before you wire CI.",
    "admin.launcher.next.repo": "Compare the result with the public Pages copy and the self-dogfood backlog.",
    "admin.launcher.next.starter": "Copy the same layout into the repository you actually want to adopt.",
    "admin.artifacts.orderEyebrow": "Primary order",
    "admin.artifacts.orderTitle": "Open these first",
    "admin.artifacts.orderBody": "Keep the primary review path stable before you use preview, download, or raw JSON actions.",
    "admin.artifacts.orderStep1": "share-summary.md",
    "admin.artifacts.orderStep2": "scorecard.md",
    "admin.artifacts.orderStep3": "recommendations.md",
    "status.queued": "Queued",
    "status.running": "Running",
    "status.completed": "Completed",
    "status.failed": "Failed",
    "kind.audit": "Audit",
    "kind.eval": "Eval",
    "kind.manual-import": "Manual import",
    "kind.validation-import": "Validation import",
    "scope.site": "site",
    "scope.page": "page",
    "severity.error": "error",
    "severity.warn": "warn",
    "severity.info": "info",
    "bucket.access": "Access",
    "bucket.structure": "Structure",
    "bucket.entityClarity": "Entity Clarity",
    "bucket.evidence": "Evidence",
    "bucket.comparativeReadiness": "Comparative Readiness"
  },
  "zh-CN": {
    "lang.label": "语言",
    "lang.english": "English",
    "lang.chinese": "简体中文",
    "common.pending": "待生成",
    "common.openRaw": "打开原始文件",
    "common.download": "下载",
    "common.openPreview": "打开预览",
    "common.loadingArtifact": "正在加载产物...",
    "common.unableToLoadArtifact": "无法加载 {name}。",
    "admin.brandLabel": "内部控制台",
    "admin.brandSummary": "编排审计、检查产物链路，并在不把 AnswerLens 变成 dashboard-first 产品的前提下，保持 repo-native 工作流可见。",
    "admin.topbar.title": "面向 AI 可发现性的 CI",
    "admin.topbar.summary": "Vaporwave 外壳，克制数据面：围绕仓库 preset、文件型 runs 与报告审阅的内部操作台。",
    "admin.nav.runs": "运行",
    "admin.nav.presets": "预设",
    "admin.scope.title": "V1 范围",
    "admin.scope.item1": "以 runs 作为主工作区",
    "admin.scope.item2": "以产物顺序为先的审阅流",
    "admin.scope.item3": "在仓库 preset 与本地 runs 之上提供轻量 BFF",
    "admin.reviewOrder.title": "审阅顺序",
    "admin.reviewOrder.item1": "先打开 `share-summary.md`",
    "admin.reviewOrder.item2": "再查看 `scorecard.md`",
    "admin.reviewOrder.item3": "最后用 `recommendations.md` 进入修复路径",
    "admin.launch": "发起运行",
    "admin.runs.eyebrow": "运行工作区",
    "admin.runs.title": "查看最新的文件型运行结果",
    "admin.runs.description": "后台从已完成的产物出发，而不是从图表出发。通过 run 列表进入报告链路、比较分数变化，并按固定顺序打开三个核心审阅产物。",
    "admin.runs.totalRuns": "运行总数",
    "admin.runs.totalRuns.helper": "当前可从 `runs/*` 读取的全部产物。",
    "admin.runs.averageScore": "平均分",
    "admin.runs.averageScore.helper": "快速感知本地历史结果的整体状态。",
    "admin.runs.latestRun": "最新运行",
    "admin.runs.latestRun.helper": "可从顶部启动一条新运行来填充工作区。",
    "admin.runs.mix": "运行构成",
    "admin.runs.mix.helper": "本地工作区中 audit 与 eval 的数量比。",
    "admin.runs.filter.all": "全部运行",
    "admin.runs.filter.audit": "仅审计",
    "admin.runs.filter.eval": "仅评估",
    "admin.runs.loading": "正在加载运行列表...",
    "admin.runs.error": "无法读取运行工作区。",
    "admin.runs.empty": "当前筛选条件下还没有匹配的运行。先发起一次新的审计来填充工作区。",
    "admin.runs.guideEyebrow": "当前焦点",
    "admin.runs.guideTitle": "先审哪一条 run？",
    "admin.runs.guideBody": "先从最新一条已完成的运行开始，确认分数是否仍然健康，再按顺序进入 artifact 链路。",
    "admin.runs.guideEmpty": "只要第一条审计跑出来，这一页就会变成整个工作区的操作索引。",
    "admin.runs.guideOpen": "打开运行详情",
    "admin.runs.nextEyebrow": "下一步",
    "admin.runs.nextTitle": "这页该怎么用",
    "admin.runs.nextBody": "把这张列表当成分诊入口，而不是 dashboard。目标是挑出下一条值得审阅的 run，然后进入 artifact-backed 的详情页。",
    "admin.runs.nextStep1": "先看最新且有价值的一条 run，不要把每一行都当成同等优先级。",
    "admin.runs.nextStep2": "只有当你在回答一个明确问题时，再切到仅审计或仅评估筛选。",
    "admin.runs.nextStep3": "进入详情后，保持固定顺序：share summary、scorecard、然后 recommendations。",
    "admin.table.run": "运行",
    "admin.table.site": "站点",
    "admin.table.kind": "类型",
    "admin.table.score": "分数",
    "admin.table.status": "状态",
    "admin.table.generated": "生成时间",
    "admin.detail.loading": "正在加载运行详情...",
    "admin.detail.error": "无法加载该运行。请返回运行列表后重试。",
    "admin.detail.eyebrow": "运行详情",
    "admin.detail.description": "{kind} 运行生成于 {date}。先看产物顺序，再检查审计问题和分桶分数。",
    "admin.detail.overallScore": "总分",
    "admin.detail.vavr": "VAVR",
    "admin.detail.vavr.helper": "仅在有 eval 支撑的复核后才会填充。",
    "admin.detail.artifacts": "产物数",
    "admin.detail.artifacts.helper": "包括 Markdown、HTML 与 JSON 输出。",
    "admin.detail.keyPages": "关键页面",
    "admin.detail.keyPages.helper": "如存在，则来自 `site-audit.json`。",
    "admin.detail.signalEyebrow": "当前信号",
    "admin.detail.signalTitle": "这次运行现在说明了什么",
    "admin.detail.signalBody": "先用 share summary 给这次运行定性，再确认一个核心问题和一个优先修复，然后再深入完整产物集。",
    "admin.detail.topIssue": "核心问题",
    "admin.detail.topFix": "优先修复",
    "admin.detail.none": "无",
    "admin.detail.nextEyebrow": "下一步",
    "admin.detail.nextTitle": "这轮运行该怎么审",
    "admin.detail.nextBody": "每次都按同一顺序审阅，这样这轮结果对操作者和协作者都会更容易理解。",
    "admin.detail.nextStep1": "先看 `share-summary.md`，用一屏内容理解这轮运行。",
    "admin.detail.nextStep2": "再看 `scorecard.md`，确认分桶结构和问题密度。",
    "admin.detail.nextStep3": "再看 `recommendations.md`，决定下一步该推进什么。",
    "admin.detail.nextStep4": "最后再用 `pr-snippet.md`、HTML 预览或原始 JSON 做分发和更深层调试。",
    "admin.detail.workspaceEyebrow": "产物工作区",
    "admin.detail.workspaceTitle": "按顺序打开报告链路",
    "admin.detail.workspaceBody": "先看 {order}。若要完整浏览，可打开 HTML 报告；如果要追机器契约细节，再回到原始 JSON 产物。",
    "admin.detail.issuesEyebrow": "审计问题",
    "admin.detail.issuesTitle": "主要问题",
    "admin.detail.issuesBody": "这些内容直接来自 `site-audit.json`，因此界面始终与产物契约对齐。",
    "admin.detail.fixEyebrow": "修复路径",
    "admin.detail.fixTitle": "建议",
    "admin.detail.contextEyebrow": "运行清单",
    "admin.detail.contextTitle": "上下文",
    "admin.detail.runId": "运行 ID",
    "admin.detail.siteInput": "站点输入",
    "admin.detail.baseUrl": "基础 URL",
    "admin.detail.artifactVersion": "产物版本",
    "admin.detail.ruleVersion": "规则版本",
    "admin.detail.bucketsEyebrow": "分桶得分",
    "admin.detail.bucketsTitle": "审计拆解",
    "admin.detail.bucketsEmpty": "该运行没有可用的分桶分数。",
    "admin.detail.bucketMeta": "{issues} 个问题 | {warnings} 个警告 | {info} 条提示",
    "admin.issues.empty": "当前审计产物中没有问题。",
    "admin.issues.severity": "严重级别",
    "admin.issues.issue": "问题",
    "admin.issues.scope": "范围",
    "admin.issues.fixHint": "修复提示",
    "admin.recommendation.eyebrow": "建议",
    "admin.recommendation.empty": "该运行没有可用的建议产物。",
    "admin.presets.eyebrow": "预设注册表",
    "admin.presets.title": "仓库原生配置来源",
    "admin.presets.description": "后台读取的是同一批 preset 家族：公开 demo、自我应用闭环和 consumer-repo starter bundle 都依赖它们。启动器无需在浏览器里编辑 YAML 就能复用这些来源。",
    "admin.presets.count": "预设数量",
    "admin.presets.count.helper": "当前 BFF 可见的配置来源数量。",
    "admin.presets.primary": "主目标",
    "admin.presets.primary.empty": "尚未加载任何预设。",
    "admin.presets.loading": "正在加载预设...",
    "admin.presets.error": "无法加载预设注册表。",
    "admin.presets.defaultSite": "默认站点",
    "admin.presets.displayName": "展示名",
    "admin.presets.displayName.empty": "未设置",
    "admin.presets.domain": "域名",
    "admin.presets.files": "文件",
    "admin.presets.guideEyebrow": "预设阶梯",
    "admin.presets.guideTitle": "哪个 preset 对应哪条路径？",
    "admin.presets.guideBody": "这些 preset 对应的正是你在公开漏斗里看到的真实路径：fixture demo、AnswerLens 自审，以及外部 starter adoption。",
    "admin.presets.purpose": "最适合用在",
    "admin.presets.nextMove": "下一步动作",
    "admin.presets.use.fixture": "当你想最快在本地复现公开 demo 路径时，用这个 preset。",
    "admin.presets.use.repo": "当你想用仓库自己的配置去审计 live AnswerLens Pages 面时，用这个 preset。",
    "admin.presets.use.starter": "当你想解释或验证外部 consumer-repo starter 路径时，用这个 preset。",
    "admin.presets.next.fixture": "跑完这个 preset 之后，下一步应该进入真实站点审计，再去接 CI。",
    "admin.presets.next.repo": "跑完这个 preset 之后，把结果和公开 Pages 文案、自我应用 backlog 对起来看。",
    "admin.presets.next.starter": "跑完这个 preset 之后，把同一套布局复制到你真正要接入的仓库里。",
    "admin.launcher.eyebrow": "运行启动器",
    "admin.launcher.title": "发起一条 AnswerLens 运行",
    "admin.launcher.summary": "选择仓库预设，设置目标站点，然后由 BFF 把新的文件型运行写入 `runs/*`。",
    "admin.launcher.close": "关闭运行启动器",
    "admin.launcher.mode.audit": "审计",
    "admin.launcher.mode.eval": "评估",
    "admin.launcher.preset": "预设",
    "admin.launcher.site": "站点输入",
    "admin.launcher.site.placeholder": "https://example.com 或 ./examples/fixtures/static-good",
    "admin.launcher.provider": "提供方",
    "admin.launcher.samples": "样本数",
    "admin.launcher.model": "模型覆盖",
    "admin.launcher.model.placeholder": "可选，默认使用该提供方的标准模型",
    "admin.launcher.defaultTarget": "默认目标",
    "admin.launcher.files": "文件",
    "admin.launcher.loadingPresets": "正在加载预设...",
    "admin.launcher.selectPresetError": "请先选择一个预设后再发起运行。",
    "admin.launcher.launching": "正在发起...",
    "admin.launcher.start": "开始 {mode}",
    "admin.launcher.presetGuide": "这个 preset 最适合用在",
    "admin.launcher.nextMove": "跑完之后",
    "admin.launcher.use.fixture": "在本地复现公开 fixture demo。",
    "admin.launcher.use.repo": "用仓库自己的配置审计 live AnswerLens Pages 面。",
    "admin.launcher.use.starter": "解释或验证外部 starter bundle 的 adoption 路径。",
    "admin.launcher.next.fixture": "下一步进入真实站点审计，再去接 CI。",
    "admin.launcher.next.repo": "把这轮结果和公开 Pages 文案、自我应用 backlog 对起来看。",
    "admin.launcher.next.starter": "把同一套布局复制到你真正要接入的仓库里。",
    "admin.artifacts.orderEyebrow": "主审阅顺序",
    "admin.artifacts.orderTitle": "先打开这三份",
    "admin.artifacts.orderBody": "先把主审阅路径走完，再用预览、下载或原始 JSON 做更深层排查。",
    "admin.artifacts.orderStep1": "share-summary.md",
    "admin.artifacts.orderStep2": "scorecard.md",
    "admin.artifacts.orderStep3": "recommendations.md",
    "status.queued": "排队中",
    "status.running": "运行中",
    "status.completed": "已完成",
    "status.failed": "失败",
    "kind.audit": "审计",
    "kind.eval": "评估",
    "kind.manual-import": "手工导入",
    "kind.validation-import": "验证导入",
    "scope.site": "站点",
    "scope.page": "页面",
    "severity.error": "错误",
    "severity.warn": "警告",
    "severity.info": "提示",
    "bucket.access": "可访问性",
    "bucket.structure": "结构",
    "bucket.entityClarity": "实体清晰度",
    "bucket.evidence": "证据",
    "bucket.comparativeReadiness": "比较准备度"
  }
};

const issueTitleTranslations: Record<string, string> = {
  "Thin key page": "关键页面内容过薄",
  "Compare page does not name declared competitors": "对比页未点名已声明的竞争对手",
  "Key proof page is weakly linked": "关键证明页链接较弱",
  "Page fetch failed": "页面抓取失败"
};

const fixHintTranslations: Record<string, string> = {
  "Add plain-language explanations, evidence blocks, and stronger sections.": "补充通俗解释、证据模块和更强的章节结构。",
  "Name the highest-priority competitors and explain fit differences directly on the page.": "直接在页面中点名优先级最高的竞争对手，并解释适配差异。",
  "Add links from the homepage, docs, product, or adjacent proof pages using descriptive anchors.": "从首页、文档、产品页或相邻证明页添加描述性锚文本链接。",
  "Make the page reachable without a browser-only session.": "让页面在无需仅浏览器会话的情况下可访问。"
};

const recommendationTitleTranslations: Record<string, string> = {
  "Remove crawl and indexing blockers": "移除抓取与索引阻塞项",
  "Tighten structure and schema alignment on key pages": "强化关键页面的结构与 schema 对齐",
  "Clarify homepage positioning": "澄清首页定位",
  "Add citable pricing, trust, and documentation proof": "补充可引用的定价、信任与文档证明",
  "Close FAQ, compare, integrations, and use-case gaps": "补齐 FAQ、对比、集成与用例缺口"
};

const recommendationRationaleTranslations: Record<string, string> = {
  "Answer-layer visibility starts with accessible HTML, permissive crawl controls, and discoverable pages.": "答案层可见性的起点，是可访问的 HTML、宽松的抓取控制以及可被发现的页面。",
  "Thin, weakly segmented pages and mismatched schema make assistants less likely to interpret pages consistently.": "内容过薄、分段结构弱或 schema 不匹配，会降低助手稳定理解页面的概率。",
  "The homepage should state category, audience, and use cases plainly enough for assistants to quote them back.": "首页应足够清楚地写出类别、受众和用例，让助手能够准确复述。",
  "Pricing, security, documentation, and outcome details create the evidence that grounded answers can cite.": "定价、安全、文档和结果细节，会构成可被有根据回答引用的证据基础。",
  "Answer engines need comparison-ready source material plus contextual internal linking, not just a homepage.": "答案引擎需要具备可比较性的源材料和带上下文的内部链接，而不只是一个首页。"
};

const expectedOutcomeTranslations: Record<string, string> = {
  "Better crawlability and cleaner downstream discovery.": "提升可抓取性，并让下游发现路径更干净。",
  "Higher extraction quality and fewer ambiguous summaries.": "提高抽取质量，减少含糊总结。",
  "Stronger entity clarity ahead of eval-mode mention scoring.": "在 eval 提及评分前，先强化实体清晰度。",
  "More reliable evidence signals and stronger future citation coverage.": "形成更可靠的证据信号，并提升后续引用覆盖能力。",
  "Better readiness for shortlist, alternatives, and evaluation prompts.": "更好地应对 shortlist、alternatives 和评估类提示词。"
};

function interpolate(template: string, values?: Values): string {
  if (!values) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));
}

export function normalizeLocale(value?: string | null): Locale {
  if (!value) {
    return DEFAULT_LOCALE;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === "zh" || normalized === "zh-cn" || normalized.startsWith("zh-") ? "zh-CN" : "en";
}

export function t(locale: Locale, key: string, values?: Values): string {
  return interpolate(messages[locale][key] ?? messages.en[key] ?? key, values);
}

export function formatDate(value: string, locale: Locale, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(locale === "zh-CN" ? "zh-CN" : "en-US", options).format(new Date(value));
}

export function translateStatus(status: string, locale: Locale): string {
  return t(locale, `status.${status}`);
}

export function translateRunKind(kind: string, locale: Locale): string {
  return t(locale, `kind.${kind}`);
}

export function translateSeverity(severity: string, locale: Locale): string {
  return t(locale, `severity.${severity}`);
}

export function translateScope(scope: string, locale: Locale): string {
  return t(locale, `scope.${scope}`);
}

export function translateBucket(bucket: string, locale: Locale): string {
  return t(locale, `bucket.${bucket}`);
}

export function translateIssueTitle(title: string, locale: Locale): string {
  return locale === "zh-CN" ? issueTitleTranslations[title] ?? title : title;
}

export function translateFixHint(fixHint: string, locale: Locale): string {
  return locale === "zh-CN" ? fixHintTranslations[fixHint] ?? fixHint : fixHint;
}

export function translateRecommendationTitle(title: string, locale: Locale): string {
  return locale === "zh-CN" ? recommendationTitleTranslations[title] ?? title : title;
}

export function translateRecommendationRationale(rationale: string, locale: Locale): string {
  return locale === "zh-CN" ? recommendationRationaleTranslations[rationale] ?? rationale : rationale;
}

export function translateExpectedOutcome(expectedOutcome: string, locale: Locale): string {
  return locale === "zh-CN" ? expectedOutcomeTranslations[expectedOutcome] ?? expectedOutcome : expectedOutcome;
}

export function setLocaleCookieHeader(locale: Locale): string {
  return `${LOCALE_COOKIE_KEY}=${encodeURIComponent(locale)}; Path=/; Max-Age=31536000; SameSite=Lax`;
}
