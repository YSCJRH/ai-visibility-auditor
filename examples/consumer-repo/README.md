# Consumer Repo Starter

Copy this example into the repository that will run AnswerLens.

The example uses a consumer-repo layout instead of this repository's internal `examples/acme/*` files:

```text
.github/
  answerlens/
    brand.yaml
    competitors.yaml
    prompts.yaml
  workflows/
    answerlens.yml
```

After copying it:

1. Replace `Example Product` with your brand and domain.
2. Update the competitor list to match your category.
3. Rewrite the prompt pack so it reflects your buyers, proof pages, and comparison questions.
4. Set `site:` in the workflow to the public URL you want to audit.

The starter bundle is intentionally minimal. It exists to make the public GitHub Action path copyable and reviewable.

If you want one local run before CI, start with [../../docs/quickstart.md](../../docs/quickstart.md) and then move the same `.github/answerlens/` folder into the target repository workflow.
