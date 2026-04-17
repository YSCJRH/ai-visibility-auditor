# Activation Plan

AnswerLens has enough product surface to be useful today. The next workstream is not net-new capability expansion; it is activation and adoption hardening.

This document is the canonical repo entry for that workstream. The detailed working brief lives in [../trans.md](../trans.md).

## Current operating focus

1. `truth-sync`: keep README, roadmap, release surfaces, and GitHub metadata aligned with the actual published state
2. `activation`: turn the live demo, 60-second fixture demo, 5-minute real-site audit, and GitHub Action into one sequential public funnel
3. `hardening`: codify repo rules, fix distribution drift, and verify that external adopters can copy the documented path

Current umbrella issue: [#33](https://github.com/YSCJRH/ai-visibility-auditor/issues/33)

## What this workstream should change

- README first-run experience
- GitHub Action adoption docs and starter examples
- Pages, release, and install narrative
- Real-site quickstart and first-run artifact order
- Repo governance docs such as `AGENTS.md`
- Public status alignment across roadmap, releases, milestones, and manual steps

## What this workstream should not change

- Core scoring model or benchmark philosophy
- Provider coverage as a near-term priority
- Consumer AI UI scraping behavior
- Dashboard-style product expansion

## Success conditions

- A new visitor can understand what AnswerLens is, why it matters, and where to click first within a few seconds
- The real-site quickstart bridges local trial and CI adoption without changing the public non-goals
- The GitHub Action path reads like an external adopter workflow rather than an internal dogfood-only workflow
- Pages, release, README, and manual setup docs all describe the same public surface
- Manual settings for GitHub Pages, homepage, social preview, topics, and npm publish remain explicit
