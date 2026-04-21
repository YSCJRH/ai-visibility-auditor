export const SUPPORTED_LOCALES = ["en", "zh-CN"] as const;
export const DEFAULT_LOCALE = "en" as const;
export const LOCALE_STORAGE_KEY = "answerlens.locale";
export const LOCALE_COOKIE_KEY = "answerlens_locale";

export type Locale = (typeof SUPPORTED_LOCALES)[number];
export type LocaleSlug = "en" | "zh";

type MessageCatalog = Record<string, string>;
type TemplateValue = string | number;

const messages: Record<Locale, MessageCatalog> = {
  en: {
    "lang.label": "Language",
    "lang.english": "English",
    "lang.chinese": "简体中文",
    "nav.home": "Home",
    "nav.docs": "Docs",
    "nav.releases": "Releases",
    "nav.examples": "Examples",
    "nav.playbooks": "Playbooks",
    "nav.github": "GitHub",
    "common.pending": "Pending",
    "common.none": "none",
    "common.loading": "Loading...",
    "common.unavailable": "Unavailable",
    "common.openRaw": "Open raw",
    "common.download": "Download",
    "common.openPreview": "Open preview",
    "common.loadingArtifact": "Loading artifact...",
    "common.unableToLoadArtifact": "Unable to load {name}.",
    "common.localizedPage": "This page is also available in {language}.",
    "footer.distribution": "Built by YSCJRH from repo-native docs, releases, and artifacts. No consumer AI UI scraping. No ranking promises.",
    "brand.description": "AnswerLens is a CLI-first AI visibility auditor for product websites.",
    "brand.description.repo": "AnswerLens is a CLI-first, GitHub-native AI visibility auditor for product websites.",
    "brand.tagline": "CI for AI discoverability.",
    "brand.positioning": "Audit whether a product site can be read, cited, compared, and recommended by AI systems.",
    "brand.disclaimer": "AnswerLens does not scrape consumer AI UIs, auto-post content, or guarantee answer-surface rankings.",
    "site.demo": "Demo site",
    "site.note.fixture": "https://fixture.local is the stable fixture hostname inside the public demo fixture, not the AnswerLens site URL.",
    "run.mode": "Mode",
    "run.id": "Run ID",
    "run.generated": "Generated",
    "run.ruleVersion": "Rule version",
    "report.shareSummary.title": "AnswerLens Share Summary",
    "report.evalSummary.title": "AnswerLens Eval Summary",
    "report.recommendations.title": "AnswerLens Recommendations",
    "report.scorecard.title": "AnswerLens Visibility Scorecard",
    "report.metrics": "Metrics",
    "report.run": "Run",
    "report.issues": "AI may miss this product because",
    "report.fixes": "Top fixes",
    "report.artifacts": "Shareable artifacts",
    "report.guardrails": "Guardrails",
    "report.relatedIssues": "Related issues",
    "report.generated": "Generated",
    "report.overallScore": "Overall score",
    "report.vavr": "VAVR",
    "report.artifactOrder": "Open artifacts in order",
    "report.metricLabel": "Metric",
    "report.metricValue": "Value",
    "report.pr.title": "AnswerLens audit",
    "report.pr.issueHeading": "AI may miss this product because",
    "report.pr.fixHeading": "Recommended next fixes",
    "report.pr.artifacts": "Artifacts and guardrails",
    "report.manualValidation": "Manual validation: CPS {score} across {coverage}% ranked samples.",
    "report.stability": "Stability: {stableRate}% of repeated prompt groups were stable ({unstableCount} unstable across {repeatedCount} repeated prompts).",
    "report.searchValidation": "{label} validation: {withEvidence}/{total} key pages show {label} evidence.",
    "report.indexNow": "IndexNow helper: prepared {count} candidate URLs for submission planning.",
    "report.noRecommendations": "No recommendations were generated for this run.",
    "report.noIssues": "none",
    "admin.brandLabel": "Internal control console",
    "admin.brandTitle": "AnswerLens Admin",
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
    "admin.launch": "Launch run",
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
    "bucket.comparativeReadiness": "Comparative Readiness",
    "metric.overallScore": "overallScore",
    "metric.vavr": "vavr",
    "metric.crawledPages": "crawledPages",
    "metric.discoveredUrls": "discoveredUrls",
    "metric.keyPageCount": "keyPageCount",
    "metric.missingPageTypes": "missingPageTypes",
    "metric.promptCount": "promptCount",
    "metric.holdoutPromptCount": "holdoutPromptCount",
    "metric.sampleCount": "sampleCount",
    "metric.mentionRate": "mentionRate",
    "metric.accurateMentionRate": "accurateMentionRate",
    "metric.ownedCitationRate": "ownedCitationRate",
    "metric.trustedCitationRate": "trustedCitationRate",
    "metric.recommendationRate": "recommendationRate",
    "metric.misrepresentationRate": "misrepresentationRate",
    "metric.competitorExclusionGap": "competitorExclusionGap",
    "metric.factCoverageScore": "factCoverageScore",
    "metric.validationLabel": "validationLabel",
    "metric.importedPageCount": "importedPageCount",
    "metric.matchedAuditPageCount": "matchedAuditPageCount",
    "metric.keyPagesWithEvidence": "keyPagesWithEvidence",
    "metric.keyPagesWithoutEvidence": "keyPagesWithoutEvidence",
    "metric.totalClicks": "totalClicks",
    "metric.totalImpressions": "totalImpressions",
    "metric.competitivePositionScore": "competitivePositionScore",
    "metric.rankCoverageRate": "rankCoverageRate",
    "metric.repeatedPromptCount": "repeatedPromptCount",
    "metric.stablePromptRate": "stablePromptRate",
    "metric.unstablePromptCount": "unstablePromptCount",
    "metric.indexNowCandidateCount": "indexNowCandidateCount"
  },
  "zh-CN": {
    "lang.label": "语言",
    "lang.english": "English",
    "lang.chinese": "简体中文",
    "nav.home": "首页",
    "nav.docs": "文档",
    "nav.releases": "发布",
    "nav.examples": "示例",
    "nav.playbooks": "操作手册",
    "nav.github": "GitHub",
    "common.pending": "待生成",
    "common.none": "无",
    "common.loading": "加载中...",
    "common.unavailable": "不可用",
    "common.openRaw": "打开原始文件",
    "common.download": "下载",
    "common.openPreview": "打开预览",
    "common.loadingArtifact": "正在加载产物...",
    "common.unableToLoadArtifact": "无法加载 {name}。",
    "common.localizedPage": "此页面也提供 {language} 版本。",
    "footer.distribution": "由 YSCJRH 基于仓库内文档、发布记录与产物构建。无消费级 AI 界面抓取，不承诺答案面排名。",
    "brand.description": "AnswerLens 是一个面向产品网站的 CLI-first AI 可发现性审计器。",
    "brand.description.repo": "AnswerLens 是一个面向产品网站、GitHub-native 的 CLI-first AI 可发现性审计器。",
    "brand.tagline": "面向 AI 可发现性的 CI。",
    "brand.positioning": "审计产品网站是否足够易于被 AI 系统读取、引用、比较与推荐。",
    "brand.disclaimer": "AnswerLens 不抓取消费级 AI 界面，不自动代发内容，也不保证答案面排名。",
    "site.demo": "演示站点",
    "site.note.fixture": "https://fixture.local 是公开演示 fixture 中使用的稳定主机名，不是 AnswerLens 的官网地址。",
    "run.mode": "模式",
    "run.id": "运行 ID",
    "run.generated": "生成时间",
    "run.ruleVersion": "规则版本",
    "report.shareSummary.title": "AnswerLens 分享摘要",
    "report.evalSummary.title": "AnswerLens 评估摘要",
    "report.recommendations.title": "AnswerLens 修复建议",
    "report.scorecard.title": "AnswerLens 可见性评分卡",
    "report.metrics": "指标",
    "report.run": "运行信息",
    "report.issues": "AI 可能错过这个产品的原因",
    "report.fixes": "优先修复项",
    "report.artifacts": "可分享产物",
    "report.guardrails": "边界与约束",
    "report.relatedIssues": "关联问题",
    "report.generated": "生成时间",
    "report.overallScore": "总分",
    "report.vavr": "VAVR",
    "report.artifactOrder": "按以下顺序阅读产物",
    "report.metricLabel": "指标",
    "report.metricValue": "值",
    "report.pr.title": "AnswerLens 审计",
    "report.pr.issueHeading": "AI 可能错过这个产品的原因",
    "report.pr.fixHeading": "建议优先修复",
    "report.pr.artifacts": "产物与边界说明",
    "report.manualValidation": "人工验证：CPS 为 {score}，覆盖 {coverage}% 的有排名样本。",
    "report.stability": "稳定性：{stableRate}% 的重复提示词组保持稳定（{repeatedCount} 组中有 {unstableCount} 组不稳定）。",
    "report.searchValidation": "{label} 验证：{total} 个关键页面中有 {withEvidence} 个显示了 {label} 证据。",
    "report.indexNow": "IndexNow 辅助：已准备 {count} 个候选 URL，供后续提交规划使用。",
    "report.noRecommendations": "本次运行未生成修复建议。",
    "report.noIssues": "无",
    "admin.brandLabel": "内部控制台",
    "admin.brandTitle": "AnswerLens Admin",
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
    "admin.launch": "发起运行",
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
    "bucket.comparativeReadiness": "比较准备度",
    "metric.overallScore": "overallScore",
    "metric.vavr": "vavr",
    "metric.crawledPages": "crawledPages",
    "metric.discoveredUrls": "discoveredUrls",
    "metric.keyPageCount": "keyPageCount",
    "metric.missingPageTypes": "missingPageTypes",
    "metric.promptCount": "promptCount",
    "metric.holdoutPromptCount": "holdoutPromptCount",
    "metric.sampleCount": "sampleCount",
    "metric.mentionRate": "mentionRate",
    "metric.accurateMentionRate": "accurateMentionRate",
    "metric.ownedCitationRate": "ownedCitationRate",
    "metric.trustedCitationRate": "trustedCitationRate",
    "metric.recommendationRate": "recommendationRate",
    "metric.misrepresentationRate": "misrepresentationRate",
    "metric.competitorExclusionGap": "competitorExclusionGap",
    "metric.factCoverageScore": "factCoverageScore",
    "metric.validationLabel": "validationLabel",
    "metric.importedPageCount": "importedPageCount",
    "metric.matchedAuditPageCount": "matchedAuditPageCount",
    "metric.keyPagesWithEvidence": "keyPagesWithEvidence",
    "metric.keyPagesWithoutEvidence": "keyPagesWithoutEvidence",
    "metric.totalClicks": "totalClicks",
    "metric.totalImpressions": "totalImpressions",
    "metric.competitivePositionScore": "competitivePositionScore",
    "metric.rankCoverageRate": "rankCoverageRate",
    "metric.repeatedPromptCount": "repeatedPromptCount",
    "metric.stablePromptRate": "stablePromptRate",
    "metric.unstablePromptCount": "unstablePromptCount",
    "metric.indexNowCandidateCount": "indexNowCandidateCount"
  }
};

const issueTitleTranslations: Partial<Record<string, string>> = {
  "Page fetch failed": "页面抓取失败",
  "Key proof page is weakly linked": "关键证明页链接较弱",
  "Anchor text is generic for proof page": "指向证明页的锚文本过于泛化",
  "Proof page lacks contextual support": "证明页缺少上下文支持",
  "Key page is noindex": "关键页面被设置为 noindex",
  "Missing page title": "缺少页面标题",
  "Short page title": "页面标题过短",
  "Missing meta description": "缺少 meta description",
  "Missing H1": "缺少 H1",
  "Multiple H1 headings": "存在多个 H1 标题",
  "Thin key page": "关键页面内容过薄",
  "Weak heading structure": "标题结构较弱",
  "JavaScript-heavy thin page": "JavaScript 过重且页面内容过薄",
  "Low ARIA coverage on controls": "控件的 ARIA 覆盖率较低",
  "Structured data name is not visible": "结构化数据中的名称未在可见内容中体现",
  "Structured data description is not visible": "结构化数据中的描述未在可见内容中体现",
  "FAQ schema does not match visible questions": "FAQ schema 与可见问题不匹配",
  "FAQ schema answers are not visible": "FAQ schema 的答案未在页面中可见",
  "Homepage lacks JSON-LD": "首页缺少 JSON-LD",
  "FAQ page lacks FAQ schema": "FAQ 页面缺少 FAQ schema",
  "FAQ schema is not reinforced by visible Q&A structure": "FAQ schema 没有得到可见问答结构的支撑",
  "Structured data is not reinforced by visible category text": "结构化数据未被可见分类文本强化",
  "Pricing page evidence density is low": "定价页证据密度偏低",
  "Security page evidence density is low": "安全页证据密度偏低",
  "Docs page evidence density is low": "文档页证据密度偏低",
  "Compare page evidence density is low": "对比页证据密度偏低",
  "Use-case page evidence density is low": "用例页证据密度偏低",
  "FAQ page lacks scannable question structure": "FAQ 页面缺少可扫描的问题结构",
  "Compare page does not name declared competitors": "对比页未点名已声明的竞争对手",
  "Compare page lacks decision-making structure": "对比页缺少决策辅助结构",
  "Use-case page lacks contextual structure": "用例页缺少上下文结构",
  "Missing robots.txt": "缺少 robots.txt",
  "Missing sitemap discovery": "缺少 sitemap 发现入口",
  "Robots blocks all crawlers": "robots 阻止了所有爬虫",
  "Homepage was not crawled": "首页未被抓取",
  "Homepage category signal is weak": "首页类别信号较弱",
  "Homepage persona fit is implicit": "首页目标人群表达过于隐含",
  "Homepage use cases are underspecified": "首页用例表达不够具体",
  "Homepage under-links key proof pages": "首页对关键证明页的链接不足",
  "Use-case coverage is thin": "用例覆盖偏薄",
  "Compare pages do not mention declared competitors": "对比页未提及已声明的竞争对手"
};

const fixHintTranslations: Partial<Record<string, string>> = {
  "Make the page reachable without a browser-only session.": "让页面在无需仅浏览器会话的情况下可访问。",
  "Add links from the homepage, docs, product, or adjacent proof pages using descriptive anchors.": "从首页、文档、产品页或相邻证明页添加描述性锚文本链接。",
  "Use anchors that name the page purpose directly, such as Pricing, Security, FAQ, Compare, or integration-specific language.": "使用能直接说明页面用途的锚文本，例如 Pricing、Security、FAQ、Compare 或集成名称。",
  "Add nearby copy that frames why buyers or evaluators should visit this proof page.": "在附近补充说明文案，解释为什么买家或评估者应该访问这个证明页。",
  "Remove noindex from pages that should earn discovery and citations.": "从应该获得发现与引用的页面上移除 noindex。",
  "Add a descriptive page title.": "补充一个有明确描述性的页面标题。",
  "Expand the title with page purpose and product context.": "在标题中补充页面用途和产品上下文。",
  "Add a clear summary of who the page serves and what it proves.": "增加清晰摘要，说明该页面服务谁、证明什么。",
  "Add one descriptive H1 per key page.": "每个关键页面补充一个有明确含义的 H1。",
  "Use a single H1 and demote the rest to lower-level headings.": "只保留一个 H1，其余标题降级为更低层级。",
  "Add plain-language explanations, evidence blocks, and stronger sections.": "补充通俗解释、证据模块和更强的章节结构。",
  "Break the page into sections with scannable headings.": "把页面拆成带有可扫描标题的小节。",
  "Render critical content server-side or include HTML fallback text.": "将关键信息改为服务端渲染，或提供 HTML 回退文本。",
  "Add accessible labels to critical controls and buttons.": "为关键控件和按钮补充无障碍标签。",
  "Mirror the structured entity name in visible headings or supporting copy.": "在可见标题或支持性文案中同步结构化实体名称。",
  "Keep structured descriptions aligned with visible product copy.": "让结构化描述与可见产品文案保持一致。",
  "Use visible FAQ headings or question rows that match the JSON-LD questions.": "使用与 JSON-LD 问题一致的可见 FAQ 标题或问题行。",
  "Expose the same answer text in visible FAQ content, not only structured data.": "在可见 FAQ 内容中展示相同答案，而不仅存在于结构化数据中。",
  "Add Organization or Product JSON-LD that matches visible text.": "添加与可见文本一致的 Organization 或 Product JSON-LD。",
  "Add FAQPage JSON-LD that mirrors visible questions and answers.": "添加与可见问答一致的 FAQPage JSON-LD。",
  "Expose visible questions, headings, and answer sections that match the structured data.": "把与结构化数据一致的问题、标题和答案块显式展示出来。",
  "Repeat the product category and positioning in visible headings and supporting copy.": "在可见标题和支持文案中重复产品类别与定位。",
  "Add concrete plans, ranges, packaging qualifiers, and scannable proof blocks.": "补充具体套餐、价格区间、包装限定条件以及可扫描的证明模块。",
  "Add compliance markers, controls, deployment details, and buyer-facing trust answers.": "补充合规标记、控制项、部署细节和面向买家的信任说明。",
  "Add updated dates, versions, setup steps, API references, and example-driven documentation.": "补充更新时间、版本、安装步骤、API 引用和示例驱动文档。",
  "Add comparison tables, decision criteria, fit guidance, and proof-oriented bullet lists.": "补充对比表、决策标准、适配建议和以证明为导向的要点列表。",
  "Add audience-specific workflows, before/after outcomes, and measurable success criteria.": "补充面向特定受众的工作流、前后对比结果和可衡量的成功标准。",
  "Use explicit question headings and concise answer blocks for recurring buyer concerns.": "针对重复出现的买家问题，使用明确的问题标题和简洁的答案块。",
  "Name the highest-priority competitors and explain fit differences directly on the page.": "直接在页面中点名优先级最高的竞争对手，并解释适配差异。",
  "Add sections for buyer fit, trade-offs, migration paths, and decision criteria.": "补充买家适配、权衡、迁移路径和决策标准等章节。",
  "Add sections for the problem, the recommended workflow, and expected outcomes.": "补充问题、推荐工作流和预期结果等章节。",
  "Add robots.txt and advertise your sitemap.": "补充 robots.txt 并明确暴露 sitemap。",
  "Publish a sitemap.xml or expose crawlable HTML entrypoints.": "发布 sitemap.xml，或暴露可被抓取的 HTML 入口。",
  "Allow public product and docs content to be crawled.": "允许公开产品页和文档页被抓取。",
  "Ensure the homepage is public and discoverable.": "确保首页是公开可访问且可被发现的。",
  "Name the category directly in the hero or early supporting copy.": "在 hero 区或前段支持文案中直接点明类别。",
  "Call out the primary team or buyer in visible homepage text.": "在首页可见文案中明确主要团队或买家对象。",
  "Add use-case language near the hero and supporting sections.": "在 hero 区附近和支持章节中补充用例表达。",
  "Link from the homepage to pricing, docs, security, FAQ, or compare pages.": "从首页明确链接到 pricing、docs、security、FAQ 或 compare 页面。",
  "Add more use-case or solution pages for distinct buyer contexts.": "针对不同买家场景增加更多用例或解决方案页面。",
  "Add explicit alternatives or versus pages for the highest-priority competitors.": "为优先级最高的竞争对手增加明确的 alternatives 或 versus 页面。"
};

const recommendationTitleTranslations: Partial<Record<string, string>> = {
  "Remove crawl and indexing blockers": "移除抓取与索引阻塞项",
  "Tighten structure and schema alignment on key pages": "强化关键页面的结构与 schema 对齐",
  "Clarify homepage positioning": "澄清首页定位",
  "Add citable pricing, trust, and documentation proof": "补充可引用的定价、信任与文档证明",
  "Close FAQ, compare, integrations, and use-case gaps": "补齐 FAQ、对比、集成与用例缺口"
};

const rationaleTranslations: Partial<Record<string, string>> = {
  "Answer-layer visibility starts with accessible HTML, permissive crawl controls, and discoverable pages.": "答案层可见性的起点，是可访问的 HTML、宽松的抓取控制以及可被发现的页面。",
  "Thin, weakly segmented pages and mismatched schema make assistants less likely to interpret pages consistently.": "内容过薄、分段结构弱或 schema 不匹配，会降低助手稳定理解页面的概率。",
  "The homepage should state category, audience, and use cases plainly enough for assistants to quote them back.": "首页应足够清楚地写出类别、受众和用例，让助手能够准确复述。",
  "Pricing, security, documentation, and outcome details create the evidence that grounded answers can cite.": "定价、安全、文档和结果细节，会构成可被有根据回答引用的证据基础。",
  "Answer engines need comparison-ready source material plus contextual internal linking, not just a homepage.": "答案引擎需要具备可比较性的源材料和带上下文的内部链接，而不只是一个首页。"
};

const expectedOutcomeTranslations: Partial<Record<string, string>> = {
  "Better crawlability and cleaner downstream discovery.": "提升可抓取性，并让下游发现路径更干净。",
  "Higher extraction quality and fewer ambiguous summaries.": "提高抽取质量，减少含糊总结。",
  "Stronger entity clarity ahead of eval-mode mention scoring.": "在 eval 提及评分前，先强化实体清晰度。",
  "More reliable evidence signals and stronger future citation coverage.": "形成更可靠的证据信号，并提升后续引用覆盖能力。",
  "Better readiness for shortlist, alternatives, and evaluation prompts.": "更好地应对 shortlist、alternatives 和评估类提示词。"
};

const pageTypeTranslations: Partial<Record<string, string>> = {
  pricing: "定价页",
  security: "安全页",
  docs: "文档页",
  faq: "FAQ 页面",
  compare: "对比页",
  integrations: "集成页",
  "use-case": "用例页"
};

function interpolate(template: string, values?: Record<string, TemplateValue>): string {
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
  if (normalized === "zh" || normalized === "zh-cn" || normalized.startsWith("zh-")) {
    return "zh-CN";
  }

  return "en";
}

export function localeToSlug(locale: Locale): LocaleSlug {
  return locale === "zh-CN" ? "zh" : "en";
}

export function slugToLocale(slug?: string | null): Locale {
  return slug === "zh" ? "zh-CN" : "en";
}

export function detectLocaleFromAcceptLanguage(header?: string | null): Locale {
  if (!header) {
    return DEFAULT_LOCALE;
  }

  const first = header.split(",")[0]?.trim().split(";")[0] ?? "";
  return normalizeLocale(first);
}

export function resolveLocalePreference(options: {
  query?: string | null;
  cookie?: string | null;
  acceptLanguage?: string | null;
  fallback?: Locale;
}): Locale {
  if (options.query) {
    return normalizeLocale(options.query);
  }

  if (options.cookie) {
    return normalizeLocale(options.cookie);
  }

  if (options.acceptLanguage) {
    return detectLocaleFromAcceptLanguage(options.acceptLanguage);
  }

  return options.fallback ?? DEFAULT_LOCALE;
}

export function formatDate(
  value: string | Date | undefined | null,
  locale: Locale,
  options: Intl.DateTimeFormatOptions,
  fallback = ""
): string {
  if (!value) {
    return fallback;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return new Intl.DateTimeFormat(locale === "zh-CN" ? "zh-CN" : "en-US", options).format(date);
}

export function t(locale: Locale, key: string, values?: Record<string, TemplateValue>): string {
  const template = messages[locale][key] ?? messages.en[key] ?? key;
  return interpolate(template, values);
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

export function translateMetricKey(metric: string, locale: Locale): string {
  return t(locale, `metric.${metric}`);
}

function translatePageTypePhrase(value: string): string {
  const normalized = value.toLowerCase().replace(/\s+page$/, "");
  return pageTypeTranslations[normalized] ?? value;
}

function translateDynamicTitle(title: string): string {
  const blockedMatch = /^(.+) is blocked$/.exec(title);
  if (blockedMatch) {
    return `${blockedMatch[1]} 被阻止`;
  }

  const missingMatch = /^Missing (.+)$/.exec(title);
  if (missingMatch) {
    return `缺少${translatePageTypePhrase(missingMatch[1])}`;
  }

  const evidenceMatch = /^Key page has no (.+) evidence$/.exec(title);
  if (evidenceMatch) {
    return `关键页面缺少${evidenceMatch[1]}证据`;
  }

  const crawlCoverageMatch = /^(.+) page is not covered by crawl$/.exec(title);
  if (crawlCoverageMatch) {
    return `${translatePageTypePhrase(crawlCoverageMatch[1])}未被抓取覆盖`;
  }

  const blockerMatch = /^(.+)-visible page still has audit blockers$/.exec(title);
  if (blockerMatch) {
    return `${translatePageTypePhrase(blockerMatch[1])}仍存在审计阻塞项`;
  }

  return title;
}

function translateDynamicFixHint(fixHint: string): string {
  const allowBotMatch = /^Allow (.+) if you want discoverability on that answer surface\.$/.exec(fixHint);
  if (allowBotMatch) {
    return `如果希望在该答案面获得可发现性，请允许 ${allowBotMatch[1]}。`;
  }

  const addPageMatch = /^Add a dedicated (.+) page with clear, citable content\.$/.exec(fixHint);
  if (addPageMatch) {
    return `新增一个专门的${translatePageTypePhrase(addPageMatch[1])}，并提供清晰、可引用的内容。`;
  }

  return fixHint;
}

export function translateIssueTitle(title: string, locale: Locale): string {
  if (locale === "en") {
    return title;
  }

  return issueTitleTranslations[title] ?? translateDynamicTitle(title);
}

export function translateFixHint(fixHint: string, locale: Locale): string {
  if (locale === "en") {
    return fixHint;
  }

  return fixHintTranslations[fixHint] ?? translateDynamicFixHint(fixHint);
}

export function translateRecommendationTitle(title: string, locale: Locale): string {
  if (locale === "en") {
    return title;
  }

  return recommendationTitleTranslations[title] ?? title;
}

export function translateRecommendationRationale(rationale: string, locale: Locale): string {
  if (locale === "en") {
    return rationale;
  }

  return rationaleTranslations[rationale] ?? rationale;
}

export function translateExpectedOutcome(expectedOutcome: string, locale: Locale): string {
  if (locale === "en") {
    return expectedOutcome;
  }

  return expectedOutcomeTranslations[expectedOutcome] ?? expectedOutcome;
}

export function setLocaleCookieHeader(locale: Locale): string {
  return `${LOCALE_COOKIE_KEY}=${encodeURIComponent(locale)}; Path=/; Max-Age=31536000; SameSite=Lax`;
}
