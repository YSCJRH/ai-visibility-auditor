# First-Run Story

This template helps a new user share a first AnswerLens run without turning the result into a ranking claim.

Use it after this path:

1. Open the live demo report.
2. Run `corepack pnpm demo:fixture`.
3. Run one real-site audit with [quickstart.md](quickstart.md).
4. Open `share-summary.md`, then `scorecard.md`, then `recommendations.md`.

## Where To Share

Use GitHub Discussions > Show and tell for first-run stories.

Use Issues only for reproducible bugs, docs gaps, false positives, or concrete rule proposals.

## Template

```md
## First AnswerLens run

Site or fixture:

Run type:
- [ ] live demo report
- [ ] fixture demo
- [ ] real-site audit
- [ ] GitHub Action run

The artifact I opened first:
- [ ] share-summary.md
- [ ] scorecard.md
- [ ] recommendations.md
- [ ] pr-snippet.md
- [ ] index.html

What AnswerLens made clearer:

The next artifact I would open:

One page or source-material change I would try next:

Permission to quote or reuse publicly:
- [ ] yes, with these safe links or screenshots only
- [ ] no, keep this as feedback only

What I am not claiming:
- no ranking guarantee
- no answer-surface placement claim
- no traffic lift claim
- no external adoption proof unless I explicitly authorize reuse
- no consumer AI UI scraping

Safe links or screenshots:
```

## What Good Feedback Looks Like

Good first-run feedback is specific and artifact-backed:

- "The share summary helped me explain one missing proof page to a teammate."
- "The scorecard showed that the docs page exists but is weakly linked."
- "The recommendations gave me one page-level fix to try before adding the Action."

Avoid unverified proof:

- no fake users, stars, downloads, or traffic claims
- no "ranked higher in ChatGPT" claims unless there is separately authorized, reviewed evidence
- no private analytics or raw provider payloads
- no public adoption proof unless the author checked an explicit permission-to-quote box and supplied safe links or screenshots

## Maintainer Follow-Up

When a first-run story is useful and authorized, maintainers can turn it into:

- an FAQ entry
- a docs improvement
- a small before/after note
- a self-dogfooding log entry
- a release note pointer

Do not present a first-run story as external adoption proof unless the user explicitly authorized public reuse and the linked evidence is visible.
