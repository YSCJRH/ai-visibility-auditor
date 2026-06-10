---
name: answerlens-claim-guardrails
description: Review AnswerLens public surfaces for unsafe claims, fake proof, premature npm install copy, secret leakage, raw provider payload exposure, or artifact-order drift.
---

# AnswerLens Claim Guardrails

Use this skill before release-facing changes, public docs changes, Pages copy changes, README edits, Action adoption edits, or generated report contract changes.

## What To Block

Block or rewrite public copy that claims or implies:

- guaranteed AI rankings
- guaranteed ChatGPT, Perplexity, AI Overview, or answer-surface placement
- consumer AI UI scraping as a product capability
- readiness score or VAVR as a platform ranking
- fake users, stars, forks, downloads, traffic, growth percentages, case studies, or adoption proof
- public npm installation before `@answerlens/cli` is visible in the registry
- secrets in `runtime.yaml`, examples, docs, starter configs, PR snippets, or public summaries
- raw provider payloads exposed through default public artifacts or GitHub Action uploads
- report artifact reading order other than `share-summary.md`, `scorecard.md`, `recommendations.md`

## Required Checks

Start with the automated public check:

```powershell
corepack pnpm public:check
```

Then inspect nearby surfaces when a check fails or when the change is public-facing:

- `scripts/distribution/public-surface-check.ts`
- `scripts/distribution/public-surface-check.test.ts`
- `.github/workflows/demo-audit.yml`
- `docs/github-action.md`
- `examples/consumer-repo/.github/workflows/answerlens.yml`
- `packages/report/src/index.ts`
- `packages/report/src/index.test.ts`
- `README.md`
- `docs/trust-and-safety.md`
- `docs/shareable-summary.md`
- `docs/manual-steps.md`

## Manual Claim Review

Search for high-risk terms and judge context, not just matches:

```powershell
rg -n "rank|ranking|guarantee|ChatGPT|Perplexity|AI Overview|scrap|scrape|stars|forks|downloads|traffic|growth|case stud|npm install @answerlens/cli|raw/\\*\\*" README.md docs examples scripts packages .github plugins
```

Allowed contexts include boundary statements, comparison docs, tests that intentionally assert blocking behavior, and manual-step notes that clearly say npm is not active yet.

## Secret Review

Review runtime defaults and starter examples:

```powershell
rg -n "api[_-]?key|token|secret|sk-[A-Za-z0-9]" .github examples docs README.md README.zh-CN.md plugins
```

Provider keys must live in environment variables or GitHub secrets, never in committed config or generated public summaries.

## Artifact Review

When report generation changes, verify:

- artifact list starts with `share-summary.md`, `scorecard.md`, `recommendations.md`
- `share-summary.md` and `pr-snippet.md` explain next artifacts
- default upload paths exclude `raw/**`
- raw provider payloads stay local or private-debug only

Run:

```powershell
corepack pnpm test
corepack pnpm demo:fixture
```

Read generated `runs/static-good/share-summary.md` only after the demo command actually ran in the current workspace.
