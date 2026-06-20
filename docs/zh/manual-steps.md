# Manual Steps

[English](../manual-steps.md) | [简体中文](manual-steps.md)

这些是激活仓库公开分发面的最小人工步骤。

## 激活顺序

1. 启用 GitHub Pages，并确认 canonical site URL。
2. 设置 repository homepage、social preview 和 topics。
3. 选择 npm 发布路径：trusted publishing 或 `NPM_TOKEN`。
4. 每次 semver release bump 之前，先按 [../release-bump-playbook.md](../release-bump-playbook.md) 检查版本、release snapshot、Action pin、Pages fallback 和 npm 状态。
5. 保持外部复制工作流的 major versions 与仓库一致。
6. 首次公开部署后，检查 live demo、quickstart 和 release surface。
7. 保持 Discussions 分类、置顶 onboarding 讨论和 issue 模板联系路径一致。
8. 检查 bilingual routing：
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

## release assets 检查清单

先看 live demo、fixture demo、真实站点 quickstart 和 GitHub Action 路径；这些都能理解之后，再把 release assets 当作第二个公开入口。

每个 semver release 应该提供这些公开资源：

1. CLI tarball，例如 `answerlens-cli-*.tgz`，用于 npm package 可见之前的固定版本本地 CLI。
2. `answerlens-demo-audit.tar.gz`，用于解压 fixture 报告，并按 `share-summary.md`、`scorecard.md`、`recommendations.md` 的顺序审阅。
3. `answerlens-site.tar.gz`，用于检查该 tag 对应的 docs、examples、starter 和 release 页面编译结果。
4. `release-assets-manifest.json`，用于在复用 tarball 之前校验已下载文件的大小和 SHA-256 checksum。
5. `release-assets-summary.md`，用于读取可转发的 verified asset table；它可以进入 release review，但不暴露 raw provider payloads。

对于同时包含 `release-assets-manifest.json` 和 `release-assets-summary.md` 的 release，把 manifest、summary 和所有 assets 下载到同一个目录，然后在本地 checkout 中校验已下载文件：

```bash
assets_dir="$(mktemp -d)"
gh release download vX.Y.Z \
  --pattern 'answerlens-cli-*.tgz' \
  --pattern answerlens-demo-audit.tar.gz \
  --pattern answerlens-site.tar.gz \
  --pattern release-assets-manifest.json \
  --pattern release-assets-summary.md \
  --dir "$assets_dir"
corepack pnpm release:assets:manifest -- --verify "$assets_dir/release-assets-manifest.json"
mkdir -p "$assets_dir/demo-audit-check"
tar -xzf "$assets_dir/answerlens-demo-audit.tar.gz" -C "$assets_dir/demo-audit-check"
node --experimental-strip-types scripts/distribution/demo-fixture-artifact-check.ts --out "$assets_dir/demo-audit-check/runs/static-good"
```

如果某个 release 早于 `release-assets-manifest.json` 或 `release-assets-summary.md`，不要把 checksum claim 回填进公开 release story；只检查已有 assets，并把这个缺口记录为 release metadata 历史。

如果 `npm view @answerlens/cli` 返回 `404`，不要把 npm 描述成已激活。继续把 release assets 和本地 checkout 作为公开下载与运行路径，直到 registry package 可见。

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
2. 根 `AnswerLens` Action 会通过 Corepack provision pnpm，所以外部仓库使用经过 review 的 release tag，例如 `YSCJRH/ai-visibility-auditor@v0.3.5` 时，不需要再单独加 `pnpm/action-setup`。
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

仓库内已经提供 `.github/DISCUSSION_TEMPLATE/show-and-tell.yml`，用于 `Show and tell` 分类。它只会在 Discussions 已启用、且该分类 slug 为 `show-and-tell` 后生效。这个表单会保持 `share-summary.md`、`scorecard.md`、`recommendations.md` 的阅读顺序，在相关时收集 release asset evidence，并重复 npm `404`、BYOK、不承诺排名、不公开 raw payload、需要明确授权复用这些边界。

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
- release bump PR 应按 [../release-bump-playbook.md](../release-bump-playbook.md) 更新 package version、release snapshot、Action pin、Pages fallback metadata 和 npm 状态
