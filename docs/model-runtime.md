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
    model: gpt-5-mini
    locale: en-US
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

## Recommended default strategy

Current prompt packs in this repository are authored in English and are relatively well-scoped benchmark questions.

### Profile matrix

| Scenario | Provider | Model | Locale | Samples | Why |
| --- | --- | --- | --- | ---: | --- |
| First eval on a fixture or external starter | `openai` | `gpt-5-mini` | `en-US` | `1` | Lowest-friction, lowest-cost baseline for a first benchmark pass |
| AnswerLens self-dogfooding | `openai` | `gpt-5-mini` | `en-US` | `2` | Adds a quick stability read without turning every run into a heavy adjudication pass |
| Messaging-sensitive re-check on a small prompt set | `openai` | `gpt-5` | `en-US` | `1` | Better for a higher-confidence spot check when the prompt count is intentionally small |
| Search-shaped second opinion after an OpenAI baseline | `perplexity` | `sonar` | `en-US` | `1` | Use when you want a retrieval-heavy cross-check with live-search-style citations, not a new default baseline |
| Non-English prompt pack | `openai` | `gpt-5-mini` | target locale | `1` | Change locale only when the prompts and target audience are genuinely centered on that language |

That makes this a good default baseline:

- `provider: openai`
- `model: gpt-5-mini`
- `locale: en-US`
- `samples: 1` for fixture and external starter paths

Use a slightly heavier baseline for the repository's own self-dogfooding path:

- keep `provider: openai`
- keep `model: gpt-5-mini`
- set `samples: 2`

Why:

- `gpt-5-mini` is cheaper and faster for repeatable benchmark prompts, which lowers first-run friction for adopters. This is based on OpenAI's [GPT-5 mini model page](https://platform.openai.com/docs/models/gpt-5-mini).
- `en-US` is the cleanest default when the prompt pack itself is written in English.
- `samples: 1` is the right first-run cost floor.
- `samples: 2` is worth it on self-dogfood or messaging-sensitive runs when you want a quick stability read before you trust one result too much.

When to override:

- use `gpt-5` temporarily when you want a higher-confidence adjudication run on a smaller number of high-value prompts
- use Perplexity temporarily when you already have an OpenAI baseline and want a search-shaped second opinion with fresher citation behavior
- switch locale only when the prompt pack and audience are genuinely centered on another language
- raise samples to `2` or `3` only when you are checking instability, not for every default run

### When Perplexity is worth the switch

Do not switch the whole repo default to Perplexity just because live web retrieval sounds attractive.

Use it when all three are true:

- you already have one readable OpenAI baseline for the same prompt pack
- you want to compare citation behavior or search-shaped answer framing, not replace your main benchmark line
- you are willing to treat it as a second opinion rather than the canonical first pass

That makes Perplexity a good temporary override for:

- competitor or comparison prompts where fresh web retrieval may change the answer frame
- citation-sensitive spot checks where you want to compare another provider's source selection
- occasional cross-provider validation before you make a messaging decision

It is usually not the best first default for:

- fixture demos
- external starter first runs
- broad prompt packs where you mostly need a cheap, repeatable baseline

### Current preset mapping

| Preset path | Current default |
| --- | --- |
| `examples/acme/runtime.yaml` | `openai / gpt-5-mini / en-US / samples=1` |
| `examples/consumer-repo/.github/answerlens/runtime.yaml` | `openai / gpt-5-mini / en-US / samples=1` |
| `.github/answerlens/runtime.yaml` | `openai / gpt-5-mini / en-US / samples=2` |

### Quick picks by workflow

| Workflow | Recommended choice | Why |
| --- | --- | --- |
| External adopter first eval | Keep `runtime.yaml` as-is or use `fast-first-eval` | Best low-friction baseline before you decide whether the prompt pack is even useful |
| Repo self-dogfooding | Keep `.github/answerlens/runtime.yaml` defaults or use `self-dogfood-stability` | Matches the repo's own repeatable stability-check path |
| Release or messaging preflight on a small prompt set | Use `high-confidence-review` temporarily | Better when you need a stronger adjudication pass right before a decision |
| Cross-provider citation check | Use `perplexity-cross-check` temporarily | Best treated as a second opinion after one readable OpenAI baseline |

The practical rule is:

- keep repo-native defaults in `runtime.yaml`
- use profile aliases for temporary, situation-specific overrides
- do not keep flipping the shared default provider back and forth for one-off checks

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
- if `profile` input is set, use that recommended alias as a shorthand bundle of overrides
- otherwise, try `runtime.yaml` next to `brand.yaml`
- `provider`, `model`, `samples`, `locale`, `timeout-ms`, and `base-url` stay as temporary overrides

That lets external repositories keep a clean starter layout without hardcoding model defaults into the workflow itself.

## Executable profile aliases

AnswerLens now ships four explicit profile aliases for temporary overrides:

- `fast-first-eval`
- `self-dogfood-stability`
- `high-confidence-review`
- `perplexity-cross-check`

Use them when you want a shorthand on top of `runtime.yaml`, without rewriting the YAML itself.

Priority stays:

1. individual explicit fields
2. profile alias
3. `runtime.yaml`
4. env fallback
5. adapter defaults

If you explicitly override `provider`, AnswerLens will not carry over a profile model from a different provider.

## Admin console

The admin launcher reads the preset's `runtime.yaml` to prefill:

- provider
- model
- locale
- samples

The preset registry also shows those defaults so operators can see what an eval run will use before launching it.
