# GitHub Action

AnswerLens ships a reusable root Action so teams can keep AI discoverability checks inside GitHub-native workflows instead of rebuilding shell glue in every repository.

The public interface is:

- `uses: YSCJRH/ai-visibility-auditor@vX`
- commands: `audit`, `eval`, `manual-import`, `search-console-import`, `bing-indexnow-helper`
- outputs: `out-dir`, `share-summary-path`, `pr-snippet-path`, `run-json-path`

## Minimal workflow

```yaml
name: AnswerLens

on:
  pull_request:
  workflow_dispatch:

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - id: answerlens
        uses: YSCJRH/ai-visibility-auditor@vX
        with:
          command: audit
          site: examples/fixtures/static-good
          brand: examples/acme/brand.yaml
          competitors: examples/acme/competitors.yaml
          prompts: examples/acme/prompts.yaml
          out-dir: runs/static-good

      - name: Publish AnswerLens summary
        run: |
          cat "${{ steps.answerlens.outputs.share-summary-path }}" >> "$GITHUB_STEP_SUMMARY"
          echo "" >> "$GITHUB_STEP_SUMMARY"
          echo "### PR-ready snippet" >> "$GITHUB_STEP_SUMMARY"
          cat "${{ steps.answerlens.outputs.pr-snippet-path }}" >> "$GITHUB_STEP_SUMMARY"

      - uses: actions/upload-artifact@v4
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
- `pr-snippet-path`: absolute path to `pr-snippet.md`
- `run-json-path`: absolute path to `run.json`

## Dogfood pattern

This repository uses the same root Action via `uses: ./` in its fixture workflow. That keeps the public Action contract exercised on every change instead of leaving it as documentation-only surface area.

## Guardrails

- Do not post raw provider payloads to public PRs.
- Do not call readiness scores rankings.
- Do not imply AnswerLens guarantees answer-surface placement.
- Prefer `share-summary.md` for public summaries and keep full JSON artifacts available for review.
