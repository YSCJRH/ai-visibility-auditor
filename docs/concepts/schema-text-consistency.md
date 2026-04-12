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

## Roadmap

Schema-text consistency is the primary focus of issue `#9`, alongside evidence density. The first implementation should keep field-level JSON-LD signals for `FAQPage`, `Organization`, and `SoftwareApplication` or `Product`.
