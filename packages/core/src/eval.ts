import path from "node:path";
import type { ProviderResponse } from "../../providers/src/contracts.ts";
import type { AuditResult, BrandConfig, CompetitorsConfig, PromptCase, PromptsConfig, RunMetadata, RunMode } from "./types.ts";
import { clamp, keywordCoverage, unique } from "./utils.ts";

export interface EvalPromptScores {
  mention: number;
  accurateMention: number;
  ownedCitation: number;
  trustedCitation: number;
  recommendation: number;
  accuracy: number;
  factCoverage: number;
  misrepresented: number;
  competitorExcluded: number;
  signalAlignment: number;
  vavr: number;
}

export interface EvalPromptResult {
  promptId: string;
  category: string;
  priority: "high" | "medium" | "low";
  prompt: string;
  expectedSignal: string;
  intent: string | null;
  holdout: boolean;
  provider: ProviderResponse["provider"];
  model: string;
  locale: string | null;
  sampleIndex: number;
  rankPosition: number | null;
  answerText: string;
  citations: ProviderResponse["citations"];
  searchResults: ProviderResponse["searchResults"];
  rawPayloadFile: string;
  matchedFacts: string[];
  competitorMentions: string[];
  recommended: boolean;
  misrepresented: boolean;
  scores: EvalPromptScores;
}

export interface EvalSummary {
  promptCount: number;
  holdoutPromptCount: number;
  sampleCount: number;
  locale: string | null;
  mentionRate: number;
  accurateMentionRate: number;
  ownedCitationRate: number;
  trustedCitationRate: number;
  recommendationRate: number;
  misrepresentationRate: number;
  competitorExclusionGap: number;
  factCoverageScore: number;
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
  run: RunMetadata;
  site: AuditResult["site"];
  provider: {
    name: string;
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
  mode?: Extract<RunMode, "eval" | "manual-import">;
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

function computeAccuracy(answerText: string, brand: BrandConfig): { score: number; matchedFacts: string[]; factCoverage: number } {
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
    return { score: 0, matchedFacts, factCoverage: 0 };
  }

  return {
    score: clamp(strongest.reduce((sum, entry) => sum + entry.coverage, 0) / strongest.length, 0, 1),
    matchedFacts,
    factCoverage: clamp(matchedFacts.length / Math.max(facts.length, 1), 0, 1)
  };
}

function mentionedCompetitors(answerText: string, competitors: CompetitorsConfig): string[] {
  const haystack = answerText.toLowerCase();
  return competitors.competitors
    .map((competitor) => competitor.name)
    .filter((name) => haystack.includes(name.toLowerCase()));
}

function scoreSignalAlignment(promptCase: PromptCase, scores: EvalPromptScores): number {
  if (promptCase.expected_signal === "mention_or_recommend") {
    return (scores.accurateMention + scores.recommendation) / 2;
  }

  if (promptCase.expected_signal === "mention_position_accuracy") {
    return (scores.accurateMention + scores.accuracy) / 2;
  }

  if (promptCase.expected_signal === "citation_and_presence" || promptCase.expected_signal === "mention_or_citation") {
    return (scores.accurateMention + Math.max(scores.ownedCitation, scores.trustedCitation)) / 2;
  }

  if (promptCase.expected_signal === "brand_accuracy" || promptCase.expected_signal === "brand_accuracy_balance") {
    return (scores.accurateMention + scores.factCoverage + (1 - scores.misrepresented)) / 3;
  }

  return (scores.accurateMention + Math.max(scores.ownedCitation, scores.trustedCitation) + scores.recommendation) / 3;
}

function rawPayloadFilePath(rawPayloadRoot: string, response: ProviderResponse): string {
  const suffix = response.sampleIndex > 0 ? `--sample-${response.sampleIndex + 1}` : "";
  return path.join(rawPayloadRoot, response.provider, `${response.promptId}${suffix}.json`);
}

function computePromptScores(
  promptCase: PromptCase,
  response: ProviderResponse,
  brand: BrandConfig,
  competitors: CompetitorsConfig
): {
  scores: Omit<EvalPromptScores, "signalAlignment">;
  matchedFacts: string[];
  recommended: boolean;
  misrepresented: boolean;
  competitorMentions: string[];
} {
  const mention = mentionBrand(response.answerText, brand.brand.name) ? 1 : 0;
  const ownedCitation = response.citations.some((citation) => citation.owned) ? 1 : 0;
  const trustedCitation = response.citations.some((citation) => citation.trusted) ? 1 : 0;
  const recommended = mention === 1 && hasRecommendation(response.answerText);
  const recommendation = recommended ? 1 : 0;
  const accuracyResult = mention === 0 ? { score: 0, matchedFacts: [], factCoverage: 0 } : computeAccuracy(response.answerText, brand);
  const accurateMention = mention === 1 && accuracyResult.score >= 0.5 ? 1 : 0;
  const misrepresented = mention === 1 && accuracyResult.score < 0.35;
  const competitorMentions = mentionedCompetitors(response.answerText, competitors);
  const competitorExcluded = mention === 0 && competitorMentions.length > 0 ? 1 : 0;
  const vavr = accurateMention === 1 && (ownedCitation === 1 || trustedCitation === 1) ? 1 : 0;

  return {
    scores: {
      mention,
      accurateMention,
      ownedCitation,
      trustedCitation,
      recommendation,
      accuracy: accuracyResult.score,
      factCoverage: accuracyResult.factCoverage,
      misrepresented: misrepresented ? 1 : 0,
      competitorExcluded,
      vavr
    },
    matchedFacts: accuracyResult.matchedFacts,
    recommended,
    misrepresented,
    competitorMentions
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

function averagePromptGroup(results: EvalPromptResult[], promptCase: PromptCase): { weight: number; values: EvalPromptScores } {
  const average = (selector: (result: EvalPromptResult) => number) =>
    results.reduce((sum, result) => sum + selector(result), 0) / Math.max(results.length, 1);

  return {
    weight: PRIORITY_WEIGHTS[promptCase.priority ?? "medium"],
    values: {
      mention: average((result) => result.scores.mention),
      accurateMention: average((result) => result.scores.accurateMention),
      ownedCitation: average((result) => result.scores.ownedCitation),
      trustedCitation: average((result) => result.scores.trustedCitation),
      recommendation: average((result) => result.scores.recommendation),
      accuracy: average((result) => result.scores.accuracy),
      factCoverage: average((result) => result.scores.factCoverage),
      misrepresented: average((result) => result.scores.misrepresented),
      competitorExcluded: average((result) => result.scores.competitorExcluded),
      signalAlignment: average((result) => result.scores.signalAlignment),
      vavr: average((result) => result.scores.vavr)
    }
  };
}

export function scoreEvalResponses(input: ScoreEvalInput): EvalResult {
  const promptLookup = new Map(input.prompts.prompts.map((promptCase) => [promptCase.id, promptCase]));
  const promptResults = input.responses.map((response) => {
    const promptCase = promptLookup.get(response.promptId);
    if (!promptCase) {
      throw new Error(`No prompt config found for provider response ${response.promptId}`);
    }

    const computed = computePromptScores(promptCase, response, input.brand, input.competitors);
    const scores: EvalPromptScores = {
      ...computed.scores,
      signalAlignment: 0
    };
    scores.signalAlignment = scoreSignalAlignment(promptCase, scores);

    return {
      promptId: promptCase.id,
      category: promptCase.category,
      priority: promptCase.priority ?? "medium",
      prompt: promptCase.template,
      expectedSignal: promptCase.expected_signal,
      intent: promptCase.intent ?? null,
      holdout: promptCase.holdout ?? false,
      provider: response.provider,
      model: response.model,
      locale: response.locale ?? promptCase.locale ?? null,
      sampleIndex: response.sampleIndex,
      rankPosition: response.rankPosition,
      answerText: response.answerText,
      citations: response.citations,
      searchResults: response.searchResults,
      rawPayloadFile: rawPayloadFilePath(input.rawPayloadRoot, response),
      matchedFacts: computed.matchedFacts,
      competitorMentions: computed.competitorMentions,
      recommended: computed.recommended,
      misrepresented: computed.misrepresented,
      scores
    } satisfies EvalPromptResult;
  });

  const promptGroups = new Map<string, EvalPromptResult[]>();
  for (const result of promptResults) {
    const current = promptGroups.get(result.promptId) ?? [];
    current.push(result);
    promptGroups.set(result.promptId, current);
  }

  const activeGroups = [...promptGroups.entries()]
    .map(([promptId, results]) => ({ promptId, results, promptCase: promptLookup.get(promptId)! }))
    .filter((entry) => !entry.promptCase.holdout);
  const holdoutGroups = [...promptGroups.entries()]
    .map(([promptId, results]) => ({ promptId, results, promptCase: promptLookup.get(promptId)! }))
    .filter((entry) => entry.promptCase.holdout);
  const weighted = activeGroups.map((entry) => averagePromptGroup(entry.results, entry.promptCase));
  const localeCandidates = unique(promptResults.map((result) => result.locale).filter((value): value is string => Boolean(value)));

  const summary: EvalSummary = {
    promptCount: activeGroups.length,
    holdoutPromptCount: holdoutGroups.length,
    sampleCount: promptResults.length,
    locale: localeCandidates.length === 1 ? localeCandidates[0] : localeCandidates.length > 1 ? "mixed" : null,
    mentionRate: roundPercent(weightedAverage(weighted.map((entry) => ({ value: entry.values.mention, weight: entry.weight })))),
    accurateMentionRate: roundPercent(weightedAverage(weighted.map((entry) => ({ value: entry.values.accurateMention, weight: entry.weight })))),
    ownedCitationRate: roundPercent(weightedAverage(weighted.map((entry) => ({ value: entry.values.ownedCitation, weight: entry.weight })))),
    trustedCitationRate: roundPercent(weightedAverage(weighted.map((entry) => ({ value: entry.values.trustedCitation, weight: entry.weight })))),
    recommendationRate: roundPercent(weightedAverage(weighted.map((entry) => ({ value: entry.values.recommendation, weight: entry.weight })))),
    misrepresentationRate: roundPercent(weightedAverage(weighted.map((entry) => ({ value: entry.values.misrepresented, weight: entry.weight })))),
    competitorExclusionGap: roundPercent(weightedAverage(weighted.map((entry) => ({ value: entry.values.competitorExcluded, weight: entry.weight })))),
    factCoverageScore: roundPercent(weightedAverage(weighted.map((entry) => ({ value: entry.values.factCoverage, weight: entry.weight })))),
    accuracyRate: roundPercent(weightedAverage(weighted.map((entry) => ({ value: entry.values.accuracy, weight: entry.weight })))),
    vavr: roundPercent(weightedAverage(weighted.map((entry) => ({ value: entry.values.vavr, weight: entry.weight }))))
  };

  const generatedAt = new Date().toISOString();

  return {
    run: {
      ...input.audit.run,
      mode: input.mode ?? "eval",
      completedAt: generatedAt,
      sampleCount: promptResults.length,
      locale: summary.locale
    },
    site: input.audit.site,
    provider: {
      name: unique(promptResults.map((result) => result.provider)).join(", ") || "openai",
      model: unique(promptResults.map((result) => result.model)).join(", ") || "unknown"
    },
    generatedAt,
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
    ["Accurate mention rate", current.summary.accurateMentionRate, previous?.summary.accurateMentionRate ?? null],
    ["Owned citation rate", current.summary.ownedCitationRate, previous?.summary.ownedCitationRate ?? null],
    ["Trusted citation rate", current.summary.trustedCitationRate, previous?.summary.trustedCitationRate ?? null],
    ["Recommendation rate", current.summary.recommendationRate, previous?.summary.recommendationRate ?? null],
    ["Misrepresentation rate", current.summary.misrepresentationRate, previous?.summary.misrepresentationRate ?? null],
    ["Competitor exclusion gap", current.summary.competitorExclusionGap, previous?.summary.competitorExclusionGap ?? null],
    ["Fact coverage score", current.summary.factCoverageScore, previous?.summary.factCoverageScore ?? null],
    ["Accuracy rate", current.summary.accuracyRate, previous?.summary.accuracyRate ?? null]
  ] as const;

  return metrics.map(([label, currentValue, previousValue]) => ({
    label,
    current: currentValue,
    previous: previousValue,
    delta: previousValue === null ? null : currentValue - previousValue
  }));
}

export function applyEvalSummaryToAudit(
  audit: AuditResult,
  summary: Pick<EvalSummary, "vavr" | "sampleCount" | "locale">,
  mode: Extract<RunMode, "eval" | "manual-import"> = "eval"
): AuditResult {
  return {
    ...audit,
    run: {
      ...audit.run,
      mode,
      sampleCount: summary.sampleCount,
      locale: summary.locale,
      completedAt: new Date().toISOString()
    },
    summary: {
      ...audit.summary,
      vavr: summary.vavr
    }
  };
}
