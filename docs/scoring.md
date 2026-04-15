# Scoring

AnswerLens keeps the public scoring model intentionally explainable.

## Public-facing view

- North star: `VAVR`
- Site readiness subscores:
  - Access
  - Structure
  - Entity Clarity
  - Evidence
  - Comparative Readiness

## Current behavior

`audit` computes the five readiness subscores and an overall score.

`eval` and `manual-import` add answer-layer metrics on top of the audit baseline:

- `mentionRate`
- `accurateMentionRate`
- `ownedCitationRate`
- `trustedCitationRate`
- `recommendationRate`
- `misrepresentationRate`
- `competitorExclusionGap`
- `factCoverageScore`
- `accuracyRate`
- `VAVR`
- `competitivePositionScore` for ranked `manual-import` runs
- `rankCoverageRate` for showing how much of the benchmark pack had reviewed rank data

Holdout prompts are stored in the same run output but are excluded from the primary benchmark summary.

## `VAVR`

`VAVR` is the verified visibility rate for the active prompt pack.

A prompt contributes to `VAVR` only when the answer both:

- mentions the brand accurately enough to pass the accuracy threshold
- includes at least one owned or trusted citation

## `CPS`

`CPS` is the competitive position score for reviewed rank inputs.

It currently comes from `manual-import` or other auditable normalized responses, not from consumer UI scraping.

Non-manual `eval` runs must keep `rankPosition` as `null`; the scorer rejects non-null rank data outside `manual-import`.

The mapping is intentionally simple:

- rank `1` -> `1.00`
- rank `2` -> `0.75`
- rank `3` -> `0.50`
- rank `4` -> `0.25`
- rank `5+` -> `0.00`

AnswerLens reports `competitivePositionScore` alongside `VAVR` when ranked manual inputs are available.

`rankCoverageRate` shows what percentage of non-holdout samples included a valid `rankPosition`.

These fields do not imply an official platform ranking and do not change the headline `VAVR` in `v0.2.3`.

## Output contract

- `scorecard.md` is the human-readable audit summary
- `recommendations.md` turns audit findings into an actionable backlog
- `share-summary.md` is the compact, shareable human summary for PRs, issues, releases, and job summaries
- `share-summary.json` is the machine-readable share contract for Actions, badges, and downstream tooling
- `pr-snippet.md` is a copy-ready GitHub Markdown block
- `run.json` is the machine-readable run manifest
- `normalized-pages.json` exposes stable page signals for downstream analysis
- `competitor-diff.md` summarizes compare-page coverage against configured competitors
- `eval-summary.md` and `eval-summary.json` summarize answer-layer performance
- `before-after-diff.md` compares the current eval run to the previous run in the same output directory
- `citation-gap-matrix.json` and `citation-gap-matrix.md` show prompts where accurate mentions lack owned or trusted citations

## Penalties and stability

- `error`: high-confidence blocker, large penalty
- `warn`: meaningful issue, moderate penalty
- `info`: useful nudge, small penalty
- eval metrics are computed from normalized provider responses, not raw provider-specific payloads
- repeated samples are grouped by prompt before benchmark-level rates are summarized
- repeated binary signals use majority semantics: `mention`, `accurateMention`, `ownedCitation`, `trustedCitation`, `recommendation`, `misrepresented`, `competitorExcluded`, and `VAVR`
- repeated scalar signals use median semantics: `accuracy`, `factCoverage`, `signalAlignment`, and `competitivePositionScore` when ranked manual samples are present
- `eval-summary.json` and `eval-summary.md` add a stability layer for repeated prompts: `sampleCount`, `stable`, `consensusRate`, `spreadNote`, `stablePromptRate`, and `unstablePromptCount`
- `share-summary.*` may include a one-line stability note when repeated prompts are present, but stability is not promoted to a headline product KPI

## Why this model

- It stays explainable.
- It ties visibility back to verifiable source material.
- It keeps provider-specific parsing out of the scorer.
