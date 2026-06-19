import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

type FetchResponse = {
  ok: boolean;
  status: number;
  statusText: string;
  text: () => Promise<string>;
};

type FetchLike = (url: string, init?: { signal?: AbortSignal }) => Promise<FetchResponse>;

export type PagesSmokeFinding = {
  ruleId: "pages-live-route" | "pages-live-snippet";
  url: string;
  message: string;
};

export type PagesSmokeOptions = {
  siteUrl?: string;
  retries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
};

type RouteCheck = {
  path: string;
  label: string;
  snippets: string[];
};

const DEFAULT_SITE_URL = "https://yscjrh.github.io/ai-visibility-auditor/";
const DEFAULT_RETRIES = 5;
const DEFAULT_RETRY_DELAY_MS = 5000;
const DEFAULT_TIMEOUT_MS = 15000;
const SHOW_AND_TELL_DISCUSSION_URL = "https://github.com/YSCJRH/ai-visibility-auditor/discussions/new?category=show-and-tell";

const ARTIFACT_ORDER_SNIPPETS = ["share-summary.md", "scorecard.md", "recommendations.md"];

const ROUTES: RouteCheck[] = [
  {
    path: "en/releases/",
    label: "English release page",
    snippets: ["Download the latest AnswerLens release.", SHOW_AND_TELL_DISCUSSION_URL, ...ARTIFACT_ORDER_SNIPPETS]
  },
  {
    path: "zh/releases/",
    label: "Chinese release page",
    snippets: ["下载最新的 AnswerLens 发布版本", SHOW_AND_TELL_DISCUSSION_URL, ...ARTIFACT_ORDER_SNIPPETS]
  },
  {
    path: "examples/static-good/index.html",
    label: "English live demo report",
    snippets: [
      "Review and share this run",
      SHOW_AND_TELL_DISCUSSION_URL,
      "first-run story template",
      "raw provider payloads",
      ...ARTIFACT_ORDER_SNIPPETS
    ]
  },
  {
    path: "zh/examples/static-good/index.html",
    label: "Chinese live demo report",
    snippets: [
      "审阅并分享这次运行",
      SHOW_AND_TELL_DISCUSSION_URL,
      "first-run story template",
      "raw provider payloads",
      ...ARTIFACT_ORDER_SNIPPETS
    ]
  },
  {
    path: "en/use-case/open-source-maintainers/",
    label: "Open-source maintainer page",
    snippets: ["AnswerLens for open-source maintainers.", SHOW_AND_TELL_DISCUSSION_URL, "reuse permission", "raw-payload boundaries"]
  }
];

export async function runPagesSmokeCheck(options: PagesSmokeOptions = {}): Promise<PagesSmokeFinding[]> {
  const siteUrl = withTrailingSlash(options.siteUrl ?? process.env.ANSWERLENS_SITE_URL ?? DEFAULT_SITE_URL);
  const retries = positiveInteger(options.retries, DEFAULT_RETRIES);
  const retryDelayMs = nonNegativeInteger(options.retryDelayMs, DEFAULT_RETRY_DELAY_MS);
  const timeoutMs = nonNegativeInteger(options.timeoutMs, DEFAULT_TIMEOUT_MS);
  const fetchImpl = options.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
  const findings: PagesSmokeFinding[] = [];

  for (const route of ROUTES) {
    const url = new URL(route.path, siteUrl).href;
    const result = await fetchTextWithRetry(url, { retries, retryDelayMs, timeoutMs, fetchImpl });
    if (!result.ok) {
      findings.push({
        ruleId: "pages-live-route",
        url,
        message: `${route.label} did not return a readable 2xx response: ${result.error}`
      });
      continue;
    }

    for (const snippet of route.snippets) {
      if (!result.text.includes(snippet)) {
        findings.push({
          ruleId: "pages-live-snippet",
          url,
          message: `${route.label} is missing expected live Pages text: ${snippet}`
        });
      }
    }
  }

  return findings;
}

async function fetchTextWithRetry(
  url: string,
  options: { retries: number; retryDelayMs: number; timeoutMs: number; fetchImpl: FetchLike }
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  let lastError = "unknown error";

  for (let attempt = 1; attempt <= options.retries; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url, options.fetchImpl, options.timeoutMs);
      if (response.ok) {
        return { ok: true, text: await response.text() };
      }
      lastError = `HTTP ${response.status} ${response.statusText}`.trim();
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    if (attempt < options.retries && options.retryDelayMs > 0) {
      await delay(options.retryDelayMs);
    }
  }

  return { ok: false, error: lastError };
}

async function fetchWithTimeout(url: string, fetchImpl: FetchLike, timeoutMs: number): Promise<FetchResponse> {
  if (timeoutMs <= 0) {
    return fetchImpl(url);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function withTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isInteger(value) && value > 0 ? value : fallback;
}

function nonNegativeInteger(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isInteger(value) && value >= 0 ? value : fallback;
}

function parseArgs(argv: string[]): PagesSmokeOptions {
  const flags = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--") {
      continue;
    }
    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      flags.set(key, "true");
      continue;
    }

    flags.set(key, next);
    index += 1;
  }

  return {
    siteUrl: flags.get("site-url"),
    retries: parseOptionalInteger(flags.get("retries")),
    retryDelayMs: parseOptionalInteger(flags.get("retry-delay-ms")),
    timeoutMs: parseOptionalInteger(flags.get("timeout-ms"))
  };
}

function parseOptionalInteger(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
}

async function main(): Promise<void> {
  const findings = await runPagesSmokeCheck(parseArgs(process.argv.slice(2)));
  if (findings.length === 0) {
    console.log("Pages smoke check passed.");
    return;
  }

  console.error(`Pages smoke check failed with ${findings.length} finding(s).`);
  for (const finding of findings) {
    console.error(`- ${finding.ruleId} (${finding.url}): ${finding.message}`);
  }
  process.exitCode = 1;
}

const isCliEntrypoint =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isCliEntrypoint) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
