# GitHub Action

[English](../github-action.md) | [简体中文](github-action.md)

AnswerLens 提供一个可复用的根 Action，让团队把 AI 可发现性检查放进 GitHub-native 工作流，而不是在每个仓库里重复拼 shell glue。这里的 workflow pin 指把 `uses:` 固定到经过 review 的 release tag；provider 指 `eval` 使用的模型服务商。

请在完成下面这条路径之后再来看这页：

1. 打开在线 demo 报告
2. 跑一次 fixture demo
3. 用 [quickstart.md](quickstart.md) 在真实站点上跑过一轮本地审计

## 对外公共接口

- `uses: YSCJRH/ai-visibility-auditor@vX`
- commands: `audit`、`eval`、`manual-import`、`search-console-import`、`bing-indexnow-helper`
- outputs: `out-dir`、`share-summary-path`、`scorecard-path`、`recommendations-path`、`pr-snippet-path`、`run-json-path`

## 推荐的外部仓库布局

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

把 [../../examples/consumer-repo/.github](../../examples/consumer-repo/.github) 当作可复制的 baseline。
当前仓库中的 starter workflow pin 到稳定 Action release：`YSCJRH/ai-visibility-auditor@v0.3.6`。也就是外部仓库先固定到这个经过 review 的版本；有新 release 后，先读 release notes，再更新这个 pin。

如果你计划运行 `eval`，就把默认 provider（模型服务商）/ model / locale / timeout 放进 `runtime.yaml`，不要把这些默认值散落在 workflow 里。

## 最小工作流

英文原文里的 workflow 示例可以直接复制，优先查看：

- [../github-action.md](../github-action.md)
- [../../examples/consumer-repo/.github/workflows/answerlens.yml](../../examples/consumer-repo/.github/workflows/answerlens.yml)

这两个 workflow 示例都应在 `GITHUB_STEP_SUMMARY` 里保留两块内容：

- `Adopter kit`：说明如何复制 `.github/answerlens/` 和 `.github/workflows/answerlens.yml`，以及 secrets 放哪里
- `Safe sharing boundary`：说明先看 `share-summary.md`、再看 `scorecard.md`、最后看 `recommendations.md`，并且默认上传 artifact 排除 `raw/**`
- `Share this first run`：如果这次 run 可以公开且已有授权，用 first-run story template 和 Show and tell Discussion form 分享；不要包含 API keys、私有 analytics 或 raw provider payloads

## 第一次 CI 的 PR 审阅包

第一次 Action 跑完后，用 `GITHUB_STEP_SUMMARY` 里的 `Adopter kit`、`Safe sharing boundary` 和 `Share this first run` 作为接入 PR 的交接说明。

这段 PR packet 应该回答五件事：

1. 复制了哪些仓库文件：`.github/answerlens/` 和 `.github/workflows/answerlens.yml`
2. 先打开哪份公开 artifact：`share-summary.md`，然后 `scorecard.md`，最后 `recommendations.md`
3. secrets 放哪里：GitHub secrets 或本地环境变量，而不是 `runtime.yaml`
4. 这次结果没有声明什么：不抓取消费级 AI UI，不承诺排名或答案展示位置
5. 如果已有授权且适合公开，如何分享：使用 first-run story template 和 Show and tell Discussion form，不包含 API keys、私有 analytics 或 raw provider payloads

## `eval` 的配置优先级

对 `eval` 来说，AnswerLens 按同一套顺序解析配置：

1. 显式 Action inputs
2. `profile`
3. `runtime.yaml`
4. provider-specific 环境变量回退
5. adapter 默认值

如果你没有传 `runtime` input，AnswerLens 会默认尝试读取 `brand.yaml` 同目录下的 `runtime.yaml`。
如果你传了 `profile`，它会作为一组推荐覆盖，位于单字段显式输入之后、`runtime.yaml` 之前。

## 产物审阅顺序

始终先看：

1. `share-summary.md`
2. `scorecard.md`
3. `recommendations.md`

然后再用：

- `pr-snippet.md` 写入 GitHub 摘要
- `run.json` 提供机器可读元数据

## 安全边界

把 `OPENAI_API_KEY`、`PERPLEXITY_API_KEY` 继续放在 GitHub secrets 里，不要写进 `runtime.yaml`。

默认上传报告包时应排除 `raw/**`。`eval` 和 `manual-import` 可能会把 raw provider payloads 写到那里；如果团队确实需要调试这些 payload，请只通过显式的私有 workflow 或受限 artifact 路径上传。

完整模型配置规则见 [model-runtime.md](model-runtime.md)。
如果你只是想先用一档推荐的临时配置开始，可以优先用 `profile: fast-first-eval`，再决定是否改成单字段覆盖。
如果你已经有一轮可读的 OpenAI baseline，又想做 provider 级别的第二意见检查，可以临时改用 `profile: perplexity-cross-check`，而不是直接把 starter 默认值永久换掉。

## 下一步

如果这还是你的第一次试用，请先回到 [quickstart.md](quickstart.md)。Action 应该是同一套 artifact 契约的 CI 版本，而不是另一条独立产品线。
