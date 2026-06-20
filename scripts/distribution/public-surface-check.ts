import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

export type Finding = {
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

const SHOW_AND_TELL_DISCUSSION_URL = "https://github.com/YSCJRH/ai-visibility-auditor/discussions/new?category=show-and-tell";

const EXPECTED_ACTION_MAJORS = new Map([
  ["actions/checkout", "v5"],
  ["actions/setup-node", "v5"],
  ["actions/github-script", "v8"],
  ["actions/upload-artifact", "v6"]
]);

const TEXT_SURFACES = [
  "README.md",
  "README.zh-CN.md",
  "CONTRIBUTING.md",
  "action.yml",
  "apps/cli/README.md",
  "docs",
  "examples/consumer-repo/README.md",
  "examples/consumer-repo/.github/workflows/answerlens.yml",
  ".github/DISCUSSION_TEMPLATE",
  ".github/ISSUE_TEMPLATE",
  ".github/pull_request_template.md",
  ".github/workflows",
  ".agents/plugins/marketplace.json",
  "plugins",
  "scripts/distribution/build-site.ts",
  "scripts/distribution/site-seo.ts",
  "scripts/distribution/releases-snapshot.json"
];

const PUBLIC_NPM_INSTALL_CLAIM_PATTERN =
  /(npm\s+(install|i|exec|x)\s+@answerlens\/cli|npx\s+@answerlens\/cli|pnpm\s+(add|dlx|exec)\s+@answerlens\/cli|yarn\s+(add|dlx)\s+@answerlens\/cli|bunx\s+@answerlens\/cli|@answerlens\/cli.{0,80}\b(cli\s+)?installs?\b|\b(cli\s+)?installs?\b.{0,80}@answerlens\/cli)/i;

const ARTIFACT_ORDER_SURFACES = [
  "README.md",
  "README.zh-CN.md",
  ".github/pull_request_template.md",
  ".github/DISCUSSION_TEMPLATE/show-and-tell.yml",
  ".github/ISSUE_TEMPLATE/audit-teardown.yml",
  "action.yml",
  "docs/demo-report.md",
  "docs/zh/demo-report.md",
  "docs/quickstart.md",
  "docs/zh/quickstart.md",
  "docs/first-run-story.md",
  "docs/starter-bundle.md",
  "docs/trust-and-safety.md",
  "docs/shareable-summary.md",
  "docs/github-action.md",
  "docs/zh/github-action.md",
  "examples/consumer-repo/README.md",
  "examples/consumer-repo/.github/workflows/answerlens.yml"
];

const MARKDOWN_LINK_SURFACES = [
  "README.md",
  "README.zh-CN.md",
  "docs/demo-report.md",
  "docs/zh/demo-report.md",
  "docs/quickstart.md",
  "docs/zh/quickstart.md",
  "docs/github-action.md",
  "docs/zh/github-action.md",
  "docs/starter-bundle.md",
  "docs/manual-steps.md",
  "docs/zh/manual-steps.md",
  "examples/consumer-repo/README.md"
];

const RUNTIME_CONFIGS = [
  ".github/answerlens/runtime.yaml",
  "examples/acme/runtime.yaml",
  "examples/consumer-repo/.github/answerlens/runtime.yaml"
];

const SHARE_LAYER_PROPAGATION_SURFACES = [
  {
    path: "docs/shareable-summary.md",
    snippets: [
      "first-run story template",
      "Show and tell Discussion form",
      "raw provider payloads",
      "private analytics",
      "docs/starter-bundle.md",
      "share-summary.md",
      "scorecard.md",
      "recommendations.md"
    ]
  },
  {
    path: "packages/report/src/index.ts",
    snippets: [
      "FIRST_RUN_STORY_URL",
      "SHOW_AND_TELL_DISCUSSION_URL",
      "report.next.firstRun",
      "brand.publicShareBoundary",
      "reviewPacket",
      "Review and share this run",
      "First-run story template",
      "Show and tell Discussion form"
    ]
  },
  {
    path: "packages/i18n/src/index.ts",
    snippets: [
      "Keep API keys, private analytics, and raw provider payloads",
      "first-run story template",
      "Show and tell Discussion form",
      "raw provider payloads"
    ]
  },
  {
    path: "packages/report/src/index.test.ts",
    snippets: [
      "Review and share this run",
      "first-run-story",
      "discussions\\/new\\?category=show-and-tell",
      "raw provider payloads",
      "private analytics"
    ]
  }
];

const VISUAL_SHARE_PACKET_SURFACES = [
  {
    path: "assets/readme-cover.svg",
    snippets: ["Review packet", "share-summary.md", "scorecard.md", "recommendations.md"]
  },
  {
    path: "assets/readme-artifacts-preview.svg",
    snippets: ["share-summary.md", "scorecard.md", "recommendations.md", "pr-snippet.md", "Show and tell", "raw/** stays private"]
  },
  {
    path: "assets/social-preview.svg",
    snippets: ["Review packet", "share-summary.md", "scorecard.md", "recommendations.md", "pr-snippet.md", "first-run story"]
  }
];

const REVIEW_PACKET_OUTPUT_CONTRACT_SURFACES = [
  {
    path: "README.md",
    snippets: ["- `share-summary.md`\n- `scorecard.md`\n- `recommendations.md`\n- `pr-snippet.md`"]
  },
  {
    path: "docs/concepts/ci-for-ai-discoverability.md",
    snippets: ["- `share-summary.md` for job summaries\n- `scorecard.md` for readiness\n- `recommendations.md` for backlog items\n- `pr-snippet.md` for PR review"]
  },
  {
    path: "docs/search-console.md",
    snippets: ["including `share-summary.*`, `scorecard.md`, `recommendations.md`"]
  }
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
    snippets: (stableTag) => [`FALLBACK_LATEST_RELEASE = "${stableTag}"`]
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
    path: "docs/release-bump-playbook.md",
    snippets: () => ["stable-version-*", "fix the drift instead of weakening the rule"]
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
    checkLocalAbsolutePaths(file, text, findings);
  }

  await checkRuntimeConfigs(rootDir, findings);
  await checkMarkdownLinkTargets(rootDir, findings);
  await checkArtifactReviewOrder(rootDir, findings);
  await checkAuditEvalKeyBoundary(rootDir, findings);
  await checkFirstRunStoryBoundary(rootDir, findings);
  await checkFirstRunDiscussionRouting(rootDir, findings);
  await checkShareLayerPropagationBoundary(rootDir, findings);
  await checkVisualSharePacketBoundary(rootDir, findings);
  await checkReviewPacketOutputContracts(rootDir, findings);
  await checkStarterAdopterKitBoundary(rootDir, findings);
  await checkReleasePagesRefresh(rootDir, findings);
  await checkPagesPostdeploySmoke(rootDir, findings);
  await checkReleaseSnapshotFreshnessGate(rootDir, findings);
  await checkReleaseAssetChecklistBoundary(rootDir, findings);
  await checkReleaseAssetManifestGate(rootDir, findings);
  await checkStableReleaseVersionSync(rootDir, findings);
  await checkSelfDogfoodLogBoundary(rootDir, findings);

  return findings;
}

export function findPublicClaimFindings(file: string, text: string): Finding[] {
  const findings: Finding[] = [];
  checkPublicClaims(file, text, findings);
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

    if (isPublicNpmInstallClaimLine(lines, index)) {
      findings.push(finding("public-npm-install-claim", file, index, "Do not promote @answerlens/cli as an npm install, npx, or package-runner path until the public registry package is visible."));
    }

    if (/yscjrh\.github\.io\/robots\.txt/i.test(normalized) || (/robots\.txt/i.test(normalized) && /(host-level|host-wide|whole host|controls the host|控制整个|控制 host)/i.test(normalized))) {
      findings.push(finding("public-robots-host-claim", file, index, "Project-site robots.txt must not be described as host-level robots control."));
    }
  });
}

function isPublicNpmInstallClaimLine(lines: string[], index: number): boolean {
  const normalized = lines[index]?.trim() ?? "";
  if (!normalized) {
    return false;
  }
  const context = lines.slice(Math.max(0, index - 5), index + 1).join(" ");
  if (isNegativeBoundary(normalized) || isNegativeBoundary(context)) {
    return false;
  }
  return PUBLIC_NPM_INSTALL_CLAIM_PATTERN.test(normalized);
}

function checkRawPayloadUpload(file: string, text: string, findings: Finding[]): void {
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (!/(upload-artifact|actions\/upload-artifact)/i.test(line)) {
      return;
    }

    const block = lines.slice(index, Math.min(lines.length, index + 18)).join("\n");
    const mentionsFullRunUpload = /(steps\.answerlens\.outputs\.out-dir|\bruns\/[A-Za-z0-9_.-]+|\bout-dir\b)/i.test(block);
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

function checkLocalAbsolutePaths(file: string, text: string, findings: Finding[]): void {
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (/(?:^|[\s('"=<])(?:file:\/\/\/|\/?[A-Za-z]:[\\/])/.test(line)) {
      findings.push(
        finding(
          "public-local-absolute-path",
          file,
          index,
          "Public docs and GitHub templates must use repository-relative links, not local filesystem paths."
        )
      );
    }
  });
}

async function checkMarkdownLinkTargets(rootDir: string, findings: Finding[]): Promise<void> {
  const markdownAnchorCache = new Map<string, Set<string>>();

  for (const relativePath of MARKDOWN_LINK_SURFACES) {
    const absolutePath = path.join(rootDir, relativePath);
    let text: string;
    try {
      text = await readFile(absolutePath, "utf8");
    } catch (error) {
      findings.push({
        ruleId: "public-markdown-link-target",
        path: relativePath,
        message: `Unable to read adoption Markdown link surface: ${error instanceof Error ? error.message : String(error)}`
      });
      continue;
    }

    const lines = text.split(/\r?\n/);
    for (const [index, line] of lines.entries()) {
      for (const match of line.matchAll(/!?\[[^\]\n]*\]\((<[^>\n]+>|[^)\s]+)(?:\s+["'][^"']*["'])?\)/g)) {
        const href = match[1].trim().replace(/^<|>$/g, "");
        if (!href || /^[a-z][a-z0-9+.-]*:/i.test(href)) {
          continue;
        }

        const [hrefWithoutHash, rawHash] = href.split("#", 2);
        const targetHref = hrefWithoutHash.split("?", 1)[0];
        const anchorHref = rawHash?.split("?", 1)[0] ?? "";
        if (!targetHref && !anchorHref) {
          continue;
        }

        let decodedHref = targetHref;
        let decodedAnchor = anchorHref;
        try {
          decodedHref = targetHref ? decodeURIComponent(targetHref) : "";
          decodedAnchor = anchorHref ? decodeURIComponent(anchorHref).toLowerCase() : "";
        } catch {
          findings.push(finding("public-markdown-link-target", relativePath, index, `Unable to decode local Markdown link ${href}.`));
          continue;
        }

        const targetPath = decodedHref ? path.resolve(path.dirname(absolutePath), decodedHref) : absolutePath;
        const relativeTarget = path.relative(rootDir, targetPath);
        if (relativeTarget.startsWith("..") || path.isAbsolute(relativeTarget)) {
          findings.push(finding("public-markdown-link-target", relativePath, index, `Local Markdown link ${href} points outside the repository.`));
          continue;
        }
        if (relativeTarget === "runs" || relativeTarget.startsWith(`runs${path.sep}`)) {
          // runs/** is generated by fixture and real-site audits, so clean CI checkouts should not require it to exist.
          continue;
        }

        try {
          await stat(targetPath);
        } catch {
          findings.push(
            finding(
              "public-markdown-link-target",
              relativePath,
              index,
              `Local Markdown link ${href} must point to an existing repository file or directory.`
            )
          );
          continue;
        }

        if (decodedAnchor && /\.md$/i.test(targetPath)) {
          let anchors = markdownAnchorCache.get(targetPath);
          if (!anchors) {
            anchors = markdownHeadingAnchors(await readFile(targetPath, "utf8"));
            markdownAnchorCache.set(targetPath, anchors);
          }
          if (!anchors.has(decodedAnchor)) {
            findings.push(
              finding(
                "public-markdown-link-target",
                relativePath,
                index,
                `Local Markdown link ${href} must point to an existing heading anchor in ${path.relative(rootDir, targetPath).split(path.sep).join("/")}.`
              )
            );
          }
        }
      }
    }
  }
}

function markdownHeadingAnchors(text: string): Set<string> {
  const anchors = new Set<string>();
  const counts = new Map<string, number>();
  for (const line of text.split(/\r?\n/)) {
    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!match) {
      continue;
    }

    const base = githubMarkdownAnchor(match[2]);
    if (!base) {
      continue;
    }

    const count = counts.get(base) ?? 0;
    counts.set(base, count + 1);
    anchors.add(count === 0 ? base : `${base}-${count}`);
  }
  return anchors;
}

function githubMarkdownAnchor(heading: string): string {
  return heading
    .trim()
    .replace(/<[^>]*>/g, "")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/&amp;/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-");
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
    const share = firstIndexOfAny(text, ["share-summary.md", "share-summary-path"]);
    const scorecard = firstIndexOfAny(text, ["scorecard.md", "scorecard-path"]);
    const recommendations = firstIndexOfAny(text, ["recommendations.md", "recommendations-path"]);
    if (share === -1 || scorecard === -1 || recommendations === -1 || !(share < scorecard && scorecard < recommendations)) {
      findings.push({
        ruleId: "artifact-review-order",
        path: relativePath,
        message: "Public adoption surfaces must review artifacts in order: share-summary.md, scorecard.md, recommendations.md."
      });
    }
  }
}

function firstIndexOfAny(text: string, needles: string[]): number {
  const matches = needles.map((needle) => text.indexOf(needle)).filter((index) => index >= 0);
  return matches.length === 0 ? -1 : Math.min(...matches);
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

async function checkFirstRunStoryBoundary(rootDir: string, findings: Finding[]): Promise<void> {
  const requiredSurfaces = [
    {
      path: "docs/first-run-story.md",
      snippets: [
        "Permission to quote or reuse publicly",
        "yes, with these safe links or screenshots only",
        "no, keep this as feedback only",
        "no external adoption proof unless I explicitly authorize reuse",
        "no private analytics or raw provider payloads",
        "Do not present a first-run story as external adoption proof unless the user explicitly authorized public reuse",
        "Release asset evidence, if relevant",
        "GitHub release tag URL",
        "`answerlens-demo-audit.tar.gz`",
        "`answerlens-site.tar.gz`",
        "`release-assets-manifest.json`, if present on that release",
        "`release-assets-summary.md`, if present on that release",
        "I opened `share-summary.md`, then `scorecard.md`, then `recommendations.md` from the unpacked demo audit bundle",
        "I am not treating release assets as npm activation proof while `npm view @answerlens/cli` returns `404`"
      ]
    },
    {
      path: ".github/ISSUE_TEMPLATE/audit-teardown.yml",
      snippets: [
        "If the run used release assets, include the release tag, asset names, and `release-assets-summary.md` when present",
        "do not use release asset downloads as npm activation proof",
        "answerlens-demo-audit.tar.gz",
        "answerlens-site.tar.gz",
        "release-assets-manifest.json if present",
        "release-assets-summary.md if present"
      ]
    },
    {
      path: ".github/DISCUSSION_TEMPLATE/show-and-tell.yml",
      snippets: [
        "Share a first AnswerLens run that is safe for public discussion",
        "Start with `share-summary.md`, then `scorecard.md`, then `recommendations.md`",
        "Do not paste API keys, private analytics, raw provider payloads",
        "Release asset evidence, if relevant",
        "GitHub release tag URL",
        "`answerlens-demo-audit.tar.gz`",
        "`answerlens-site.tar.gz`",
        "`release-assets-manifest.json`, if present on that release",
        "`release-assets-summary.md`, if present on that release",
        "I opened `share-summary.md`, then `scorecard.md`, then `recommendations.md` from the unpacked demo audit bundle",
        "I am not treating release assets as npm activation proof while `npm view @answerlens/cli` returns `404`",
        "This post does not claim ranking lift, traffic lift, answer-surface placement, or external adoption proof",
        "Basic `audit` needs no provider key; optional `eval` is BYOK and uses my own provider account",
        "AnswerLens audits public source material; it does not scrape consumer AI UIs or guarantee rankings",
        "A first-run story is not external adoption proof unless you explicitly authorize public reuse",
        "yes, with these safe links or screenshots only",
        "no, keep this as feedback only"
      ]
    }
  ];

  for (const surface of requiredSurfaces) {
    let text: string;
    try {
      text = await readFile(path.join(rootDir, surface.path), "utf8");
    } catch (error) {
      findings.push({
        ruleId: "first-run-story-boundary",
        path: surface.path,
        message: `Unable to read first-run sharing surface needed for adoption-proof guardrails: ${error instanceof Error ? error.message : String(error)}`
      });
      continue;
    }

    for (const snippet of surface.snippets) {
      if (!text.includes(snippet)) {
        findings.push({
          ruleId: "first-run-story-boundary",
          path: surface.path,
          message: `Missing first-run story authorization or safety boundary text: ${snippet}`
        });
      }
    }
  }
}

async function checkFirstRunDiscussionRouting(rootDir: string, findings: Finding[]): Promise<void> {
  const requiredSurfaces = [
    "README.md",
    "README.zh-CN.md",
    "docs/demo-report.md",
    "docs/zh/demo-report.md",
    "docs/quickstart.md",
    "docs/zh/quickstart.md",
    "docs/first-run-story.md",
    ".github/ISSUE_TEMPLATE/config.yml",
    ".github/workflows/release-distribution.yml",
    "scripts/distribution/releases-snapshot.json",
    "scripts/distribution/build-site.ts"
  ];

  for (const relativePath of requiredSurfaces) {
    let text: string;
    try {
      text = await readFile(path.join(rootDir, relativePath), "utf8");
    } catch (error) {
      findings.push({
        ruleId: "first-run-discussion-routing",
        path: relativePath,
        message: `Unable to read first-run Discussion routing surface: ${error instanceof Error ? error.message : String(error)}`
      });
      continue;
    }

    if (!text.includes(SHOW_AND_TELL_DISCUSSION_URL)) {
      findings.push({
        ruleId: "first-run-discussion-routing",
        path: relativePath,
        message: `First-run sharing should link directly to the Show and tell Discussion form: ${SHOW_AND_TELL_DISCUSSION_URL}`
      });
    }
  }
}

async function checkShareLayerPropagationBoundary(rootDir: string, findings: Finding[]): Promise<void> {
  for (const surface of SHARE_LAYER_PROPAGATION_SURFACES) {
    let text: string;
    try {
      text = await readFile(path.join(rootDir, surface.path), "utf8");
    } catch (error) {
      findings.push({
        ruleId: "share-layer-propagation-boundary",
        path: surface.path,
        message: `Unable to read share-layer propagation surface: ${error instanceof Error ? error.message : String(error)}`
      });
      continue;
    }

    for (const snippet of surface.snippets) {
      if (!text.includes(snippet)) {
        findings.push({
          ruleId: "share-layer-propagation-boundary",
          path: surface.path,
          message: `Generated report sharing surfaces must include the first-run invitation and public sharing boundary: ${snippet}`
        });
      }
    }
  }
}

async function checkVisualSharePacketBoundary(rootDir: string, findings: Finding[]): Promise<void> {
  for (const surface of VISUAL_SHARE_PACKET_SURFACES) {
    let text: string;
    try {
      text = await readFile(path.join(rootDir, surface.path), "utf8");
    } catch (error) {
      findings.push({
        ruleId: "visual-share-packet-boundary",
        path: surface.path,
        message: `Unable to read public visual share-packet surface: ${error instanceof Error ? error.message : String(error)}`
      });
      continue;
    }

    for (const snippet of surface.snippets) {
      if (!text.includes(snippet)) {
        findings.push({
          ruleId: "visual-share-packet-boundary",
          path: surface.path,
          message: `Public visual assets must show the share-summary-first review packet: ${snippet}`
        });
      }
    }

    const share = text.indexOf("share-summary.md");
    const scorecard = text.indexOf("scorecard.md");
    const recommendations = text.indexOf("recommendations.md");
    if (share === -1 || scorecard === -1 || recommendations === -1 || !(share < scorecard && scorecard < recommendations)) {
      findings.push({
        ruleId: "visual-share-packet-boundary",
        path: surface.path,
        message: "Public visual assets must keep the artifact order: share-summary.md, scorecard.md, recommendations.md."
      });
    }
  }
}

async function checkReviewPacketOutputContracts(rootDir: string, findings: Finding[]): Promise<void> {
  for (const surface of REVIEW_PACKET_OUTPUT_CONTRACT_SURFACES) {
    let text: string;
    try {
      text = await readFile(path.join(rootDir, surface.path), "utf8");
    } catch (error) {
      findings.push({
        ruleId: "review-packet-output-contract",
        path: surface.path,
        message: `Unable to read review-packet output contract surface: ${error instanceof Error ? error.message : String(error)}`
      });
      continue;
    }
    const normalizedText = normalizeNewlines(text);

    for (const snippet of surface.snippets) {
      if (!normalizedText.includes(normalizeNewlines(snippet))) {
        findings.push({
          ruleId: "review-packet-output-contract",
          path: surface.path,
          message: `Output contract surfaces must keep the review packet share-summary-first: ${snippet}`
        });
      }
    }
  }
}

function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

async function checkStarterAdopterKitBoundary(rootDir: string, findings: Finding[]): Promise<void> {
  const requiredSurfaces = [
    {
      path: "README.md",
      snippets: [
        "Adopter kit checklist",
        "PR review packet",
        "assets/starter-packet-preview.svg",
        "which artifact to open and which raw payloads stay private"
      ]
    },
    {
      path: "README.zh-CN.md",
      snippets: [
        "Adopter kit checklist",
        "PR review packet",
        "assets/starter-packet-preview.svg",
        "哪些 raw payloads 不能公开"
      ]
    },
    {
      path: "docs/quickstart.md",
      snippets: [
        "Adopter kit checklist",
        "PR review packet",
        "the first CI pull request"
      ]
    },
    {
      path: "docs/zh/quickstart.md",
      snippets: [
        "Adopter kit checklist",
        "PR review packet",
        "第一次 CI 接入 PR"
      ]
    },
    {
      path: "docs/github-action.md",
      snippets: [
        "### Adopter kit",
        "### Safe sharing boundary",
        "### Share this first run",
        "## First CI PR packet",
        "Adopter kit`, `Safe sharing boundary`, and `Share this first run",
        "first-run story template",
        "Show and tell Discussion form",
        "API keys, private analytics, or raw provider payloads",
        "no consumer AI UI scraping and no ranking or answer-placement guarantee"
      ]
    },
    {
      path: "docs/zh/github-action.md",
      snippets: [
        "Adopter kit",
        "Safe sharing boundary",
        "Share this first run",
        "## 第一次 CI 的 PR 审阅包",
        "`share-summary.md`，然后 `scorecard.md`，最后 `recommendations.md`",
        "first-run story template",
        "Show and tell Discussion form",
        "API keys、私有 analytics 或 raw provider payloads",
        "不抓取消费级 AI UI，不承诺排名或答案展示位置"
      ]
    },
    {
      path: "docs/starter-bundle.md",
      snippets: [
        "## Adopter kit checklist",
        "## PR review packet",
        "Copy `.github/answerlens/` and `.github/workflows/answerlens.yml`",
        "../assets/starter-packet-preview.svg",
        "Put provider keys only in GitHub secrets or local environment variables",
        "Review `share-summary.md`, then `scorecard.md`, then `recommendations.md`",
        "Safe next step: if authorized, use the first-run story template and Show and tell Discussion form.",
        "Do not attach `raw/**`",
        "No consumer AI UI scraping. No ranking or answer-placement guarantee."
      ]
    },
    {
      path: "examples/consumer-repo/README.md",
      snippets: [
        "## Adopter kit checklist",
        "## PR review packet",
        "Copy `.github/answerlens/` and `.github/workflows/answerlens.yml`",
        "Put provider keys only in GitHub secrets or local environment variables",
        "Review `share-summary.md`, then `scorecard.md`, then `recommendations.md`",
        "Safe next step: if authorized, use the first-run story template and Show and tell Discussion form.",
        "Do not attach `raw/**`",
        "No consumer AI UI scraping. No ranking or answer-placement guarantee."
      ]
    },
    {
      path: "examples/consumer-repo/.github/workflows/answerlens.yml",
      snippets: [
        "### Adopter kit",
        "copy \\`.github/answerlens/\\` and \\`.github/workflows/answerlens.yml\\`",
        "put provider keys in GitHub secrets or local environment variables",
        "Review \\`share-summary.md\\`, then \\`scorecard.md\\`, then \\`recommendations.md\\`",
        "### Safe sharing boundary",
        "\\`raw/**\\` is excluded from the uploaded artifact",
        "No consumer AI UI scraping. No ranking or answer-placement guarantee.",
        "### Share this first run",
        "first-run story template",
        "Show and tell Discussion form",
        "API keys, private analytics, or raw provider payloads"
      ]
    },
    {
      path: "scripts/distribution/build-site.ts",
      snippets: [
        "PR review packet",
        "starter-packet-preview.svg",
        "Public-safe artifact: answerlens-report",
        "Safe next step: if authorized, use the first-run story template and Show and tell Discussion form.",
        "raw/** is excluded by default",
        "No consumer AI UI scraping. No ranking or answer-placement guarantee."
      ]
    },
    {
      path: "assets/starter-packet-preview.svg",
      snippets: [
        "AnswerLens starter packet preview",
        "Adopter kit",
        "PR review packet",
        "share-summary.md",
        "scorecard.md",
        "recommendations.md",
        "Safe first-run story link",
        "raw/** is excluded by default",
        "No consumer AI UI scraping",
        "No ranking or answer-placement guarantee"
      ]
    }
  ];

  for (const surface of requiredSurfaces) {
    let text: string;
    try {
      text = await readFile(path.join(rootDir, surface.path), "utf8");
    } catch (error) {
      findings.push({
        ruleId: "starter-adopter-kit-boundary",
        path: surface.path,
        message: `Unable to read starter adopter-kit surface: ${error instanceof Error ? error.message : String(error)}`
      });
      continue;
    }

    for (const snippet of surface.snippets) {
      if (!text.includes(snippet)) {
        findings.push({
          ruleId: "starter-adopter-kit-boundary",
          path: surface.path,
          message: `Missing starter adopter-kit boundary text: ${snippet}`
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

async function checkPagesPostdeploySmoke(rootDir: string, findings: Finding[]): Promise<void> {
  const pagesWorkflowPath = ".github/workflows/pages.yml";
  const packageJsonPath = "package.json";

  let workflowText: string;
  try {
    workflowText = await readFile(path.join(rootDir, pagesWorkflowPath), "utf8");
  } catch (error) {
    findings.push({
      ruleId: "pages-postdeploy-smoke-check",
      path: pagesWorkflowPath,
      message: `Unable to read Pages workflow for postdeploy smoke guardrail: ${error instanceof Error ? error.message : String(error)}`
    });
    return;
  }

  for (const snippet of [
    "contents: read",
    "actions/deploy-pages@v5",
    "PAGE_URL: ${{ steps.deployment.outputs.page_url }}",
    "pnpm pages:smoke -- --site-url \"$PAGE_URL\""
  ]) {
    if (!workflowText.includes(snippet)) {
      findings.push({
        ruleId: "pages-postdeploy-smoke-check",
        path: pagesWorkflowPath,
        message: `Pages workflow must run the live postdeploy smoke check with the deployment URL: ${snippet}`
      });
    }
  }

  const packageJson = await readRequiredJson<{ scripts?: Record<string, unknown> }>(
    rootDir,
    packageJsonPath,
    findings,
    "pages-postdeploy-smoke-check"
  );
  if (packageJson?.scripts?.["pages:smoke"] !== "node --experimental-strip-types scripts/distribution/pages-smoke-check.ts") {
    findings.push({
      ruleId: "pages-postdeploy-smoke-check",
      path: packageJsonPath,
      message: "package.json must expose pages:smoke for live Pages postdeploy verification."
    });
  }
}

async function checkReleaseSnapshotFreshnessGate(rootDir: string, findings: Finding[]): Promise<void> {
  const packageJsonPath = "package.json";
  const packageJson = await readRequiredJson<{ scripts?: Record<string, unknown> }>(
    rootDir,
    packageJsonPath,
    findings,
    "release-snapshot-freshness-gate"
  );
  const expectedScript = "node --experimental-strip-types scripts/distribution/release-snapshot-check.ts";
  if (packageJson?.scripts?.["release:snapshot:check"] !== expectedScript) {
    findings.push({
      ruleId: "release-snapshot-freshness-gate",
      path: packageJsonPath,
      message: "package.json must expose release:snapshot:check so release metadata freshness is locally runnable."
    });
  }
  const expectedRefreshScript = "node --experimental-strip-types scripts/distribution/release-snapshot-refresh.ts";
  if (packageJson?.scripts?.["release:snapshot:refresh"] !== expectedRefreshScript) {
    findings.push({
      ruleId: "release-snapshot-freshness-gate",
      path: packageJsonPath,
      message: "package.json must expose release:snapshot:refresh so release metadata can be refreshed from GitHub."
    });
  }

  const testScript = typeof packageJson?.scripts?.test === "string" ? packageJson.scripts.test : "";
  if (!testScript.includes("scripts/distribution/release-snapshot-check.test.ts")) {
    findings.push({
      ruleId: "release-snapshot-freshness-gate",
      path: packageJsonPath,
      message: "package.json test script must include release-snapshot-check.test.ts."
    });
  }
  if (!testScript.includes("scripts/distribution/release-snapshot-refresh.test.ts")) {
    findings.push({
      ruleId: "release-snapshot-freshness-gate",
      path: packageJsonPath,
      message: "package.json test script must include release-snapshot-refresh.test.ts."
    });
  }

  const ciPath = ".github/workflows/ci.yml";
  const checkScriptPath = "scripts/distribution/release-snapshot-check.ts";
  const refreshScriptPath = "scripts/distribution/release-snapshot-refresh.ts";
  const playbookPath = "docs/release-bump-playbook.md";
  const requiredSurfaces = [
    {
      path: ciPath,
      snippets: [
        "Check release snapshot (release PR)",
        "if: github.event_name == 'pull_request'",
        "pnpm release:snapshot:check -- --allow-planned-latest",
        "Check release snapshot (main)",
        "if: github.event_name != 'pull_request'",
        "run: pnpm release:snapshot:check",
        "GITHUB_TOKEN: ${{ github.token }}"
      ]
    },
    {
      path: checkScriptPath,
      snippets: [
        "release-snapshot-freshness",
        "allowPlannedLatest",
        "Planned latest release snapshot must be followed by the latest published stable release",
        "https://api.github.com/repos/${repository}/releases?per_page=20",
        "draft !== true && release.prerelease !== true"
      ]
    },
    {
      path: refreshScriptPath,
      snippets: [
        "answerlens-release-snapshot-refresh",
        "runReleaseSnapshotRefresh",
        "validateLatestStableReleaseReviewPath",
        "Latest stable release",
        "`Release review path`: open `release-assets-summary.md`, then the demo audit `share-summary.md`, then `scorecard.md`, then `recommendations.md`",
        "writeFile(snapshotPath",
        "release.draft !== true",
        "release.prerelease !== true",
        "Re-run with --write"
      ]
    },
    {
      path: playbookPath,
      snippets: [
        "corepack pnpm release:snapshot:refresh -- --write",
        "corepack pnpm release:snapshot:check -- --allow-planned-latest",
        "corepack pnpm release:snapshot:check",
        "main push uses strict mode",
        "published_at",
        "fails because the latest stable release is missing the release review path",
        "edit the GitHub Release body first",
        "open `release-assets-summary.md`, then the demo audit `share-summary.md`, then `scorecard.md`, then `recommendations.md`",
        "refresh guard"
      ]
    }
  ];

  for (const surface of requiredSurfaces) {
    let text: string;
    try {
      text = await readFile(path.join(rootDir, surface.path), "utf8");
    } catch (error) {
      findings.push({
        ruleId: "release-snapshot-freshness-gate",
        path: surface.path,
        message: `Unable to read release snapshot freshness surface: ${error instanceof Error ? error.message : String(error)}`
      });
      continue;
    }

    for (const snippet of surface.snippets) {
      if (!text.includes(snippet)) {
        findings.push({
          ruleId: "release-snapshot-freshness-gate",
          path: surface.path,
          message: `Release snapshot freshness gate is missing required snippet ${JSON.stringify(snippet)}.`
        });
      }
    }
  }
}

async function checkReleaseAssetChecklistBoundary(rootDir: string, findings: Finding[]): Promise<void> {
  const requiredSurfaces = [
    {
      path: "docs/manual-steps.md",
      snippets: [
        "## Release asset checklist",
        "CLI tarball",
        "answerlens-demo-audit.tar.gz",
        "answerlens-site.tar.gz",
        "release-assets-manifest.json",
        "release-assets-summary.md",
        "SHA-256",
        "gh release download vX.Y.Z",
        "corepack pnpm release:assets:smoke -- --dir \"$assets_dir\" --summary-out \"$assets_dir/release-assets-smoke-summary.md\"",
        "release-assets-smoke-summary.md",
        "Release review path",
        "open `release-assets-summary.md`, then the demo audit `share-summary.md`, then `scorecard.md`, then `recommendations.md`",
        "starter bundle",
        "examples/consumer-repo",
        "safe first-run story path",
        "not upload it as adoption proof by itself",
        "manifest checksums",
        "`share-summary.md`, then `scorecard.md`, then `recommendations.md`",
        "do not backfill a checksum claim",
        "If `npm view @answerlens/cli` returns `404`, do not present npm as activated"
      ]
    },
    {
      path: "docs/zh/manual-steps.md",
      snippets: [
        "## release assets 检查清单",
        "CLI tarball",
        "answerlens-demo-audit.tar.gz",
        "answerlens-site.tar.gz",
        "release-assets-manifest.json",
        "release-assets-summary.md",
        "SHA-256",
        "gh release download vX.Y.Z",
        "corepack pnpm release:assets:smoke -- --dir \"$assets_dir\" --summary-out \"$assets_dir/release-assets-smoke-summary.md\"",
        "release-assets-smoke-summary.md",
        "`Release review path`",
        "先打开 `release-assets-summary.md`，再看 demo audit 的 `share-summary.md`、`scorecard.md`、`recommendations.md`",
        "starter bundle",
        "examples/consumer-repo",
        "safe first-run story path",
        "不要把它单独当作 adoption proof",
        "manifest checksum",
        "`share-summary.md`、`scorecard.md`、`recommendations.md`",
        "不要把 checksum claim 回填进公开 release story",
        "如果 `npm view @answerlens/cli` 返回 `404`，不要把 npm 描述成已激活"
      ]
    },
    {
      path: "docs/release-bump-playbook.md",
      snippets: [
        "release asset checklist",
        "CLI tarball",
        "`answerlens-demo-audit.tar.gz`",
        "`answerlens-site.tar.gz`",
        "`release-assets-manifest.json`",
        "`release-assets-summary.md`",
        "gh release download vX.Y.Z",
        "corepack pnpm release:assets:smoke -- --dir \"$assets_dir\" --summary-out \"$assets_dir/release-assets-smoke-summary.md\"",
        "release-assets-smoke-summary.md",
        "Release review path",
        "open `release-assets-summary.md`, then the demo audit `share-summary.md`, then `scorecard.md`, then `recommendations.md`",
        "starter bundle",
        "examples/consumer-repo",
        "first-run story",
        "Show and tell",
        "not as standalone adoption proof",
        "manifest checksums",
        "do not imply checksum coverage for that release",
        "`share-summary.md`, then `scorecard.md`, then `recommendations.md`"
      ]
    },
    {
      path: ".github/workflows/release-distribution.yml",
      snippets: [
        "## Release asset checklist",
        "answerlens-cli-*.tgz",
        "`answerlens-demo-audit.tar.gz`",
        "`answerlens-site.tar.gz`",
        "`release-assets-summary.md`",
        "If `npm view @answerlens/cli` returns `404`, keep release assets or local checkout as the public path"
      ]
    },
    {
      path: "scripts/distribution/build-site.ts",
      snippets: [
        "Release asset checklist",
        "answerlens-demo-audit.tar.gz",
        "answerlens-site.tar.gz",
        "share-summary.md</code>, then <code>scorecard.md</code>, then <code>recommendations.md</code>",
        "npm view @answerlens/cli"
      ]
    }
  ];

  for (const surface of requiredSurfaces) {
    let text: string;
    try {
      text = await readFile(path.join(rootDir, surface.path), "utf8");
    } catch (error) {
      findings.push({
        ruleId: "release-asset-checklist-boundary",
        path: surface.path,
        message: `Unable to read release asset checklist surface: ${error instanceof Error ? error.message : String(error)}`
      });
      continue;
    }

    for (const snippet of surface.snippets) {
      if (!text.includes(snippet)) {
        findings.push({
          ruleId: "release-asset-checklist-boundary",
          path: surface.path,
          message: `Missing release asset checklist boundary text: ${snippet}`
        });
      }
    }
  }
}

async function checkReleaseAssetManifestGate(rootDir: string, findings: Finding[]): Promise<void> {
  const packageJsonPath = "package.json";
  const packageJson = await readRequiredJson<{ scripts?: Record<string, unknown> }>(
    rootDir,
    packageJsonPath,
    findings,
    "release-asset-manifest-gate"
  );
  const expectedScript = "node --experimental-strip-types scripts/distribution/release-assets-manifest.ts";
  if (packageJson?.scripts?.["release:assets:manifest"] !== expectedScript) {
    findings.push({
      ruleId: "release-asset-manifest-gate",
      path: packageJsonPath,
      message: "package.json must expose release:assets:manifest so release asset checksums are locally runnable."
    });
  }
  const expectedSmokeScript = "node --experimental-strip-types scripts/distribution/release-assets-smoke-check.ts";
  if (packageJson?.scripts?.["release:assets:smoke"] !== expectedSmokeScript) {
    findings.push({
      ruleId: "release-asset-manifest-gate",
      path: packageJsonPath,
      message: "package.json must expose release:assets:smoke so downloaded release assets are locally reusable."
    });
  }

  const testScript = typeof packageJson?.scripts?.test === "string" ? packageJson.scripts.test : "";
  if (!testScript.includes("scripts/distribution/release-assets-manifest.test.ts")) {
    findings.push({
      ruleId: "release-asset-manifest-gate",
      path: packageJsonPath,
      message: "package.json test script must include release-assets-manifest.test.ts."
    });
  }
  if (!testScript.includes("scripts/distribution/release-assets-smoke-check.test.ts")) {
    findings.push({
      ruleId: "release-asset-manifest-gate",
      path: packageJsonPath,
      message: "package.json test script must include release-assets-smoke-check.test.ts."
    });
  }

  const workflowPath = ".github/workflows/release-distribution.yml";
  const scriptPath = "scripts/distribution/release-assets-manifest.ts";
  const smokeScriptPath = "scripts/distribution/release-assets-smoke-check.ts";
  const requiredSurfaces = [
    {
      path: workflowPath,
      snippets: [
        "pnpm release:assets:manifest -- --out dist/release-assets-manifest.json",
        "pnpm release:assets:manifest -- --verify dist/release-assets-manifest.json",
        "--summary-out dist/release-assets-summary.md",
        "          pnpm release:assets:smoke -- --dir dist --work-dir dist/release-assets-smoke-check --summary-out dist/release-assets-smoke-summary.md",
        "cat dist/release-assets-summary.md >> \"$GITHUB_STEP_SUMMARY\"",
        "cat dist/release-assets-smoke-summary.md >> \"$GITHUB_STEP_SUMMARY\"",
        "The Release Distribution workflow runs `pnpm release:assets:smoke -- --dir dist --work-dir dist/release-assets-smoke-check --summary-out dist/release-assets-smoke-summary.md` before uploading release assets",
        "`release-assets-smoke-summary.md` is kept in the workflow summary and internal artifact as maintainer review evidence; do not treat it as standalone adoption proof",
        "`Release review path`: open `release-assets-summary.md`, then the demo audit `share-summary.md`, then `scorecard.md`, then `recommendations.md`",
        "`release-assets-manifest.json`: verify asset sizes and SHA-256 checksums",
        "`release-assets-summary.md`: read the verified asset table",
        "dist/release-assets-manifest.json dist/release-assets-summary.md --clobber",
        "dist/release-assets-manifest.json",
        "dist/release-assets-summary.md",
        "dist/release-assets-smoke-summary.md"
      ]
    },
    {
      path: scriptPath,
      snippets: [
        "answerlens-release-assets-manifest",
        "sha256",
        "answerlens-cli-*.tgz",
        "answerlens-demo-audit.tar.gz",
        "answerlens-site.tar.gz",
        "do not present npm as activated",
        "Release asset manifest verified",
        "Release review path",
        "starter-bundle.md",
        "examples/consumer-repo",
        "first-run story template",
        "Show and tell Discussion form",
        "API keys, private analytics, or raw provider payloads",
        "formatReleaseAssetsSummary"
      ]
    },
    {
      path: smokeScriptPath,
      snippets: [
        "runReleaseAssetsSmokeCheck",
        "runReleaseAssetsManifest",
        "runDemoFixtureArtifactCheck",
        "formatReleaseAssetsSmokeSummary",
        "formatReleaseReviewPath",
        "summaryOutPath",
        "Release asset smoke check passed",
        "Release review path",
        "release-assets-summary.md",
        "release-assets-smoke-summary.md",
        "answerlens-demo-audit.tar.gz",
        "answerlens-site.tar.gz",
        "adopter handoff and public sharing boundaries",
        "first-run story template",
        "API keys, private analytics, or raw provider payloads",
        "share-summary.md",
        "scorecard.md",
        "recommendations.md",
        "npm view @answerlens/cli"
      ]
    },
    {
      path: "docs/release-bump-playbook.md",
      snippets: [
        "Release Distribution workflow summary",
        "Release asset manifest verified",
        "Release asset smoke check passed",
        "release-assets-summary.md",
        "release-assets-smoke-summary.md",
        "corepack pnpm release:assets:smoke -- --dir \"$assets_dir\" --summary-out \"$assets_dir/release-assets-smoke-summary.md\"",
        "before reusing downloaded release assets"
      ]
    }
  ];

  for (const surface of requiredSurfaces) {
    let text: string;
    try {
      text = await readFile(path.join(rootDir, surface.path), "utf8");
    } catch (error) {
      findings.push({
        ruleId: "release-asset-manifest-gate",
        path: surface.path,
        message: `Unable to read release asset manifest surface: ${error instanceof Error ? error.message : String(error)}`
      });
      continue;
    }

    for (const snippet of surface.snippets) {
      if (!text.includes(snippet)) {
        findings.push({
          ruleId: "release-asset-manifest-gate",
          path: surface.path,
          message: `Missing release asset manifest gate snippet: ${snippet}`
        });
      }
    }
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
    if (
      typeof latest?.body === "string" &&
      !latest.body.includes(
        "`Release review path`: open `release-assets-summary.md`, then the demo audit `share-summary.md`, then `scorecard.md`, then `recommendations.md`"
      )
    ) {
      findings.push({
        ruleId: "stable-version-release-snapshot",
        path: releasesPath,
        message:
          "Latest release notes must include the release review path: open `release-assets-summary.md`, then the demo audit `share-summary.md`, then `scorecard.md`, then `recommendations.md`."
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

async function checkSelfDogfoodLogBoundary(rootDir: string, findings: Finding[]): Promise<void> {
  const relativePath = "docs/self-dogfood-log.md";
  let text: string;
  try {
    text = await readFile(path.join(rootDir, relativePath), "utf8");
  } catch (error) {
    findings.push({
      ruleId: "self-dogfood-log-boundary",
      path: relativePath,
      message: `Unable to read self-dogfood log needed for public claim guardrails: ${error instanceof Error ? error.message : String(error)}`
    });
    return;
  }

  const entriesSection = text.split(/^## Entries\b/m)[1] ?? "";
  const entries = entriesSection
    .split(/^### /m)
    .slice(1)
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (entries.length === 0) {
    findings.push({
      ruleId: "self-dogfood-log-boundary",
      path: relativePath,
      message: "Self-dogfood log must keep at least one dated entry with explicit no-claim boundaries."
    });
    return;
  }

  for (const entry of entries) {
    const title = entry.split(/\r?\n/, 1)[0] ?? "(untitled entry)";
    const hasThingsNotClaimed = /- Things not claimed:/i.test(entry);
    const preservesNoClaims =
      /\bno ranking\b/i.test(entry) &&
      /\bno traffic\b/i.test(entry) &&
      /\bno answer-surface\b/i.test(entry) &&
      /\bno external adoption\b/i.test(entry);

    if (!hasThingsNotClaimed || !preservesNoClaims) {
      findings.push({
        ruleId: "self-dogfood-log-boundary",
        path: relativePath,
        message: `Self-dogfood entry "${title}" must explicitly say what is not claimed: no ranking, traffic, answer-surface placement, or external adoption proof.`
      });
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
