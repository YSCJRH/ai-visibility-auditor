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
2. Optionally set `site_display_name` in `.github/answerlens/brand.yaml` if you want public artifacts to show a friendly label instead of the raw URL or local path.
3. Update the competitor list to match your category.
4. Rewrite the prompt pack so it reflects your buyers, proof pages, and comparison questions.
5. Set `site:` in the workflow to the public URL you want to audit.

The starter bundle is intentionally minimal. It exists to make the public GitHub Action path copyable, forkable, and easy to reference from README and release docs.

If you want one local run before CI, start with [../../docs/quickstart.md](../../docs/quickstart.md) and then move the same `.github/answerlens/` folder into the target repository workflow.
