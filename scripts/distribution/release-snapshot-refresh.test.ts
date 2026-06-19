import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runReleaseSnapshotRefresh } from "./release-snapshot-refresh.ts";

test("release-snapshot-refresh reports changed tags without writing by default", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "answerlens-release-snapshot-refresh-"));
  const snapshotPath = path.join(rootDir, "snapshot.json");
  const remotePath = path.join(rootDir, "remote.json");
  await writeJson(snapshotPath, [release({ tag_name: "v0.3.4", body: "Old body" })]);
  await writeJson(remotePath, [release({ tag_name: "v0.3.5" })]);

  const result = await runReleaseSnapshotRefresh({ snapshotPath, remoteReleasesPath: remotePath });
  const snapshot = JSON.parse(await readFile(snapshotPath, "utf8")) as ReleaseFixture[];

  assert.equal(result.changed, true);
  assert.equal(result.written, false);
  assert.deepEqual(result.changedTags, ["v0.3.4", "v0.3.5"]);
  assert.equal(snapshot[0].tag_name, "v0.3.4");
});

test("release-snapshot-refresh writes normalized public release metadata when requested", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "answerlens-release-snapshot-refresh-"));
  const snapshotPath = path.join(rootDir, "snapshot.json");
  const remotePath = path.join(rootDir, "remote.json");
  await writeJson(snapshotPath, [
    release({ tag_name: "v0.3.5", body: "Already fresh\n" }),
    release({ tag_name: "v0.3.4", body: "Old body" })
  ]);
  await writeJson(remotePath, [
    release({ tag_name: "v0.3.5", body: "Already fresh" }),
    release({ tag_name: "v0.3.4", body: "New body\r\n" }),
    release({ tag_name: "v0.4.0-alpha.1", prerelease: true }),
    release({ tag_name: "v0.4.0", draft: true })
  ]);

  const result = await runReleaseSnapshotRefresh({ snapshotPath, remoteReleasesPath: remotePath, write: true });
  const snapshot = JSON.parse(await readFile(snapshotPath, "utf8")) as ReleaseFixture[];

  assert.equal(result.changed, true);
  assert.equal(result.written, true);
  assert.deepEqual(
    snapshot.map((item) => item.tag_name),
    ["v0.3.5", "v0.3.4", "v0.4.0-alpha.1"]
  );
  assert.equal(snapshot[0].body, "Already fresh\n");
  assert.equal(snapshot[1].body, "New body");
});

test("release-snapshot-refresh reports fresh snapshots", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "answerlens-release-snapshot-refresh-"));
  const snapshotPath = path.join(rootDir, "snapshot.json");
  const remotePath = path.join(rootDir, "remote.json");
  const latest = release({ tag_name: "v0.3.5" });
  await writeJson(snapshotPath, [latest]);
  await writeJson(remotePath, [latest]);

  const result = await runReleaseSnapshotRefresh({ snapshotPath, remoteReleasesPath: remotePath });

  assert.equal(result.changed, false);
  assert.equal(result.written, false);
  assert.deepEqual(result.changedTags, []);
});

test("release-snapshot-refresh can fetch remote metadata", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "answerlens-release-snapshot-refresh-"));
  const snapshotPath = path.join(rootDir, "snapshot.json");
  await writeJson(snapshotPath, [release({ tag_name: "v0.3.5" })]);

  const result = await runReleaseSnapshotRefresh({
    snapshotPath,
    repository: "YSCJRH/ai-visibility-auditor",
    fetchImpl: async (url, init) => {
      assert.equal(url, "https://api.github.com/repos/YSCJRH/ai-visibility-auditor/releases?per_page=20");
      assert.equal(init?.headers?.["User-Agent"], "answerlens-release-snapshot-refresh");
      return responseFor([release({ tag_name: "v0.3.5" })]);
    }
  });

  assert.equal(result.changed, false);
});

test("release-snapshot-refresh reports remote API failures", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "answerlens-release-snapshot-refresh-"));
  const snapshotPath = path.join(rootDir, "snapshot.json");
  await writeJson(snapshotPath, [release({ tag_name: "v0.3.5" })]);

  await assert.rejects(
    runReleaseSnapshotRefresh({
      snapshotPath,
      fetchImpl: async () => responseFor({ message: "rate limited" }, 403)
    }),
    /GitHub releases API returned HTTP 403 Forbidden/
  );
});

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
