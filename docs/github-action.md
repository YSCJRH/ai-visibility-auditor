# GitHub Action Example

AnswerLens works best when the report is visible inside the Git workflow. The default pattern is:

1. Run the fixture or site audit in CI.
2. Upload the full `runs/<name>` directory as an artifact.
3. Append `share-summary.md` to the GitHub job summary.
4. Keep PR comments opt-in to avoid noisy automation.

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
      - uses: pnpm/action-setup@v4
        with:
          version: 10.33.0
          run_install: false
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm demo:fixture
      - name: Publish AnswerLens summary
        run: cat runs/static-good/share-summary.md >> "$GITHUB_STEP_SUMMARY"
      - uses: actions/upload-artifact@v4
        with:
          name: answerlens-report
          path: runs/static-good
```

## PR snippet

When a maintainer wants a concise PR comment, copy `runs/<name>/pr-snippet.md`. Keep it manual or label-triggered until the project needs automated comments.

## Guardrails

- Do not post raw provider payloads to public PRs.
- Do not call readiness scores rankings.
- Do not imply AnswerLens guarantees answer-surface placement.
- Prefer `share-summary.md` for public summaries and keep full JSON artifacts available for review.
