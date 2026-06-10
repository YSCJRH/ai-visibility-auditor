# Shareable Summary Contract

AnswerLens reports should be easy to paste into GitHub without turning into marketing copy. Every run writes a small share layer next to the full artifacts:

- `share-summary.md` for humans reading a run artifact
- `share-summary.json` for Actions, badges, and downstream tooling
- `pr-snippet.md` for pull requests, issues, and release notes

The share layer exists to support the product promise: CI for AI discoverability. It should summarize evidence, not imply rankings.

## `share-summary.md`

Use this when someone wants to skim a run artifact or include it in a release note.

```md
# AnswerLens Share Summary

> CI for AI discoverability.

Audit whether a product site can be read, cited, compared, and recommended by AI systems.

## Run

- Site: ./examples/fixtures/static-good
- Mode: audit
- Run ID: 00000000-0000-0000-0000-000000000000
- Generated: 2026-04-12T00:00:00.000Z
- Rule version: 2026-04-14

## Metrics

| Metric | Value |
| --- | --- |
| overallScore | 90 |
| vavr | pending eval |

## AI may miss this product because

- **Thin key page** (warn, https://fixture.local/): Add plain-language explanations, evidence blocks, and stronger sections.

## Top fixes

- **Tighten structure and schema alignment on key pages**: Higher extraction quality and fewer ambiguous summaries.

## Next review steps

1. Open `scorecard.md` to verify coverage, checks, and score drivers.
2. Open `recommendations.md` to turn the top gap into a page-level fix.
3. Use `pr-snippet.md` when you want a copy-ready GitHub block.
4. Use the AnswerLens starter bundle when this workflow is ready to move into another repository: https://github.com/YSCJRH/ai-visibility-auditor/blob/main/docs/starter-bundle.md

## Shareable artifacts

- [share-summary.md](share-summary.md)
- [scorecard.md](scorecard.md)
- [recommendations.md](recommendations.md)
- [share-summary.json](share-summary.json)
- [pr-snippet.md](pr-snippet.md)

## Guardrails

AnswerLens does not scrape consumer AI UIs, auto-post content, or guarantee answer-surface rankings.
```

## `share-summary.json`

Use this as the stable input for GitHub Actions summaries, badges, social-card rendering, or future report tooling.

The JSON shape is intentionally small:

```json
{
  "project": "AnswerLens",
  "tagline": "CI for AI discoverability.",
  "run": {
    "id": "00000000-0000-0000-0000-000000000000",
    "mode": "audit",
    "artifactVersion": "0.3.0",
    "ruleVersion": "2026-04-14"
  },
  "metrics": {
    "overallScore": 90,
    "vavr": null
  },
  "topIssues": [],
  "topRecommendations": [],
  "artifacts": ["share-summary.md", "scorecard.md", "recommendations.md", "share-summary.json", "pr-snippet.md", "run.json"]
}
```

Consumers should treat unknown keys as forward-compatible additions.

`artifactVersion` is the report artifact/schema contract version. It is allowed to differ from the current package or GitHub release tag; for example, `artifactVersion: 0.3.0` can be emitted by the `v0.3.2` software release when the report shape has not changed.

For `manual-import` runs with reviewed rank data, `metrics` may also include:

- `competitivePositionScore`
- `rankCoverageRate`

For repeated-sample eval runs, `metrics` may also include:

- `repeatedPromptCount`
- `stablePromptRate`
- `unstablePromptCount`

## `pr-snippet.md`

Use this when a team wants a copy-ready GitHub block:

```md
## AnswerLens audit

**CI for AI discoverability.** Readiness: **90/100**. VAVR: **pending eval**.

### AI may miss this product because

- Thin key page: add plain-language explanations, evidence blocks, and stronger sections.

### Recommended next fixes

- Tighten structure and schema alignment on key pages

<details>
<summary>Artifacts and guardrails</summary>

- Share summary: `share-summary.md`
- Scorecard: `scorecard.md`
- Recommendations: `recommendations.md`
- Machine-readable summary: `share-summary.json`
- Copyable starter: https://github.com/YSCJRH/ai-visibility-auditor/blob/main/docs/starter-bundle.md

AnswerLens does not scrape consumer AI UIs, auto-post content, or guarantee answer-surface rankings.

</details>
```

## Guardrails

- Do not label these outputs as rankings.
- Do not imply AnswerLens can guarantee placement in ChatGPT, Perplexity, Google AI Overviews, or any other answer surface.
- Do not include raw provider payloads in the share layer.
- Keep default summaries short enough to read inside GitHub job summaries.
- Treat `competitivePositionScore` as reviewed comparative validation, not as an official answer-surface rank.
- Treat stability as a credibility note for repeated samples, not as a promise that answer surfaces are controllable.
