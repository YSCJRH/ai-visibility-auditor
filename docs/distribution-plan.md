# Distribution Plan

AnswerLens should behave like a self-propagating open-source distribution system: every release should create package, Action, Pages, and artifact entry points that can be discovered and reused without manual social posting.

## Current public surface

- GitHub repository homepage with a strong README hero, sample visuals, and concept pages
- GitHub releases with attached CLI, demo, and site assets through `v0.3.0`
- Shareable run artifacts such as `share-summary.md`, `share-summary.json`, `pr-snippet.md`, `run.json`, and `index.html`
- A demo workflow that uploads fixture artifacts
- A reusable root `action.yml` for `uses: YSCJRH/ai-visibility-auditor@vX`
- A static-site compiler plus Pages workflow scaffolding in-repo
- `CITATION.cff` and manual setup docs for distribution follow-through
- Issue and PR templates that already encourage artifact-backed discussion

## Main bottlenecks

- No public install surface yet, even though the product is CLI-first
- The reusable GitHub Action exists, but it is not yet a stable published adoption path with docs-backed external usage
- The Pages compiler and workflow scaffolding exist, but GitHub Pages, homepage, sitemap/feed publishing, and canonical site deployment are not yet enabled publicly
- Release distribution now works on semver tags, but npm publish and some public distribution surfaces still depend on credentials and repo settings
- npm publish can now be enabled through either `NPM_TOKEN` or npm trusted publishing, but one of those paths still needs manual setup
- GitHub workflow maintenance still matters because Actions runtime changes can quietly erode reliability if versions are not kept current
- DOI and the minimal growth metrics loop are still pending

## P0

Goals:

- ship a publish-ready CLI package definition
- ship a reusable GitHub Action
- ship a static-site compiler and Pages workflow scaffold
- document the manual settings that still require tokens or clicks

Status:

- largely landed in-repo
- remaining work is enablement, packaging, and public activation rather than missing scaffolding

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

Status:

- real release assets are now shipping on semver tags
- npm publish, Pages deployment, homepage activation, and settings alignment still need explicit enablement

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

## Current operating focus

With `v0.3.0` released on April 15, 2026, the near-term distribution bottleneck is activation rather than missing local scaffolding.

- Canonical activation brief: [activation-plan.md](activation-plan.md)
- Real-site quickstart: [quickstart.md](quickstart.md)
- Manual activation steps: [manual-steps.md](manual-steps.md)

## Credentials and manual settings

No extra credentials required for P0:

- package metadata and bundling
- `action.yml`
- site compiler and Pages artifact workflow
- `CITATION.cff`
- docs and release scaffolding

These pieces now exist in-repo; the remaining gap is activation rather than local implementation.

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
