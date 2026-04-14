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

The fixture currently scores `85/100`. It is crawlable, has broad page coverage, and now includes field-level schema signals, but AnswerLens still flags thin key pages and weak internal links to proof pages. That is the point of the fixture: even a "pretty good" product site can still lack enough source material and page-to-page support for AI systems to cite and compare it confidently.

## Share safely

Use `share-summary.md` or `pr-snippet.md` when posting examples. Avoid sharing raw provider payloads, private analytics, or claims that imply guaranteed rankings.
