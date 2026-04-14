# Evidence Density

Evidence density describes how much concrete, citable support a page gives to the claims it wants AI systems to repeat.

Thin pages can be crawlable and still be poor source material. AnswerLens flags evidence gaps so teams can add the details that grounded answers need.

## Strong evidence looks like

- Pricing details, plan qualifiers, ranges, packaging notes, or examples
- Security controls, compliance claims, architecture notes, and customer-facing trust answers
- Docs pages with implementation steps and version-aware details
- Comparison criteria that name alternatives and explain fit
- Use-case pages with audience, workflow, outcomes, and proof

## Weak evidence looks like

- Generic positioning with no facts
- Claims that appear only in images or JavaScript-heavy components
- FAQ pages with vague answers
- Compare pages with no decision criteria
- Trust pages that say "secure" without explaining why

## First supported signals

AnswerLens now records bounded evidence signals for key proof pages:

- numbers, tables, and lists
- pricing or packaging terms
- trust markers such as SSO, encryption, SOC 2, and audit logs
- freshness and version markers
- comparison criteria
- workflow, docs, and outcome terms

The audit scores density by page type instead of treating page existence as enough. Pricing, security, docs, compare, and use-case pages can be flagged when they lack the proof blocks that answer systems need to cite.

Evidence density is still a source-material check, not a promise that any AI answer surface will rank or cite the page.
