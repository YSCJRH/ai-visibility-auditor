# Quickstart：5 分钟跑一轮真实站点审计

[English](../quickstart.md) | [简体中文](quickstart.md)

这是 fixture demo 和 GitHub Action 之间的桥接步骤。

适用场景：

- 你已经看过 sample report
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
- 如果你计划运行 `eval`，就在 `runtime.yaml` 里设置默认 provider、model、locale 和 timeout

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

## 步骤 5：按顺序打开 artifacts

1. `share-summary.md`
2. `scorecard.md`
3. `recommendations.md`

然后再看：

- `pr-snippet.md`
- `index.html`
- `run.json`

## 下一步

如果这次本地 run 已经足够有用，就继续看 [github-action.md](github-action.md)，把同一套 `.github/answerlens/` 结构搬进 CI。
