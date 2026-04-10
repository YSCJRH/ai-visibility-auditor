import { load } from "cheerio";
import type { BrandDetails, FetchedPage, PageRecord, PageType, SiteSource } from "./types.ts";
import { pathLooksLike } from "./utils.ts";

function detectPageType(page: FetchedPage, title: string, h1: string): PageType {
  const pathname = new URL(page.url).pathname.toLowerCase();
  const haystack = `${title} ${h1} ${pathname}`.toLowerCase();

  if (pathname === "/" || pathname === "") return "home";
  if (pathLooksLike(pathname, "pricing", "plans") || haystack.includes("pricing")) return "pricing";
  if (pathLooksLike(pathname, "security", "trust") || haystack.includes("security")) return "security";
  if (pathLooksLike(pathname, "faq")) return "faq";
  if (pathLooksLike(pathname, "compare", "alternatives", "/vs") || haystack.includes("alternative")) return "compare";
  if (pathLooksLike(pathname, "docs", "developers", "api") || haystack.includes("documentation")) return "docs";
  if (pathLooksLike(pathname, "integrations")) return "integrations";
  if (pathLooksLike(pathname, "use-case", "solutions", "for-")) return "use-case";
  if (pathLooksLike(pathname, "product", "platform", "features") || haystack.includes("product")) return "product";
  return "other";
}

function extractJsonLdTypes($: ReturnType<typeof load>): string[] {
  const types: string[] = [];

  $("script[type='application/ld+json']").each((_, element) => {
    try {
      const raw = $(element).text().trim();
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const queue = Array.isArray(parsed) ? [...parsed] : [parsed];

      while (queue.length > 0) {
        const current = queue.shift();
        if (!current || typeof current !== "object") continue;
        if (typeof current["@type"] === "string") {
          types.push(current["@type"]);
        }
        if (Array.isArray(current["@graph"])) {
          queue.push(...current["@graph"]);
        }
      }
    } catch {
      // ignore malformed JSON-LD
    }
  });

  return [...new Set(types)];
}

function collectText($: ReturnType<typeof load>): string {
  $("script, style, noscript").remove();
  return $("body")
    .text()
    .replace(/\s+/g, " ")
    .trim();
}

function absoluteUrl(source: SiteSource, currentUrl: string, href: string): string | null {
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("javascript:")) {
    return null;
  }

  try {
    return new URL(href, currentUrl).toString();
  } catch {
    try {
      return new URL(href, source.baseUrl).toString();
    } catch {
      return null;
    }
  }
}

export function normalizePage(source: SiteSource, page: FetchedPage, _brand: BrandDetails): PageRecord {
  const $ = load(page.html);
  const title = $("title").first().text().trim();
  const metaDescription = $("meta[name='description']").attr("content")?.trim() ?? "";
  const h1Nodes = $("h1");
  const h1 = h1Nodes.first().text().trim();
  const headings = $("h2, h3")
    .map((_, element) => $(element).text().trim())
    .get()
    .filter(Boolean);
  const text = collectText($);
  const jsonLdTypes = extractJsonLdTypes($);
  const pathname = new URL(page.url).pathname || "/";
  const links = $("a[href]")
    .map((_, element) => $(element).attr("href"))
    .get()
    .map((href) => absoluteUrl(source, page.url, href ?? ""))
    .filter((href): href is string => Boolean(href));
  const sourceHost = new URL(source.baseUrl).host;
  const internalLinks = links.filter((link) => new URL(link).host === sourceHost);
  const externalLinks = links.filter((link) => new URL(link).host !== sourceHost);
  const robotsMeta = [$("meta[name='robots']").attr("content"), $("meta[name='googlebot']").attr("content")]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const wordCount = text ? text.split(/\s+/).length : 0;
  const textLower = text.toLowerCase();

  return {
    url: page.url,
    pathname,
    status: page.status,
    pageType: detectPageType(page, title, h1),
    title,
    metaDescription,
    h1,
    h1Count: h1Nodes.length,
    headings,
    wordCount,
    internalLinks,
    externalLinks,
    lists: $("ul, ol").length,
    tables: $("table").length,
    hasJsonLd: jsonLdTypes.length > 0,
    jsonLdTypes,
    ariaLabeledControls: $("button[aria-label], [role='button'][aria-label], input[aria-label], textarea[aria-label], select[aria-label], a[role='button'][aria-label]").length,
    interactiveControls: $("button, [role='button'], input, textarea, select, a[role='button']").length,
    canonical: $("link[rel='canonical']").attr("href")?.trim() ?? null,
    noindex: robotsMeta.includes("noindex"),
    hasDate: /\b(20\d{2}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i.test(text),
    hasVersion: /\bv?\d+\.\d+(\.\d+)?\b/i.test(text),
    hasTrustSignals: /\b(soc ?2|iso ?27001|sso|saml|gdpr|encryption|audit log|hipaa|dpa)\b/i.test(textLower),
    hasNumbers: /\b\d{1,3}(?:[.,]\d+)?%?\b/.test(text),
    jsHeavy: wordCount < 120 && $("script").length >= 5,
    textSnippet: text.slice(0, 240),
    fetchError: page.fetchError
  };
}

export function normalizePages(source: SiteSource, pages: FetchedPage[], brand: BrandDetails): PageRecord[] {
  return pages.map((page) => normalizePage(source, page, brand));
}

