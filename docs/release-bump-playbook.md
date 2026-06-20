# Release Bump Playbook

Use this when preparing a semver AnswerLens release. This is a maintainer checklist for keeping package version, GitHub release copy, starter pins, Pages release metadata, and npm status in sync.

Do not use this for ordinary docs-only, guardrail-only, or Pages-copy PRs that do not need a new release tag.

## Before The PR

Confirm the current external truth first:

```bash
gh release view --json tagName,publishedAt,url,isDraft,isPrerelease
npm view @answerlens/cli version --json --fetch-timeout=5000 --fetch-retries=0
```

If npm still returns `E404`, keep npm described as a manual activation item and keep using GitHub release assets or a local checkout in public docs.

For existing published releases, refresh the local snapshot from GitHub before editing release-facing copy:

```bash
corepack pnpm release:snapshot:refresh -- --write
corepack pnpm release:snapshot:check
```

For a new unreleased semver tag, prepare the intended snapshot entry from the planned release notes during the release PR, then run the refresh command above after the Release Distribution workflow publishes the GitHub release. That follow-up replaces guessed fields such as `published_at` with GitHub's actual metadata.

During the release PR, use the planned-latest mode so CI can verify the prepared top entry while still checking that the next local snapshot entry matches the latest already-published GitHub release:

```bash
corepack pnpm release:snapshot:check -- --allow-planned-latest
```

Keep planned-latest mode scoped to release PRs; main push uses strict mode so an unreleased planned snapshot cannot sit on `main` after the release handoff.

## Release PR Scope

A release bump PR should update these surfaces together:

1. `package.json`
2. `apps/cli/package.json`
3. `.github/workflows/release-distribution.yml`
4. `scripts/distribution/releases-snapshot.json`
5. `scripts/distribution/build-site.ts`
6. `scripts/distribution/seo-check.ts`
7. `scripts/distribution/site-seo.ts`
8. `docs/github-action.md`
9. `docs/zh/github-action.md`
10. `docs/starter-bundle.md`
11. `docs/manual-steps.md`
12. `docs/zh/manual-steps.md`
13. `examples/consumer-repo/README.md`
14. `examples/consumer-repo/.github/workflows/answerlens.yml`

`corepack pnpm public:check` verifies this set as the current stable-release surface. If it fails with `stable-version-*`, fix the drift instead of weakening the rule.

## Release Copy Boundaries

Release notes should keep the same product contract:

- AnswerLens is a CLI-first AI visibility auditor for product websites.
- Tagline: CI for AI discoverability.
- Start with the live demo report, then fixture demo, real-site audit, GitHub Action adoption, and release assets.
- Review artifacts in order: `share-summary.md`, then `scorecard.md`, then `recommendations.md`.
- No consumer AI UI scraping.
- No ranking, traffic, or answer-surface placement guarantee.
- Readiness, VAVR, and CPS are diagnostic signals, not platform rankings.
- Optional `eval` is BYOK; secrets stay in environment variables or GitHub secrets, not `runtime.yaml`.
- Public summaries and default GitHub artifacts should not expose raw provider payloads.
- npm publish is skipped unless `NPM_TOKEN` or trusted publishing is configured.
- Include a release asset checklist: CLI tarball, `answerlens-demo-audit.tar.gz`, `answerlens-site.tar.gz`, `release-assets-manifest.json`, `release-assets-summary.md`, and the report order `share-summary.md`, then `scorecard.md`, then `recommendations.md`.

Do not add users, stars, forks, downloads, traffic, growth percentages, testimonials, or case studies unless the evidence is visible and explicitly authorized.

## Tag And Publish

After the release PR is reviewed and merged, create the semver tag only when the package version and stable-release surfaces already match:

```bash
git fetch origin main --tags
git switch main
git pull --ff-only
git tag vX.Y.Z
git push origin vX.Y.Z
```

The `Release Distribution` workflow validates that `apps/cli/package.json` matches the tag, runs the release gate, writes and verifies `release-assets-manifest.json`, writes `release-assets-summary.md`, publishes or updates the GitHub release, uploads release assets, skips npm when credentials are unavailable, and dispatches the Pages workflow on `main`.

## Post-Release Verification

Confirm the public state after the workflow completes:

```bash
gh release view vX.Y.Z --json tagName,publishedAt,url,isDraft,isPrerelease
gh run list --branch main --limit 5 --json name,status,conclusion,headSha,url
assets_dir="$(mktemp -d)"
gh release download vX.Y.Z \
  --pattern 'answerlens-cli-*.tgz' \
  --pattern answerlens-demo-audit.tar.gz \
  --pattern answerlens-site.tar.gz \
  --pattern release-assets-manifest.json \
  --pattern release-assets-summary.md \
  --dir "$assets_dir"
corepack pnpm release:assets:smoke -- --dir "$assets_dir" --summary-out "$assets_dir/release-assets-smoke-summary.md"
npm view @answerlens/cli version --json --fetch-timeout=5000 --fetch-retries=0
corepack pnpm public:check
corepack pnpm release:snapshot:refresh -- --write
corepack pnpm release:snapshot:check
corepack pnpm build:site
corepack pnpm seo:check
```

Open `release-assets-summary.md` first when you only need the human-readable checksum table; run `corepack pnpm release:assets:smoke -- --dir "$assets_dir" --summary-out "$assets_dir/release-assets-smoke-summary.md"` before reusing tarballs. The smoke command verifies the manifest checksums, checks the summary boundary text, unpacks the CLI tarball to check the package README npm boundary, unpacks the demo audit bundle, confirms the report order `share-summary.md`, then `scorecard.md`, then `recommendations.md`, and checks the compiled site release entrypoints. Review `release-assets-smoke-summary.md` as maintainer evidence for the downloaded bundle, not as standalone adoption proof. In the Release Distribution workflow summary, review the `Release asset manifest verified` and `Release asset smoke check passed` sections before reusing downloaded release assets.

If `release:snapshot:refresh -- --write` changes `scripts/distribution/releases-snapshot.json`, review the diff and ship a small truth-sync PR before making new Pages or release claims. If npm still returns `E404`, do not add npm install copy. If an older release does not have `release-assets-manifest.json` or `release-assets-summary.md`, do not imply checksum coverage for that release. Record trusted publishing or `NPM_TOKEN` as a manual step.

## What Not To Do

- Do not tag a release from a branch that has not passed the release gate.
- Do not publish release notes that imply a ranking or answer-placement improvement.
- Do not describe a readiness score as a platform ranking.
- Do not upload `raw/**` provider payloads through public default artifacts.
- Do not change scoring, crawler, or provider adapters just to create a release.
- Do not claim GitHub Pages, repository topics, social preview, npm, trusted publishing, or Discussions settings are complete unless the corresponding external state is verified.
