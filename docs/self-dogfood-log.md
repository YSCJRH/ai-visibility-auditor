# Self-Dogfood Log

This log records public source-material improvement loops for AnswerLens itself.

It is not a traffic report, ranking report, answer-surface placement report, or adoption claim. It only records what public surface was audited, which artifacts were reviewed, and what repo-editable source material changed.

## Log Format

Each entry should include:

- date
- audited surface
- command or workflow
- artifact path or public artifact link
- artifacts reviewed in order
- source-material change made
- things not claimed
- follow-up

## Entries

### 2026-06-10: Pages Redirect and Locale Signal Follow-Up

- Audited surface: GitHub Pages public source-material surface at `https://yscjrh.github.io/ai-visibility-auditor/`.
- Command or workflow: `corepack pnpm self-dogfood:pages`.
- Artifact path or public artifact link: `runs/self-dogfood-pages/share-summary.md` from the local run generated on 2026-06-10 after the crawler and i18n signal follow-up.
- Artifacts reviewed in order: `share-summary.md`, then `scorecard.md`, then `recommendations.md`.
- Snapshot before Pages redeploy: readiness `98/100`, VAVR pending eval, crawled pages `19`, missing page types `none`.
- Top observed issues: the live English homepage still needs the visible category wording already queued in the Pages generator; the remaining structure issue is expected to be rechecked after deployment.
- Source-material or tool change made: updated the crawler to follow same-site HTML meta-refresh redirect shims, treat localized project-site home paths such as `/en/` and `/zh/` as homepage records, count CJK body text as extractable content, recognize Chinese proof-page anchors and context, and let compare coverage read page metadata beyond the body snippet. The Pages generator now repeats the exact product category in the English hero.
- Things not claimed: no ranking lift, no traffic lift, no answer-surface placement, no external adoption proof, and no npm registry activation.
- Follow-up: after the branch is deployed to Pages, rerun `corepack pnpm self-dogfood:pages` and record the post-deploy category-signal result here.

### 2026-06-10: Activation Loop Scaffold

- Audited surface: GitHub Pages public source-material surface at `https://yscjrh.github.io/ai-visibility-auditor/`.
- Command or workflow: `corepack pnpm self-dogfood:pages`.
- Artifact path or public artifact link: `runs/self-dogfood-pages/share-summary.md` from the local run generated on 2026-06-10.
- Artifacts reviewed in order: `share-summary.md`, then `scorecard.md`, then `recommendations.md`.
- Snapshot: readiness `61/100`, VAVR pending eval, missing page types `none`.
- Top observed issues: thin key page on `/zh/pricing`, page fetch failed on `/zh/faq`, and low evidence density on `/zh/use-case/open-source-maintainers`.
- Source-material change made: documented this log, added trust/safety and first-run story surfaces, and strengthened share/starter report routing so future public-surface changes have a repeatable evidence trail after deploy.
- Things not claimed: no ranking lift, no traffic lift, no answer-surface placement, no external adoption proof.
- Follow-up: after deployment, rerun `corepack pnpm self-dogfood:pages` and compare whether the live Pages report reflects the new trust, first-run, and share-routing surfaces.
