# Manual Steps

These are the smallest manual steps needed to activate the public distribution surfaces that are scaffolded in the repository.

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
3. Set the repository homepage URL to the Pages site once the first deploy succeeds.

## GitHub Actions runtime

1. Keep self-hosted runners on a version compatible with Node 24-based JavaScript actions.
2. If you maintain copied workflows outside this repository, prefer the same major action versions used here:
   `actions/checkout@v5`, `actions/setup-node@v5`, `actions/github-script@v8`, and `actions/upload-artifact@v6`.

## GitHub repository settings

Update the public repository metadata to keep the brand coherent:

- Description: `AnswerLens: CLI-first AI visibility auditor for product websites.`
- Homepage: the GitHub Pages URL after deployment
- Social preview: `assets/readme-cover.svg` or an exported rasterized equivalent
- Topics: prefer brand and use-case terms over provider-heavy terms
- Optional: disable Wiki to keep the public distribution surface focused on README, docs, releases, Action docs, and Pages

## Optional credibility and research setup

- Connect Zenodo if you want DOI-backed release citations
- Add Marketplace listing metadata only after the reusable Action is stable

## Current no-token path

Without extra credentials, the repository can still:

- build the CLI tarball with `npm pack --dry-run`
- generate the static site
- upload Pages artifacts in CI
- upload release artifacts except for the npm publish step

With trusted publishing configured, npm publish no longer requires `NPM_TOKEN`.
