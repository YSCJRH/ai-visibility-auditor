# Contributing to AnswerLens

Thanks for helping build AnswerLens.

## Before you open anything

- Use Issues for actionable work only.
- Use Discussions for questions, roadmap feedback, and showcases once the GitHub remote is enabled.
- Read [docs/rule-authoring.md](docs/rule-authoring.md) before proposing new audit rules.
- Read [docs/provider-contract.md](docs/provider-contract.md) before adding or changing provider adapters.
- For docs, release, starter, Action, or public report changes, keep the public framing intact: no consumer AI UI scraping, no ranking or answer-placement guarantee, and no public npm install copy until `@answerlens/cli` is visible in the registry.

## Local setup

```bash
corepack enable
pnpm install
pnpm test
pnpm typecheck
pnpm demo:fixture
```

## Supported contribution types

- Bug fixes
- False-positive or false-negative rule reports
- Rule proposals
- Provider adapter work
- Documentation improvements

## Pull request checklist

- Keep the change scoped to one problem.
- Link the related issue in the PR body.
- Mention any config, output, or scoring changes.
- Add or update tests when logic changes.
- Attach a screenshot or report artifact when the UI or report output changes.
- For public-facing changes, run `pnpm public:check` and preserve the artifact order: `share-summary.md`, then `scorecard.md`, then `recommendations.md`.
- Do not paste raw provider payloads into public PRs, issues, Discussions, or release notes.

## Project conventions

- Keep provider-specific behavior out of `packages/core`.
- Prefer pure functions for rules, parsers, and scoring.
- Keep JSON outputs machine-readable first; Markdown and HTML are derived views.
- Add fixtures for every non-trivial rule change.

## Labels and milestones

This repo uses:

- `kind:*` for work type
- `area:*` for subsystem
- `priority:*` for urgency
- `good first issue`
- `help wanted`

Milestones:

- `v0.1-audit`
- `v0.2-eval`
- `v0.3-connectors`
