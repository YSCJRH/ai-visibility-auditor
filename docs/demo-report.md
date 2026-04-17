# Demo Report

The canonical live demo report lives at:

- [https://yscjrh.github.io/ai-visibility-auditor/examples/static-good/index.html](https://yscjrh.github.io/ai-visibility-auditor/examples/static-good/index.html)

If GitHub Pages has not been activated yet, use the repo-local walkthrough below and the generated files in `runs/static-good`.

Run the local fixture demo to generate the same shareable AnswerLens report locally:

```bash
corepack pnpm demo:fixture
```

The report is written to `runs/static-good`.

## What to open first

- `share-summary.md`: fastest human-readable overview
- `scorecard.md`: readiness score, buckets, top issues, and page inventory
- `recommendations.md`: prioritized fixes
- `pr-snippet.md`: copy-ready GitHub block
- `index.html`: static report for browser review
- `run.json`: machine-readable run metadata

This is the same artifact order used by the README funnel and the real-site quickstart: `share-summary.md`, then `scorecard.md`, then `recommendations.md`.

## Example conclusion

The fixture currently scores `90/100`. It is crawlable, has broad page coverage, field-level schema signals, and contextual proof-page linking. AnswerLens still flags thin key pages because the sample keeps many sections intentionally compact. That is the point of the fixture: even a strong product site can still leave extraction quality on the table if core pages stay too shallow.

## Share safely

Use `share-summary.md` or `pr-snippet.md` when posting examples. Avoid sharing raw provider payloads, private analytics, or claims that imply guaranteed rankings.
