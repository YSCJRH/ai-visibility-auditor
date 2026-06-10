# AGENTS.md

## Mission
Near-term work should activate AnswerLens's existing distribution, trial, onboarding, and GitHub-native adoption surfaces.
Prioritize public entry points, first-run clarity, and artifact-backed workflows over net-new product expansion.

## Canonical product description
AnswerLens is a CLI-first AI visibility auditor for product websites.
Tagline: CI for AI discoverability.
Public brand: AnswerLens.
Repository slug: ai-visibility-auditor.

## Hard non-goals
- No consumer AI UI scraping.
- No ranking guarantees on answer surfaces.
- No dashboard-first rewrite.
- No connector work that outruns the core audit and validation story.

## Working rules
- Start with a plan for any multi-file, workflow, release, README, or Pages task.
- Keep changes scoped to a single surface when possible: governance, README, Action adoption, demo narrative, or release/distribution.
- Separate code changes from manual repository settings in docs and summaries.
- Prefer activating existing scaffolding over introducing new features.
- Keep README, roadmap, distribution docs, Action docs, release copy, and manual steps in brand and status sync.
- When an activation maintenance workflow repeats and the local flow is stable, codify it under `.agents/skills/` instead of re-explaining it in ad hoc prompts.
- Every meaningful change should improve at least one funnel step: discover, understand, trust, try, activate, share, or revisit.
- Public-facing report, README, Pages, Action, starter, or release changes must preserve the artifact reading order: `share-summary.md`, then `scorecard.md`, then `recommendations.md`.
- Public summaries and default GitHub artifact uploads must not expose `raw/**` provider payloads. Keep raw payloads for local or private debugging paths.
- Do not add npm install copy for `@answerlens/cli` unless the registry package is visibly published. Until then, describe local checkout, release assets, and manual npm activation steps.
- First-run story or adoption-proof copy must stay authorized and artifact-backed; never imply current users, stars, forks, downloads, traffic, growth percentages, case studies, or external adoption without visible evidence.
- Trust and safety copy must keep the BYOK boundary explicit: basic `audit` needs no provider key, optional `eval` uses the user's own provider account, and secrets stay out of configs, docs, and public summaries.

## Verification
- Docs and workflow changes: `corepack pnpm public:check`, `corepack pnpm test`, `corepack pnpm typecheck`, `corepack pnpm build:site`, `corepack pnpm seo:check`, `corepack pnpm pack:cli:dry-run`
- Demo or onboarding changes: `corepack pnpm demo:fixture`
- Public claim, SEO metadata, Pages, release, README, or Action adoption changes must include `corepack pnpm public:check`; Pages-generating changes must include `corepack pnpm seo:check` after `corepack pnpm build:site`

## Done means
- Product wording stays consistent across public docs.
- Manual repo settings remain clearly separated from repo-editable work.
- Release and roadmap status reflect the true latest published state.
