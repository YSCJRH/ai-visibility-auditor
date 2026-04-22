# Quickstart: Run A Real-Site Audit In 5 Minutes

This is the bridge between the fixture demo and the GitHub Action.

Use it when you already understand the sample report and want one real AnswerLens run against your own public site before you wire CI.

If you have not opened the live demo report or run the fixture demo yet, do that first. This guide assumes the artifact order already makes sense and only changes the target from the public fixture to your own site.

## What you need

- a public site URL
- Node `>=22.0.0`
- a local checkout of this repository
- no provider API keys for a basic `audit` run
- provider API keys only if you want to run `eval`

## Step 1: install the local workspace

```bash
corepack enable
corepack pnpm install
```

## Step 2: copy the starter config shape

Use the external starter bundle in [../examples/consumer-repo](../examples/consumer-repo) as the source of truth and copy these files into your own working folder:

If you want the same layout explained on a public page first, open [starter-bundle.md](starter-bundle.md) or the live Pages view at [yscjrh.github.io/ai-visibility-auditor/starter/](https://yscjrh.github.io/ai-visibility-auditor/starter/).

```text
.github/
  answerlens/
    brand.yaml
    competitors.yaml
    prompts.yaml
    runtime.yaml
```

If you are only evaluating AnswerLens locally, it is fine to create that folder inside this checkout.

If you are preparing long-term adoption, use the same folder shape inside the repository you eventually want to audit in CI.

## Step 3: replace the placeholders

- change the brand name, domain, and proof-page hints in `brand.yaml`
- optionally set `site_display_name` in `brand.yaml` if you want public-facing reports to show a friendly label instead of the raw URL or local path
- update `competitors.yaml` so it reflects your real category
- rewrite `prompts.yaml` to match your buyers, comparisons, and citation questions
- if you plan to run `eval`, set the default provider, model, locale, and timeout in `runtime.yaml`

Do not keep the example product, competitor list, or prompt pack for a real audit.
Do not put API keys into `runtime.yaml`; keep them in environment variables. See [model-runtime.md](model-runtime.md) for the full precedence rules.

## Step 4: run one real audit

```bash
corepack pnpm audit -- https://www.example.com \
  --brand ./.github/answerlens/brand.yaml \
  --competitors ./.github/answerlens/competitors.yaml \
  --prompts ./.github/answerlens/prompts.yaml \
  --out ./runs/answerlens-real-site
```

That command keeps the workflow in the same CLI shape used by the reusable GitHub Action.

If you want to run one live eval after the audit is readable, keep the same folder shape and let the CLI read `runtime.yaml` from the same directory as `brand.yaml`:

```bash
OPENAI_API_KEY=... corepack pnpm eval -- https://www.example.com \
  --brand ./.github/answerlens/brand.yaml \
  --competitors ./.github/answerlens/competitors.yaml \
  --prompts ./.github/answerlens/prompts.yaml \
  --out ./runs/answerlens-real-site-eval
```

If you want the recommended first-run shortcut without editing individual overrides, use:

- `--profile fast-first-eval` for a low-friction first benchmark pass
- `--profile high-confidence-review` only when you are running a smaller, messaging-sensitive re-check
- `--profile perplexity-cross-check` only after you already have one readable OpenAI baseline and want a search-shaped second opinion

Use explicit flags only when you want a temporary override. The full decision tree lives in [model-runtime.md](model-runtime.md).

## Step 5: open the artifacts in order

Start with these files:

1. `share-summary.md`
2. `scorecard.md`
3. `recommendations.md`

Then use:

- `pr-snippet.md` when you want a copy-ready GitHub block
- `index.html` when you want a browser-friendly report
- `run.json` when you want machine-readable run metadata

## What to look for

- Can someone new to the project understand the top issue from `share-summary.md` without opening raw JSON?
- Does `scorecard.md` make the readiness tradeoff legible enough to discuss with a teammate?
- Do `recommendations.md` and `pr-snippet.md` feel reviewable, not just generic "AI SEO" advice?

## Next step: move the same path into CI

Once the local run feels useful, continue to [docs/github-action.md](github-action.md) and keep the same `.github/answerlens/` folder shape plus the same artifact review order.

The GitHub Action should feel like the same artifact contract on a schedule or pull request, not a different product surface.

If this is your first real-site run, open a [GitHub Discussion](https://github.com/YSCJRH/ai-visibility-auditor/discussions) and tell us which artifact helped first.
