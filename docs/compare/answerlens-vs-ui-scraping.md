# AnswerLens vs Consumer UI Scraping

Some visibility tools collect answers by scraping consumer AI interfaces. AnswerLens does not take that path.

## Why AnswerLens avoids consumer UI scraping

- Consumer interfaces can change without stable contracts
- Terms, privacy, and reproducibility risks are harder to reason about
- Outputs can encourage rank-style claims that overstate certainty
- Debugging becomes opaque when the data source is not stable

## What AnswerLens does instead

- Uses provider adapters with normalized contracts
- Supports manual import for human-collected or external answer samples
- Keeps raw payloads separate from shareable summaries
- Scores prompt results with explainable metrics such as accurate mentions, citations, misrepresentations, and VAVR

## Tradeoff

This approach is less sensational than "see your ChatGPT rank," but it is more aligned with engineering workflows, reproducibility, and public open-source credibility.
