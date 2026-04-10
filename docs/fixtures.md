# Fixtures

Fixtures are first-class test inputs.

## Fixture goals

- make rule behavior reproducible
- cover both healthy and broken sites
- keep regression tests readable

## Current fixture set

- `static-good`: healthy product site with strong coverage
- `js-heavy`: thin text, script-heavy pages, weak structure
- `blocked-site`: robots and indexing blockers
- `missing-evidence`: coverage gaps and weak evidence

## Adding a fixture

- keep it small
- include `robots.txt`
- include `sitemap.xml` when relevant
- prefer simple HTML over generated output

