# GitHub-Native Growth Plan

AnswerLens should behave like a GitHub-native product entry point, not just a source repository.

This document defines how the project should package itself for more stars, more forks, and more real first-run users without drifting into dashboard sprawl, consumer UI scraping, or ranking promises.

## One-line definition

AnswerLens is a CLI-first, GitHub-native AI visibility auditor for product websites. It helps product teams understand why AI systems miss, flatten, or misread their site, then writes reproducible artifacts they can review in GitHub.

## Primary and secondary audience

Primary audience:

- technical founders, developer marketers, and product-minded engineers at SaaS or developer-tool companies who already live in GitHub and can act on report artifacts

Secondary audience:

- growth, PMM, or technical SEO collaborators who can champion adoption internally once the output looks reviewable and credible

Why this split:

- the primary audience is the most likely to star, fork, and try the repo directly
- the secondary audience is the most likely to amplify, share, and route the tool into a team workflow

## Canonical home and entry hierarchy

Canonical home:

- the GitHub repository README

Supporting surfaces:

- GitHub Pages for proof and artifact walkthroughs
- Releases as the second public front door
- GitHub Action as the adoption surface for teams

Entry hierarchy:

1. primary entry: open the live demo report
2. secondary entry: run the 60-second fixture demo
3. secondary entry: add the GitHub Action
4. bridge step: run a 5-minute real-site audit before wiring CI

## Funnel design

The public funnel should stay sequential:

1. live demo report for discovery, understanding, and trust
2. fixture demo for the first successful local run
3. real-site audit for moving from example to own-site proof
4. GitHub Action for team adoption and repeated use

Every step should tell the visitor to open artifacts in the same order:

1. `share-summary.md`
2. `scorecard.md`
3. `recommendations.md`

## Trust and evidence layer

README first screen should prioritize:

- brand
- one-line definition
- one clear boundary statement
- one core output visual
- one artifact excerpt or proof statement

Detailed evidence belongs on second-level surfaces:

- live demo walkthrough
- full artifact examples
- methodology and scoring notes
- limits and guardrails
- share-summary, pr-snippet, and run.json explanation

The project should always show limits alongside proof:

- no consumer AI UI scraping
- no ranking guarantees
- no dashboard-first rewrite

## Community routing

Use GitHub Discussions for low-friction first contact:

- `Q&A` for first-run questions
- `Ideas` for open-ended direction
- `Show and tell` for screenshots, artifacts, or first-run stories
- `Announcements` for release and roadmap updates

Use GitHub Issues for structured, actionable work:

- reproducible bugs
- docs gaps
- rule proposals
- concrete feature requests

The lowest-friction feedback ask should be:

- tell us which artifact helped first

## Metrics ladder

Track growth as a ladder, not as stars alone:

1. views and referrers
2. clones, release downloads, and demo intent
3. first successful trial signals
4. stars and forks
5. discussions and issues
6. adoption signals

Interpretation:

- views and referrers show discovery quality
- clones and downloads show real interest
- trial signals show whether people can actually use the repo
- stars and forks show memory and intent to reuse
- discussions and issues show relationship depth
- adoption signals show repeated value

## 30-day rollout

### P0

Goal:

- make the README a clear one-primary-two-secondary public entry point

Focus:

- tighten first-screen messaging
- demote the real-site audit from equal CTA to bridge step
- document community routing and manual GitHub settings

Expected impact:

- faster understanding
- higher demo click-through
- better first-run completion

### P1

Goal:

- make starter bundle, quickstart, Pages, releases, and Action docs tell the same story

Focus:

- treat the starter bundle as a reusable growth asset
- keep Pages and releases subordinate to the README funnel
- split proof between first-screen proof and second-level evidence

Expected impact:

- more forks
- better adoption handoff from local trial to CI

### P2

Goal:

- turn community and metrics into a repeatable growth loop

Focus:

- capture first-run feedback in Discussions
- extract FAQ material from recurring questions
- review whether GitHub Action should become a larger standalone distribution surface

Expected impact:

- more structured feedback
- stronger retention
- better evidence for future packaging decisions
