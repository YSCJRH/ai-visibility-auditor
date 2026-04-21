# AnswerLens Admin

Internal control surface for AnswerLens.

This app stays intentionally narrow:

- single-team internal admin, not a public SaaS surface
- a thin BFF over repo presets and `runs/*` artifacts
- three primary pages: runs, run detail, presets
- a launcher for `audit` and `eval`

## Local usage

```bash
corepack pnpm install
corepack pnpm --dir apps/admin dev
```

The client runs on `http://127.0.0.1:4173` and proxies `/api/*` to the local BFF on `http://127.0.0.1:4318`.
