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

## Start here

1. [Open the live demo report](https://yscjrh.github.io/ai-visibility-auditor/examples/static-good/index.html): see the canonical Pages-hosted sample report first. If Pages has not been activated yet, use the [repo walkthrough fallback](docs/demo-report.md).
2. [Run the 60-second fixture demo](#run-the-60-second-fixture-demo): generate the same artifact set locally.
3. [Run a 5-minute real-site audit](docs/quickstart.md): point AnswerLens at your own public site before you wire CI.
4. [Add the GitHub Action](docs/github-action.md): turn the same artifact flow into pull requests, artifact uploads, and `GITHUB_STEP_SUMMARY`.

Across every step, open artifacts in the same order: `share-summary.md`, then `scorecard.md`, then `recommendations.md`.

## What you get

- `audit` for AI-readiness checks against a live site or local fixture
- `eval` for prompt-pack benchmarking with OpenAI and Perplexity adapters
- `manual-import` for scoring normalized answer samples from external or human-collected runs
- `search-console-import` for validating key-page evidence against imported page-level Search Console exports
- `bing-indexnow-helper` for Bing validation imports plus IndexNow helper artifacts
- Repo-native outputs such as `share-summary.md`, `pr-snippet.md`, `run.json`, and `index.html`

## Why AnswerLens

- CI for AI discoverability, built for Git workflows instead of dashboard lock-in
- Explainable audit rules that focus on why AI systems miss or misread a site
- A report-first, repo-native workflow that turns runs into artifacts teams can review and ship against
- A validation-oriented path that avoids scrape-and-rank claims and keeps evidence visible

## What this is not

- Not a "rank #1 in ChatGPT" hack
- Not a consumer AI UI scraper
- Not a generic AI content generator
- Not a replacement for Search Console or analytics
- Not a guarantee of placement on any answer surface

## Run the 60-second fixture demo

```bash
corepack enable
corepack pnpm install
corepack pnpm demo:fixture
```

That command audits the local fixture in [examples/fixtures/static-good](examples/fixtures/static-good) and writes outputs to [runs/static-good](runs/static-good).

Open these fixture artifacts first:

- `share-summary.md`
- `scorecard.md`
- `recommendations.md`
- `pr-snippet.md`
- `index.html`

The first shareable result looks like this:

```md
## AnswerLens audit

**CI for AI discoverability.** Readiness: **90/100**. VAVR: **pending eval**.

AI may miss this product because:
- Thin key page: add plain-language explanations, evidence blocks, and stronger sections.
```

## Open the live demo report

- Canonical live demo URL: [Pages sample report](https://yscjrh.github.io/ai-visibility-auditor/examples/static-good/index.html)
- Repo walkthrough fallback: [docs/demo-report.md](docs/demo-report.md)
- Open these artifacts first:
  - `share-summary.md`
  - `scorecard.md`
  - `recommendations.md`
  - `pr-snippet.md`
  - `index.html`

## Run a 5-minute real-site audit

Use [docs/quickstart.md](docs/quickstart.md) after the fixture demo and before CI adoption.

- Copy the starter bundle shape from [examples/consumer-repo](examples/consumer-repo) into `./.github/answerlens/`.
- Run one local `audit` against your own public site with the same config layout that later moves into GitHub Actions.
- Open `share-summary.md`, then `scorecard.md`, then `recommendations.md` before you look at `pr-snippet.md` or `index.html`.

## Add the GitHub Action

Start with [docs/github-action.md](docs/github-action.md) and copy the external starter bundle from [examples/consumer-repo](examples/consumer-repo).

If you have not run one real local audit yet, use [docs/quickstart.md](docs/quickstart.md) first. The Action should feel like the CI version of the same artifact-backed workflow, not a separate adoption path.

The public Action contract is:

- `uses: YSCJRH/ai-visibility-auditor@vX`
- `command: audit | eval | manual-import | search-console-import | bing-indexnow-helper`
- outputs: `out-dir`, `share-summary-path`, `pr-snippet-path`, `run-json-path`

## Install or download

- GitHub Action is the fastest CI-first entry point
- The cleanest one-off local run lives in [docs/quickstart.md](docs/quickstart.md)
- Release assets are the clearest tarball download surface: [latest release](https://github.com/YSCJRH/ai-visibility-auditor/releases/latest)
- npm publishing is wired through semver releases and requires either trusted publishing or `NPM_TOKEN`; see [docs/manual-steps.md](docs/manual-steps.md)
- GitHub Pages, repository homepage, social preview, and topics still require explicit repo settings activation

## Current status

| Area | Status |
| --- | --- |
| Audit CLI | Live |
| OpenAI eval | Live |
| Perplexity eval | Live |
| Manual answer import | Live |
| Search Console validation import | Live |
| Bing / IndexNow helpers | Live |

## Distribution

- Canonical distribution plan: [docs/distribution-plan.md](docs/distribution-plan.md)
- Manual setup checklist for Pages, npm, and repo settings: [docs/manual-steps.md](docs/manual-steps.md)
- 5-minute real-site quickstart: [docs/quickstart.md](docs/quickstart.md)
- GitHub Action usage and output contract: [docs/github-action.md](docs/github-action.md)
- Current activation and adoption brief: [docs/activation-plan.md](docs/activation-plan.md)

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
docs/              Architecture, scoring, limitations, activation notes, and roadmap
```

Copy the external starter bundle from [examples/consumer-repo](examples/consumer-repo) into `./.github/answerlens/` in the repo you want to audit, then use commands like these:

## Live audit

```bash
corepack pnpm audit -- https://example.com \
  --brand ./.github/answerlens/brand.yaml \
  --competitors ./.github/answerlens/competitors.yaml \
  --prompts ./.github/answerlens/prompts.yaml \
  --out ./runs/example
```

## Live eval

```bash
OPENAI_API_KEY=... corepack pnpm eval -- https://example.com \
  --brand ./.github/answerlens/brand.yaml \
  --competitors ./.github/answerlens/competitors.yaml \
  --prompts ./.github/answerlens/prompts.yaml \
  --provider openai \
  --samples 2 \
  --locale en-US \
  --out ./runs/example-eval
```

Perplexity runs use the same command shape with `--provider perplexity` and `PERPLEXITY_API_KEY`.

## Manual import

```bash
corepack pnpm manual-import -- https://example.com \
  --brand ./.github/answerlens/brand.yaml \
  --competitors ./.github/answerlens/competitors.yaml \
  --prompts ./.github/answerlens/prompts.yaml \
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
    "answerText": "Example Product is a recommended developer analytics platform with public docs and transparent pricing.",
    "citations": ["https://example.com/pricing"],
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

## Search Console validation import

```bash
corepack pnpm search-console-import -- https://example.com \
  --brand ./.github/answerlens/brand.yaml \
  --competitors ./.github/answerlens/competitors.yaml \
  --prompts ./.github/answerlens/prompts.yaml \
  --input ./gsc-pages.csv \
  --out ./runs/example-search-console
```

`search-console-import` accepts page-level Search Console CSV exports with these required columns:

- `page`
- `clicks`
- `impressions`
- `ctr`
- `position`

It uses Search Console as an external evidence layer for existing audit findings. It does not replace audit, eval, analytics, or Search Console itself.

## Bing / IndexNow helper

```bash
corepack pnpm bing-indexnow-helper -- https://example.com \
  --brand ./.github/answerlens/brand.yaml \
  --competitors ./.github/answerlens/competitors.yaml \
  --prompts ./.github/answerlens/prompts.yaml \
  --bing-input ./bing-pages.csv \
  --out ./runs/example-bing
```

`bing-indexnow-helper` imports page-level Bing Webmaster CSV exports using the same required columns as Search Console validation:

- `page`
- `clicks`
- `impressions`
- `ctr`
- `position`

It also generates IndexNow helper artifacts for the current audited key pages. The first version does not submit live IndexNow requests.

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

`search-console-import` additionally writes:

- `search-console-summary.json`
- `search-console-summary.md`
- `search-console-pages.json`

`bing-indexnow-helper` additionally writes:

- `bing-summary.json`
- `bing-summary.md`
- `bing-pages.json`
- `indexnow-summary.json`
- `indexnow-summary.md`
- `indexnow-candidates.json`

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
- [Search Console validation import](docs/search-console.md)
- [Bing / IndexNow helper](docs/bing-indexnow.md)

## Roadmap

- Landed on `main` after `v0.2.0`: `#9` schema-text consistency and evidence density
- Landed on `main` after `v0.2.0`: `#10` internal link context, anchor quality, and rule registry
- Released in `v0.2.3` on April 15, 2026: `#11` manual rank import and CPS plus `#12` repeated-sample stability summaries
- Released in `v0.3.0` on April 15, 2026: `#13` Search Console validation import plus `#14` Bing Webmaster / IndexNow helper
- Current operating focus: [docs/activation-plan.md](docs/activation-plan.md)
- Full public roadmap: [docs/roadmap.md](docs/roadmap.md)

The repository slug remains `ai-visibility-auditor`; the public product name is `AnswerLens`.

## Contributing

Start with [CONTRIBUTING.md](CONTRIBUTING.md). Questions and open-ended ideas should go to GitHub Discussions. Actionable changes should come through Issues and PRs.

## License

Apache-2.0. See [LICENSE](LICENSE).
