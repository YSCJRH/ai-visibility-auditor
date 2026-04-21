# Architecture

AnswerLens is intentionally biased toward a small number of packages:

- `apps/cli`: command parsing and orchestration
- `apps/admin`: internal control console for local run orchestration and artifact review
- `packages/core`: crawl, extraction, rules, scoring, recommendations, and config loading
- `packages/providers`: normalized provider contracts and live adapters
- `packages/report`: Markdown, JSON, and HTML rendering
- `packages/contracts`: browser-safe run, artifact, preset, and job contracts for the admin surface
- `packages/admin-runtime`: file-system-backed run listing, artifact reads, preset discovery, and queued admin launches

## Data flow

1. Load `brand.yaml`, `competitors.yaml`, and `prompts.yaml`
2. Discover pages from sitemap, robots hints, and local fixture fallbacks
3. Normalize page content into a stable internal `PageRecord`
4. Run deterministic rules first
5. Score buckets and synthesize recommendations
6. Build `run.json`, `site-audit.json`, `issues.json`, `recommendations.md`, `scorecard.md`, `normalized-pages.json`, and `competitor-diff.md`
7. For live eval runs, call provider adapters, normalize repeated samples, and write `eval-results.json`, `eval-summary.md`, `eval-summary.json`, `before-after-diff.md`, citation gap matrices, and content briefs
8. For manual imports, normalize external answer samples into the same provider contract and send them through the same scorer

## Internal admin flow

The internal admin console stays subordinate to the CLI and public GitHub-native surfaces:

1. The React client in `apps/admin` calls a thin local BFF
2. The BFF reads presets from repo-native config paths and runs from `runs/*`
3. New launches call shared AnswerLens orchestration rather than inventing a second artifact contract
4. Run detail pages read the same `run.json`, `share-summary.json`, and `site-audit.json` files used elsewhere

See [docs/admin-console.md](admin-console.md) for the operator guide.

## Design constraints

- Machine-readable outputs come first
- Provider logic stays out of core audit logic
- Local fixtures must be first-class for regression testing
- The report should be useful even when `eval` is not enabled
- Each run should be self-contained and reproducible from the output directory alone
- The admin console must remain an internal control surface rather than a public dashboard-first product
