# Activation truth-sync checklist

## Remote truth to verify first

- latest GitHub release tag and release body
- current active or recently completed coordination issue state and body
- open issue count and whether any legacy roadmap issue was reopened
- milestone state only if the task touches roadmap history
- npm registry visibility for `@answerlens/cli` when install or publish copy changes

## Local files to compare

- `README.md`
- `docs/activation-plan.md`
- `docs/roadmap.md`
- `docs/distribution-plan.md`
- `docs/manual-steps.md`
- `docs/github-action.md`
- `docs/github-bootstrap.md`
- `scripts/distribution/releases-snapshot.json`
- `.github/workflows/release-distribution.yml`
- `scripts/distribution/build-site.ts`

## Search patterns

- `rg -n "v0\\.|Current operating focus|#33|quickstart|social-preview|Start here" README.md docs scripts .github`
- `gh api repos/YSCJRH/ai-visibility-auditor/releases/tags/<tag>`
- `gh api repos/YSCJRH/ai-visibility-auditor/issues/<number>`
- `npm view @answerlens/cli version dist-tags --json`

## Common drift cases

- README says one release state while roadmap or release notes say another
- release notes describe a closed umbrella issue as the current follow-through path
- active or recently completed coordination issue body anchors the phase to an older release after a newer stable release becomes latest
- Pages entry points differ from README entry points
- manual steps imply a repo edit for something that still requires GitHub settings
- install copy implies npm is available while the registry still returns `404`
- action docs lag behind starter bundle paths or workflow major versions
- public copy introduces ranking guarantees, fake proof, consumer AI UI scraping, host-level robots claims, or premature npm install copy that `corepack pnpm public:check` should block
- public summaries or default Action artifact uploads expose `raw/**` provider payloads
- first-run story copy implies external adoption proof without visible authorization
- trust/safety copy loses the `audit` no-key and optional `eval` BYOK boundary
- generated Pages metadata drifts across canonical, hreflang, sitemap, Open Graph URL, JSON-LD URL, BreadcrumbList, or FAQPage contracts that `corepack pnpm seo:check` should block
