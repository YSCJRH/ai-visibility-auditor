#!/usr/bin/env node

import path from "node:path";
import { loadBrandConfig, loadCompetitorsConfig, loadPromptsConfig, runAudit } from "../../../packages/core/src/index.ts";
import { writeAuditOutputs } from "../../../packages/report/src/index.ts";

type ParsedArgs = {
  positionals: string[];
  flags: Map<string, string[]>;
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
  pnpm eval <site-or-fixture> --brand <brand.yaml> --competitors <competitors.yaml> --prompts <prompts.yaml> --out <dir> --provider <openai|perplexity>

Notes:
  - audit is the stable v0.1 command.
  - eval is scaffolded as experimental.
`);
}

async function runAuditCommand(parsed: ParsedArgs): Promise<void> {
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
  console.log(`AnswerLens audit complete.\n  Site: ${siteInput}\n  Overall score: ${result.summary.overallScore}\n  Missing page types: ${result.summary.missingPageTypes.join(", ") || "none"}\n  Output: ${outDir}`);
}

async function runEvalCommand(): Promise<void> {
  throw new Error(
    "The experimental eval pipeline is scaffolded in this repo, but the end-to-end command is not enabled yet. Start with `pnpm audit` and extend packages/providers."
  );
}

async function main(): Promise<void> {
  const [, , command, ...rest] = process.argv;
  if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  const parsed = parseArgs(rest);
  if (command === "audit") {
    await runAuditCommand(parsed);
    return;
  }

  if (command === "eval") {
    await runEvalCommand();
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
