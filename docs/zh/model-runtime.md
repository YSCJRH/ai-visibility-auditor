# 模型运行时配置

AnswerLens 把非敏感的 `eval` 默认值放在 `runtime.yaml` 里。

这份文件是仓库内的统一事实源，用来定义：

- 默认的 live eval provider
- 默认模型名
- 默认 eval 语言
- 默认采样次数
- 默认 provider 超时
- 可选的非敏感 provider base URL 覆盖

密钥只放环境变量，绝不要把 API key 写进 `runtime.yaml`。

## 默认位置

AnswerLens 会在 `brand.yaml` 同目录下寻找 `runtime.yaml`。

典型结构：

```text
.github/
  answerlens/
    brand.yaml
    competitors.yaml
    prompts.yaml
    runtime.yaml
```

当前仓库里的三份示例：

- `./.github/answerlens/runtime.yaml`
- `./examples/acme/runtime.yaml`
- `./examples/consumer-repo/.github/answerlens/runtime.yaml`

## 文件结构

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

## 什么该放哪里

放进 `runtime.yaml` 的内容：

- `runtime.eval.provider`
- `runtime.eval.model`
- `runtime.eval.locale`
- `runtime.eval.samples`
- `runtime.eval.timeout_ms`
- `runtime.providers.<name>.base_url`

必须继续放环境变量的内容：

- `OPENAI_API_KEY`
- `PERPLEXITY_API_KEY`
- 任意 token / secret

不要把模型运行时配置塞回：

- `brand.yaml`
- `competitors.yaml`
- `prompts.yaml`

## 优先级

`eval` 会按下面的顺序解析配置：

1. CLI flags、GitHub Action inputs、admin launcher 的显式覆盖
2. `runtime.yaml`
3. provider-specific 环境变量回退
4. adapter 默认值
5. API key 只从环境变量读取

现有的 provider-specific 环境变量仍然有效：

- OpenAI：
  - `ANSWERLENS_OPENAI_MODEL`
  - `ANSWERLENS_OPENAI_BASE_URL`
  - `OPENAI_BASE_URL`
- Perplexity：
  - `ANSWERLENS_PERPLEXITY_MODEL`
  - `ANSWERLENS_PERPLEXITY_BASE_URL`

如果 `eval` 没有显式 provider，而 `runtime.yaml` 里也没有 `runtime.eval.provider`，AnswerLens 会直接报错并提示你去补上。

## CLI

CLI 仍然支持高优先级显式覆盖。

```bash
OPENAI_API_KEY=... corepack pnpm eval -- https://example.com \
  --brand ./.github/answerlens/brand.yaml \
  --competitors ./.github/answerlens/competitors.yaml \
  --prompts ./.github/answerlens/prompts.yaml \
  --out ./runs/example-eval
```

这条命令会自动加载 `./.github/answerlens/runtime.yaml`。

如果你要临时覆盖默认值：

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

根 Action 用的是同一套规则：

- 如果传了 `runtime` input，就用那份文件
- 否则默认尝试读取 `brand.yaml` 同目录下的 `runtime.yaml`
- `provider`、`model`、`samples`、`locale`、`timeout-ms`、`base-url` 继续作为临时覆盖

这样外部仓库可以把默认模型配置留在 starter bundle 里，而不用在 workflow 里重复抄一遍。

## Admin 控制台

Admin launcher 会读取 preset 的 `runtime.yaml`，并预填：

- provider
- model
- locale
- samples

Preset 列表页也会直接显示这些默认值，让操作者在发起 eval 之前就知道会用到哪家 provider、哪个模型。
