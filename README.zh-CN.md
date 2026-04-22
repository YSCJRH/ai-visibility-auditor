# AnswerLens

[English](README.md) | [简体中文](README.zh-CN.md)

[![CI](https://github.com/YSCJRH/ai-visibility-auditor/actions/workflows/ci.yml/badge.svg)](https://github.com/YSCJRH/ai-visibility-auditor/actions/workflows/ci.yml)
[![Demo Audit](https://github.com/YSCJRH/ai-visibility-auditor/actions/workflows/demo-audit.yml/badge.svg)](https://github.com/YSCJRH/ai-visibility-auditor/actions/workflows/demo-audit.yml)
[![Release](https://img.shields.io/github/v/release/YSCJRH/ai-visibility-auditor?label=release)](https://github.com/YSCJRH/ai-visibility-auditor/releases)
[![License](https://img.shields.io/github/license/YSCJRH/ai-visibility-auditor)](LICENSE)

![AnswerLens cover](assets/readme-cover.svg)

> 面向 AI 可发现性的 CI。

AnswerLens 是一个 CLI-first、GitHub-native 的 AI 可见性审计器，面向产品网站。它帮助团队理解为什么 AI 系统会错过、压扁或误读站点内容，然后产出可复现、可在 GitHub 中审阅的 artifacts。

它关注的是可解释的结构、证据和验证工作流，而不是消费级 UI 抓取。

开源。CLI-first。报告驱动。无消费级 UI 抓取。不承诺排名。不做 dashboard-first 重写。

## 从这里开始

一条路径，四个步骤：

1. [打开在线演示报告](https://yscjrh.github.io/ai-visibility-auditor/zh/examples/static-good/index.html)
   最快理解输出、artifact 流，以及为什么这套工作流适合在 GitHub 中审阅。
2. [运行 60 秒 fixture 演示](README.md#run-the-60-second-fixture-demo)
   在本地复现同一组 artifacts，让这条路径从“看懂”变成“亲手跑通”。
3. [运行 5 分钟真实站点审计](docs/zh/quickstart.md)
   先把同一套配置跑到自己的公开站点上，再去接 CI。
4. [添加 GitHub Action](docs/zh/github-action.md)
   把同一套 artifact-first 工作流搬进 PR、artifact 上传和 `GITHUB_STEP_SUMMARY`。

主入口：
- 在线演示报告

辅助入口：
- 60 秒 fixture 演示
- GitHub Action 文档，但前提是一轮本地运行已经足够可审阅

桥接步骤：
- 在 fixture 演示和 CI 接入之间，先跑一轮真实站点 quickstart

每一步都保持同样的 artifact 顺序：`share-summary.md`，然后 `scorecard.md`，最后 `recommendations.md`。

如果你一开始就知道自己要接 CI，Action 文档当然仍然公开可用；但最清晰的首次路径仍然是 demo -> fixture -> real-site -> Action。

## 你会得到什么

- `audit`：对实时站点或本地 fixture 做 AI readiness 审计
- `eval`：通过 OpenAI / Perplexity 适配器做 prompt-pack 基准评估
- `manual-import`：为外部或人工收集的答案样本做归一化评分
- `search-console-import`：把 Search Console 页面级导出与关键页面证据对照验证
- `bing-indexnow-helper`：Bing 验证导入和 IndexNow 辅助产物
- 仓库原生输出：`share-summary.md`、`pr-snippet.md`、`run.json`、`index.html`

## 为什么是 AnswerLens

- 面向 AI 可发现性的 CI，服务于 Git 工作流而不是 dashboard 锁定
- 规则可解释，聚焦 AI 为什么会错过或误读站点
- report-first、repo-native，把运行结果变成团队能审阅和推进的 artifacts
- 以验证为导向，避免 scrape-and-rank 叙事，并让证据保持可见

## 它不是什么

- 不是“让你在 ChatGPT 排第一”的技巧包
- 不是消费级 AI UI 抓取器
- 不是泛化的 AI 内容生成器
- 不是 Search Console 或 analytics 的替代品
- 不是任何答案面的排名保证

## 关键文档

- [真实站点 5 分钟 quickstart](docs/zh/quickstart.md)
- [GitHub Action 接入](docs/zh/github-action.md)
- [模型运行时配置](docs/zh/model-runtime.md)
- [人工步骤清单](docs/zh/manual-steps.md)
- [激活计划](docs/zh/activation-plan.md)
- [分发计划](docs/zh/distribution-plan.md)
- [Admin 控制台说明](docs/zh/admin-console.md)

如果你要跑 live `eval`，请把默认 provider / model / locale / timeout 放进 `runtime.yaml`，把 `OPENAI_API_KEY` 和 `PERPLEXITY_API_KEY` 继续放在环境变量里。完整规则和场景决策表见 [docs/zh/model-runtime.md](docs/zh/model-runtime.md)。

如果你需要完整英文细节、更多命令示例和所有仓库文档，请继续查看 [README.md](README.md) 和 `docs/` 下的英文原文。
