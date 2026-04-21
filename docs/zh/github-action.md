# GitHub Action

[English](../github-action.md) | [简体中文](github-action.md)

AnswerLens 提供一个可复用的根 Action，让团队把 AI 可发现性检查放在 GitHub-native 工作流里，而不是在每个仓库里重写 shell glue。

请在完成以下步骤后再来看这一页：
1. 打开在线演示报告
2. 跑 fixture demo
3. 用 [quickstart.md](quickstart.md) 跑过一次真实本地审计

## 对外公共接口

- `uses: YSCJRH/ai-visibility-auditor@vX`
- commands: `audit`、`eval`、`manual-import`、`search-console-import`、`bing-indexnow-helper`
- outputs: `out-dir`、`share-summary-path`、`scorecard-path`、`recommendations-path`、`pr-snippet-path`、`run-json-path`

## 推荐外部仓库布局

```text
.github/
  answerlens/
    brand.yaml
    competitors.yaml
    prompts.yaml
  workflows/
    answerlens.yml
```

把 [../../examples/consumer-repo/.github](../../examples/consumer-repo/.github) 当作可复制的 baseline。

## 最小工作流

英文原文里的 workflow 示例可以直接复制使用，优先查看：
- [../github-action.md](../github-action.md)
- [../../examples/consumer-repo/.github/workflows/answerlens.yml](../../examples/consumer-repo/.github/workflows/answerlens.yml)

## 产物阅读顺序

始终先看：
1. `share-summary.md`
2. `scorecard.md`
3. `recommendations.md`

然后再用：
- `pr-snippet.md` 写 GitHub 摘要
- `run.json` 提供机器可读元数据

## 下一步

如果你只是第一次试用，请先回到 [quickstart.md](quickstart.md)。Action 应该是同一套 artifact 契约的 CI 版本，而不是另一条产品线。
