import path from "node:path";
import type { ProviderResponse } from "../../providers/src/contracts.ts";
import type { AuditResult, BrandConfig, CompetitorsConfig, PromptCase, PromptsConfig } from "./types.ts";
import { clamp, keywordCoverage } from "./utils.ts";

export interface EvalPromptScores {
  mention: number;
  ownedCitation: number;
  trustedCitation: number;
  recommendation: number;
  accuracy: number;
  signalAlignment: number;
  vavr: number;
}

export interface EvalPromptResult {
  promptId: string;
  category: string;
  priority: "high" | "medium" | "low";
  prompt: string;
  expectedSignal: string;
  provider: ProviderResponse["provider"];
  model: string;
  answerText: string;
  citations: ProviderResponse["citations"];
  searchResults: ProviderResponse["searchResults"];
  rawPayloadFile: string;
  matchedFacts: string[];
  recommended: boolean;
  scores: EvalPromptScores;
}

export interface EvalSummary {
  promptCount: number;
  mentionRate: number;
  ownedCitationRate: number;
  trustedCitationRate: number;
  recommendationRate: number;
  accuracyRate: number;
  vavr: number;
}

export interface ContentBrief {
  id: string;
  type: "faq" | "compare" | "use-case";
  title: string;
  audience: string;
  angle: string;
  outline: string[];
  claims: string[];
  cta: string;
}

export interface EvalResult {
  site: AuditResult["site"];
  provider: {
    name: ProviderResponse["provider"];
    model: string;
  };
  generatedAt: string;
  audit: {
    overallScore: number;
    scores: AuditResult["scores"];
    missingPageTypes: string[];
  };
  summary: EvalSummary;
  prompts: EvalPromptResult[];
  briefs: ContentBrief[];
}

export interface ScoreEvalInput {
  brand: BrandConfig;
  competitors: CompetitorsConfig;
  prompts: PromptsConfig;
  audit: AuditResult;
  responses: ProviderResponse[];
  rawPayloadRoot: string;
}

const PRIORITY_WEIGHTS: Record<"high" | "medium" | "low", number> = {
  high: 1.5,
  medium: 1,
  low: 0.75
};

const RECOMMENDATION_KEYWORDS = [
  "recommend",
  "recommended",
  "best",
  "better fit",
  "good fit",
  "strong choice",
  "top choice",
  "worth considering",
  "shortlist"
];

function mentionBrand(answerText: string, brandName: string): boolean {
  return answerText.toLowerCase().includes(brandName.toLowerCase());
}

function hasRecommendation(answerText: string): boolean {
  const haystack = answerText.toLowerCase();
  return RECOMMENDATION_KEYWORDS.some((keyword) => haystack.includes(keyword));
}

function factStrings(brand: BrandConfig): string[] {
  return [
    `${brand.brand.name} is a ${brand.brand.category}.`,
    brand.brand.one_liner,
    ...brand.brand.canonical_facts.map((fact) => fact.text)
  ];
}

function computeAccuracy(answerText: string, brand: BrandConfig): { score: number; matchedFacts: string[] } {
  const facts = factStrings(brand);
  const ranked = facts
    .map((fact) => ({
      fact,
      coverage: keywordCoverage(answerText, fact)
    }))
    .sort((left, right) => right.coverage - left.coverage);

  const matchedFacts = ranked.filter((entry) => entry.coverage >= 0.5).map((entry) => entry.fact);
  const strongest = ranked.slice(0, 2);
  if (strongest.length === 0) {
    return { score: 0, matchedFacts };
  }

  return {
    score: clamp(strongest.reduce((sum, entry) => sum + entry.coverage, 0) / strongest.length, 0, 1),
    matchedFacts
  };
}

function scoreSignalAlignment(promptCase: PromptCase, scores: EvalPromptScores): number {
  if (promptCase.expected_signal === "mention_or_recommend") {
    return (scores.mention + scores.recommendation) / 2;
  }

  if (promptCase.expected_signal === "mention_position_accuracy") {
    return (scores.mention + scores.accuracy) / 2;
  }

  return (scores.mention + scores.ownedCitation + scores.recommendation) / 3;
}

function computePromptScores(promptCase: PromptCase, response: ProviderResponse, brand: BrandConfig): Omit<EvalPromptScores, "signalAlignment"> & {
  matchedFacts: string[];
  recommended: boolean;
} {
  const mention = mentionBrand(response.answerText, brand.brand.name) ? 1 : 0;
  const ownedCitation = response.citations.some((citation) => citation.owned) ? 1 : 0;
  const trustedCitation = response.citations.some((citation) => citation.trusted) ? 1 : 0;
  const recommended = mention === 1 && hasRecommendation(response.answerText);
  const recommendation = recommended ? 1 : 0;
  const accuracyResult = mention === 0 ? { score: 0, matchedFacts: [] } : computeAccuracy(response.answerText, brand);
  const vavr = clamp(
    mention * 0.3 + ownedCitation * 0.25 + trustedCitation * 0.15 + recommendation * 0.15 + accuracyResult.score * 0.15,
    0,
    1
  );

  return {
    mention,
    ownedCitation,
    trustedCitation,
    recommendation,
    accuracy: accuracyResult.score,
    vavr,
    matchedFacts: accuracyResult.matchedFacts,
    recommended
  };
}

function roundPercent(value: number): number {
  return Math.round(value * 100);
}

function weightedAverage(values: Array<{ value: number; weight: number }>): number {
  const totalWeight = values.reduce((sum, entry) => sum + entry.weight, 0);
  if (totalWeight === 0) {
    return 0;
  }

  return values.reduce((sum, entry) => sum + entry.value * entry.weight, 0) / totalWeight;
}

function createFaqBrief(audit: AuditResult, brand: BrandConfig): ContentBrief {
  const issues = audit.issues
    .filter((issue) => issue.category === "coverage" || issue.category === "evidence")
    .slice(0, 3)
    .map((issue) => issue.title);

  return {
    id: "faq-brief",
    type: "faq",
    title: `${brand.brand.name} FAQ outline`,
    audience: brand.brand.target_personas[0] ?? "product and growth teams",
    angle: "Answer the recurring evaluation and trust questions that an AI assistant needs clear source material for.",
    outline: [
      `What does ${brand.brand.name} do and who is it for?`,
      `How does ${brand.brand.name} compare to alternatives?`,
      `What evidence proves fit, pricing clarity, and security posture?`,
      ...issues.map((issue) => `FAQ should answer: ${issue}`)
    ],
    claims: factStrings(brand).slice(0, 3),
    cta: "Link readers to pricing, security, and docs pages from the FAQ."
  };
}

function createCompareBrief(brand: BrandConfig, competitors: CompetitorsConfig): ContentBrief {
  const competitorNames = competitors.competitors.slice(0, 3).map((entry) => entry.name);
  return {
    id: "compare-brief",
    type: "compare",
    title: `${brand.brand.name} compare page outline`,
    audience: "buyers evaluating alternatives",
    angle: "Make comparison and recommendation prompts easier to satisfy with explicit fit guidance.",
    outline: [
      `Who should choose ${brand.brand.name}?`,
      `How ${brand.brand.name} differs from ${competitorNames.join(", ") || "category alternatives"}`,
      "Feature, pricing, and onboarding comparison table",
      "Decision criteria by team maturity and workflow"
    ],
    claims: [brand.brand.one_liner, ...brand.brand.canonical_facts.slice(0, 2).map((fact) => fact.text)],
    cta: "End with a buyer-path CTA to docs, pricing, and demo or trial."
  };
}

function createUseCaseBrief(brand: BrandConfig): ContentBrief {
  const primaryUseCase = brand.brand.key_use_cases[0] ?? "improve product onboarding";
  return {
    id: "use-case-brief",
    type: "use-case",
    title: `${brand.brand.name} use-case page outline`,
    audience: brand.brand.target_personas[0] ?? "teams evaluating tools",
    angle: "Turn a high-value use case into a citable page with concrete outcomes and proof points.",
    outline: [
      `Problem framing for ${primaryUseCase}`,
      `How ${brand.brand.name} solves ${primaryUseCase}`,
      "Recommended workflow or playbook",
      "Evidence, proof, and next-step CTA"
    ],
    claims: factStrings(brand).slice(0, 3),
    cta: "Link to a use-case-specific demo, docs path, or onboarding guide."
  };
}

export function buildContentBriefs(
  audit: AuditResult,
  brand: BrandConfig,
  competitors: CompetitorsConfig
): ContentBrief[] {
  const briefs: ContentBrief[] = [];
  const missing = new Set(audit.summary.missingPageTypes);

  if (missing.has("faq") || audit.issues.some((issue) => issue.category === "evidence")) {
    briefs.push(createFaqBrief(audit, brand));
  }

  if (missing.has("compare") || audit.issues.some((issue) => issue.category === "comparison")) {
    briefs.push(createCompareBrief(brand, competitors));
  }

  if (missing.has("use-case") || audit.issues.some((issue) => issue.title === "Use-case coverage is thin")) {
    briefs.push(createUseCaseBrief(brand));
  }

  return briefs;
}

export function scoreEvalResponses(input: ScoreEvalInput): EvalResult {
  const promptLookup = new Map(input.prompts.prompts.map((promptCase) => [promptCase.id, promptCase]));
  const promptResults = input.responses.map((response) => {
    const promptCase = promptLookup.get(response.promptId);
    if (!promptCase) {
      throw new Error(`No prompt config found for provider response ${response.promptId}`);
    }

    const computed = computePromptScores(promptCase, response, input.brand);
    const scores: EvalPromptScores = {
      mention: computed.mention,
      ownedCitation: computed.ownedCitation,
      trustedCitation: computed.trustedCitation,
      recommendation: computed.recommendation,
      accuracy: computed.accuracy,
      signalAlignment: 0,
      vavr: computed.vavr
    };
    scores.signalAlignment = scoreSignalAlignment(promptCase, scores);

    return {
      promptId: promptCase.id,
      category: promptCase.category,
      priority: promptCase.priority ?? "medium",
      prompt: promptCase.template,
      expectedSignal: promptCase.expected_signal,
      provider: response.provider,
      model: response.model,
      answerText: response.answerText,
      citations: response.citations,
      searchResults: response.searchResults,
      rawPayloadFile: path.join(input.rawPayloadRoot, response.provider, `${promptCase.id}.json`),
      matchedFacts: computed.matchedFacts,
      recommended: computed.recommended,
      scores
    } satisfies EvalPromptResult;
  });

  const weighted = promptResults.map((result) => ({
    weight: PRIORITY_WEIGHTS[result.priority],
    result
  }));

  const summary: EvalSummary = {
    promptCount: promptResults.length,
    mentionRate: roundPercent(weightedAverage(weighted.map((entry) => ({ value: entry.result.scores.mention, weight: entry.weight })))),
    ownedCitationRate: roundPercent(weightedAverage(weighted.map((entry) => ({ value: entry.result.scores.ownedCitation, weight: entry.weight })))),
    trustedCitationRate: roundPercent(weightedAverage(weighted.map((entry) => ({ value: entry.result.scores.trustedCitation, weight: entry.weight })))),
    recommendationRate: roundPercent(weightedAverage(weighted.map((entry) => ({ value: entry.result.scores.recommendation, weight: entry.weight })))),
    accuracyRate: roundPercent(weightedAverage(weighted.map((entry) => ({ value: entry.result.scores.accuracy, weight: entry.weight })))),
    vavr: roundPercent(weightedAverage(weighted.map((entry) => ({ value: entry.result.scores.vavr, weight: entry.weight }))))
  };

  return {
    site: input.audit.site,
    provider: {
      name: promptResults[0]?.provider ?? "openai",
      model: promptResults[0]?.model ?? "unknown"
    },
    generatedAt: new Date().toISOString(),
    audit: {
      overallScore: input.audit.summary.overallScore,
      scores: input.audit.scores,
      missingPageTypes: input.audit.summary.missingPageTypes
    },
    summary,
    prompts: promptResults,
    briefs: buildContentBriefs(input.audit, input.brand, input.competitors)
  };
}

export function summarizeEvalDiff(current: EvalResult, previous: EvalResult | null): Array<{
  label: string;
  current: number;
  previous: number | null;
  delta: number | null;
}> {
  const metrics = [
    ["VAVR", current.summary.vavr, previous?.summary.vavr ?? null],
    ["Mention rate", current.summary.mentionRate, previous?.summary.mentionRate ?? null],
    ["Owned citation rate", current.summary.ownedCitationRate, previous?.summary.ownedCitationRate ?? null],
    ["Trusted citation rate", current.summary.trustedCitationRate, previous?.summary.trustedCitationRate ?? null],
    ["Recommendation rate", current.summary.recommendationRate, previous?.summary.recommendationRate ?? null],
    ["Accuracy rate", current.summary.accuracyRate, previous?.summary.accuracyRate ?? null]
  ] as const;

  return metrics.map(([label, currentValue, previousValue]) => ({
    label,
    current: currentValue,
    previous: previousValue,
    delta: previousValue === null ? null : currentValue - previousValue
  }));
}

export function applyEvalSummaryToAudit(audit: AuditResult, vavr: number): AuditResult {
  return {
    ...audit,
    summary: {
      ...audit.summary,
      vavr
    }
  };
}
