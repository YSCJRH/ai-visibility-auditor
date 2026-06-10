# Trust And Safety

AnswerLens is designed for public source-material audits that teams can review inside GitHub.

This page is the public trust and safety boundary for first-run users, maintainers, and reviewers.

## What AnswerLens Reads

- public product websites, docs, pricing pages, FAQ pages, comparison pages, security pages, integration pages, and use-case pages
- local static fixtures used for reproducible demos
- user-provided configuration files such as `brand.yaml`, `competitors.yaml`, `prompts.yaml`, and non-secret `runtime.yaml`
- optional normalized answer samples supplied through `manual-import`
- optional page-level Search Console or Bing Webmaster CSV exports supplied by the user

AnswerLens does not need repository history, private source code, private analytics, or provider API keys for a basic `audit` run.

## Secrets

Basic `audit` runs do not require provider API keys.

Optional `eval` runs are BYOK: bring your own provider key and keep it in your shell, CI environment, or GitHub Actions secrets.

Do not put these values in `runtime.yaml`, starter configs, example configs, docs, PR summaries, or public issues:

- `OPENAI_API_KEY`
- `PERPLEXITY_API_KEY`
- GitHub tokens
- npm tokens
- analytics exports that include private user data
- provider raw payloads that have not been reviewed for sharing

`runtime.yaml` is only for non-secret defaults such as provider, model, locale, sample count, timeout, and optional provider base URL.

## Safe Sharing

Use these files when you want to share a run:

1. `share-summary.md`
2. `scorecard.md`
3. `recommendations.md`

Then use `pr-snippet.md` for a compact GitHub block.

Keep raw provider payloads private by default. They are useful for debugging and auditability, but they should not be pasted into public PRs, issues, release notes, or default report summaries.

## Scoring Boundaries

Readiness scores are diagnostic signals about source material quality. They are not rankings.

`VAVR` is an eval-backed signal about verified visibility for the active prompt pack. It is not a placement promise.

`competitivePositionScore` only appears when reviewed manual rank inputs are present. It is not an official answer-surface rank, and it does not mean AnswerLens scraped a consumer AI interface.

## Non-Goals

AnswerLens does not:

- scrape consumer AI UIs
- promise rankings in ChatGPT, Perplexity, Google AI Overviews, or any other answer surface
- call readiness score a ranking
- fabricate users, stars, forks, downloads, traffic, case studies, or adoption proof
- publish npm install instructions before the package is visible in the registry
- replace Search Console, analytics, or normal security review
- require a hosted AnswerLens dashboard

## Before You Publish A Result

Use this checklist before posting an AnswerLens result publicly:

- The result uses `share-summary.md` or `pr-snippet.md`, not raw provider payloads.
- The artifact order is visible: `share-summary.md`, then `scorecard.md`, then `recommendations.md`.
- The copy does not imply answer-surface ranking, placement, traffic lift, or percentage growth.
- The copy does not claim external adoption proof unless it links to authorized, public evidence.
- Secrets remain in environment variables or GitHub secrets.
- Manual setup items such as Pages, npm publishing, repository topics, social preview, and trusted publishing are described as manual steps.

Security vulnerabilities should follow [SECURITY.md](../SECURITY.md), not public issue threads.
