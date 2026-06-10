# Adoption sanity checklist

## Public funnel

Check the path in this order:

1. live demo report
2. local fixture demo
3. real-site quickstart
4. GitHub Action adoption
5. release assets

## Files to inspect together

- `README.md`
- `docs/demo-report.md`
- `docs/quickstart.md`
- `docs/github-action.md`
- `examples/consumer-repo/README.md`
- `examples/consumer-repo/.github/workflows/answerlens.yml`
- `action.yml`
- `scripts/distribution/build-site.ts`
- `docs/manual-steps.md`

## What to verify

- each step tells the reader what to do next
- each step tells the reader which artifact to open first
- the starter bundle still matches the docs
- the workflow still references the expected Action version and output paths
- Pages and release entry points echo the same adoption story as README

## Common failure modes

- quickstart and Action docs drift to different folder shapes
- README changes the funnel but Pages still shows old entry points
- docs mention `pr-snippet.md` before the user has seen `share-summary.md`
- copied workflow versions fall behind the hardened repo defaults
- adoption copy starts promising product capability that the CLI does not actually ship
- public surfaces lose the explicit `audit` no-key / optional `eval` BYOK boundary
- artifact review order changes away from `share-summary.md`, then `scorecard.md`, then `recommendations.md`
- public copy starts promoting `npm install @answerlens/cli` before the registry package is visible
- Action or starter examples upload `raw/**` provider payloads by default
- first-run story routing is missing from README, quickstart, or Discussions-oriented docs
- starter bundle explains files but not where secrets belong or how to keep PR review public-safe
