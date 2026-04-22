import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  LOCALE_COOKIE_KEY,
  type Locale,
  formatDate,
  normalizeLocale,
  setLocaleCookieHeader,
  translateFixHint,
  translateIssueTitle,
  translateRunKind,
  translateSeverity,
  translateStatus
} from "../src/shared/i18n.ts";
import {
  createAuditRun,
  createEvalRun,
  getRunDetail,
  getRunJob,
  listConfigPresets,
  listRuns,
  readRunArtifact
} from "@answerlens/admin-runtime";
import type { CreateAuditRunInput, CreateEvalRunInput } from "@answerlens/contracts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistDir = path.resolve(__dirname, "../dist");
const port = Number(process.env.PORT ?? 4318);

function isArtifactPayload(value: string): "markdown" | "json" | "html" | "text" {
  if (value.endsWith(".md")) {
    return "markdown";
  }
  if (value.endsWith(".json")) {
    return "json";
  }
  if (value.endsWith(".html")) {
    return "html";
  }
  return "text";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDateTime(value: string, locale: Locale): string {
  return formatDate(value, locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatScore(value: number | null, locale: Locale): string {
  return value === null ? (locale === "zh-CN" ? "待生成" : "Pending") : `${value}/100`;
}

function parseCookie(header: string | undefined, key: string): string | null {
  if (!header) {
    return null;
  }

  const parts = header.split(";").map((segment) => segment.trim());
  for (const part of parts) {
    const [name, ...rest] = part.split("=");
    if (name === key) {
      return decodeURIComponent(rest.join("="));
    }
  }

  return null;
}

function resolveReviewLocale(request: express.Request): Locale {
  const query = typeof request.query.lang === "string" ? request.query.lang : null;
  const cookie = parseCookie(request.headers.cookie, LOCALE_COOKIE_KEY);
  const acceptLanguage = request.headers["accept-language"];
  return normalizeLocale(query ?? cookie ?? acceptLanguage ?? "en");
}

function renderReviewShell(title: string, body: string, locale: Locale): string {
  return `<!doctype html>
<html lang="${locale === "zh-CN" ? "zh-CN" : "en"}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root {
        color-scheme: dark;
        --canvas: #050506;
        --surface: rgba(255, 255, 255, 0.045);
        --surface-elevated: rgba(255, 255, 255, 0.06);
        --text-strong: #edecef;
        --text-muted: #8d939d;
        --text-subtle: rgba(237, 236, 239, 0.62);
        --accent: #5e6ad2;
        --accent-bright: #6872d9;
        --state-success: #6bd0b4;
        --state-danger: #f07b9e;
        --border-subtle: rgba(255, 255, 255, 0.06);
        --border-accent: rgba(94, 106, 210, 0.32);
        --shadow-card:
          0 0 0 1px rgba(255, 255, 255, 0.05),
          0 18px 52px rgba(0, 0, 0, 0.38),
          0 40px 90px rgba(0, 0, 0, 0.18);
      }

      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: Inter, system-ui, sans-serif;
        background:
          radial-gradient(circle at 50% -10%, rgba(94, 106, 210, 0.24), transparent 34rem),
          radial-gradient(circle at 0% 34%, rgba(98, 79, 206, 0.12), transparent 28rem),
          radial-gradient(circle at 100% 18%, rgba(64, 86, 209, 0.12), transparent 24rem),
          linear-gradient(180deg, rgba(255, 255, 255, 0.03), transparent 22rem),
          var(--canvas);
        color: var(--text-strong);
      }
      body::before {
        content: "";
        position: fixed;
        inset: 0;
        pointer-events: none;
        opacity: 0.028;
        background-image:
          linear-gradient(rgba(255, 255, 255, 0.5) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255, 255, 255, 0.5) 1px, transparent 1px);
        background-size: 64px 64px;
        mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.75), transparent 85%);
      }
      a { color: var(--accent-bright); text-decoration: none; }
      a:hover { color: var(--text-strong); }
      code {
        font-family: "SFMono-Regular", Consolas, monospace;
        padding: 0.14rem 0.38rem;
        border-radius: 8px;
        border: 1px solid rgba(94, 106, 210, 0.18);
        background: rgba(94, 106, 210, 0.1);
      }
      .shell {
        display: grid;
        grid-template-columns: 16rem minmax(0, 1fr);
        min-height: 100vh;
      }
      .sidebar {
        padding: 1.5rem 1.25rem;
        border-right: 1px solid var(--border-subtle);
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.03), transparent 35%),
          rgba(8, 8, 11, 0.76);
        backdrop-filter: blur(24px);
      }
      .brand-label {
        color: var(--text-subtle);
        font-size: 0.72rem;
        font-weight: 600;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }
      .brand-title {
        margin: 0.55rem 0 0;
        font-size: 1.5rem;
        font-weight: 600;
        line-height: 1.05;
        letter-spacing: -0.035em;
      }
      .brand-copy,
      .sidebar-copy {
        color: var(--text-muted);
        line-height: 1.6;
      }
      .nav {
        display: grid;
        gap: 0.45rem;
        margin-top: 1.2rem;
      }
      .nav a {
        display: block;
        padding: 0.78rem 0.9rem;
        border: 1px solid var(--border-subtle);
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.035);
        color: var(--text-muted);
        font-size: 0.94rem;
        font-weight: 600;
      }
      .nav a.active {
        border-color: var(--border-accent);
        background: rgba(94, 106, 210, 0.14);
        color: var(--text-strong);
      }
      .sidebar-card {
        margin-top: 1rem;
        padding: 1rem;
        border: 1px solid var(--border-subtle);
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.03);
      }
      .sidebar-eyebrow,
      .eyebrow {
        margin: 0 0 0.5rem;
        color: var(--text-subtle);
        font-size: 0.72rem;
        font-weight: 600;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }
      .content {
        padding: 1.5rem clamp(1rem, 3vw, 2.25rem) 2rem;
      }
      .topbar,
      .panel {
        border: 1px solid var(--border-subtle);
        border-radius: 18px;
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.015)),
          rgba(10, 10, 12, 0.84);
        box-shadow: var(--shadow-card);
      }
      .topbar {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1rem;
        padding: 1rem;
        margin-bottom: 1.4rem;
      }
      .topbar-title {
        margin: 0;
        color: var(--text-strong);
        font-size: 1.15rem;
        font-weight: 600;
        letter-spacing: -0.03em;
      }
      .topbar-copy {
        margin: 0.45rem 0 0;
        color: var(--text-muted);
        line-height: 1.6;
      }
      .button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.78rem 1rem;
        border: 1px solid var(--border-accent);
        border-radius: 12px;
        background: linear-gradient(180deg, rgba(104, 114, 217, 0.96), rgba(94, 106, 210, 0.9));
        color: #ffffff;
        font-size: 0.92rem;
        font-weight: 600;
      }
      .page {
        display: grid;
        gap: 1.4rem;
      }
      .title {
        margin: 0;
        font-size: clamp(1.8rem, 3vw, 2.8rem);
        font-weight: 600;
        letter-spacing: -0.035em;
      }
      .description {
        margin: 0.75rem 0 0;
        color: var(--text-muted);
        line-height: 1.6;
      }
      .metric-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
        gap: 1rem;
      }
      .metric {
        position: relative;
        padding: 1rem 1.1rem;
      }
      .metric::before {
        content: "";
        position: absolute;
        inset: 0 auto auto 0;
        width: 100%;
        height: 2px;
        background: linear-gradient(90deg, rgba(199, 210, 254, 0.9), rgba(94, 106, 210, 0.65));
      }
      .metric-label {
        color: var(--text-subtle);
        font-size: 0.72rem;
        font-weight: 600;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }
      .metric-value {
        margin-top: 0.55rem;
        font-size: 2rem;
        font-weight: 600;
        letter-spacing: -0.04em;
      }
      .metric-helper {
        margin-top: 0.45rem;
        color: var(--text-muted);
        line-height: 1.55;
      }
      .stack { display: grid; gap: 1rem; }
      .table-wrap { overflow: hidden; margin-top: 1rem; border: 1px solid rgba(255,255,255,.05); border-radius: 16px; background: rgba(255,255,255,.025); }
      .table-scroll { overflow-x: auto; }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th, td {
        padding: 0.9rem 0.75rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        text-align: left;
        vertical-align: top;
      }
      th {
        color: var(--text-subtle);
        font-size: 0.72rem;
        font-weight: 600;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }
      .subtle { color: var(--text-subtle); font-size: 0.85rem; line-height: 1.5; }
      .status {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        padding: 0.32rem 0.68rem;
        border: 1px solid rgba(255,255,255,.08);
        border-radius: 999px;
        font-size: 0.76rem;
        font-weight: 600;
        background: rgba(255,255,255,.04);
      }
      .status::before {
        content: "";
        width: 0.45rem;
        height: 0.45rem;
        border-radius: 999px;
        background: currentColor;
      }
      .success { color: var(--state-success); }
      .danger { color: var(--state-danger); }
      .info { color: var(--accent-bright); }
      .grid {
        display: grid;
        grid-template-columns: minmax(0, 1.7fr) minmax(18rem, 1fr);
        gap: 1rem;
      }
      .card-title {
        margin: 0;
        font-size: 1.15rem;
        font-weight: 600;
        letter-spacing: -0.02em;
      }
      .card-copy {
        margin: 0.75rem 0 0;
        color: var(--text-muted);
        line-height: 1.65;
      }
      .artifact-list,
      .meta-list,
      .issue-list {
        display: grid;
        gap: 0.75rem;
        margin: 1rem 0 0;
      }
      .artifact-list a {
        display: block;
        padding: 0.9rem 1rem;
        border: 1px solid rgba(255,255,255,.05);
        border-radius: 12px;
        background: rgba(255,255,255,.03);
      }
      .artifact-list a:hover { background: rgba(255,255,255,.05); }
      .meta-label {
        color: var(--text-subtle);
        font-size: 0.72rem;
        font-weight: 600;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }
      .meta-value {
        margin-top: 0.2rem;
        line-height: 1.5;
      }
      .issue-item {
        padding: 0.95rem 1rem;
        border: 1px solid rgba(255,255,255,.05);
        border-radius: 12px;
        background: rgba(255,255,255,.03);
      }
      @media (max-width: 960px) {
        .shell { grid-template-columns: 1fr; }
        .grid { grid-template-columns: 1fr; }
        .sidebar { border-right: 0; border-bottom: 1px solid var(--border-subtle); }
      }
      @media (max-width: 760px) {
        .topbar { flex-direction: column; }
        table, thead, tbody, tr, td { display: block; width: 100%; }
        thead { display: none; }
        tr { padding: 1rem; border-bottom: 1px solid rgba(255,255,255,.05); }
        tr:last-child { border-bottom: 0; }
        td { padding: 0.42rem 0; border: 0; }
      }
    </style>
  </head>
  <body>
    ${body}
  </body>
</html>`;
}

function reviewUrl(pathname: string, locale: Locale): string {
  return `${pathname}?lang=${locale === "zh-CN" ? "zh" : "en"}`;
}

function renderReviewLocaleSwitch(pathname: string, locale: Locale): string {
  return `<div style="display:flex;gap:8px;align-items:center;color:var(--text-muted);font-size:0.85rem;"><span>${locale === "zh-CN" ? "语言" : "Language"}:</span><a href="${escapeHtml(reviewUrl(pathname, "en"))}">English</a><span>/</span><a href="${escapeHtml(reviewUrl(pathname, "zh-CN"))}">简体中文</a></div>`;
}

function renderRunsReviewPage(
  runs: Awaited<ReturnType<typeof listRuns>>,
  locale: Locale
): string {
  const averageScore =
    runs.length > 0
      ? Math.round(runs.reduce((total, run) => total + (run.overallScore ?? 0), 0) / runs.length)
      : null;
  const auditCount = runs.filter((run) => run.kind === "audit").length;
  const evalCount = runs.filter((run) => run.kind === "eval").length;
  const latestRun = runs[0] ?? null;

  const rows = runs
    .map(
      (run) => `<tr>
        <td><a href="/review/runs/${encodeURIComponent(run.id)}"><code>${escapeHtml(run.id)}</code></a></td>
        <td>
          <strong>${escapeHtml(run.siteLabel)}</strong>
          <div class="subtle">${escapeHtml(run.siteInput)}</div>
        </td>
        <td>${escapeHtml(translateRunKind(run.kind, locale))}</td>
        <td>${escapeHtml(formatScore(run.overallScore, locale))}</td>
        <td><span class="status ${run.status === "completed" ? "success" : "info"}">${escapeHtml(translateStatus(run.status, locale))}</span></td>
        <td>${escapeHtml(formatDateTime(run.generatedAt, locale))}</td>
      </tr>`
    )
    .join("");

  return renderReviewShell(
    locale === "zh-CN" ? "AnswerLens Admin Review - 运行" : "AnswerLens Admin Review - Runs",
    `<div class="shell">
      <aside class="sidebar">
        <div>
          <div class="brand-label">${locale === "zh-CN" ? "内部控制台" : "Internal control console"}</div>
          <h1 class="brand-title">AnswerLens Admin Review</h1>
          <p class="brand-copy">${locale === "zh-CN" ? "围绕同一批本地 runs 与 presets 的服务端审阅面，可用于快速审核内部控制台效果。" : "A server-rendered review surface over the same local runs and presets that power the internal admin console."}</p>
        </div>
        <nav class="nav">
          <a class="active" href="${escapeHtml(reviewUrl("/review/runs", locale))}">${locale === "zh-CN" ? "运行" : "Runs"}</a>
        </nav>
        <section class="sidebar-card">
          <p class="sidebar-eyebrow">${locale === "zh-CN" ? "审阅顺序" : "Review order"}</p>
          <p class="sidebar-copy">${locale === "zh-CN" ? "先打开" : "Open"} <code>share-summary.md</code> ${locale === "zh-CN" ? "，再看" : "first, then"} <code>scorecard.md</code> ${locale === "zh-CN" ? "，最后看" : "then"} <code>recommendations.md</code>.</p>
        </section>
      </aside>
      <main class="content">
        <section class="topbar">
          <div>
            <p class="topbar-title">${locale === "zh-CN" ? "面向 AI 可发现性的 CI" : "CI for AI discoverability"}</p>
            <p class="topbar-copy">${locale === "zh-CN" ? "该页面为服务端渲染，因此即使 SPA 仍在继续硬化，你也能立刻审阅后台效果。" : "This page is server-rendered so you can review the admin effect immediately, even while the SPA line is still being hardened."}</p>
          </div>
          <div style="display:grid;gap:0.75rem;justify-items:end;">
            ${renderReviewLocaleSwitch("/review/runs", locale)}
            <a class="button" href="/runs">${locale === "zh-CN" ? "打开 SPA 路径" : "Open SPA path"}</a>
          </div>
        </section>
        <div class="page">
          <header>
            <p class="eyebrow">${locale === "zh-CN" ? "运行工作区" : "Runs workspace"}</p>
            <h1 class="title">${locale === "zh-CN" ? "查看最新的文件型运行结果" : "Review the latest file-backed runs"}</h1>
            <p class="description">${locale === "zh-CN" ? "这个审阅面直接读取真实的本地 run 工作区。你可以在更完整的 SPA 壳层完善前，先检查分数变化、最近运行和以产物为先的审阅流。" : "This review surface reads the real local run workspace. Use it to inspect score movement, recent runs, and the artifact-first flow before the richer SPA shell is finalized."}</p>
          </header>
          <section class="metric-grid">
            <div class="panel metric">
              <div class="metric-label">${locale === "zh-CN" ? "运行总数" : "Total runs"}</div>
              <div class="metric-value">${runs.length}</div>
              <div class="metric-helper">${locale === "zh-CN" ? "当前可从" : "Artifacts currently readable from"} <code>runs/*</code>${locale === "zh-CN" ? " 读取的产物。" : "."}</div>
            </div>
            <div class="panel metric">
              <div class="metric-label">${locale === "zh-CN" ? "平均分" : "Average score"}</div>
              <div class="metric-value">${escapeHtml(formatScore(averageScore, locale))}</div>
              <div class="metric-helper">${locale === "zh-CN" ? "快速感知当前本地历史结果的状态。" : "A quick pulse across the current local history."}</div>
            </div>
            <div class="panel metric">
              <div class="metric-label">${locale === "zh-CN" ? "最新运行" : "Latest run"}</div>
              <div class="metric-value">${escapeHtml(formatScore(latestRun?.overallScore ?? null, locale))}</div>
              <div class="metric-helper">${escapeHtml(latestRun?.siteLabel ?? (locale === "zh-CN" ? "还没有可用运行。" : "No run available yet."))}</div>
            </div>
            <div class="panel metric">
              <div class="metric-label">${locale === "zh-CN" ? "运行构成" : "Run mix"}</div>
              <div class="metric-value">${auditCount}:${evalCount}</div>
              <div class="metric-helper">${locale === "zh-CN" ? "本地工作区中的 audit 与 eval 数量比。" : "Audit to eval count in the local workspace."}</div>
            </div>
          </section>
          <section class="panel">
            <p class="eyebrow">${locale === "zh-CN" ? "运行表" : "Runs table"}</p>
            <h2 class="card-title">${locale === "zh-CN" ? "当前本地运行" : "Current local runs"}</h2>
            <p class="card-copy">${locale === "zh-CN" ? "每一行都会链接到更丰富的详情页，包含产物入口和主要审计发现。" : "Each row links to a richer detail view with artifact links and top audit findings."}</p>
            <div class="table-wrap">
              <div class="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>${locale === "zh-CN" ? "运行" : "Run"}</th>
                    <th>${locale === "zh-CN" ? "站点" : "Site"}</th>
                    <th>${locale === "zh-CN" ? "类型" : "Kind"}</th>
                    <th>${locale === "zh-CN" ? "分数" : "Score"}</th>
                    <th>${locale === "zh-CN" ? "状态" : "Status"}</th>
                    <th>${locale === "zh-CN" ? "生成时间" : "Generated"}</th>
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>`,
    locale
  );
}

function renderRunDetailReviewPage(
  detail: Awaited<ReturnType<typeof getRunDetail>>,
  locale: Locale
): string {
  const overallScore =
    typeof detail.manifest.summary.overallScore === "number"
      ? detail.manifest.summary.overallScore
      : typeof detail.shareSummary?.metrics.overallScore === "number"
        ? detail.shareSummary.metrics.overallScore
        : null;
  const issues = detail.auditResult?.issues.slice(0, 6) ?? [];
  const artifacts = detail.artifacts
    .map(
      (artifact) => `<a href="/api/runs/${encodeURIComponent(detail.id)}/artifacts/${encodeURIComponent(artifact.name)}" target="_blank" rel="noreferrer">
        <strong>${escapeHtml(artifact.name)}</strong>
        <div class="subtle">${escapeHtml(artifact.contentType)}</div>
      </a>`
    )
    .join("");
  const issueBlocks = issues
    .map(
      (issue) => `<article class="issue-item">
        <div><span class="status ${issue.severity === "error" ? "danger" : issue.severity === "warn" ? "info" : "info"}">${escapeHtml(issue.severity)}</span></div>
        <h3 style="margin:0.7rem 0 0.3rem;">${escapeHtml(issue.title)}</h3>
        <p class="subtle" style="margin:0;">${escapeHtml(issue.message)}</p>
        <p style="margin:0.7rem 0 0;"><strong>Fix:</strong> ${escapeHtml(issue.fixHint)}</p>
      </article>`
    )
    .join("");

  return renderReviewShell(
    locale === "zh-CN" ? `AnswerLens Admin Review - 运行 ${detail.id}` : `AnswerLens Admin Review - ${detail.id}`,
    `<div class="shell">
      <aside class="sidebar">
        <div>
          <div class="brand-label">${locale === "zh-CN" ? "内部控制台" : "Internal control console"}</div>
          <h1 class="brand-title">${locale === "zh-CN" ? "运行详情审阅" : "Run detail review"}</h1>
          <p class="brand-copy">${escapeHtml(detail.manifest.site.display ?? detail.manifest.site.input)}</p>
        </div>
        <nav class="nav">
          <a href="${escapeHtml(reviewUrl("/review/runs", locale))}">${locale === "zh-CN" ? "返回运行列表" : "Back to runs"}</a>
          <a class="active" href="${escapeHtml(reviewUrl(`/review/runs/${encodeURIComponent(detail.id)}`, locale))}">${locale === "zh-CN" ? "当前运行" : "Current run"}</a>
        </nav>
        <section class="sidebar-card">
          <p class="sidebar-eyebrow">${locale === "zh-CN" ? "产物顺序" : "Artifact order"}</p>
          <p class="sidebar-copy"><code>share-summary.md</code> → <code>scorecard.md</code> → <code>recommendations.md</code></p>
        </section>
      </aside>
      <main class="content">
        <section class="topbar">
          <div>
            <p class="topbar-title">${locale === "zh-CN" ? "运行详情" : "Run detail"}</p>
            <p class="topbar-copy">${escapeHtml(translateRunKind(detail.manifest.kind, locale))} ${locale === "zh-CN" ? "运行生成于" : "run generated"} ${escapeHtml(formatDateTime(detail.manifest.generatedAt, locale))}</p>
          </div>
          <div style="display:grid;gap:0.75rem;justify-items:end;">
            ${renderReviewLocaleSwitch(`/review/runs/${encodeURIComponent(detail.id)}`, locale)}
            <a class="button" href="/api/runs/${encodeURIComponent(detail.id)}">${locale === "zh-CN" ? "打开 JSON 详情" : "Open JSON detail"}</a>
          </div>
        </section>
        <div class="page">
          <header>
            <p class="eyebrow">${locale === "zh-CN" ? "产物工作区" : "Artifact workspace"}</p>
            <h1 class="title">${escapeHtml(detail.manifest.site.display ?? detail.manifest.site.input)}</h1>
            <p class="description">${locale === "zh-CN" ? "这个视图由与 admin console 相同的 run 契约驱动。它会突出显示分数、上下文、产物打开顺序，以及来自" : "This view is driven by the same run contract as the admin console. It highlights score, context, the artifact opening order, and the top audit issues from "} <code>site-audit.json</code>${locale === "zh-CN" ? " 的主要审计问题。" : "."}</p>
          </header>
          <section class="metric-grid">
            <div class="panel metric">
              <div class="metric-label">${locale === "zh-CN" ? "总分" : "Overall score"}</div>
              <div class="metric-value">${escapeHtml(formatScore(overallScore, locale))}</div>
              <div class="metric-helper">${locale === "zh-CN" ? "这次运行的主准备度分数。" : "Primary readiness score for this run."}</div>
            </div>
            <div class="panel metric">
              <div class="metric-label">${locale === "zh-CN" ? "产物数" : "Artifacts"}</div>
              <div class="metric-value">${detail.artifacts.length}</div>
              <div class="metric-helper">${locale === "zh-CN" ? "Markdown、HTML 和 JSON 输出。" : "Markdown, HTML, and JSON outputs."}</div>
            </div>
            <div class="panel metric">
              <div class="metric-label">${locale === "zh-CN" ? "运行 ID" : "Run id"}</div>
              <div class="metric-value" style="font-size:1.15rem">${escapeHtml(detail.manifest.run.id)}</div>
              <div class="metric-helper">${locale === "zh-CN" ? "这次运行可复现的契约锚点。" : "The reproducible contract anchor for this run."}</div>
            </div>
          </section>
          <div class="grid">
            <section class="panel">
              <p class="eyebrow">${locale === "zh-CN" ? "产物" : "Artifacts"}</p>
              <h2 class="card-title">${locale === "zh-CN" ? "按顺序打开报告链路" : "Open the report trail"}</h2>
              <p class="card-copy">${locale === "zh-CN" ? "先看三份核心审阅产物，再去查看原始 JSON 或 HTML 报告。" : "Start with the three primary review artifacts, then inspect raw JSON or the HTML report."}</p>
              <div class="artifact-list">${artifacts}</div>
            </section>
            <section class="panel">
              <p class="eyebrow">${locale === "zh-CN" ? "上下文" : "Context"}</p>
              <h2 class="card-title">${locale === "zh-CN" ? "运行清单" : "Run manifest"}</h2>
              <div class="meta-list">
                <div><div class="meta-label">${locale === "zh-CN" ? "站点输入" : "Site input"}</div><div class="meta-value">${escapeHtml(detail.manifest.site.input)}</div></div>
                <div><div class="meta-label">${locale === "zh-CN" ? "基础 URL" : "Base URL"}</div><div class="meta-value">${escapeHtml(detail.manifest.site.baseUrl)}</div></div>
                <div><div class="meta-label">${locale === "zh-CN" ? "产物版本" : "Artifact version"}</div><div class="meta-value">${escapeHtml(detail.manifest.run.artifactVersion)}</div></div>
                <div><div class="meta-label">${locale === "zh-CN" ? "规则版本" : "Rule version"}</div><div class="meta-value">${escapeHtml(detail.manifest.run.ruleVersion)}</div></div>
              </div>
            </section>
          </div>
          <section class="panel">
            <p class="eyebrow">${locale === "zh-CN" ? "主要问题" : "Top issues"}</p>
            <h2 class="card-title">${locale === "zh-CN" ? "审计发现" : "Audit findings"}</h2>
            <p class="card-copy">${locale === "zh-CN" ? "从" : "A quick slice from "} <code>site-audit.json</code> ${locale === "zh-CN" ? "中抽出最值得先看的部分，让你无需先打开原始产物也能理解这轮效果。" : "so you can review the effect immediately without opening raw artifacts first."}</p>
            <div class="issue-list">${issueBlocks || `<p class="subtle">${locale === "zh-CN" ? "这轮运行当前没有问题。" : "No current issues in this run."}</p>`}</div>
          </section>
        </div>
      </main>
    </div>`,
    locale
  );
}

export function createServer(): express.Express {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_request, response) => {
    response.json({ ok: true, service: "answerlens-admin-bff" });
  });

  app.get("/api/config-presets", async (_request, response, next) => {
    try {
      response.json({ presets: await listConfigPresets() });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/runs", async (_request, response, next) => {
    try {
      response.json({ runs: await listRuns() });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/runs/:runId", async (request, response, next) => {
    try {
      response.json(await getRunDetail(request.params.runId));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/runs/:runId/artifacts/:artifactName", async (request, response, next) => {
    try {
      const { entry, content } = await readRunArtifact(request.params.runId, request.params.artifactName);
      const rawType = isArtifactPayload(entry.name);
      if (rawType === "markdown") {
        response.type("text/markdown; charset=utf-8");
      } else if (rawType === "json") {
        response.type("application/json; charset=utf-8");
      } else if (rawType === "html") {
        response.type("text/html; charset=utf-8");
      } else {
        response.type("text/plain; charset=utf-8");
      }
      response.send(content);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/jobs/:jobId", (request, response) => {
    const job = getRunJob(request.params.jobId);
    if (!job) {
      response.status(404).json({ message: `Unknown job ${request.params.jobId}` });
      return;
    }
    response.json(job);
  });

  app.post("/api/runs/audit", async (request, response, next) => {
    try {
      const payload = request.body as CreateAuditRunInput;
      response.status(202).json(await createAuditRun(payload));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/runs/eval", async (request, response, next) => {
    try {
      const payload = request.body as CreateEvalRunInput;
      response.status(202).json(await createEvalRun(payload));
    } catch (error) {
      next(error);
    }
  });

  app.get("/review", (request, response) => {
    const locale = resolveReviewLocale(request);
    response.redirect(reviewUrl("/review/runs", locale));
  });

  app.get("/review/runs", async (request, response, next) => {
    try {
      const locale = resolveReviewLocale(request);
      response.setHeader("Set-Cookie", setLocaleCookieHeader(locale));
      response.type("text/html; charset=utf-8");
      response.send(renderRunsReviewPage(await listRuns(), locale));
    } catch (error) {
      next(error);
    }
  });

  app.get("/review/runs/:runId", async (request, response, next) => {
    try {
      const locale = resolveReviewLocale(request);
      response.setHeader("Set-Cookie", setLocaleCookieHeader(locale));
      response.type("text/html; charset=utf-8");
      response.send(renderRunDetailReviewPage(await getRunDetail(request.params.runId), locale));
    } catch (error) {
      next(error);
    }
  });

  if (process.env.NODE_ENV !== "development") {
    app.use(express.static(clientDistDir));
    app.get("*", (_request, response) => {
      response.sendFile(path.join(clientDistDir, "index.html"));
    });
  }

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    const message = error instanceof Error ? error.message : "Unknown server error";
    response.status(500).json({ message });
  });

  return app;
}

if (process.argv[1] && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1])) {
  const app = createServer();
  app.listen(port, "127.0.0.1", () => {
    console.log(`AnswerLens admin BFF listening on http://127.0.0.1:${port}`);
  });
}
