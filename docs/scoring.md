# Scoring

AnswerLens keeps the public scoring model intentionally simple.

## Public-facing view

- North star: `VAVR`
- Subscores:
  - Access
  - Structure
  - Entity Clarity
  - Evidence
  - Comparative Readiness

## Current behavior

`audit` computes the five readiness subscores and an overall score.

`eval` adds answer-layer metrics on top of the audit baseline:

- mention rate
- owned citation rate
- trusted citation rate
- recommendation rate
- accuracy rate
- `VAVR`

## `VAVR`

`VAVR` is the weighted visibility score for the current prompt pack.

It intentionally favors explainable signals over vanity metrics:

- brand mention
- owned citations
- trusted citations
- recommendation language
- answer accuracy against canonical facts

## Penalties and stability

- `error`: high-confidence blocker, large penalty
- `warn`: meaningful issue, moderate penalty
- `info`: useful nudge, small penalty
- eval metrics are computed from normalized provider responses, not raw provider-specific payloads

## Why this model

- It stays explainable.
- It ties visibility back to verifiable source material.
- It keeps provider-specific parsing out of the scorer.
