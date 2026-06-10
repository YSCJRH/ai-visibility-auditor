# SEO Phase 2 Plan

This document records the AnswerLens SEO / adoption hardening pass that turns public metadata, security boundaries, and governance wording into checked contracts.

Status note: this is a historical phase record from the `v0.3.2` hardening pass. Current release truth lives in [roadmap.md](roadmap.md), [distribution-plan.md](distribution-plan.md), and the latest GitHub release notes.

## Current State

- Repository state at intake: `main...origin/main`, clean tracked worktree.
- Package and CLI version at intake: `0.3.2`.
- Live GitHub release at intake: `v0.3.2`, published `2026-04-21T12:31:25Z`.
- Current report artifact/schema version: `artifactVersion: 0.3.0`; this is the report output contract, not the package release tag.
- Current npm state: `npm view @answerlens/cli` returns 404, so npm install copy must not be promoted as the primary install path.
- Next release posture: keep npm publishing skipped; use GitHub release assets and Pages until trusted publishing or `NPM_TOKEN` is configured and the registry package is visible.
- Current public funnel: live demo -> local fixture demo -> 5-minute real-site audit -> GitHub Action -> release assets.
- Remote governance state at intake: issue #33 described post-`v0.3.2` activation, adoption, SEO contract, and public-governance hardening.

## Subagent Summary

- SEO Explorer found high-confidence metadata gaps: localized `x-default`, JSON-LD `url` drift, Breadcrumb home drift, report/release version confusion, and project-path `robots.txt` limitations.
- Strategy Designer recommended a small PR focused on `seo:check`, artifact version explanation, Chinese first-run clarity, and release truth-sync.
- Guardrail Reviewer returned `PASS_WITH_LIMITS`: expand existing checks, avoid overclaiming, preserve CLI-first/GitHub-native/report-driven positioning, and keep project-path `robots.txt` separate from host-level robots.

## Adopted Tasks

- Harden Pages SEO metadata generation so canonical, hreflang, `x-default`, JSON-LD `url`, BreadcrumbList, and Open Graph URLs stay aligned.
- Add `public:check` as a dedicated governance/security gate for public claims, runtime secrets, artifact order, copied workflow major versions, npm install claims, and project-path robots wording.
- Refresh release snapshot truth for `v0.3.2` and explain why `artifactVersion: 0.3.0` can coexist with release `v0.3.2`.
- Update remote issue #33 from post-`v0.3.0` activation work to post-`v0.3.2` activation/adoption/governance hardening.
- Clarify runtime precedence and Chinese first-run terms around provider, baseline, workflow pin, and Perplexity as a second opinion.

## Rejected Or Deferred

- Do not add rating, review, `aggregateRating`, `downloadCount`, testimonials, customer logos, or star/download counts without verified visible proof.
- Do not promise Google, ChatGPT, AI Overview, answer-surface, traffic, visibility, or percentage ranking outcomes.
- Do not add consumer AI UI scraping or present scraping as proof.
- Do not make AnswerLens dashboard-first or hosted-monitoring-first.
- Do not add sitemap-level hreflang until HTML hreflang becomes hard to maintain.
- Defer real case studies until there is an authorized, artifact-backed, reproducible site audit.

## Implementation Changes

- `scripts/distribution/build-site.ts`: keep `<head>` metadata out of body-link localization and clarify report schema wording on Pages examples.
- `scripts/distribution/site-seo.ts`: align page JSON-LD `name`, `description`, and `url` with localized page metadata and point BreadcrumbList home items at locale home pages.
- `scripts/distribution/seo-check.ts`: enforce duplicate sitemap/canonical checks, neutral `x-default`, JSON-LD canonical URLs, BreadcrumbList canonical items, FAQPage scope, and `og:url` alignment.
- `scripts/distribution/public-surface-check.ts`: add the new public governance/security check.
- `scripts/distribution/public-surface-check.test.ts`: cover compliant fixtures plus overclaim, fake proof, premature npm install, robots drift, workflow-major drift, runtime-secret, artifact-order, and audit/eval key-boundary failures.
- `package.json`, CI, Pages, and release workflows: wire `public:check` into local scripts and validation; Pages installs workspace dependencies before running the check.
- `AGENTS.md` and repo-local activation/adoption skills: add `public:check` and post-build `seo:check` to the default verification path for public surface, Pages, release, README, and Action adoption changes.
- Docs: update version explanations, runtime precedence, Chinese quickstart/Action terminology, and this phase plan.

## Acceptance Criteria

- `seo:check` fails on duplicate sitemap URLs, duplicate canonicals, localized `x-default`, JSON-LD URL drift, Breadcrumb current-page drift, and FAQPage schema outside the visible FAQ page.
- `public:check` fails on positive ranking promises, fake proof fields or claims, consumer UI scraping when it is not clearly framed as a non-goal, npm install promotion before registry visibility, project-path robots host-level claims, runtime secrets, artifact order drift, or copied workflow major drift.
- Pages still generate bilingual localized routes, sitemap, feed, robots, JSON-LD, demo reports, starter pages, and release pages.
- Basic `audit` remains documented as no-key; `eval` remains BYOK.
- Remote GitHub issue #33 update remains separated from repo-editable source changes but is recorded in this plan.

## Follow-Up

- For the next merge/release pass, keep npm publish disabled/skipped and verify the release workflow summary says npm was skipped.
- Create a real case-study template only after a reproducible public audit exists and the site owner permits publication.
- Consider turning this workflow into a repo-local skill after it has repeated successfully across another release or Pages hardening pass.

## Commands

Run during implementation:

- `corepack pnpm public:check` - passed
- `corepack pnpm install --frozen-lockfile` - passed; lockfile remains unchanged
- `corepack pnpm test` - passed, including `public-surface-check` and `seo-check` contract tests
- `corepack pnpm typecheck` - passed
- `corepack pnpm demo:fixture` - passed
- `corepack pnpm build:site` - passed
- `corepack pnpm seo:check` - passed after aligning localized FAQ JSON-LD with visible FAQ copy
- `corepack pnpm pack:cli:dry-run` - passed
- `gh issue edit 33 --repo YSCJRH/ai-visibility-auditor --body ...` - passed; issue now follows post-`v0.3.2` activation/adoption/governance hardening
- `git diff --stat` - inspected expected source, docs, workflow, and check-script changes
- `git diff` - inspected implementation diff
