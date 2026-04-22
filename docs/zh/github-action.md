# GitHub Action

[English](../github-action.md) | [简体中文](github-action.md)

AnswerLens 提供一个可复用的根 Action，让团队把 AI 可发现性检查放进 GitHub-native 工作流，而不是在每个仓库里重复拼 shell glue。

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

如果你计划运行 `eval`，就把默认 provider / model / locale / timeout 放进 `runtime.yaml`，不要把这些默认值散落在 workflow 里。

## 最小工作流

英文原文里的 workflow 示例可以直接复制，优先查看：

- [../github-action.md](../github-action.md)
- [../../examples/consumer-repo/.github/workflows/answerlens.yml](../../examples/consumer-repo/.github/workflows/answerlens.yml)

## `eval` 的配置优先级

对 `eval` 来说，AnswerLens 按同一套顺序解析配置：

1. 显式 Action inputs
2. `runtime.yaml`
3. provider-specific 环境变量回退
4. adapter 默认值

如果你没有传 `runtime` input，AnswerLens 会默认尝试读取 `brand.yaml` 同目录下的 `runtime.yaml`。

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

完整模型配置规则见 [model-runtime.md](model-runtime.md)。

## 下一步

如果这还是你的第一次试用，请先回到 [quickstart.md](quickstart.md)。Action 应该是同一套 artifact 契约的 CI 版本，而不是另一条独立产品线。
