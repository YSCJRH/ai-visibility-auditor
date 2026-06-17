## Summary

- What changed?
- Why now?

## Config or output impact

- Does this change config schema, scoring, or output files?

## Testing

- [ ] `pnpm test`
- [ ] `pnpm typecheck`
- [ ] `pnpm demo:fixture`
- [ ] `pnpm public:check` if this changes README, docs, Pages, Action, starter bundle, release copy, PR summaries, or public examples.

## Evidence

- Screenshot, report artifact, or sample diff
- If this changes audit output, paste the relevant `pr-snippet.md` block or link the uploaded AnswerLens artifact.
- Review generated artifacts in order: `share-summary.md`, then `scorecard.md`, then `recommendations.md`.
- Do not paste raw provider payloads from `raw/**` into public PRs.

## Public claim guardrails

- [ ] No consumer AI UI scraping is presented as a product capability.
- [ ] No ranking, traffic, or answer-surface placement guarantee is added.
- [ ] Readiness, VAVR, and CPS are described as diagnostic signals, not platform rankings.
- [ ] No fake proof, unauthorized adoption claim, customer proof, star count, download count, or growth percentage is added.
- [ ] No `npm install @answerlens/cli` copy is added unless the public npm package is visible.
- [ ] Secrets remain in environment variables or GitHub secrets, not `runtime.yaml`, docs, starter configs, or public summaries.

## AnswerLens share summary

<!-- Optional: paste runs/<name>/pr-snippet.md here when this PR changes docs, site structure, report output, or scoring. -->

## Linked issue

Closes #
