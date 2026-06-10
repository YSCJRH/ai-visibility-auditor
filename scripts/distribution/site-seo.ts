export type SeoLocale = "en" | "zh-CN";

export type SeoPageKind = "home" | "faq" | "page";

export type SeoPage = {
  route: string;
  locale: SeoLocale;
  canonical: string;
  alternates: Record<SeoLocale | "x-default", string>;
  title: string;
  description: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  ogImageAlt: string;
  lastModified: string;
  kind: SeoPageKind;
};

export type LocaleTextFinding = {
  ruleId: string;
  severity: "error";
  message: string;
  snippet: string;
};

type JsonLdObject = Record<string, unknown>;

type ReleaseLike = {
  tag_name: string;
  name?: string;
  published_at?: string;
  body?: string;
};

const REPO_URL = "https://github.com/YSCJRH/ai-visibility-auditor";
const DEFAULT_DESCRIPTION = "AnswerLens is a CLI-first AI visibility auditor for product websites.";
const DEFAULT_TAGLINE = "CI for AI discoverability.";

const RELEASE_SUMMARIES: Record<string, Record<SeoLocale, string>> = {
  "v0.3.4": {
    en: "AnswerLens v0.3.4 tightens the self-dogfooding loop with Pages redirect handling, localized homepage detection, CJK extraction signals, compare metadata coverage, and updated stable Action pins.",
    "zh-CN":
      "AnswerLens v0.3.4 收紧自我应用闭环，补齐 Pages redirect 处理、本地化首页识别、CJK 抽取信号、compare metadata 覆盖和最新稳定 Action pin。"
  },
  "v0.3.3": {
    en: "AnswerLens v0.3.3 hardens the GitHub-native activation loop with share-ready artifacts, trust and safety docs, starter bundle guidance, self-dogfooding evidence, public claim guardrails, and repo-local Codex plugin workflows.",
    "zh-CN":
      "AnswerLens v0.3.3 强化 GitHub-native 激活闭环，补齐可转发报告、信任与安全文档、starter bundle 指南、自我应用证据、公开宣称护栏和仓库内 Codex 插件工作流。"
  },
  "v0.3.2": {
    en: "AnswerLens v0.3.2 continues the CLI-first AI visibility audit path with bilingual Pages, localized report outputs, the live demo, fixture demo, real-site quickstart, and GitHub Action adoption entries.",
    "zh-CN":
      "AnswerLens v0.3.2 延续 CLI-first AI 可发现性审计路径，补齐双语 Pages、本地化报告输出、在线演示、fixture 演示、真实站点 quickstart 与 GitHub Action 接入入口。"
  },
  "v0.3.1": {
    en: "AnswerLens v0.3.1 ships schema-text, evidence-density, internal-link, manual-import, Search Console, Bing helper, and admin foundation work while keeping the audit artifact workflow explicit.",
    "zh-CN":
      "AnswerLens v0.3.1 增加 schema 文本一致性、证据密度、内部链接、manual-import、Search Console、Bing 辅助工具和内部 admin 基础能力，并继续保持 artifact-first 审计路径。"
  },
  "v0.3.0": {
    en: "AnswerLens v0.3.0 adds rule hardening, external validation helpers, publish-ready bundles, and the same demo-to-CI adoption path used across the public docs.",
    "zh-CN":
      "AnswerLens v0.3.0 增加规则加固、外部验证辅助能力、可发布 bundle，并把公开文档中的 demo 到 CI 接入路径串起来。"
  },
  "v0.2.3": {
    en: "AnswerLens v0.2.3 focuses on schema-text consistency, evidence density, internal-link context, manual rank import, stability summaries, and release-ready report artifacts.",
    "zh-CN":
      "AnswerLens v0.2.3 聚焦 schema 文本一致性、证据密度、内部链接上下文、manual rank import、稳定性摘要和可发布的报告 artifact。"
  },
  "v0.2.0": {
    en: "AnswerLens v0.2.0 presents the public CLI-first audit workflow with deterministic site checks, eval support, manual-import support, and shareable report outputs.",
    "zh-CN":
      "AnswerLens v0.2.0 公开 CLI-first 审计工作流，包含确定性的站点检查、eval 支持、manual-import 支持，以及可分享的报告输出。"
  },
  "v0.1.0-alpha.1": {
    en: "AnswerLens v0.1.0-alpha.1 is the initial public alpha with CLI-first AI-readiness audit, experimental eval, Markdown, JSON, and static HTML reports.",
    "zh-CN":
      "AnswerLens v0.1.0-alpha.1 是初始公开 alpha，提供 CLI-first AI-readiness 审计、实验性 eval，以及 Markdown、JSON 和静态 HTML 报告。"
  }
};

export function localizeSeoPath(route: string, locale: SeoLocale): string {
  const normalized = route.replace(/^\/+/, "");
  const slug = locale === "zh-CN" ? "zh" : "en";
  return `${slug}/${normalized}`;
}

export function seoDocumentTitle(title: string): string {
  return title.includes("AnswerLens") ? title : `${title} | AnswerLens`;
}

export function buildSeoPage(args: {
  siteUrl: string;
  route: string;
  locale: SeoLocale;
  title: string;
  description: string;
  lastModified: string;
  kind?: SeoPageKind;
  ogImage?: string;
  ogImageAlt?: string;
}): SeoPage {
  const documentTitle = seoDocumentTitle(args.title);
  const ogImage = args.ogImage ?? new URL("assets/social-preview.png", args.siteUrl).href;
  const kind = args.kind ?? (args.route === "" ? "home" : args.route === "faq/" ? "faq" : "page");
  return {
    route: args.route,
    locale: args.locale,
    canonical: new URL(localizeSeoPath(args.route, args.locale), args.siteUrl).href,
    alternates: {
      en: new URL(localizeSeoPath(args.route, "en"), args.siteUrl).href,
      "zh-CN": new URL(localizeSeoPath(args.route, "zh-CN"), args.siteUrl).href,
      "x-default": new URL(args.route, args.siteUrl).href
    },
    title: documentTitle,
    description: args.description,
    ogTitle: documentTitle,
    ogDescription: args.description,
    ogImage,
    ogImageAlt:
      args.ogImageAlt ??
      "AnswerLens AI visibility audit report screenshot showing scorecard, share summary, and recommendations.",
    lastModified: args.lastModified,
    kind
  };
}

export function renderSeoHead(page: SeoPage): string {
  return [
    `<title>${escapeHtml(page.title)}</title>`,
    `<meta name="description" content="${escapeHtml(page.description)}" />`,
    `<link rel="canonical" href="${escapeHtml(page.canonical)}" />`,
    `<link rel="alternate" hreflang="en" href="${escapeHtml(page.alternates.en)}" />`,
    `<link rel="alternate" hreflang="zh-CN" href="${escapeHtml(page.alternates["zh-CN"])}" />`,
    `<link rel="alternate" hreflang="x-default" href="${escapeHtml(page.alternates["x-default"])}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="AnswerLens" />`,
    `<meta property="og:title" content="${escapeHtml(page.ogTitle)}" />`,
    `<meta property="og:description" content="${escapeHtml(page.ogDescription)}" />`,
    `<meta property="og:url" content="${escapeHtml(page.canonical)}" />`,
    `<meta property="og:image" content="${escapeHtml(page.ogImage)}" />`,
    `<meta property="og:image:alt" content="${escapeHtml(page.ogImageAlt)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(page.ogTitle)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(page.ogDescription)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(page.ogImage)}" />`,
    `<meta name="twitter:image:alt" content="${escapeHtml(page.ogImageAlt)}" />`,
    `<meta name="last-modified" content="${escapeHtml(page.lastModified)}" />`
  ].join("\n    ");
}

export function renderJsonLd(page: SeoPage, args: { pageJsonLd?: unknown; latestReleaseVersion: string }): string {
  const nodes =
    page.kind === "home"
      ? homeJsonLd(page, args.latestReleaseVersion)
      : [...normalizeJsonLd(args.pageJsonLd).map((node) => alignJsonLdWithPage(node, page)), breadcrumbJsonLd(page)];
  return `<script type="application/ld+json">${safeJson(nodes)}</script>`;
}

export function generateSitemap(args: { siteUrl: string; pages: SeoPage[]; lastModified: string }): string {
  const rootUrl = new URL("", args.siteUrl).href;
  const seen = new Set<string>();
  const urls = [
    `<url><loc>${escapeHtml(rootUrl)}</loc><lastmod>${escapeHtml(args.lastModified)}</lastmod></url>`,
    ...args.pages.map((page) => {
      if (seen.has(page.canonical)) {
        return "";
      }
      seen.add(page.canonical);
      return `<url><loc>${escapeHtml(page.canonical)}</loc><lastmod>${escapeHtml(page.lastModified)}</lastmod></url>`;
    })
  ].join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>\n`;
}

export function localizedReleaseSummary(release: ReleaseLike, locale: SeoLocale): string {
  const known = RELEASE_SUMMARIES[release.tag_name]?.[locale];
  if (known) {
    return known;
  }

  if (locale === "zh-CN") {
    return `${release.tag_name} 的详细说明保留在 GitHub 发布页中。建议先按在线演示、fixture、真实站点 quickstart、GitHub Action 的顺序试用 AnswerLens，再下载对应版本的发布资源。`;
  }

  return release.body?.replace(/\s+/g, " ").trim() || `${release.tag_name} release metadata is available on GitHub.`;
}

export function checkLocaleText(text: string, locale: SeoLocale): LocaleTextFinding[] {
  if (locale !== "zh-CN") {
    return [];
  }

  const findings: LocaleTextFinding[] = [];
  const compact = text.replace(/\s+/g, " ").trim();
  const allowedTerms =
    /AnswerLens|CLI-first|GitHub-native|BYOK|artifact-first|dashboard-first|schema|scorecard|recommendations|share-summary|GitHub Action|OpenAI|Perplexity|Search Console|Bing|IndexNow|FAQ|README|Pages|PR|CI|API|JSON|HTML|URL|SaaS|CPS|release|quickstart|fixture|runtime\.yaml|brand\.yaml|competitors\.yaml|prompts\.yaml|run\.json|index\.html|eval|manual-import|workflow_dispatch|pull request/g;
  const normalized = compact.replace(allowedTerms, "");
  const englishSentencePattern = /\b(?:The|This|That|These|Those|Open|Run|Review|Download|Use|Start|AnswerLens|Release|What|Known|Current|Canonical|Initial|No|Not)\b(?:[A-Za-z0-9`'"()/#:.,-]+\s+){5,}[A-Za-z0-9`'"()/#:.,-]+/g;
  for (const match of normalized.matchAll(englishSentencePattern)) {
    const snippet = match[0].trim();
    if (!snippet) {
      continue;
    }
    findings.push({
      ruleId: "zh-visible-english-sentence",
      severity: "error",
      message: "Chinese Pages output contains a complete English sentence or paragraph outside the allowed terminology list.",
      snippet: snippet.slice(0, 220)
    });
  }

  return findings;
}

function homeJsonLd(page: SeoPage, latestReleaseVersion: string): unknown[] {
  return [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "AnswerLens",
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Cross-platform",
      description:
        page.locale === "zh-CN"
          ? "AnswerLens 会审计公开产品页面，并生成团队可在 GitHub 中审阅的报告文件。"
          : `${DEFAULT_DESCRIPTION} ${DEFAULT_TAGLINE}`,
      url: page.canonical,
      codeRepository: REPO_URL,
      softwareVersion: latestReleaseVersion,
      inLanguage: page.locale,
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD"
      }
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "YSCJRH",
      url: REPO_URL
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "AnswerLens",
      url: page.alternates["x-default"],
      description: page.description,
      inLanguage: page.locale
    }
  ];
}

function breadcrumbJsonLd(page: SeoPage): unknown {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "AnswerLens",
        item: localeHomeUrl(page)
      },
      {
        "@type": "ListItem",
        position: 2,
        name: page.title.replace(/\s+\|\s+AnswerLens$/, ""),
        item: page.canonical
      }
    ]
  };
}

function alignJsonLdWithPage(node: JsonLdObject, page: SeoPage): JsonLdObject {
  const pageTypes = new Set(["WebPage", "CollectionPage", "Dataset", "FAQPage"]);
  const type = node["@type"];
  if (typeof type === "string" && pageTypes.has(type)) {
    const aligned: JsonLdObject = { ...node, url: page.canonical };
    if (typeof node.name === "string") {
      aligned.name = page.title;
    }
    if (typeof node.description === "string") {
      aligned.description = page.description;
    }
    return aligned;
  }

  return node;
}

function localeHomeUrl(page: SeoPage): string {
  const localizedRoute = localizeSeoPath(page.route, page.locale);
  if (!page.canonical.endsWith(localizedRoute)) {
    return page.alternates[page.locale];
  }

  const siteRoot = page.canonical.slice(0, page.canonical.length - localizedRoute.length);
  return `${siteRoot}${localizeSeoPath("", page.locale)}`;
}

function normalizeJsonLd(value: unknown): JsonLdObject[] {
  if (!value) {
    return [];
  }

  const nodes = Array.isArray(value) ? value : [value];
  return nodes.filter((node): node is JsonLdObject => Boolean(node) && typeof node === "object" && !Array.isArray(node));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}
