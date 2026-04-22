# Model runtime

AnswerLens keeps non-secret eval defaults in `runtime.yaml`.

That file is the repo-native source of truth for:

- the default live eval provider
- the default model name
- the default eval locale
- the default sample count
- the default provider timeout
- optional non-secret provider base URL overrides

Secrets stay in environment variables. Do not put API keys into `runtime.yaml`.

## Default file location

AnswerLens looks for `runtime.yaml` next to `brand.yaml`.

Typical layout:

```text
.github/
  answerlens/
    brand.yaml
    competitors.yaml
    prompts.yaml
    runtime.yaml
```

Current repo examples:

- `./.github/answerlens/runtime.yaml`
- `./examples/acme/runtime.yaml`
- `./examples/consumer-repo/.github/answerlens/runtime.yaml`

## File shape

```yaml
runtime:
  eval:
    provider: openai
    model: gpt-5
    locale: zh-CN
    samples: 1
    timeout_ms: 60000

  providers:
    openai:
      base_url: https://api.openai.com/v1
    perplexity:
      base_url: https://api.perplexity.ai
```

## What belongs where

Put these in `runtime.yaml`:

- `runtime.eval.provider`
- `runtime.eval.model`
- `runtime.eval.locale`
- `runtime.eval.samples`
- `runtime.eval.timeout_ms`
- `runtime.providers.<name>.base_url`

Keep these in environment variables only:

- `OPENAI_API_KEY`
- `PERPLEXITY_API_KEY`
- any token or secret

Do not put model runtime values back into:

- `brand.yaml`
- `competitors.yaml`
- `prompts.yaml`

## Precedence

For `eval`, AnswerLens resolves values in this order:

1. explicit inputs from CLI flags, GitHub Action inputs, or the admin launcher
2. `runtime.yaml`
3. provider-specific environment fallbacks
4. adapter defaults
5. API keys from environment variables only

Provider-specific environment fallbacks remain:

- OpenAI:
  - `ANSWERLENS_OPENAI_MODEL`
  - `ANSWERLENS_OPENAI_BASE_URL`
  - `OPENAI_BASE_URL`
- Perplexity:
  - `ANSWERLENS_PERPLEXITY_MODEL`
  - `ANSWERLENS_PERPLEXITY_BASE_URL`

If `eval` has no explicit provider and `runtime.yaml` also omits `runtime.eval.provider`, AnswerLens fails fast and tells you to set one.

## CLI

The CLI keeps explicit flags as high-priority overrides.

```bash
OPENAI_API_KEY=... corepack pnpm eval -- https://example.com \
  --brand ./.github/answerlens/brand.yaml \
  --competitors ./.github/answerlens/competitors.yaml \
  --prompts ./.github/answerlens/prompts.yaml \
  --out ./runs/example-eval
```

That command will auto-load `./.github/answerlens/runtime.yaml`.

You can still override the defaults:

```bash
OPENAI_API_KEY=... corepack pnpm eval -- https://example.com \
  --brand ./.github/answerlens/brand.yaml \
  --competitors ./.github/answerlens/competitors.yaml \
  --prompts ./.github/answerlens/prompts.yaml \
  --runtime ./custom/runtime.yaml \
  --provider openai \
  --model gpt-5-mini \
  --samples 2 \
  --locale en-US \
  --timeout-ms 30000 \
  --base-url https://api.openai.com/v1 \
  --out ./runs/example-eval
```

## GitHub Action

The root Action uses the same rule:

- if `runtime` input is set, use that file
- otherwise, try `runtime.yaml` next to `brand.yaml`
- `provider`, `model`, `samples`, `locale`, `timeout-ms`, and `base-url` stay as temporary overrides

That lets external repositories keep a clean starter layout without hardcoding model defaults into the workflow itself.

## Admin console

The admin launcher reads the preset's `runtime.yaml` to prefill:

- provider
- model
- locale
- samples

The preset registry also shows those defaults so operators can see what an eval run will use before launching it.
