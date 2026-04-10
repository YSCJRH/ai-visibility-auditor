import { readFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { z } from "zod";
import type { BrandConfig, CompetitorsConfig, PromptsConfig } from "./types.ts";

const canonicalFactSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  text: z.string().min(1)
});

const brandSchema = z.object({
  brand: z.object({
    name: z.string().min(1),
    domain: z.string().min(1),
    category: z.string().min(1),
    one_liner: z.string().min(1),
    target_personas: z.array(z.string().min(1)).default([]),
    key_use_cases: z.array(z.string().min(1)).default([]),
    competitors: z.array(z.string().min(1)).default([]),
    canonical_facts: z.array(canonicalFactSchema).default([]),
    trusted_domains: z.array(z.string().min(1)).default([])
  })
});

const competitorsSchema = z.object({
  competitors: z
    .array(
      z.object({
        name: z.string().min(1),
        domain: z.string().optional(),
        category: z.string().optional()
      })
    )
    .default([])
});

const promptsSchema = z.object({
  prompts: z
    .array(
      z.object({
        id: z.string().min(1),
        category: z.string().min(1),
        template: z.string().min(1),
        expected_signal: z.string().min(1),
        priority: z.enum(["high", "medium", "low"]).optional()
      })
    )
    .default([])
});

async function loadYamlFile<T>(filePath: string, schema: z.ZodType<T>): Promise<T> {
  const absolutePath = path.resolve(filePath);
  const raw = await readFile(absolutePath, "utf8");
  const parsed = YAML.parse(raw);
  const result = schema.safeParse(parsed);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid config in ${absolutePath}: ${details}`);
  }

  return result.data;
}

export async function loadBrandConfig(filePath: string): Promise<BrandConfig> {
  return (await loadYamlFile(filePath, brandSchema)) as BrandConfig;
}

export async function loadCompetitorsConfig(filePath: string): Promise<CompetitorsConfig> {
  return (await loadYamlFile(filePath, competitorsSchema)) as CompetitorsConfig;
}

export async function loadPromptsConfig(filePath: string): Promise<PromptsConfig> {
  return (await loadYamlFile(filePath, promptsSchema)) as PromptsConfig;
}


