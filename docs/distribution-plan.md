# Distribution Plan

AnswerLens should behave like a self-propagating open-source distribution system: every release should create package, Action, Pages, and artifact entry points that can be discovered and reused without manual social posting.

## Current public surface

- GitHub repository homepage with a strong README hero, sample visuals, and concept pages
- GitHub releases with good narrative copy but no attached release assets
- Shareable run artifacts such as `share-summary.md`, `share-summary.json`, `pr-snippet.md`, `run.json`, and `index.html`
- A demo workflow that uploads fixture artifacts
- Issue and PR templates that already encourage artifact-backed discussion

## Main bottlenecks

- No public install surface yet, even though the product is CLI-first
- No reusable `uses: owner/repo@vX` GitHub Action entry point
- No GitHub Pages site, homepage URL, sitemap, feed, or canonical metadata
- No compiler layer that turns artifacts into release assets, example pages, and indexable pages
- No `CITATION.cff`, DOI path, or minimal growth metrics loop

## P0

Goals:

- ship a publish-ready CLI package definition
- ship a reusable GitHub Action
- ship a static-site compiler and Pages workflow scaffold
- document the manual settings that still require tokens or clicks

Acceptance:

- `apps/cli` is ready for `npm pack --dry-run`
- the repo contains `action.yml` with stable inputs and outputs
- `pnpm build:site` generates homepage, docs, releases, examples, playbooks, sitemap, feed, robots, canonical metadata, and JSON-LD
- `CITATION.cff`, `docs/distribution-plan.md`, and `docs/manual-steps.md` exist and match the canonical product description

## P1

Goals:

- publish the CLI package on semver tags
- enable GitHub Pages deployment
- attach real release assets and refresh the public site automatically
- unify GitHub repository settings with the public brand

Acceptance:

- tag pushes can publish npm when `NPM_TOKEN` is present and skip cleanly when it is not
- release assets include CLI tarballs, demo artifacts, and compiled site bundles
- GitHub homepage, Pages, README, Action docs, and release notes use one canonical product description

## P2

Goals:

- add DOI and citation-grade release references
- prepare for GitHub Marketplace
- add a lightweight, automation-friendly growth metrics loop

Acceptance:

- DOI or equivalent research citation path is documented and live
- release, package, Action, and Pages surfaces stay synchronized
- North Star and leading metrics are reviewed on a repeatable cadence

## Credentials and manual settings

No extra credentials required for P0:

- package metadata and bundling
- `action.yml`
- site compiler and Pages artifact workflow
- `CITATION.cff`
- docs and release scaffolding

Requires manual setup for P1 or later:

- npm scope control and `NPM_TOKEN`
- enabling GitHub Pages from Actions
- setting repository homepage, social preview, and refined topics
- optional Zenodo integration

## Metrics

Canonical product description:

- `AnswerLens is a CLI-first AI visibility auditor for product websites.`
- `CI for AI discoverability.`

North Star:

- `qualified distribution starts / 28d`

Leading metrics:

- release surface completeness
- indexable page count
- release asset count
- Pages build success rate
- Action adoption proxy via `uses:` references and copied workflow patterns

Lagging metrics:

- GitHub repo views and clones
- stars and forks
- npm downloads
- Pages search entry data when available
