# AnswerLens Admin

Internal control surface for AnswerLens.

This app stays intentionally narrow:

- single-team internal admin, not a public SaaS surface
- a thin BFF over repo presets and `runs/*` artifacts
- three primary pages: runs, run detail, presets
- a launcher for `audit` and `eval`

![AnswerLens admin runs workspace preview](../../assets/admin-console-preview.svg)

## Local usage

```bash
corepack pnpm install
corepack pnpm admin:dev
```

The client runs on `http://127.0.0.1:4173` and proxies `/api/*` to the local BFF on `http://127.0.0.1:4318`.

For a production-style local preview:

```bash
corepack pnpm build:admin
node --experimental-strip-types apps/admin/server/index.ts
```

Then open `http://127.0.0.1:4318/runs`.

## Review flow

The console keeps the same artifact order as the rest of AnswerLens:

1. `share-summary.md`
2. `scorecard.md`
3. `recommendations.md`

Use `/runs` as the default workspace, `/runs/:runId` for artifact review, and `/presets` to inspect repo-native config sources.

See [docs/admin-console.md](../../docs/admin-console.md) for the fuller operator guide and package boundaries.
