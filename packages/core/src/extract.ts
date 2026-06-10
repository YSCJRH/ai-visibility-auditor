import { load } from "cheerio";
import type {
  BrandDetails,
  EvidenceSignal,
  FetchedPage,
  InternalLinkRecord,
  JsonLdQuestionAnswer,
  JsonLdRecord,
  JsonLdRecordType,
  PageRecord,
  PageType,
  SchemaTextSignal,
  SiteSource
} from "./types.ts";
import { keywordCoverage, normalizeComparableUrl, pathLooksLike, unique } from "./utils.ts";

function normalizePathname(pathname: string): string {
  if (!pathname || pathname === "/") {
    return "/";
  }

  return pathname.replace(/\/+$/, "").toLowerCase() || "/";
}

function detectPageType(source: SiteSource, page: FetchedPage, title: string, h1: string): PageType {
  const pathname = normalizePathname(new URL(page.url).pathname);
  const sourcePathname = normalizePathname(new URL(source.baseUrl).pathname);
  const localizedHomePathnames = ["en", "zh", "zh-cn"].map((locale) =>
    normalizePathname(sourcePathname === "/" ? `/${locale}` : `${sourcePathname}/${locale}`)
  );
  const haystack = `${title} ${h1} ${pathname}`.toLowerCase();

  if (pathname === "/" || pathname === "" || pathname === sourcePathname || localizedHomePathnames.includes(pathname)) {
    return "home";
  }
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

const SUPPORTED_JSON_LD_TYPES = new Map<string, JsonLdRecordType>([
  ["faqpage", "FAQPage"],
  ["organization", "Organization"],
  ["softwareapplication", "SoftwareApplication"],
  ["product", "Product"]
]);

const TRUST_TERMS = [
  "soc 2",
  "iso 27001",
  "sso",
  "saml",
  "gdpr",
  "encryption",
  "audit log",
  "dpa",
  "hipaa",
  "role-based",
  "安全",
  "信任",
  "密钥",
  "权限",
  "审阅",
  "加密",
  "合规"
];

const PRICING_TERMS = ["plan", "pricing", "price", "starter", "growth", "enterprise", "seat", "quote", "free", "$", "定价", "价格", "成本", "开源", "免费", "打包"];
const COMPARISON_TERMS = ["compare", "alternative", "versus", "vs", "criteria", "trade-off", "decision", "对比", "替代", "差异", "取舍", "决策", "看板"];
const WORKFLOW_TERMS = ["setup", "quickstart", "implementation", "workflow", "deploy", "configure", "onboard", "rollout", "设置", "上手", "工作流", "部署", "配置", "接入", "运行", "审阅"];
const OUTCOME_TERMS = ["reduce", "increase", "improve", "adoption", "activation", "time-to-value", "faster", "outcome", "减少", "增加", "改进", "改善", "更快", "结果", "目标", "采用"];
const DOCS_TERMS = ["api", "sdk", "quickstart", "reference", "guide", "version", "updated", "implementation", "文档", "指南", "示例", "版本", "更新", "实现", "说明"];

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function countExtractableWords(text: string): number {
  const latinTokens = text.match(/[A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)*/g) ?? [];
  const cjkChars = text.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu) ?? [];
  const nonLatinWords = Math.ceil(cjkChars.length / 2);
  return latinTokens.length + nonLatinWords;
}

function truncateText(value: string, maxLength = 180): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3).trim()}...`;
}

function cleanValue(value: unknown, maxLength = 180): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const cleaned = normalizeWhitespace(value.replace(/<[^>]+>/g, " "));
  if (!cleaned) {
    return undefined;
  }

  return truncateText(cleaned, maxLength);
}

function valuesFromUnknown(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  return value === undefined || value === null ? [] : [value];
}

function jsonLdTypesForNode(node: Record<string, unknown>): string[] {
  return valuesFromUnknown(node["@type"])
    .filter((type): type is string => typeof type === "string")
    .map((type) => type.trim())
    .filter(Boolean);
}

function normalizeSupportedType(type: string): JsonLdRecordType | null {
  return SUPPORTED_JSON_LD_TYPES.get(type.toLowerCase()) ?? null;
}

function queueJsonLdNodes(parsed: unknown): Record<string, unknown>[] {
  const queue = Array.isArray(parsed) ? [...parsed] : [parsed];
  const nodes: Record<string, unknown>[] = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== "object") {
      continue;
    }

    const node = current as Record<string, unknown>;
    nodes.push(node);

    for (const graphNode of valuesFromUnknown(node["@graph"])) {
      queue.push(graphNode);
    }
  }

  return nodes;
}

function extractFaqQuestions(node: Record<string, unknown>): JsonLdQuestionAnswer[] {
  return valuesFromUnknown(node.mainEntity)
    .filter((questionNode): questionNode is Record<string, unknown> => Boolean(questionNode) && typeof questionNode === "object")
    .map((questionNode) => {
      const answerNode = valuesFromUnknown(questionNode.acceptedAnswer).find(
        (candidate): candidate is Record<string, unknown> => Boolean(candidate) && typeof candidate === "object"
      );
      return {
        question: cleanValue(questionNode.name ?? questionNode.text, 140) ?? "",
        answer: cleanValue(answerNode?.text ?? answerNode?.name, 180) ?? ""
      };
    })
    .filter((entry) => entry.question || entry.answer);
}

function extractSupportedRecord(node: Record<string, unknown>, type: JsonLdRecordType): JsonLdRecord {
  const record: JsonLdRecord = {
    type,
    name: cleanValue(node.name),
    description: cleanValue(node.description),
    url: cleanValue(node.url),
    category: cleanValue(node.applicationCategory ?? node.category)
  };

  if (type === "FAQPage") {
    record.questions = extractFaqQuestions(node);
  }

  return record;
}

function extractJsonLd($: ReturnType<typeof load>): { types: string[]; records: JsonLdRecord[] } {
  const types: string[] = [];
  const records: JsonLdRecord[] = [];

  $("script[type='application/ld+json']").each((_, element) => {
    try {
      const raw = $(element).text().trim();
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const nodes = queueJsonLdNodes(parsed);

      for (const node of nodes) {
        for (const type of jsonLdTypesForNode(node)) {
          types.push(type);
          const supportedType = normalizeSupportedType(type);
          if (supportedType) {
            records.push(extractSupportedRecord(node, supportedType));
          }
        }
      }
    } catch {
      // ignore malformed JSON-LD
    }
  });

  return { types: unique(types), records };
}

function collectText($: ReturnType<typeof load>): string {
  $("script, style, noscript").remove();
  return $("body")
    .text()
    .replace(/\s+/g, " ")
    .trim();
}

function compactExamples(values: string[], limit = 3): string[] {
  return unique(values.map((value) => value.trim()).filter(Boolean)).slice(0, limit);
}

function countTermHits(textLower: string, terms: string[]): string[] {
  return terms.filter((term) => textLower.includes(term.toLowerCase()));
}

function regexExamples(text: string, pattern: RegExp): string[] {
  return compactExamples([...text.matchAll(pattern)].map((match) => match[0]), 3);
}

function pushSignal(signals: EvidenceSignal[], type: string, count: number, examples: string[]): void {
  if (count <= 0) {
    return;
  }

  signals.push({
    type,
    count,
    examples: compactExamples(examples)
  });
}

function valueIsVisible(visibleText: string, value: string): boolean {
  const normalizedValue = value.toLowerCase().replace(/\s+/g, " ").trim();
  const normalizedText = visibleText.toLowerCase().replace(/\s+/g, " ").trim();

  if (!normalizedValue) {
    return true;
  }

  if (normalizedText.includes(normalizedValue)) {
    return true;
  }

  return keywordCoverage(visibleText, value) >= 0.55;
}

function createSchemaTextSignals(records: JsonLdRecord[], visibleText: string): SchemaTextSignal[] {
  const signals: SchemaTextSignal[] = [];

  for (const record of records) {
    for (const field of ["name", "description", "category"] as const) {
      const value = record[field];
      if (!value) {
        continue;
      }

      signals.push({
        recordType: record.type,
        field,
        value,
        visible: valueIsVisible(visibleText, value)
      });
    }

    for (const question of record.questions ?? []) {
      if (question.question) {
        signals.push({
          recordType: record.type,
          field: "faq.question",
          value: question.question,
          visible: valueIsVisible(visibleText, question.question)
        });
      }

      if (question.answer) {
        signals.push({
          recordType: record.type,
          field: "faq.answer",
          value: question.answer,
          visible: valueIsVisible(visibleText, question.answer)
        });
      }
    }
  }

  return signals;
}

function createEvidenceSignals(text: string, pageType: PageType, lists: number, tables: number): EvidenceSignal[] {
  const signals: EvidenceSignal[] = [];
  const textLower = text.toLowerCase();
  const wordCount = countExtractableWords(text);
  const numbers = regexExamples(
    text,
    /(?:\$\s?\d{1,4}(?:[.,]\d+)?|\b\d{1,4}(?:[.,]\d+)?%?(?:\s?(?:k|m|b|days?|weeks?|months?|users?|seats?))?\b)/gi
  );
  const dates = regexExamples(text, /\b(?:20\d{2}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/gi);
  const versions = regexExamples(text, /\bv?\d+\.\d+(?:\.\d+)?\b/gi);
  const trustTerms = countTermHits(textLower, TRUST_TERMS);
  const pricingTerms = countTermHits(textLower, PRICING_TERMS);
  const comparisonTerms = countTermHits(textLower, COMPARISON_TERMS);
  const workflowTerms = countTermHits(textLower, WORKFLOW_TERMS);
  const outcomeTerms = countTermHits(textLower, OUTCOME_TERMS);
  const docsTerms = countTermHits(textLower, DOCS_TERMS);

  pushSignal(signals, "numbers", numbers.length, numbers);
  pushSignal(signals, "tables", tables, tables > 0 ? [`${tables} table${tables === 1 ? "" : "s"}`] : []);
  pushSignal(signals, "lists", lists, lists > 0 ? [`${lists} list${lists === 1 ? "" : "s"}`] : []);
  pushSignal(signals, "trust-markers", trustTerms.length, trustTerms);
  pushSignal(signals, "freshness", dates.length, dates);
  pushSignal(signals, "versions", versions.length, versions);
  pushSignal(signals, "pricing-proof", pricingTerms.length, pricingTerms);
  pushSignal(signals, "comparison-criteria", comparisonTerms.length, comparisonTerms);
  pushSignal(signals, "workflow-proof", workflowTerms.length, workflowTerms);
  pushSignal(signals, "outcome-proof", outcomeTerms.length, outcomeTerms);
  pushSignal(signals, "docs-proof", docsTerms.length, docsTerms);

  if (["pricing", "security", "docs", "compare", "use-case"].includes(pageType)) {
    pushSignal(signals, "body-depth", Math.floor(wordCount / 80), [`${wordCount} words`]);
  }

  return signals;
}

function absoluteUrl(source: SiteSource, currentUrl: string, href: string): string | null {
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("javascript:")) {
    return null;
  }

  try {
    return normalizeComparableUrl(new URL(href, currentUrl).toString());
  } catch {
    try {
      return normalizeComparableUrl(new URL(href, source.baseUrl).toString());
    } catch {
      return null;
    }
  }
}

function fallbackAnchorText(targetUrl: string): string {
  const pathname = new URL(targetUrl).pathname;
  const segments = pathname.split("/").filter(Boolean);
  const lastSegment = segments.at(-1);

  if (!lastSegment) {
    return "home";
  }

  return lastSegment.replace(/[-_]+/g, " ").trim() || "home";
}

function extractAnchorText(
  $: ReturnType<typeof load>,
  element: any,
  targetUrl: string
): string {
  const directText = normalizeWhitespace($(element).text());
  if (directText) {
    return truncateText(directText, 120);
  }

  const ariaLabel = cleanValue($(element).attr("aria-label"), 120);
  if (ariaLabel) {
    return ariaLabel;
  }

  const title = cleanValue($(element).attr("title"), 120);
  if (title) {
    return title;
  }

  return truncateText(fallbackAnchorText(targetUrl), 120);
}

function extractHeadingContext($: ReturnType<typeof load>, element: any): string | undefined {
  const containers = $(element)
    .parents()
    .toArray()
    .map((node) => $(node))
    .filter((node) => node.is("section, article, main, header, nav, div, body"));

  for (const container of containers) {
    const heading = cleanValue(container.children("h2, h3, h1").first().text(), 120);
    if (heading) {
      return heading;
    }

    const nestedHeading = cleanValue(container.find("h2, h3, h1").first().text(), 120);
    if (nestedHeading) {
      return nestedHeading;
    }
  }

  return undefined;
}

function extractSourceContext(
  $: ReturnType<typeof load>,
  element: any,
  anchorText: string
): string {
  const block = $(element).closest("li, p, td, th");
  const blockText = block.length > 0 ? cleanValue(block.text(), 180) : undefined;
  const heading = extractHeadingContext($, element);
  const contextParts: string[] = [];

  if (heading) {
    contextParts.push(heading);
  }

  if (blockText) {
    const alreadyCoveredByHeading = heading ? blockText.toLowerCase().includes(heading.toLowerCase()) : false;
    contextParts.push(alreadyCoveredByHeading ? blockText : truncateText(`${heading ?? ""} ${blockText}`.trim(), 180));
  }

  const context = cleanValue(contextParts.join(" "), 200);
  if (context && context.length >= 32) {
    return context;
  }

  if (heading) {
    const headingContext = cleanValue(`${heading} ${anchorText}`, 160);
    if (headingContext) {
      return headingContext;
    }
  }

  return truncateText(anchorText, 120);
}

function extractInternalLinkRecords(
  $: ReturnType<typeof load>,
  source: SiteSource,
  currentUrl: string
): { internalLinkRecords: InternalLinkRecord[]; externalLinks: string[] } {
  const sourceHost = new URL(source.baseUrl).host;
  const internalLinkRecords: InternalLinkRecord[] = [];
  const externalLinks: string[] = [];
  const seenInternal = new Set<string>();
  const seenExternal = new Set<string>();

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href") ?? "";
    const targetUrl = absoluteUrl(source, currentUrl, href);
    if (!targetUrl) {
      return;
    }

    if (new URL(targetUrl).host !== sourceHost) {
      if (!seenExternal.has(targetUrl)) {
        seenExternal.add(targetUrl);
        externalLinks.push(targetUrl);
      }
      return;
    }

    const anchorText = extractAnchorText($, element, targetUrl);
    const sourceContext = extractSourceContext($, element, anchorText);
    const recordKey = `${targetUrl}::${anchorText.toLowerCase()}::${sourceContext.toLowerCase()}`;

    if (seenInternal.has(recordKey)) {
      return;
    }

    seenInternal.add(recordKey);
    internalLinkRecords.push({
      url: targetUrl,
      anchorText,
      sourceContext
    });
  });

  return {
    internalLinkRecords,
    externalLinks
  };
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
  const jsonLd = extractJsonLd($);
  const text = collectText($);
  const pathname = new URL(page.url).pathname || "/";
  const { internalLinkRecords, externalLinks } = extractInternalLinkRecords($, source, page.url);
  const internalLinks = unique(internalLinkRecords.map((record) => record.url));
  const robotsMeta = [$("meta[name='robots']").attr("content"), $("meta[name='googlebot']").attr("content")]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const wordCount = text ? countExtractableWords(text) : 0;
  const textLower = text.toLowerCase();
  const pageType = detectPageType(source, page, title, h1);
  const lists = $("ul, ol").length;
  const tables = $("table").length;
  const schemaTextSignals = createSchemaTextSignals(jsonLd.records, text);
  const evidenceSignals = createEvidenceSignals(text, pageType, lists, tables);

  return {
    url: page.url,
    pathname,
    status: page.status,
    pageType,
    title,
    metaDescription,
    h1,
    h1Count: h1Nodes.length,
    headings,
    wordCount,
    internalLinkRecords,
    internalLinks,
    externalLinks,
    lists,
    tables,
    hasJsonLd: jsonLd.types.length > 0,
    jsonLdTypes: jsonLd.types,
    jsonLdRecords: jsonLd.records,
    schemaTextSignals,
    evidenceSignals,
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

