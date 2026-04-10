# Architecture

AnswerLens is intentionally biased toward a small number of packages:

- `apps/cli`: command parsing and orchestration
- `packages/core`: crawl, extraction, rules, scoring, recommendations, config loading
- `packages/providers`: normalized provider contracts and experimental adapters
- `packages/report`: Markdown and HTML rendering

## Data flow

1. Load `brand.yaml`, `competitors.yaml`, and `prompts.yaml`
2. Discover pages from sitemap, robots hints, and local fixture fallbacks
3. Normalize page content into a stable internal `PageRecord`
4. Run deterministic rules first
5. Score buckets and synthesize recommendations
6. Render JSON, Markdown, and HTML outputs

## Design constraints

- Machine-readable outputs come first
- Provider logic stays out of core audit logic
- Local fixtures must be first-class for regression testing
- The report should be useful even when `eval` is not enabled

