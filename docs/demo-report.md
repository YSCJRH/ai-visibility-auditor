# Demo Report

The canonical live demo report lives at:

- [https://yscjrh.github.io/ai-visibility-auditor/examples/static-good/index.html](https://yscjrh.github.io/ai-visibility-auditor/examples/static-good/index.html)

If you are browsing a copy or fork without GitHub Pages enabled, use the repo-local walkthrough below and the generated files in `runs/static-good`.

Run the local fixture demo to generate the same shareable AnswerLens report locally:

```bash
corepack pnpm demo:fixture
```

The report is written to `runs/static-good`.

The fixture pages use `https://fixture.local` as a stable hostname inside the demo artifact set. That hostname exists to keep the example crawl reproducible; it is not the AnswerLens product site URL.

## What to open first

1. `share-summary.md`: fastest human-readable overview
2. `scorecard.md`: readiness score, buckets, top issues, and page inventory
3. `recommendations.md`: prioritized fixes

Then use:

- `pr-snippet.md`: copy-ready GitHub block
- `index.html`: static report for browser review
- `run.json`: machine-readable run metadata

This is the same artifact order used by the README funnel and the real-site quickstart: `share-summary.md`, then `scorecard.md`, then `recommendations.md`.

## What to do next

1. If you have not reproduced the report locally yet, run `corepack pnpm demo:fixture`.
2. When the artifact order makes sense, continue to [docs/quickstart.md](quickstart.md) for one real-site run against your own public site.
3. Only after one useful local real-site run, move the same `.github/answerlens/` folder shape into [docs/github-action.md](github-action.md).

## Example conclusion

The fixture currently scores `90/100`. It is crawlable, has broad page coverage, field-level schema signals, and contextual proof-page linking. AnswerLens still flags thin key pages because the sample keeps many sections intentionally compact. That is the point of the fixture: even a strong product site can still leave extraction quality on the table if core pages stay too shallow.

## Share safely

Use `share-summary.md` or `pr-snippet.md` when posting examples. Avoid sharing raw provider payloads, private analytics, or claims that imply guaranteed rankings.

Use [trust-and-safety.md](trust-and-safety.md) before posting a result outside your team.

If the fixture report helped you understand AnswerLens, use the [first-run story template](first-run-story.md) and tell us which artifact clicked first in the [Show and tell Discussion form](https://github.com/YSCJRH/ai-visibility-auditor/discussions/new?category=show-and-tell).
