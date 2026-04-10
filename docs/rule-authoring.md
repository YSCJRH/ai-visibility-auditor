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

