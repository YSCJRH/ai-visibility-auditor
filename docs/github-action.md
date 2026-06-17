# GitHub Action

AnswerLens ships a reusable root Action so teams can keep AI discoverability checks inside GitHub-native workflows instead of rebuilding shell glue in every repository.

Use this page after the live demo report, the fixture demo, and one useful real-site run from [quickstart.md](quickstart.md). If you have not reached that point yet, stop here and use the quickstart first.

For an external repository, start by copying the starter bundle in [examples/consumer-repo](../examples/consumer-repo). The public docs should read from that consumer-repo layout, not from this repository's internal `examples/acme/*` fixtures.

If you want a public walkthrough before you open the raw repo files, start with the live starter-bundle overview on Pages: [yscjrh.github.io/ai-visibility-auditor/starter/](https://yscjrh.github.io/ai-visibility-auditor/starter/).

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
    runtime.yaml
  workflows/
    answerlens.yml
```

Use the starter files in [examples/consumer-repo/.github](../examples/consumer-repo/.github) as a copyable baseline, then replace the placeholder brand, competitors, prompts, and `site:` URL.
The checked-in starter workflow pins the current stable Action release, `YSCJRH/ai-visibility-auditor@v0.3.5`; after a newer release, update that pin only after reviewing the release notes.

If you want the generated Markdown and HTML artifacts to show a friendlier public label than the raw URL or local path, set `brand.site_display_name` in `brand.yaml`.
If you plan to run `eval`, keep the default provider, model, locale, and timeout in `runtime.yaml` next to `brand.yaml`.

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
        uses: YSCJRH/ai-visibility-auditor@v0.3.5
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
          path: |
            ${{ steps.answerlens.outputs.out-dir }}
            !${{ steps.answerlens.outputs.out-dir }}/raw/**
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
- `runtime` for an explicit `runtime.yaml` path
- `profile` for a temporary eval profile alias
- `provider` as an `eval` override
- `model`
- `samples`
- `locale`
- `timeout-ms`
- `base-url`
- `manual-input` for `manual-import`
- `bing-input` for `bing-indexnow-helper`

For `eval`, the Action now follows the same rule as the CLI:

1. explicit Action inputs
2. `profile`
3. `runtime.yaml`
4. provider-specific environment fallbacks
5. adapter defaults

If you do not set `runtime`, AnswerLens tries `runtime.yaml` next to `brand.yaml`.

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
- Copy [examples/consumer-repo/.github/answerlens/runtime.yaml](../examples/consumer-repo/.github/answerlens/runtime.yaml)
- Copy [examples/consumer-repo/.github/workflows/answerlens.yml](../examples/consumer-repo/.github/workflows/answerlens.yml)
- Public overview: [docs/starter-bundle.md](starter-bundle.md) and [Pages starter surface](https://yscjrh.github.io/ai-visibility-auditor/starter/)

The starter bundle is intentionally generic. Replace the example product, domain, competitor list, and prompt pack before using it on a real site.
Treat it as the shareable adoption asset for forks, releases, and external setup guides.
Keep the workflow pinned to a reviewed stable release tag, currently `v0.3.5`, instead of a branch or floating ref.
Keep secrets such as `OPENAI_API_KEY` and `PERPLEXITY_API_KEY` in repository or organization secrets, not in `runtime.yaml`.

If you want the full model decision tree in one place, use [model-runtime.md](model-runtime.md).
If you want a temporary shortcut on top of the starter defaults, use `profile: fast-first-eval` before you start hand-tuning individual inputs.
If you already have one readable OpenAI baseline and want a provider-level second opinion, use `profile: perplexity-cross-check` instead of replacing the starter default permanently.

If you want one last sanity check before CI, run the command path in [quickstart.md](quickstart.md) and confirm that `share-summary.md`, `scorecard.md`, and `recommendations.md` are enough to explain the run to someone else.

## What to publish into `GITHUB_STEP_SUMMARY`

- `share-summary.md` for the human-readable run overview
- `scorecard-path` and `recommendations-path` as the next two review artifacts after the summary
- `pr-snippet.md` for the copy-ready block that can move into PRs or issues
- `run-json-path` as the pointer to the machine-readable manifest

Upload the report bundle for review, but keep `raw/**` excluded from the default artifact. `eval` and `manual-import` runs may write raw provider payloads there for debugging and auditability.

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
- Prefer `share-summary.md` for public summaries and keep non-raw JSON artifacts available for review.
- If a team needs raw payloads for debugging, upload them only through an explicit private workflow or restricted artifact path.

## Runtime note

- The root Action provisions pnpm with Corepack, so external repositories that call a reviewed release tag such as `YSCJRH/ai-visibility-auditor@v0.3.5` do not need to add `pnpm/action-setup` separately.
- Repository workflows are hardened for the GitHub Actions Node 24 transition.
- Self-hosted runners should stay on a runner version compatible with Node 24-based actions.
- For copied workflows, prefer the same major versions documented in [docs/manual-steps.md](manual-steps.md): `actions/checkout@v5`, `actions/setup-node@v5`, `actions/github-script@v8`, and `actions/upload-artifact@v6`.
