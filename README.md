# AnswerLens

[![CI](https://github.com/YSCJRH/ai-visibility-auditor/actions/workflows/ci.yml/badge.svg)](https://github.com/YSCJRH/ai-visibility-auditor/actions/workflows/ci.yml)
[![Demo Audit](https://github.com/YSCJRH/ai-visibility-auditor/actions/workflows/demo-audit.yml/badge.svg)](https://github.com/YSCJRH/ai-visibility-auditor/actions/workflows/demo-audit.yml)
[![Release](https://img.shields.io/github/v/release/YSCJRH/ai-visibility-auditor?label=release)](https://github.com/YSCJRH/ai-visibility-auditor/releases)
[![License](https://img.shields.io/github/license/YSCJRH/ai-visibility-auditor)](LICENSE)

![AnswerLens cover](assets/readme-cover.svg)

> CI for AI discoverability.

AnswerLens is a CLI-first AI visibility auditor for product websites. It checks whether your site can be read, cited, compared, and recommended by AI systems, then writes reproducible artifacts you can review in GitHub.

AnswerLens focuses on explainable structure, evidence, and validation workflows rather than consumer UI scraping.

Open-source. CLI-first. Report-driven. No consumer UI scraping. No ranking promises.

The repository slug is `ai-visibility-auditor`; the public project name is `AnswerLens`.

## Try the fixture demo in 60 seconds

```bash
corepack enable
corepack pnpm install
corepack pnpm demo:fixture
```

That command audits the local fixture in [examples/fixtures/static-good](examples/fixtures/static-good) and writes outputs to [runs/static-good](runs/static-good).

The first shareable result looks like this:

```md
## AnswerLens audit

**CI for AI discoverability.** Readiness: **90/100**. VAVR: **pending eval**.

AI may miss this product because:
- Thin key page: add plain-language explanations, evidence blocks, and stronger sections.
```

## What ships today

- `audit` for AI-readiness checks against a live site or local fixture
- `eval` for prompt-pack benchmarking with OpenAI and Perplexity adapters
- `manual-import` for scoring normalized answer samples from external or human-collected runs
- Structured config contracts for `brand.yaml`, `competitors.yaml`, and `prompts.yaml`
- Markdown, JSON, static HTML, and PR-ready outputs including `share-summary.md`, `pr-snippet.md`, and `run.json`
- Expanded benchmark prompt pack with holdouts, fixtures, and GitHub issue / PR scaffolding

## Current status

| Area | Status |
| --- | --- |
| Audit CLI | Live |
| OpenAI eval | Live |
| Perplexity eval | Live |
| Manual answer import | Live |
| Search Console / Bing connectors | Planned |

## Distribution

- Canonical distribution plan: [docs/distribution-plan.md](docs/distribution-plan.md)
- Manual setup checklist for Pages, npm, and repo settings: [docs/manual-steps.md](docs/manual-steps.md)
- GitHub Action usage and output contract: [docs/github-action.md](docs/github-action.md)

## Why AnswerLens

- CI for AI discoverability, built for Git workflows instead of dashboard lock-in.
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

See [docs/demo-report.md](docs/demo-report.md) for the fixture report walkthrough.

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

If you have reviewed placement data from a manual validation pass, include `rankPosition` as a positive integer:

```json
[
  {
    "provider": "manual",
    "model": "manual-import",
    "promptId": "best-developer-analytics",
    "answerText": "Acme is a recommended developer analytics platform with public docs and transparent pricing.",
    "citations": ["https://acme.test/pricing"],
    "searchResults": [],
    "requestedAt": "2026-04-14T00:00:00.000Z",
    "locale": "en-US",
    "sampleIndex": 0,
    "runCount": 1,
    "holdout": false,
    "rankPosition": 1
  }
]
```

`manual-import` keeps `rankPosition` optional. When present, AnswerLens adds `competitivePositionScore` and `rankCoverageRate` to the eval summary and share summary outputs.

## Output contract

`audit` writes:

- `site-audit.json`
- `issues.json`
- `recommendations.md`
- `scorecard.md`
- `index.html`
- `normalized-pages.json`
- `competitor-diff.md`
- `share-summary.md`
- `share-summary.json`
- `pr-snippet.md`
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

See [docs/scoring.md](docs/scoring.md) for the readiness buckets, benchmark-vs-holdout behavior, and answer-layer metrics such as `accurateMentionRate`, `factCoverageScore`, `misrepresentationRate`, `VAVR`, and ranked manual-import validation via `competitivePositionScore`.

## Shareable summaries

Every run writes a compact share layer:

- `share-summary.md` for humans reading a run artifact
- `share-summary.json` for Actions, badges, or downstream tooling
- `pr-snippet.md` for pull requests, issues, and release notes

See [docs/shareable-summary.md](docs/shareable-summary.md) and [docs/badges.md](docs/badges.md) for examples.

## Learn the concepts

- [CI for AI discoverability](docs/concepts/ci-for-ai-discoverability.md)
- [AI visibility](docs/concepts/ai-visibility.md)
- [Citation gaps](docs/concepts/citation-gap.md)
- [Schema-text consistency](docs/concepts/schema-text-consistency.md)
- [Evidence density](docs/concepts/evidence-density.md)
- [AnswerLens vs AI SEO dashboards](docs/compare/answerlens-vs-ai-seo-dashboards.md)
- [AnswerLens vs consumer UI scraping](docs/compare/answerlens-vs-ui-scraping.md)

## Roadmap

- Landed on `main` after `v0.2.0`: `#9` schema-text consistency and evidence density
- Landed on `main` after `v0.2.0`: `#10` internal link context, anchor quality, and rule registry
- Released in `v0.2.3` on April 15, 2026: `#11` manual rank import and CPS plus `#12` repeated-sample stability summaries
- Next execution line: `#13` Search Console validation, then `#14` Bing Webmaster / IndexNow helper
- Full public roadmap: [docs/roadmap.md](docs/roadmap.md)

## Contributing

Start with [CONTRIBUTING.md](CONTRIBUTING.md). Questions and open-ended ideas should go to GitHub Discussions. Actionable changes should come through Issues and PRs.

## License

Apache-2.0. See [LICENSE](LICENSE).
