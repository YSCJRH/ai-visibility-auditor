# Admin Console

AnswerLens ships an internal control console in `apps/admin`.

This is not a new public front door and it is not a dashboard-first rewrite. It is a thin internal layer over the same repo-native workflow that already powers the CLI, local runs, and GitHub Action artifacts.

![AnswerLens admin runs workspace preview](../assets/admin-console-preview.svg)

## What it is for

- launch a local `audit` or `eval` without rebuilding command lines by hand
- inspect completed runs from `runs/*`
- review artifacts in the same order we use elsewhere: `share-summary.md`, `scorecard.md`, `recommendations.md`
- browse repo presets without editing YAML in the browser
- see the default eval provider/model/runtime path before launching an eval run

## What it is not

- not a public SaaS product
- not a multi-user dashboard
- not a replacement for the CLI, Pages, or GitHub-native adoption flow
- not the canonical home for AnswerLens

The canonical home remains the GitHub repository README. The admin console is an internal operator surface.

## Quick start

From the repository root:

```bash
corepack pnpm install
corepack pnpm demo:fixture
corepack pnpm admin:dev
```

Then open:

- `http://127.0.0.1:4173/runs` for the client
- `http://127.0.0.1:4318/api/health` for the BFF health check
- `http://127.0.0.1:4318/review` for the server-rendered fallback review lane

Run `corepack pnpm demo:fixture` only when you need a known local run in `runs/*` for review. If the workspace already contains the runs you want to inspect, keep them.

If you want to preview the production bundle instead of the Vite client:

```bash
corepack pnpm build:admin
node --experimental-strip-types apps/admin/server/index.ts
```

Then open `http://127.0.0.1:4318/runs`.

## Route map

### SPA routes

- `/runs`
  The default workspace. Use it to scan recent runs, scores, and run kinds.
- `/runs/:runId`
  The artifact review page. Open `share-summary.md` first, then `scorecard.md`, then `recommendations.md`.
- `/presets`
  A read-only view of repo-native config sources such as `./.github/answerlens` and `examples/consumer-repo`.

### Review fallback routes

- `/review`
  Redirects into the localized server-rendered review lane.
- `/review/runs`
  A no-SPA runs review page over the same file-backed workspace.
- `/review/runs/:runId`
  A no-SPA run detail page that still shows artifact order, manifest context, and top issues from `site-audit.json`.

### Supporting API routes

- `/api/health`
  Confirms that the local BFF is alive.
- `/api/runs/:runId/artifacts/:artifactName`
  The raw artifact endpoint behind the run detail viewer, preview actions, and HTML iframe.

## Diagnostics hooks

The admin shell already ships lightweight browser diagnostics in `apps/admin/index.html` and `apps/admin/src/main.tsx`.

- `window.__ANSWERLENS_ADMIN_READY`
  Must flip to `true` after the SPA mounts.
- `window.__ANSWERLENS_ADMIN_DIAGNOSTICS`
  Collects browser-visible failures.
- `#answerlens-admin-diagnostics`
  The fixed debug panel that appears when a failure is reported.

These hooks report four current blocker classes:

- `boot-timeout`
- `resource-error`
- `runtime-error`
- `unhandled-rejection`

If any of them fire during review, treat the redesign as failed until the route is stable again.

## Visual Audit Lane

Use [docs/admin-console-visual-audit.md](./admin-console-visual-audit.md) as the redesign review lane.

That lane keeps visual checks anchored to what the admin surface already supports today:

- review the SPA on `/runs`, `/runs/:runId`, and `/presets`
- review the server-rendered fallback on `/review/runs` and `/review/runs/:runId`
- keep the artifact order fixed as `share-summary.md -> scorecard.md -> recommendations.md`
- fail the review if the diagnostics panel appears or the fallback route stops being usable

The goal is not to approve a new dashboard pattern. The goal is to verify that a redesign still behaves like the same internal, file-backed control surface.

## Launcher flow

1. Click `Launch run`
2. Pick a preset source
3. Set a site input
4. Choose `audit` or `eval`
5. For `eval`, confirm the preset's `runtime.yaml` defaults and only override them directly when you want a temporary change
6. If you want a recommended bundle of temporary overrides, choose a `profile` alias such as `fast-first-eval`, `self-dogfood-stability`, or `high-confidence-review`
7. Wait for the queued job to finish
8. Land in the run detail page for artifact review

The console writes the same file-backed outputs into `runs/*`. It does not invent a second artifact format.
For `eval`, the launcher reads `runtime.yaml` next to `brand.yaml`, keeps secrets in environment variables, and uses explicit form inputs only as temporary overrides. See [model-runtime.md](model-runtime.md) for the full precedence rules.

## Package boundaries

- `apps/admin`
  React + Vite client plus the thin Express BFF
- `packages/contracts`
  Browser-safe run, artifact, preset, and job shapes
- `packages/admin-runtime`
  File-system-backed preset discovery, run listing, artifact reading, and queued run orchestration
- `packages/runtime-config`
  Shared `runtime.yaml` loader and eval default resolution

The admin BFF reuses core AnswerLens logic through `packages/core`, `packages/providers`, and `packages/report`. It does not shell out to a second CLI path for normal `audit` and `eval` launches.

## Verification

- `corepack pnpm demo:fixture`
- `corepack pnpm test`
- `corepack pnpm typecheck`
- `corepack pnpm build:site`
- `corepack pnpm pack:cli:dry-run`
- `corepack pnpm --dir apps/admin build`

## Why it exists

The public AnswerLens story stays CLI-first and GitHub-native. The admin console exists so maintainers can orchestrate runs, inspect artifacts, and iterate on internal workflows without turning the project into a dashboard-led product.
