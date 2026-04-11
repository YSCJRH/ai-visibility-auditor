import type { Citation, EvalRequest, ProviderResponse, ProviderRunOptions, SearchResult } from "./contracts.ts";
import { normalizeDomain, unique } from "../../core/src/utils.ts";

const DEFAULT_BASE_URL = "https://api.perplexity.ai";
const DEFAULT_MODEL = "sonar";

function buildMessages(prompt: string, locale?: string): Array<{ role: "system" | "user"; content: string }> {
  return [
    {
      role: "system",
      content: [
        "You are evaluating public-web AI visibility for a product website.",
        "Answer concisely, compare products when relevant, and rely on public web sources.",
        locale ? `Preferred locale: ${locale}.` : null
      ]
        .filter(Boolean)
        .join(" ")
    },
    {
      role: "user",
      content: prompt
    }
  ];
}

function normalizeCitation(url: string, title: string | undefined, brandDomain: string, trustedDomains: string[]): Citation {
  const domain = normalizeDomain(url);
  const owned = domain === brandDomain || domain.endsWith(`.${brandDomain}`);
  const trusted = trustedDomains.some((candidate) => domain === candidate || domain.endsWith(`.${candidate}`));

  return {
    url,
    domain,
    title,
    owned,
    trusted
  };
}

function parseAnswerText(payload: any): string {
  return payload?.choices?.[0]?.message?.content?.trim?.() ?? "";
}

function parseSearchResults(payload: any): SearchResult[] {
  const searchResults = Array.isArray(payload?.search_results) ? payload.search_results : [];
  return searchResults
    .filter((entry: any) => typeof entry?.url === "string")
    .map(
      (entry: any) =>
        ({
          url: entry.url,
          title: typeof entry.title === "string" ? entry.title : undefined,
          date:
            typeof entry.date === "string"
              ? entry.date
              : typeof entry.last_updated === "string"
                ? entry.last_updated
                : undefined,
          snippet: typeof entry.snippet === "string" ? entry.snippet : undefined,
          source: typeof entry.source === "string" ? entry.source : "web"
        }) satisfies SearchResult
    );
}

function parseCitations(payload: any, brandDomain: string, trustedDomains: string[]): Citation[] {
  const searchResults = parseSearchResults(payload);
  const byUrl = new Map(searchResults.map((result) => [result.url, result]));
  const rawCitations: string[] = Array.isArray(payload?.citations)
    ? payload.citations.filter((url: unknown): url is string => typeof url === "string")
    : [];
  const citations = rawCitations.map((url) => normalizeCitation(url, byUrl.get(url)?.title, brandDomain, trustedDomains));
  const dedupedUrls = unique(citations.map((citation: Citation) => citation.url));
  return dedupedUrls.map((url) => citations.find((citation: Citation) => citation.url === url) as Citation);
}

export async function runPerplexityEval(request: EvalRequest, options: ProviderRunOptions = {}): Promise<ProviderResponse> {
  const apiKey = options.apiKey ?? process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    throw new Error("Missing PERPLEXITY_API_KEY for Perplexity eval runs.");
  }

  const brandDomain = normalizeDomain(request.brandDomain);
  const trustedDomains = unique(request.trustedDomains.map((domain) => normalizeDomain(domain)));
  const baseUrl = (options.baseUrl ?? process.env.ANSWERLENS_PERPLEXITY_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const model = options.model ?? process.env.ANSWERLENS_PERPLEXITY_MODEL ?? DEFAULT_MODEL;
  const timeoutMs = options.timeoutMs ?? 60_000;
  const locale = options.locale ?? request.locale ?? null;
  const sampleIndex = options.sampleIndex ?? request.sampleIndex ?? 0;
  const runCount = options.runCount ?? request.runCount ?? 1;
  const holdout = options.holdout ?? request.holdout ?? false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}/v1/sonar`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: buildMessages(request.prompt, locale ?? undefined),
        temperature: 0.1
      }),
      signal: controller.signal
    });

    const rawPayload = await response.json();
    if (!response.ok) {
      throw new Error(`Perplexity eval failed with ${response.status}: ${JSON.stringify(rawPayload)}`);
    }

    return {
      provider: "perplexity",
      model,
      promptId: request.promptId,
      answerText: parseAnswerText(rawPayload),
      citations: parseCitations(rawPayload, brandDomain, trustedDomains),
      searchResults: parseSearchResults(rawPayload),
      rawPayload,
      requestedAt: new Date().toISOString(),
      locale,
      sampleIndex,
      runCount,
      holdout,
      rankPosition: null
    };
  } finally {
    clearTimeout(timer);
  }
}
