---
name: answerlens-adopter-kit
description: Productize AnswerLens first-run and starter-bundle adoption paths. Use when improving the fixture demo, real-site audit handoff, GitHub Action copy path, starter bundle, first-run story, or PR review artifacts.
---

# AnswerLens Adopter Kit

Use this skill when the task is to make a new external repository owner able to copy AnswerLens, run it once, review the artifacts, and share an authorized first-run story.

## Goal

Make one run feel like the invitation to the next run:

1. Understand AnswerLens from the live demo.
2. Reproduce the fixture demo.
3. Run a real-site audit.
4. Review artifacts in the right order.
5. Copy the GitHub Action or starter bundle.
6. Share a first-run story only when the user explicitly authorizes it.

## Surfaces To Inspect

- `README.md`
- `docs/demo-report.md`
- `docs/quickstart.md`
- `docs/github-action.md`
- `docs/starter-bundle.md`
- `docs/shareable-summary.md`
- `docs/first-run-story.md`
- `examples/consumer-repo/README.md`
- `examples/consumer-repo/.github/answerlens/brand.yaml`
- `examples/consumer-repo/.github/answerlens/competitors.yaml`
- `examples/consumer-repo/.github/answerlens/prompts.yaml`
- `examples/consumer-repo/.github/answerlens/runtime.yaml`
- `examples/consumer-repo/.github/workflows/answerlens.yml`
- `action.yml`

## Copyable Starter Rules

Keep the external adopter shape stable:

```text
.github/
  answerlens/
    brand.yaml
    competitors.yaml
    prompts.yaml
    runtime.yaml
  workflows/
    answerlens.yml
```

`runtime.yaml` may contain non-secret defaults such as provider, model, locale, sample count, timeout, and optional base URL. It must not contain API keys or secret-like values.

## First-Run Story Rules

A first-run story can ask for:

- target site or public surface
- artifact links
- before or after source-material changes
- what the user learned
- explicit permission to quote

It must not imply:

- current external adoption
- traffic lift
- ranking lift
- answer placement
- provider endorsement
- must not imply unauthorized customer proof

## PR Review Artifact Rules

The PR or issue snippet should point teammates to:

1. `share-summary.md`
2. `scorecard.md`
3. `recommendations.md`

It should also say how to copy the same workflow into another repo and state that public summaries exclude raw provider payloads.

## Validation

For adopter-path changes, prefer:

```powershell
corepack pnpm public:check
corepack pnpm demo:fixture
corepack pnpm demo:consumer-repo
corepack pnpm test
corepack pnpm typecheck
```

Add these when Pages, SEO, release, or packaging surfaces changed:

```powershell
corepack pnpm build:site
corepack pnpm seo:check
corepack pnpm pack:cli:dry-run
```
