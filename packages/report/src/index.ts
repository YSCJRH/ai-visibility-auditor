import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { AuditResult } from "../../core/src/types.ts";
import { BUCKET_LABELS } from "../../core/src/audit.ts";
import { ensureDir } from "../../core/src/utils.ts";

export function renderScorecardMarkdown(result: AuditResult): string {
  const scores = Object.entries(result.scores)
    .map(
      ([bucket, score]) =>
        `| ${BUCKET_LABELS[bucket as keyof typeof BUCKET_LABELS]} | ${score.score} | ${score.issueCount} | ${score.errorCount} | ${score.warnCount} | ${score.infoCount} |`
    )
    .join("\n");

  const topIssues = result.issues
    .slice(0, 10)
    .map(
      (issue) =>
        `| ${issue.severity} | ${issue.title} | ${issue.pageUrl ?? "site"} | ${issue.fixHint} |`
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
- VAVR: pending eval
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
        <p>Overall score: <strong>${result.summary.overallScore}</strong> · VAVR: <strong>pending eval</strong></p>
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

export async function writeAuditOutputs(outDir: string, result: AuditResult): Promise<void> {
  await ensureDir(outDir);
  await writeFile(path.join(outDir, "site-audit.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
  await writeFile(path.join(outDir, "issues.json"), `${JSON.stringify(result.issues, null, 2)}\n`, "utf8");
  await writeFile(path.join(outDir, "scorecard.md"), renderScorecardMarkdown(result), "utf8");
  await writeFile(path.join(outDir, "index.html"), renderScorecardHtml(result), "utf8");
}
