import type { Citation, EvalRequest, ProviderResponse, ProviderRunOptions, SearchResult } from "./contracts.ts";
import { normalizeDomain, unique } from "../../core/src/utils.ts";

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-5";

function buildInput(prompt: string, locale?: string): string {
  return [
    "You are evaluating public-web AI visibility for a product website.",
    "Answer concisely, compare products when relevant, and rely on public web sources.",
    locale ? `Preferred locale: ${locale}.` : null,
    `Question: ${prompt}`
  ]
    .filter(Boolean)
    .join("\n\n");
}

function normalizeCitation(raw: { url?: string; title?: string }, brandDomain: string, trustedDomains: string[]): Citation | null {
  if (!raw.url) {
    return null;
  }

  const domain = normalizeDomain(raw.url);
  const owned = domain === brandDomain || domain.endsWith(`.${brandDomain}`);
  const trusted = trustedDomains.some((candidate) => domain === candidate || domain.endsWith(`.${candidate}`));

  return {
    url: raw.url,
    domain,
    title: raw.title,
    owned,
    trusted
  };
}

function parseSearchResults(payload: any): SearchResult[] {
  const sources = Array.isArray(payload?.output)
    ? payload.output
        .filter((entry: any) => entry?.type === "web_search_call")
        .flatMap((entry: any) => entry?.action?.sources ?? [])
    : [];

  const sourceUrls = sources
    .map((source: any) => source?.url)
    .filter((url: unknown): url is string => typeof url === "string");
  const dedupedUrls: string[] = unique<string>(sourceUrls);

  return dedupedUrls.map((url) => {
    const source = sources.find((entry: any) => entry?.url === url);
    return {
      url,
      title: typeof source?.title === "string" ? source.title : undefined,
      date:
        typeof source?.date === "string"
          ? source.date
          : typeof source?.published_at === "string"
            ? source.published_at
            : undefined,
      snippet: typeof source?.snippet === "string" ? source.snippet : undefined,
      source: "web"
    } satisfies SearchResult;
  });
}

function parseCitations(payload: any, brandDomain: string, trustedDomains: string[]): Citation[] {
  const annotations = Array.isArray(payload?.output)
    ? payload.output
        .filter((entry: any) => entry?.type === "message")
        .flatMap((entry: any) => entry?.content ?? [])
        .flatMap((content: any) => content?.annotations ?? [])
    : [];

  const citations = annotations
    .filter((annotation: any) => annotation?.type === "url_citation")
    .map((annotation: any) =>
      normalizeCitation(
        {
          url: annotation?.url,
          title: annotation?.title
        },
        brandDomain,
        trustedDomains
      )
    )
    .filter((citation: Citation | null): citation is Citation => citation !== null);

  const dedupedUrls = unique(citations.map((citation: Citation) => citation.url));
  return dedupedUrls.map((url) => citations.find((citation: Citation) => citation.url === url) as Citation);
}

function parseAnswerText(payload: any): string {
  if (typeof payload?.output_text === "string" && payload.output_text.length > 0) {
    return payload.output_text;
  }

  const texts = Array.isArray(payload?.output)
    ? payload.output
        .filter((entry: any) => entry?.type === "message")
        .flatMap((entry: any) => entry?.content ?? [])
        .map((content: any) => content?.text)
        .filter((text: unknown): text is string => typeof text === "string")
    : [];

  return texts.join("\n\n").trim();
}

export async function runOpenAIEval(request: EvalRequest, options: ProviderRunOptions = {}): Promise<ProviderResponse> {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY for OpenAI eval runs.");
  }

  const brandDomain = normalizeDomain(request.brandDomain);
  const trustedDomains = unique(request.trustedDomains.map((domain) => normalizeDomain(domain)));
  const baseUrl = (options.baseUrl ?? process.env.ANSWERLENS_OPENAI_BASE_URL ?? process.env.OPENAI_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const model = options.model ?? process.env.ANSWERLENS_OPENAI_MODEL ?? DEFAULT_MODEL;
  const timeoutMs = options.timeoutMs ?? 60_000;
  const locale = options.locale ?? request.locale ?? null;
  const sampleIndex = options.sampleIndex ?? request.sampleIndex ?? 0;
  const runCount = options.runCount ?? request.runCount ?? 1;
  const holdout = options.holdout ?? request.holdout ?? false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}/responses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        input: buildInput(request.prompt, locale ?? undefined),
        reasoning: {
          effort: "low"
        },
        tools: [{ type: "web_search" }],
        include: ["web_search_call.action.sources"]
      }),
      signal: controller.signal
    });

    const rawPayload = await response.json();
    if (!response.ok) {
      throw new Error(`OpenAI eval failed with ${response.status}: ${JSON.stringify(rawPayload)}`);
    }

    return {
      provider: "openai",
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
