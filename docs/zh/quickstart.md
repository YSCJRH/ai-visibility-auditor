# Quickstart：5 分钟跑一轮真实站点审计

[English](../quickstart.md) | [简体中文](quickstart.md)

这是 fixture demo 和 GitHub Action 之间的桥接步骤。这里的 sample report 指在线示例报告，baseline 指第一次可复现的基线结果，provider 指你选择的模型服务商。

适用场景：

- 你已经看过在线 sample report，并知道先读 `share-summary.md`
- 你想先对自己的公开站点跑一轮真实 AnswerLens
- 你还没准备好立刻接入 CI

## 你需要准备

- 一个公开站点 URL
- Node `>=22.0.0`
- 本仓库的本地 checkout
- 基础 `audit` 不需要 provider API key
- 只有在你要跑 `eval` 时才需要 provider API key

## 步骤 1：安装工作区

```bash
corepack enable
corepack pnpm install
```

## 步骤 2：复制 starter 配置形状

把 [../../examples/consumer-repo](../../examples/consumer-repo) 当作对外基线，复制下面这组文件：

```text
.github/
  answerlens/
    brand.yaml
    competitors.yaml
    prompts.yaml
    runtime.yaml
```

## 步骤 3：替换占位内容

- 在 `brand.yaml` 里改品牌名、域名和 proof-page 线索
- 如果你希望公开报告显示友好的站点名，而不是原始 URL 或本地路径，设置 `site_display_name`
- 在 `competitors.yaml` 里改成真实竞争对手
- 在 `prompts.yaml` 里改成贴合你买家、比较和引用问题的提示词
- 如果你计划运行 `eval`，就在 `runtime.yaml` 里设置默认 provider（模型服务商）、model、locale 和 timeout

不要把 API key 写进 `runtime.yaml`。它们应继续放在环境变量里。完整优先级见 [model-runtime.md](model-runtime.md)。

## 步骤 4：跑一轮真实审计

```bash
corepack pnpm audit -- https://www.example.com \
  --brand ./.github/answerlens/brand.yaml \
  --competitors ./.github/answerlens/competitors.yaml \
  --prompts ./.github/answerlens/prompts.yaml \
  --out ./runs/answerlens-real-site
```

如果 audit 已经足够可读，你也可以保持同一套目录结构，直接让 CLI 从 `brand.yaml` 同目录读取 `runtime.yaml`：

```bash
OPENAI_API_KEY=... corepack pnpm eval -- https://www.example.com \
  --brand ./.github/answerlens/brand.yaml \
  --competitors ./.github/answerlens/competitors.yaml \
  --prompts ./.github/answerlens/prompts.yaml \
  --out ./runs/answerlens-real-site-eval
```

如果你想直接套用推荐的一档临时配置，而不是自己逐项覆盖：

- `--profile fast-first-eval` 适合第一次 benchmark pass，也就是先得到一轮低摩擦 baseline
- `--profile high-confidence-review` 适合少量高价值 prompt 的复核
- `--profile perplexity-cross-check` 适合在已经有一轮 OpenAI baseline 之后，再做一次偏搜索风格的第二意见检查

## 步骤 5：按顺序打开 artifacts

1. `share-summary.md`
2. `scorecard.md`
3. `recommendations.md`

然后再看：

- `pr-snippet.md`
- `index.html`
- `run.json`

## 安全分享首次运行

公开分享前先看 [../trust-and-safety.md](../trust-and-safety.md)。

如果这次 run 可以公开讨论，可以使用 [../first-run-story.md](../first-run-story.md) 模板。一个有用的 first-run story 应该说明哪份 artifact 最先帮到你、暴露了哪个 source-material 缺口，以及下一步准备修哪一页。

不要把 API key、私有 analytics 或 raw provider payloads 粘贴到公开 PR、issue、release notes 或 Discussions。

## 下一步

如果这次本地 run 已经足够有用，就继续看 [github-action.md](github-action.md)，把同一套 `.github/answerlens/` 结构搬进 CI。

第一次 CI 接入 PR 可以直接使用 [../starter-bundle.md](../starter-bundle.md) 里的 `Adopter kit checklist` 和 `PR review packet`。
