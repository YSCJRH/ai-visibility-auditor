# Governance

AnswerLens is currently maintained with a lightweight maintainer model.

## Roles

- Maintainer: sets roadmap priorities, reviews changes, manages releases
- Contributor: submits issues, fixes, docs, fixtures, and provider improvements

## Decision model

- Small changes are decided in PR review.
- Larger API, scoring, and roadmap changes should be discussed in GitHub Discussions or an issue before implementation.
- The maintainer makes the final call when tradeoffs remain unresolved.

## Commit and review expectations

- `main` should stay releasable.
- Changes to `packages/core`, `packages/providers`, `packages/report`, `docs`, and `.github` should receive owner review once `CODEOWNERS` is fully wired to a real GitHub handle.

## Repository settings to enable on GitHub

See [docs/github-bootstrap.md](/D:/SEO/docs/github-bootstrap.md) for the expected Discussions categories, ruleset settings, milestones, and labels.

