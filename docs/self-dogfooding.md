# Self-Dogfooding For Discoverability

AnswerLens should use its own audit mindset on its public source-material surfaces.

This is not a claim that AnswerLens can score GitHub platform distribution itself. It is a commitment to keep improving the public materials that explain, prove, and distribute the product.

## Canonical boundaries

Canonical home:

- the GitHub repository README

Canonical audit target:

- the GitHub Pages site and the static public surfaces it mirrors

Priority targets:

1. Pages home and docs index
2. live demo report page
3. release-facing narrative on the Pages release index and release notes
4. quickstart and starter bundle explanation
5. concept and compare pages that explain the product story

Why this boundary exists:

- the README is the primary product entry point
- the Pages site is the most stable, auditable public surface
- dynamic GitHub social signals such as stars, forks, and platform discovery are outcomes, not direct audit inputs

## Self-dogfooding loop

Use this loop for public-surface work:

1. audit the public Pages and demo surfaces
2. read `share-summary.md`, `scorecard.md`, and `recommendations.md`
3. choose only one or two high-leverage fixes
4. update public copy, structure, proof, or routing
5. publish a short public note about what changed and why
6. run the next audit and compare the result

The goal is not automation for its own sake. The goal is to keep producing better public source material over time.

## Loop #1 operating path

The first visible loop should run against the current GitHub Pages site:

```bash
corepack pnpm self-dogfood:pages
```

That command audits `https://yscjrh.github.io/ai-visibility-auditor/` with the repo-owned config in `./.github/answerlens/` and writes artifacts to `runs/self-dogfood-pages`.

Open the artifacts in the same order used everywhere else:

1. `share-summary.md`
2. `scorecard.md`
3. `recommendations.md`

Keep the loop tracked under umbrella issue [#33](https://github.com/YSCJRH/ai-visibility-auditor/issues/33).

## Signal types that are in scope

Only optimize four signal classes:

- **understanding signals**: brand, one-line definition, boundary language, CTA order
- **proof signals**: artifact visibility, output examples, before/after framing, limit statements
- **structure signals**: internal links, proof-page discoverability, static page coverage, entry path continuity
- **conversion signals**: what to click next, what artifact to open first, where to ask for help, where to share a first run

Keep these out of scope:

- consumer AI UI scraping
- ranking promises
- "what rank are we in ChatGPT" framing
- turning GitHub social metrics into an audit score
- dashboard-style growth surfaces

## Self-dogfooding backlog buckets

Use these buckets when triaging self-improvement work:

- `positioning clarity`
- `entry friction`
- `proof density`
- `artifact visibility`
- `starter bundle adoption`
- `community routing`

Default prioritization:

1. first-time understanding
2. first successful trial
3. external citation, reuse, and forkability
4. everything else

Never open a wide cleanup. Pull only one or two items from the backlog per iteration.

## Public asset templates

Turn self-dogfooding work into small public assets:

- **before / after note**
  - example: "We reduced the first screen from four equal entry points to one primary path plus two secondary paths."
- **public dogfood log**
  - example: "We used AnswerLens on our own Pages and demo surfaces, found one proof gap, and changed the public packaging."
- **self-audit snapshot**
  - example: a short `share-summary.md` excerpt or a scorecard change with one sentence of interpretation

Recommended destinations:

- README secondary proof section
- release notes
- Discussions > Announcements

## Measurement order

Judge the loop by downstream GitHub-native signals, not by audit scores alone:

1. Pages and README click flow
2. live demo opens
3. fixture demo and quickstart intent
4. first-run feedback in Discussions
5. starter bundle and fork-related reuse signals
6. star and fork trend changes

AnswerLens generates improvement suggestions. GitHub-native behavior shows whether those suggestions actually improved adoption.

## 30-day rollout

### P0

Goal:

- document the self-dogfooding boundary and backlog

Focus:

- README stays canonical home
- Pages becomes canonical audit target
- backlog buckets and public asset templates become explicit

### P1

Goal:

- complete the first visible self-dogfooding loop

Focus:

- audit Pages, demo, and docs surfaces
- choose one or two high-leverage public-surface fixes
- publish a short public note about what changed

### P2

Goal:

- make the loop repeatable without turning it into noisy automation

Focus:

- repeat the loop on a cadence
- collect reusable case material
- decide later whether any part deserves automation
