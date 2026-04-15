import { randomUUID } from "node:crypto";
import { ARTIFACT_VERSION, RULE_VERSION } from "./constants.ts";
import type {
  AuditResult,
  PageRecord,
  PageType,
  RunMetadata,
  SearchConsoleFinding,
  SearchConsolePageRecord,
  SearchConsoleValidationResult,
  Severity
} from "./types.ts";
import { normalizeComparableUrl, normalizeDomain, slugify } from "./utils.ts";

const REQUIRED_HEADERS = ["page", "clicks", "impressions", "ctr", "position"] as const;
const KEY_PROOF_PAGE_TYPES: PageType[] = ["pricing", "security", "docs", "faq", "compare", "integrations", "use-case"];
const KEY_PROOF_SEVERITY: Record<string, Severity> = {
  pricing: "warn",
  security: "warn",
  docs: "warn",
  faq: "info",
  compare: "info",
  integrations: "info",
  "use-case": "info"
};
const SEVERITY_ORDER: Record<Severity, number> = {
  error: 3,
  warn: 2,
  info: 1
};

type ParsedSearchConsoleRow = {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;

  const normalized = text.replace(/^\uFEFF/, "");
  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index] ?? "";
    const next = normalized[index + 1] ?? "";

    if (character === "\"") {
      if (inQuotes && next === "\"") {
        current += "\"";
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes && character === ",") {
      row.push(current.trim());
      current = "";
      continue;
    }

    if (!inQuotes && (character === "\n" || character === "\r")) {
      if (character === "\r" && next === "\n") {
        index += 1;
      }

      row.push(current.trim());
      if (row.some((value) => value.length > 0)) {
        rows.push(row);
      }

      current = "";
      row = [];
      continue;
    }

    current += character;
  }

  row.push(current.trim());
  if (row.some((value) => value.length > 0)) {
    rows.push(row);
  }

  return rows;
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase();
}

function parseNumber(value: string, field: string): number {
  const numeric = Number(value.replace(/%/g, "").trim());
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error(`Invalid numeric value for ${field}: ${value}`);
  }

  return numeric;
}

function normalizeSearchConsoleUrl(value: string): { comparableUrl: string; domain: string } {
  const url = new URL(value);
  url.hash = "";
  url.protocol = "https:";
  url.hostname = normalizeDomain(url.hostname);
  if (url.pathname.length > 1) {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }

  return {
    comparableUrl: normalizeComparableUrl(url.toString()),
    domain: normalizeDomain(url.hostname)
  };
}

function isSameSiteDomain(domain: string, siteDomain: string): boolean {
  return domain === siteDomain || domain.endsWith(`.${siteDomain}`);
}

export function parseSearchConsoleCsv(csvText: string): ParsedSearchConsoleRow[] {
  const rows = parseCsv(csvText);
  if (rows.length < 2) {
    throw new Error("Search Console CSV must include a header row and at least one data row.");
  }

  const headers = rows[0]?.map((value) => normalizeHeader(value)) ?? [];
  const missingHeaders = REQUIRED_HEADERS.filter((header) => !headers.includes(header));
  if (missingHeaders.length > 0) {
    throw new Error(`Search Console CSV is missing required columns: ${missingHeaders.join(", ")}`);
  }

  return rows.slice(1).map((row, index) => {
    const values = Object.fromEntries(headers.map((header, headerIndex) => [header, row[headerIndex] ?? ""]));
    const page = values.page?.trim();
    if (!page) {
      throw new Error(`Search Console CSV row ${index + 2} is missing page.`);
    }

    try {
      new URL(page);
    } catch {
      throw new Error(`Search Console CSV row ${index + 2} has invalid page URL: ${page}`);
    }

    return {
      page,
      clicks: parseNumber(values.clicks ?? "", "clicks"),
      impressions: parseNumber(values.impressions ?? "", "impressions"),
      ctr: parseNumber(values.ctr ?? "", "ctr"),
      position: parseNumber(values.position ?? "", "position")
    };
  });
}

function highestSeverity(issues: AuditResult["issues"]): Severity | null {
  const sorted = [...issues].sort((left, right) => SEVERITY_ORDER[right.severity] - SEVERITY_ORDER[left.severity]);
  return sorted[0]?.severity ?? null;
}

function aggregateSearchConsoleRows(rows: ParsedSearchConsoleRow[]): ParsedSearchConsoleRow[] {
  const aggregated = new Map<
    string,
    {
      page: string;
      clicks: number;
      impressions: number;
      ctrWeightedSum: number;
      positionWeightedSum: number;
      weight: number;
      ctrFallbackSum: number;
      positionFallbackSum: number;
      count: number;
    }
  >();

  for (const row of rows) {
    const normalized = normalizeSearchConsoleUrl(row.page);
    const existing =
      aggregated.get(normalized.comparableUrl) ?? {
        page: row.page,
        clicks: 0,
        impressions: 0,
        ctrWeightedSum: 0,
        positionWeightedSum: 0,
        weight: 0,
        ctrFallbackSum: 0,
        positionFallbackSum: 0,
        count: 0
      };

    const weight = row.impressions > 0 ? row.impressions : 1;
    existing.page = row.page;
    existing.clicks += row.clicks;
    existing.impressions += row.impressions;
    existing.ctrWeightedSum += row.ctr * weight;
    existing.positionWeightedSum += row.position * weight;
    existing.weight += weight;
    existing.ctrFallbackSum += row.ctr;
    existing.positionFallbackSum += row.position;
    existing.count += 1;
    aggregated.set(normalized.comparableUrl, existing);
  }

  return [...aggregated.values()].map((entry) => ({
    page: entry.page,
    clicks: entry.clicks,
    impressions: entry.impressions,
    ctr: entry.weight > 0 ? entry.ctrWeightedSum / entry.weight : entry.ctrFallbackSum / Math.max(entry.count, 1),
    position:
      entry.weight > 0 ? entry.positionWeightedSum / entry.weight : entry.positionFallbackSum / Math.max(entry.count, 1)
  }));
}

function buildAuditIssueMap(audit: AuditResult): Map<string, AuditResult["issues"]> {
  const byPage = new Map<string, AuditResult["issues"]>();
  for (const issue of audit.issues) {
    if (!issue.pageUrl) {
      continue;
    }

    const comparableUrl = normalizeSearchConsoleUrl(issue.pageUrl).comparableUrl;
    const current = byPage.get(comparableUrl) ?? [];
    current.push(issue);
    byPage.set(comparableUrl, current);
  }

  return byPage;
}

function buildPageMap(pages: PageRecord[]): Map<string, PageRecord> {
  return new Map(pages.map((page) => [normalizeSearchConsoleUrl(page.url).comparableUrl, page]));
}

function applyValidationRunMetadata(audit: AuditResult): AuditResult {
  const completedAt = new Date().toISOString();

  return {
    ...audit,
    run: {
      ...audit.run,
      mode: "validation-import",
      completedAt,
      validationSource: "search-console"
    },
    site: {
      ...audit.site,
      generatedAt: completedAt
    }
  };
}

export function buildSearchConsoleValidation(
  audit: AuditResult,
  csvText: string,
  inputPath: string
): { audit: AuditResult; validation: SearchConsoleValidationResult } {
  const auditForValidation = applyValidationRunMetadata(audit);
  const parsedRows = aggregateSearchConsoleRows(parseSearchConsoleCsv(csvText));
  const pageMap = buildPageMap(auditForValidation.pages);
  const auditIssuesByPage = buildAuditIssueMap(auditForValidation);
  const siteDomain = normalizeDomain(auditForValidation.site.baseUrl);

  const pages: SearchConsolePageRecord[] = parsedRows.map((row) => {
    const normalized = normalizeSearchConsoleUrl(row.page);
    const outOfScope = !isSameSiteDomain(normalized.domain, siteDomain);
    const matchedPage = outOfScope ? null : pageMap.get(normalized.comparableUrl) ?? null;
    const auditIssues = matchedPage ? auditIssuesByPage.get(normalized.comparableUrl) ?? [] : [];

    return {
      page: row.page,
      normalizedUrl: normalized.comparableUrl,
      domain: normalized.domain,
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
      outOfScope,
      matchedAuditPageUrl: matchedPage?.url ?? null,
      matchedPageType: matchedPage?.pageType ?? null,
      hasEvidence: row.impressions > 0,
      hasClicks: row.clicks > 0,
      auditIssueCount: auditIssues.length,
      highestAuditSeverity: highestSeverity(auditIssues)
    };
  });

  const findings: SearchConsoleFinding[] = [];
  const keyPages = auditForValidation.pages.filter((page) => KEY_PROOF_PAGE_TYPES.includes(page.pageType));

  for (const page of keyPages) {
    const matchingRows = pages.filter((entry) => entry.matchedAuditPageUrl === page.url && !entry.outOfScope && entry.hasEvidence);
    if (matchingRows.length > 0) {
      continue;
    }

    const severity = KEY_PROOF_SEVERITY[page.pageType] ?? "info";
    findings.push({
      id: `search-console-no-evidence-${page.pageType}-${slugify(page.url)}`,
      severity,
      title: "Key page has no Search Console evidence",
      pageUrl: page.url,
      pageType: page.pageType,
      message: `${page.pageType} exists in crawl output but does not show imported Search Console evidence yet.`,
      evidence: `Expected evidence on ${page.url}`
    });
  }

  for (const row of pages.filter((entry) => !entry.outOfScope && !entry.matchedAuditPageUrl && entry.hasEvidence)) {
    findings.push({
      id: `search-console-not-crawled-${slugify(row.page)}`,
      severity: "warn",
      title: "Search Console page is not covered by crawl",
      pageUrl: row.page,
      pageType: null,
      message: "This page has Search Console evidence but did not map to any crawled audit page.",
      evidence: `${row.impressions} impressions, ${row.clicks} clicks`
    });
  }

  const blockerFindings = new Set<string>();
  for (const row of pages.filter((entry) => !entry.outOfScope && entry.matchedAuditPageUrl && entry.hasEvidence)) {
    const auditIssues = auditIssuesByPage.get(row.normalizedUrl) ?? [];
    if (auditIssues.length === 0) {
      continue;
    }

    if (blockerFindings.has(row.normalizedUrl)) {
      continue;
    }
    blockerFindings.add(row.normalizedUrl);

    const severity = highestSeverity(auditIssues) ?? "info";
    findings.push({
      id: `search-console-audit-blockers-${slugify(row.page)}`,
      severity,
      title: "Search-visible page still has audit blockers",
      pageUrl: row.matchedAuditPageUrl ?? row.page,
      pageType: row.matchedPageType,
      message: `This page already shows Search Console evidence but still has audit issues that can limit discoverability quality.`,
      evidence: auditIssues.slice(0, 3).map((issue) => issue.title).join("; "),
      relatedAuditIssueIds: auditIssues.map((issue) => issue.id)
    });
  }

  const inScopePages = pages.filter((page) => !page.outOfScope);
  const keyPagesWithEvidence = keyPages.filter((page) =>
    inScopePages.some((entry) => entry.matchedAuditPageUrl === page.url && entry.hasEvidence)
  ).length;
  const keyPageCoverage = keyPages.map((page) => {
    const matchingRows = inScopePages.filter((entry) => entry.matchedAuditPageUrl === page.url);
    return {
      pageUrl: page.url,
      pageType: page.pageType,
      hasEvidence: matchingRows.some((entry) => entry.hasEvidence),
      impressions: matchingRows.reduce((sum, entry) => sum + entry.impressions, 0),
      clicks: matchingRows.reduce((sum, entry) => sum + entry.clicks, 0)
    };
  });
  const summary = {
    importedPageCount: pages.length,
    matchedAuditPageCount: inScopePages.filter((page) => page.matchedAuditPageUrl !== null).length,
    outOfScopePageCount: pages.filter((page) => page.outOfScope).length,
    keyPagesWithEvidence,
    keyPagesWithoutEvidence: Math.max(keyPages.length - keyPagesWithEvidence, 0),
    pagesWithClicks: inScopePages.filter((page) => page.hasClicks).length,
    pagesWithImpressions: inScopePages.filter((page) => page.hasEvidence).length,
    totalClicks: inScopePages.reduce((sum, page) => sum + page.clicks, 0),
    totalImpressions: inScopePages.reduce((sum, page) => sum + page.impressions, 0)
  };

  const completedAt = new Date().toISOString();
  const run: RunMetadata = {
    ...auditForValidation.run,
    id: randomUUID(),
    mode: "validation-import",
    createdAt: auditForValidation.run.createdAt,
    completedAt,
    artifactVersion: ARTIFACT_VERSION,
    ruleVersion: RULE_VERSION,
    sampleCount: summary.importedPageCount,
    locale: null,
    validationSource: "search-console"
  };

  return {
    audit: {
      ...auditForValidation,
      run,
      site: {
        ...auditForValidation.site,
        generatedAt: completedAt
      }
    },
    validation: {
      run,
      site: {
        ...auditForValidation.site,
        generatedAt: completedAt
      },
      source: {
        type: "search-console",
        input: inputPath,
        format: "csv"
      },
      summary,
      findings,
      keyPageCoverage,
      topPages: [...inScopePages]
        .sort((left, right) => right.impressions - left.impressions || right.clicks - left.clicks || left.page.localeCompare(right.page))
        .slice(0, 10),
      pages
    }
  };
}
