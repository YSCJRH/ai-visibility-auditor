# Starter Bundle

The starter bundle is the public, external-repo-friendly AnswerLens adoption asset.

Use it after the live demo report, the 60-second fixture demo, and one useful real-site run from [quickstart.md](quickstart.md).

## Copy this layout into the repository you want to audit

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

## What each file does

- `brand.yaml`: product name, domain, proof-page hints, and optional `site_display_name`
- `competitors.yaml`: declared comparison set for the category you actually sell into
- `prompts.yaml`: buyer, comparison, and citation questions for your real audience
- `runtime.yaml`: non-secret eval defaults such as provider, model, locale, samples, timeout, and optional base URL
- `answerlens.yml`: the GitHub Action path that runs the same artifact contract in CI, pinned to the current stable Action release

Keep API keys in environment variables or GitHub secrets. Do not put them into `runtime.yaml`.
The current starter workflow uses `YSCJRH/ai-visibility-auditor@v0.3.5`; after a newer release, update that pin only after reviewing the release notes.
For the first live benchmark pass, the recommended temporary shortcut is `fast-first-eval`.

## Adopter kit checklist

Use this as a copyable PR setup kit, not only as an internal fixture:

1. Copy `.github/answerlens/` and `.github/workflows/answerlens.yml` into the repository you want to audit.
2. Replace the example product, domain, competitors, prompts, and workflow `site:` URL before the first real run.
3. Keep non-secret eval defaults in `runtime.yaml`.
4. Put provider keys only in GitHub secrets or local environment variables.
5. Run `workflow_dispatch` or open a small pull request that only introduces the AnswerLens starter files.
6. Review `share-summary.md`, then `scorecard.md`, then `recommendations.md` before you paste `pr-snippet.md`.

## PR review packet

When the first CI run finishes, the useful PR comment is small:

```md
AnswerLens first run:
- Start with `share-summary.md`, then open `scorecard.md`, then `recommendations.md`.
- This PR copies the starter bundle into `.github/answerlens/` and runs the pinned Action.
- Public-safe artifact: `answerlens-report`; `raw/**` is excluded by default.
- Boundary: AnswerLens audits public source material. No consumer AI UI scraping. No ranking or answer-placement guarantee.
```

## Review artifacts in this order

1. `share-summary.md`
2. `scorecard.md`
3. `recommendations.md`

Then use `pr-snippet.md` for GitHub copy and `run.json` for machine-readable metadata.

The starter workflow uploads the report bundle while excluding `raw/**` by default. Do not attach `raw/**` to public pull requests, issues, releases, or Discussions. That keeps `eval` and `manual-import` raw provider payloads out of public artifacts unless a team deliberately creates a private debug path.

## What this is for

- external repositories that want a copyable `.github/answerlens/` shape
- release notes or docs that need a stable starter-bundle reference
- teams that want the GitHub Action to feel like the CI version of the same local workflow

## What to do next

1. Run one real-site audit with [quickstart.md](quickstart.md) if you have not done that yet.
2. Copy the starter files from [`examples/consumer-repo`](../examples/consumer-repo).
3. Move into [github-action.md](github-action.md) when the local run already feels reviewable.

If you want the full model precedence rules in one place, use [model-runtime.md](model-runtime.md).
