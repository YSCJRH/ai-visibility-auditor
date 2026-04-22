# Admin Redesign Visual Audit

This lane is the merge gate for admin console redesign work.

It stays tied to the routes, diagnostics hooks, and file-backed artifacts that already exist today. It does not introduce a second artifact format, a second review workflow, or a dashboard-first product story.

## Source of truth

The current review lane is anchored to these existing files:

- `apps/admin/src/app/App.tsx` for the SPA routes
- `apps/admin/index.html` and `apps/admin/src/main.tsx` for browser readiness and diagnostics hooks
- `apps/admin/server/index.ts` for `/review/*`, `/api/health`, and artifact-serving routes
- `packages/admin-runtime/src/index.ts` for preset discovery, run listing, run detail loading, and artifact order

## Setup

From the repository root:

```bash
corepack pnpm install
corepack pnpm demo:fixture
corepack pnpm admin:dev
```

Open these URLs during review:

- `http://127.0.0.1:4173/runs`
- `http://127.0.0.1:4173/presets`
- `http://127.0.0.1:4318/api/health`
- `http://127.0.0.1:4318/review`

If you need to review the production-style bundle instead of the Vite client:

```bash
corepack pnpm build:admin
node --experimental-strip-types apps/admin/server/index.ts
```

Then open `http://127.0.0.1:4318/runs` and `http://127.0.0.1:4318/review`.

Use `corepack pnpm demo:fixture` only to seed a known run when `runs/*` is empty or stale for visual review.

## Visual review workflow

1. Start from `/runs` and confirm the shell still reads as an internal control surface, not a new public front door.
2. Use the newest useful run as the entry point instead of scanning the whole workspace equally.
3. Open `/runs/:runId` and review artifacts in the fixed order: `share-summary.md`, then `scorecard.md`, then `recommendations.md`.
4. Only after the primary artifact pass, use raw JSON, the HTML report, download actions, or preview actions.
5. Open `/presets` and confirm the preset ladder still explains the fixture demo, repo self-dogfooding, and consumer-repo starter paths.
6. Open `/review` and confirm it redirects into the localized server-rendered review lane.
7. Review `/review/runs` and `/review/runs/:runId` to make sure the same run workspace and detail story remain inspectable without depending on the SPA.
8. Keep the diagnostics hooks visible while you review. Any reported browser failure is a blocker.

## Required routes

- `http://127.0.0.1:4173/runs`
  Primary SPA triage route. Must render the shell, metrics, filters, and either a usable run table or the existing empty or error copy.
- `http://127.0.0.1:4173/runs/:runId`
  Primary SPA detail route. Must render score tiles, top issue and fix context, artifact viewer, manifest context, and bucket or empty-state copy.
- `http://127.0.0.1:4173/presets`
  SPA preset registry. Must render repo-native presets and the file paths they resolve to.
- `http://127.0.0.1:4318/api/health`
  BFF health route. Must return a healthy response before SPA or fallback review is considered valid.
- `http://127.0.0.1:4318/review`
  Must redirect to the localized runs review route.
- `http://127.0.0.1:4318/review/runs`
  Server-rendered fallback for the runs workspace. Must remain usable even when the SPA is still being hardened.
- `http://127.0.0.1:4318/review/runs/:runId`
  Server-rendered fallback for run detail. Must still expose artifact order, manifest context, and top issues.
- `/api/runs/:runId/artifacts/:artifactName`
  Must continue serving the primary artifacts and raw detail artifacts used by preview and open-raw actions.

## Required states

### Global boot and diagnostics

- `window.__ANSWERLENS_ADMIN_READY` becomes `true` within four seconds of load.
- `window.__ANSWERLENS_ADMIN_DIAGNOSTICS` stays empty after the page settles.
- No visible `#answerlens-admin-diagnostics` panel remains on screen.
- No `boot-timeout`, `resource-error`, `runtime-error`, or `unhandled-rejection` messages appear.

### `/runs`

- loading state
- error state
- empty state
- populated state
- filtered populated state for `all`, `audit`, and `eval`

### Run launcher

- idle dialog state
- queued or running job state
- completed state that redirects into `/runs/:runId`
- failed state that keeps the dialog usable and shows the error

### `/runs/:runId`

- loading state
- error state
- populated detail state
- bucket-empty fallback when no score buckets are available
- issue and recommendation fallback copy when those artifacts are absent

### Artifact viewer

- Markdown render for primary `.md` artifacts
- HTML iframe render for `index.html`
- raw and preview actions that still resolve through `/api/runs/:runId/artifacts/:artifactName`
- locale-aware preference for `.zh.md` and `index.zh.html` when those files exist

### `/presets`

- loading state
- error state
- populated registry state

### `/review/*`

- redirect from `/review`
- populated `/review/runs`
- populated `/review/runs/:runId`

When a redesign changes one of these states directly, force that state before merge and review it on purpose. Do not assume the default happy path is enough.

## Acceptance criteria

- The admin shell still reads as an internal operator surface for AnswerLens, not as a public SaaS or dashboard-first rewrite.
- The primary workflow still runs through `/runs`, then `/runs/:runId`, then the three primary artifacts in order.
- The artifact-first order remains visible in the shell, detail copy, artifact viewer, and server-rendered fallback: `share-summary.md -> scorecard.md -> recommendations.md`.
- `/runs/:runId` still exposes the current run signal through top issue, top fix, run manifest fields, and bucket summaries instead of hiding the contract behind visuals alone.
- `/presets` still explains the same repo-native adoption ladder: fixture demo, AnswerLens repo preset, and consumer-repo starter preset.
- The fallback review lane under `/review/*` remains usable if the SPA is unavailable or still hardening.
- The redesign keeps the existing launcher outcome intact: a completed launch lands in run detail rather than in a detached success screen.
- The surface remains readable at one desktop width and one narrow viewport width because both the SPA and the fallback shell already ship responsive layouts.

## Merge-gate rules

Block the redesign from merge if any of the following is true:

- Any required route is blank, broken, misrouted, or visually unusable.
- The diagnostics hooks report `boot-timeout`, `resource-error`, `runtime-error`, or `unhandled-rejection`.
- The `#answerlens-admin-diagnostics` panel appears at any point during settled-page review.
- `/review/runs` or `/review/runs/:runId` no longer works as a same-data fallback when the SPA is unavailable.
- The fixed review path is reordered, hidden, or replaced by preview-first behavior.
- The run detail route stops exposing artifact-backed context such as run id, site input, base URL, artifact version, rule version, top issues, or recommendations.
- The launcher no longer reaches a completed run detail view after a successful job.
- A redesign depends on app-only visual polish while weakening the file-backed artifact workflow already used elsewhere in AnswerLens.

Do not waive these gates for visual polish alone. If the redesign makes the surface prettier but less reviewable, the lane should fail.
