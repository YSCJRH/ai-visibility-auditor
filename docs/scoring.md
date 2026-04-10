# Scoring

AnswerLens keeps the public scoring model intentionally simple.

## Public-facing view

- North star: `VAVR` once `eval` is enabled
- Subscores:
  - Access
  - Structure
  - Entity Clarity
  - Evidence
  - Comparative Readiness

## Current `audit` behavior

`audit` computes the five readiness subscores and an overall score. It does not claim `VAVR`; that value is reserved for the future `eval` pipeline.

## Penalties

- `error`: high-confidence blocker, large penalty
- `warn`: meaningful issue, moderate penalty
- `info`: useful nudge, small penalty

## Why this model

- It stays explainable.
- It keeps the report tied to actionability instead of vanity numbers.
- It leaves room to layer answer-layer metrics later without rewriting the audit model.

