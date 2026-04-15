# Bing / IndexNow Helper

AnswerLens treats Bing Webmaster and IndexNow as supporting helper layers, not as replacements for audit or eval.

## What the first version does

- imports page-level Bing Webmaster CSV exports
- matches imported pages against crawled audit pages
- highlights key pages that still lack Bing evidence
- highlights Bing-visible pages that still carry audit blockers
- generates IndexNow candidate artifacts for the current audited site

## Required Bing columns

The Bing import expects page-level CSV exports with these columns:

- `page`
- `clicks`
- `impressions`
- `ctr`
- `position`

Additional columns are ignored.

## IndexNow helper outputs

The first version does not submit live IndexNow requests.

Instead it writes:

- `indexnow-summary.json`
- `indexnow-summary.md`
- `indexnow-candidates.json`

These artifacts show candidate URLs, page types, and the endpoint template needed for later submission.

## Non-goals

- no live Bing Webmaster API
- no live IndexNow submission
- no dashboard surface
- no answer-surface ranking guarantees
- no replacement for analytics, Search Console, or Bing Webmaster itself

## Why this stays lightweight

- Bing evidence complements Search Console, it does not replace it
- IndexNow is a helper workflow, not a scoring surface
- the repo stays CLI-first, self-hostable, and artifact-driven
