#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  applyEvalSummaryToAudit,
  loadBrandConfig,
  loadCompetitorsConfig,
  loadPromptsConfig,
  runAudit,
  scoreEvalResponses
} from "../../../packages/core/src/index.ts";
import type { ProviderName, ProviderResponse } from "../../../packages/providers/src/index.ts";
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

function printHelp(): void {
  console.log(`AnswerLens

Usage:
  pnpm audit <site-or-fixture> --brand <brand.yaml> --competitors <competitors.yaml> --prompts <prompts.yaml> --out <dir>
  pnpm eval <site-or-fixture> --brand <brand.yaml> --competitors <competitors.yaml> --prompts <prompts.yaml> --out <dir> --provider <openai|perplexity> [--model <model>]

Notes:
  - audit is the stable v0.1 command.
  - eval is experimental, but OpenAI is now wired for end-to-end runs.
  - Set OPENAI_API_KEY before running eval with --provider openai.
`);
}

async function runAuditCommand(parsed: ParsedArgs, logger: Logger): Promise<void> {
  const siteInput = parsed.positionals[0];
  if (!siteInput) {
    throw new Error("Missing site input. Pass a public URL or a local fixture directory.");
  }

  const outDir = path.resolve(requiredFlag(parsed, "out"));
  const [brand, competitors, prompts] = await Promise.all([
    loadBrandConfig(requiredFlag(parsed, "brand")),
    loadCompetitorsConfig(requiredFlag(parsed, "competitors")),
    loadPromptsConfig(requiredFlag(parsed, "prompts"))
  ]);

  const result = await runAudit({
    siteInput,
    sitemapUrl: parsed.flags.get("sitemap")?.[0],
    includePatterns: listFlag(parsed, "include"),
    excludePatterns: listFlag(parsed, "exclude"),
    maxPages: Number(parsed.flags.get("max-pages")?.[0] ?? "20"),
    brand,
    competitors,
    prompts
  });

  await writeAuditOutputs(outDir, result);
  logger.log(
    `AnswerLens audit complete.\n  Site: ${siteInput}\n  Overall score: ${result.summary.overallScore}\n  Missing page types: ${result.summary.missingPageTypes.join(", ") || "none"}\n  Output: ${outDir}`
  );
}

async function writeRawPayloads(outDir: string, responses: ProviderResponse[]): Promise<void> {
  const rawRoot = path.join(outDir, "raw");
  for (const response of responses) {
    const providerDir = path.join(rawRoot, response.provider);
    await mkdir(providerDir, { recursive: true });
    await writeFile(path.join(providerDir, `${response.promptId}.json`), `${JSON.stringify(response.rawPayload, null, 2)}\n`, "utf8");
  }
}

async function runEvalCommand(parsed: ParsedArgs, dependencies: CliDependencies): Promise<void> {
  const siteInput = parsed.positionals[0];
  if (!siteInput) {
    throw new Error("Missing site input. Pass a public URL or a local fixture directory.");
  }

  const outDir = path.resolve(requiredFlag(parsed, "out"));
  const provider = requiredFlag(parsed, "provider") as ProviderName;
  const model = parsed.flags.get("model")?.[0];
  const [brand, competitors, prompts] = await Promise.all([
    loadBrandConfig(requiredFlag(parsed, "brand")),
    loadCompetitorsConfig(requiredFlag(parsed, "competitors")),
    loadPromptsConfig(requiredFlag(parsed, "prompts"))
  ]);

  const audit = await runAudit({
    siteInput,
    sitemapUrl: parsed.flags.get("sitemap")?.[0],
    includePatterns: listFlag(parsed, "include"),
    excludePatterns: listFlag(parsed, "exclude"),
    maxPages: Number(parsed.flags.get("max-pages")?.[0] ?? "20"),
    brand,
    competitors,
    prompts
  });

  const responses: ProviderResponse[] = [];
  for (const promptCase of prompts.prompts) {
    responses.push(
      await dependencies.runProvider(
        provider,
        {
          promptId: promptCase.id,
          prompt: promptCase.template,
          brandDomain: brand.brand.domain,
          trustedDomains: brand.brand.trusted_domains,
          expectedSignal: promptCase.expected_signal
        },
        {
          model
        }
      )
    );
  }

  const previousEval = await readEvalResults(path.join(outDir, "eval-results.json"));
  const evalResult = scoreEvalResponses({
    brand,
    competitors,
    prompts,
    audit,
    responses,
    rawPayloadRoot: path.join(outDir, "raw")
  });

  const auditWithVavr = applyEvalSummaryToAudit(audit, evalResult.summary.vavr);
  await writeAuditOutputs(outDir, auditWithVavr);
  await writeRawPayloads(outDir, responses);
  await writeEvalOutputs(outDir, evalResult, previousEval);

  dependencies.logger.log(
    `AnswerLens eval complete.\n  Site: ${siteInput}\n  Provider: ${provider}\n  VAVR: ${evalResult.summary.vavr}\n  Mention rate: ${evalResult.summary.mentionRate}\n  Output: ${outDir}`
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

  throw new Error(`Unknown command: ${command}`);
}

if (process.env.ANSWERLENS_IMPORT_ONLY !== "1") {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
