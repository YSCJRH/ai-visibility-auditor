# Manual Steps

These are the smallest manual steps needed to activate the public distribution surfaces that are scaffolded in the repository.

## Activation order

1. Enable GitHub Pages and confirm the canonical site URL.
2. Set repository homepage, social preview, and topics so the public front door matches the docs.
3. Choose the npm publish path: trusted publishing or `NPM_TOKEN`.
4. Keep copied workflow versions current in external repositories.
5. After the first public deploy, verify the live demo report, quickstart docs, and release surfaces.

## npm publishing

1. Confirm control of the preferred scope `@answerlens`.
2. If the scope cannot be controlled, switch the public package name to `answerlens-cli` before the first publish.
3. Choose one publish path:
   - Token path: add `NPM_TOKEN` as a repository secret.
   - Trusted publishing path: configure npm trusted publishing for this repository and set repository variable `ANSWERLENS_ENABLE_NPM_TRUSTED_PUBLISH=true`.
4. After either path is enabled, the semver-tag release workflow can publish `@answerlens/cli` automatically.

## GitHub Pages

1. Enable GitHub Pages with **Source: GitHub Actions**.
2. Set repository variable `ANSWERLENS_ENABLE_PAGES_DEPLOY=true` after Pages is enabled.
3. Set the repository homepage URL to `https://yscjrh.github.io/ai-visibility-auditor/` once the first deploy succeeds.
4. Verify the live demo report URL:
   `https://yscjrh.github.io/ai-visibility-auditor/examples/static-good/index.html`

## GitHub Actions runtime

1. Keep self-hosted runners on a version compatible with Node 24-based JavaScript actions.
2. If you maintain copied workflows outside this repository, prefer the same major action versions used here:
   `actions/checkout@v5`, `actions/setup-node@v5`, `actions/github-script@v8`, and `actions/upload-artifact@v6`.

## GitHub repository settings

Update the public repository metadata to keep the brand coherent:

- Description: `AnswerLens: CLI-first AI visibility auditor for product websites.`
- Homepage: the GitHub Pages URL after deployment
- Social preview: `assets/social-preview.png`
- Topics: prefer `answerlens`, `ai-discoverability`, `ai-visibility`, `aeo`, `seo`, `cli`, `github-actions`, and category/use-case terms over provider-heavy terms
- Optional: disable Wiki to keep the public distribution surface focused on README, docs, releases, Action docs, and Pages

## Optional credibility and research setup

- Connect Zenodo if you want DOI-backed release citations
- Add Marketplace listing metadata only after the reusable Action is stable

## Public truth checklist

- README, roadmap, release notes, and Pages should all agree on the latest released version
- README, quickstart docs, release notes, and Pages should all present the same first-run funnel
- The live demo link in README should resolve to the Pages-hosted sample report
- The copied workflow versions in docs should match the repository defaults
- npm publish copy should mention both trusted publishing and `NPM_TOKEN`

## Current no-token path

Without extra credentials, the repository can still:

- build the CLI tarball with `npm pack --dry-run`
- generate the static site
- upload Pages artifacts in CI
- upload release artifacts except for the npm publish step

With trusted publishing configured, npm publish no longer requires `NPM_TOKEN`.
