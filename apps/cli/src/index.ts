#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  applyEvalSummaryToAudit,
  loadBrandConfig,
  loadCompetitorsConfig,
  loadPromptsConfig,
  runAudit,
  scoreEvalResponses
} from "../../../packages/core/src/index.ts";
import { normalizeDomain } from "../../../packages/core/src/utils.ts";
import type { RunMode } from "../../../packages/core/src/index.ts";
import type { Citation, ProviderName, ProviderResponse, SearchResult } from "../../../packages/providers/src/index.ts";
import { runEvalProvider } from "../../../packages/providers/src/index.ts";
import { readEvalResults, writeAuditOutputs, writeEvalOutputs } from "../../../packages/report/src/index.ts";

type ParsedArgs = {
  positionals: string[];
  flags: Map<string, string[]>;
};

type Logger = {
  log(message: string): void;
  error(message: string): void;
};

export type CliDependencies = {
  runProvider(
    provider: ProviderName,
    request: Parameters<typeof runEvalProvider>[1],
    options?: Parameters<typeof runEvalProvider>[2]
  ): Promise<ProviderResponse>;
  logger: Logger;
};

type ImportedResponseShape = {
  provider?: ProviderName | string;
  model?: string;
  locale?: string | null;
  runCount?: number;
  responses?: unknown[];
};

function parseArgs(argv: string[]): ParsedArgs {
  const positionals: string[] = [];
  const flags = new Map<string, string[]>();

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];
    const values = flags.get(key) ?? [];

    if (!next || next.startsWith("--")) {
      values.push("true");
      flags.set(key, values);
      continue;
    }

    values.push(next);
    flags.set(key, values);
    index += 1;
  }

  return { positionals, flags };
}

function requiredFlag(parsed: ParsedArgs, flag: string): string {
  const value = parsed.flags.get(flag)?.[0];
  if (!value) {
    throw new Error(`Missing required flag --${flag}`);
  }
  return value;
}

function listFlag(parsed: ParsedArgs, flag: string): string[] {
  return (parsed.flags.get(flag) ?? []).flatMap((value) =>
    value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
  );
}

function numberFlag(parsed: ParsedArgs, flag: string, fallback: number): number {
  const value = parsed.flags.get(flag)?.[0];
  if (!value) {
    return fallback;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error(`Invalid numeric value for --${flag}: ${value}`);
  }

  return numeric;
}

function printHelp(): void {
  console.log(`AnswerLens

Usage:
  corepack pnpm audit <site-or-fixture> --brand <brand.yaml> --competitors <competitors.yaml> --prompts <prompts.yaml> --out <dir>
  corepack pnpm eval <site-or-fixture> --brand <brand.yaml> --competitors <competitors.yaml> --prompts <prompts.yaml> --out <dir> --provider <openai|perplexity> [--model <model>] [--samples <n>] [--locale <locale>]
  corepack pnpm manual-import <site-or-fixture> --brand <brand.yaml> --competitors <competitors.yaml> --prompts <prompts.yaml> --out <dir> --input <responses.json> [--locale <locale>]

Notes:
  - audit is the stable v0.1 command.
  - eval runs the configured prompt pack, including holdout prompts, and aggregates repeated samples.
  - manual-import accepts normalized ProviderResponse entries or a { responses: [...] } wrapper.
  - manual-import may include rankPosition for manual rank validation; use a positive integer or null.
  - Set OPENAI_API_KEY or PERPLEXITY_API_KEY before live eval runs.
`);
}

function rawPayloadFileName(response: ProviderResponse): string {
  const suffix = response.sampleIndex > 0 ? `--sample-${response.sampleIndex + 1}` : "";
  return `${response.promptId}${suffix}.json`;
}

async function writeRawPayloads(outDir: string, responses: ProviderResponse[]): Promise<void> {
  const rawRoot = path.join(outDir, "raw");
  for (const response of responses) {
    const providerDir = path.join(rawRoot, response.provider);
    await mkdir(providerDir, { recursive: true });
    await writeFile(path.join(providerDir, rawPayloadFileName(response)), `${JSON.stringify(response.rawPayload, null, 2)}\n`, "utf8");
  }
}

async function loadAuditInputs(parsed: ParsedArgs) {
  return Promise.all([
    loadBrandConfig(requiredFlag(parsed, "brand")),
    loadCompetitorsConfig(requiredFlag(parsed, "competitors")),
    loadPromptsConfig(requiredFlag(parsed, "prompts"))
  ]);
}

async function runAuditCommand(parsed: ParsedArgs, logger: Logger): Promise<void> {
  const siteInput = parsed.positionals[0];
  if (!siteInput) {
    throw new Error("Missing site input. Pass a public URL or a local fixture directory.");
  }

  const outDir = path.resolve(requiredFlag(parsed, "out"));
  const [brand, competitors, prompts] = await loadAuditInputs(parsed);

  const result = await runAudit({
    siteInput,
    sitemapUrl: parsed.flags.get("sitemap")?.[0],
    includePatterns: listFlag(parsed, "include"),
    excludePatterns: listFlag(parsed, "exclude"),
    maxPages: numberFlag(parsed, "max-pages", 20),
    brand,
    competitors,
    prompts
  });

  await writeAuditOutputs(outDir, result);
  logger.log(
    `AnswerLens audit complete.\n  Site: ${siteInput}\n  Overall score: ${result.summary.overallScore}\n  Missing page types: ${result.summary.missingPageTypes.join(", ") || "none"}\n  Output: ${outDir}`
  );
}

function normalizeCitation(
  citation: unknown,
  brandDomain: string,
  trustedDomains: string[]
): Citation {
  if (typeof citation === "string") {
    const domain = normalizeDomain(citation);
    return {
      url: citation,
      domain,
      title: undefined,
      owned: domain === brandDomain || domain.endsWith(`.${brandDomain}`),
      trusted: trustedDomains.some((candidate) => domain === candidate || domain.endsWith(`.${candidate}`))
    };
  }

  const entry = citation as Partial<Citation> & { url?: string };
  if (!entry.url) {
    throw new Error("Imported citation is missing a url.");
  }

  const domain = normalizeDomain(entry.url);
  return {
    url: entry.url,
    domain,
    title: entry.title,
    owned: entry.owned ?? (domain === brandDomain || domain.endsWith(`.${brandDomain}`)),
    trusted: entry.trusted ?? trustedDomains.some((candidate) => domain === candidate || domain.endsWith(`.${candidate}`))
  };
}

function normalizeSearchResult(entry: unknown): SearchResult {
  if (typeof entry === "string") {
    return { url: entry };
  }

  const result = entry as Partial<SearchResult> & { url?: string };
  if (!result.url) {
    throw new Error("Imported search result is missing a url.");
  }

  return {
    url: result.url,
    title: result.title,
    date: result.date,
    snippet: result.snippet,
    source: result.source
  };
}

function normalizeRankPosition(value: unknown, promptId: string, index: number): number | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new Error(
      `Imported response ${promptId} at index ${index} has invalid rankPosition. Expected a positive integer or null.`
    );
  }

  return value;
}

function normalizeImportedResponses(
  payload: unknown,
  defaults: { brandDomain: string; trustedDomains: string[]; locale: string | null }
): ProviderResponse[] {
  const wrapper = payload as ImportedResponseShape;
  const items = Array.isArray(payload) ? payload : Array.isArray(wrapper.responses) ? wrapper.responses : null;
  if (!items) {
    throw new Error("manual-import expects either an array of responses or an object with a responses array.");
  }

  return items.map((item, index) => {
    const response = item as Partial<ProviderResponse> & {
      promptId?: string;
      answerText?: string;
      citations?: unknown[];
      searchResults?: unknown[];
    };

    if (!response.promptId || typeof response.promptId !== "string") {
      throw new Error(`Imported response at index ${index} is missing promptId.`);
    }

    if (typeof response.answerText !== "string") {
      throw new Error(`Imported response ${response.promptId} is missing answerText.`);
    }

    return {
      provider: (response.provider ?? wrapper.provider ?? "manual") as ProviderName,
      model: response.model ?? wrapper.model ?? "manual-import",
      promptId: response.promptId,
      answerText: response.answerText,
      citations: (response.citations ?? []).map((citation) =>
        normalizeCitation(citation, defaults.brandDomain, defaults.trustedDomains)
      ),
      searchResults: (response.searchResults ?? []).map((entry) => normalizeSearchResult(entry)),
      rawPayload: response.rawPayload ?? item,
      requestedAt: response.requestedAt ?? new Date().toISOString(),
      locale: response.locale ?? wrapper.locale ?? defaults.locale,
      sampleIndex: response.sampleIndex ?? 0,
      runCount: response.runCount ?? wrapper.runCount ?? 1,
      holdout: response.holdout ?? false,
      rankPosition: normalizeRankPosition(response.rankPosition, response.promptId, index)
    } satisfies ProviderResponse;
  });
}

async function scoreAndWriteEval(
  outDir: string,
  audit: Awaited<ReturnType<typeof runAudit>>,
  brand: Awaited<ReturnType<typeof loadBrandConfig>>,
  competitors: Awaited<ReturnType<typeof loadCompetitorsConfig>>,
  prompts: Awaited<ReturnType<typeof loadPromptsConfig>>,
  mode: Extract<RunMode, "eval" | "manual-import">,
  responses: ProviderResponse[]
) {
  const previousEval = await readEvalResults(path.join(outDir, "eval-results.json"));
  const evalResult = scoreEvalResponses({
    brand,
    competitors,
    prompts,
    audit,
    responses,
    rawPayloadRoot: path.join(outDir, "raw"),
    mode
  });

  const auditWithVavr = applyEvalSummaryToAudit(audit, evalResult.summary, mode);
  await writeAuditOutputs(outDir, auditWithVavr);
  await writeRawPayloads(outDir, responses);
  await writeEvalOutputs(outDir, evalResult, previousEval);
  return evalResult;
}

async function runEvalCommand(parsed: ParsedArgs, dependencies: CliDependencies): Promise<void> {
  const siteInput = parsed.positionals[0];
  if (!siteInput) {
    throw new Error("Missing site input. Pass a public URL or a local fixture directory.");
  }

  const outDir = path.resolve(requiredFlag(parsed, "out"));
  const provider = requiredFlag(parsed, "provider") as ProviderName;
  const model = parsed.flags.get("model")?.[0];
  const locale = parsed.flags.get("locale")?.[0] ?? null;
  const samples = numberFlag(parsed, "samples", 1);
  const [brand, competitors, prompts] = await loadAuditInputs(parsed);

  const audit = await runAudit({
    siteInput,
    sitemapUrl: parsed.flags.get("sitemap")?.[0],
    includePatterns: listFlag(parsed, "include"),
    excludePatterns: listFlag(parsed, "exclude"),
    maxPages: numberFlag(parsed, "max-pages", 20),
    brand,
    competitors,
    prompts
  });

  const responses: ProviderResponse[] = [];
  for (const promptCase of prompts.prompts) {
    for (let sampleIndex = 0; sampleIndex < samples; sampleIndex += 1) {
      responses.push(
        await dependencies.runProvider(
          provider,
          {
            promptId: promptCase.id,
            prompt: promptCase.template,
            brandDomain: brand.brand.domain,
            trustedDomains: brand.brand.trusted_domains,
            expectedSignal: promptCase.expected_signal,
            locale: promptCase.locale ?? locale ?? undefined,
            sampleIndex,
            runCount: samples,
            holdout: promptCase.holdout ?? false
          },
          {
            model,
            locale: promptCase.locale ?? locale ?? undefined,
            sampleIndex,
            runCount: samples,
            holdout: promptCase.holdout ?? false
          }
        )
      );
    }
  }

  const evalResult = await scoreAndWriteEval(outDir, audit, brand, competitors, prompts, "eval", responses);
  dependencies.logger.log(
    `AnswerLens eval complete.\n  Site: ${siteInput}\n  Provider: ${provider}\n  VAVR: ${evalResult.summary.vavr}\n  Mention rate: ${evalResult.summary.mentionRate}\n  Samples: ${evalResult.summary.sampleCount}\n  Output: ${outDir}`
  );
}

async function runManualImportCommand(parsed: ParsedArgs, dependencies: CliDependencies): Promise<void> {
  const siteInput = parsed.positionals[0];
  if (!siteInput) {
    throw new Error("Missing site input. Pass a public URL or a local fixture directory.");
  }

  const outDir = path.resolve(requiredFlag(parsed, "out"));
  const inputPath = path.resolve(requiredFlag(parsed, "input"));
  const locale = parsed.flags.get("locale")?.[0] ?? null;
  const [brand, competitors, prompts] = await loadAuditInputs(parsed);

  const audit = await runAudit({
    siteInput,
    sitemapUrl: parsed.flags.get("sitemap")?.[0],
    includePatterns: listFlag(parsed, "include"),
    excludePatterns: listFlag(parsed, "exclude"),
    maxPages: numberFlag(parsed, "max-pages", 20),
    brand,
    competitors,
    prompts
  });

  const payload = JSON.parse(await readFile(inputPath, "utf8"));
  const responses = normalizeImportedResponses(payload, {
    brandDomain: normalizeDomain(brand.brand.domain),
    trustedDomains: brand.brand.trusted_domains.map((domain) => normalizeDomain(domain)),
    locale
  });

  const evalResult = await scoreAndWriteEval(outDir, audit, brand, competitors, prompts, "manual-import", responses);
  dependencies.logger.log(
    `AnswerLens manual import complete.\n  Site: ${siteInput}\n  Imported responses: ${responses.length}\n  VAVR: ${evalResult.summary.vavr}\n  Output: ${outDir}`
  );
}

export async function runCli(
  argv: string[] = process.argv.slice(2),
  dependencies: CliDependencies = {
    runProvider: runEvalProvider,
    logger: console
  }
): Promise<void> {
  const [command, ...rest] = argv;
  if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  const parsed = parseArgs(rest);
  if (command === "audit") {
    await runAuditCommand(parsed, dependencies.logger);
    return;
  }

  if (command === "eval") {
    await runEvalCommand(parsed, dependencies);
    return;
  }

  if (command === "manual-import") {
    await runManualImportCommand(parsed, dependencies);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

if (process.env.ANSWERLENS_IMPORT_ONLY !== "1") {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
