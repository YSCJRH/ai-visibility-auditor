# GitHub Action

AnswerLens ships a reusable root Action so teams can keep AI discoverability checks inside GitHub-native workflows instead of rebuilding shell glue in every repository.

Use this page after the live demo report, the fixture demo, and one useful real-site run from [quickstart.md](quickstart.md). If you have not reached that point yet, stop here and use the quickstart first.

For an external repository, start by copying the starter bundle in [examples/consumer-repo](../examples/consumer-repo). The public docs should read from that consumer-repo layout, not from this repository's internal `examples/acme/*` fixtures.

Recommended path:

1. open the live demo report
2. run the fixture demo
3. run one real local audit with [quickstart.md](quickstart.md)
4. move the same artifact contract into the GitHub Action

That ordering matters. The Action is the CI version of a workflow that should already make sense locally.

The public interface is:

- `uses: YSCJRH/ai-visibility-auditor@vX`
- commands: `audit`, `eval`, `manual-import`, `search-console-import`, `bing-indexnow-helper`
- outputs: `out-dir`, `share-summary-path`, `scorecard-path`, `recommendations-path`, `pr-snippet-path`, `run-json-path`

## Recommended external repo layout

```text
.github/
  answerlens/
    brand.yaml
    competitors.yaml
    prompts.yaml
  workflows/
    answerlens.yml
```

Use the starter files in [examples/consumer-repo/.github](../examples/consumer-repo/.github) as a copyable baseline, then replace the placeholder brand, competitors, prompts, and `site:` URL.

If you want the generated Markdown and HTML artifacts to show a friendlier public label than the raw URL or local path, set `brand.site_display_name` in `brand.yaml`.

## Minimal workflow for an external repository

```yaml
name: AnswerLens

on:
  pull_request:
  workflow_dispatch:

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5

      - id: answerlens
        uses: YSCJRH/ai-visibility-auditor@vX
        with:
          command: audit
          site: https://www.example.com
          brand: .github/answerlens/brand.yaml
          competitors: .github/answerlens/competitors.yaml
          prompts: .github/answerlens/prompts.yaml
          out-dir: runs/answerlens

      - name: Publish AnswerLens summary
        shell: bash
        run: |
          cat "${{ steps.answerlens.outputs.share-summary-path }}" >> "$GITHUB_STEP_SUMMARY"
          echo "" >> "$GITHUB_STEP_SUMMARY"
          echo "### Artifact review order" >> "$GITHUB_STEP_SUMMARY"
          echo "1. \`${{ steps.answerlens.outputs.share-summary-path }}\`" >> "$GITHUB_STEP_SUMMARY"
          echo "2. \`${{ steps.answerlens.outputs.scorecard-path }}\`" >> "$GITHUB_STEP_SUMMARY"
          echo "3. \`${{ steps.answerlens.outputs.recommendations-path }}\`" >> "$GITHUB_STEP_SUMMARY"
          echo "" >> "$GITHUB_STEP_SUMMARY"
          echo "### PR-ready snippet" >> "$GITHUB_STEP_SUMMARY"
          cat "${{ steps.answerlens.outputs.pr-snippet-path }}" >> "$GITHUB_STEP_SUMMARY"
          echo "" >> "$GITHUB_STEP_SUMMARY"
          echo "### run.json" >> "$GITHUB_STEP_SUMMARY"
          echo "\`${{ steps.answerlens.outputs.run-json-path }}\`" >> "$GITHUB_STEP_SUMMARY"

      - uses: actions/upload-artifact@v6
        with:
          name: answerlens-report
          path: ${{ steps.answerlens.outputs.out-dir }}
```

## Inputs

Required:

- `command`
- `site`
- `brand`
- `competitors`
- `prompts`

Optional:

- `out-dir` default: `runs/answerlens`
- `provider` for `eval`
- `model`
- `samples`
- `locale`
- `manual-input` for `manual-import`
- `bing-input` for `bing-indexnow-helper`

## Outputs

- `out-dir`: absolute path to the generated run directory
- `share-summary-path`: absolute path to `share-summary.md`
- `scorecard-path`: absolute path to `scorecard.md`
- `recommendations-path`: absolute path to `recommendations.md`
- `pr-snippet-path`: absolute path to `pr-snippet.md`
- `run-json-path`: absolute path to `run.json`

## Starter bundle

- Copy [examples/consumer-repo/.github/answerlens/brand.yaml](../examples/consumer-repo/.github/answerlens/brand.yaml)
- Copy [examples/consumer-repo/.github/answerlens/competitors.yaml](../examples/consumer-repo/.github/answerlens/competitors.yaml)
- Copy [examples/consumer-repo/.github/answerlens/prompts.yaml](../examples/consumer-repo/.github/answerlens/prompts.yaml)
- Copy [examples/consumer-repo/.github/workflows/answerlens.yml](../examples/consumer-repo/.github/workflows/answerlens.yml)

The starter bundle is intentionally generic. Replace the example product, domain, competitor list, and prompt pack before using it on a real site.
Treat it as the shareable adoption asset for forks, releases, and external setup guides.

If you want one last sanity check before CI, run the command path in [quickstart.md](quickstart.md) and confirm that `share-summary.md`, `scorecard.md`, and `recommendations.md` are enough to explain the run to someone else.

## What to publish into `GITHUB_STEP_SUMMARY`

- `share-summary.md` for the human-readable run overview
- `scorecard-path` and `recommendations-path` as the next two review artifacts after the summary
- `pr-snippet.md` for the copy-ready block that can move into PRs or issues
- `run-json-path` as the pointer to the machine-readable manifest

Keep the full `out-dir` uploaded as an artifact so reviewers can open the complete report bundle.

Review artifacts in the same order used everywhere else:

1. `share-summary.md`
2. `scorecard.md`
3. `recommendations.md`

## Dogfood pattern

This repository uses the same root Action via `uses: ./` in its fixture workflow. That keeps the public Action contract exercised on every change instead of leaving it as documentation-only surface area.

## Guardrails

- Do not post raw provider payloads to public PRs.
- Do not call readiness scores rankings.
- Do not imply AnswerLens guarantees answer-surface placement.
- Prefer `share-summary.md` for public summaries and keep full JSON artifacts available for review.

## Runtime note

- The root Action provisions pnpm with Corepack, so external repositories that call `uses: YSCJRH/ai-visibility-auditor@vX` do not need to add `pnpm/action-setup` separately.
- Repository workflows are hardened for the GitHub Actions Node 24 transition.
- Self-hosted runners should stay on a runner version compatible with Node 24-based actions.
- For copied workflows, prefer the same major versions documented in [docs/manual-steps.md](manual-steps.md): `actions/checkout@v5`, `actions/setup-node@v5`, `actions/github-script@v8`, and `actions/upload-artifact@v6`.
