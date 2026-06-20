# 演示报告

在线演示报告地址：

- [https://yscjrh.github.io/ai-visibility-auditor/zh/examples/static-good/index.html](https://yscjrh.github.io/ai-visibility-auditor/zh/examples/static-good/index.html)

如果你正在查看没有启用 GitHub Pages 的 fork 或副本，请用下面的 repo 内 walkthrough，并在本地生成 `runs/static-good`。

运行本地 fixture demo，生成同一组可分享的 AnswerLens 报告：

```bash
corepack pnpm demo:fixture
```

报告会写入 `runs/static-good`。

fixture 页面在演示 artifact 里使用 `https://fixture.local` 作为稳定 hostname。这个 hostname 只用于让示例 crawl 可复现，不是 AnswerLens 产品站点 URL。

## 先打开什么

1. `share-summary.md`：最快的人类可读摘要
2. `scorecard.md`：readiness score、bucket、主要问题和页面清单
3. `recommendations.md`：优先修复建议

然后再使用：

- `pr-snippet.md`：可复制进 GitHub 的摘要块
- `index.html`：浏览器里的静态报告
- `run.json`：机器可读 run metadata

这和 README funnel、真实站点 quickstart 使用同一顺序：`share-summary.md`，然后 `scorecard.md`，最后 `recommendations.md`。

## 下一步

1. 如果你还没有在本地复现报告，先运行 `corepack pnpm demo:fixture`。
2. 当 artifact 顺序已经清楚后，继续用 [docs/zh/quickstart.md](quickstart.md) 在你自己的公开站点上跑一次真实审计。
3. 只有在一次真实站点本地 run 有用之后，再把同一套 `.github/answerlens/` 文件夹结构移到 [docs/zh/github-action.md](github-action.md)。

## 示例结论

fixture 报告用于展示即使一个较完整的产品站点，也可能因为关键页面过薄而留下 source-material 缺口。它不是流量报告、排名报告或答案展示位承诺。

## 安全分享

发示例时优先使用 `share-summary.md` 或 `pr-snippet.md`。不要公开 raw provider payloads、私有 analytics、API key，或任何暗示排名保证的文案。

公开结果前先阅读 [trust-and-safety.md](../trust-and-safety.md)。

如果这个 fixture 报告帮助你理解 AnswerLens，请用 [first-run story template](../first-run-story.md)，并在 [Show and tell Discussion form](https://github.com/YSCJRH/ai-visibility-auditor/discussions/new?category=show-and-tell) 里说明哪份 artifact 最先帮到你。
