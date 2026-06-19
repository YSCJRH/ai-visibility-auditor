import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

type FetchResponse = {
  ok: boolean;
  status: number;
  statusText: string;
  json: () => Promise<unknown>;
};

type FetchLike = (url: string, init?: { headers?: Record<string, string> }) => Promise<FetchResponse>;

type RemoteReleaseEntry = {
  tag_name?: unknown;
  name?: unknown;
  html_url?: unknown;
  published_at?: unknown;
  body?: unknown;
  draft?: unknown;
  prerelease?: unknown;
};

export type ReleaseSnapshotEntry = {
  tag_name: string;
  name: string;
  html_url: string;
  published_at: string;
  body: string;
};

export type ReleaseSnapshotRefreshResult = {
  snapshotPath: string;
  changed: boolean;
  releaseCount: number;
  changedTags: string[];
  written: boolean;
};

export type ReleaseSnapshotRefreshOptions = {
  snapshotPath?: string;
  remoteReleasesPath?: string;
  repository?: string;
  githubToken?: string;
  fetchImpl?: FetchLike;
  write?: boolean;
};

const DEFAULT_REPOSITORY = "YSCJRH/ai-visibility-auditor";
const DEFAULT_SNAPSHOT_PATH = "scripts/distribution/releases-snapshot.json";

export async function runReleaseSnapshotRefresh(options: ReleaseSnapshotRefreshOptions = {}): Promise<ReleaseSnapshotRefreshResult> {
  const snapshotPath = path.resolve(options.snapshotPath ?? DEFAULT_SNAPSHOT_PATH);
  const repository = options.repository ?? process.env.GITHUB_REPOSITORY ?? DEFAULT_REPOSITORY;
  const currentSnapshot = await readSnapshotFile(snapshotPath);
  const remote = options.remoteReleasesPath
    ? await readRemoteFile(path.resolve(options.remoteReleasesPath))
    : await fetchRemoteReleases(repository, options.githubToken ?? process.env.GITHUB_TOKEN, options.fetchImpl ?? (globalThis.fetch as unknown as FetchLike));
  const nextSnapshot = normalizeReleaseSnapshot(remote, currentSnapshot);
  if (nextSnapshot.length === 0) {
    throw new Error("GitHub release metadata did not contain any public releases to snapshot.");
  }

  const nextText = `${JSON.stringify(nextSnapshot, null, 2)}\n`;
  const currentText = `${JSON.stringify(currentSnapshot, null, 2)}\n`;
  const changed = currentText !== nextText;
  const changedTags = changed ? changedReleaseTags(currentSnapshot, nextSnapshot) : [];

  if (options.write && changed) {
    await writeFile(snapshotPath, nextText, "utf8");
  }

  return {
    snapshotPath,
    changed,
    releaseCount: nextSnapshot.length,
    changedTags,
    written: Boolean(options.write && changed)
  };
}

function normalizeReleaseSnapshot(releases: RemoteReleaseEntry[], currentSnapshot: ReleaseSnapshotEntry[]): ReleaseSnapshotEntry[] {
  const currentByTag = new Map(currentSnapshot.map((release) => [release.tag_name, release]));
  return releases
    .filter((release) => release.draft !== true)
    .map(toSnapshotEntry)
    .filter((entry): entry is ReleaseSnapshotEntry => entry !== null)
    .map((entry) => {
      const current = currentByTag.get(entry.tag_name);
      return current && equivalentEntry(current, entry) ? current : entry;
    });
}

function toSnapshotEntry(release: RemoteReleaseEntry): ReleaseSnapshotEntry | null {
  const tagName = stringField(release, "tag_name");
  const htmlUrl = stringField(release, "html_url");
  const publishedAt = stringField(release, "published_at");
  if (!tagName || !htmlUrl || !publishedAt) {
    return null;
  }

  return {
    tag_name: tagName,
    name: stringField(release, "name") || tagName,
    html_url: htmlUrl,
    published_at: publishedAt,
    body: normalizeBody(stringField(release, "body"))
  };
}

async function readSnapshotFile(snapshotPath: string): Promise<ReleaseSnapshotEntry[]> {
  try {
    const parsed = JSON.parse(await readFile(snapshotPath, "utf8")) as unknown;
    return Array.isArray(parsed) ? parsed.map(toExistingSnapshotEntry).filter((entry): entry is ReleaseSnapshotEntry => entry !== null) : [];
  } catch (error) {
    throw new Error(`Unable to read release snapshot ${snapshotPath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function toExistingSnapshotEntry(release: RemoteReleaseEntry): ReleaseSnapshotEntry | null {
  const tagName = stringField(release, "tag_name");
  const htmlUrl = stringField(release, "html_url");
  const publishedAt = stringField(release, "published_at");
  if (!tagName || !htmlUrl || !publishedAt) {
    return null;
  }

  return {
    tag_name: tagName,
    name: stringField(release, "name") || tagName,
    html_url: htmlUrl,
    published_at: publishedAt,
    body: stringField(release, "body")
  };
}

async function readRemoteFile(remotePath: string): Promise<RemoteReleaseEntry[]> {
  try {
    const parsed = JSON.parse(await readFile(remotePath, "utf8")) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error("remote release metadata must be a JSON array");
    }
    return parsed as RemoteReleaseEntry[];
  } catch (error) {
    throw new Error(`Unable to read remote release metadata ${remotePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function fetchRemoteReleases(repository: string, githubToken: string | undefined, fetchImpl: FetchLike): Promise<RemoteReleaseEntry[]> {
  const url = `https://api.github.com/repos/${repository}/releases?per_page=20`;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "answerlens-release-snapshot-refresh"
  };
  if (githubToken) {
    headers.Authorization = `Bearer ${githubToken}`;
  }

  const response = await fetchImpl(url, { headers });
  if (!response.ok) {
    throw new Error(`GitHub releases API returned HTTP ${response.status} ${response.statusText}`.trim());
  }

  const parsed = await response.json();
  if (!Array.isArray(parsed)) {
    throw new Error("GitHub releases API did not return an array.");
  }
  return parsed as RemoteReleaseEntry[];
}

function changedReleaseTags(current: ReleaseSnapshotEntry[], next: ReleaseSnapshotEntry[]): string[] {
  const tags = new Set([...current.map((release) => release.tag_name), ...next.map((release) => release.tag_name)]);
  return [...tags].filter((tag) => {
    const currentRelease = current.find((release) => release.tag_name === tag);
    const nextRelease = next.find((release) => release.tag_name === tag);
    return JSON.stringify(currentRelease ?? null) !== JSON.stringify(nextRelease ?? null);
  });
}

function equivalentEntry(current: ReleaseSnapshotEntry, next: ReleaseSnapshotEntry): boolean {
  return (
    current.tag_name === next.tag_name &&
    current.name === next.name &&
    current.html_url === next.html_url &&
    current.published_at === next.published_at &&
    normalizeBody(current.body) === normalizeBody(next.body)
  );
}

function stringField(release: RemoteReleaseEntry, field: keyof RemoteReleaseEntry): string {
  const value = release[field];
  return typeof value === "string" ? value : "";
}

function normalizeBody(value: string): string {
  return value.replace(/\r\n/g, "\n").trimEnd();
}

function parseArgs(argv: string[]): ReleaseSnapshotRefreshOptions {
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
    githubToken: flags.get("github-token"),
    write: flags.get("write") === "true"
  };
}

async function main(): Promise<void> {
  const result = await runReleaseSnapshotRefresh(parseArgs(process.argv.slice(2)));
  if (!result.changed) {
    console.log(`Release snapshot is already fresh (${result.releaseCount} release(s)).`);
    return;
  }

  const tagList = result.changedTags.length ? result.changedTags.join(", ") : "(unknown tags)";
  if (result.written) {
    console.log(`Release snapshot refreshed at ${result.snapshotPath} (${result.releaseCount} release(s); changed: ${tagList}).`);
    return;
  }

  console.log(`Release snapshot would change (${result.releaseCount} release(s); changed: ${tagList}).`);
  console.log("Re-run with --write to update scripts/distribution/releases-snapshot.json.");
}

const isCliEntrypoint =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isCliEntrypoint) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
