import type { PageRecord, PageType } from "../types.ts";
import { keywordTokens, unique } from "../utils.ts";
import { addIssue, compactEvidence, defineFinalRule, isKeyPage } from "./registry.ts";

const GENERIC_ANCHORS = new Set(["learn more", "read more", "more", "details", "click here", "here"]);

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function pageTypeKeywords(page: PageRecord): string[] {
  switch (page.pageType) {
    case "pricing":
      return ["pricing", "plan", "cost", "quote", "定价", "价格", "费用", "成本", "报价", "方案"];
    case "security":
      return ["security", "compliance", "trust", "sso", "audit", "安全", "合规", "信任", "审计", "密钥"];
    case "docs":
      return ["docs", "documentation", "api", "guide", "quickstart", "文档", "指南", "快速开始", "说明", "配置"];
    case "faq":
      return ["faq", "question", "answer", "support", "问题", "问答", "回答", "支持"];
    case "compare":
      return ["compare", "alternative", "versus", "vs", "evaluate", "对比", "比较", "替代", "差异", "评估"];
    case "integrations":
      return ["integration", "integrations", "connect", "slack", "segment", "warehouse", "api", "集成", "接入", "连接", "工作流"];
    case "use-case":
      return unique([
        ...keywordTokens(`${page.title} ${page.h1}`),
        "workflow",
        "team",
        "teams",
        "use",
        "case",
        "solution",
        "rollout",
        "onboarding",
        "使用场景",
        "场景",
        "团队",
        "产品营销",
        "开发者关系",
        "开源维护者",
        "接入"
      ]);
    default:
      return [];
  }
}

function keywordMatch(value: string, keywords: string[]): boolean {
  const normalized = normalizeText(value);
  return keywords.some((keyword) => normalized.includes(keyword));
}

function isGenericAnchor(anchorText: string, page: PageRecord): boolean {
  const normalized = normalizeText(anchorText);
  if (!normalized) {
    return true;
  }

  if (keywordMatch(normalized, pageTypeKeywords(page))) {
    return false;
  }

  if (GENERIC_ANCHORS.has(normalized)) {
    return true;
  }

  const words = normalized.split(/\s+/).filter(Boolean);
  return words.length === 1 && words[0].length <= 3;
}

function isInformativeAnchor(anchorText: string, page: PageRecord): boolean {
  const normalized = normalizeText(anchorText);
  if (!normalized || isGenericAnchor(normalized, page)) {
    return false;
  }

  if (keywordMatch(normalized, pageTypeKeywords(page))) {
    return true;
  }

  return normalized.split(/\s+/).length >= 2 || normalized.length >= 8;
}

function hasSupportiveContext(sourceContext: string, page: PageRecord): boolean {
  const normalized = normalizeText(sourceContext);
  if (!normalized) {
    return false;
  }

  return keywordMatch(normalized, pageTypeKeywords(page));
}

function pageSeverity(pageType: PageType): "warn" | "info" {
  return ["pricing", "security", "docs", "faq", "compare"].includes(pageType) ? "warn" : "info";
}

function incomingLinkThreshold(pageType: PageType): number {
  return ["faq", "compare", "integrations", "use-case"].includes(pageType) ? 2 : 1;
}

export const discoverabilityRules = [
  defineFinalRule("internal-link-discoverability", (context) => {
    const { issues, pages, incomingLinks } = context;
    const keyPages = pages.filter(
      (page) =>
        isKeyPage(page) &&
        ["pricing", "security", "docs", "faq", "compare", "integrations", "use-case"].includes(page.pageType)
    );

    for (const page of keyPages) {
      const records = incomingLinks.get(page.url) ?? [];
      const incomingSourceCount = unique(records.map((record) => record.sourceUrl)).length;
      const explainableCount = records.filter(
        (record) => isInformativeAnchor(record.anchorText, page) || hasSupportiveContext(record.sourceContext, page)
      ).length;
      const informativeAnchors = records.filter((record) => isInformativeAnchor(record.anchorText, page));
      const supportiveContexts = records.filter((record) => hasSupportiveContext(record.sourceContext, page));
      const severity = pageSeverity(page.pageType);
      const minIncomingLinks = incomingLinkThreshold(page.pageType);

      if (incomingSourceCount < minIncomingLinks || explainableCount === 0) {
        addIssue(issues, {
          severity,
          scope: "page",
          category: "coverage",
          bucket: "comparativeReadiness",
          title: "Key proof page is weakly linked",
          message: `The ${page.pageType} page has ${incomingSourceCount}/${minIncomingLinks} meaningful incoming links from other crawled pages.`,
          fixHint: "Add links from the homepage, docs, product, or adjacent proof pages using descriptive anchors.",
          pageUrl: page.url,
          evidence:
            records.length > 0
              ? `Incoming links: ${compactEvidence(records.map((record) => `${record.anchorText} <- ${record.sourceUrl}`))}`
              : undefined
        });
      }

      if (records.length > 0 && informativeAnchors.length === 0) {
        addIssue(issues, {
          severity,
          scope: "page",
          category: "coverage",
          bucket: "comparativeReadiness",
          title: "Anchor text is generic for proof page",
          message: "Incoming links exist, but their anchor text does not explain why this proof page matters.",
          fixHint: "Use anchors that name the page purpose directly, such as Pricing, Security, FAQ, Compare, or integration-specific language.",
          pageUrl: page.url,
          evidence: compactEvidence(records.map((record) => record.anchorText))
        });
      }

      if (records.length > 0 && supportiveContexts.length === 0) {
        addIssue(issues, {
          severity,
          scope: "page",
          category: "coverage",
          bucket: "comparativeReadiness",
          title: "Proof page lacks contextual support",
          message: "Other pages link here, but the surrounding copy does not explain the proof value of this destination.",
          fixHint: "Add nearby copy that frames why buyers or evaluators should visit this proof page.",
          pageUrl: page.url,
          evidence: compactEvidence(records.map((record) => record.sourceContext))
        });
      }
    }
  })
];
