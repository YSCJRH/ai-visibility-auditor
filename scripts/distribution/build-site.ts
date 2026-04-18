import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
  filePath: string;
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

function renderLayout(siteUrl: string, page: PageSpec, updatedAt: string): string {
  const canonical = new URL(page.route, siteUrl).href;
  const ogImage = new URL("assets/social-preview.png", siteUrl).href;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(page.title)} | AnswerLens</title>
    <meta name="description" content="${escapeHtml(page.description)}" />
    <link rel="canonical" href="${escapeHtml(canonical)}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapeHtml(page.title)} | AnswerLens" />
    <meta property="og:description" content="${escapeHtml(page.description)}" />
    <meta property="og:url" content="${escapeHtml(canonical)}" />
    <meta property="og:image" content="${escapeHtml(ogImage)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(page.title)} | AnswerLens" />
    <meta name="twitter:description" content="${escapeHtml(page.description)}" />
    <meta name="twitter:image" content="${escapeHtml(ogImage)}" />
    <meta name="last-modified" content="${escapeHtml(updatedAt)}" />
    <style>
      :root{color-scheme:dark;--bg:#081225;--panel:rgba(16,28,52,.9);--line:rgba(120,168,255,.2);--ink:#eef5ff;--muted:#adc3de;--accent:#7df0d2}
      *{box-sizing:border-box}body{margin:0;font-family:"Segoe UI",system-ui,sans-serif;background:radial-gradient(circle at top left,rgba(96,120,255,.16),transparent 24%),radial-gradient(circle at bottom right,rgba(125,240,210,.14),transparent 20%),linear-gradient(180deg,#0b1630 0%,var(--bg) 100%);color:var(--ink)}
      a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}.shell{width:min(1180px,calc(100vw - 32px));margin:0 auto;padding:24px 0 56px}.topbar,.hero,.panel,.metric{border:1px solid var(--line);border-radius:22px;background:var(--panel);box-shadow:0 20px 40px rgba(2,8,18,.35)}
      .topbar{display:flex;gap:16px;justify-content:space-between;align-items:center;padding:16px 20px}.nav{display:flex;gap:12px;flex-wrap:wrap}.nav a{padding:10px 14px;border-radius:999px;border:1px solid var(--line)}
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
          <p class="muted">${escapeHtml(DESCRIPTION)} ${escapeHtml(TAGLINE)}</p>
        </div>
        <nav class="nav">
          <a href="${escapeHtml(new URL("", siteUrl).href)}">Home</a>
          <a href="${escapeHtml(new URL("docs/", siteUrl).href)}">Docs</a>
          <a href="${escapeHtml(new URL("releases/", siteUrl).href)}">Releases</a>
          <a href="${escapeHtml(new URL("examples/", siteUrl).href)}">Examples</a>
          <a href="${escapeHtml(new URL("playbooks/", siteUrl).href)}">Playbooks</a>
          <a href="${escapeHtml(REPO_URL)}">GitHub</a>
        </nav>
      </header>
      ${page.body}
      <p class="footer">Built from repo-native docs, releases, and artifacts. No consumer AI UI scraping. No ranking promises.</p>
    </div>
  </body>
</html>`;
}

export async function buildSite(options: BuildSiteOptions = {}): Promise<void> {
  const repository = options.repository ?? process.env.GITHUB_REPOSITORY ?? DEFAULT_REPOSITORY;
  const siteUrl = withTrailingSlash(options.siteUrl ?? process.env.ANSWERLENS_SITE_URL ?? defaultSiteUrl(repository));
  const outDir = path.resolve(options.outDir ?? "dist/site");
  const demoRunDir = path.resolve(options.demoRunDir ?? "runs/static-good");
  const releasesPath = path.resolve(options.releasesPath ?? "scripts/distribution/releases-snapshot.json");

  const [shareSummary, runManifest, shareSummaryMarkdown, recommendationsMarkdown, exampleMarkdown, releases] = await Promise.all([
    readJson<ShareSummary>(path.join(demoRunDir, "share-summary.json")),
    readJson<RunManifest>(path.join(demoRunDir, "run.json")),
    readFile(path.join(demoRunDir, "share-summary.md"), "utf8"),
    readFile(path.join(demoRunDir, "recommendations.md"), "utf8"),
    readFile(path.resolve("examples/shareable-summary.md"), "utf8"),
    readJson<ReleaseEntry[]>(releasesPath)
  ]);

  const updatedAt = formatDate(releases[0]?.published_at, shareSummary.run.generatedAt);

  await mkdir(path.join(outDir, "docs"), { recursive: true });
  await mkdir(path.join(outDir, "releases"), { recursive: true });
  await mkdir(path.join(outDir, "examples"), { recursive: true });
  await mkdir(path.join(outDir, "playbooks"), { recursive: true });
  await cp(path.resolve("assets"), path.join(outDir, "assets"), { recursive: true, force: true });
  await cp(demoRunDir, path.join(outDir, "examples", "static-good"), { recursive: true, force: true });

  const docsCards = [
    ["docs/activation-plan.md", "Activation plan", "Current operating focus for public entry points and adoption."],
    ["docs/github-growth-plan.md", "Growth plan", "GitHub-native packaging, funnel, and community strategy."],
    ["docs/self-dogfooding.md", "Self-dogfooding", "How AnswerLens uses its own audit mindset on public source-material surfaces."],
    ["docs/quickstart.md", "Quickstart", "Run one real-site audit before you wire CI."],
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

  const pages: PageSpec[] = [
    {
      route: "",
      filePath: path.join(outDir, "index.html"),
      title: "Home",
      description: `${DESCRIPTION} ${TAGLINE}`,
      body: `<section class="hero"><p class="eyebrow">${escapeHtml(TAGLINE)}</p><h1>Artifact-first distribution for AI discoverability.</h1><p>${escapeHtml(DESCRIPTION)} It turns audits into share summaries, PR-ready snippets, static reports, release assets, and indexable pages without falling back to dashboard-only workflows.</p></section>
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
          ${renderPanel("Recommended first-run path", "Activation funnel", `<p><a href="${escapeHtml(new URL("examples/static-good/index.html", siteUrl).href)}">Open the live demo report</a> is the primary entry point.</p><p>Then continue with <a href="${escapeHtml(REPO_URL)}#run-the-60-second-fixture-demo">Run the 60-second fixture demo</a> or <a href="${escapeHtml(repoBlob("docs/github-action.md"))}">Add the GitHub Action</a>.</p><p>After the fixture run, bridge into real adoption with <a href="${escapeHtml(repoBlob("docs/quickstart.md"))}">Run a 5-minute real-site audit</a> before wiring CI. Use <a href="${escapeHtml(new URL("releases/", siteUrl).href)}">the latest release</a> as the second public front door.</p><p>At every step, start with <code>share-summary.md</code>, then <code>scorecard.md</code>, then <code>recommendations.md</code>.</p>`)}
          ${renderPanel("Public proof block", "Artifact proof", `${renderSiteIdentity(shareSummary.site)}${firstIssue ? `<p><strong>Top issue:</strong> ${escapeHtml(firstIssue.title)} (${escapeHtml(firstIssue.severity)}) - ${escapeHtml(firstIssue.fixHint)}</p>` : "<p><strong>Top issue:</strong> none</p>"}${firstFix ? `<p><strong>Top fix:</strong> ${escapeHtml(firstFix.title)} - ${escapeHtml(firstFix.expectedOutcome)}</p>` : "<p><strong>Top fix:</strong> none</p>"}<p>Open artifacts in order: <code>share-summary.md</code>, then <code>scorecard.md</code>, then <code>recommendations.md</code>.</p><ul>${publicArtifactLinks}</ul>`)}
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
      title: "Docs",
      description: "Canonical docs, concepts, scoring notes, and distribution plan for AnswerLens.",
      body: `<section class="hero"><p class="eyebrow">Canonical documentation</p><h1>Docs stay in Markdown. Pages compiles the indexable layer.</h1><p>AnswerLens keeps repo docs as the authoring surface and compiles this page to make them easier for search engines, AI systems, and external teams to discover.</p></section><section class="section grid">${docsCards}</section>`,
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
      title: "Releases",
      description: "Release index, version notes, and distribution surfaces compiled from GitHub metadata.",
      body: `<section class="hero"><p class="eyebrow">Versioned distribution</p><h1>Release notes should work like a second front door, not a changelog graveyard.</h1><p>This page is compiled from release metadata so the public version line stays machine-readable, easy to index, and useful for first-run visitors.</p></section>
        <section class="section grid">
          ${renderPanel("Use the latest release", "Start here", `<ul>${renderList([
            `<a href="${escapeHtml(new URL("examples/static-good/index.html", siteUrl).href)}">Open the live demo report</a>`,
            `<a href="${escapeHtml(repoBlob("docs/quickstart.md"))}">Run a 5-minute real-site audit</a>`,
            `<a href="${escapeHtml(repoBlob("docs/github-action.md"))}">Add the GitHub Action</a>`,
            releases[0]?.html_url ? `<a href="${escapeHtml(releases[0].html_url)}">Download the latest release assets</a>` : "Download the latest release assets"
          ])}</ul><p>Review artifacts in the same order each time: <code>share-summary.md</code>, <code>scorecard.md</code>, then <code>recommendations.md</code>.</p>`)}
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
      title: "Examples",
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
      route: "playbooks/",
      filePath: path.join(outDir, "playbooks", "index.html"),
      title: "Playbooks",
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

  for (const page of pages) {
    await writeFile(page.filePath, renderLayout(siteUrl, page, updatedAt), "utf8");
  }

  const sitemap = pages
    .map((page) => `<url><loc>${escapeHtml(new URL(page.route, siteUrl).href)}</loc><lastmod>${escapeHtml(updatedAt)}</lastmod></url>`)
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
