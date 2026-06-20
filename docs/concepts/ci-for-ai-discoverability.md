# CI for AI Discoverability

CI for AI discoverability means treating answer-layer readiness like a regression surface.

Instead of asking whether a site "does AI SEO," AnswerLens asks whether a product site still exposes the structure, evidence, and comparison material that AI systems need to read, cite, compare, and recommend it.

## What it checks

- Can key pages be crawled and indexed?
- Do pages expose clear entity, pricing, trust, FAQ, comparison, integration, and use-case signals?
- Do structured fields match visible text?
- Are important proof pages linked with useful anchor text and context?
- Do eval runs show accurate mentions, owned or trusted citations, and stable recommendations?

## Why it belongs in CI

AI discoverability can regress when teams ship docs changes, redesign pages, remove internal links, or move proof content into JavaScript-heavy surfaces. Running AnswerLens in CI turns those changes into a review packet that starts with the forwardable summary:

- `share-summary.md` for job summaries
- `scorecard.md` for readiness
- `recommendations.md` for backlog items
- `pr-snippet.md` for PR review

## Non-goals

CI for AI discoverability is not a ranking guarantee, a consumer AI UI scraper, or a dashboard-first monitoring product. It is an engineering workflow for keeping source material readable and verifiable.
