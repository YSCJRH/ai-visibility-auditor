import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AuditResult } from "../../core/src/types.ts";
import type { ContentBrief, EvalResult } from "../../core/src/eval.ts";
import { BUCKET_LABELS } from "../../core/src/audit.ts";
import { summarizeEvalDiff } from "../../core/src/eval.ts";
import { ensureDir } from "../../core/src/utils.ts";

function renderVavr(value: number | null): string {
  return value === null ? "pending eval" : `${value}`;
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

  return `# AnswerLens Scorecard

## Overview

- Site: ${result.site.input}
- Generated: ${result.site.generatedAt}
- Overall score: ${result.summary.overallScore}
- VAVR: ${renderVavr(result.summary.vavr)}
- Crawled pages: ${result.summary.crawledPages}
- Discovered URLs: ${result.summary.discoveredUrls}

## Scores

| Bucket | Score | Issues | Errors | Warnings | Info |
| --- | ---: | ---: | ---: | ---: | ---: |
${scores}

## Missing coverage

${missingCoverage}

## Top issues

| Severity | Issue | Scope | Fix hint |
| --- | --- | --- | --- |
${topIssues}

## Recommendations

${recommendations}

## Page inventory

| Type | URL | Words | JSON-LD | Noindex |
| --- | --- | ---: | --- | --- |
${pages}
`;
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
        <p>Overall score: <strong>${result.summary.overallScore}</strong> · VAVR: <strong>${renderVavr(result.summary.vavr)}</strong></p>
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
        `| ${promptResult.promptId} | ${promptResult.category} | ${Math.round(promptResult.scores.vavr * 100)} | ${promptResult.scores.mention === 1 ? "yes" : "no"} | ${promptResult.citations.length} | ${promptResult.recommended ? "yes" : "no"} |`
    )
    .join("\n");

  const briefList =
    result.briefs.length > 0
      ? result.briefs.map((brief) => `- ${brief.type}: ${brief.title}`).join("\n")
      : "- none";

  return `# AnswerLens Eval Summary

## Overview

- Site: ${result.site.input}
- Provider: ${result.provider.name}
- Model: ${result.provider.model}
- Generated: ${result.generatedAt}
- Prompt count: ${result.summary.promptCount}
- VAVR: ${result.summary.vavr}

## Metrics

- Mention rate: ${result.summary.mentionRate}
- Owned citation rate: ${result.summary.ownedCitationRate}
- Trusted citation rate: ${result.summary.trustedCitationRate}
- Recommendation rate: ${result.summary.recommendationRate}
- Accuracy rate: ${result.summary.accuracyRate}

## Prompt results

| Prompt | Category | VAVR | Mention | Citations | Recommended |
| --- | --- | ---: | --- | ---: | --- |
${promptRows}

## Generated briefs

${briefList}
`;
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

  return `# AnswerLens Before/After Diff

| Metric | Before | After | Delta |
| --- | ---: | ---: | ---: |
${rows}
`;
}

export function renderBriefMarkdown(brief: ContentBrief): string {
  const outline = brief.outline.map((entry) => `- ${entry}`).join("\n");
  const claims = brief.claims.map((entry) => `- ${entry}`).join("\n");

  return `# ${brief.title}

- Type: ${brief.type}
- Audience: ${brief.audience}
- Angle: ${brief.angle}
- CTA: ${brief.cta}

## Outline

${outline}

## Claims to support

${claims}
`;
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
  await writeFile(path.join(outDir, "site-audit.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
  await writeFile(path.join(outDir, "issues.json"), `${JSON.stringify(result.issues, null, 2)}\n`, "utf8");
  await writeFile(path.join(outDir, "scorecard.md"), renderScorecardMarkdown(result), "utf8");
  await writeFile(path.join(outDir, "index.html"), renderScorecardHtml(result), "utf8");
}

export async function writeEvalOutputs(outDir: string, result: EvalResult, previous: EvalResult | null): Promise<void> {
  await ensureDir(outDir);
  await writeFile(path.join(outDir, "eval-results.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
  await writeFile(path.join(outDir, "eval-summary.md"), renderEvalSummaryMarkdown(result), "utf8");
  await writeFile(path.join(outDir, "before-after-diff.md"), renderEvalDiffMarkdown(result, previous), "utf8");

  if (result.briefs.length > 0) {
    const briefsDir = path.join(outDir, "briefs");
    await mkdir(briefsDir, { recursive: true });
    for (const brief of result.briefs) {
      await writeFile(path.join(briefsDir, `${brief.id}.md`), renderBriefMarkdown(brief), "utf8");
    }
  }
}

