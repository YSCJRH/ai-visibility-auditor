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

The fixture currently scores `78/100`. It is crawlable and has broad page coverage, but AnswerLens still flags thin key pages, missing homepage JSON-LD, and pricing evidence gaps. That is the point of the fixture: even a "pretty good" product site can still lack the source material AI systems need to cite and compare it.

## Share safely

Use `share-summary.md` or `pr-snippet.md` when posting examples. Avoid sharing raw provider payloads, private analytics, or claims that imply guaranteed rankings.
