import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyEvalSummaryToAudit,
  loadBrandConfig,
  loadCompetitorsConfig,
  loadPromptsConfig,
  runAudit,
  scoreEvalResponses
} from "../../core/src/index.ts";
import type { BrandConfig, CompetitorsConfig, PromptsConfig } from "../../core/src/types.ts";
import type { ProviderName, ProviderResponse } from "../../providers/src/index.ts";
import { runEvalProvider } from "../../providers/src/index.ts";
import {
  readEvalResults,
  writeAuditOutputs,
  writeEvalOutputs
} from "../../report/src/index.ts";
import { defaultRuntimePathForBrand, recommendEvalProfile, resolveEvalRuntime } from "../../runtime-config/src/index.ts";
import type {
  AdminRunDetail,
  AdminRunListItem,
  AuditResult,
  ArtifactEntry,
  ConfigPresetSummary,
  CreateAuditRunInput,
  CreateEvalRunInput,
  EvalSummaryJson,
  RunJobRecord,
  RunManifest,
  SearchValidationSummaryJson,
  ShareSummary
} from "../../contracts/src/index.ts";

type RuntimeOptions = {
  repoRoot?: string;
  runsDir?: string;
};

type PresetFiles = {
  id: string;
  label: string;
  description: string;
  defaultSiteInput: string;
  brandPath: string;
  competitorsPath: string;
  promptsPath: string;
  runtimePath: string;
};

type RuntimeState = {
  jobs: Map<string, RunJobRecord>;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_REPO_ROOT = path.resolve(__dirname, "../../..");
const DEFAULT_RUNS_DIR = path.join(DEFAULT_REPO_ROOT, "runs");

const PRESETS: PresetFiles[] = [
  {
    id: "repo-answerlens",
    label: "AnswerLens repo preset",
    description: "The repository's own .github/answerlens configuration.",
    defaultSiteInput: "https://yscjrh.github.io/ai-visibility-auditor/",
    brandPath: ".github/answerlens/brand.yaml",
    competitorsPath: ".github/answerlens/competitors.yaml",
    promptsPath: ".github/answerlens/prompts.yaml",
    runtimePath: ".github/answerlens/runtime.yaml"
  },
  {
    id: "example-acme",
    label: "Acme fixture preset",
    description: "The internal static-good demo preset used by the fixture walkthrough.",
    defaultSiteInput: "./examples/fixtures/static-good",
    brandPath: "examples/acme/brand.yaml",
    competitorsPath: "examples/acme/competitors.yaml",
    promptsPath: "examples/acme/prompts.yaml",
    runtimePath: "examples/acme/runtime.yaml"
  },
  {
    id: "example-consumer-repo",
    label: "Consumer repo starter preset",
    description: "The external-repo-friendly starter bundle in examples/consumer-repo.",
    defaultSiteInput: "./examples/fixtures/static-good",
    brandPath: "examples/consumer-repo/.github/answerlens/brand.yaml",
    competitorsPath: "examples/consumer-repo/.github/answerlens/competitors.yaml",
    promptsPath: "examples/consumer-repo/.github/answerlens/prompts.yaml",
    runtimePath: "examples/consumer-repo/.github/answerlens/runtime.yaml"
  }
];

const ARTIFACT_ORDER = [
  "share-summary.md",
  "scorecard.md",
  "recommendations.md",
  "pr-snippet.md",
  "index.html",
  "run.json",
  "share-summary.json",
  "site-audit.json",
  "issues.json",
  "normalized-pages.json",
  "competitor-diff.md",
  "eval-summary.md",
  "eval-summary.json",
  "eval-results.json",
  "before-after-diff.md",
  "citation-gap-matrix.md",
  "citation-gap-matrix.json",
  "search-console-summary.md",
  "search-console-summary.json",
  "bing-summary.md",
  "bing-summary.json",
  "indexnow-summary.md",
  "indexnow-summary.json"
];

const runtimeState: RuntimeState = {
  jobs: new Map()
};

function repoRoot(options?: RuntimeOptions): string {
  return options?.repoRoot ? path.resolve(options.repoRoot) : DEFAULT_REPO_ROOT;
}

function runsRoot(options?: RuntimeOptions): string {
  return options?.runsDir ? path.resolve(options.runsDir) : DEFAULT_RUNS_DIR;
}

function resolveFromRepo(relativePath: string, options?: RuntimeOptions): string {
  return path.resolve(repoRoot(options), relativePath);
}

function resolveMaybeRepoPath(value: string | undefined, options?: RuntimeOptions): string | undefined {
  if (!value) {
    return undefined;
  }
  return path.isAbsolute(value) ? path.resolve(value) : resolveFromRepo(value, options);
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function readJsonOrNull<T>(filePath: string): Promise<T | null> {
  try {
    return await readJson<T>(filePath);
  } catch {
    return null;
  }
}

function artifactType(name: string): ArtifactEntry["contentType"] {
  if (name.endsWith(".md")) {
    return "markdown";
  }
  if (name.endsWith(".json")) {
    return "json";
  }
  if (name.endsWith(".html")) {
    return "html";
  }
  return "text";
}

function siteLabel(site: { input: string; display?: string }): string {
  const display = site.display?.trim();
  return display && display.length > 0 ? display : site.input;
}

function sortArtifacts(entries: string[]): string[] {
  return [...entries].sort((left, right) => {
    const leftIndex = ARTIFACT_ORDER.indexOf(left);
    const rightIndex = ARTIFACT_ORDER.indexOf(right);
    if (leftIndex === -1 && rightIndex === -1) {
      return left.localeCompare(right);
    }
    if (leftIndex === -1) {
      return 1;
    }
    if (rightIndex === -1) {
      return -1;
    }
    return leftIndex - rightIndex;
  });
}

function runDirectoryId(kind: "audit" | "eval", site: string): string {
  const compactSite = site
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .toLowerCase();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const random = Math.random().toString(36).slice(2, 8);
  return `web-${kind}-${compactSite || "target"}-${timestamp}-${random}`;
}

function loadPresetFiles(presetId: string, options?: RuntimeOptions): PresetFiles {
  const preset = PRESETS.find((entry) => entry.id === presetId);
  if (!preset) {
    throw new Error(`Unknown presetId: ${presetId}`);
  }
  return {
    ...preset,
    brandPath: resolveFromRepo(preset.brandPath, options),
    competitorsPath: resolveFromRepo(preset.competitorsPath, options),
    promptsPath: resolveFromRepo(preset.promptsPath, options),
    runtimePath: resolveFromRepo(preset.runtimePath, options)
  };
}

async function loadPresetInputs(presetId: string, options?: RuntimeOptions): Promise<{
  preset: PresetFiles;
  brand: BrandConfig;
  competitors: CompetitorsConfig;
  prompts: PromptsConfig;
}> {
  const preset = loadPresetFiles(presetId, options);
  const [brand, competitors, prompts] = await Promise.all([
    loadBrandConfig(preset.brandPath),
    loadCompetitorsConfig(preset.competitorsPath),
    loadPromptsConfig(preset.promptsPath)
  ]);
  return { preset, brand, competitors, prompts };
}

async function writeRawPayloads(outDir: string, responses: ProviderResponse[]): Promise<void> {
  for (const response of responses) {
    const providerDir = path.join(outDir, "raw", response.provider);
    await mkdir(providerDir, { recursive: true });
    const suffix = response.sampleIndex > 0 ? `--sample-${response.sampleIndex + 1}` : "";
    const filePath = path.join(providerDir, `${response.promptId}${suffix}.json`);
    await writeFile(filePath, `${JSON.stringify(response.rawPayload, null, 2)}\n`, "utf8");
  }
}

async function runAuditIntoDirectory(
  outDir: string,
  site: string,
  presetId: string,
  options?: RuntimeOptions
): Promise<{ runId: string; outDir: string }> {
  const { brand, competitors, prompts } = await loadPresetInputs(presetId, options);
  const audit = await runAudit({
    siteInput: site,
    brand,
    competitors,
    prompts
  });
  await writeAuditOutputs(outDir, audit);
  return { runId: path.basename(outDir), outDir };
}

async function runEvalIntoDirectory(
  outDir: string,
  input: CreateEvalRunInput,
  resolvedRuntime: Awaited<ReturnType<typeof resolveEvalRuntime>>,
  options?: RuntimeOptions
): Promise<{ runId: string; outDir: string }> {
  const { brand, competitors, prompts } = await loadPresetInputs(input.presetId, options);
  const provider = resolvedRuntime.provider.value;
  const model = resolvedRuntime.model.value;
  const samples = resolvedRuntime.samples.value;
  const locale = resolvedRuntime.locale.value;
  const timeoutMs = resolvedRuntime.timeoutMs.value;
  const baseUrl = resolvedRuntime.baseUrl.value;
  const audit = await runAudit({
    siteInput: input.site,
    brand,
    competitors,
    prompts
  });

  const responses: ProviderResponse[] = [];
  for (const promptCase of prompts.prompts) {
    for (let sampleIndex = 0; sampleIndex < samples; sampleIndex += 1) {
      responses.push(
        await runEvalProvider(
          provider as ProviderName,
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
            baseUrl,
            timeoutMs,
            locale: promptCase.locale ?? locale ?? undefined,
            sampleIndex,
            runCount: samples,
            holdout: promptCase.holdout ?? false
          }
        )
      );
    }
  }

  const previousEval = await readEvalResults(path.join(outDir, "eval-results.json"));
  const evalResult = scoreEvalResponses({
    brand,
    competitors,
    prompts,
    audit,
    responses,
    rawPayloadRoot: path.join(outDir, "raw"),
    mode: "eval"
  });
  const auditWithVavr = applyEvalSummaryToAudit(audit, evalResult.summary, "eval");
  await writeAuditOutputs(outDir, auditWithVavr);
  await writeRawPayloads(outDir, responses);
  await writeEvalOutputs(outDir, evalResult, previousEval);
  return { runId: path.basename(outDir), outDir };
}

export async function listConfigPresets(options?: RuntimeOptions): Promise<ConfigPresetSummary[]> {
  return Promise.all(
    PRESETS.map(async (preset) => {
      const files = loadPresetFiles(preset.id, options);
      const [brand, runtimeDefaults] = await Promise.all([
        loadBrandConfig(files.brandPath),
        resolveEvalRuntime({ brandPath: files.brandPath, runtimePath: files.runtimePath })
      ]);
      return {
        id: preset.id,
        label: preset.label,
        description: preset.description,
        defaultSiteInput: preset.defaultSiteInput,
        brandPath: path.relative(repoRoot(options), files.brandPath),
        competitorsPath: path.relative(repoRoot(options), files.competitorsPath),
        promptsPath: path.relative(repoRoot(options), files.promptsPath),
        runtimePath: path.relative(repoRoot(options), files.runtimePath),
        runtimeDefaults: {
          provider: runtimeDefaults.provider.value,
          model: runtimeDefaults.model.value,
          locale: runtimeDefaults.locale.value,
          samples: runtimeDefaults.samples.value,
          timeoutMs: runtimeDefaults.timeoutMs.value,
          baseUrl: runtimeDefaults.baseUrl.value
        },
        recommendedProfile: recommendEvalProfile({
          provider: runtimeDefaults.provider.value,
          model: runtimeDefaults.model.value,
          locale: runtimeDefaults.locale.value,
          samples: runtimeDefaults.samples.value,
          timeoutMs: runtimeDefaults.timeoutMs.value
        }),
        siteDisplayName: brand.brand.site_display_name,
        domain: brand.brand.domain
      } satisfies ConfigPresetSummary;
    })
  );
}

export async function listRuns(options?: RuntimeOptions): Promise<AdminRunListItem[]> {
  const root = runsRoot(options);
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
  const runs: Array<AdminRunListItem | null> = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        try {
          const runPath = path.join(root, entry.name, "run.json");
          const manifest = await readJson<RunManifest>(runPath);
          const shareSummaryPath = path.join(root, entry.name, "share-summary.json");
          let shareSummary: ShareSummary | null = null;
          try {
            shareSummary = await readJson<ShareSummary>(shareSummaryPath);
          } catch {
            shareSummary = null;
          }

          return {
            id: entry.name,
            kind: manifest.kind,
            status: "completed",
            generatedAt: manifest.generatedAt,
            siteLabel: siteLabel(manifest.site),
            siteInput: manifest.site.input,
            overallScore:
              typeof manifest.summary.overallScore === "number"
                ? manifest.summary.overallScore
                : shareSummary && typeof shareSummary.metrics.overallScore === "number"
                  ? shareSummary.metrics.overallScore
                  : null,
            vavr:
              typeof shareSummary?.metrics.vavr === "number"
                ? shareSummary.metrics.vavr
                : null,
            artifactCount: manifest.artifacts.length
          } satisfies AdminRunListItem;
        } catch {
          return null;
        }
      })
  );

  return runs
    .filter((entry): entry is AdminRunListItem => entry !== null)
    .sort((left, right) => right.generatedAt.localeCompare(left.generatedAt));
}

export async function getRunDetail(runId: string, options?: RuntimeOptions): Promise<AdminRunDetail> {
  const runDir = path.join(runsRoot(options), runId);
  const manifest = await readJson<RunManifest>(path.join(runDir, "run.json"));
  const [shareSummary, auditResult, evalSummary, searchValidationSummary] = await Promise.all([
    readJsonOrNull<ShareSummary>(path.join(runDir, "share-summary.json")),
    readJsonOrNull<AuditResult>(path.join(runDir, "site-audit.json")),
    readJsonOrNull<EvalSummaryJson>(path.join(runDir, "eval-summary.json")),
    readJsonOrNull<SearchValidationSummaryJson>(path.join(runDir, "search-console-summary.json"))
  ]);

  const artifacts = sortArtifacts(manifest.artifacts).map((artifact) => ({
    name: artifact,
    path: path.join(runDir, artifact),
    contentType: artifactType(artifact)
  })) satisfies ArtifactEntry[];

  return {
    id: runId,
    manifest,
    shareSummary,
    auditResult,
    evalSummary,
    searchValidationSummary,
    artifacts
  };
}

export async function readRunArtifact(
  runId: string,
  artifactName: string,
  options?: RuntimeOptions
): Promise<{ entry: ArtifactEntry; content: string }> {
  const detail = await getRunDetail(runId, options);
  const entry = detail.artifacts.find((artifact) => artifact.name === artifactName);
  if (!entry) {
    throw new Error(`Unknown artifact ${artifactName} for run ${runId}`);
  }
  const content = await readFile(entry.path, "utf8");
  return { entry, content };
}

function queueJob(record: RunJobRecord): void {
  runtimeState.jobs.set(record.id, record);
}

function updateJob(jobId: string, patch: Partial<RunJobRecord>): void {
  const current = runtimeState.jobs.get(jobId);
  if (!current) {
    return;
  }
  runtimeState.jobs.set(jobId, {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString()
  });
}

export function getRunJob(jobId: string): RunJobRecord | null {
  return runtimeState.jobs.get(jobId) ?? null;
}

export async function createAuditRun(input: CreateAuditRunInput, options?: RuntimeOptions): Promise<RunJobRecord> {
  const id = crypto.randomUUID();
  const outDir = path.join(runsRoot(options), runDirectoryId("audit", input.site));
  const now = new Date().toISOString();
  const job: RunJobRecord = {
    id,
    kind: "audit",
    status: "queued",
    site: input.site,
    presetId: input.presetId,
    startedAt: now,
    updatedAt: now
  };
  queueJob(job);

  void (async () => {
    try {
      updateJob(id, { status: "running" });
      const result = await runAuditIntoDirectory(outDir, input.site, input.presetId, options);
      updateJob(id, { status: "completed", runId: result.runId });
    } catch (error) {
      updateJob(id, {
        status: "failed",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  })();

  return job;
}

export async function createEvalRun(input: CreateEvalRunInput, options?: RuntimeOptions): Promise<RunJobRecord> {
  const preset = loadPresetFiles(input.presetId, options);
  const resolvedRuntime = await resolveEvalRuntime({
    brandPath: preset.brandPath,
    runtimePath: resolveMaybeRepoPath(input.runtimePath, options) ?? preset.runtimePath,
    profile: input.profile,
    provider: input.provider,
    model: input.model,
    locale: input.locale,
    samples: input.samples,
    timeoutMs: input.timeoutMs,
    baseUrl: input.baseUrl
  });
  const id = crypto.randomUUID();
  const outDir = path.join(runsRoot(options), runDirectoryId("eval", input.site));
  const now = new Date().toISOString();
  const job: RunJobRecord = {
    id,
    kind: "eval",
    status: "queued",
    site: input.site,
    presetId: input.presetId,
    provider: resolvedRuntime.provider.value,
    startedAt: now,
    updatedAt: now
  };
  queueJob(job);

  void (async () => {
    try {
      updateJob(id, { status: "running" });
      const result = await runEvalIntoDirectory(outDir, input, resolvedRuntime, options);
      updateJob(id, { status: "completed", runId: result.runId });
    } catch (error) {
      updateJob(id, {
        status: "failed",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  })();

  return job;
}
