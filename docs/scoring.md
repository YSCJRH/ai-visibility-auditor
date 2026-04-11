# Scoring

AnswerLens keeps the public scoring model intentionally explainable.

## Public-facing view

- North star: `VAVR`
- Site readiness subscores:
  - Access
  - Structure
  - Entity Clarity
  - Evidence
  - Comparative Readiness

## Current behavior

`audit` computes the five readiness subscores and an overall score.

`eval` and `manual-import` add answer-layer metrics on top of the audit baseline:

- `mentionRate`
- `accurateMentionRate`
- `ownedCitationRate`
- `trustedCitationRate`
- `recommendationRate`
- `misrepresentationRate`
- `competitorExclusionGap`
- `factCoverageScore`
- `accuracyRate`
- `VAVR`

Holdout prompts are stored in the same run output but are excluded from the primary benchmark summary.

## `VAVR`

`VAVR` is the verified visibility rate for the active prompt pack.

A prompt contributes to `VAVR` only when the answer both:

- mentions the brand accurately enough to pass the accuracy threshold
- includes at least one owned or trusted citation

## Output contract

- `scorecard.md` is the human-readable audit summary
- `recommendations.md` turns audit findings into an actionable backlog
- `run.json` is the machine-readable run manifest
- `normalized-pages.json` exposes stable page signals for downstream analysis
- `competitor-diff.md` summarizes compare-page coverage against configured competitors
- `eval-summary.md` and `eval-summary.json` summarize answer-layer performance
- `before-after-diff.md` compares the current eval run to the previous run in the same output directory
- `citation-gap-matrix.json` and `citation-gap-matrix.md` show prompts where accurate mentions lack owned or trusted citations

## Penalties and stability

- `error`: high-confidence blocker, large penalty
- `warn`: meaningful issue, moderate penalty
- `info`: useful nudge, small penalty
- eval metrics are computed from normalized provider responses, not raw provider-specific payloads
- repeated samples are grouped by prompt before benchmark-level rates are summarized

## Why this model

- It stays explainable.
- It ties visibility back to verifiable source material.
- It keeps provider-specific parsing out of the scorer.
