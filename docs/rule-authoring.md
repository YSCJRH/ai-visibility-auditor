# Rule Authoring

Audit rules should be deterministic by default.

## Add a new rule when

- the signal can be derived from page structure or site metadata
- the expected fix is actionable
- the rule can be backed by a reproducible fixture

## Avoid adding a rule when

- it depends on one provider's answer style
- it needs broad subjective interpretation
- it duplicates an existing recommendation without improving precision

## Rule checklist

- choose a stable category
- assign a severity that matches user impact
- write a concise message
- include a concrete fix hint
- add a positive and negative fixture case
- register the rule through `packages/core/src/rules/` instead of appending more logic to `audit.ts`
- if the rule depends on internal links, back it with fixtures that exercise URL, anchor text, and source context together

## Preferred categories

- `crawlability`
- `indexability`
- `structure`
- `schema`
- `positioning`
- `evidence`
- `comparison`
- `coverage`
- `accessibility`
