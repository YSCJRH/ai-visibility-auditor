---
name: adoption-sanity-check
description: Verify that AnswerLens onboarding and adoption paths stay copyable from demo to CI. Use when changing README first-run copy, demo walkthroughs, quickstart docs, GitHub Action docs, starter bundle examples, Pages entry points, or release-facing adoption guidance.
---

# Adoption Sanity Check

Read [references/checklist.md](references/checklist.md) first.

## Use this workflow

1. Start from the public funnel, not from internal implementation details.
2. Walk the path in order:
   - live demo
   - 60-second fixture demo
   - 5-minute real-site audit
   - GitHub Action adoption
   - release assets as the secondary front door
3. Check whether a new visitor can understand what to click next without needing repo history.

## Check these surfaces together

- `README.md`
- `docs/demo-report.md`
- `docs/quickstart.md`
- `docs/github-action.md`
- `examples/consumer-repo/README.md`
- `examples/consumer-repo/.github/workflows/answerlens.yml`
- `action.yml`
- `scripts/distribution/build-site.ts`
- `docs/manual-steps.md`

## Preserve these invariants

- Keep the funnel sequential instead of presenting all entry points as unrelated links.
- Keep the artifact order stable: `share-summary.md`, then `scorecard.md`, then `recommendations.md`.
- Keep starter bundle paths external-repo friendly: `.github/answerlens/brand.yaml`, `competitors.yaml`, `prompts.yaml`.
- Keep copied workflow majors aligned with the repo defaults: `actions/checkout@v5`, `actions/setup-node@v5`, `actions/github-script@v8`, `actions/upload-artifact@v6`.
- Keep the Action path feeling like the CI version of the same artifact-backed workflow, not a separate product.

## When you edit

- Update README, quickstart, demo report, and Action docs together if the funnel changes.
- Update `examples/consumer-repo` when Action docs or path assumptions change.
- Update `scripts/distribution/build-site.ts` when Pages or release entry points change.
- Avoid adding new product promises while polishing adoption copy.

## Validate before closing

- `corepack pnpm public:check`
- `corepack pnpm demo:fixture`
- `corepack pnpm test`
- `corepack pnpm typecheck`
- `corepack pnpm build:site`
- `corepack pnpm seo:check`

Add `corepack pnpm pack:cli:dry-run` when package or release-facing install copy changed.
