# Architecture

AnswerLens is intentionally biased toward a small number of packages:

- `apps/cli`: command parsing and orchestration
- `packages/core`: crawl, extraction, rules, scoring, recommendations, and config loading
- `packages/providers`: normalized provider contracts and live adapters
- `packages/report`: Markdown, JSON, and HTML rendering

## Data flow

1. Load `brand.yaml`, `competitors.yaml`, and `prompts.yaml`
2. Discover pages from sitemap, robots hints, and local fixture fallbacks
3. Normalize page content into a stable internal `PageRecord`
4. Run deterministic rules first
5. Score buckets and synthesize recommendations
6. Build `run.json`, `site-audit.json`, `issues.json`, `recommendations.md`, `scorecard.md`, `normalized-pages.json`, and `competitor-diff.md`
7. For live eval runs, call provider adapters, normalize repeated samples, and write `eval-results.json`, `eval-summary.md`, `eval-summary.json`, `before-after-diff.md`, citation gap matrices, and content briefs
8. For manual imports, normalize external answer samples into the same provider contract and send them through the same scorer

## Design constraints

- Machine-readable outputs come first
- Provider logic stays out of core audit logic
- Local fixtures must be first-class for regression testing
- The report should be useful even when `eval` is not enabled
- Each run should be self-contained and reproducible from the output directory alone
