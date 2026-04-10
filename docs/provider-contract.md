# Provider Contract

Provider adapters belong in `packages/providers`.

## Goals

- keep external API shapes out of core logic
- normalize citations and answer metadata into a stable internal contract
- persist raw payloads for review

## Normalized output

Every provider should return:

- `provider`
- `model`
- `promptId`
- `answerText`
- `citations[]`
- `searchResults[]`
- `rawPayload`
- `requestedAt`

Each citation should include:

- `url`
- `domain`
- `title` when available
- `owned`
- `trusted`

## Rules

- Do not put provider-specific parsing in the scorer.
- Do not hide raw responses.
- Do not fail silently on unknown response shapes.

