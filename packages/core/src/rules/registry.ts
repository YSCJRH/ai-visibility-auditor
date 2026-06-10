import { KEY_PAGE_TYPES } from "../constants.ts";
import type {
  AuditInput,
  CrawlResult,
  Issue,
  PageRecord,
  PageType
} from "../types.ts";
import { slugify } from "../utils.ts";

export interface IncomingLinkReference {
  sourceUrl: string;
  sourcePageType: PageType;
  url: string;
  anchorText: string;
  sourceContext: string;
}

export interface AuditContext {
  input: AuditInput;
  crawl: CrawlResult;
  pages: PageRecord[];
  issues: Issue[];
  pageTypes: Map<PageType, PageRecord[]>;
  byUrl: Map<string, PageRecord>;
  incomingLinks: Map<string, IncomingLinkReference[]>;
  missingPageTypes: string[];
}

export type EvidenceGroup = {
  label: string;
  signals: string[];
};

export interface SiteRule {
  id: string;
  run(context: AuditContext): void;
}

export interface PageRule {
  id: string;
  run(context: AuditContext, page: PageRecord): void;
}

export interface FinalRule {
  id: string;
  run(context: AuditContext): void;
}

export function defineSiteRule(id: string, run: SiteRule["run"]): SiteRule {
  return { id, run };
}

export function definePageRule(id: string, run: PageRule["run"]): PageRule {
  return { id, run };
}

export function defineFinalRule(id: string, run: FinalRule["run"]): FinalRule {
  return { id, run };
}

export function runSiteRules(rules: SiteRule[], context: AuditContext): void {
  for (const rule of rules) {
    rule.run(context);
  }
}

export function runPageRules(rules: PageRule[], context: AuditContext, page: PageRecord): void {
  for (const rule of rules) {
    rule.run(context, page);
  }
}

export function runFinalRules(rules: FinalRule[], context: AuditContext): void {
  for (const rule of rules) {
    rule.run(context);
  }
}

export function createIssue(issue: Omit<Issue, "id">): Issue {
  const pagePart = issue.pageUrl ? `-${slugify(issue.pageUrl)}` : "";
  return {
    id: `${slugify(issue.title)}${pagePart}`,
    ...issue
  };
}

export function addIssue(issues: Issue[], issue: Omit<Issue, "id">): void {
  issues.push(createIssue(issue));
}

export function isKeyPage(page: PageRecord): boolean {
  return KEY_PAGE_TYPES.includes(page.pageType);
}

export function pageText(page: PageRecord): string {
  return `${page.title} ${page.metaDescription} ${page.h1} ${page.headings.join(" ")} ${page.textSnippet}`.trim();
}

export function signalExamples(page: PageRecord, type: string): string[] {
  return page.evidenceSignals.find((signal) => signal.type === type)?.examples ?? [];
}

export function hasEvidenceSignal(page: PageRecord, ...types: string[]): boolean {
  return types.some((type) => (page.evidenceSignals.find((signal) => signal.type === type)?.count ?? 0) > 0);
}

export function compactEvidence(values: string[]): string {
  return values.filter(Boolean).slice(0, 3).join("; ");
}

export function summarizeMissingGroups(page: PageRecord, groups: EvidenceGroup[]): string[] {
  return groups
    .filter((group) => !hasEvidenceSignal(page, ...group.signals))
    .map((group) => group.label);
}

export function summarizePresentSignals(page: PageRecord, groups: EvidenceGroup[]): string[] {
  return groups
    .filter((group) => hasEvidenceSignal(page, ...group.signals))
    .map((group) => {
      const examples = group.signals.flatMap((signal) => signalExamples(page, signal));
      return examples.length > 0 ? `${group.label}: ${compactEvidence(examples)}` : group.label;
    });
}
