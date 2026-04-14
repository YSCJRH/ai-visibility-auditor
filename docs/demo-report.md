# Demo Report

Run the local fixture demo to generate a shareable AnswerLens report:

```bash
corepack pnpm demo:fixture
```

The report is written to `runs/static-good`.

## What to open first

- `share-summary.md`: fastest human-readable overview
- `pr-snippet.md`: copy-ready GitHub block
- `scorecard.md`: readiness score, buckets, top issues, and page inventory
- `recommendations.md`: prioritized fixes
- `index.html`: static report for browser review
- `run.json`: machine-readable run metadata

## Example conclusion

The fixture currently scores `90/100`. It is crawlable, has broad page coverage, field-level schema signals, and contextual proof-page linking. AnswerLens still flags thin key pages because the sample keeps many sections intentionally compact. That is the point of the fixture: even a strong product site can still leave extraction quality on the table if core pages stay too shallow.

## Share safely

Use `share-summary.md` or `pr-snippet.md` when posting examples. Avoid sharing raw provider payloads, private analytics, or claims that imply guaranteed rankings.
