---
name: answerlens-activation
description: Maintain the AnswerLens activation funnel and public adoption narrative. Use when changing README copy, docs, Pages text, release/manual-step guidance, demo narrative, first-run story, or self-dogfooding surfaces for AnswerLens.
---

# AnswerLens Activation

Use this skill for AnswerLens work that changes how new developers discover, understand, try, trust, copy, or share the project.

## First Checks

1. Confirm the workspace is the AnswerLens repository:
   - `git remote -v` includes `YSCJRH/ai-visibility-auditor`, or local repo evidence clearly matches that project.
   - `package.json` has `name: "answerlens-workspace"`.
   - `AGENTS.md` keeps the canonical product description and non-goals.
2. Read `AGENTS.md` before editing public wording.
3. Treat live repository state as temporally unstable. Verify release, npm, and active issue facts before publishing status copy:
   - `gh release list --repo YSCJRH/ai-visibility-auditor --limit 5`
   - `gh issue view 33 --repo YSCJRH/ai-visibility-auditor` when umbrella status is mentioned
   - `npm view @answerlens/cli version` before any npm install claim

## Product Position

Preserve this narrative:

- AnswerLens is CI for AI discoverability.
- It audits whether public product websites have source material that AI systems can understand, cite, verify, and compare.
- It is not an AI ranking tool.
- It does not scrape consumer AI UIs.
- It does not promise answer placement in ChatGPT, Perplexity, AI Overview, or any answer surface.

## Activation Funnel

Keep public entry points in this order:

1. Live demo report.
2. Fixture demo.
3. Real-site audit.
4. GitHub Action adoption.
5. First-run story or self-dogfooding follow-up.

When editing one funnel surface, inspect the related surfaces together:

- `README.md`
- `README.zh-CN.md`
- `docs/demo-report.md`
- `docs/quickstart.md`
- `docs/github-action.md`
- `docs/starter-bundle.md`
- `docs/shareable-summary.md`
- `docs/trust-and-safety.md`
- `docs/first-run-story.md`
- `docs/self-dogfooding.md`
- `docs/self-dogfood-log.md`
- `docs/manual-steps.md`
- `scripts/distribution/build-site.ts`

## Artifact Contract

Every public adoption surface should preserve this reading order:

1. `share-summary.md`
2. `scorecard.md`
3. `recommendations.md`

The share layer should answer:

- What happened in this run.
- Which artifact to open next.
- How to copy the workflow into another repository.
- What the result does not claim.

## Validation

Run the smallest meaningful set first, then broaden when public surfaces changed:

```powershell
corepack pnpm public:check
corepack pnpm demo:fixture
corepack pnpm test
corepack pnpm typecheck
corepack pnpm build:site
corepack pnpm seo:check
corepack pnpm pack:cli:dry-run
```

Record real failures with command output. Do not report checks as passing unless they ran.

## Non-Goals

- Do not add consumer AI UI scraping.
- Do not add ranking guarantees or answer placement claims.
- Do not call readiness score a ranking.
- Do not claim users, stars, forks, downloads, traffic, growth, case studies, or adoption proof without visible authorized evidence.
- Do not write API keys into `runtime.yaml`, starter config, examples, or public docs.
- Do not expose `raw/**` provider payloads in public PR summaries or default artifact uploads.
- Do not do a dashboard-first rewrite.
