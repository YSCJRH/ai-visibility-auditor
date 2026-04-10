# AnswerLens

> Open-source AI visibility auditor for product websites.

AnswerLens helps product and growth teams understand whether a site is ready to be read, cited, compared, and recommended by AI assistants. It is intentionally `CLI-first`, `report-driven`, and `BYOK` instead of trying to be a vague "rank #1 in ChatGPT" dashboard.

## Why this exists

- AI answers are now a discovery layer.
- Traditional SEO is still necessary, but it is no longer the whole story.
- Teams need explainable, reproducible workflows instead of consumer UI scraping.

## What ships in this repo today

- `audit` command for AI-readiness checks against a product site or local fixture
- Structured config contracts for `brand.yaml`, `competitors.yaml`, and `prompts.yaml`
- Markdown, JSON, and static HTML reports
- OpenAI-backed experimental `eval` workflow with normalized citations and raw payload persistence
- Community health files and GitHub issue / PR scaffolding

## What this is not

- Not a "rank #1 in ChatGPT" hack
- Not a consumer UI scraper
- Not a generic AI content generator
- Not a replacement for Search Console or analytics

## Repository layout

```text
apps/cli           User-facing command entrypoints
packages/core      Crawl, extract, audit, scoring, config loading
packages/providers Provider contracts and experimental adapters
packages/report    Markdown and HTML report rendering
examples/          Demo configs and local fixtures
docs/              Scoring, rules, limitations, GitHub bootstrap notes
```

## Quickstart

```bash
corepack enable
pnpm install
pnpm demo:fixture
```

That command audits the local fixture in [examples/fixtures/static-good](/D:/SEO/examples/fixtures/static-good) and writes outputs to [runs/static-good](/D:/SEO/runs/static-good).

You can also run against a site:

```bash
pnpm run audit -- https://example.com \
  --brand ./examples/acme/brand.yaml \
  --competitors ./examples/acme/competitors.yaml \
  --prompts ./examples/acme/prompts.yaml \
  --out ./runs/example
```

## Experimental eval

Set `OPENAI_API_KEY` and run:

```bash
pnpm run eval -- https://example.com \
  --brand ./examples/acme/brand.yaml \
  --competitors ./examples/acme/competitors.yaml \
  --prompts ./examples/acme/prompts.yaml \
  --provider openai \
  --out ./runs/example-eval
```

`eval` reuses the audit baseline, writes raw provider payloads, and adds:

- `eval-results.json`
- `eval-summary.md`
- `before-after-diff.md`
- `briefs/*.md` when FAQ / compare / use-case gaps are detected

## Output contract

`audit` writes:

- `site-audit.json`
- `issues.json`
- `scorecard.md`
- `index.html`

`eval` additionally writes:

- `eval-results.json`
- `eval-summary.md`
- `before-after-diff.md`
- `raw/<provider>/<promptId>.json`

## Development

```bash
pnpm test
pnpm typecheck
```

## Roadmap

- `v0.1-audit`: CLI-first audit MVP
- `v0.2-eval`: OpenAI and Perplexity provider adapters plus normalized citations
- `v0.3-connectors`: GSC, Bing Webmaster, IndexNow, manual import mode

## Contributing

Start with [CONTRIBUTING.md](/D:/SEO/CONTRIBUTING.md). Questions and open-ended ideas should go to GitHub Discussions. Actionable changes should come through Issues and PRs.

## License

Apache-2.0. See [LICENSE](/D:/SEO/LICENSE).
