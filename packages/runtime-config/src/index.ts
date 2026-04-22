import { readFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { z } from "zod";
import { EVAL_PROFILE_PRESETS, type EvalProfileName, type EvalProfilePreset } from "../../contracts/src/index.ts";

export type RuntimeProviderName = "openai" | "perplexity";
export type RuntimeConfigSource = "override" | "profile" | "runtime" | "env" | "default";

export interface RuntimeConfig {
  runtime: {
    eval?: {
      provider?: RuntimeProviderName;
      model?: string;
      locale?: string;
      samples?: number;
      timeout_ms?: number;
    };
    providers?: Partial<Record<RuntimeProviderName, { base_url?: string }>>;
  };
}

export interface ResolvedRuntimeValue<T> {
  value: T;
  source: RuntimeConfigSource;
}

export interface ResolvedEvalRuntime {
  runtimePath: string | null;
  provider: ResolvedRuntimeValue<RuntimeProviderName>;
  model: ResolvedRuntimeValue<string>;
  locale: ResolvedRuntimeValue<string | null>;
  samples: ResolvedRuntimeValue<number>;
  timeoutMs: ResolvedRuntimeValue<number>;
  baseUrl: ResolvedRuntimeValue<string>;
}

export interface ResolveEvalRuntimeInput {
  brandPath?: string;
  runtimePath?: string;
  profile?: EvalProfileName;
  provider?: RuntimeProviderName;
  model?: string;
  locale?: string | null;
  samples?: number;
  timeoutMs?: number;
  baseUrl?: string;
  env?: NodeJS.ProcessEnv;
}

export function recommendEvalProfile(defaults: {
  provider: RuntimeProviderName;
  model: string;
  locale: string | null;
  samples: number;
  timeoutMs: number;
}): EvalProfileName | null {
  const match = (Object.values(EVAL_PROFILE_PRESETS) as EvalProfilePreset[]).find((profile) => {
    return (
      profile.defaults.provider === defaults.provider &&
      profile.defaults.model === defaults.model &&
      profile.defaults.locale === defaults.locale &&
      profile.defaults.samples === defaults.samples &&
      profile.defaults.timeoutMs === defaults.timeoutMs
    );
  });

  return match?.id ?? null;
}

const runtimeProviderSchema = z.object({
  base_url: z.string().url().optional()
});

const runtimeSchema = z.object({
  runtime: z.object({
    eval: z
      .object({
        provider: z.enum(["openai", "perplexity"]).optional(),
        model: z.string().min(1).optional(),
        locale: z.string().min(1).optional(),
        samples: z.number().int().positive().optional(),
        timeout_ms: z.number().int().positive().optional()
      })
      .optional(),
    providers: z
      .object({
        openai: runtimeProviderSchema.optional(),
        perplexity: runtimeProviderSchema.optional()
      })
      .optional()
  })
});

const DEFAULT_MODEL_BY_PROVIDER: Record<RuntimeProviderName, string> = {
  openai: "gpt-5",
  perplexity: "sonar"
};

const DEFAULT_BASE_URL_BY_PROVIDER: Record<RuntimeProviderName, string> = {
  openai: "https://api.openai.com/v1",
  perplexity: "https://api.perplexity.ai"
};

const DEFAULT_TIMEOUT_MS = 60_000;

function nonEmpty(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function optionalPositiveInteger(value?: number): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Invalid positive integer value: ${value}`);
  }
  return value;
}

function providerModelFromEnv(provider: RuntimeProviderName, env: NodeJS.ProcessEnv): string | undefined {
  if (provider === "openai") {
    return nonEmpty(env.ANSWERLENS_OPENAI_MODEL);
  }
  return nonEmpty(env.ANSWERLENS_PERPLEXITY_MODEL);
}

function providerBaseUrlFromEnv(provider: RuntimeProviderName, env: NodeJS.ProcessEnv): string | undefined {
  if (provider === "openai") {
    return nonEmpty(env.ANSWERLENS_OPENAI_BASE_URL) ?? nonEmpty(env.OPENAI_BASE_URL);
  }
  return nonEmpty(env.ANSWERLENS_PERPLEXITY_BASE_URL);
}

function resolveValue<T>(
  override: T | undefined,
  profileValue: T | undefined,
  runtimeValue: T | undefined,
  envValue: T | undefined,
  defaultValue: T
): ResolvedRuntimeValue<T> {
  if (override !== undefined) {
    return { value: override, source: "override" };
  }
  if (profileValue !== undefined) {
    return { value: profileValue, source: "profile" };
  }
  if (runtimeValue !== undefined) {
    return { value: runtimeValue, source: "runtime" };
  }
  if (envValue !== undefined) {
    return { value: envValue, source: "env" };
  }
  return { value: defaultValue, source: "default" };
}

function resolvePathLike(filePath?: string): string | undefined {
  if (!filePath) {
    return undefined;
  }
  return path.resolve(filePath);
}

export function defaultRuntimePathForBrand(brandPath: string): string {
  return path.join(path.dirname(path.resolve(brandPath)), "runtime.yaml");
}

export async function loadRuntimeConfig(filePath: string): Promise<RuntimeConfig> {
  const absolutePath = path.resolve(filePath);
  const raw = await readFile(absolutePath, "utf8");
  const parsed = YAML.parse(raw);
  const result = runtimeSchema.safeParse(parsed);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid runtime config in ${absolutePath}: ${details}`);
  }

  return result.data as RuntimeConfig;
}

export async function loadRuntimeConfigIfExists(filePath?: string): Promise<RuntimeConfig | null> {
  const resolved = resolvePathLike(filePath);
  if (!resolved) {
    return null;
  }

  try {
    return await loadRuntimeConfig(resolved);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function resolveEvalRuntime(input: ResolveEvalRuntimeInput): Promise<ResolvedEvalRuntime> {
  const env = input.env ?? process.env;
  const profile = input.profile ? EVAL_PROFILE_PRESETS[input.profile] : null;
  const runtimePath =
    resolvePathLike(input.runtimePath) ?? (input.brandPath ? defaultRuntimePathForBrand(input.brandPath) : undefined);
  const runtimeConfig = await loadRuntimeConfigIfExists(runtimePath);
  const runtimeEval = runtimeConfig?.runtime.eval;

  const provider = input.provider ?? profile?.defaults.provider ?? runtimeEval?.provider;
  if (!provider) {
    throw new Error(
      `Eval provider is required. Set --provider, the Action provider input, or runtime.eval.provider in ${runtimePath ?? "runtime.yaml"}.`
    );
  }

  const providerSource: RuntimeConfigSource = input.provider
    ? "override"
    : profile?.defaults.provider
      ? "profile"
    : runtimeEval?.provider
      ? "runtime"
      : "default";

  const model = resolveValue(
    nonEmpty(input.model),
    profile?.defaults.model,
    nonEmpty(runtimeEval?.model),
    providerModelFromEnv(provider, env),
    DEFAULT_MODEL_BY_PROVIDER[provider]
  );

  const locale = resolveValue<string | null>(
    input.locale === undefined ? undefined : nonEmpty(input.locale) ?? null,
    profile?.defaults.locale,
    nonEmpty(runtimeEval?.locale),
    undefined,
    null
  );

  const samples = resolveValue(
    optionalPositiveInteger(input.samples),
    optionalPositiveInteger(profile?.defaults.samples),
    optionalPositiveInteger(runtimeEval?.samples),
    undefined,
    1
  );

  const timeoutMs = resolveValue(
    optionalPositiveInteger(input.timeoutMs),
    optionalPositiveInteger(profile?.defaults.timeoutMs),
    optionalPositiveInteger(runtimeEval?.timeout_ms),
    undefined,
    DEFAULT_TIMEOUT_MS
  );

  const providerConfig = runtimeConfig?.runtime.providers?.[provider];
  const baseUrl = resolveValue(
    nonEmpty(input.baseUrl),
    undefined,
    nonEmpty(providerConfig?.base_url),
    providerBaseUrlFromEnv(provider, env),
    DEFAULT_BASE_URL_BY_PROVIDER[provider]
  );

  return {
    runtimePath: runtimeConfig ? path.resolve(runtimePath ?? "") : null,
    provider: { value: provider, source: providerSource },
    model,
    locale,
    samples,
    timeoutMs,
    baseUrl
  };
}
