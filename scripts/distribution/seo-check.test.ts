import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runSeoCheck } from "./seo-check.ts";

const SITE_URL = "https://example.github.io/ai-visibility-auditor/";
const VERSION = "v9.9.9";

type PageArgs = {
  canonical: string;
  alternates: Record<"en" | "zh-CN" | "x-default", string>;
  h1: string;
  body?: string;
  jsonLd: unknown[];
};

test("seo-check passes a canonical bilingual Pages surface", async () => {
  const root = await createSeoFixture();
  const findings = await runSeoCheck({
    siteDir: root.siteDir,
    siteUrl: SITE_URL,
    releasesPath: root.releasesPath,
    reportDir: root.reportDir
  });

  assert.deepEqual(findings, []);
});

test("seo-check rejects drifted x-default, JSON-LD URLs, breadcrumbs, and sitemap duplicates", async () => {
  const root = await createSeoFixture();
  const starterPath = path.join(root.siteDir, "en", "starter", "index.html");
  const starter = await readFile(starterPath, "utf8");
  await writeFile(
    starterPath,
    starter
      .replace(`${SITE_URL}starter/`, `${SITE_URL}en/starter/`)
      .replace(`${SITE_URL}en/starter/","description"`, `${SITE_URL}starter/","description"`)
      .replace(`"item":"${SITE_URL}en/"`, `"item":"${SITE_URL}en/starter/"`),
    "utf8"
  );
  await writeFile(
    path.join(root.siteDir, "sitemap.xml"),
    sitemap([SITE_URL, `${SITE_URL}en/`, `${SITE_URL}zh/`, `${SITE_URL}en/starter/`, `${SITE_URL}en/starter/`, `${SITE_URL}zh/starter/`]),
    "utf8"
  );

  const findings = await runSeoCheck({
    siteDir: root.siteDir,
    siteUrl: SITE_URL,
    releasesPath: root.releasesPath,
    reportDir: root.reportDir
  });

  const ruleIds = findings.map((finding) => finding.ruleId);
  assert.ok(ruleIds.includes("hreflang-x-default-neutral"));
  assert.ok(ruleIds.includes("jsonld-url-canonical"));
  assert.ok(ruleIds.includes("jsonld-breadcrumb-home"));
  assert.ok(ruleIds.includes("sitemap-duplicate-url"));
});

test("seo-check rejects incomplete release metadata", async () => {
  const root = await createSeoFixture();
  await writeFile(
    root.releasesPath,
    `${JSON.stringify(
      [
        {
          tag_name: VERSION,
          html_url: `https://github.com/example/project/releases/tag/${VERSION}`,
          published_at: "2026-06-17T12:38:46Z"
        }
      ],
      null,
      2
    )}\n`,
    "utf8"
  );

  const findings = await runSeoCheck({
    siteDir: root.siteDir,
    siteUrl: SITE_URL,
    releasesPath: root.releasesPath,
    reportDir: root.reportDir
  });

  const ruleIds = findings.map((finding) => finding.ruleId);
  assert.ok(ruleIds.includes("release-metadata-count"));
  assert.ok(ruleIds.includes("release-metadata-stable-count"));
});

test("seo-check rejects invalid and unsorted release metadata", async () => {
  const root = await createSeoFixture();
  await writeFile(
    root.releasesPath,
    `${JSON.stringify(
      [
        {
          tag_name: VERSION,
          html_url: `https://github.com/example/project/releases/tag/${VERSION}`,
          published_at: "2026-06-10T00:00:00Z"
        },
        {
          tag_name: "v9.9.8",
          html_url: "not-a-url",
          published_at: "2026-06-18T00:00:00Z"
        },
        {
          tag_name: "v9.9.7",
          html_url: "https://github.com/example/project/releases/tag/v9.9.7",
          published_at: "not-a-date"
        }
      ],
      null,
      2
    )}\n`,
    "utf8"
  );

  const findings = await runSeoCheck({
    siteDir: root.siteDir,
    siteUrl: SITE_URL,
    releasesPath: root.releasesPath,
    reportDir: root.reportDir
  });

  const ruleIds = findings.map((finding) => finding.ruleId);
  assert.ok(ruleIds.includes("release-metadata-order"));
  assert.ok(ruleIds.includes("release-metadata-url"));
  assert.ok(ruleIds.includes("release-metadata-date"));
});

test("seo-check rejects release pages with drifted latest CTA and asset checklist", async () => {
  const root = await createSeoFixture();
  await writePage(
    root.siteDir,
    "en/releases/index.html",
    page({
      canonical: `${SITE_URL}en/releases/`,
      alternates: {
        en: `${SITE_URL}en/releases/`,
        "zh-CN": `${SITE_URL}zh/releases/`,
        "x-default": `${SITE_URL}releases/`
      },
      h1: "Releases",
      body: `<p><a href="https://github.com/example/project/releases/tag/v9.9.8">Open an older release</a></p><p>Open recommendations.md, then scorecard.md, then share-summary.md.</p>`,
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Releases",
          url: `${SITE_URL}en/releases/`,
          description: "Release page."
        },
        breadcrumb(`${SITE_URL}en/`, `${SITE_URL}en/releases/`)
      ]
    })
  );

  const findings = await runSeoCheck({
    siteDir: root.siteDir,
    siteUrl: SITE_URL,
    releasesPath: root.releasesPath,
    reportDir: root.reportDir
  });

  const ruleIds = findings.map((finding) => finding.ruleId);
  assert.ok(ruleIds.includes("release-page-latest-link"));
  assert.ok(ruleIds.includes("release-page-latest-tag"));
  assert.ok(ruleIds.includes("release-page-asset-checklist"));
  assert.ok(ruleIds.includes("release-page-npm-boundary"));
  assert.ok(ruleIds.includes("release-page-artifact-order"));
});

test("seo-check rejects release pages without the smoke summary review path", async () => {
  const root = await createSeoFixture();
  const releasePath = path.join(root.siteDir, "en", "releases", "index.html");
  const releasePage = await readFile(releasePath, "utf8");
  await writeFile(
    releasePath,
    releasePage
      .replaceAll("release-assets-summary.md", "release-assets-summary-omitted.md")
      .replaceAll("release-assets-smoke-summary.md", "release-assets-smoke-summary-omitted.md")
      .replaceAll("Release review path", "Review path omitted")
      .replaceAll("starter-bundle.md", "starter omitted")
      .replaceAll("examples/consumer-repo", "consumer repo omitted")
      .replaceAll("first-run story", "first run omitted")
      .replaceAll("Show and tell", "show omitted")
      .replaceAll("raw provider payloads", "raw payload boundary omitted")
      .replaceAll("standalone adoption proof", "proof boundary omitted"),
    "utf8"
  );

  const findings = await runSeoCheck({
    siteDir: root.siteDir,
    siteUrl: SITE_URL,
    releasesPath: root.releasesPath,
    reportDir: root.reportDir
  });
  const messages = findings
    .filter((finding) => finding.ruleId === "release-page-asset-checklist")
    .map((finding) => finding.message);

  assert.ok(messages.some((message) => message.includes("release-assets-summary.md")));
  assert.ok(messages.some((message) => message.includes("release-assets-smoke-summary.md")));
  assert.ok(messages.some((message) => message.includes("Release review path")));
  assert.ok(messages.some((message) => message.includes("starter-bundle.md")));
  assert.ok(messages.some((message) => message.includes("examples/consumer-repo")));
  assert.ok(messages.some((message) => message.includes("first-run story")));
  assert.ok(messages.some((message) => message.includes("Show and tell")));
  assert.ok(messages.some((message) => message.includes("raw provider payloads")));
  assert.ok(messages.some((message) => message.includes("standalone adoption proof")));
});

async function createSeoFixture(): Promise<{ siteDir: string; releasesPath: string; reportDir: string }> {
  const siteDir = await mkdtemp(path.join(os.tmpdir(), "answerlens-seo-site-"));
  const reportDir = await mkdtemp(path.join(os.tmpdir(), "answerlens-seo-report-"));
  const releasesDir = await mkdtemp(path.join(os.tmpdir(), "answerlens-seo-releases-"));
  const releasesPath = path.join(releasesDir, "releases.json");
  await writeFile(
    releasesPath,
    `${JSON.stringify(
      [
        {
          tag_name: VERSION,
          html_url: `https://github.com/example/project/releases/tag/${VERSION}`,
          published_at: "2026-06-17T12:38:46Z"
        },
        {
          tag_name: "v9.9.8",
          html_url: "https://github.com/example/project/releases/tag/v9.9.8",
          published_at: "2026-06-10T12:00:00Z"
        },
        {
          tag_name: "v9.9.7",
          html_url: "https://github.com/example/project/releases/tag/v9.9.7",
          published_at: "2026-06-01T12:00:00Z"
        }
      ],
      null,
      2
    )}\n`,
    "utf8"
  );

  await writePage(siteDir, "index.html", redirectPage(`${SITE_URL}en/`));
  await writePage(siteDir, "starter/index.html", redirectPage(`${SITE_URL}en/starter/`));
  await writePage(siteDir, "releases/index.html", redirectPage(`${SITE_URL}en/releases/`));
  await writePage(
    siteDir,
    "en/index.html",
    page({
      canonical: `${SITE_URL}en/`,
      alternates: {
        en: `${SITE_URL}en/`,
        "zh-CN": `${SITE_URL}zh/`,
        "x-default": SITE_URL
      },
      h1: "AnswerLens",
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "AnswerLens",
          url: `${SITE_URL}en/`,
          softwareVersion: VERSION
        }
      ]
    })
  );
  await writePage(
    siteDir,
    "zh/index.html",
    page({
      canonical: `${SITE_URL}zh/`,
      alternates: {
        en: `${SITE_URL}en/`,
        "zh-CN": `${SITE_URL}zh/`,
        "x-default": SITE_URL
      },
      h1: "AnswerLens",
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "AnswerLens",
          url: `${SITE_URL}zh/`,
          softwareVersion: VERSION
        }
      ]
    })
  );
  await writePage(
    siteDir,
    "en/releases/index.html",
    page({
      canonical: `${SITE_URL}en/releases/`,
      alternates: {
        en: `${SITE_URL}en/releases/`,
        "zh-CN": `${SITE_URL}zh/releases/`,
        "x-default": `${SITE_URL}releases/`
      },
      h1: "Releases",
      body: releasePageBody("en"),
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Releases",
          url: `${SITE_URL}en/releases/`,
          description: "Release page."
        },
        breadcrumb(`${SITE_URL}en/`, `${SITE_URL}en/releases/`)
      ]
    })
  );
  await writePage(
    siteDir,
    "zh/releases/index.html",
    page({
      canonical: `${SITE_URL}zh/releases/`,
      alternates: {
        en: `${SITE_URL}en/releases/`,
        "zh-CN": `${SITE_URL}zh/releases/`,
        "x-default": `${SITE_URL}releases/`
      },
      h1: "Releases",
      body: releasePageBody("zh-CN"),
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Releases",
          url: `${SITE_URL}zh/releases/`,
          description: "Release page."
        },
        breadcrumb(`${SITE_URL}zh/`, `${SITE_URL}zh/releases/`)
      ]
    })
  );
  await writePage(
    siteDir,
    "en/starter/index.html",
    page({
      canonical: `${SITE_URL}en/starter/`,
      alternates: {
        en: `${SITE_URL}en/starter/`,
        "zh-CN": `${SITE_URL}zh/starter/`,
        "x-default": `${SITE_URL}starter/`
      },
      h1: "Starter",
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: "Starter",
          url: `${SITE_URL}en/starter/`,
          description: "Starter page."
        },
        breadcrumb(`${SITE_URL}en/`, `${SITE_URL}en/starter/`)
      ]
    })
  );
  await writePage(
    siteDir,
    "zh/starter/index.html",
    page({
      canonical: `${SITE_URL}zh/starter/`,
      alternates: {
        en: `${SITE_URL}en/starter/`,
        "zh-CN": `${SITE_URL}zh/starter/`,
        "x-default": `${SITE_URL}starter/`
      },
      h1: "Starter",
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: "Starter",
          url: `${SITE_URL}zh/starter/`,
          description: "Starter page."
        },
        breadcrumb(`${SITE_URL}zh/`, `${SITE_URL}zh/starter/`)
      ]
    })
  );
  await writeFile(
    path.join(siteDir, "sitemap.xml"),
    sitemap([
      SITE_URL,
      `${SITE_URL}en/`,
      `${SITE_URL}zh/`,
      `${SITE_URL}releases/`,
      `${SITE_URL}en/releases/`,
      `${SITE_URL}zh/releases/`,
      `${SITE_URL}en/starter/`,
      `${SITE_URL}zh/starter/`
    ]),
    "utf8"
  );

  return { siteDir, releasesPath, reportDir };
}

async function writePage(root: string, relativePath: string, contents: string): Promise<void> {
  const file = path.join(root, relativePath);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, contents, "utf8");
}

function redirectPage(target: string): string {
  return `<!doctype html><html><head><meta http-equiv="refresh" content="0; url=${target}" /></head><body></body></html>`;
}

function page(args: PageArgs): string {
  const body =
    args.body ??
    "<h2>What to open first?</h2><p>Start with share-summary.md, then scorecard.md, then recommendations.md.</p>";
  return `<!doctype html>
<html>
  <head>
    <title>${args.h1} | AnswerLens</title>
    <meta name="description" content="${args.h1} page." />
    <link rel="canonical" href="${args.canonical}" />
    <link rel="alternate" hreflang="en" href="${args.alternates.en}" />
    <link rel="alternate" hreflang="zh-CN" href="${args.alternates["zh-CN"]}" />
    <link rel="alternate" hreflang="x-default" href="${args.alternates["x-default"]}" />
    <meta property="og:title" content="${args.h1} | AnswerLens" />
    <meta property="og:description" content="${args.h1} page." />
    <meta property="og:url" content="${args.canonical}" />
    <meta property="og:image" content="${SITE_URL}assets/social-preview.png" />
    <meta property="og:image:alt" content="AnswerLens report preview." />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${args.h1} | AnswerLens" />
    <meta name="twitter:description" content="${args.h1} page." />
    <meta name="twitter:image" content="${SITE_URL}assets/social-preview.png" />
    <meta name="twitter:image:alt" content="AnswerLens report preview." />
    <script type="application/ld+json">${JSON.stringify(args.jsonLd)}</script>
  </head>
  <body><main><h1>${args.h1}</h1>${body}</main></body>
</html>`;
}

function releasePageBody(locale: "en" | "zh-CN"): string {
  if (locale === "zh-CN") {
    return `<p><a href="https://github.com/example/project/releases/tag/${VERSION}">打开最新发布 ${VERSION}</a></p><h2>release 下载 检查清单</h2><p>CLI tarball；如果 <code>npm view @answerlens/cli</code> 返回 <code>404</code>，继续使用 release assets 或本地 checkout。</p><p><code>answerlens-demo-audit.tar.gz</code>、<code>answerlens-site.tar.gz</code>、<code>release-assets-manifest.json</code> 和 <code>release-assets-summary.md</code></p><p>下载后检查 <code>release-assets-smoke-summary.md</code> 的 <code>Release review path</code>：先看 <code>release-assets-summary.md</code>，再看 <code>share-summary.md</code>、<code>scorecard.md</code>、<code>recommendations.md</code>。</p><p>release-assets-summary.md 包含 starter-bundle.md、examples/consumer-repo、first-run story 和 Show and tell 入口。</p><p>不要公开 raw provider payloads。不要把 smoke summary 当作 standalone adoption proof。</p><p>每次都按同一顺序审阅报告：<code>share-summary.md</code>，然后 <code>scorecard.md</code>，然后 <code>recommendations.md</code>。</p>`;
  }

  return `<p><a href="https://github.com/example/project/releases/tag/${VERSION}">Open latest release ${VERSION}</a></p><h2>Release asset checklist</h2><p>CLI tarball; if <code>npm view @answerlens/cli</code> returns <code>404</code>, keep release assets or a local checkout.</p><p><code>answerlens-demo-audit.tar.gz</code>, <code>answerlens-site.tar.gz</code>, <code>release-assets-manifest.json</code>, and <code>release-assets-summary.md</code></p><p>After downloading, check <code>release-assets-smoke-summary.md</code> for its <code>Release review path</code>: open <code>release-assets-summary.md</code>, then <code>share-summary.md</code>, then <code>scorecard.md</code>, then <code>recommendations.md</code>.</p><p>release-assets-summary.md includes the starter-bundle.md, examples/consumer-repo, first-run story, and Show and tell handoff.</p><p>Do not publish raw provider payloads. Do not treat the smoke summary as standalone adoption proof.</p><p>Review reports in order: <code>share-summary.md</code>, then <code>scorecard.md</code>, then <code>recommendations.md</code>.</p>`;
}

function breadcrumb(home: string, current: string): unknown {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "AnswerLens", item: home },
      { "@type": "ListItem", position: 2, name: "Current", item: current }
    ]
  };
}

function sitemap(urls: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((url) => `<url><loc>${url}</loc></url>`).join("")}</urlset>
`;
}
