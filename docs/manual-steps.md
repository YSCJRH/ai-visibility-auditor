# Manual Steps

These are the smallest manual steps needed to activate the public distribution surfaces that are scaffolded in the repository.

## Activation order

1. Enable GitHub Pages and confirm the canonical site URL.
2. Set repository homepage, social preview, and topics so the public front door matches the docs.
3. Choose the npm publish path: trusted publishing or `NPM_TOKEN`.
4. Keep copied workflow versions current in external repositories.
5. After the first public deploy, verify the live demo report, quickstart docs, and release surfaces.
6. Keep Discussions categories, pinned onboarding discussion, and issue template contact links aligned with the public funnel.
7. Keep the self-dogfooding note path aligned across release notes, Announcements, and README proof surfaces.

## npm publishing

1. Confirm control of the preferred scope `@answerlens`.
2. If the scope cannot be controlled, switch the public package name to `answerlens-cli` before the first publish.
3. Choose one publish path:
   - Token path: add `NPM_TOKEN` as a repository secret.
   - Trusted publishing path: configure npm trusted publishing for this repository and set repository variable `ANSWERLENS_ENABLE_NPM_TRUSTED_PUBLISH=true`.
4. After either path is enabled, the semver-tag release workflow can publish `@answerlens/cli` automatically.

If `npm view @answerlens/cli` returns `404`, treat npm as not yet activated; use GitHub release assets or a local checkout until one publish path is configured and the package is visible in the registry.

## GitHub Pages

1. Enable GitHub Pages with **Source: GitHub Actions**.
2. Set repository variable `ANSWERLENS_ENABLE_PAGES_DEPLOY=true` after Pages is enabled.
3. Set the repository homepage URL to `https://yscjrh.github.io/ai-visibility-auditor/` once the first deploy succeeds.
4. Verify the live demo report URL:
   `https://yscjrh.github.io/ai-visibility-auditor/examples/static-good/index.html`
5. Treat the Pages site as the canonical audit target for self-dogfooding public source material.

## GitHub Actions runtime

1. Keep self-hosted runners on a version compatible with Node 24-based JavaScript actions.
2. The root `AnswerLens` Action provisions pnpm with Corepack, so copied adopter workflows do not need a separate `pnpm/action-setup` step when they call the repository Action with a reviewed release tag such as `YSCJRH/ai-visibility-auditor@v0.3.4`.
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

## Current no-token path

Without extra credentials, the repository can still:

- build the CLI tarball with `npm pack --dry-run`
- generate the static site
- upload Pages artifacts in CI
- upload release artifacts except for the npm publish step

With trusted publishing configured, npm publish no longer requires `NPM_TOKEN`.
