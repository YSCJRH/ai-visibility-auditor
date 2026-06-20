# Search Console Validation Import

AnswerLens treats Search Console as an external validation layer, not as a replacement for audit or eval.

## What the first version does

- imports page-level Search Console CSV exports
- matches imported pages against crawled audit pages
- highlights key pages that still lack search evidence
- highlights search-visible pages that still carry audit blockers

## Required columns

The first version expects page-level CSV exports with these columns:

- `page`
- `clicks`
- `impressions`
- `ctr`
- `position`

Additional columns are ignored.

## Matching rules

- protocol differences are normalized during matching
- `www.` host differences are normalized during matching
- trailing slashes are normalized during matching
- URL fragments are ignored
- out-of-scope domains are preserved in `search-console-pages.json` and counted separately

## Outputs

`search-console-import` writes:

- `search-console-summary.json`
- `search-console-summary.md`
- `search-console-pages.json`

It also writes the normal audit baseline artifacts, including `share-summary.*`, `scorecard.md`, `recommendations.md`, `site-audit.json`, and `run.json`.

## Non-goals

- no OAuth or live Search Console API in the first version
- no query-level, country-level, or device-level scoring
- no dashboard surface
- no answer-surface ranking guarantees
- no replacement for analytics or Search Console itself

## Fixture and CI strategy

- CI should validate the importer with repo fixtures and temporary malformed CSV samples
- the canonical happy-path fixtures live under `examples/fixtures/search-console/`
- live credentials are not required for the contract or regression suite
