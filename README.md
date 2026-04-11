# AnswerLens

![AnswerLens cover](assets/readme-cover.svg)

> Open-source AI visibility auditor for product websites.

AnswerLens is a CLI-first, report-driven, BYOK-friendly toolkit for teams that want to understand whether a product site is easy for AI systems to read, cite, compare, and recommend. It focuses on explainable structure fixes and reproducible eval runs instead of consumer UI scraping or vague ranking promises.

## What ships today

- `audit` for AI-readiness checks against a live site or local fixture
- `eval` for prompt-pack benchmarking with OpenAI and Perplexity adapters
- `manual-import` for scoring normalized answer samples from external or human-collected runs
- Structured config contracts for `brand.yaml`, `competitors.yaml`, and `prompts.yaml`
- Markdown, JSON, and static HTML outputs including `run.json`
- Expanded benchmark prompt pack with holdouts, fixtures, and GitHub issue / PR scaffolding

## Current status

| Area | Status |
| --- | --- |
| Audit CLI | Live |
| OpenAI eval | Live |
| Perplexity eval | Live |
| Manual answer import | Live |
| Search Console / Bing connectors | Planned |

## Why this exists

- AI answers are now a discovery layer.
- Traditional SEO is still necessary, but it is no longer the whole story.
- Teams need explainable, reproducible workflows instead of consumer UI scraping.

## What this is not

- Not a "rank #1 in ChatGPT" hack
- Not a consumer AI UI scraper
- Not a generic AI content generator
- Not a replacement for Search Console or analytics
- Not a guarantee of placement on any answer surface

## Repository layout

```text
apps/cli           User-facing command entrypoint
packages/core      Crawl, extract, audit, scoring, recommendations, config loading
packages/providers Live provider adapters and normalization contracts
packages/report    Markdown, JSON, and HTML report rendering
examples/          Demo configs and local fixtures
docs/              Architecture, scoring, limitations, and bootstrap notes
```

## Quickstart

```bash
corepack enable
corepack pnpm install
corepack pnpm demo:fixture
```

That command audits the local fixture in [examples/fixtures/static-good](/D:/SEO/examples/fixtures/static-good) and writes outputs to [runs/static-good](/D:/SEO/runs/static-good).

## Live audit

```bash
corepack pnpm audit -- https://example.com \
  --brand ./examples/acme/brand.yaml \
  --competitors ./examples/acme/competitors.yaml \
  --prompts ./examples/acme/prompts.yaml \
  --out ./runs/example
```

## Live eval

```bash
OPENAI_API_KEY=... corepack pnpm eval -- https://example.com \
  --brand ./examples/acme/brand.yaml \
  --competitors ./examples/acme/competitors.yaml \
  --prompts ./examples/acme/prompts.yaml \
  --provider openai \
  --samples 2 \
  --locale en-US \
  --out ./runs/example-eval
```

Perplexity runs use the same command shape with `--provider perplexity` and `PERPLEXITY_API_KEY`.

## Manual import

```bash
corepack pnpm manual-import -- https://example.com \
  --brand ./examples/acme/brand.yaml \
  --competitors ./examples/acme/competitors.yaml \
  --prompts ./examples/acme/prompts.yaml \
  --input ./responses.json \
  --out ./runs/example-import
```

`manual-import` accepts normalized `ProviderResponse[]` JSON or an object with a `responses` array.

## Sample outputs

`audit` writes:

- `site-audit.json`
- `issues.json`
- `recommendations.md`
- `scorecard.md`
- `index.html`
- `normalized-pages.json`
- `competitor-diff.md`
- `run.json`

`eval` and `manual-import` additionally write:

- `eval-results.json`
- `eval-summary.md`
- `eval-summary.json`
- `before-after-diff.md`
- `citation-gap-matrix.json`
- `citation-gap-matrix.md`
- `content-briefs/*.md`
- `briefs/*.md` for compatibility
- `raw/<provider>/<promptId>.json`

## How scoring works

See [docs/scoring.md](/D:/SEO/docs/scoring.md) for the readiness buckets, benchmark-vs-holdout behavior, and answer-layer metrics such as `accurateMentionRate`, `factCoverageScore`, `misrepresentationRate`, and `VAVR`.

## Roadmap

- `v0.1-audit`: CLI-first audit MVP
- `v0.2-eval`: stabilized eval contract, richer prompt taxonomy, and content briefs
- `v0.3-connectors`: GSC, Bing Webmaster, IndexNow, and deeper validation layers

## Contributing

Start with [CONTRIBUTING.md](/D:/SEO/CONTRIBUTING.md). Questions and open-ended ideas should go to GitHub Discussions. Actionable changes should come through Issues and PRs.

## License

Apache-2.0. See [LICENSE](/D:/SEO/LICENSE).
