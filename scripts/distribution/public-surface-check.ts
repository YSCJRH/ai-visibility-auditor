import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

type Finding = {
  ruleId: string;
  path: string;
  message: string;
};

type PublicSurfaceCheckOptions = {
  rootDir?: string;
};

type PackageJson = {
  version?: unknown;
};

type ReleaseSnapshotEntry = {
  tag_name?: unknown;
  body?: unknown;
};

const EXPECTED_ACTION_MAJORS = new Map([
  ["actions/checkout", "v5"],
  ["actions/setup-node", "v5"],
  ["actions/github-script", "v8"],
  ["actions/upload-artifact", "v6"]
]);

const TEXT_SURFACES = [
  "README.md",
  "README.zh-CN.md",
  "action.yml",
  "docs",
  "examples/consumer-repo/README.md",
  "examples/consumer-repo/.github/workflows/answerlens.yml",
  ".github/workflows",
  ".agents/plugins/marketplace.json",
  "plugins",
  "scripts/distribution/build-site.ts",
  "scripts/distribution/site-seo.ts",
  "scripts/distribution/releases-snapshot.json"
];

const ARTIFACT_ORDER_SURFACES = [
  "action.yml",
  "docs/shareable-summary.md",
  "docs/github-action.md",
  "docs/zh/github-action.md",
  "examples/consumer-repo/README.md",
  "examples/consumer-repo/.github/workflows/answerlens.yml"
];

const RUNTIME_CONFIGS = [
  ".github/answerlens/runtime.yaml",
  "examples/acme/runtime.yaml",
  "examples/consumer-repo/.github/answerlens/runtime.yaml"
];

const STABLE_RELEASE_SURFACES: Array<{ path: string; snippets: (stableTag: string) => string[] }> = [
  {
    path: ".github/workflows/release-distribution.yml",
    snippets: (stableTag) => [stableTag]
  },
  {
    path: "scripts/distribution/build-site.ts",
    snippets: (stableTag) => [`?? "${stableTag}"`, `YSCJRH/ai-visibility-auditor@${stableTag}`]
  },
  {
    path: "scripts/distribution/seo-check.ts",
    snippets: (stableTag) => [`?? "${stableTag}"`]
  },
  {
    path: "scripts/distribution/site-seo.ts",
    snippets: (stableTag) => [`"${stableTag}"`]
  },
  {
    path: "docs/github-action.md",
    snippets: (stableTag) => [`YSCJRH/ai-visibility-auditor@${stableTag}`, `currently \`${stableTag}\``]
  },
  {
    path: "docs/zh/github-action.md",
    snippets: (stableTag) => [`YSCJRH/ai-visibility-auditor@${stableTag}`]
  },
  {
    path: "docs/starter-bundle.md",
    snippets: (stableTag) => [`YSCJRH/ai-visibility-auditor@${stableTag}`]
  },
  {
    path: "docs/manual-steps.md",
    snippets: (stableTag) => [`YSCJRH/ai-visibility-auditor@${stableTag}`]
  },
  {
    path: "docs/zh/manual-steps.md",
    snippets: (stableTag) => [`YSCJRH/ai-visibility-auditor@${stableTag}`]
  },
  {
    path: "examples/consumer-repo/README.md",
    snippets: (stableTag) => [`YSCJRH/ai-visibility-auditor@${stableTag}`]
  },
  {
    path: "examples/consumer-repo/.github/workflows/answerlens.yml",
    snippets: (stableTag) => [`YSCJRH/ai-visibility-auditor@${stableTag}`]
  }
];

export async function runPublicSurfaceCheck(options: PublicSurfaceCheckOptions = {}): Promise<Finding[]> {
  const rootDir = path.resolve(options.rootDir ?? process.cwd());
  const findings: Finding[] = [];
  const textFiles = await collectTextSurfaceFiles(rootDir);

  for (const file of textFiles) {
    const text = await readFile(path.join(rootDir, file), "utf8");
    checkPublicClaims(file, text, findings);
    checkActionMajors(file, text, findings);
    checkRawPayloadUpload(file, text, findings);
  }

  await checkRuntimeConfigs(rootDir, findings);
  await checkArtifactReviewOrder(rootDir, findings);
  await checkAuditEvalKeyBoundary(rootDir, findings);
  await checkReleasePagesRefresh(rootDir, findings);
  await checkStableReleaseVersionSync(rootDir, findings);

  return findings;
}

async function collectTextSurfaceFiles(rootDir: string): Promise<string[]> {
  const files = new Set<string>();
  for (const surface of TEXT_SURFACES) {
    const absolute = path.join(rootDir, surface);
    let entry;
    try {
      entry = await stat(absolute);
    } catch {
      continue;
    }

    if (entry.isDirectory()) {
      for (const file of await listFiles(absolute)) {
        if (/\.(md|ts|json|ya?ml)$/i.test(file)) {
          files.add(path.relative(rootDir, file).split(path.sep).join("/"));
        }
      }
      continue;
    }

    files.add(surface.split(path.sep).join("/"));
  }
  return [...files].sort();
}

async function listFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(root, entry.name);
      if (entry.isDirectory()) {
        return listFiles(full);
      }
      return entry.isFile() ? [full] : [];
    })
  );
  return files.flat();
}

function checkPublicClaims(file: string, text: string, findings: Finding[]): void {
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    const normalized = line.trim();
    if (!normalized) {
      return;
    }

    const context = lines.slice(Math.max(0, index - 5), index + 1).join(" ");
    if (isNegativeBoundary(normalized) || isNegativeBoundary(context)) {
      return;
    }

    if (/(guarantee|promise|ensure|assure).{0,80}(rank|ranking|placement|traffic|visibility)|(#1(?!\d)|number one).{0,40}(rank|ranking)|\b\d{1,3}%\b.{0,60}(lift|increase|improvement|traffic|ranking|visibility)|排名.{0,20}(保证|承诺|提升)|提升.{0,20}\d{1,3}%/i.test(normalized)) {
      findings.push(finding("public-overclaim-ranking", file, index, "Public copy must not promise rankings, placement, traffic, visibility lift, or percentage improvements."));
    }

    if (/(consumer AI UI scraping|consumer UI scraping|scrape consumer AI|抓取消费级 AI|抓取消费级 UI)/i.test(normalized)) {
      findings.push(finding("public-consumer-ui-scraping", file, index, "Consumer AI UI scraping may only appear as a non-goal, not as a supported capability."));
    }

    if (/\b(aggregateRating|reviewRating|ratingValue|downloadCount)\b|\b(testimonial|customer logo|customer proof|download count|star count)\b|客户案例|客户背书|下载量|星标数/i.test(normalized)) {
      findings.push(finding("public-fake-proof", file, index, "Do not add rating, review, download, testimonial, customer-proof, or star-count claims without verified visible proof."));
    }

    if (
      /(npm\s+(install|i)\s+@answerlens\/cli|pnpm\s+add\s+@answerlens\/cli|yarn\s+add\s+@answerlens\/cli|@answerlens\/cli.{0,80}\b(cli\s+)?installs?\b|\b(cli\s+)?installs?\b.{0,80}@answerlens\/cli)/i.test(
        normalized
      )
    ) {
      findings.push(finding("public-npm-install-claim", file, index, "Do not promote @answerlens/cli as an npm install path until the public registry package is visible."));
    }

    if (/yscjrh\.github\.io\/robots\.txt/i.test(normalized) || (/robots\.txt/i.test(normalized) && /(host-level|host-wide|whole host|controls the host|控制整个|控制 host)/i.test(normalized))) {
      findings.push(finding("public-robots-host-claim", file, index, "Project-site robots.txt must not be described as host-level robots control."));
    }
  });
}

function checkRawPayloadUpload(file: string, text: string, findings: Finding[]): void {
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (!/(upload-artifact|actions\/upload-artifact)/i.test(line)) {
      return;
    }

    const block = lines.slice(index, Math.min(lines.length, index + 18)).join("\n");
    const mentionsFullRunUpload = /(steps\.answerlens\.outputs\.out-dir|runs\/answerlens|\bout-dir\b)/i.test(block);
    const excludesRawPayloads = /!\s*.+\/raw\/\*\*|raw\/\*\*.+(excluded|private|restricted)|exclude.{0,80}raw/i.test(block);
    if (mentionsFullRunUpload && !excludesRawPayloads) {
      findings.push({
        ruleId: "raw-payload-upload-exposure",
        path: `${file}:${index + 1}`,
        message: "Default public artifact uploads must exclude raw/** because eval and manual-import runs may contain raw provider payloads."
      });
    }
  });
}

function checkActionMajors(file: string, text: string, findings: Finding[]): void {
  for (const match of text.matchAll(/\b(actions\/[a-z-]+)@(v\d+)\b/g)) {
    const expected = EXPECTED_ACTION_MAJORS.get(match[1]);
    if (expected && match[2] !== expected) {
      findings.push({
        ruleId: "workflow-action-major",
        path: file,
        message: `${match[1]} should use ${expected}, found ${match[2]}.`
      });
    }
  }
}

async function checkRuntimeConfigs(rootDir: string, findings: Finding[]): Promise<void> {
  for (const relativePath of RUNTIME_CONFIGS) {
    const absolute = path.join(rootDir, relativePath);
    const raw = await readFile(absolute, "utf8");
    const parsed = YAML.parse(raw) as unknown;
    for (const item of flattenConfig(parsed)) {
      const key = item.path.join(".");
      if (/(api[_-]?key|token|secret|password|credential)/i.test(key)) {
        findings.push({
          ruleId: "runtime-secret-key",
          path: relativePath,
          message: `runtime.yaml must not contain secret-like key ${key}.`
        });
      }
      if (typeof item.value === "string" && /(sk-[A-Za-z0-9_-]{12,}|pplx-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9_]{12,})/.test(item.value)) {
        findings.push({
          ruleId: "runtime-secret-value",
          path: relativePath,
          message: `runtime.yaml contains a value that looks like a provider or GitHub secret at ${key}.`
        });
      }
    }
  }
}

function flattenConfig(value: unknown, prefix: string[] = []): Array<{ path: string[]; value: unknown }> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [{ path: prefix, value }];
  }

  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => flattenConfig(child, [...prefix, key]));
}

async function checkArtifactReviewOrder(rootDir: string, findings: Finding[]): Promise<void> {
  for (const relativePath of ARTIFACT_ORDER_SURFACES) {
    const text = await readFile(path.join(rootDir, relativePath), "utf8");
    const share = text.indexOf("share-summary");
    const scorecard = text.indexOf("scorecard");
    const recommendations = text.indexOf("recommendations");
    if (share === -1 || scorecard === -1 || recommendations === -1 || !(share < scorecard && scorecard < recommendations)) {
      findings.push({
        ruleId: "artifact-review-order",
        path: relativePath,
        message: "Public adoption surfaces must review artifacts in order: share-summary.md, scorecard.md, recommendations.md."
      });
    }
  }
}

async function checkAuditEvalKeyBoundary(rootDir: string, findings: Finding[]): Promise<void> {
  const required = [
    {
      path: "docs/quickstart.md",
      snippets: ["Basic `audit` does not require provider API keys", "You only need provider API keys when you choose to run `eval`"]
    },
    {
      path: "docs/zh/quickstart.md",
      snippets: ["基础 `audit` 不需要 provider API key", "只有在你要跑 `eval` 时才需要 provider API key"]
    }
  ];

  for (const item of required) {
    const text = await readFile(path.join(rootDir, item.path), "utf8");
    for (const snippet of item.snippets) {
      if (!text.includes(snippet)) {
        findings.push({
          ruleId: "audit-eval-key-boundary",
          path: item.path,
          message: `Missing first-run key boundary text: ${snippet}`
        });
      }
    }
  }
}

async function checkReleasePagesRefresh(rootDir: string, findings: Finding[]): Promise<void> {
  const relativePath = ".github/workflows/release-distribution.yml";
  let text: string;
  try {
    text = await readFile(path.join(rootDir, relativePath), "utf8");
  } catch {
    return;
  }

  if (!/\bactions:\s*write\b/.test(text)) {
    findings.push({
      ruleId: "release-pages-refresh-permission",
      path: relativePath,
      message: "Release Distribution needs actions: write so semver releases can dispatch the Pages workflow after publishing."
    });
  }

  if (!/gh\s+workflow\s+run\s+pages\.yml\s+--ref\s+main\b/.test(text)) {
    findings.push({
      ruleId: "release-pages-refresh-dispatch",
      path: relativePath,
      message: "Release Distribution must dispatch pages.yml on main after semver releases so live Pages reads the new release metadata."
    });
  }
}

async function checkStableReleaseVersionSync(rootDir: string, findings: Finding[]): Promise<void> {
  const rootPackagePath = "package.json";
  const cliPackagePath = "apps/cli/package.json";
  const rootPackage = await readRequiredJson<PackageJson>(rootDir, rootPackagePath, findings, "stable-version-package-readable");
  const cliPackage = await readRequiredJson<PackageJson>(rootDir, cliPackagePath, findings, "stable-version-package-readable");
  if (!rootPackage || !cliPackage) {
    return;
  }

  if (typeof rootPackage.version !== "string" || typeof cliPackage.version !== "string") {
    findings.push({
      ruleId: "stable-version-package-readable",
      path: `${rootPackagePath}, ${cliPackagePath}`,
      message: "Root and CLI package versions must both be string values so public release surfaces can be checked."
    });
    return;
  }

  if (rootPackage.version !== cliPackage.version) {
    findings.push({
      ruleId: "stable-version-package-drift",
      path: `${rootPackagePath}, ${cliPackagePath}`,
      message: `Root package version ${rootPackage.version} must match CLI package version ${cliPackage.version}.`
    });
  }

  const stableTag = `v${cliPackage.version}`;
  const releasesPath = "scripts/distribution/releases-snapshot.json";
  const releases = await readRequiredJson<ReleaseSnapshotEntry[]>(rootDir, releasesPath, findings, "stable-version-release-snapshot");
  if (!Array.isArray(releases)) {
    findings.push({
      ruleId: "stable-version-release-snapshot",
      path: releasesPath,
      message: "Release snapshot must be an array ordered with the latest stable release first."
    });
  } else {
    const latest = releases[0];
    if (latest?.tag_name !== stableTag) {
      findings.push({
        ruleId: "stable-version-release-snapshot",
        path: releasesPath,
        message: `Latest release snapshot must be ${stableTag}, found ${String(latest?.tag_name ?? "(missing)")}.`
      });
    }
    if (typeof latest?.body === "string" && !latest.body.includes(stableTag)) {
      findings.push({
        ruleId: "stable-version-release-snapshot",
        path: releasesPath,
        message: `Latest release notes should mention the current stable tag ${stableTag}.`
      });
    }
  }

  for (const surface of STABLE_RELEASE_SURFACES) {
    let text: string;
    try {
      text = await readFile(path.join(rootDir, surface.path), "utf8");
    } catch {
      findings.push({
        ruleId: "stable-version-surface-pin",
        path: surface.path,
        message: `Missing public stable-version surface that should reference ${stableTag}.`
      });
      continue;
    }

    for (const snippet of surface.snippets(stableTag)) {
      if (!text.includes(snippet)) {
        findings.push({
          ruleId: "stable-version-surface-pin",
          path: surface.path,
          message: `Expected current stable release snippet ${JSON.stringify(snippet)}.`
        });
      }
    }
  }
}

async function readRequiredJson<T>(rootDir: string, relativePath: string, findings: Finding[], ruleId: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path.join(rootDir, relativePath), "utf8")) as T;
  } catch (error) {
    findings.push({
      ruleId,
      path: relativePath,
      message: `Unable to read JSON needed for public release truth-sync: ${error instanceof Error ? error.message : String(error)}`
    });
    return null;
  }
}

function isNegativeBoundary(line: string): boolean {
  return /\?$|\bdoes\b.{0,80}\bscrape\b|\b(block or rewrite|what to block|claims or implies|must not imply)\b|\b(no|not|does not|do not|without|avoid|avoids|avoiding|block|reject|forbid|non-goal|non-goals|is not|must not|should not|cannot|can't|rather than|instead of|vs|versus|hard requirement|out of scope|should not change)\b|不承诺|不会|不要|不能|禁止|不是|避免|非目标|无消费级|不抓取/i.test(line);
}

function finding(ruleId: string, file: string, zeroBasedLine: number, message: string): Finding {
  return {
    ruleId,
    path: `${file}:${zeroBasedLine + 1}`,
    message
  };
}

async function main(): Promise<void> {
  const findings = await runPublicSurfaceCheck();
  if (findings.length === 0) {
    console.log("Public surface check passed.");
    return;
  }

  console.error(`Public surface check failed with ${findings.length} finding(s).`);
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
