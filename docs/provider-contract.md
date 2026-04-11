# Provider Contract

Provider adapters belong in `packages/providers`.

## Goals

- keep external API shapes out of core logic
- normalize citations and answer metadata into a stable internal contract
- persist raw payloads for review
- keep `eval` provider-agnostic once a response is normalized

## Normalized output

Every provider response should return:

- `provider`
- `model`
- `promptId`
- `answerText`
- `citations[]`
- `searchResults[]`
- `rawPayload`
- `requestedAt`
- `locale`
- `sampleIndex`
- `runCount`
- `holdout`
- `rankPosition`

Each citation should include:

- `url`
- `domain`
- `title` when available
- `owned`
- `trusted`

## Runtime expectations

- `openai` is a live adapter
- `perplexity` is a live adapter
- `manual` is reserved for normalized imported responses
- raw payloads are written to `runs/<name>/raw/<provider>/<promptId>.json`
- provider-specific parsing belongs in adapters, not the core scorer

## Rules

- Do not put provider-specific parsing in the scorer.
- Do not hide raw responses.
- Do not fail silently on unknown response shapes.
- Do not require changes to `packages/core` when adding a new provider that already fits the contract.
