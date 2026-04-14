import type { PageType } from "../types.ts";
import { keywordCoverage } from "../utils.ts";
import {
  addIssue,
  compactEvidence,
  definePageRule,
  hasEvidenceSignal,
  isKeyPage,
  pageText,
  summarizeMissingGroups,
  summarizePresentSignals
} from "./registry.ts";

export const pageQualityRules = [
  definePageRule("key-page-structure", (context, page) => {
    const { issues } = context;

    if (page.noindex && isKeyPage(page)) {
      addIssue(issues, {
        severity: "error",
        scope: "page",
        category: "indexability",
        bucket: "access",
        title: "Key page is noindex",
        message: "A key page contains a noindex directive.",
        fixHint: "Remove noindex from pages that should earn discovery and citations.",
        pageUrl: page.url
      });
    }

    if (!isKeyPage(page)) {
      return;
    }

    if (!page.title) {
      addIssue(issues, {
        severity: "error",
        scope: "page",
        category: "structure",
        bucket: "structure",
        title: "Missing page title",
        message: "A key page is missing a title element.",
        fixHint: "Add a descriptive page title.",
        pageUrl: page.url
      });
    }

    if (page.title.length > 0 && page.title.length < 20) {
      addIssue(issues, {
        severity: "warn",
        scope: "page",
        category: "structure",
        bucket: "structure",
        title: "Short page title",
        message: "A key page title is unusually short and low-context.",
        fixHint: "Expand the title with page purpose and product context.",
        pageUrl: page.url
      });
    }

    if (!page.metaDescription) {
      addIssue(issues, {
        severity: "warn",
        scope: "page",
        category: "structure",
        bucket: "structure",
        title: "Missing meta description",
        message: "A key page is missing a meta description.",
        fixHint: "Add a clear summary of who the page serves and what it proves.",
        pageUrl: page.url
      });
    }

    if (!page.h1) {
      addIssue(issues, {
        severity: "error",
        scope: "page",
        category: "structure",
        bucket: "structure",
        title: "Missing H1",
        message: "A key page does not have a primary heading.",
        fixHint: "Add one descriptive H1 per key page.",
        pageUrl: page.url
      });
    }

    if (page.h1Count > 1) {
      addIssue(issues, {
        severity: "warn",
        scope: "page",
        category: "structure",
        bucket: "structure",
        title: "Multiple H1 headings",
        message: "A key page contains more than one H1.",
        fixHint: "Use a single H1 and demote the rest to lower-level headings.",
        pageUrl: page.url
      });
    }

    const proofHeavyPage = ["home", "product", "pricing", "security", "docs"].includes(page.pageType);
    const compactReferencePage = ["faq", "compare", "integrations", "use-case"].includes(page.pageType);

    if ((proofHeavyPage && page.wordCount < 150) || (compactReferencePage && page.wordCount < 80 && page.lists === 0 && page.tables === 0)) {
      addIssue(issues, {
        severity: proofHeavyPage ? "warn" : "info",
        scope: "page",
        category: "structure",
        bucket: "structure",
        title: "Thin key page",
        message: "A key page has little extractable body text.",
        fixHint: "Add plain-language explanations, evidence blocks, and stronger sections.",
        pageUrl: page.url
      });
    }

    if (page.headings.length < 2) {
      addIssue(issues, {
        severity: "warn",
        scope: "page",
        category: "structure",
        bucket: "structure",
        title: "Weak heading structure",
        message: "A key page does not have enough H2/H3 sections to segment meaning clearly.",
        fixHint: "Break the page into sections with scannable headings.",
        pageUrl: page.url
      });
    }

    if (page.jsHeavy) {
      addIssue(issues, {
        severity: "warn",
        scope: "page",
        category: "structure",
        bucket: "structure",
        title: "JavaScript-heavy thin page",
        message: "A key page appears script-heavy with limited extractable HTML text.",
        fixHint: "Render critical content server-side or include HTML fallback text.",
        pageUrl: page.url
      });
    }

    if (page.interactiveControls > 0 && page.ariaLabeledControls / page.interactiveControls < 0.5) {
      addIssue(issues, {
        severity: "info",
        scope: "page",
        category: "accessibility",
        bucket: "structure",
        title: "Low ARIA coverage on controls",
        message: "Interactive controls are present but few expose aria-label metadata.",
        fixHint: "Add accessible labels to critical controls and buttons.",
        pageUrl: page.url
      });
    }
  }),
  definePageRule("schema-consistency", (context, page) => {
    const { issues, input } = context;
    const visible = pageText(page);
    const faqSchema = page.jsonLdTypes.some((type) => type.toLowerCase() === "faqpage");
    const hasProductSchema = page.jsonLdTypes.some((type) => ["product", "softwareapplication", "service"].includes(type.toLowerCase()));
    const questionSignals = page.headings.filter((heading) => heading.includes("?")).length;
    const invisibleSignals = page.schemaTextSignals.filter((signal) => !signal.visible);
    const missingNames = invisibleSignals.filter((signal) => signal.field === "name");
    const missingDescriptions = invisibleSignals.filter((signal) => signal.field === "description");
    const missingQuestions = invisibleSignals.filter((signal) => signal.field === "faq.question");
    const missingAnswers = invisibleSignals.filter((signal) => signal.field === "faq.answer");

    if (missingNames.length > 0) {
      addIssue(issues, {
        severity: "warn",
        scope: "page",
        category: "schema",
        bucket: "structure",
        title: "Structured data name is not visible",
        message: "A JSON-LD name field is not reinforced by visible page text.",
        fixHint: "Mirror the structured entity name in visible headings or supporting copy.",
        pageUrl: page.url,
        evidence: compactEvidence(missingNames.map((signal) => `${signal.recordType}.${signal.field}: ${signal.value}`))
      });
    }

    if (missingDescriptions.length > 0) {
      addIssue(issues, {
        severity: "info",
        scope: "page",
        category: "schema",
        bucket: "structure",
        title: "Structured data description is not visible",
        message: "A JSON-LD description field is not supported by visible page text.",
        fixHint: "Keep structured descriptions aligned with visible product copy.",
        pageUrl: page.url,
        evidence: compactEvidence(missingDescriptions.map((signal) => `${signal.recordType}.${signal.field}: ${signal.value}`))
      });
    }

    if (missingQuestions.length > 0) {
      addIssue(issues, {
        severity: "warn",
        scope: "page",
        category: "schema",
        bucket: "structure",
        title: "FAQ schema does not match visible questions",
        message: "FAQPage JSON-LD contains questions that do not appear as visible page text.",
        fixHint: "Use visible FAQ headings or question rows that match the JSON-LD questions.",
        pageUrl: page.url,
        evidence: compactEvidence(missingQuestions.map((signal) => signal.value))
      });
    }

    if (missingAnswers.length > 0) {
      addIssue(issues, {
        severity: "info",
        scope: "page",
        category: "schema",
        bucket: "structure",
        title: "FAQ schema answers are not visible",
        message: "FAQPage JSON-LD contains answers that are not visible on the page.",
        fixHint: "Expose the same answer text in visible FAQ content, not only structured data.",
        pageUrl: page.url,
        evidence: compactEvidence(missingAnswers.map((signal) => signal.value))
      });
    }

    if (page.pageType === "home" && !page.hasJsonLd) {
      addIssue(issues, {
        severity: "info",
        scope: "page",
        category: "schema",
        bucket: "structure",
        title: "Homepage lacks JSON-LD",
        message: "The homepage has no JSON-LD structured data.",
        fixHint: "Add Organization or Product JSON-LD that matches visible text.",
        pageUrl: page.url
      });
    }

    if (page.pageType === "faq" && !faqSchema) {
      addIssue(issues, {
        severity: "info",
        scope: "page",
        category: "schema",
        bucket: "structure",
        title: "FAQ page lacks FAQ schema",
        message: "A discovered FAQ page does not expose FAQPage structured data.",
        fixHint: "Add FAQPage JSON-LD that mirrors visible questions and answers.",
        pageUrl: page.url
      });
    }

    if (faqSchema && questionSignals === 0 && page.lists === 0) {
      addIssue(issues, {
        severity: "warn",
        scope: "page",
        category: "schema",
        bucket: "structure",
        title: "FAQ schema is not reinforced by visible Q&A structure",
        message: "FAQPage schema is present, but the page does not visibly read like a scannable FAQ.",
        fixHint: "Expose visible questions, headings, and answer sections that match the structured data.",
        pageUrl: page.url
      });
    }

    if ((page.pageType === "home" || page.pageType === "product") && hasProductSchema && keywordCoverage(visible, input.brand.brand.category) < 0.4) {
      addIssue(issues, {
        severity: "info",
        scope: "page",
        category: "schema",
        bucket: "structure",
        title: "Structured data is not reinforced by visible category text",
        message: "Product-like schema exists, but visible copy does not clearly restate the product category.",
        fixHint: "Repeat the product category and positioning in visible headings and supporting copy.",
        pageUrl: page.url
      });
    }
  }),
  definePageRule("evidence-density", (context, page) => {
    const { issues } = context;
    const requirements: Partial<
      Record<
        PageType,
        {
          title: string;
          severity: "warn" | "info";
          minGroups: number;
          groups: Array<{ label: string; signals: string[] }>;
          fixHint: string;
        }
      >
    > = {
      pricing: {
        title: "Pricing page evidence density is low",
        severity: "warn",
        minGroups: 3,
        groups: [
          { label: "numeric prices or ranges", signals: ["numbers"] },
          { label: "plan or packaging terms", signals: ["pricing-proof"] },
          { label: "tables or scannable lists", signals: ["tables", "lists"] },
          { label: "supporting body depth", signals: ["body-depth"] }
        ],
        fixHint: "Add concrete plans, ranges, packaging qualifiers, and scannable proof blocks."
      },
      security: {
        title: "Security page evidence density is low",
        severity: "warn",
        minGroups: 2,
        groups: [
          { label: "trust markers", signals: ["trust-markers"] },
          { label: "controls lists or tables", signals: ["lists", "tables"] },
          { label: "implementation or workflow detail", signals: ["workflow-proof", "body-depth"] }
        ],
        fixHint: "Add compliance markers, controls, deployment details, and buyer-facing trust answers."
      },
      docs: {
        title: "Docs page evidence density is low",
        severity: "info",
        minGroups: 2,
        groups: [
          { label: "freshness or version markers", signals: ["freshness", "versions"] },
          { label: "API, SDK, or guide terms", signals: ["docs-proof"] },
          { label: "workflow or setup detail", signals: ["workflow-proof", "lists", "tables"] }
        ],
        fixHint: "Add updated dates, versions, setup steps, API references, and example-driven documentation."
      },
      compare: {
        title: "Compare page evidence density is low",
        severity: "info",
        minGroups: 2,
        groups: [
          { label: "comparison criteria", signals: ["comparison-criteria"] },
          { label: "tables or scannable lists", signals: ["tables", "lists"] },
          { label: "pricing, docs, or proof context", signals: ["pricing-proof", "docs-proof", "trust-markers"] }
        ],
        fixHint: "Add comparison tables, decision criteria, fit guidance, and proof-oriented bullet lists."
      },
      "use-case": {
        title: "Use-case page evidence density is low",
        severity: "info",
        minGroups: 2,
        groups: [
          { label: "workflow or rollout detail", signals: ["workflow-proof"] },
          { label: "outcomes or success criteria", signals: ["outcome-proof", "numbers"] },
          { label: "supporting proof context", signals: ["pricing-proof", "docs-proof", "trust-markers", "body-depth"] }
        ],
        fixHint: "Add audience-specific workflows, before/after outcomes, and measurable success criteria."
      }
    };

    const requirement = requirements[page.pageType];
    if (!requirement) {
      return;
    }

    const missingGroups = summarizeMissingGroups(page, requirement.groups);
    const presentGroups = summarizePresentSignals(page, requirement.groups);
    const presentCount = requirement.groups.length - missingGroups.length;

    if (presentCount >= requirement.minGroups) {
      return;
    }

    addIssue(issues, {
      severity: presentCount === 0 ? "warn" : requirement.severity,
      scope: "page",
      category: "evidence",
      bucket: "evidence",
      title: requirement.title,
      message: `The ${page.pageType} page only satisfies ${presentCount}/${requirement.groups.length} expected evidence signal groups.`,
      fixHint: requirement.fixHint,
      pageUrl: page.url,
      evidence: `Missing: ${missingGroups.join(", ")}. Present: ${presentGroups.length > 0 ? presentGroups.join("; ") : "none"}.`
    });
  }),
  definePageRule("comparative-readiness", (context, page) => {
    const { issues, input } = context;
    const visible = pageText(page).toLowerCase();

    if (page.pageType === "faq") {
      const faqSignals = page.headings.filter((heading) => heading.includes("?")).length;
      if (faqSignals < 2 && page.lists === 0) {
        addIssue(issues, {
          severity: "info",
          scope: "page",
          category: "coverage",
          bucket: "comparativeReadiness",
          title: "FAQ page lacks scannable question structure",
          message: "The FAQ page exists, but it is not strongly organized around visible questions and answers.",
          fixHint: "Use explicit question headings and concise answer blocks for recurring buyer concerns.",
          pageUrl: page.url
        });
      }
    }

    if (page.pageType === "compare") {
      const mentionsCompetitor = input.competitors.competitors.some((competitor) => visible.includes(competitor.name.toLowerCase()));

      if (!mentionsCompetitor) {
        addIssue(issues, {
          severity: "warn",
          scope: "page",
          category: "comparison",
          bucket: "comparativeReadiness",
          title: "Compare page does not name declared competitors",
          message: "A compare-oriented page exists, but it does not explicitly mention any declared competitors.",
          fixHint: "Name the highest-priority competitors and explain fit differences directly on the page.",
          pageUrl: page.url
        });
      }

      if (page.headings.length < 2) {
        addIssue(issues, {
          severity: "info",
          scope: "page",
          category: "comparison",
          bucket: "comparativeReadiness",
          title: "Compare page lacks decision-making structure",
          message: "The compare page should segment trade-offs, fit guidance, and evidence into clear sections.",
          fixHint: "Add sections for buyer fit, trade-offs, migration paths, and decision criteria.",
          pageUrl: page.url
        });
      }
    }

    if (page.pageType === "use-case" && page.headings.length < 2) {
      addIssue(issues, {
        severity: "info",
        scope: "page",
        category: "coverage",
        bucket: "comparativeReadiness",
        title: "Use-case page lacks contextual structure",
        message: "A use-case page should explain problem, workflow, and outcomes in separate sections.",
        fixHint: "Add sections for the problem, the recommended workflow, and expected outcomes.",
        pageUrl: page.url
      });
    }
  })
];
