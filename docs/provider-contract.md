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

`rankPosition` is optional and intended for reviewed inputs such as `manual-import`:

- `null` or omitted means no placement data was provided
- positive integers (`1..n`) describe relative position, where `1` is best
- invalid values such as `0`, negatives, decimals, or strings should fail normalization

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
- live providers may keep `rankPosition` as `null` until a reviewed validation source exists
- the core scorer only accepts non-null `rankPosition` during `manual-import` runs
- raw payloads are written to `runs/<name>/raw/<provider>/<promptId>.json`
- provider-specific parsing belongs in adapters, not the core scorer

## Rules

- Do not put provider-specific parsing in the scorer.
- Do not hide raw responses.
- Do not include raw responses in public summaries or default public artifact uploads.
- Do not fail silently on unknown response shapes.
- Do not require changes to `packages/core` when adding a new provider that already fits the contract.
