# Activation truth-sync checklist

## Remote truth to verify first

- latest GitHub release tag and release body
- current active umbrella issue
- open issue count and whether any legacy roadmap issue was reopened
- milestone state only if the task touches roadmap history

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

## Common drift cases

- README says one release state while roadmap or release notes say another
- release notes point at a closed umbrella issue
- Pages entry points differ from README entry points
- manual steps imply a repo edit for something that still requires GitHub settings
- action docs lag behind starter bundle paths or workflow major versions
