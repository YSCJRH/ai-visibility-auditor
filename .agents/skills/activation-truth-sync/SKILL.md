---
name: activation-truth-sync
description: Audit and maintain consistency across AnswerLens public surfaces. Use when changing README copy, roadmap status, activation docs, release notes, Pages metadata, manual steps, or GitHub governance references, especially when latest release state, umbrella issues, or first-run entry points might drift out of sync.
---

# Activation Truth Sync

Read [references/checklist.md](references/checklist.md) first.

## Use this workflow

1. Read `AGENTS.md` before touching any public wording.
2. Treat remote GitHub state as authoritative for:
   - latest released version
   - active umbrella issue
   - milestone and PR status
3. Treat local repo files as authoritative for:
   - canonical product description
   - onboarding funnel copy
   - manual-vs-repo-editable boundaries

## Check these surfaces together

- `README.md`
- `docs/activation-plan.md`
- `docs/roadmap.md`
- `docs/distribution-plan.md`
- `docs/manual-steps.md`
- `docs/github-action.md`
- `docs/github-bootstrap.md`
- `scripts/distribution/releases-snapshot.json`
- `.github/workflows/release-distribution.yml`
- `scripts/distribution/build-site.ts`

## Preserve these invariants

- Keep the public brand as `AnswerLens`.
- Keep the descriptive line as `CLI-first AI visibility auditor for product websites`.
- Keep the tagline as `CI for AI discoverability`.
- Keep the non-goals intact: no consumer AI UI scraping, no ranking guarantees, no dashboard-first rewrite.
- Keep manual repository settings explicit instead of implying they are repo-editable.
- Re-check the current latest release and current umbrella issue before editing temporally unstable copy.

## When you edit

- Update all affected surfaces in one pass rather than fixing only one page.
- If release-facing copy changes, update both `scripts/distribution/releases-snapshot.json` and `.github/workflows/release-distribution.yml`.
- If Pages-facing copy changes, update `scripts/distribution/build-site.ts` and validate the compiled site.
- If the active workstream changes, update roadmap, activation plan, release copy, and GitHub bootstrap notes together.

## Validate before closing

- `corepack pnpm public:check`
- `corepack pnpm test`
- `corepack pnpm typecheck`
- `corepack pnpm build:site`
- `corepack pnpm seo:check`
- `corepack pnpm pack:cli:dry-run`

Add `corepack pnpm demo:fixture` when onboarding or demo surfaces changed.
