import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runReleaseSnapshotCheck } from "./release-snapshot-check.ts";

test("release-snapshot-check passes when latest stable snapshot matches remote metadata", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "answerlens-release-snapshot-"));
  const snapshotPath = path.join(rootDir, "snapshot.json");
  const remotePath = path.join(rootDir, "remote.json");
  await writeReleaseFiles(snapshotPath, remotePath, release({ tag_name: "v0.3.5" }));

  const findings = await runReleaseSnapshotCheck({ snapshotPath, remoteReleasesPath: remotePath });

  assert.deepEqual(findings, []);
});

test("release-snapshot-check reports stale latest stable fields", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "answerlens-release-snapshot-"));
  const snapshotPath = path.join(rootDir, "snapshot.json");
  const remotePath = path.join(rootDir, "remote.json");
  await writeJson(snapshotPath, [
    release({
      tag_name: "v0.3.4",
      name: "v0.3.4",
      html_url: "https://github.com/YSCJRH/ai-visibility-auditor/releases/tag/v0.3.4",
      published_at: "2026-06-10T00:00:00Z",
      body: "Old body"
    })
  ]);
  await writeJson(remotePath, [release({ tag_name: "v0.3.5" })]);

  const findings = await runReleaseSnapshotCheck({ snapshotPath, remoteReleasesPath: remotePath });

  assert.deepEqual(
    findings.map((finding) => finding.ruleId),
    [
      "release-snapshot-freshness",
      "release-snapshot-freshness",
      "release-snapshot-freshness",
      "release-snapshot-freshness",
      "release-snapshot-freshness"
    ]
  );
  assert.match(findings[0].message, /tag_name is stale/);
  assert.match(findings[4].message, /body is stale/);
});

test("release-snapshot-check ignores draft and prerelease entries before the latest stable release", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "answerlens-release-snapshot-"));
  const snapshotPath = path.join(rootDir, "snapshot.json");
  const remotePath = path.join(rootDir, "remote.json");
  const stable = release({ tag_name: "v0.3.5" });
  await writeJson(snapshotPath, [stable]);
  await writeJson(remotePath, [
    release({ tag_name: "v0.4.0-alpha.1", prerelease: true }),
    release({ tag_name: "v0.4.0", draft: true }),
    stable
  ]);

  const findings = await runReleaseSnapshotCheck({ snapshotPath, remoteReleasesPath: remotePath });

  assert.deepEqual(findings, []);
});

test("release-snapshot-check can fetch remote metadata", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "answerlens-release-snapshot-"));
  const snapshotPath = path.join(rootDir, "snapshot.json");
  await writeJson(snapshotPath, [release({ tag_name: "v0.3.5" })]);

  const findings = await runReleaseSnapshotCheck({
    snapshotPath,
    repository: "YSCJRH/ai-visibility-auditor",
    fetchImpl: async (url, init) => {
      assert.equal(url, "https://api.github.com/repos/YSCJRH/ai-visibility-auditor/releases?per_page=20");
      assert.equal(init?.headers?.["User-Agent"], "answerlens-release-snapshot-check");
      return responseFor([release({ tag_name: "v0.3.5" })]);
    }
  });

  assert.deepEqual(findings, []);
});

test("release-snapshot-check sends an authorization header when a GitHub token is available", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "answerlens-release-snapshot-auth-"));
  const snapshotPath = path.join(rootDir, "snapshot.json");
  await writeJson(snapshotPath, [release({ tag_name: "v0.3.5" })]);

  const findings = await runReleaseSnapshotCheck({
    snapshotPath,
    githubToken: "ghs_example",
    fetchImpl: async (_url, init) => {
      assert.equal(init?.headers?.Authorization, "Bearer ghs_example");
      return responseFor([release({ tag_name: "v0.3.5" })]);
    }
  });

  assert.deepEqual(findings, []);
});

test("release-snapshot-check reports remote API failures", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "answerlens-release-snapshot-"));
  const snapshotPath = path.join(rootDir, "snapshot.json");
  await writeJson(snapshotPath, [release({ tag_name: "v0.3.5" })]);

  const findings = await runReleaseSnapshotCheck({
    snapshotPath,
    fetchImpl: async () => responseFor({ message: "rate limited" }, 403)
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].ruleId, "release-snapshot-remote");
});

async function writeReleaseFiles(snapshotPath: string, remotePath: string, latestRelease: ReleaseFixture): Promise<void> {
  await writeJson(snapshotPath, [latestRelease]);
  await writeJson(remotePath, [latestRelease]);
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

type ReleaseFixture = {
  tag_name: string;
  name: string;
  html_url: string;
  published_at: string;
  body: string;
  draft?: boolean;
  prerelease?: boolean;
};

function release(overrides: Partial<ReleaseFixture>): ReleaseFixture {
  const tag = overrides.tag_name ?? "v0.3.5";
  return {
    tag_name: tag,
    name: overrides.name ?? tag,
    html_url: overrides.html_url ?? `https://github.com/YSCJRH/ai-visibility-auditor/releases/tag/${tag}`,
    published_at: overrides.published_at ?? "2026-06-17T12:38:46Z",
    body: overrides.body ?? "Release body\nwith exact public notes",
    draft: overrides.draft,
    prerelease: overrides.prerelease
  };
}

function responseFor(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, statusText: status === 200 ? "OK" : "Forbidden" });
}
