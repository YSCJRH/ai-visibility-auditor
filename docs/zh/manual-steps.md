# Manual Steps

[English](../manual-steps.md) | [简体中文](manual-steps.md)

这些是激活仓库公开分发面的最小人工步骤。

## 激活顺序

1. 启用 GitHub Pages，并确认 canonical site URL。
2. 设置 repository homepage、social preview 和 topics。
3. 选择 npm 发布路径：trusted publishing 或 `NPM_TOKEN`。
4. 保持外部复制工作流的 major versions 与仓库一致。
5. 首次公开部署后，检查 live demo、quickstart 和 release surface。
6. 保持 Discussions 分类、置顶 onboarding 讨论和 issue 模板联系路径一致。
7. 检查 bilingual routing：
   - 根路径会按语言偏好进入 `/en/` 或 `/zh/`
   - `/en` 与 `/zh` 页面可以互相切换
   - Pages 上的 demo / starter / docs / releases 都能进入对应语言页面

## npm publishing

1. 确认你能控制目标 scope `@answerlens`。
2. 如果不能控制该 scope，在第一次发布前把公共包名切到 `answerlens-cli`。
3. 选择一种发布路径：
   - Token 路径：把 `NPM_TOKEN` 加到仓库 secret。
   - Trusted publishing 路径：为当前仓库配置 npm trusted publishing，并设置仓库变量 `ANSWERLENS_ENABLE_NPM_TRUSTED_PUBLISH=true`。
4. 任一路径配置完成后，语义化版本 release workflow 就可以自动发布 `@answerlens/cli`。

如果 `npm view @answerlens/cli` 返回 `404`，就把 npm 视为尚未激活；在配置好其中一种发布路径并能在 registry 看到包之前，继续使用 GitHub release assets 或本地 checkout。

## GitHub Pages

1. 启用 **Source: GitHub Actions**。
2. Pages 启用后，设置仓库变量 `ANSWERLENS_ENABLE_PAGES_DEPLOY=true`。
3. 首次部署成功后，把 homepage 设置成 `https://yscjrh.github.io/ai-visibility-auditor/`。
4. 检查 demo report：
   - `https://yscjrh.github.io/ai-visibility-auditor/en/examples/static-good/index.html`
   - `https://yscjrh.github.io/ai-visibility-auditor/zh/examples/static-good/index.html`
5. 把 Pages 站点继续当作 self-dogfooding 的 canonical audit target。

## GitHub Actions runtime

1. 自托管 runner 需要保持在兼容 Node 24-based JavaScript actions 的版本上。
2. 根 `AnswerLens` Action 会通过 Corepack provision pnpm，所以外部仓库使用经过 review 的 release tag，例如 `YSCJRH/ai-visibility-auditor@v0.3.4` 时，不需要再单独加 `pnpm/action-setup`。
3. 对 `eval` 来说，把默认 provider / model / locale / timeout 放进 `runtime.yaml`，并让它和 `brand.yaml` 位于同一目录。
4. `OPENAI_API_KEY` 和 `PERPLEXITY_API_KEY` 继续放在 repository 或 organization secrets 里，不要写进 `runtime.yaml`。
5. 如果你在仓库外维护复制版 workflow，尽量保持和这里相同的 major 版本：
   `actions/checkout@v5`、`actions/setup-node@v5`、`actions/github-script@v8`、`actions/upload-artifact@v6`。
6. 剩余的 Node 20 deprecation annotation 仍可能来自 GitHub 维护的 Pages 和 artifact actions 上游链路。

## GitHub 仓库设置

- Description: `AnswerLens: CLI-first AI visibility auditor for product websites.`
- Canonical home: GitHub repo README
- Homepage: GitHub Pages URL
- Social preview: `assets/social-preview.png`
- Topics: `answerlens`, `ai-discoverability`, `ai-visibility`, `aeo`, `seo`, `cli`, `github-actions`

## GitHub Discussions 和反馈分流

保持 Discussions 启用，并创建这些分类：

- `Q&A`：第一次试用问题和不清楚的结果
- `Ideas`：开放式产品方向
- `Show and tell`：截图、artifacts 和 first-run 报告
- `Announcements`：release 和 roadmap 更新

另外固定一个置顶 onboarding 讨论：

- `Start here: share your first AnswerLens run`

这个置顶帖应基于 [../first-run-story.md](../first-run-story.md)，并明确：任何 first-run story 只有在用户授权且有安全 artifact 链接时，才能被当作公开 proof 使用。

## Public truth checklist

- README、roadmap、release notes 和 Pages 要对最新 release 给出同一个答案
- README 继续是 canonical home，release 继续是 second front door
- Pages 继续是 self-dogfooding 的 canonical audit target
- README、quickstart、release notes 和 Pages 都讲同一条 first-run funnel
- docs 和 copied workflow 里提到的 action major versions 要与仓库默认值一致
- `eval` 的默认模型配置应来自 `runtime.yaml`，secret 只来自环境变量
- npm install 文案不应在 registry 能看到包之前暗示 npm 已经可用
- 如果存在 active 或刚完成的 coordination issue，它应描述当前 release truth，而不是在新的 stable release 出现后仍锚定旧 release
