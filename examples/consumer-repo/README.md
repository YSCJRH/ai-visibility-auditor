# Consumer Repo Starter

Copy this example into the repository that will run AnswerLens.

This starter bundle is step 4 of the public AnswerLens funnel: use it after the live demo, the local fixture demo, and one useful real-site run from [../../docs/quickstart.md](../../docs/quickstart.md).

If you want to share this path with someone before sending them raw repo files, use the public starter overview: [yscjrh.github.io/ai-visibility-auditor/starter/](https://yscjrh.github.io/ai-visibility-auditor/starter/).

The example uses a consumer-repo layout instead of this repository's internal `examples/acme/*` files:

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

After copying it:

1. Replace `Example Product` with your brand and domain.
2. Optionally set `site_display_name` in `.github/answerlens/brand.yaml` if you want public artifacts to show a friendly label instead of the raw URL or local path.
3. Update the competitor list to match your category.
4. Rewrite the prompt pack so it reflects your buyers, proof pages, and comparison questions.
5. If you plan to run `eval`, set the default provider, model, locale, and timeout in `.github/answerlens/runtime.yaml`.
6. Set `site:` in the workflow to the public URL you want to audit.

The starter bundle is intentionally minimal. It exists to make the public GitHub Action path copyable, forkable, and easy to reference from README and release docs.
Keep API keys in GitHub secrets or local environment variables. Do not put them into `runtime.yaml`.
For the first live benchmark pass, the recommended temporary shortcut is `profile: fast-first-eval`.

When the workflow runs, review the generated artifacts in this order:

1. `share-summary.md`
2. `scorecard.md`
3. `recommendations.md`

If you want one local run before CI, start with [../../docs/quickstart.md](../../docs/quickstart.md) and then move the same `.github/answerlens/` folder into the target repository workflow.
