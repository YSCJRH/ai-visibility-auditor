# Schema-Text Consistency

Schema-text consistency means structured data should agree with the visible text that users and crawlers can read.

AnswerLens prioritizes this because structured data alone is not enough. If JSON-LD says one thing and the page copy says another, AI systems can extract conflicting or shallow signals.

## Examples

- `Organization.name` should match the public product or company name on the page
- `SoftwareApplication.description` should reflect the visible product description
- `FAQPage` questions should match visible questions and answers
- Product or pricing claims should not exist only in JSON-LD

## Why it matters

AI systems often combine structured metadata, visible text, citations, and retrieved snippets. Consistency makes the entity easier to describe and reduces the chance of ambiguous summaries.

## First supported signals

AnswerLens keeps a bounded field-level summary for `FAQPage`, `Organization`, `SoftwareApplication`, and `Product` JSON-LD records.

The audit checks whether supported `name`, `description`, `category`, FAQ question, and FAQ answer fields are reinforced by visible page text. It reports mismatches as source-material issues in the existing audit outputs.

This is not a ranking promise. It is an explainable consistency check that helps teams keep structured data and visible evidence aligned.
