# Badges

Badges should reinforce AnswerLens as CI for AI discoverability without implying rankings or answer-surface guarantees.

## Recommended static badge

Use this when a repository has run AnswerLens and wants to show the workflow exists:

```md
[![AI discoverability audited with AnswerLens](https://img.shields.io/badge/AI%20discoverability-audited%20with%20AnswerLens-0b1f33)](https://github.com/YSCJRH/ai-visibility-auditor)
```

Rendered label:

[![AI discoverability audited with AnswerLens](https://img.shields.io/badge/AI%20discoverability-audited%20with%20AnswerLens-0b1f33)](https://github.com/YSCJRH/ai-visibility-auditor)

## Workflow badge

If a repo runs AnswerLens in GitHub Actions, prefer the workflow badge over a score badge:

```md
[![AnswerLens audit](https://github.com/<owner>/<repo>/actions/workflows/answerlens.yml/badge.svg)](https://github.com/<owner>/<repo>/actions/workflows/answerlens.yml)
```

## Score badges

Score badges are intentionally not first-class yet. They are easy to misread as answer rankings. If a project creates one from `share-summary.json`, use readiness language:

- Good: `AI discoverability readiness: 90/100`
- Good: `AnswerLens audited`
- Avoid: `AI search rank`
- Avoid: `ChatGPT visibility`
- Avoid: `rank #1`

## Source artifact

Use `share-summary.json` as the source for future badge generators. It includes the run mode, readiness score, VAVR when available, optional manual-rank validation metrics, and guardrail text.
