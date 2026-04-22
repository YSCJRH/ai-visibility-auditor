# Admin Console

[English](../admin-console.md) | [简体中文](admin-console.md)

`apps/admin` 是 AnswerLens 的内部控制台，不是公开 SaaS 后台。

它的职责是：

- 发起 `audit` / `eval`
- 读取 `runs/*` artifacts
- 查看 preset
- 按固定顺序审阅 `share-summary.md -> scorecard.md -> recommendations.md`
- 在发起 `eval` 之前先看到 preset 的默认 provider / model / runtime 路径

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

## Launcher 规则

1. 选择 preset
2. 输入站点
3. 选择 `audit` 或 `eval`
4. 如果是 `eval`，先确认 preset 的 `runtime.yaml` 默认值
5. 只有在你想临时覆盖时，才改 provider / model / locale
6. 等待队列完成并进入 run detail

对 `eval` 来说，launcher 会读取 `brand.yaml` 同目录下的 `runtime.yaml`。API key 继续只放环境变量里，不进入浏览器、不进入 repo。

完整优先级见 [model-runtime.md](model-runtime.md)。

## 包边界

- `apps/admin`
  React + Vite 客户端和薄 BFF
- `packages/contracts`
  浏览器安全的 run / artifact / preset / job shape
- `packages/admin-runtime`
  基于文件系统的 preset 发现、run 列表、artifact 读取和队列编排
- `packages/runtime-config`
  共享 `runtime.yaml` 解析和 eval 默认值决策树

更完整的架构边界和运行说明请查看英文原文 [../admin-console.md](../admin-console.md)。
