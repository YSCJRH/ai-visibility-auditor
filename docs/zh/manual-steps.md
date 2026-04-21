# Manual Steps

[English](../manual-steps.md) | [简体中文](manual-steps.md)

这些是激活仓库公开分发面的最小人工步骤。

## 激活顺序

1. 开启 GitHub Pages，并确认 canonical site URL
2. 设置 repository homepage、social preview 和 topics
3. 选择 npm 发布路径：trusted publishing 或 `NPM_TOKEN`
4. 保持外部复制工作流的 major versions 与仓库一致
5. 首次公开部署后，检查 live demo、quickstart 和 release surface
6. 保持 Discussions 类别、置顶 onboarding 讨论和 issue 模板链接一致
7. 新增 bilingual routing 检查：
   - 根路径会按语言偏好进入 `/en/` 或 `/zh/`
   - `/en` 与 `/zh` 页面可以互相切换
   - Pages 上 demo / starter / docs / releases 路径都能进入对应语言面

## GitHub Pages

1. 启用 **Source: GitHub Actions**
2. Pages 启用后设置仓库变量 `ANSWERLENS_ENABLE_PAGES_DEPLOY=true`
3. 首次部署成功后，把 homepage 设置为 `https://yscjrh.github.io/ai-visibility-auditor/`
4. 检查 demo report：
   - `https://yscjrh.github.io/ai-visibility-auditor/en/examples/static-good/index.html`
   - `https://yscjrh.github.io/ai-visibility-auditor/zh/examples/static-good/index.html`

## GitHub 仓库设置

- Description: `AnswerLens: CLI-first AI visibility auditor for product websites.`
- Canonical home: GitHub repo README
- Homepage: GitHub Pages URL
- Social preview: `assets/social-preview.png`
- Topics: `answerlens`, `ai-discoverability`, `ai-visibility`, `aeo`, `seo`, `cli`, `github-actions`

更完整说明仍以英文原文 [../manual-steps.md](../manual-steps.md) 为准。
