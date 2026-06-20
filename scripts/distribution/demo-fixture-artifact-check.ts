import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type DemoFixtureArtifactFinding = {
  ruleId: string;
  path: string;
  message: string;
};

type DemoFixtureArtifactCheckOptions = {
  rootDir?: string;
  outDir?: string;
};

const DEFAULT_OUT_DIR = "runs/static-good";
const PRIMARY_ARTIFACTS = ["share-summary.md", "scorecard.md", "recommendations.md"] as const;
const REQUIRED_ARTIFACTS = [
  ...PRIMARY_ARTIFACTS,
  "pr-snippet.md",
  "share-summary.json",
  "run.json",
  "index.html",
  "site-audit.json"
] as const;
const SHARE_BOUNDARY_SNIPPETS = [
  "AnswerLens starter bundle",
  "first-run story template",
  "Show and tell Discussion form",
  "raw provider payloads",
  "private analytics",
  "does not scrape consumer AI UIs",
  "guarantee answer-surface rankings"
] as const;

export async function runDemoFixtureArtifactCheck(
  options: DemoFixtureArtifactCheckOptions = {}
): Promise<DemoFixtureArtifactFinding[]> {
  const rootDir = path.resolve(options.rootDir ?? process.cwd());
  const outDir = resolveOutDir(rootDir, options.outDir ?? DEFAULT_OUT_DIR);
  const findings: DemoFixtureArtifactFinding[] = [];

  for (const artifact of REQUIRED_ARTIFACTS) {
    await requireArtifact(rootDir, outDir, artifact, findings);
  }

  const runManifest = await readJsonRecord(rootDir, outDir, "run.json", findings);
  if (runManifest) {
    if (runManifest.kind !== "audit") {
      findings.push(finding("demo-fixture-run-kind", displayPath(rootDir, path.join(outDir, "run.json")), "Fixture demo must produce an audit run."));
    }
    const site = isRecord(runManifest.site) ? runManifest.site : null;
    if (site?.baseUrl !== "https://fixture.local") {
      findings.push(
        finding(
          "demo-fixture-site",
          displayPath(rootDir, path.join(outDir, "run.json")),
          "Fixture demo must keep https://fixture.local as the stable fixture host."
        )
      );
    }
    checkArtifactList(runManifest.artifacts, "run.json", rootDir, outDir, findings);
  }

  const shareSummaryJson = await readJsonRecord(rootDir, outDir, "share-summary.json", findings);
  if (shareSummaryJson) {
    if (shareSummaryJson.project !== "AnswerLens" || shareSummaryJson.tagline !== "CI for AI discoverability.") {
      findings.push(
        finding(
          "demo-fixture-share-summary-identity",
          displayPath(rootDir, path.join(outDir, "share-summary.json")),
          "Fixture share summary must preserve the AnswerLens project identity and tagline."
        )
      );
    }
    checkArtifactList(shareSummaryJson.artifacts, "share-summary.json", rootDir, outDir, findings);
  }

  const shareSummaryMarkdown = await readText(rootDir, outDir, "share-summary.md", findings);
  if (shareSummaryMarkdown) {
    checkTextOrder(shareSummaryMarkdown, "share-summary.md", rootDir, outDir, findings);
    checkTextSnippets(shareSummaryMarkdown, "share-summary.md", SHARE_BOUNDARY_SNIPPETS, rootDir, outDir, findings);
  }

  const prSnippet = await readText(rootDir, outDir, "pr-snippet.md", findings);
  if (prSnippet) {
    checkTextOrder(prSnippet, "pr-snippet.md", rootDir, outDir, findings);
    checkTextSnippets(prSnippet, "pr-snippet.md", SHARE_BOUNDARY_SNIPPETS.slice(1), rootDir, outDir, findings);
  }

  const htmlReport = await readText(rootDir, outDir, "index.html", findings);
  if (htmlReport) {
    checkTextOrder(htmlReport, "index.html", rootDir, outDir, findings);
  }

  return findings;
}

async function requireArtifact(
  rootDir: string,
  outDir: string,
  artifact: string,
  findings: DemoFixtureArtifactFinding[]
): Promise<void> {
  const artifactPath = path.join(outDir, artifact);
  try {
    await access(artifactPath);
  } catch {
    findings.push(
      finding(
        "demo-fixture-artifact-missing",
        displayPath(rootDir, artifactPath),
        `Demo fixture must generate ${artifact} for first-run review.`
      )
    );
  }
}

async function readText(
  rootDir: string,
  outDir: string,
  artifact: string,
  findings: DemoFixtureArtifactFinding[]
): Promise<string | null> {
  const artifactPath = path.join(outDir, artifact);
  try {
    return await readFile(artifactPath, "utf8");
  } catch (error) {
    findings.push(
      finding(
        "demo-fixture-artifact-readable",
        displayPath(rootDir, artifactPath),
        `Unable to read ${artifact}: ${error instanceof Error ? error.message : String(error)}`
      )
    );
    return null;
  }
}

async function readJsonRecord(
  rootDir: string,
  outDir: string,
  artifact: string,
  findings: DemoFixtureArtifactFinding[]
): Promise<Record<string, unknown> | null> {
  const raw = await readText(rootDir, outDir, artifact, findings);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) {
      throw new Error("top-level value is not an object");
    }
    return parsed;
  } catch (error) {
    findings.push(
      finding(
        "demo-fixture-json-readable",
        displayPath(rootDir, path.join(outDir, artifact)),
        `Unable to parse ${artifact}: ${error instanceof Error ? error.message : String(error)}`
      )
    );
    return null;
  }
}

function checkArtifactList(
  value: unknown,
  artifact: string,
  rootDir: string,
  outDir: string,
  findings: DemoFixtureArtifactFinding[]
): void {
  const display = displayPath(rootDir, path.join(outDir, artifact));
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    findings.push(finding("demo-fixture-artifact-list", display, `${artifact} must expose an artifacts string array.`));
    return;
  }

  const artifacts = value as string[];
  const firstThree = artifacts.slice(0, PRIMARY_ARTIFACTS.length);
  if (!PRIMARY_ARTIFACTS.every((expected, index) => firstThree[index] === expected)) {
    findings.push(
      finding(
        "demo-fixture-artifact-order",
        display,
        "Demo fixture artifacts must start with share-summary.md, scorecard.md, then recommendations.md."
      )
    );
  }

  for (const required of REQUIRED_ARTIFACTS) {
    if (!artifacts.includes(required)) {
      findings.push(finding("demo-fixture-artifact-list", display, `${artifact} must list ${required}.`));
    }
  }

  if (artifacts.some((item) => /^raw\//i.test(item) || item.includes("raw/<") || item.includes("/raw/"))) {
    findings.push(finding("demo-fixture-raw-artifact", display, "Fixture demo artifact lists must not expose raw provider payload paths."));
  }
}

function checkTextOrder(
  text: string,
  artifact: string,
  rootDir: string,
  outDir: string,
  findings: DemoFixtureArtifactFinding[]
): void {
  let cursor = 0;
  for (const item of PRIMARY_ARTIFACTS) {
    const position = text.indexOf(item, cursor);
    if (position === -1) {
      findings.push(
        finding(
          "demo-fixture-artifact-order",
          displayPath(rootDir, path.join(outDir, artifact)),
          `${artifact} must preserve the review order: share-summary.md, scorecard.md, recommendations.md.`
        )
      );
      return;
    }
    cursor = position + item.length;
  }
}

function checkTextSnippets(
  text: string,
  artifact: string,
  snippets: readonly string[],
  rootDir: string,
  outDir: string,
  findings: DemoFixtureArtifactFinding[]
): void {
  const normalizedText = text.toLowerCase();
  for (const snippet of snippets) {
    if (!normalizedText.includes(snippet.toLowerCase())) {
    findings.push(
      finding(
        "demo-fixture-share-boundary",
        displayPath(rootDir, path.join(outDir, artifact)),
        `${artifact} must keep the share/reuse boundary snippet: ${snippet}`
      )
    );
    }
  }
}

function resolveOutDir(rootDir: string, outDir: string): string {
  return path.isAbsolute(outDir) ? path.resolve(outDir) : path.resolve(rootDir, outDir);
}

function displayPath(rootDir: string, filePath: string): string {
  const relative = path.relative(rootDir, filePath);
  if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) {
    return relative.split(path.sep).join("/");
  }
  return filePath;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finding(ruleId: string, filePath: string, message: string): DemoFixtureArtifactFinding {
  return { ruleId, path: filePath, message };
}

function parseArgs(argv: string[]): DemoFixtureArtifactCheckOptions {
  const options: DemoFixtureArtifactCheckOptions = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--out") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--out requires a value");
      }
      options.outDir = value;
      index += 1;
      continue;
    }
    if (arg === "--root") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--root requires a value");
      }
      options.rootDir = value;
      index += 1;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      console.log("Usage: node --experimental-strip-types scripts/distribution/demo-fixture-artifact-check.ts [--out runs/static-good]");
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

async function main(): Promise<void> {
  const findings = await runDemoFixtureArtifactCheck(parseArgs(process.argv.slice(2)));
  if (findings.length === 0) {
    console.log("Demo fixture artifact check passed. Open share-summary.md, then scorecard.md, then recommendations.md.");
    return;
  }

  console.error(`Demo fixture artifact check failed with ${findings.length} finding(s).`);
  for (const item of findings) {
    console.error(`- ${item.ruleId} (${item.path}): ${item.message}`);
  }
  process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
