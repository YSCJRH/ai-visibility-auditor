# Codex Plugin

AnswerLens ships a small Codex plugin for maintainers who want Codex to preserve the project narrative while editing public docs, reports, starter bundles, and release surfaces.

The plugin is not a new audit engine. It does not add consumer AI UI scraping, ranking guarantees, answer-placement checks, or dashboard-first workflows.

## What It Adds

- `answerlens-activation`: keeps the live demo, fixture demo, real-site quickstart, GitHub Action, first-run story, and self-dogfood loop aligned.
- `answerlens-adopter-kit`: keeps the starter bundle copyable for external repositories.
- `answerlens-claim-guardrails`: reviews public claims, npm install copy, secret boundaries, raw payload exposure, and artifact reading order.
- `scripts/public-guardrail-check.ps1`: runs the minimum public-surface check from a local AnswerLens checkout.

## Repository Install Path

The repo-local marketplace lives at:

```text
.agents/plugins/marketplace.json
```

The plugin files live at:

```text
plugins/answerlens-codex/
```

Codex plugin installation is a local developer action. Publishing this repository release makes the plugin files reviewable and copyable, but it does not install the plugin into another maintainer's Codex environment automatically.

## Use It For

- release and README truth-sync
- starter bundle adoption reviews
- share-summary and PR snippet reviews
- self-dogfooding log updates
- public claim and trust boundary checks

## Boundaries

- Basic `audit` still needs no provider key.
- Optional `eval` remains BYOK.
- Secrets stay in environment variables or GitHub secrets, not `runtime.yaml`.
- Readiness and VAVR are diagnostic signals, not platform rankings.
- Public summaries and default GitHub artifacts should not expose raw provider payloads.
