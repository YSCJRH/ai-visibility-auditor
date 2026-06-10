# Public Roadmap

`AnswerLens` is the public brand for this repository. The GitHub slug stays `ai-visibility-auditor` for now, but public docs, releases, and issue planning should treat `AnswerLens` as the primary name and `AI visibility auditor for product websites` as the descriptive subtitle.

## Brand and positioning

AnswerLens is a CLI-first AI visibility auditor for product websites.

AnswerLens focuses on explainable structure, evidence, and validation workflows rather than consumer UI scraping.

Non-goals that stay fixed across roadmap stages:

- no consumer AI UI scraping
- no ranking guarantees on answer surfaces
- no dashboard-first rewrite of the product
- no connector work that outruns the core audit and validation story

## Near-term priorities

Recently completed on `main` and released through `v0.3.3`:

- `#9` Schema-text consistency and evidence density rules
- `#10` Internal link context, anchor quality, and rule registry
- `#11` Manual rank import and CPS scoring
- `#12` Multi-sample aggregation stability summary
- `#13` Search Console validation import
- `#14` Bing Webmaster / IndexNow helper
- activation funnel, share-ready artifacts, trust/safety docs, starter bundle hardening, self-dogfood loop, public guardrails, and repo-local Codex plugin workflows

Why `#9` and `#10` came first:

- they address the root causes behind why AI systems miss, flatten, or misrepresent a site
- they strengthen the quality of audit findings without changing the public output contract
- they were more central to product value than adding more providers or connectors first

Why connectors waited until `v0.3.0`:

- validation is broader than connector work alone
- the product needs stronger audit and eval credibility before it layers on search-console style evidence
- Search Console should validate improved readiness and answer quality, not compensate for a shallow audit core

## Version path

### `v0.2.1`

Primary focus: `#9` Schema-text consistency and evidence density rules

Status: implemented on `main`

Planned outcome:

- keep field-level JSON-LD signals for `FAQPage`, `Organization`, and `SoftwareApplication` or `Product`
- compare structured fields against visible text on key pages
- score evidence density on pricing, security, docs, compare, and use-case pages
- surface the new findings through existing outputs such as `issues.json`, `recommendations.md`, and `scorecard.md`

### `v0.2.2`

Primary focus: `#10` Internal link context, anchor quality, and rule registry

Status: implemented on `main`

Planned outcome:

- upgrade internal link signals from bare URLs to records with URL, anchor text, and source context
- detect weak discoverability for FAQ, compare, integrations, and use-case pages
- move audit rules toward a registry-backed structure while keeping the four-package repo layout intact

### `v0.2.3`

Primary focus: `#11` and `#12`

Planned outcome:

- support manual rank-aware imports and CPS-style scoring when rank data exists
- improve repeated-sample summaries with stability-oriented aggregation
- keep `eval-results.json` sample-level detail intact while making summaries more decision-friendly

Current status:

- `#11` is already merged to `main`
- `#12` is already merged to `main`
- `v0.2.3` was released on April 15, 2026

### `v0.3.0`

Primary focus: `#13` and `#14`

Planned outcome:

- add Search Console as the first external validation layer
- add Bing Webmaster and IndexNow helpers as follow-on validation tools
- connect audit and eval outputs to search-facing evidence without introducing consumer UI scraping or rank guarantees

Current status:

- `#13` is implemented on `main` as an import-first, contract-first validation layer
- `#14` is implemented on `main` as an optional Bing validation and IndexNow helper layer
- `v0.3.0` was released on April 15, 2026
- connector follow-through should keep using repo-native artifacts instead of introducing a dashboard path

### `v0.3.1`

Primary focus: activation hardening plus the internal operator surface

Planned outcome:

- add an internal control console in `apps/admin` for local run orchestration and artifact review
- add browser-safe contracts plus an admin runtime layer over `runs/*` and repo-native presets
- provide a review fallback path so maintainers can inspect the admin effect even while the richer SPA surface continues to harden
- keep the public product story CLI-first and GitHub-native instead of turning the project into a public dashboard

Current status:

- the internal admin console foundation is implemented on `main`
- the repo now exposes both the SPA path and a review fallback path for local operator review
- `v0.3.1` was released on April 21, 2026

### `v0.3.2`

Primary focus: bilingual public and operator surfaces

Planned outcome:

- add `/en/` and `/zh/` public Pages routes with visible language switching
- add `README.zh-CN.md` plus `docs/zh/` mirrors for the first-run path and admin guide
- localize human-readable report outputs and admin/review copy while keeping JSON contracts stable in English
- make `compare`, `starter`, and `examples` readable for Chinese visitors without changing the canonical adoption sequence

Current status:

- bilingual public Pages, docs mirrors, localized report outputs, and admin/review switching are implemented on `main`
- `v0.3.2` was released on April 21, 2026

### `v0.3.3`

Primary focus: GitHub-native activation and adoption loop

Planned outcome:

- make the live demo, fixture demo, real-site audit, and GitHub Action adoption path easier to follow
- make `share-summary.md`, `scorecard.md`, and `recommendations.md` work as a shareable evidence packet
- document trust/safety boundaries, first-run story collection, and self-dogfooding loops without implying adoption proof
- add repo-local Codex plugin workflows for maintainers reviewing activation, adopter-kit, and public-claim changes
- strengthen public checks for unsafe claims, fake proof, premature npm install copy, raw payload exposure, runtime secrets, and artifact-order drift

Current status:

- activation, adoption, trust/safety, first-run, self-dogfood, starter, report-summary, public-check, and Codex plugin surfaces are implemented on `main`
- `v0.3.3` was released on June 10, 2026

## GitHub alignment

Current milestone mapping:

- `v0.1-audit`: `#9`, `#10`, and umbrella issue `#1`
- `v0.2-eval`: `#11`, `#12`
- `v0.3-connectors`: `#13`, `#14`, and umbrella issue `#3`

Release planning:

- `v0.2.0` is the launch-hardening release
- work intended for `v0.2.1` is already on `main`
- work intended for `v0.2.2` is already on `main`
- `v0.2.3` is released and closes the current validation-layer work for `#11` and `#12`
- `v0.3.0` is released and ships the connector-focused import and helper layer
- `v0.3.1` is released and adds the internal admin control surface and review fallback
- `v0.3.2` is released and adds bilingual public Pages, docs mirrors, localized report surfaces, and admin/review language switching
- `v0.3.3` is released and adds the GitHub-native activation loop, trust/safety surfaces, starter hardening, public guardrails, and repo-local Codex plugin workflows

This document is the canonical public roadmap. README, release notes, and umbrella issues should link back here instead of restating divergent plans.

Canonical distribution follow-through lives in [docs/distribution-plan.md](distribution-plan.md).

## Current operating focus

With `v0.3.3` released on June 10, 2026, near-term work can move from one-time activation hardening into repeatable adoption proof, release truth-sync, and self-dogfooding follow-through while staying inside the existing product boundary.

- Canonical brief: [docs/activation-plan.md](activation-plan.md)
- Current umbrella issue: [#33](https://github.com/YSCJRH/ai-visibility-auditor/issues/33)
- Detailed working notes: [../trans.md](../trans.md)

## Distribution spine

AnswerLens should dogfood its own outputs as the main growth surface:

- `share-summary.md` is the compact human summary for PRs, issues, releases, and Action summaries
- `share-summary.json` is the stable machine-readable source for badges and downstream report tooling
- `pr-snippet.md` is the copy-ready GitHub block for teams that want to review AI discoverability changes in a pull request

These assets support the public positioning without changing the core non-goals: no consumer UI scraping, no ranking guarantees, and no dashboard-first rewrite.
