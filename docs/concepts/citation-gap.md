# Citation Gap

A citation gap appears when an answer can mention a brand accurately but lacks an owned or trusted source to cite.

This matters because AI-mediated discovery is stronger when claims can be grounded in source pages rather than inferred from thin or third-party material.

## Common causes

- Pricing pages lack concrete plan details or qualifiers
- Security pages describe trust vaguely instead of naming controls
- Docs pages are too thin to support implementation claims
- Comparison pages do not mention alternatives or decision criteria
- FAQ pages answer buyer questions visibly but lack consistent structure

## AnswerLens artifacts

Eval and manual-import runs produce:

- `citation-gap-matrix.json` for machine-readable prompt-level gaps
- `citation-gap-matrix.md` for human review
- `eval-summary.md` and `eval-summary.json` for rollup metrics
- `share-summary.md` for a compact GitHub-friendly summary

## Guardrail

A citation gap is not a ranking failure. It is a source-material gap: the site may need more explicit, citable evidence.
