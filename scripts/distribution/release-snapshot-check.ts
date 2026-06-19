import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

type FetchResponse = {
  ok: boolean;
  status: number;
  statusText: string;
  text: () => Promise<string>;
  json: () => Promise<unknown>;
};

type FetchLike = (url: string, init?: { headers?: Record<string, string> }) => Promise<FetchResponse>;

type ReleaseEntry = {
  tag_name?: unknown;
  name?: unknown;
  html_url?: unknown;
  published_at?: unknown;
  body?: unknown;
  draft?: unknown;
  prerelease?: unknown;
};

export type ReleaseSnapshotFinding = {
  ruleId: "release-snapshot-read" | "release-snapshot-remote" | "release-snapshot-freshness";
  path: string;
  message: string;
};

export type ReleaseSnapshotCheckOptions = {
  snapshotPath?: string;
  remoteReleasesPath?: string;
  repository?: string;
  githubToken?: string;
  fetchImpl?: FetchLike;
};

const DEFAULT_REPOSITORY = "YSCJRH/ai-visibility-auditor";
const DEFAULT_SNAPSHOT_PATH = "scripts/distribution/releases-snapshot.json";

export async function runReleaseSnapshotCheck(options: ReleaseSnapshotCheckOptions = {}): Promise<ReleaseSnapshotFinding[]> {
  const snapshotPath = path.resolve(options.snapshotPath ?? DEFAULT_SNAPSHOT_PATH);
  const repository = options.repository ?? process.env.GITHUB_REPOSITORY ?? DEFAULT_REPOSITORY;
  const findings: ReleaseSnapshotFinding[] = [];
  const snapshot = await readReleaseFile(snapshotPath, "release-snapshot-read", findings);
  const remote = options.remoteReleasesPath
    ? await readReleaseFile(path.resolve(options.remoteReleasesPath), "release-snapshot-remote", findings)
    : await fetchRemoteReleases(
        repository,
        options.githubToken ?? process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN,
        options.fetchImpl ?? (globalThis.fetch as unknown as FetchLike),
        findings
      );

  if (!snapshot || !remote) {
    return findings;
  }

  const localLatest = firstStableRelease(snapshot);
  const remoteLatest = firstStableRelease(remote);
  if (!localLatest || !remoteLatest) {
    findings.push({
      ruleId: "release-snapshot-freshness",
      path: snapshotPath,
      message: "Release snapshot and remote metadata must both contain at least one stable public release."
    });
    return findings;
  }

  compareField("tag_name", localLatest, remoteLatest, snapshotPath, findings);
  compareField("name", localLatest, remoteLatest, snapshotPath, findings);
  compareField("html_url", localLatest, remoteLatest, snapshotPath, findings);
  compareField("published_at", localLatest, remoteLatest, snapshotPath, findings);
  compareField("body", localLatest, remoteLatest, snapshotPath, findings, normalizeBody);

  return findings;
}

async function readReleaseFile(
  absolutePath: string,
  ruleId: "release-snapshot-read" | "release-snapshot-remote",
  findings: ReleaseSnapshotFinding[]
): Promise<ReleaseEntry[] | null> {
  try {
    const parsed = JSON.parse(await readFile(absolutePath, "utf8")) as unknown;
    if (!Array.isArray(parsed)) {
      findings.push({
        ruleId,
        path: absolutePath,
        message: "Release metadata must be a JSON array."
      });
      return null;
    }
    return parsed as ReleaseEntry[];
  } catch (error) {
    findings.push({
      ruleId,
      path: absolutePath,
      message: `Unable to read release metadata: ${error instanceof Error ? error.message : String(error)}`
    });
    return null;
  }
}

async function fetchRemoteReleases(
  repository: string,
  githubToken: string | undefined,
  fetchImpl: FetchLike,
  findings: ReleaseSnapshotFinding[]
): Promise<ReleaseEntry[] | null> {
  const url = `https://api.github.com/repos/${repository}/releases?per_page=20`;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "answerlens-release-snapshot-check"
  };
  if (githubToken) {
    headers.Authorization = `Bearer ${githubToken}`;
  }

  try {
    const response = await fetchImpl(url, { headers });
    if (!response.ok) {
      findings.push({
        ruleId: "release-snapshot-remote",
        path: url,
        message: `GitHub releases API returned HTTP ${response.status} ${response.statusText}`.trim()
      });
      return null;
    }

    const parsed = await response.json();
    if (!Array.isArray(parsed)) {
      findings.push({
        ruleId: "release-snapshot-remote",
        path: url,
        message: "GitHub releases API did not return an array."
      });
      return null;
    }
    return parsed as ReleaseEntry[];
  } catch (error) {
    findings.push({
      ruleId: "release-snapshot-remote",
      path: url,
      message: `Unable to fetch GitHub release metadata: ${error instanceof Error ? error.message : String(error)}`
    });
    return null;
  }
}

function firstStableRelease(releases: ReleaseEntry[]): ReleaseEntry | undefined {
  return releases.find((release) => {
    const tag = stringField(release, "tag_name");
    return Boolean(tag && /^v\d+\.\d+\.\d+$/.test(tag) && release.draft !== true && release.prerelease !== true);
  });
}

function compareField(
  field: "tag_name" | "name" | "html_url" | "published_at" | "body",
  local: ReleaseEntry,
  remote: ReleaseEntry,
  snapshotPath: string,
  findings: ReleaseSnapshotFinding[],
  normalize: (value: string) => string = identity
): void {
  const localValue = stringField(local, field);
  const remoteValue = stringField(remote, field);
  if (normalize(localValue) === normalize(remoteValue)) {
    return;
  }

  findings.push({
    ruleId: "release-snapshot-freshness",
    path: snapshotPath,
    message: `Latest release snapshot ${field} is stale. Expected ${JSON.stringify(remoteValue)}, found ${JSON.stringify(localValue)}.`
  });
}

function stringField(release: ReleaseEntry, field: keyof ReleaseEntry): string {
  const value = release[field];
  return typeof value === "string" ? value : "";
}

function normalizeBody(value: string): string {
  return value.replace(/\r\n/g, "\n").trimEnd();
}

function identity(value: string): string {
  return value;
}

function parseArgs(argv: string[]): ReleaseSnapshotCheckOptions {
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
    snapshotPath: flags.get("snapshot"),
    remoteReleasesPath: flags.get("remote-releases"),
    repository: flags.get("repository"),
    githubToken: flags.get("github-token")
  };
}

async function main(): Promise<void> {
  const findings = await runReleaseSnapshotCheck(parseArgs(process.argv.slice(2)));
  if (findings.length === 0) {
    console.log("Release snapshot check passed.");
    return;
  }

  console.error(`Release snapshot check failed with ${findings.length} finding(s).`);
  for (const finding of findings) {
    console.error(`- ${finding.ruleId} (${finding.path}): ${finding.message}`);
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
