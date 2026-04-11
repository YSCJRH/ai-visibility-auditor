import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AuditResult } from "../../core/src/types.ts";
import type { ContentBrief, EvalResult } from "../../core/src/eval.ts";
import { BUCKET_LABELS } from "../../core/src/audit.ts";
import { summarizeEvalDiff } from "../../core/src/eval.ts";
import { ensureDir } from "../../core/src/utils.ts";

type RunKind = "audit" | "eval" | "manual-import";

interface RunManifest {
  kind: RunKind;
  run: AuditResult["run"] | EvalResult["run"];
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
  briefs: Array<Pick<ContentBrief, "id" | "type" | "title" | "audience" | "angle" | "cta">>;
}

function renderVavr(value: number | null): string {
  return value === null ? "pending eval" : `${value}`;
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
function renderRecommendationsMarkdown(result: AuditResult): string {
  const blocks =
    result.recommendations.length > 0
      ? result.recommendations
          .map((recommendation) => {
            const relatedIssues =
              recommendation.relatedIssues.length > 0
                ? recommendation.relatedIssues.map((issue) => `- ${issue}`).join("\n")
                : "- none";

            return `## ${recommendation.title}\n\n- Rationale: ${recommendation.rationale}\n- Expected outcome: ${recommendation.expectedOutcome}\n\n### Related issues\n\n${relatedIssues}`;
          })
          .join("\n\n")
      : "No recommendations were generated for this run.";

  return `# AnswerLens Recommendations\n\n- Site: ${result.site.input}\n- Generated: ${result.site.generatedAt}\n- Overall score: ${result.summary.overallScore}\n\n${blocks}\n`;
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
    artifacts: ["site-audit.json", "issues.json", "recommendations.md", "scorecard.md", "index.html", "normalized-pages.json", "competitor-diff.md", "run.json"]
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
      accuracyRate: result.summary.accuracyRate
    },
    artifacts: [
      "site-audit.json",
      "issues.json",
      "recommendations.md",
      "scorecard.md",
      "index.html",
      "normalized-pages.json",
      "competitor-diff.md",
      "eval-results.json",
      "eval-summary.md",
      "eval-summary.json",
      "before-after-diff.md",
      "citation-gap-matrix.json",
      "citation-gap-matrix.md",
      "content-briefs/*.md",
      "briefs/*.md",
      "run.json",
      "raw/<provider>/<promptId>.json"
    ],
    provider: result.provider
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

  return `# AnswerLens Competitor Structure Diff\n\n- Site: ${result.site.input}\n- Configured competitors: ${competitorNames.length}\n- Compare pages discovered: ${comparePages.length}\n\n## Coverage Matrix\n\n| Competitor | Named on compare pages | Matching pages | First matching page |\n| --- | --- | ---: | --- |\n${rows || "| none | no | 0 | |"}\n\n## Structural gaps\n\n${gaps.length > 0 ? gaps.join("\n") : "- none"}\n`;
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

function renderCitationGapMatrixMarkdown(result: EvalResult): string {
  const matrix = buildCitationGapMatrix(result);
  const rows = matrix.rows
    .map(
      (row) =>
        `| ${escapeTableCell(row.promptId)} | ${escapeTableCell(row.category)} | ${row.sampleIndex + 1} | ${row.holdout ? "holdout" : "benchmark"} | ${row.accurateMention ? "yes" : "no"} | ${row.ownedCitation ? "yes" : "no"} | ${row.trustedCitation ? "yes" : "no"} | ${row.citationGap ? "yes" : "no"} | ${row.competitorExcluded ? "yes" : "no"} | ${escapeTableCell(row.competitorMentions.join(", "))} |`
    )
    .join("\n");

  return `# AnswerLens Citation Gap Matrix\n\n- Site: ${result.site.input}\n- Provider: ${result.provider.name}\n- Model: ${result.provider.model}\n- Samples: ${result.summary.sampleCount}\n- Citation gaps: ${matrix.summary.citationGapCount}\n- Competitor exclusion gaps: ${matrix.summary.competitorExclusionGapCount}\n\n| Prompt | Category | Sample | Pack | Accurate mention | Owned citation | Trusted citation | Citation gap | Competitor excluded | Competitors mentioned |\n| --- | --- | ---: | --- | --- | --- | --- | --- | --- | --- |\n${rows}\n`;
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

export function renderScorecardMarkdown(result: AuditResult): string {
  const scores = Object.entries(result.scores)
    .map(
      ([bucket, score]) =>
        `| ${BUCKET_LABELS[bucket as keyof typeof BUCKET_LABELS]} | ${score.score} | ${score.issueCount} | ${score.errorCount} | ${score.warnCount} | ${score.infoCount} |`
    )
    .join("\n");

  const topIssues = result.issues
    .slice(0, 10)
    .map((issue) => `| ${issue.severity} | ${issue.title} | ${issue.pageUrl ?? "site"} | ${issue.fixHint} |`)
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
              `- **${recommendation.title}**: ${recommendation.rationale} Expected outcome: ${recommendation.expectedOutcome}`
          )
          .join("\n")
      : "- none";

  const missingCoverage =
    result.summary.missingPageTypes.length > 0
      ? result.summary.missingPageTypes.map((pageType) => `- ${pageType}`).join("\n")
      : "- none";

  return `# AnswerLens Scorecard\n\n## Overview\n\n- Site: ${result.site.input}\n- Generated: ${result.site.generatedAt}\n- Run ID: ${result.run.id}\n- Overall score: ${result.summary.overallScore}\n- VAVR: ${renderVavr(result.summary.vavr)}\n- Crawled pages: ${result.summary.crawledPages}\n- Discovered URLs: ${result.summary.discoveredUrls}\n\n## Scores\n\n| Bucket | Score | Issues | Errors | Warnings | Info |\n| --- | ---: | ---: | ---: | ---: | ---: |\n${scores}\n\n## Missing coverage\n\n${missingCoverage}\n\n## Top issues\n\n| Severity | Issue | Scope | Fix hint |\n| --- | --- | --- | --- |\n${topIssues}\n\n## Recommendations\n\n${recommendations}\n\n## Page inventory\n\n| Type | URL | Words | JSON-LD | Noindex |\n| --- | --- | ---: | --- | --- |\n${pages}\n`;
}

export function renderScorecardHtml(result: AuditResult): string {
  const bucketCards = Object.entries(result.scores)
    .map(
      ([bucket, score]) => `
      <div class="card">
        <h3>${BUCKET_LABELS[bucket as keyof typeof BUCKET_LABELS]}</h3>
        <p class="score">${score.score}</p>
        <p>${score.issueCount} issues</p>
      </div>`
    )
    .join("");

  const issueRows = result.issues
    .slice(0, 12)
    .map(
      (issue) => `
      <tr>
        <td>${issue.severity}</td>
        <td>${issue.title}</td>
        <td>${issue.pageUrl ?? "site"}</td>
        <td>${issue.fixHint}</td>
      </tr>`
    )
    .join("");

  const recommendations =
    result.recommendations.length > 0
      ? result.recommendations
          .map(
            (recommendation) =>
              `<li><strong>${recommendation.title}</strong><br />${recommendation.rationale}<br /><em>${recommendation.expectedOutcome}</em></li>`
          )
          .join("")
      : "<li>No recommendations generated.</li>";

  const missingCoverage =
    result.summary.missingPageTypes.length > 0
      ? result.summary.missingPageTypes.map((pageType) => `<li>${pageType}</li>`).join("")
      : "<li>none</li>";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>AnswerLens report</title>
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
        <p>AnswerLens scorecard</p>
        <h1>${result.site.input}</h1>
        <p>Run ID: <strong>${result.run.id}</strong></p>
        <p>Overall score: <strong>${result.summary.overallScore}</strong> | VAVR: <strong>${renderVavr(result.summary.vavr)}</strong></p>
        <p>${result.site.generatedAt}</p>
      </section>
      <section class="grid">${bucketCards}</section>
      <section class="panel">
        <h2>Missing coverage</h2>
        <ul>${missingCoverage}</ul>
      </section>
      <section class="panel" style="margin-top: 20px;">
        <h2>Top issues</h2>
        <table>
          <thead>
            <tr><th>Severity</th><th>Issue</th><th>Scope</th><th>Fix hint</th></tr>
          </thead>
          <tbody>${issueRows}</tbody>
        </table>
      </section>
      <section class="panel" style="margin-top: 20px;">
        <h2>Recommendations</h2>
        <ul>${recommendations}</ul>
      </section>
    </main>
  </body>
</html>`;
}

export function renderEvalSummaryMarkdown(result: EvalResult): string {
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

  return `# AnswerLens Eval Summary\n\n## Overview\n\n- Site: ${result.site.input}\n- Provider: ${result.provider.name}\n- Model: ${result.provider.model}\n- Generated: ${result.generatedAt}\n- Benchmark prompt count: ${result.summary.promptCount}\n- Holdout prompt count: ${result.summary.holdoutPromptCount}\n- Sample count: ${result.summary.sampleCount}\n- Locale: ${result.summary.locale ?? "default"}\n- VAVR: ${result.summary.vavr}\n\n## Metrics\n\n- Mention rate: ${result.summary.mentionRate}\n- Accurate mention rate: ${result.summary.accurateMentionRate}\n- Owned citation rate: ${result.summary.ownedCitationRate}\n- Trusted citation rate: ${result.summary.trustedCitationRate}\n- Recommendation rate: ${result.summary.recommendationRate}\n- Misrepresentation rate: ${result.summary.misrepresentationRate}\n- Competitor exclusion gap: ${result.summary.competitorExclusionGap}\n- Fact coverage score: ${result.summary.factCoverageScore}\n- Accuracy rate: ${result.summary.accuracyRate}\n\n## Prompt results\n\n| Prompt | Category | Sample | Pack | VAVR | Accurate mention | Citations | Recommended |\n| --- | --- | ---: | --- | ---: | --- | ---: | --- |\n${promptRows}\n\n## Generated briefs\n\n${briefList}\n`;
}

export function renderEvalDiffMarkdown(current: EvalResult, previous: EvalResult | null): string {
  if (!previous) {
    return `# AnswerLens Before/After Diff\n\nNo previous eval-results.json was found in this output directory, so this run becomes the baseline.\n`;
  }

  const rows = summarizeEvalDiff(current, previous)
    .map(
      (metric) =>
        `| ${metric.label} | ${metric.previous ?? "n/a"} | ${metric.current} | ${metric.delta === null ? "n/a" : metric.delta > 0 ? `+${metric.delta}` : `${metric.delta}`} |`
    )
    .join("\n");

  return `# AnswerLens Before/After Diff\n\n| Metric | Before | After | Delta |\n| --- | ---: | ---: | ---: |\n${rows}\n`;
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
  await writeJson(path.join(outDir, "site-audit.json"), result);
  await writeJson(path.join(outDir, "issues.json"), result.issues);
  await writeFile(path.join(outDir, "scorecard.md"), renderScorecardMarkdown(result), "utf8");
  await writeFile(path.join(outDir, "recommendations.md"), renderRecommendationsMarkdown(result), "utf8");
  await writeFile(path.join(outDir, "index.html"), renderScorecardHtml(result), "utf8");
  await writeJson(path.join(outDir, "normalized-pages.json"), result.pages);
  await writeFile(path.join(outDir, "competitor-diff.md"), renderCompetitorDiffMarkdown(result), "utf8");
  await writeJson(path.join(outDir, "run.json"), buildAuditRunManifest(result));
}

export async function writeEvalOutputs(outDir: string, result: EvalResult, previous: EvalResult | null): Promise<void> {
  await ensureDir(outDir);
  await writeJson(path.join(outDir, "eval-results.json"), result);
  await writeFile(path.join(outDir, "eval-summary.md"), renderEvalSummaryMarkdown(result), "utf8");
  await writeJson(path.join(outDir, "eval-summary.json"), buildEvalSummaryJson(result));
  await writeFile(path.join(outDir, "before-after-diff.md"), renderEvalDiffMarkdown(result, previous), "utf8");
  await writeJson(path.join(outDir, "citation-gap-matrix.json"), buildCitationGapMatrix(result));
  await writeFile(path.join(outDir, "citation-gap-matrix.md"), renderCitationGapMatrixMarkdown(result), "utf8");
  await writeJson(path.join(outDir, "run.json"), buildEvalRunManifest(result));
  await writeBriefOutputs(outDir, result.briefs);
}
