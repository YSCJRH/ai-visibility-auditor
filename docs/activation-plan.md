# Activation Plan

AnswerLens has enough product surface to be useful today. The activation and adoption hardening workstream shipped through `v0.3.3`, with `v0.3.4` tightening the self-dogfood crawler, locale, and starter-pin follow-through and `v0.3.5` realigning release assets with the post-deploy Pages polish; the ongoing work is to keep that path honest, repeatable, and easy to copy without expanding the product boundary.

This document is the canonical repo entry for that workstream. The detailed working brief lives in [../trans.md](../trans.md).
The GitHub-native growth practice for that workstream lives in [github-growth-plan.md](github-growth-plan.md).
The self-dogfooding loop for that workstream lives in [self-dogfooding.md](self-dogfooding.md).
The public trust boundary lives in [trust-and-safety.md](trust-and-safety.md), the first-run sharing template lives in [first-run-story.md](first-run-story.md), and the self-dogfooding evidence trail lives in [self-dogfood-log.md](self-dogfood-log.md).

## Current operating focus

1. `truth-sync`: keep README, roadmap, release surfaces, and GitHub metadata aligned with the actual published state
2. `activation`: keep the live demo as the primary entry, make the fixture demo and GitHub Action the two secondary entry points, and use the 5-minute real-site audit as the bridge into adoption
3. `hardening`: codify repo rules, fix distribution drift, and verify that external adopters can copy the documented path
4. `self-dogfooding`: use AnswerLens on its own Pages, demo, docs, and release-facing surfaces to improve clarity, proof, structure, and conversion over time

Completed umbrella issue: [#33](https://github.com/YSCJRH/ai-visibility-auditor/issues/33) records the `v0.3.3` activation/adoption hardening pass. Future work should open focused issues only when there is a concrete repo-editable gap.

## What this workstream should change

- README first-run experience
- GitHub Action adoption docs and starter examples
- Pages, release, and install narrative
- Real-site quickstart and first-run artifact order
- Self-dogfooding rules for the README, Pages, release, and docs surfaces
- GitHub-native packaging, community routing, and public proof surfaces
- Trust/safety, first-run story, and self-dogfood log surfaces
- Repo governance docs such as `AGENTS.md`
- Public status alignment across roadmap, releases, milestones, and manual steps

## What this workstream should not change

- Core scoring model or benchmark philosophy
- Provider coverage as a near-term priority
- Consumer AI UI scraping behavior
- Dashboard-style product expansion

## Success conditions

- A new visitor can understand what AnswerLens is, why it matters, and where to click first within a few seconds
- README stays the canonical home while Pages and releases support it as proof and distribution surfaces
- The real-site quickstart bridges local trial and CI adoption without changing the public non-goals
- The GitHub Action path reads like an external adopter workflow rather than an internal dogfood-only workflow
- Self-dogfooding stays focused on public source-material quality rather than platform ranking claims
- Pages, release, README, and manual setup docs all describe the same public surface
- Manual settings for GitHub Pages, homepage, social preview, topics, and npm publish remain explicit
