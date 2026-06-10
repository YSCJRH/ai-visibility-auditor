import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AuditResult, IndexNowHelperResult, SearchValidationResult } from "../../core/src/types.ts";
import type { ContentBrief, EvalResult } from "../../core/src/eval.ts";
import { summarizeEvalDiff } from "../../core/src/eval.ts";
import { ensureDir } from "../../core/src/utils.ts";
import {
  type Locale,
  t,
  translateBucket,
  translateExpectedOutcome,
  translateFixHint,
  translateIssueTitle,
  translateMetricKey,
  translateRecommendationRationale,
  translateRecommendationTitle,
  translateSeverity
} from "../../i18n/src/index.ts";

type RunKind = "audit" | "eval" | "manual-import" | "validation-import";

interface RunManifest {
  kind: RunKind;
  run: AuditResult["run"] | EvalResult["run"] | SearchValidationResult["run"];
  generatedAt: string;
  site: AuditResult["site"];
  summary: Record<string, number | string | null | string[]>;
  artifacts: string[];
  provider?: EvalResult["provider"];
}

interface EvalSummaryJson {
  run: EvalResult["run"];
  site: EvalResult["site"];
  provider: EvalResult["provider"];
  generatedAt: string;
  audit: EvalResult["audit"];
  summary: EvalResult["summary"];
  prompts: Array<{
    promptId: string;
    category: string;
    priority: string;
    prompt: string;
    expectedSignal: string;
    intent: string | null;
    holdout: boolean;
    provider: EvalResult["prompts"][number]["provider"];
    model: string;
    locale: string | null;
    sampleIndex: number;
    rankPosition: number | null;
    citedCount: number;
    recommendation: boolean;
    misrepresented: boolean;
    matchedFacts: string[];
      competitorMentions: string[];
      scores: EvalResult["prompts"][number]["scores"];
    }>;
  promptGroups: EvalResult["promptGroups"];
  briefs: Array<Pick<ContentBrief, "id" | "type" | "title" | "audience" | "angle" | "cta">>;
}

interface SearchValidationSummaryJson {
  run: SearchValidationResult["run"];
  site: SearchValidationResult["site"];
  source: SearchValidationResult["source"];
  summary: SearchValidationResult["summary"];
  findings: SearchValidationResult["findings"];
  topPages: SearchValidationResult["topPages"];
}

interface IndexNowSummaryJson {
  site: IndexNowHelperResult["site"];
  generatedAt: string;
  summary: IndexNowHelperResult["summary"];
  candidates: IndexNowHelperResult["candidates"];
}

interface ShareSummary {
  project: "AnswerLens";
  tagline: "CI for AI discoverability.";
  positioning: string;
  disclaimer: string;
  run: {
    id: string;
    mode: RunKind;
    generatedAt: string;
    artifactVersion: string;
    ruleVersion: string;
    sampleCount: number;
    locale: string | null;
  };
  site: AuditResult["site"];
  metrics: Record<string, number | string | null>;
  topIssues: Array<{
    severity: string;
    title: string;
    scope: string;
    fixHint: string;
  }>;
  topRecommendations: Array<{
    title: string;
    rationale: string;
    expectedOutcome: string;
  }>;
  artifacts: string[];
}

const SHARE_DISCLAIMER =
  "AnswerLens does not scrape consumer AI UIs, auto-post content, or guarantee answer-surface rankings.";

function localizeText(value: string, locale: Locale, kind: "issueTitle" | "fixHint" | "recommendationTitle" | "rationale" | "expectedOutcome"): string {
  if (kind === "issueTitle") {
    return translateIssueTitle(value, locale);
  }
  if (kind === "fixHint") {
    return translateFixHint(value, locale);
  }
  if (kind === "recommendationTitle") {
    return translateRecommendationTitle(value, locale);
  }
  if (kind === "rationale") {
    return translateRecommendationRationale(value, locale);
  }
  return translateExpectedOutcome(value, locale);
}

function renderVavr(value: number | null, locale: Locale): string {
  if (value === null) {
    return locale === "zh-CN" ? "待评估" : "pending eval";
  }

  return `${value}`;
}

function writeJson(filePath: string, value: unknown): Promise<void> {
  return writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function escapeTableCell(value: string | number | boolean | null | undefined): string {
  return String(value ?? "")
    .replace(/\r?\n/g, " ")
    .replace(/\|/g, "\\|");
}

function compactText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function siteLabel(site: Pick<AuditResult["site"], "input" | "display">): string {
  const display = site.display?.trim();
  return display && display.length > 0 ? display : site.input;
}

function fixtureHostNote(site: Pick<AuditResult["site"], "baseUrl">): string | null {
  if (site.baseUrl !== "https://fixture.local") {
    return null;
  }

  return "https://fixture.local is the stable fixture hostname inside this public demo, not the AnswerLens site URL.";
}

function renderSiteOverviewLines(site: AuditResult["site"], locale: Locale = "en"): string {
  const lines = [`- ${t(locale, "site.demo")}: ${siteLabel(site)}`];

  const note = fixtureHostNote(site);
  if (note) {
    lines.push(`- ${t(locale, "site.note.fixture")}`);
  }

  return lines.join("\n");
}

function renderSiteHtmlNotes(site: AuditResult["site"], locale: Locale = "en"): string {
  const notes: string[] = [];

  const note = fixtureHostNote(site);
  if (note) {
    notes.push(`<p>${escapeHtml(t(locale, "site.note.fixture"))}</p>`);
  }

  return notes.join("");
}

function topIssues(result: AuditResult): ShareSummary["topIssues"] {
  const seen = new Set<string>();
  const diverseIssues = result.issues.filter((issue) => {
    const key = `${issue.title}:${issue.fixHint}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });

  return diverseIssues.slice(0, 3).map((issue) => ({
    severity: issue.severity,
    title: issue.title,
    scope: issue.pageUrl ?? "site",
    fixHint: issue.fixHint
  }));
}

function topRecommendations(result: AuditResult): ShareSummary["topRecommendations"] {
  return result.recommendations.slice(0, 3).map((recommendation) => ({
    title: recommendation.title,
    rationale: recommendation.rationale,
    expectedOutcome: recommendation.expectedOutcome
  }));
}

function auditArtifacts(): string[] {
  return [
    "share-summary.md",
    "scorecard.md",
    "recommendations.md",
    "share-summary.zh.md",
    "scorecard.zh.md",
    "recommendations.zh.md",
    "share-summary.json",
    "pr-snippet.md",
    "pr-snippet.zh.md",
    "issues.json",
    "site-audit.json",
    "index.html",
    "index.zh.html",
    "normalized-pages.json",
    "competitor-diff.md",
    "run.json"
  ];
}

function evalArtifacts(): string[] {
  return [
    ...auditArtifacts(),
    "eval-summary.md",
    "eval-summary.zh.md",
    "eval-summary.json",
    "eval-results.json",
    "before-after-diff.md",
    "before-after-diff.zh.md",
    "citation-gap-matrix.md",
    "citation-gap-matrix.zh.md",
    "citation-gap-matrix.json"
  ];
}

function validationArtifacts(): string[] {
  return [
    ...auditArtifacts(),
    "search-console-summary.md",
    "search-console-summary.zh.md",
    "search-console-summary.json",
    "search-console-pages.json"
  ];
}

function bingHelperArtifacts(): string[] {
  return [
    ...auditArtifacts(),
    "bing-summary.md",
    "bing-summary.zh.md",
    "bing-summary.json",
    "bing-pages.json",
    "indexnow-summary.md",
    "indexnow-summary.zh.md",
    "indexnow-summary.json",
    "indexnow-candidates.json"
  ];
}

function buildAuditShareSummary(result: AuditResult): ShareSummary {
  return {
    project: "AnswerLens",
    tagline: "CI for AI discoverability.",
    positioning: "Audit whether a product site can be read, cited, compared, and recommended by AI systems.",
    disclaimer: SHARE_DISCLAIMER,
    run: {
      id: result.run.id,
      mode: result.run.mode === "eval" || result.run.mode === "manual-import" ? result.run.mode : "audit",
      generatedAt: result.site.generatedAt,
      artifactVersion: result.run.artifactVersion,
      ruleVersion: result.run.ruleVersion,
      sampleCount: result.run.sampleCount,
      locale: result.run.locale
    },
    site: result.site,
    metrics: {
      overallScore: result.summary.overallScore,
      vavr: result.summary.vavr,
      crawledPages: result.summary.crawledPages,
      discoveredUrls: result.summary.discoveredUrls,
      keyPageCount: result.summary.keyPageCount,
      missingPageTypes: result.summary.missingPageTypes.join(", ") || "none"
    },
    topIssues: topIssues(result),
    topRecommendations: topRecommendations(result),
    artifacts: auditArtifacts()
  };
}

function buildEvalShareSummary(result: EvalResult, previous: ShareSummary | null): ShareSummary {
  const metrics: ShareSummary["metrics"] = {
    overallScore: result.audit.overallScore,
    vavr: result.summary.vavr,
    promptCount: result.summary.promptCount,
    holdoutPromptCount: result.summary.holdoutPromptCount,
    sampleCount: result.summary.sampleCount,
    mentionRate: result.summary.mentionRate,
    accurateMentionRate: result.summary.accurateMentionRate,
    ownedCitationRate: result.summary.ownedCitationRate,
    trustedCitationRate: result.summary.trustedCitationRate,
    recommendationRate: result.summary.recommendationRate,
    misrepresentationRate: result.summary.misrepresentationRate,
    competitorExclusionGap: result.summary.competitorExclusionGap,
    factCoverageScore: result.summary.factCoverageScore
  };

  if (result.run.mode === "manual-import" && result.summary.competitivePositionScore !== null) {
    metrics.competitivePositionScore = result.summary.competitivePositionScore;
    metrics.rankCoverageRate = result.summary.rankCoverageRate;
  }

  if (result.summary.repeatedPromptCount > 0) {
    metrics.repeatedPromptCount = result.summary.repeatedPromptCount;
    metrics.stablePromptRate = result.summary.stablePromptRate;
    metrics.unstablePromptCount = result.summary.unstablePromptCount;
  }

  return {
    project: "AnswerLens",
    tagline: "CI for AI discoverability.",
    positioning: "Audit whether a product site can be read, cited, compared, and recommended by AI systems.",
    disclaimer: SHARE_DISCLAIMER,
    run: {
      id: result.run.id,
      mode: result.run.mode === "manual-import" ? "manual-import" : "eval",
      generatedAt: result.generatedAt,
      artifactVersion: result.run.artifactVersion,
      ruleVersion: result.run.ruleVersion,
      sampleCount: result.run.sampleCount,
      locale: result.run.locale
    },
    site: result.site,
    metrics,
    topIssues: previous?.topIssues ?? [],
    topRecommendations: previous?.topRecommendations ?? [],
    artifacts: evalArtifacts()
  };
}

function buildValidationShareSummary(
  audit: AuditResult,
  result: SearchValidationResult,
  options?: { validationLabel?: string; indexNowCandidateCount?: number }
): ShareSummary {
  return {
    project: "AnswerLens",
    tagline: "CI for AI discoverability.",
    positioning: "Audit whether a product site can be read, cited, compared, and recommended by AI systems.",
    disclaimer: SHARE_DISCLAIMER,
    run: {
      id: result.run.id,
      mode: "validation-import",
      generatedAt: result.run.completedAt,
      artifactVersion: result.run.artifactVersion,
      ruleVersion: result.run.ruleVersion,
      sampleCount: result.run.sampleCount,
      locale: result.run.locale
    },
    site: result.site,
    metrics: {
      overallScore: audit.summary.overallScore,
      vavr: audit.summary.vavr,
      validationLabel: options?.validationLabel ?? "Search Console",
      importedPageCount: result.summary.importedPageCount,
      matchedAuditPageCount: result.summary.matchedAuditPageCount,
      keyPagesWithEvidence: result.summary.keyPagesWithEvidence,
      keyPagesWithoutEvidence: result.summary.keyPagesWithoutEvidence,
      totalClicks: result.summary.totalClicks,
      totalImpressions: result.summary.totalImpressions,
      indexNowCandidateCount: options?.indexNowCandidateCount ?? null
    },
    topIssues: topIssues(audit),
    topRecommendations: topRecommendations(audit),
    artifacts: options?.indexNowCandidateCount !== undefined ? bingHelperArtifacts() : validationArtifacts()
  };
}

function renderMetricValue(value: number | string | null, locale: Locale): string {
  if (value === null) {
    return t(locale, "common.pending");
  }

  return String(value);
}

function renderRunKind(value: string, locale: Locale): string {
  if (value === "audit" || value === "eval" || value === "manual-import" || value === "validation-import") {
    return t(locale, `kind.${value}`);
  }

  return value;
}

function manualRankValidationLine(metrics: ShareSummary["metrics"], locale: Locale): string | null {
  const competitivePositionScore = metrics.competitivePositionScore;
  const rankCoverageRate = metrics.rankCoverageRate;
  if (typeof competitivePositionScore !== "number" || typeof rankCoverageRate !== "number") {
    return null;
  }

  return t(locale, "report.manualValidation", { score: competitivePositionScore, coverage: rankCoverageRate });
}

function stabilitySummaryLine(metrics: ShareSummary["metrics"], locale: Locale): string | null {
  const repeatedPromptCount = metrics.repeatedPromptCount;
  const stablePromptRate = metrics.stablePromptRate;
  const unstablePromptCount = metrics.unstablePromptCount;
  if (
    typeof repeatedPromptCount !== "number" ||
    repeatedPromptCount < 1 ||
    typeof stablePromptRate !== "number" ||
    typeof unstablePromptCount !== "number"
  ) {
    return null;
  }

  return t(locale, "report.stability", {
    stableRate: stablePromptRate,
    unstableCount: unstablePromptCount,
    repeatedCount: repeatedPromptCount
  });
}

function searchValidationLine(metrics: ShareSummary["metrics"], locale: Locale): string | null {
  const keyPagesWithEvidence = metrics.keyPagesWithEvidence;
  const keyPagesWithoutEvidence = metrics.keyPagesWithoutEvidence;
  const validationLabel = typeof metrics.validationLabel === "string" ? metrics.validationLabel : "Search Console";
  if (typeof keyPagesWithEvidence !== "number" || typeof keyPagesWithoutEvidence !== "number") {
    return null;
  }

  const total = keyPagesWithEvidence + keyPagesWithoutEvidence;
  if (total <= 0) {
    return null;
  }

  return t(locale, "report.searchValidation", {
    label: validationLabel,
    withEvidence: keyPagesWithEvidence,
    total
  });
}

function indexNowHelperLine(metrics: ShareSummary["metrics"], locale: Locale): string | null {
  const indexNowCandidateCount = metrics.indexNowCandidateCount;
  if (typeof indexNowCandidateCount !== "number" || indexNowCandidateCount < 1) {
    return null;
  }

  return t(locale, "report.indexNow", { count: indexNowCandidateCount });
}

function renderShareSummaryMarkdown(summary: ShareSummary, locale: Locale = "en"): string {
  const metricRows = Object.entries(summary.metrics)
    .filter(
      ([key]) =>
        ![
          "competitivePositionScore",
          "rankCoverageRate",
          "repeatedPromptCount",
          "stablePromptRate",
          "unstablePromptCount",
          "importedPageCount",
          "matchedAuditPageCount",
          "keyPagesWithEvidence",
          "keyPagesWithoutEvidence",
          "totalClicks",
          "totalImpressions",
          "validationLabel",
          "indexNowCandidateCount"
        ].includes(key)
    )
    .map(([key, value]) => `| ${escapeTableCell(translateMetricKey(key, locale))} | ${escapeTableCell(renderMetricValue(value, locale))} |`)
    .join("\n");
  const manualValidation = manualRankValidationLine(summary.metrics, locale);
  const stabilitySummary = stabilitySummaryLine(summary.metrics, locale);
  const searchValidation = searchValidationLine(summary.metrics, locale);
  const indexNowHelper = indexNowHelperLine(summary.metrics, locale);

  const issues =
    summary.topIssues.length > 0
      ? summary.topIssues
          .map(
            (issue) =>
              `- **${localizeText(issue.title, locale, "issueTitle")}** (${translateSeverity(issue.severity, locale)}, ${issue.scope}): ${localizeText(issue.fixHint, locale, "fixHint")}`
          )
          .join("\n")
      : `- ${t(locale, "report.noIssues")}`;

  const recommendations =
    summary.topRecommendations.length > 0
      ? summary.topRecommendations
          .map(
            (recommendation) =>
              `- **${localizeText(recommendation.title, locale, "recommendationTitle")}**: ${localizeText(recommendation.expectedOutcome, locale, "expectedOutcome")}`
          )
          .join("\n")
      : `- ${t(locale, "report.noIssues")}`;

  const artifacts = summary.artifacts.map((artifact) => `- [${artifact}](${artifact})`).join("\n");
  const nextSteps = [
    `1. ${t(locale, "report.next.scorecard")}`,
    `2. ${t(locale, "report.next.recommendations")}`,
    `3. ${t(locale, "report.next.prSnippet")}`,
    `4. ${t(locale, "report.next.starter")}`
  ].join("\n");

  return `# ${t(locale, "report.shareSummary.title")}

> ${t(locale, "brand.tagline")}

${t(locale, "brand.positioning")}

## ${t(locale, "report.run")}

${renderSiteOverviewLines(summary.site, locale)}
- ${t(locale, "run.mode")}: ${renderRunKind(summary.run.mode, locale)}
- ${t(locale, "run.id")}: ${summary.run.id}
- ${t(locale, "run.generated")}: ${summary.run.generatedAt}
- ${t(locale, "run.ruleVersion")}: ${summary.run.ruleVersion}

## ${t(locale, "report.metrics")}

| ${t(locale, "report.metricLabel")} | ${t(locale, "report.metricValue")} |
| --- | --- |
${metricRows}

${manualValidation ? `${manualValidation}\n` : ""}${stabilitySummary ? `${stabilitySummary}\n` : ""}${searchValidation ? `${searchValidation}\n` : ""}${indexNowHelper ? `${indexNowHelper}\n` : ""}

## ${t(locale, "report.issues")}

${issues}

## ${t(locale, "report.fixes")}

${recommendations}

## ${t(locale, "report.next.title")}

${nextSteps}

## ${t(locale, "report.artifacts")}

${artifacts}

## ${t(locale, "report.guardrails")}

${t(locale, "brand.disclaimer")}
`;
}

function renderPrSnippetMarkdown(summary: ShareSummary, locale: Locale = "en"): string {
  const topIssues =
    summary.topIssues.length > 0
      ? summary.topIssues
          .map((issue) => `- ${localizeText(issue.title, locale, "issueTitle")}: ${localizeText(issue.fixHint, locale, "fixHint")}`)
          .join("\n")
      : `- ${t(locale, "report.noIssues")}`;

  const topFixes =
    summary.topRecommendations.length > 0
      ? summary.topRecommendations.map((recommendation) => `- ${localizeText(recommendation.title, locale, "recommendationTitle")}`).join("\n")
      : `- ${t(locale, "report.noIssues")}`;

  const score = renderMetricValue(summary.metrics.overallScore, locale);
  const vavr = renderMetricValue(summary.metrics.vavr ?? null, locale);
  const manualValidation = manualRankValidationLine(summary.metrics, locale);

  return `## ${t(locale, "report.pr.title")}

**${t(locale, "brand.tagline")}** Readiness: **${score}/100**. VAVR: **${vavr}**.

${manualValidation ? `${manualValidation}\n` : ""}

### ${t(locale, "report.pr.issueHeading")}

${topIssues}

### ${t(locale, "report.pr.fixHeading")}

${topFixes}

<details>
<summary>${t(locale, "report.pr.artifacts")}</summary>

- Share summary: \`share-summary.md\`
- Scorecard: \`scorecard.md\`
- Recommendations: \`recommendations.md\`
- Machine-readable summary: \`share-summary.json\`
- Copyable starter: https://github.com/YSCJRH/ai-visibility-auditor/blob/main/docs/starter-bundle.md

${t(locale, "brand.disclaimer")}

</details>
`;
}

async function readShareSummary(outDir: string): Promise<ShareSummary | null> {
  try {
    const raw = await readFile(path.join(outDir, "share-summary.json"), "utf8");
    return JSON.parse(raw) as ShareSummary;
  } catch {
    return null;
  }
}

async function writeShareOutputs(outDir: string, summary: ShareSummary): Promise<void> {
  await writeJson(path.join(outDir, "share-summary.json"), summary);
  await writeFile(path.join(outDir, "share-summary.md"), renderShareSummaryMarkdown(summary, "en"), "utf8");
  await writeFile(path.join(outDir, "share-summary.zh.md"), renderShareSummaryMarkdown(summary, "zh-CN"), "utf8");
  await writeFile(path.join(outDir, "pr-snippet.md"), renderPrSnippetMarkdown(summary, "en"), "utf8");
  await writeFile(path.join(outDir, "pr-snippet.zh.md"), renderPrSnippetMarkdown(summary, "zh-CN"), "utf8");
}

function renderRecommendationsMarkdown(result: AuditResult, locale: Locale = "en"): string {
  const blocks =
    result.recommendations.length > 0
      ? result.recommendations
          .map((recommendation) => {
            const relatedIssues =
              recommendation.relatedIssues.length > 0
                ? recommendation.relatedIssues.map((issue) => `- ${issue}`).join("\n")
                : `- ${t(locale, "report.noIssues")}`;

            return `## ${localizeText(recommendation.title, locale, "recommendationTitle")}\n\n- ${locale === "zh-CN" ? "原因" : "Rationale"}: ${localizeText(recommendation.rationale, locale, "rationale")}\n- ${locale === "zh-CN" ? "预期结果" : "Expected outcome"}: ${localizeText(recommendation.expectedOutcome, locale, "expectedOutcome")}\n\n### ${t(locale, "report.relatedIssues")}\n\n${relatedIssues}`;
          })
          .join("\n\n")
      : t(locale, "report.noRecommendations");

  return `# ${t(locale, "report.recommendations.title")}\n\n${renderSiteOverviewLines(result.site, locale)}\n- ${t(locale, "report.generated")}: ${result.site.generatedAt}\n- ${t(locale, "report.overallScore")}: ${result.summary.overallScore}\n\n${blocks}\n`;
}

function buildAuditRunManifest(result: AuditResult): RunManifest {
  return {
    kind: "audit",
    run: result.run,
    generatedAt: result.site.generatedAt,
    site: result.site,
    summary: {
      overallScore: result.summary.overallScore,
      vavr: result.summary.vavr,
      missingPageTypes: result.summary.missingPageTypes,
      crawledPages: result.summary.crawledPages,
      discoveredUrls: result.summary.discoveredUrls,
      keyPageCount: result.summary.keyPageCount
    },
    artifacts: auditArtifacts()
  };
}

function buildEvalRunManifest(result: EvalResult): RunManifest {
  return {
    kind: result.run.mode === "manual-import" ? "manual-import" : "eval",
    run: result.run,
    generatedAt: result.generatedAt,
    site: result.site,
    summary: {
      overallScore: result.audit.overallScore,
      vavr: result.summary.vavr,
      missingPageTypes: result.audit.missingPageTypes,
      promptCount: result.summary.promptCount,
      holdoutPromptCount: result.summary.holdoutPromptCount,
      sampleCount: result.summary.sampleCount,
      locale: result.summary.locale,
      mentionRate: result.summary.mentionRate,
      accurateMentionRate: result.summary.accurateMentionRate,
      ownedCitationRate: result.summary.ownedCitationRate,
      trustedCitationRate: result.summary.trustedCitationRate,
      recommendationRate: result.summary.recommendationRate,
      misrepresentationRate: result.summary.misrepresentationRate,
      competitorExclusionGap: result.summary.competitorExclusionGap,
      factCoverageScore: result.summary.factCoverageScore,
      accuracyRate: result.summary.accuracyRate,
      competitivePositionScore: result.summary.competitivePositionScore,
      rankCoverageRate: result.summary.rankCoverageRate
    },
    artifacts: [...evalArtifacts(), "content-briefs/*.md", "briefs/*.md", "raw/<provider>/<promptId>.json"],
    provider: result.provider
  };
}

function buildValidationRunManifest(audit: AuditResult, result: SearchValidationResult): RunManifest {
  return {
    kind: "validation-import",
    run: result.run,
    generatedAt: result.run.completedAt,
    site: result.site,
    summary: {
      overallScore: audit.summary.overallScore,
      vavr: audit.summary.vavr,
      importedPageCount: result.summary.importedPageCount,
      matchedAuditPageCount: result.summary.matchedAuditPageCount,
      outOfScopePageCount: result.summary.outOfScopePageCount,
      keyPagesWithEvidence: result.summary.keyPagesWithEvidence,
      keyPagesWithoutEvidence: result.summary.keyPagesWithoutEvidence,
      pagesWithClicks: result.summary.pagesWithClicks,
      pagesWithImpressions: result.summary.pagesWithImpressions,
      totalClicks: result.summary.totalClicks,
      totalImpressions: result.summary.totalImpressions,
      validationSource: result.source.type
    },
    artifacts: validationArtifacts()
  };
}

function buildBingHelperRunManifest(
  audit: AuditResult,
  result: SearchValidationResult,
  indexNow: IndexNowHelperResult
): RunManifest {
  return {
    kind: "validation-import",
    run: result.run,
    generatedAt: result.run.completedAt,
    site: result.site,
    summary: {
      overallScore: audit.summary.overallScore,
      vavr: audit.summary.vavr,
      importedPageCount: result.summary.importedPageCount,
      matchedAuditPageCount: result.summary.matchedAuditPageCount,
      outOfScopePageCount: result.summary.outOfScopePageCount,
      keyPagesWithEvidence: result.summary.keyPagesWithEvidence,
      keyPagesWithoutEvidence: result.summary.keyPagesWithoutEvidence,
      pagesWithClicks: result.summary.pagesWithClicks,
      pagesWithImpressions: result.summary.pagesWithImpressions,
      totalClicks: result.summary.totalClicks,
      totalImpressions: result.summary.totalImpressions,
      validationSource: result.source.type,
      indexNowCandidateCount: indexNow.summary.candidateCount
    },
    artifacts: bingHelperArtifacts()
  };
}

function buildEvalSummaryJson(result: EvalResult): EvalSummaryJson {
  return {
    run: result.run,
    site: result.site,
    provider: result.provider,
    generatedAt: result.generatedAt,
    audit: result.audit,
    summary: result.summary,
    prompts: result.prompts.map((promptResult) => ({
      promptId: promptResult.promptId,
      category: promptResult.category,
      priority: promptResult.priority,
      prompt: promptResult.prompt,
      expectedSignal: promptResult.expectedSignal,
      intent: promptResult.intent,
      holdout: promptResult.holdout,
      provider: promptResult.provider,
      model: promptResult.model,
      locale: promptResult.locale,
      sampleIndex: promptResult.sampleIndex,
      rankPosition: promptResult.rankPosition,
      citedCount: promptResult.citations.length,
      recommendation: promptResult.recommended,
      misrepresented: promptResult.misrepresented,
      matchedFacts: promptResult.matchedFacts,
      competitorMentions: promptResult.competitorMentions,
      scores: promptResult.scores
    })),
    promptGroups: result.promptGroups,
    briefs: result.briefs.map((brief) => ({
      id: brief.id,
      type: brief.type,
      title: brief.title,
      audience: brief.audience,
      angle: brief.angle,
      cta: brief.cta
    }))
  };
}

function buildSearchValidationSummaryJson(result: SearchValidationResult): SearchValidationSummaryJson {
  return {
    run: result.run,
    site: result.site,
    source: result.source,
    summary: result.summary,
    findings: result.findings,
    topPages: result.topPages
  };
}

function buildIndexNowSummaryJson(result: IndexNowHelperResult): IndexNowSummaryJson {
  return {
    site: result.site,
    generatedAt: result.generatedAt,
    summary: result.summary,
    candidates: result.candidates
  };
}

function renderCompetitorDiffMarkdown(result: AuditResult): string {
  const competitorNames = result.configs.competitorNames;
  const comparePages = result.pages.filter((page) => page.pageType === "compare");
  const compareText = compactText(comparePages.map((page) => `${page.title} ${page.h1} ${page.textSnippet}`).join(" "));
  const rows = competitorNames
    .map((name) => {
      const normalizedName = compactText(name);
      const mentionedPages = comparePages.filter((page) => compactText(`${page.title} ${page.h1} ${page.textSnippet}`).includes(normalizedName));
      return `| ${escapeTableCell(name)} | ${mentionedPages.length > 0 ? "yes" : "no"} | ${mentionedPages.length} | ${escapeTableCell(mentionedPages[0]?.url ?? "")} |`;
    })
    .join("\n");

  const missingCompetitors = competitorNames.filter((name) => !compareText.includes(compactText(name)));
  const gaps: string[] = [];
  if (competitorNames.length === 0) {
    gaps.push("- No competitors are configured, so competitor coverage cannot be compared.");
  }
  if (comparePages.length === 0) {
    gaps.push("- No compare pages were discovered.");
  }
  for (const competitor of missingCompetitors) {
    gaps.push(`- ${competitor} is not named in discovered compare content.`);
  }

  return `# AnswerLens Competitor Structure Diff\n\n${renderSiteOverviewLines(result.site)}\n- Configured competitors: ${competitorNames.length}\n- Compare pages discovered: ${comparePages.length}\n\n## Coverage Matrix\n\n| Competitor | Named on compare pages | Matching pages | First matching page |\n| --- | --- | ---: | --- |\n${rows || "| none | no | 0 | |"}\n\n## Structural gaps\n\n${gaps.length > 0 ? gaps.join("\n") : "- none"}\n`;
}

function buildCitationGapMatrix(result: EvalResult) {
  const rows = result.prompts.map((promptResult) => {
    const citationDomains = [...new Set(promptResult.citations.map((citation) => citation.domain).filter(Boolean))];
    const ownedOrTrustedCitation = promptResult.scores.ownedCitation === 1 || promptResult.scores.trustedCitation === 1;
    const citationGap = promptResult.scores.accurateMention === 1 && !ownedOrTrustedCitation;

    return {
      promptId: promptResult.promptId,
      category: promptResult.category,
      intent: promptResult.intent,
      holdout: promptResult.holdout,
      provider: promptResult.provider,
      model: promptResult.model,
      locale: promptResult.locale,
      sampleIndex: promptResult.sampleIndex,
      rankPosition: promptResult.rankPosition,
      accurateMention: promptResult.scores.accurateMention === 1,
      ownedCitation: promptResult.scores.ownedCitation === 1,
      trustedCitation: promptResult.scores.trustedCitation === 1,
      recommended: promptResult.recommended,
      misrepresented: promptResult.misrepresented,
      competitorExcluded: promptResult.scores.competitorExcluded === 1,
      factCoverage: promptResult.scores.factCoverage,
      citationGap,
      competitorMentions: promptResult.competitorMentions,
      citationDomains,
      rawPayloadFile: promptResult.rawPayloadFile
    };
  });

  return {
    run: result.run,
    site: result.site,
    provider: result.provider,
    generatedAt: result.generatedAt,
    summary: {
      promptCount: result.summary.promptCount,
      holdoutPromptCount: result.summary.holdoutPromptCount,
      sampleCount: result.summary.sampleCount,
      citationGapCount: rows.filter((row) => row.citationGap).length,
      competitorExclusionGapCount: rows.filter((row) => row.competitorExcluded).length,
      misrepresentationCount: rows.filter((row) => row.misrepresented).length
    },
    rows
  };
}

function renderCitationGapMatrixMarkdown(result: EvalResult, locale: Locale = "en"): string {
  const matrix = buildCitationGapMatrix(result);
  const rows = matrix.rows
    .map(
      (row) =>
        `| ${escapeTableCell(row.promptId)} | ${escapeTableCell(row.category)} | ${row.sampleIndex + 1} | ${row.holdout ? "holdout" : "benchmark"} | ${row.accurateMention ? "yes" : "no"} | ${row.ownedCitation ? "yes" : "no"} | ${row.trustedCitation ? "yes" : "no"} | ${row.citationGap ? "yes" : "no"} | ${row.competitorExcluded ? "yes" : "no"} | ${escapeTableCell(row.competitorMentions.join(", "))} |`
    )
    .join("\n");

  return `# ${locale === "zh-CN" ? "AnswerLens 引用缺口矩阵" : "AnswerLens Citation Gap Matrix"}\n\n${renderSiteOverviewLines(result.site, locale)}\n- ${locale === "zh-CN" ? "提供方" : "Provider"}: ${result.provider.name}\n- ${locale === "zh-CN" ? "模型" : "Model"}: ${result.provider.model}\n- ${locale === "zh-CN" ? "样本数" : "Samples"}: ${result.summary.sampleCount}\n- ${locale === "zh-CN" ? "引用缺口数" : "Citation gaps"}: ${matrix.summary.citationGapCount}\n- ${locale === "zh-CN" ? "竞争对手排除缺口数" : "Competitor exclusion gaps"}: ${matrix.summary.competitorExclusionGapCount}\n\n| ${locale === "zh-CN" ? "提示词" : "Prompt"} | ${locale === "zh-CN" ? "类别" : "Category"} | ${locale === "zh-CN" ? "样本" : "Sample"} | ${locale === "zh-CN" ? "分组" : "Pack"} | ${locale === "zh-CN" ? "准确提及" : "Accurate mention"} | ${locale === "zh-CN" ? "自有引用" : "Owned citation"} | ${locale === "zh-CN" ? "可信引用" : "Trusted citation"} | ${locale === "zh-CN" ? "引用缺口" : "Citation gap"} | ${locale === "zh-CN" ? "排除竞争对手" : "Competitor excluded"} | ${locale === "zh-CN" ? "提及的竞争对手" : "Competitors mentioned"} |\n| --- | --- | ---: | --- | --- | --- | --- | --- | --- | --- |\n${rows}\n`;
}
async function writeBriefOutputs(outDir: string, briefs: ContentBrief[]): Promise<void> {
  if (briefs.length === 0) {
    return;
  }

  for (const directory of [path.join(outDir, "content-briefs"), path.join(outDir, "briefs")]) {
    await mkdir(directory, { recursive: true });
    for (const brief of briefs) {
      await writeFile(path.join(directory, `${brief.id}.md`), renderBriefMarkdown(brief), "utf8");
    }
  }
}

export function renderScorecardMarkdown(result: AuditResult, locale: Locale = "en"): string {
  const scores = Object.entries(result.scores)
    .map(
      ([bucket, score]) =>
        `| ${translateBucket(bucket, locale)} | ${score.score} | ${score.issueCount} | ${score.errorCount} | ${score.warnCount} | ${score.infoCount} |`
    )
    .join("\n");

  const topIssues = result.issues
    .slice(0, 10)
    .map(
      (issue) =>
        `| ${translateSeverity(issue.severity, locale)} | ${localizeText(issue.title, locale, "issueTitle")} | ${issue.pageUrl ?? t(locale, "scope.site")} | ${localizeText(issue.fixHint, locale, "fixHint")} |`
    )
    .join("\n");

  const pages = result.pages
    .map(
      (page) =>
        `| ${page.pageType} | ${page.url} | ${page.wordCount} | ${page.hasJsonLd ? "yes" : "no"} | ${page.noindex ? "yes" : "no"} |`
    )
    .join("\n");

  const recommendations =
    result.recommendations.length > 0
      ? result.recommendations
          .map(
            (recommendation) =>
              `- **${localizeText(recommendation.title, locale, "recommendationTitle")}**: ${localizeText(recommendation.rationale, locale, "rationale")} ${locale === "zh-CN" ? "预期结果" : "Expected outcome"}: ${localizeText(recommendation.expectedOutcome, locale, "expectedOutcome")}`
          )
          .join("\n")
      : `- ${t(locale, "report.noIssues")}`;

  const missingCoverage =
    result.summary.missingPageTypes.length > 0
      ? result.summary.missingPageTypes.map((pageType) => `- ${pageType}`).join("\n")
      : `- ${t(locale, "report.noIssues")}`;

  return `# ${t(locale, "report.scorecard.title")}\n\n## ${locale === "zh-CN" ? "概览" : "Overview"}\n\n${renderSiteOverviewLines(result.site, locale)}\n- ${t(locale, "report.generated")}: ${result.site.generatedAt}\n- ${t(locale, "run.id")}: ${result.run.id}\n- ${t(locale, "report.overallScore")}: ${result.summary.overallScore}\n- ${t(locale, "report.vavr")}: ${renderVavr(result.summary.vavr, locale)}\n- ${locale === "zh-CN" ? "抓取页面数" : "Crawled pages"}: ${result.summary.crawledPages}\n- ${locale === "zh-CN" ? "发现 URL 数" : "Discovered URLs"}: ${result.summary.discoveredUrls}\n\n## ${locale === "zh-CN" ? "分数" : "Scores"}\n\n| ${locale === "zh-CN" ? "分桶" : "Bucket"} | ${locale === "zh-CN" ? "分数" : "Score"} | ${locale === "zh-CN" ? "问题数" : "Issues"} | ${locale === "zh-CN" ? "错误" : "Errors"} | ${locale === "zh-CN" ? "警告" : "Warnings"} | ${locale === "zh-CN" ? "提示" : "Info"} |\n| --- | ---: | ---: | ---: | ---: | ---: |\n${scores}\n\n## ${locale === "zh-CN" ? "缺失覆盖" : "Missing coverage"}\n\n${missingCoverage}\n\n## ${locale === "zh-CN" ? "主要问题" : "Top issues"}\n\n| ${locale === "zh-CN" ? "严重级别" : "Severity"} | ${locale === "zh-CN" ? "问题" : "Issue"} | ${locale === "zh-CN" ? "范围" : "Scope"} | ${locale === "zh-CN" ? "修复提示" : "Fix hint"} |\n| --- | --- | --- | --- |\n${topIssues}\n\n## ${locale === "zh-CN" ? "建议" : "Recommendations"}\n\n${recommendations}\n\n## ${locale === "zh-CN" ? "页面清单" : "Page inventory"}\n\n| ${locale === "zh-CN" ? "类型" : "Type"} | URL | ${locale === "zh-CN" ? "词数" : "Words"} | JSON-LD | Noindex |\n| --- | --- | ---: | --- | --- |\n${pages}\n`;
}

export function renderScorecardHtml(result: AuditResult, locale: Locale = "en"): string {
  const bucketCards = Object.entries(result.scores)
    .map(
      ([bucket, score]) => `
      <div class="card">
        <h3>${translateBucket(bucket, locale)}</h3>
        <p class="score">${score.score}</p>
        <p>${score.issueCount} ${locale === "zh-CN" ? "个问题" : "issues"}</p>
      </div>`
    )
    .join("");

  const issueRows = result.issues
    .slice(0, 12)
    .map(
      (issue) => `
      <tr>
        <td>${translateSeverity(issue.severity, locale)}</td>
        <td>${escapeHtml(localizeText(issue.title, locale, "issueTitle"))}</td>
        <td>${issue.pageUrl ?? t(locale, "scope.site")}</td>
        <td>${escapeHtml(localizeText(issue.fixHint, locale, "fixHint"))}</td>
      </tr>`
    )
    .join("");

  const recommendations =
    result.recommendations.length > 0
      ? result.recommendations
          .map(
            (recommendation) =>
              `<li><strong>${escapeHtml(localizeText(recommendation.title, locale, "recommendationTitle"))}</strong><br />${escapeHtml(localizeText(recommendation.rationale, locale, "rationale"))}<br /><em>${escapeHtml(localizeText(recommendation.expectedOutcome, locale, "expectedOutcome"))}</em></li>`
          )
          .join("")
      : `<li>${escapeHtml(t(locale, "report.noRecommendations"))}</li>`;

  const missingCoverage =
    result.summary.missingPageTypes.length > 0
      ? result.summary.missingPageTypes.map((pageType) => `<li>${escapeHtml(pageType)}</li>`).join("")
      : `<li>${escapeHtml(t(locale, "report.noIssues"))}</li>`;

  return `<!doctype html>
<html lang="${locale === "zh-CN" ? "zh-CN" : "en"}">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(t(locale, "report.scorecard.title"))}</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f5f6f8;
        --panel: #ffffff;
        --ink: #17212b;
        --accent: #1155cc;
        --border: #d8dee8;
      }
      body {
        margin: 0;
        font-family: "Segoe UI", sans-serif;
        background: linear-gradient(180deg, #eef4ff 0%, var(--bg) 30%, var(--bg) 100%);
        color: var(--ink);
      }
      main {
        max-width: 1100px;
        margin: 0 auto;
        padding: 32px 20px 64px;
      }
      .hero, .panel {
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 18px;
        padding: 24px;
        box-shadow: 0 12px 28px rgba(17, 85, 204, 0.08);
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 16px;
        margin: 24px 0;
      }
      .card {
        background: #f9fbff;
        border: 1px solid var(--border);
        border-radius: 14px;
        padding: 16px;
      }
      .score {
        font-size: 40px;
        font-weight: 700;
        color: var(--accent);
        margin: 8px 0;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th, td {
        border-bottom: 1px solid var(--border);
        text-align: left;
        padding: 10px 8px;
        vertical-align: top;
      }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <p>${escapeHtml(t(locale, "report.scorecard.title"))}</p>
        <h1>${escapeHtml(siteLabel(result.site))}</h1>
        <p>${escapeHtml(t(locale, "run.id"))}: <strong>${result.run.id}</strong></p>
        <p>${escapeHtml(t(locale, "report.overallScore"))}: <strong>${result.summary.overallScore}</strong> | ${escapeHtml(t(locale, "report.vavr"))}: <strong>${renderVavr(result.summary.vavr, locale)}</strong></p>
        <p>${result.site.generatedAt}</p>
        <p><a href="${locale === "zh-CN" ? "./index.html" : "./index.zh.html"}">${escapeHtml(locale === "zh-CN" ? "English" : "简体中文")}</a></p>
        ${renderSiteHtmlNotes(result.site, locale)}
      </section>
      <section class="grid">${bucketCards}</section>
      <section class="panel">
        <h2>${locale === "zh-CN" ? "缺失覆盖" : "Missing coverage"}</h2>
        <ul>${missingCoverage}</ul>
      </section>
      <section class="panel" style="margin-top: 20px;">
        <h2>${locale === "zh-CN" ? "主要问题" : "Top issues"}</h2>
        <table>
          <thead>
            <tr><th>${locale === "zh-CN" ? "严重级别" : "Severity"}</th><th>${locale === "zh-CN" ? "问题" : "Issue"}</th><th>${locale === "zh-CN" ? "范围" : "Scope"}</th><th>${locale === "zh-CN" ? "修复提示" : "Fix hint"}</th></tr>
          </thead>
          <tbody>${issueRows}</tbody>
        </table>
      </section>
      <section class="panel" style="margin-top: 20px;">
        <h2>${locale === "zh-CN" ? "建议" : "Recommendations"}</h2>
        <ul>${recommendations}</ul>
      </section>
    </main>
  </body>
</html>`;
}

export function renderEvalSummaryMarkdown(result: EvalResult, locale: Locale = "en"): string {
  const manualRankSection =
    result.summary.competitivePositionScore === null
      ? ""
      : `\n\n## ${locale === "zh-CN" ? "人工排名验证" : "Manual rank validation"}\n\n- ${locale === "zh-CN" ? "竞争位置分数" : "Competitive position score"}: ${result.summary.competitivePositionScore}\n- ${locale === "zh-CN" ? "排名覆盖率" : "Rank coverage"}: ${result.summary.rankCoverageRate}%\n`;
  const repeatedPromptGroups = result.promptGroups.filter((group) => !group.holdout && group.sampleCount > 1);
  const stabilityRows = repeatedPromptGroups
    .map(
      (group) =>
        `| ${group.promptId} | ${group.category} | ${group.sampleCount} | ${group.holdout ? "holdout" : "benchmark"} | ${group.stable ? "yes" : "no"} | ${group.consensusRate}% | ${escapeTableCell(group.spreadNote ?? "-")} |`
    )
    .join("\n");
  const stabilitySection =
    repeatedPromptGroups.length === 0
      ? ""
      : `\n\n## ${locale === "zh-CN" ? "稳定性摘要" : "Stability summary"}\n\n- ${locale === "zh-CN" ? "重复提示词组数" : "Repeated prompt groups"}: ${result.summary.repeatedPromptCount}\n- ${locale === "zh-CN" ? "稳定的重复提示词" : "Stable repeated prompts"}: ${result.summary.stablePromptRate}%\n- ${locale === "zh-CN" ? "不稳定的重复提示词" : "Unstable repeated prompts"}: ${result.summary.unstablePromptCount}\n\n| ${locale === "zh-CN" ? "提示词" : "Prompt"} | ${locale === "zh-CN" ? "类别" : "Category"} | ${locale === "zh-CN" ? "样本数" : "Samples"} | ${locale === "zh-CN" ? "分组" : "Pack"} | ${locale === "zh-CN" ? "稳定" : "Stable"} | ${locale === "zh-CN" ? "一致率" : "Consensus"} | ${locale === "zh-CN" ? "差异说明" : "Spread note"} |\n| --- | --- | ---: | --- | --- | ---: | --- |\n${stabilityRows}\n`;

  const promptRows = result.prompts
    .map(
      (promptResult) =>
        `| ${promptResult.promptId} | ${promptResult.category} | ${promptResult.sampleIndex + 1} | ${promptResult.holdout ? "holdout" : "benchmark"} | ${Math.round(promptResult.scores.vavr * 100)} | ${promptResult.scores.accurateMention === 1 ? "yes" : "no"} | ${promptResult.citations.length} | ${promptResult.recommended ? "yes" : "no"} |`
    )
    .join("\n");

  const briefList =
    result.briefs.length > 0
      ? result.briefs.map((brief) => `- ${brief.type}: ${brief.title}`).join("\n")
      : "- none";

  return `# ${t(locale, "report.evalSummary.title")}\n\n## ${locale === "zh-CN" ? "概览" : "Overview"}\n\n${renderSiteOverviewLines(result.site, locale)}\n- ${locale === "zh-CN" ? "提供方" : "Provider"}: ${result.provider.name}\n- ${locale === "zh-CN" ? "模型" : "Model"}: ${result.provider.model}\n- ${t(locale, "report.generated")}: ${result.generatedAt}\n- ${locale === "zh-CN" ? "基准提示词数" : "Benchmark prompt count"}: ${result.summary.promptCount}\n- ${locale === "zh-CN" ? "保留集提示词数" : "Holdout prompt count"}: ${result.summary.holdoutPromptCount}\n- ${locale === "zh-CN" ? "样本数" : "Sample count"}: ${result.summary.sampleCount}\n- Locale: ${result.summary.locale ?? "default"}\n- ${t(locale, "report.vavr")}: ${result.summary.vavr}\n\n## ${t(locale, "report.metrics")}\n\n- ${locale === "zh-CN" ? "提及率" : "Mention rate"}: ${result.summary.mentionRate}\n- ${locale === "zh-CN" ? "准确提及率" : "Accurate mention rate"}: ${result.summary.accurateMentionRate}\n- ${locale === "zh-CN" ? "自有引用率" : "Owned citation rate"}: ${result.summary.ownedCitationRate}\n- ${locale === "zh-CN" ? "可信引用率" : "Trusted citation rate"}: ${result.summary.trustedCitationRate}\n- ${locale === "zh-CN" ? "推荐率" : "Recommendation rate"}: ${result.summary.recommendationRate}\n- ${locale === "zh-CN" ? "误表述率" : "Misrepresentation rate"}: ${result.summary.misrepresentationRate}\n- ${locale === "zh-CN" ? "竞争对手排除缺口" : "Competitor exclusion gap"}: ${result.summary.competitorExclusionGap}\n- ${locale === "zh-CN" ? "事实覆盖分" : "Fact coverage score"}: ${result.summary.factCoverageScore}\n- ${locale === "zh-CN" ? "准确率" : "Accuracy rate"}: ${result.summary.accuracyRate}${manualRankSection}${stabilitySection}\n\n## ${locale === "zh-CN" ? "提示词结果" : "Prompt results"}\n\n| ${locale === "zh-CN" ? "提示词" : "Prompt"} | ${locale === "zh-CN" ? "类别" : "Category"} | ${locale === "zh-CN" ? "样本" : "Sample"} | ${locale === "zh-CN" ? "分组" : "Pack"} | VAVR | ${locale === "zh-CN" ? "准确提及" : "Accurate mention"} | ${locale === "zh-CN" ? "引用数" : "Citations"} | ${locale === "zh-CN" ? "是否推荐" : "Recommended"} |\n| --- | --- | ---: | --- | ---: | --- | ---: | --- |\n${promptRows}\n\n## ${locale === "zh-CN" ? "生成的 brief" : "Generated briefs"}\n\n${briefList}\n`;
}

export function renderSearchValidationSummaryMarkdown(result: SearchValidationResult, title: string, locale: Locale = "en"): string {
  const keyProofRows = result.keyPageCoverage
    .sort((left, right) => right.impressions - left.impressions || left.pageUrl.localeCompare(right.pageUrl))
    .map(
      (page) =>
        `| ${page.pageType} | ${page.pageUrl} | ${page.hasEvidence ? "yes" : "no"} | ${page.impressions} | ${page.clicks} |`
    )
    .join("\n");
  const topPageRows = result.topPages
    .map(
      (page) =>
        `| ${page.page} | ${page.matchedPageType ?? "unmatched"} | ${page.impressions} | ${page.clicks} | ${page.position} |`
    )
    .join("\n");
  const findingRows =
    result.findings.length > 0
      ? result.findings
          .map(
            (finding) =>
              `| ${finding.severity} | ${finding.title} | ${finding.pageType ?? "n/a"} | ${finding.pageUrl} | ${escapeTableCell(finding.evidence ?? "-")} |`
          )
          .join("\n")
      : "| none | none | n/a | n/a | - |";

  return `# ${title}

## ${locale === "zh-CN" ? "概览" : "Overview"}

${renderSiteOverviewLines(result.site, locale)}
- ${locale === "zh-CN" ? "来源" : "Source"}: ${result.source.input}
- Imported pages: ${result.summary.importedPageCount}
- Matched audit pages: ${result.summary.matchedAuditPageCount}
- Out-of-scope pages: ${result.summary.outOfScopePageCount}
- Key pages with evidence: ${result.summary.keyPagesWithEvidence}
- Key pages without evidence: ${result.summary.keyPagesWithoutEvidence}
- Total clicks: ${result.summary.totalClicks}
- Total impressions: ${result.summary.totalImpressions}

## ${locale === "zh-CN" ? "关键页面证据覆盖" : "Key page evidence coverage"}

| Page type | Page | Evidence | Impressions | Clicks |
| --- | --- | --- | ---: | ---: |
${keyProofRows || "| none | none | no | 0 | 0 |"}

## ${locale === "zh-CN" ? "按 impressions 排名的页面" : "Top pages by impressions"}

| Page | Matched type | Impressions | Clicks | Position |
| --- | --- | ---: | ---: | ---: |
${topPageRows || "| none | n/a | 0 | 0 | 0 |"}

## ${locale === "zh-CN" ? "验证发现" : "Validation findings"}

| Severity | Finding | Page type | Page | Evidence |
| --- | --- | --- | --- | --- |
${findingRows}
`;
}

export function renderSearchConsoleSummaryMarkdown(result: SearchValidationResult, locale: Locale = "en"): string {
  return renderSearchValidationSummaryMarkdown(result, locale === "zh-CN" ? "AnswerLens Search Console 摘要" : "AnswerLens Search Console Summary", locale);
}

export function renderBingSummaryMarkdown(result: SearchValidationResult, locale: Locale = "en"): string {
  return renderSearchValidationSummaryMarkdown(result, locale === "zh-CN" ? "AnswerLens Bing Webmaster 摘要" : "AnswerLens Bing Webmaster Summary", locale);
}

export function renderIndexNowSummaryMarkdown(result: IndexNowHelperResult, locale: Locale = "en"): string {
  const candidateRows = result.candidates
    .map((candidate) => `| ${candidate.pageType} | ${candidate.url} | ${escapeTableCell(candidate.reason)} |`)
    .join("\n");

  return `# ${locale === "zh-CN" ? "AnswerLens IndexNow 辅助摘要" : "AnswerLens IndexNow Helper Summary"}

## ${locale === "zh-CN" ? "概览" : "Overview"}

${renderSiteOverviewLines(result.site, locale)}
- ${t(locale, "report.generated")}: ${result.generatedAt}
- Host: ${result.summary.host}
- Endpoint: ${result.summary.endpoint}
- Candidate URLs: ${result.summary.candidateCount}
- Key page candidates: ${result.summary.keyPageCandidateCount}

## ${locale === "zh-CN" ? "候选 URL" : "Candidate URLs"}

| Page type | URL | Reason |
| --- | --- | --- |
${candidateRows || "| none | none | none |"}
`;
}

export function renderEvalDiffMarkdown(current: EvalResult, previous: EvalResult | null, locale: Locale = "en"): string {
  if (!previous) {
    return `# ${locale === "zh-CN" ? "AnswerLens 前后对比" : "AnswerLens Before/After Diff"}\n\n${locale === "zh-CN" ? "当前输出目录中没有找到上一份 eval-results.json，因此本次运行将成为基线。" : "No previous eval-results.json was found in this output directory, so this run becomes the baseline."}\n`;
  }

  const rows = summarizeEvalDiff(current, previous)
    .map(
      (metric) =>
        `| ${metric.label} | ${metric.previous ?? "n/a"} | ${metric.current} | ${metric.delta === null ? "n/a" : metric.delta > 0 ? `+${metric.delta}` : `${metric.delta}`} |`
    )
    .join("\n");

  return `# ${locale === "zh-CN" ? "AnswerLens 前后对比" : "AnswerLens Before/After Diff"}\n\n| ${locale === "zh-CN" ? "指标" : "Metric"} | ${locale === "zh-CN" ? "之前" : "Before"} | ${locale === "zh-CN" ? "之后" : "After"} | Delta |\n| --- | ---: | ---: | ---: |\n${rows}\n`;
}

export function renderBriefMarkdown(brief: ContentBrief): string {
  const outline = brief.outline.map((entry) => `- ${entry}`).join("\n");
  const claims = brief.claims.map((entry) => `- ${entry}`).join("\n");

  return `# ${brief.title}\n\n- Type: ${brief.type}\n- Audience: ${brief.audience}\n- Angle: ${brief.angle}\n- CTA: ${brief.cta}\n\n## Outline\n\n${outline}\n\n## Claims to support\n\n${claims}\n`;
}

export async function readEvalResults(filePath: string): Promise<EvalResult | null> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as EvalResult;
  } catch {
    return null;
  }
}

export async function writeAuditOutputs(outDir: string, result: AuditResult): Promise<void> {
  await ensureDir(outDir);
  const shareSummary = buildAuditShareSummary(result);
  await writeJson(path.join(outDir, "site-audit.json"), result);
  await writeJson(path.join(outDir, "issues.json"), result.issues);
  await writeFile(path.join(outDir, "scorecard.md"), renderScorecardMarkdown(result, "en"), "utf8");
  await writeFile(path.join(outDir, "scorecard.zh.md"), renderScorecardMarkdown(result, "zh-CN"), "utf8");
  await writeFile(path.join(outDir, "recommendations.md"), renderRecommendationsMarkdown(result, "en"), "utf8");
  await writeFile(path.join(outDir, "recommendations.zh.md"), renderRecommendationsMarkdown(result, "zh-CN"), "utf8");
  await writeFile(path.join(outDir, "index.html"), renderScorecardHtml(result, "en"), "utf8");
  await writeFile(path.join(outDir, "index.zh.html"), renderScorecardHtml(result, "zh-CN"), "utf8");
  await writeJson(path.join(outDir, "normalized-pages.json"), result.pages);
  await writeFile(path.join(outDir, "competitor-diff.md"), renderCompetitorDiffMarkdown(result), "utf8");
  await writeShareOutputs(outDir, shareSummary);
  await writeJson(path.join(outDir, "run.json"), buildAuditRunManifest(result));
}

export async function writeEvalOutputs(outDir: string, result: EvalResult, previous: EvalResult | null): Promise<void> {
  await ensureDir(outDir);
  const previousShareSummary = await readShareSummary(outDir);
  const shareSummary = buildEvalShareSummary(result, previousShareSummary);
  await writeJson(path.join(outDir, "eval-results.json"), result);
  await writeFile(path.join(outDir, "eval-summary.md"), renderEvalSummaryMarkdown(result, "en"), "utf8");
  await writeFile(path.join(outDir, "eval-summary.zh.md"), renderEvalSummaryMarkdown(result, "zh-CN"), "utf8");
  await writeJson(path.join(outDir, "eval-summary.json"), buildEvalSummaryJson(result));
  await writeFile(path.join(outDir, "before-after-diff.md"), renderEvalDiffMarkdown(result, previous, "en"), "utf8");
  await writeFile(path.join(outDir, "before-after-diff.zh.md"), renderEvalDiffMarkdown(result, previous, "zh-CN"), "utf8");
  await writeJson(path.join(outDir, "citation-gap-matrix.json"), buildCitationGapMatrix(result));
  await writeFile(path.join(outDir, "citation-gap-matrix.md"), renderCitationGapMatrixMarkdown(result, "en"), "utf8");
  await writeFile(path.join(outDir, "citation-gap-matrix.zh.md"), renderCitationGapMatrixMarkdown(result, "zh-CN"), "utf8");
  await writeShareOutputs(outDir, shareSummary);
  await writeJson(path.join(outDir, "run.json"), buildEvalRunManifest(result));
  await writeBriefOutputs(outDir, result.briefs);
}

export async function writeValidationOutputs(
  outDir: string,
  audit: AuditResult,
  result: SearchValidationResult
): Promise<void> {
  await ensureDir(outDir);
  const shareSummary = buildValidationShareSummary(audit, result);
  await writeJson(path.join(outDir, "search-console-summary.json"), buildSearchValidationSummaryJson(result));
  await writeFile(path.join(outDir, "search-console-summary.md"), renderSearchConsoleSummaryMarkdown(result, "en"), "utf8");
  await writeFile(path.join(outDir, "search-console-summary.zh.md"), renderSearchConsoleSummaryMarkdown(result, "zh-CN"), "utf8");
  await writeJson(path.join(outDir, "search-console-pages.json"), result.pages);
  await writeShareOutputs(outDir, shareSummary);
  await writeJson(path.join(outDir, "run.json"), buildValidationRunManifest(audit, result));
}

export async function writeBingIndexNowOutputs(
  outDir: string,
  audit: AuditResult,
  result: SearchValidationResult,
  indexNow: IndexNowHelperResult
): Promise<void> {
  await ensureDir(outDir);
  const shareSummary = buildValidationShareSummary(audit, result, {
    validationLabel: "Bing Webmaster",
    indexNowCandidateCount: indexNow.summary.candidateCount
  });
  await writeJson(path.join(outDir, "bing-summary.json"), buildSearchValidationSummaryJson(result));
  await writeFile(path.join(outDir, "bing-summary.md"), renderBingSummaryMarkdown(result, "en"), "utf8");
  await writeFile(path.join(outDir, "bing-summary.zh.md"), renderBingSummaryMarkdown(result, "zh-CN"), "utf8");
  await writeJson(path.join(outDir, "bing-pages.json"), result.pages);
  await writeJson(path.join(outDir, "indexnow-summary.json"), buildIndexNowSummaryJson(indexNow));
  await writeFile(path.join(outDir, "indexnow-summary.md"), renderIndexNowSummaryMarkdown(indexNow, "en"), "utf8");
  await writeFile(path.join(outDir, "indexnow-summary.zh.md"), renderIndexNowSummaryMarkdown(indexNow, "zh-CN"), "utf8");
  await writeJson(path.join(outDir, "indexnow-candidates.json"), indexNow.candidates);
  await writeShareOutputs(outDir, shareSummary);
  await writeJson(path.join(outDir, "run.json"), buildBingHelperRunManifest(audit, result, indexNow));
}
