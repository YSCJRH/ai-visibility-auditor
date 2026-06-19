# Manual Steps

These are the smallest manual steps needed to activate the public distribution surfaces that are scaffolded in the repository.

## Activation order

1. Enable GitHub Pages and confirm the canonical site URL.
2. Set repository homepage, social preview, and topics so the public front door matches the docs.
3. Choose the npm publish path: trusted publishing or `NPM_TOKEN`.
4. Use [release-bump-playbook.md](release-bump-playbook.md) before every semver release bump.
5. Keep copied workflow versions current in external repositories.
6. After the first public deploy, verify the live demo report, quickstart docs, and release surfaces.
7. Keep Discussions categories, pinned onboarding discussion, and issue template contact links aligned with the public funnel.
8. Keep the self-dogfooding note path aligned across release notes, Announcements, and README proof surfaces.

## npm publishing

1. Confirm control of the preferred scope `@answerlens`.
2. If the scope cannot be controlled, switch the public package name to `answerlens-cli` before the first publish.
3. Choose one publish path:
   - Token path: add `NPM_TOKEN` as a repository secret.
   - Trusted publishing path: configure npm trusted publishing for this repository and set repository variable `ANSWERLENS_ENABLE_NPM_TRUSTED_PUBLISH=true`.
4. After either path is enabled, the semver-tag release workflow can publish `@answerlens/cli` automatically.

If `npm view @answerlens/cli` returns `404`, treat npm as not yet activated; use GitHub release assets or a local checkout until one publish path is configured and the package is visible in the registry.

## Release asset checklist

Use release assets as the second public front door after the live demo, fixture demo, real-site quickstart, and GitHub Action path are understandable.

The expected public assets on each semver release are:

1. CLI tarball, such as `answerlens-cli-*.tgz`, for pinned local CLI runs before npm is visible.
2. `answerlens-demo-audit.tar.gz`, for unpacking the fixture report and opening `share-summary.md`, then `scorecard.md`, then `recommendations.md`.
3. `answerlens-site.tar.gz`, for inspecting the compiled Pages bundle for docs, examples, starter, and release pages at that tag.
4. `release-assets-manifest.json`, for verifying downloaded asset sizes and SHA-256 checksums before reusing the tarballs.

For releases that include `release-assets-manifest.json`, download the manifest and the assets into the same directory, then verify the downloaded files from a local checkout:

```bash
assets_dir="$(mktemp -d)"
gh release download vX.Y.Z \
  --pattern 'answerlens-cli-*.tgz' \
  --pattern answerlens-demo-audit.tar.gz \
  --pattern answerlens-site.tar.gz \
  --pattern release-assets-manifest.json \
  --dir "$assets_dir"
corepack pnpm release:assets:manifest -- --verify "$assets_dir/release-assets-manifest.json"
```

If a release predates `release-assets-manifest.json`, do not backfill a checksum claim into the public release story; inspect the available assets and record the gap as release metadata history.

If `npm view @answerlens/cli` returns `404`, do not present npm as activated. Keep release assets and local checkout as the public install/download path until the registry package is visible.

## GitHub Pages

1. Enable GitHub Pages with **Source: GitHub Actions**.
2. Set repository variable `ANSWERLENS_ENABLE_PAGES_DEPLOY=true` after Pages is enabled.
3. Set the repository homepage URL to `https://yscjrh.github.io/ai-visibility-auditor/` once the first deploy succeeds.
4. Verify the live demo report URL:
   `https://yscjrh.github.io/ai-visibility-auditor/examples/static-good/index.html`
5. Treat the Pages site as the canonical audit target for self-dogfooding public source material.

## GitHub Actions runtime

1. Keep self-hosted runners on a version compatible with Node 24-based JavaScript actions.
2. The root `AnswerLens` Action provisions pnpm with Corepack, so copied adopter workflows do not need a separate `pnpm/action-setup` step when they call the repository Action with a reviewed release tag such as `YSCJRH/ai-visibility-auditor@v0.3.5`.
3. For `eval`, keep non-secret provider defaults in `runtime.yaml` next to `brand.yaml`; keep API keys in repository or organization secrets.
4. If you maintain copied workflows outside this repository, prefer the same major action versions used here:
   `actions/checkout@v5`, `actions/setup-node@v5`, `actions/github-script@v8`, and `actions/upload-artifact@v6`.
5. Remaining Node 20 deprecation annotations may still come from GitHub-maintained Pages and artifact actions until their upstream runtime metadata is fully refreshed.

## GitHub repository settings

Update the public repository metadata to keep the brand coherent:

- Description: `AnswerLens: CLI-first AI visibility auditor for product websites.`
- Canonical home: the GitHub repository README
- Homepage: the GitHub Pages URL after deployment
- Social preview: `assets/social-preview.png`
- Topics: prefer `answerlens`, `ai-discoverability`, `ai-visibility`, `aeo`, `seo`, `cli`, `github-actions`, and category/use-case terms over provider-heavy terms
- Optional: disable Wiki to keep the public distribution surface focused on README, docs, releases, Action docs, and Pages

## GitHub Discussions and feedback routing

Keep Discussions enabled and create these categories:

- `Q&A` for first-run questions and unclear results
- `Ideas` for open-ended product direction
- `Show and tell` for screenshots, artifacts, and first-run reports
- `Announcements` for release and roadmap updates

The repository includes `.github/DISCUSSION_TEMPLATE/show-and-tell.yml` for the `Show and tell` category. It only activates after Discussions are enabled and that category uses the `show-and-tell` slug. The form keeps `share-summary.md`, then `scorecard.md`, then `recommendations.md` first, asks for release asset evidence when relevant, and repeats the npm `404`, BYOK, no-ranking, no raw-payload, and explicit reuse-permission boundaries.

Also pin one onboarding discussion:

- `Start here: share your first AnswerLens run`

Base the pinned discussion on [first-run-story.md](first-run-story.md), and keep it clear that shared stories need user authorization plus safe artifact links before they become public proof.

Use `Announcements` for maintainer dogfood notes:

- what AnswerLens found on itself
- one clarity, proof, structure, or conversion change made because of that run
- a short before / after or self-audit snapshot when available

Keep `.github/ISSUE_TEMPLATE/config.yml` aligned with that routing so first-time users are nudged toward Discussions instead of opening a vague issue.

## Optional credibility and research setup

- Connect Zenodo if you want DOI-backed release citations
- Add Marketplace listing metadata only after the reusable Action is stable

## Public truth checklist

- README, roadmap, release notes, and Pages should all agree on the latest released version
- README should remain the canonical home, while the release surface acts as the second front door
- Pages should remain the canonical audit target for self-dogfooding public source material
- README, quickstart docs, release notes, and Pages should all present the same first-run funnel
- The live demo link in README should resolve to the Pages-hosted sample report
- The copied workflow versions in docs should match the repository defaults
- Discussions and Issues should describe the same routing as the docs
- release notes and Announcements should describe self-dogfooding improvements in the same language as the docs
- npm publish copy should mention both trusted publishing and `NPM_TOKEN`
- npm install copy should not imply the package is available before the registry returns a visible package
- any active or recently completed coordination issue should describe the current release truth, not an older release after a newer stable release becomes latest
- release bump PRs should follow [release-bump-playbook.md](release-bump-playbook.md) so package versions, release snapshots, Action pins, Pages fallback metadata, and npm status stay aligned

## Current no-token path

Without extra credentials, the repository can still:

- build the CLI tarball with `npm pack --dry-run`
- generate the static site
- upload Pages artifacts in CI
- upload release artifacts except for the npm publish step

With trusted publishing configured, npm publish no longer requires `NPM_TOKEN`.
