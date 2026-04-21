import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
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

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatScore(value: number | null): string {
  return value === null ? "Pending" : `${value}/100`;
}

function renderReviewShell(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root {
        color-scheme: dark;
        --canvas: #090014;
        --shell: rgba(9, 7, 24, 0.96);
        --surface: rgba(18, 16, 46, 0.92);
        --surface-elevated: rgba(24, 18, 56, 0.94);
        --text-strong: #eef3ff;
        --text-muted: rgba(214, 221, 242, 0.78);
        --text-subtle: rgba(180, 188, 210, 0.58);
        --accent-magenta: #ff00ff;
        --accent-cyan: #00ffff;
        --accent-orange: #ff9900;
        --state-success: #6fffd2;
        --state-danger: #ff688b;
        --border-subtle: rgba(45, 27, 78, 1);
        --glow-sm: 0 0 1.4rem rgba(0, 255, 255, 0.08);
      }

      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: Inter, system-ui, sans-serif;
        background:
          radial-gradient(circle at 78% 18%, rgba(0, 255, 255, 0.15), transparent 18rem),
          radial-gradient(circle at 18% 82%, rgba(255, 0, 255, 0.12), transparent 18rem),
          linear-gradient(180deg, rgba(255, 153, 0, 0.08), transparent 18rem),
          var(--canvas);
        color: var(--text-strong);
      }
      body::before {
        content: "";
        position: fixed;
        inset: 0;
        pointer-events: none;
        opacity: 0.12;
        background-image:
          linear-gradient(rgba(255, 0, 255, 0.16) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0, 255, 255, 0.16) 1px, transparent 1px);
        background-size: 36px 36px;
      }
      a { color: var(--accent-cyan); text-decoration: none; }
      a:hover { text-decoration: underline; }
      code { font-family: "Share Tech Mono", monospace; }
      .shell {
        display: grid;
        grid-template-columns: 18rem minmax(0, 1fr);
        min-height: 100vh;
      }
      .sidebar {
        padding: 2rem 1.5rem;
        border-right: 1px solid rgba(0, 255, 255, 0.12);
        background: linear-gradient(180deg, rgba(13, 9, 34, 0.96), rgba(8, 7, 22, 0.96));
      }
      .brand-label {
        color: var(--accent-magenta);
        font-size: 0.78rem;
        letter-spacing: 0.18em;
        text-transform: uppercase;
      }
      .brand-title {
        margin: 0.7rem 0 0;
        font-size: 2.2rem;
        line-height: 0.95;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .brand-copy,
      .sidebar-copy {
        color: var(--text-muted);
        line-height: 1.6;
      }
      .nav {
        display: grid;
        gap: 0.6rem;
        margin-top: 1.5rem;
      }
      .nav a {
        display: block;
        padding: 0.9rem 1rem;
        border: 1px solid var(--border-subtle);
        background: rgba(11, 10, 28, 0.72);
        font-family: "Share Tech Mono", monospace;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .nav a.active {
        border-color: rgba(0, 255, 255, 0.7);
        box-shadow: var(--glow-sm);
      }
      .sidebar-card {
        margin-top: 1rem;
        padding: 1rem;
        border: 1px solid rgba(255, 0, 255, 0.16);
        background: rgba(16, 14, 40, 0.9);
      }
      .sidebar-eyebrow,
      .eyebrow {
        margin: 0 0 0.5rem;
        color: var(--accent-cyan);
        font-size: 0.75rem;
        letter-spacing: 0.16em;
        text-transform: uppercase;
      }
      .content {
        padding: 1.5rem clamp(1rem, 3vw, 2.4rem) 2rem;
      }
      .topbar,
      .panel {
        border: 1px solid rgba(0, 255, 255, 0.14);
        background: linear-gradient(180deg, rgba(18, 16, 46, 0.92), rgba(11, 10, 28, 0.94));
        box-shadow: var(--glow-sm);
      }
      .topbar {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        padding: 1rem;
        margin-bottom: 1.4rem;
      }
      .topbar-title {
        margin: 0;
        color: var(--accent-orange);
        font-size: 0.8rem;
        letter-spacing: 0.18em;
        text-transform: uppercase;
      }
      .topbar-copy {
        margin: 0.45rem 0 0;
        color: var(--text-muted);
        line-height: 1.55;
      }
      .button {
        display: inline-block;
        padding: 0.78rem 1rem;
        border: 1px solid var(--accent-cyan);
        background: rgba(0, 255, 255, 0.08);
        color: var(--accent-cyan);
        font-family: "Share Tech Mono", monospace;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }
      .page {
        display: grid;
        gap: 1.4rem;
      }
      .title {
        margin: 0;
        font-size: clamp(1.8rem, 3vw, 2.8rem);
        text-transform: uppercase;
        letter-spacing: 0.05em;
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
        height: 3px;
        background: linear-gradient(90deg, #ff00ff, #00ffff);
      }
      .metric-label {
        color: var(--text-muted);
        font-size: 0.76rem;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }
      .metric-value {
        margin-top: 0.55rem;
        font-size: 2rem;
        font-weight: 700;
      }
      .metric-helper {
        margin-top: 0.45rem;
        color: var(--text-subtle);
        line-height: 1.5;
      }
      .stack { display: grid; gap: 1rem; }
      .table-wrap { overflow-x: auto; }
      table {
        width: 100%;
        border-collapse: collapse;
        min-width: 48rem;
      }
      th, td {
        padding: 0.9rem 0.75rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        text-align: left;
        vertical-align: top;
      }
      th {
        color: var(--text-muted);
        font-size: 0.75rem;
        letter-spacing: 0.16em;
        text-transform: uppercase;
      }
      .subtle { color: var(--text-subtle); font-size: 0.85rem; line-height: 1.5; }
      .status {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        padding: 0.32rem 0.68rem;
        border: 1px solid currentColor;
        font-size: 0.72rem;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        background: rgba(6, 5, 22, 0.68);
      }
      .status::before {
        content: "";
        width: 0.55rem;
        height: 0.55rem;
        border-radius: 999px;
        background: currentColor;
      }
      .success { color: var(--state-success); }
      .danger { color: var(--state-danger); }
      .info { color: var(--accent-cyan); }
      .grid {
        display: grid;
        grid-template-columns: minmax(0, 2fr) minmax(18rem, 1fr);
        gap: 1rem;
      }
      .card-title {
        margin: 0;
        font-size: 1.15rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
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
        padding: 0.8rem 0.9rem;
        border: 1px solid rgba(45, 27, 78, 1);
        background: rgba(10, 9, 26, 0.72);
      }
      .meta-label {
        color: var(--text-muted);
        font-size: 0.74rem;
        letter-spacing: 0.15em;
        text-transform: uppercase;
      }
      .meta-value {
        margin-top: 0.2rem;
        line-height: 1.5;
      }
      .issue-item {
        padding: 0.9rem;
        border: 1px solid rgba(255, 0, 255, 0.14);
        background: rgba(9, 8, 24, 0.76);
      }
      @media (max-width: 960px) {
        .shell { grid-template-columns: 1fr; }
        .grid { grid-template-columns: 1fr; }
        .sidebar { border-right: 0; border-bottom: 1px solid rgba(0, 255, 255, 0.12); }
      }
    </style>
  </head>
  <body>
    ${body}
  </body>
</html>`;
}

function renderRunsReviewPage(
  runs: Awaited<ReturnType<typeof listRuns>>
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
        <td>${escapeHtml(run.kind)}</td>
        <td>${escapeHtml(formatScore(run.overallScore))}</td>
        <td><span class="status ${run.status === "completed" ? "success" : "info"}">${escapeHtml(run.status)}</span></td>
        <td>${escapeHtml(formatDateTime(run.generatedAt))}</td>
      </tr>`
    )
    .join("");

  return renderReviewShell(
    "AnswerLens Admin Review - Runs",
    `<div class="shell">
      <aside class="sidebar">
        <div>
          <div class="brand-label">Internal control console</div>
          <h1 class="brand-title">AnswerLens Admin Review</h1>
          <p class="brand-copy">A server-rendered review surface over the same local runs and presets that power the internal admin console.</p>
        </div>
        <nav class="nav">
          <a class="active" href="/review/runs">Runs</a>
        </nav>
        <section class="sidebar-card">
          <p class="sidebar-eyebrow">Review order</p>
          <p class="sidebar-copy">Open <code>share-summary.md</code> first, then <code>scorecard.md</code>, then <code>recommendations.md</code>.</p>
        </section>
      </aside>
      <main class="content">
        <section class="topbar">
          <div>
            <p class="topbar-title">CI for AI discoverability</p>
            <p class="topbar-copy">This page is server-rendered so you can review the admin effect immediately, even while the SPA line is still being hardened.</p>
          </div>
          <a class="button" href="/runs">Open SPA path</a>
        </section>
        <div class="page">
          <header>
            <p class="eyebrow">Runs workspace</p>
            <h1 class="title">Review the latest file-backed runs</h1>
            <p class="description">This review surface reads the real local run workspace. Use it to inspect score movement, recent runs, and the artifact-first flow before the richer SPA shell is finalized.</p>
          </header>
          <section class="metric-grid">
            <div class="panel metric">
              <div class="metric-label">Total runs</div>
              <div class="metric-value">${runs.length}</div>
              <div class="metric-helper">Artifacts currently readable from <code>runs/*</code>.</div>
            </div>
            <div class="panel metric">
              <div class="metric-label">Average score</div>
              <div class="metric-value">${escapeHtml(formatScore(averageScore))}</div>
              <div class="metric-helper">A quick pulse across the current local history.</div>
            </div>
            <div class="panel metric">
              <div class="metric-label">Latest run</div>
              <div class="metric-value">${escapeHtml(formatScore(latestRun?.overallScore ?? null))}</div>
              <div class="metric-helper">${escapeHtml(latestRun?.siteLabel ?? "No run available yet.")}</div>
            </div>
            <div class="panel metric">
              <div class="metric-label">Run mix</div>
              <div class="metric-value">${auditCount}:${evalCount}</div>
              <div class="metric-helper">Audit to eval count in the local workspace.</div>
            </div>
          </section>
          <section class="panel">
            <p class="eyebrow">Runs table</p>
            <h2 class="card-title">Current local runs</h2>
            <p class="card-copy">Each row links to a richer detail view with artifact links and top audit findings.</p>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Run</th>
                    <th>Site</th>
                    <th>Kind</th>
                    <th>Score</th>
                    <th>Status</th>
                    <th>Generated</th>
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
    </div>`
  );
}

function renderRunDetailReviewPage(
  detail: Awaited<ReturnType<typeof getRunDetail>>
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
    `AnswerLens Admin Review - ${detail.id}`,
    `<div class="shell">
      <aside class="sidebar">
        <div>
          <div class="brand-label">Internal control console</div>
          <h1 class="brand-title">Run detail review</h1>
          <p class="brand-copy">${escapeHtml(detail.manifest.site.display ?? detail.manifest.site.input)}</p>
        </div>
        <nav class="nav">
          <a href="/review/runs">Back to runs</a>
          <a class="active" href="/review/runs/${encodeURIComponent(detail.id)}">Current run</a>
        </nav>
        <section class="sidebar-card">
          <p class="sidebar-eyebrow">Artifact order</p>
          <p class="sidebar-copy"><code>share-summary.md</code> → <code>scorecard.md</code> → <code>recommendations.md</code></p>
        </section>
      </aside>
      <main class="content">
        <section class="topbar">
          <div>
            <p class="topbar-title">Run detail</p>
            <p class="topbar-copy">${escapeHtml(detail.manifest.kind)} run generated ${escapeHtml(formatDateTime(detail.manifest.generatedAt))}</p>
          </div>
          <a class="button" href="/api/runs/${encodeURIComponent(detail.id)}">Open JSON detail</a>
        </section>
        <div class="page">
          <header>
            <p class="eyebrow">Artifact workspace</p>
            <h1 class="title">${escapeHtml(detail.manifest.site.display ?? detail.manifest.site.input)}</h1>
            <p class="description">This view is driven by the same run contract as the admin console. It highlights score, context, the artifact opening order, and the top audit issues from <code>site-audit.json</code>.</p>
          </header>
          <section class="metric-grid">
            <div class="panel metric">
              <div class="metric-label">Overall score</div>
              <div class="metric-value">${escapeHtml(formatScore(overallScore))}</div>
              <div class="metric-helper">Primary readiness score for this run.</div>
            </div>
            <div class="panel metric">
              <div class="metric-label">Artifacts</div>
              <div class="metric-value">${detail.artifacts.length}</div>
              <div class="metric-helper">Markdown, HTML, and JSON outputs.</div>
            </div>
            <div class="panel metric">
              <div class="metric-label">Run id</div>
              <div class="metric-value" style="font-size:1.15rem">${escapeHtml(detail.manifest.run.id)}</div>
              <div class="metric-helper">The reproducible contract anchor for this run.</div>
            </div>
          </section>
          <div class="grid">
            <section class="panel">
              <p class="eyebrow">Artifacts</p>
              <h2 class="card-title">Open the report trail</h2>
              <p class="card-copy">Start with the three primary review artifacts, then inspect raw JSON or the HTML report.</p>
              <div class="artifact-list">${artifacts}</div>
            </section>
            <section class="panel">
              <p class="eyebrow">Context</p>
              <h2 class="card-title">Run manifest</h2>
              <div class="meta-list">
                <div><div class="meta-label">Site input</div><div class="meta-value">${escapeHtml(detail.manifest.site.input)}</div></div>
                <div><div class="meta-label">Base URL</div><div class="meta-value">${escapeHtml(detail.manifest.site.baseUrl)}</div></div>
                <div><div class="meta-label">Artifact version</div><div class="meta-value">${escapeHtml(detail.manifest.run.artifactVersion)}</div></div>
                <div><div class="meta-label">Rule version</div><div class="meta-value">${escapeHtml(detail.manifest.run.ruleVersion)}</div></div>
              </div>
            </section>
          </div>
          <section class="panel">
            <p class="eyebrow">Top issues</p>
            <h2 class="card-title">Audit findings</h2>
            <p class="card-copy">A quick slice from <code>site-audit.json</code> so you can review the effect immediately without opening raw artifacts first.</p>
            <div class="issue-list">${issueBlocks || `<p class="subtle">No current issues in this run.</p>`}</div>
          </section>
        </div>
      </main>
    </div>`
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

  app.get("/review", (_request, response) => {
    response.redirect("/review/runs");
  });

  app.get("/review/runs", async (_request, response, next) => {
    try {
      response.type("text/html; charset=utf-8");
      response.send(renderRunsReviewPage(await listRuns()));
    } catch (error) {
      next(error);
    }
  });

  app.get("/review/runs/:runId", async (request, response, next) => {
    try {
      response.type("text/html; charset=utf-8");
      response.send(renderRunDetailReviewPage(await getRunDetail(request.params.runId)));
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
