# Admin Console

[English](../admin-console.md) | [简体中文](admin-console.md)

`apps/admin` 是 AnswerLens 的内部控制台，不是公开 SaaS 后台。

它的职责是：
- 编排 `audit` / `eval`
- 读取 `runs/*` artifacts
- 查看 preset
- 按固定顺序审阅 `share-summary.md -> scorecard.md -> recommendations.md`

## 页面

- `/runs`：运行列表
- `/runs/:runId`：运行详情和 artifact viewer
- `/presets`：preset 注册表
- `/review/*`：服务端 fallback 审阅页

## 启动

```bash
corepack pnpm admin:dev
```

然后打开：
- `http://127.0.0.1:4318/runs`
- `http://127.0.0.1:4318/review/runs`

更完整的架构边界和运行说明请查看英文原文 [../admin-console.md](../admin-console.md)。
