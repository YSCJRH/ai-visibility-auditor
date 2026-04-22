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

## 推荐的默认策略

当前仓库里的 prompt pack 基本都是英文编写，而且问题本身也偏“范围清楚、便于复现”的 benchmark prompt。

### 场景决策表

| 场景 | Provider | Model | Locale | Samples | 适用原因 |
| --- | --- | --- | --- | ---: | --- |
| 第一次跑 fixture 或 external starter eval | `openai` | `gpt-5-mini` | `en-US` | `1` | 成本最低、速度最快，最适合作为 first benchmark baseline |
| AnswerLens 自我应用 / self-dogfooding | `openai` | `gpt-5-mini` | `en-US` | `2` | 多一份 sample 来快速看稳定性，但又不把每次 run 都变成重型复核 |
| 少量高价值 prompt 的高置信度复核 | `openai` | `gpt-5` | `en-US` | `1` | 适合小规模、判断更敏感的 spot check |
| 非英文 prompt pack | `openai` | `gpt-5-mini` | 目标语言 | `1` | 只有当 prompts 和目标受众本身就是另一种语言时，才切 locale |

因此更适合作为默认 baseline 的是：

- `provider: openai`
- `model: gpt-5-mini`
- `locale: en-US`
- `samples: 1` 作为 fixture demo 和 external starter 的默认值

对于仓库自己的 self-dogfooding 路径，建议稍微加重一点：

- `provider` 继续用 `openai`
- `model` 继续用 `gpt-5-mini`
- `samples` 提到 `2`

原因：

- `gpt-5-mini` 对这类可重复 benchmark prompt 更便宜、更快，能降低第一次接入的成本和摩擦。这一点参考 OpenAI 官方的 [GPT-5 mini 文档](https://platform.openai.com/docs/models/gpt-5-mini)。
- prompt pack 本身是英文时，`en-US` 是最自然的默认语言。
- `samples: 1` 适合作为 first eval 的成本下限。
- 自审或文案敏感的 run 把 `samples` 提到 `2`，可以更快看出稳定性，而不必默认所有 run 都多抽样。

什么时候再覆盖：

- 当你只跑少量高价值 prompt，而且想要更高置信度时，临时切到 `gpt-5`
- 只有当 prompt pack 和目标受众本身就是中文或其他语言时，再改 locale
- 只有在你明确要检查稳定性时，再把 `samples` 提到 `2` 或 `3`

### 当前 preset 对应关系

| Preset 路径 | 当前默认值 |
| --- | --- |
| `examples/acme/runtime.yaml` | `openai / gpt-5-mini / en-US / samples=1` |
| `examples/consumer-repo/.github/answerlens/runtime.yaml` | `openai / gpt-5-mini / en-US / samples=1` |
| `.github/answerlens/runtime.yaml` | `openai / gpt-5-mini / en-US / samples=2` |

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
  --model gpt-5 \
  --samples 2 \
  --locale zh-CN \
  --timeout-ms 30000 \
  --base-url https://api.openai.com/v1 \
  --out ./runs/example-eval
```

## GitHub Action

根 Action 用的是同一套规则：

- 如果传了 `runtime` input，就用那份文件
- 如果传了 `profile` input，就把它当作一组推荐覆盖的短手
- 否则默认尝试读取 `brand.yaml` 同目录下的 `runtime.yaml`
- `provider`、`model`、`samples`、`locale`、`timeout-ms`、`base-url` 继续作为临时覆盖

这样外部仓库可以把默认模型配置留在 starter bundle 里，而不用在 workflow 里重复抄一遍。

## 可执行的 profile alias

AnswerLens 现在提供三种显式 profile alias，可作为临时覆盖的短手：

- `fast-first-eval`
- `self-dogfood-stability`
- `high-confidence-review`

当你想在不改 `runtime.yaml` 的情况下，快速切换到一组推荐默认值时，就用它们。

优先级仍然是：

1. 单个显式字段
2. profile alias
3. `runtime.yaml`
4. 环境变量回退
5. adapter 默认值

## Admin 控制台

Admin launcher 会读取 preset 的 `runtime.yaml`，并预填：

- provider
- model
- locale
- samples
- timeout
- base URL

Preset 列表页也会直接显示这些默认值，让操作者在发起 eval 之前就知道会用到哪家 provider、哪个模型，以及默认的网络边界。
