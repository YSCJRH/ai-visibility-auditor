# GitHub Bootstrap Notes

Some parts of the operating model must be enabled on the GitHub side after this local repo is pushed.

## Discussions

Enable GitHub Discussions and create:

- `Q&A`
- `Ideas`
- `Show and tell`
- `Announcements`

## Ruleset for `main`

Recommended rules:

- require pull requests
- require passing CI checks
- block force pushes
- require linear history if the team prefers squash merges
- recommend signed commits

## Labels

Sync the labels from [`.github/labels.yml`](/D:/SEO/.github/labels.yml).

## Milestones

Create:

- `v0.1-audit`
- `v0.2-eval`
- `v0.3-connectors`

## Project

Create one GitHub Project as the single source of truth with views by:

- milestone
- area
- priority
- status

## Code owners

The repository now includes [`.github/CODEOWNERS`](/D:/SEO/.github/CODEOWNERS). Keep it synced with the actual maintainer handles before the first public launch.

## Release settings

- enable automated release notes
- publish source artifacts for `v0.1`
- add npm publishing only after `eval` stabilizes
- add artifact attestations after releases become routine
