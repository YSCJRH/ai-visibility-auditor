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

## Public governance checks

Run `pnpm public:check` before merging changes that touch README, docs, Pages source, release snapshots, Action docs, starter workflows, or public workflow files.

The check is intentionally stricter than normal copy review. It should fail when a public surface crosses these boundaries:

- Do not promise rankings, placement, traffic, visibility lift, or percentage outcomes.
- Do not present consumer AI UI scraping as a supported AnswerLens capability.
- Do not add rating, review, testimonial, customer-proof, download-count, or star-count claims without verified visible proof.
- Do not promote `npm install @answerlens/cli` while the registry package is still not visible.
- Do not describe the project-site `robots.txt` as host-level control for `yscjrh.github.io`.
- Keep `runtime.yaml` examples free of API keys, tokens, and secret-like values.
- Keep report review order as `share-summary.md`, then `scorecard.md`, then `recommendations.md`.
- Keep copied workflow major versions aligned with the repository defaults.
- Keep the first-run key boundary explicit: basic `audit` has no provider-key requirement, while optional `eval` is BYOK.

When the check fails, fix the public surface or the copied example first. Only change the rule when the product boundary itself has changed and the README, roadmap, Pages source, Action docs, and release copy can be updated together.

## Labels

Sync the labels from [`.github/labels.yml`](../.github/labels.yml).

## Milestones

Historical milestones already used in this repository:

- `v0.1-audit`
- `v0.2-eval`
- `v0.3-connectors`

These can stay as the release-history spine. The `v0.3.3` activation umbrella issue records the completed activation/adoption hardening pass:

- `#33` activation and adoption hardening

## Issue batching

For post-`v0.3.4` follow-through, keep coordination lightweight:

- use milestones as the release spine
- use `kind:*`, `area:*`, and `priority:*` labels for triage
- split roadmap work into small issues instead of building a separate GitHub Project
- treat `#33` as the completed `v0.3.3` activation/adoption hardening record
- open focused issues only for concrete bugs, docs gaps, workflow drift, or adoption-path evidence that needs repo-editable follow-up
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
- after each semver release, verify `releases/latest`, the release snapshot, README/roadmap status, and any active or recently completed coordination issue all agree
- add artifact attestations after releases become routine
