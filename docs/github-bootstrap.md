# GitHub Bootstrap Notes

Some parts of the operating model must be enabled on the GitHub side after this local repo is pushed.

## Discussions

Enable GitHub Discussions and create:

- `Q&A`
- `Ideas`
- `Show and tell`
- `Announcements`

Keep one onboarding discussion pinned:

- `Start here: share your first AnswerLens run`

Use `Announcements` for maintainer dogfood notes and self-audit snapshots.

## Ruleset for `main`

Recommended rules:

- require pull requests
- require passing CI checks
- block force pushes
- require linear history if the team prefers squash merges
- recommend signed commits

## Labels

Sync the labels from [`.github/labels.yml`](../.github/labels.yml).

## Milestones

Historical milestones already used in this repository:

- `v0.1-audit`
- `v0.2-eval`
- `v0.3-connectors`

These can stay as the release-history spine. The current follow-through should use the activation umbrella issue instead of creating another milestone too early:

- `#33` activation and adoption hardening

## Issue batching

For the current activation phase, keep coordination lightweight:

- use milestones as the release spine
- use `kind:*`, `area:*`, and `priority:*` labels for triage
- split roadmap work into small issues instead of building a separate GitHub Project
- keep `#33` open while activation and adoption hardening remains the active workstream
- keep the active activation PR linked from the current umbrella issue until the repo has more parallel contributors
- treat [docs/roadmap.md](roadmap.md) as the canonical public roadmap
- treat [docs/activation-plan.md](activation-plan.md) as the canonical activation brief
- treat [docs/shareable-summary.md](shareable-summary.md) as the canonical share-output contract
- treat the repository README as the canonical home and the GitHub Pages site as the proof surface
- treat repo-local skills under [`.agents/skills/`](../.agents/skills/) as the stable place for repeated activation maintenance workflows once they stop changing week to week

## Feedback routing

Use Discussions when a user is still orienting:

- `Q&A` for first-run questions
- `Show and tell` for screenshots, artifacts, and first-run stories
- `Ideas` for open-ended product direction

Use Issues when the work is actionable and specific:

- reproducible bugs
- docs gaps
- rule proposals
- concrete feature requests

Keep [`.github/ISSUE_TEMPLATE/config.yml`](../.github/ISSUE_TEMPLATE/config.yml) aligned with this routing.

## Self-dogfooding notes

When public packaging changes because AnswerLens was used on its own Pages, demo, or docs surfaces:

- summarize one clarity, proof, structure, or conversion improvement in release notes
- post the fuller explanation in `Announcements`
- keep the README proof section and the self-dogfooding doc aligned with that language

## Code owners

The repository now includes [`.github/CODEOWNERS`](../.github/CODEOWNERS). Keep it synced with the actual maintainer handles before the first public launch.

## Release settings

- enable automated release notes
- publish release notes that link back to [docs/roadmap.md](roadmap.md)
- keep npm publishing wording aligned with the actual trusted publishing / `NPM_TOKEN` decision tree
- add artifact attestations after releases become routine
