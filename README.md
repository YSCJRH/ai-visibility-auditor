# AnswerLens

![AnswerLens cover](assets/readme-cover.svg)

> AnswerLens is a CLI-first AI visibility auditor for product websites.

AnswerLens is a CLI-first, report-driven, BYOK-friendly toolkit for teams that want to understand whether a product site is easy for AI systems to read, cite, compare, and recommend. AnswerLens focuses on explainable structure, evidence, and validation workflows rather than consumer UI scraping.

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

## Why AnswerLens

- Explainable audit rules that focus on why AI systems miss or misread a site.
- A report-first, repo-native workflow that turns runs into artifacts teams can review and ship against.
- A validation-oriented path that avoids scrape-and-rank claims and keeps evidence visible.

## What this is not

- Not a "rank #1 in ChatGPT" hack
- Not a consumer AI UI scraper
- Not a generic AI content generator
- Not a replacement for Search Console or analytics
- Not a guarantee of placement on any answer surface

## Sample outputs

The fixture demo writes machine-readable audit artifacts, a static scorecard, and follow-up recommendations that can be shared in pull requests, issues, and release notes.

![AnswerLens scorecard preview](assets/readme-scorecard-preview.svg)

![AnswerLens artifact preview](assets/readme-artifacts-preview.svg)

## Before / after showcase

AnswerLens is designed to turn vague "AI SEO" work into concrete structure, evidence, and comparison fixes that a product team can actually ship.

![AnswerLens before and after showcase](assets/readme-before-after-showcase.svg)

## Why this exists

- AI answers are now a discovery layer.
- Traditional SEO is still necessary, but it is no longer the whole story.
- Teams need explainable, reproducible workflows instead of consumer UI scraping.

## Repository layout

```text
apps/cli           User-facing command entrypoint
packages/core      Crawl, extract, audit, scoring, recommendations, config loading
packages/providers Live provider adapters and normalization contracts
packages/report    Markdown, JSON, and HTML report rendering
examples/          Demo configs and local fixtures
docs/              Architecture, scoring, limitations, bootstrap notes, and roadmap
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

## Output contract

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

- `v0.2.1`: ship `#9` for schema-text consistency and evidence density
- `v0.2.2`: ship `#10` for internal link context, anchor quality, and rule registry
- Full public roadmap: [docs/roadmap.md](/D:/SEO/docs/roadmap.md)

## Contributing

Start with [CONTRIBUTING.md](/D:/SEO/CONTRIBUTING.md). Questions and open-ended ideas should go to GitHub Discussions. Actionable changes should come through Issues and PRs.

## License

Apache-2.0. See [LICENSE](/D:/SEO/LICENSE).
