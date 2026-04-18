# 给 Codex 的执行参考：AnswerLens / ai-visibility-auditor

> 目标：把上一轮对 `YSCJRH/ai-visibility-auditor` 的产品/分发/上手审查，整理成一份更适合 **Codex app** 执行的工作说明。  
> 用法：把这份文档作为 Codex 的任务背景；复杂任务先 `/plan`，再按里程碑执行。
>
> 规范化入口：本 workstream 的仓库级摘要与执行边界已整理到 [docs/activation-plan.md](docs/activation-plan.md)。
> GitHub-native 增长与包装实践已整理到 [docs/github-growth-plan.md](docs/github-growth-plan.md)。
> 自我应用传播闭环已整理到 [docs/self-dogfooding.md](docs/self-dogfooding.md)。

---

## 1. 先给 Codex 的总指令

你在这个仓库里不是来“继续堆功能”的，而是来**优先打通公开分发面、试用面、首次上手路径**。

请始终把下面几条当成硬约束：

1. **优先修激活，不优先修功能。** 当前仓库已经有 CLI、根 Action、报告产物、Pages/Release 脚手架、fixture demo、docs 和 distribution plan；最大缺口是公开激活和 adoption path，而不是核心能力缺失。[^repo-dist]
2. **官方定位不要漂移。** 对外主叙述应维持：`AnswerLens` 是 **CLI-first AI visibility auditor for product websites**，tagline 是 **CI for AI discoverability**。README 已经这么写了，roadmap 也把这个定位定死了。[^repo-readme][^repo-roadmap]
3. **不要越过非目标。** 不允许把项目改写成 consumer AI UI scraping、排名承诺工具、dashboard-first rewrite，或者 connector-first 的偏航。[^repo-roadmap]
4. **所有改动都要服务漏斗。** 任何 PR 都要说明它影响的是哪一步：`发现 / 理解 / 信任 / 试用 / 激活 / 分享 / 复访`。
5. **把“代码修改”和“仓库设置/人工操作”分开。** 这个项目有一部分工作必须在 GitHub / npm 设置里点开，例如 Pages、homepage、social preview、npm trusted publishing。Codex 需要明确产出“可改代码”和“需人工完成”的两张清单。[^repo-manual]

---

## 2. Codex app 的工作方式：优先采用 OpenAI 官方最佳实践

以下不是抽象建议，而是**你在这个仓库里应采用的实际工作方式**。

### 2.1 任何复杂任务先 `/plan`

OpenAI 官方明确建议：复杂、模糊、多步骤任务，先进入 Plan mode，再动手改代码；Plan mode 的目标是让 Codex 先收集上下文、追问必要信息、给出清晰计划。[^codex-plan]

**在这个仓库里的落地规则：**
- 只要任务会跨多个文件，或者同时涉及 README / docs / workflow / release / Pages，就先 `/plan`。
- 计划必须拆成 **小里程碑**，每个里程碑都要写：
  - 目标文件
  - 具体改动
  - 验证命令
  - 停止条件
- 每个里程碑都要足够小，最好能在一个实现-验证循环内完成。OpenAI 也建议 milestone 要小到可以单轮完成，并带 acceptance criteria 与 validation commands。[^codex-longhorizon]

### 2.2 任何任务提示词都要带四段结构

OpenAI 官方给 Codex 的默认 prompt 结构是：**Goal / Context / Constraints / Done when**。[^codex-prompt]

**在这个仓库里的固定提示格式：**

```md
Goal:
把仓库的 [某一分发面/试用面/上手面] 改到更利于发现、理解、试用。

Context:
@README.md
@docs/distribution-plan.md
@docs/manual-steps.md
@docs/github-action.md
@docs/roadmap.md
@action.yml
@package.json

Constraints:
- 不做新 SaaS / dashboard-first rewrite
- 不引入 consumer AI UI scraping
- 不做 ranking promises
- 优先复用现有 Pages / release / report / Action 脚手架
- 保持品牌口径统一为 AnswerLens

Done when:
- 文档和实现口径一致
- 首屏/入口层级清晰
- 外部 adoption path 自洽
- 验证命令通过
- 输出一个简短变更摘要，标明影响漏斗的哪一步
```

### 2.3 把稳定规则写进 `AGENTS.md`，不要每次重讲

OpenAI 官方建议：一旦你发现某种提示方式反复有效，就不要继续手动重复，而应把仓库级工作约束写进 `AGENTS.md`。Codex 会在工作开始前自动读取它，并支持**全局 + 仓库 + 子目录**分层覆盖。[^codex-agents]

**在这个仓库里的建议：**
- 把“品牌口径 / 非目标 / 验证命令 / diff 范围 / 文档一致性要求”写入仓库根部 `AGENTS.md`。
- 把“复杂任务必须先 plan”“完成前必须 review”“docs/workflow 改动要做跨文件一致性检查”写成硬规则。
- 保持 `AGENTS.md` **短而准**。官方也强调：短而准确的 `AGENTS.md` 比长篇空话更有用；如果内容过大，应该把架构细节、代码评审规则、计划模板拆到单独 Markdown。[^codex-agents][^codex-best-review]

### 2.4 优先用 Worktree，而不是在一个线程里把所有事搅在一起

Codex app 官方定位就是一个可并行工作的桌面“command center”，支持并行线程、内建 Git 功能、worktree 和 automations。[^codex-app][^codex-app-features]

OpenAI 官方说明：**Worktree** 适合并行独立任务，能够把变更与当前工作隔离；automations 在 Git 仓库中默认也可运行在独立 worktree 中。[^codex-worktree][^codex-automations]

**在这个仓库里的推荐线程拆法：**
- **Worktree A：README / About / Quickstart / 首屏结构**
- **Worktree B：GitHub Action adoption docs / external example / copied workflow consistency**
- **Worktree C：Pages / homepage / release surface / install narrative**

规则：
- 同一时间不要让两个线程改同一个文件。
- 如果只是在比较两种 README hero 写法，优先用 `/fork` 分叉会话，而不是新开并行编辑。[^codex-slash]

### 2.5 审批与沙箱默认收紧，按需放开

OpenAI 官方建议：如果你是 coding agents 新用户，approval 和 sandbox 默认保持保守，只有在明确需要时才放开；默认网络访问也是关闭的。[^codex-security][^codex-best-review]

**在这个仓库里的建议：**
- 默认：**Worktree + 保守 approvals + 仅 workspace 写权限**。
- 只有在需要跑安装、打包、release 验证时，再逐步放宽。
- 不要一开始就给 Full Access。
- 如果 Codex 因工作目录、写权限、工具缺失而表现差，优先检查配置，不要先怀疑模型本身。官方明确说很多质量问题其实是 setup 问题。[^codex-best-review]

### 2.6 每个里程碑都要执行“改动 → 验证 → review”闭环

OpenAI 官方非常明确：不要停在“让 Codex 改了代码”，还要让它写测试、跑检查、确认结果，并在接受前 review；Codex 还支持 `/review` 来做 PR-style review 或 review 本地未提交改动。[^codex-best-review]

**在这个仓库里的最小验证栈：**
- docs-only 改动：
  - 手工检查跨文件口径一致
  - 必要时 `pnpm build:site`
- workflow / packaging / docs 联动改动：
  - `corepack pnpm test`
  - `corepack pnpm build:site`
  - `corepack pnpm pack:cli:dry-run`
- demo / onboarding 改动：
  - `corepack enable`
  - `corepack pnpm install`
  - `corepack pnpm demo:fixture`

仓库 `package.json` 已经明确提供了 `demo:fixture`、`build:site`、`pack:cli:dry-run`、`test` 等脚本，并要求 Node `>=22.0.0`。[^repo-pkg]

### 2.7 MCP、Skills、Automations：不要一上来全开

OpenAI 官方建议：
- MCP 只在**上下文确实在仓库外**、且接入能稳定消除手工循环时再加；不要一开始把所有外部系统都连上。[^codex-best-review]
- 一旦某类流程重复出现，就应该把它做成 **Skill**；skills 适合封装 richer instructions / scripts / references，而且可跨 CLI / IDE / Codex app 复用。[^codex-best-review][^codex-skills]
- 只有当本地流程已经稳定后，再把它放进 **automation** 或 CI。[^codex-automations][^oss-skills]

**在这个仓库里的意思是：**
- **先不要** 为了酷炫而加一堆 MCP。
- **先不要** 在工作流还不稳定前做自动化。
- 当你把以下工作流跑顺后，再考虑做 skills：
  - README / docs 一致性检查
  - release surface completeness check
  - GitHub Action adoption sanity check
  - demo artifact / Pages consistency check

### 2.8 社区补充经验：并行线程适合研究和小修，但要把有用发现沉淀下来

开发者社区对 coding agents 的常见高效用法是：把 research、现有系统解读、小型维护任务交给并行线程处理，然后把得出的解释性结果沉淀成后续 prompt 的上下文。Simon Willison 也明确提到，agent 很擅长沿代码路径和文件树做“系统解释”，而这些解释值得存起来复用。[^community-parallel]

**在这个仓库里的具体做法：**
- 让一个线程专门整理“README / docs / roadmap / manual steps 之间的不一致点”。
- 让另一个线程专门比较“Action docs 的外部 adoption 路径是否自洽”。
- 把最终结论收敛回 `AGENTS.md` 或 task brief，而不是只留在聊天记录里。

---

## 3. 仓库真相：Codex 先理解这些事实，再动手

### 3.1 产品与定位

仓库当前对外品牌是 **AnswerLens**，README 首屏已经写明 tagline 为 **CI for AI discoverability**，并把产品描述为 **CLI-first AI visibility auditor for product websites**。README 同时也点出了：repo slug 仍是 `ai-visibility-auditor`。[^repo-readme]

这意味着：
- **品牌名**：AnswerLens
- **仓库 slug**：ai-visibility-auditor
- **主叙述**：CLI-first / report-driven / GitHub-reviewable / no UI scraping / no ranking promises

### 3.2 已有能力，不要低估

README 当前已明确列出：
- `audit`
- `eval`
- `manual-import`
- `search-console-import`
- `bing-indexnow-helper`
- 以及 `share-summary.md`、`pr-snippet.md`、`run.json`、`index.html` 等输出产物。[^repo-readme]

根 `action.yml` 也已经暴露了稳定输出：
- `out-dir`
- `share-summary-path`
- `pr-snippet-path`
- `run-json-path`[^repo-action]

所以，**这不是一个“只有想法、还没做出来”的仓库**；它更像一个“能力和产物已经在 repo 里，但还没把公开门面和 adoption path 打通”的仓库。[^repo-dist]

### 3.3 当前真正的瓶颈不是功能，而是 activation

`docs/distribution-plan.md` 已经写得非常直白：
- 当前 public surface 已有 README hero、release assets、shareable artifacts、demo workflow、root Action、Pages scaffold 等。[^repo-dist]
- 主 bottlenecks 则是：
  - 还没有 public install surface
  - reusable GitHub Action 还不是稳定 published adoption path
  - Pages scaffold 在仓库里，但 Pages / homepage / canonical deployment 还没公开启用
  - npm publish / 一些公开分发面仍依赖 repo settings 或凭证[^repo-dist]

**Codex 必须把这段当作优先级真相。**

### 3.4 手工步骤不是附属，而是交付的一部分

`docs/manual-steps.md` 已经定义了最小手工动作：
- npm trusted publishing 或 `NPM_TOKEN`
- 启用 GitHub Pages 并设置 `ANSWERLENS_ENABLE_PAGES_DEPLOY=true`
- 设置 repository homepage
- 设置 social preview
- 调整 topics[^repo-manual]

因此：
- Codex 可以改文档、workflow、模板、文案、脚手架；
- 但 Codex 还要**明确输出一张“需要维护者点哪里”的 checklist**。

### 3.5 文档里已经暴露出 adoption path 不稳定的点

`docs/github-action.md` 当前的 minimal workflow 使用了：
- `site: examples/fixtures/static-good`
- `brand: examples/acme/brand.yaml`
- `competitors: examples/acme/competitors.yaml`
- `prompts: examples/acme/prompts.yaml`
- `actions/upload-artifact@v4`[^repo-ghaction]

这对“本仓库自己 dogfood 自己”是合理的，但对**外部消费仓库**来说，不是一个真正可以直接复制使用的 adoption path。与之相比，`docs/manual-steps.md` 已经要求 copied workflows 优先跟随当前版本：`actions/checkout@v5`、`actions/setup-node@v5`、`actions/github-script@v8`、`actions/upload-artifact@v6`。[^repo-manual]

**Codex 需要优先修这个不一致。**

### 3.6 不可破坏的非目标

`docs/roadmap.md` 已经把非目标写死：
- no consumer AI UI scraping
- no ranking guarantees on answer surfaces
- no dashboard-first rewrite of the product
- no connector work that outruns the core audit and validation story[^repo-roadmap]

请把这四条当作 **hard guardrails**。

---

## 4. Codex 在这个仓库里的主任务

### 4.1 主目标

把仓库从“内部已经有不少能力与产物”推进到“陌生访客点进来后能更快看懂、愿意试、能跑出第一个结果、愿意接入 CI”。

### 4.2 不要误判主入口

这个项目当前最该主打的入口，不是“先安装 CLI”，而是：

1. **可点开的 live demo report**
2. **60 秒 fixture demo**
3. **GitHub Action 接入**

也就是：**先给价值，再给安装，再给接入。**

### 4.3 对 Codex 的成果要求

每次输出都要尽量落在这三类之一：
- **门面层**：README、About、homepage、social preview、topics、release surface
- **试用层**：live demo、fixture demo、5 分钟真实审计、最小 quickstart
- **adoption 层**：Action docs、starter config、copied workflow、CI summary / share-summary / PR snippet

如果改动不能明显提升这三层之一，优先级就要下降。

---

## 5. 推荐给 Codex 的执行顺序

## P0：先修转化最大、最容易复用现有脚手架的点

### P0-1 重写 README 首屏为“一个定位 + 三个入口”

**目标**：让陌生访客在 3–10 秒内回答四个问题：
- 这是什么？
- 给谁用？
- 为什么重要？
- 我现在该点哪一个？

**文件**：
- `README.md`

**改法**：
- 保留 `AnswerLens` + `CI for AI discoverability`
- 用一句副标题说明对象与边界
- 首屏 CTA 只保留三条：
  - Open live demo report
  - Run the 60-second fixture demo
  - Add the GitHub Action
- 把 slug 说明从首屏挪到 FAQ / footnote
- 把 Search Console / Bing / manual-import 从 first-run 入口层下移

**验收**：
- 首屏不超过一屏半
- CTA 有层级
- 读者不需要先读完全部 README 才知道怎么试

### P0-2 修 Action adoption docs，让“外部仓库复制就能懂”

**目标**：把 GitHub Action 从“仓库内部可用”变成“外部 adopters 可复制的入口”。

**文件**：
- `docs/github-action.md`
- `README.md`
- 可能新增 `examples/consumer-repo/` 或 `docs/action-quickstart.md`

**改法**：
- 把 minimal workflow 改成**外部消费仓库视角**
- 不再用 `examples/acme/*.yaml` 作为默认外部示例路径
- 升级 copied example 到 `actions/upload-artifact@v6`
- 明确输出产物该如何被显示在 `GITHUB_STEP_SUMMARY`
- 给一个 starter config bundle 或最小目录结构

**验收**：
- 文档示例不再依赖当前仓库内部文件结构
- 示例路径逻辑自洽
- 版本口径与 `manual-steps.md` 一致

### P0-3 激活 Pages / homepage / live demo narrative

**目标**：把已有的 Pages scaffold 和 demo report 从“存在于仓库里”变成“公开可点击的试用入口”。

**文件**：
- 代码：`README.md`、可能涉及 site builder / Pages workflow 文案
- 人工步骤：GitHub Pages、homepage、social preview

**改法**：
- 在 README 首屏直接链接 live demo report
- 在 docs 中明确“先看哪几个文件”：
  - `share-summary.md`
  - `index.html`
  - `recommendations.md`
  - `scorecard.md`
- 输出一份人工操作清单：启用 Pages、设置 homepage、设置 social preview

**验收**：
- 维护者知道哪些需要手动点
- README / manual steps / homepage narrative 口径一致

### P0-4 激活公开安装面，但不要让安装抢过 demo 的主入口地位

**目标**：让 CLI-first 不再只是口号，但仍保持“先看价值，再安装”。

**文件**：
- `docs/manual-steps.md`
- `README.md`
- release / distribution 相关文档或 workflow 文案

**改法**：
- 明确 trusted publishing 和 fallback package name 的决策树
- 保持 npm / tarball / Action / Pages 四种入口清晰区分
- release 文案中增加 Try now 段落

**验收**：
- install story 单独成段
- 不与 demo / CI adoption 混在一起

### P0-5 把报告产物当成增长资产，而不是附属文件

**目标**：让 `share-summary.md`、`pr-snippet.md`、`index.html` 真正成为传播载体。

**文件**：
- `README.md`
- `docs/demo-report.md`
- 可能的 issue / PR template、release 模板、Pages 首页

**改法**：
- 首次 demo 先引导看 `share-summary.md`
- 在 docs 和 release 模板中把 PR-ready snippet 前置
- 用现有输出强调“报告可复制、可嵌入、可评论”

**验收**：
- 仓库对外讲清楚：你得到的不只是一个分数，而是可审阅的 artifact

## P1：一个月内把 adoption 做稳

### P1-1 做一个真正的 3 层 quickstart

三层分别是：
- **60 秒 demo**：只看价值
- **5 分钟真实审计**：第一次跑自己的站
- **CI 接入**：团队 adoption

### P1-2 做 repo 级 `AGENTS.md`

把以下内容写进仓库：
- 产品定位
- 非目标
- 允许的改造方向
- 验证命令
- docs consistency rules
- “复杂任务先 plan，完成前必须 review”

### P1-3 把高频工作流做成 skill，而不是每次重新 prompt

优先候选：
- docs consistency check
- release surface completeness check
- Action adoption sanity check
- demo artifact verification

### P1-4 让 release 成为第二入口，而不是 changelog 墓地

release 模板前置：
- Open live demo
- Install CLI
- Add GitHub Action
- Download assets

## P2：放大器

- failure-mode demo gallery
- case study / before-after page
- 条件成熟后再考虑 Marketplace
- 周期性 automation：检查 README / release / Pages / docs 是否漂移

---

## 6. 建议给 Codex 的线程拆分

### 线程 A：README / 首屏 / quickstart / positioning

**模式**：Worktree

**目标**：把 README 调成一个会转化的开源首页。

**不要做**：
- 不新增产品能力
- 不改 scoring 模型
- 不延展 provider coverage

### 线程 B：GitHub Action adoption

**模式**：Worktree

**目标**：把 Action docs 改成外部仓库能复制理解的版本。

**重点看**：
- `docs/github-action.md`
- `action.yml`
- `docs/manual-steps.md`

### 线程 C：Pages / release / install surface

**模式**：Worktree

**目标**：把“公开入口还没激活”的问题拆成代码修改 + 手动配置 checklist。

**重点看**：
- `docs/distribution-plan.md`
- `docs/manual-steps.md`
- 相关 workflow / release note 文案

### 线程 D：审查线程（可选）

**模式**：子代理 / review thread

**用途**：在主变更完成后，按以下维度并行 review：
- brand consistency
- trial path consistency
- docs drift
- non-goal violations
- copied workflow sanity

OpenAI 官方支持显式要求 Codex 为同一个 PR / 当前分支的不同问题点各开一个 subagent，再等待汇总结果。[^codex-subagents]

---

## 7. 推荐给 Codex 的第一条 `/plan` 提示词

```md
/plan

Goal:
在不增加新功能、不改变非目标的前提下，优先把 ai-visibility-auditor / AnswerLens 的公开分发面、试用面、首次上手路径打通，使仓库更有机会让陌生访客快速理解、立即试用、并愿意接入 CI。

Context:
@README.md
@docs/distribution-plan.md
@docs/manual-steps.md
@docs/github-action.md
@docs/roadmap.md
@action.yml
@package.json

Constraints:
- 不做 dashboard-first rewrite
- 不做 consumer AI UI scraping
- 不做 ranking promises
- 不优先加 connectors / providers / SaaS features
- 优先复用现有 demo artifacts、Pages scaffold、release assets、root Action
- 任何方案都要区分：代码可改部分 vs 需要维护者手动完成的 repo settings

Done when:
- 给出 4–6 个里程碑
- 每个里程碑列出改动文件、风险点、验证命令、验收标准
- 明确哪些工作应该用独立 worktree 并行执行
- 标出哪些事项应暂缓，不要在当前阶段做
```

---

## 8. 推荐给 Codex 的执行 prompt 模板

### 8.1 README / 门面改造 prompt

```md
Goal:
重写 README 首屏，使其更像会转化的开源项目首页，并清晰区分 live demo、60 秒 demo、CI adoption 三个入口。

Context:
@README.md
@docs/distribution-plan.md
@docs/manual-steps.md
@docs/roadmap.md

Constraints:
- 保持品牌为 AnswerLens
- 保持 tagline 为 CI for AI discoverability
- 首屏不要堆太多概念
- 不改变非目标
- 不引入新功能承诺

Done when:
- 给出新的 README 首屏结构
- 直接修改 README
- 输出一个简短说明：这次改动主要提升的是发现/理解/试用中的哪几步
- 检查 wording 是否和 manual steps / roadmap 口径冲突
```

### 8.2 GitHub Action adoption prompt

```md
Goal:
把 GitHub Action 文档改成外部消费仓库可以理解并复制的 adoption path。

Context:
@docs/github-action.md
@action.yml
@docs/manual-steps.md
@README.md

Constraints:
- 不假设外部仓库存在 examples/acme/*.yaml
- copied workflow 版本要与 manual steps 一致
- 保留 GitHub-native / artifact-first 叙述

Done when:
- docs/github-action.md 提供一个面向外部仓库的最小示例
- 如有必要，新增 starter config 示例
- 文档明确说明 share-summary / pr-snippet / run.json 的使用方式
- 说明改动如何提升激活/分享
```

### 8.3 Pages / release / install surface prompt

```md
Goal:
把已有 Pages、release、install 脚手架整理成更清晰的公开入口，并输出一份需要人工完成的激活清单。

Context:
@docs/distribution-plan.md
@docs/manual-steps.md
@README.md
@package.json

Constraints:
- 先激活现有 surface，不新造 surface
- 安装面不要盖过 demo 主入口
- 必须区分代码可改 vs 维护者手工设置

Done when:
- 输出建议改动的文档/模板内容
- 输出手工设置 checklist
- 明确优先级：哪些一天内可完成，哪些留到后续
```

### 8.4 交付前 review prompt

```md
/review

请按以下维度 review 当前改动：
1. 品牌与定位是否仍然一致（AnswerLens / CI for AI discoverability / CLI-first）
2. 是否误伤了 no UI scraping / no ranking promises / no dashboard-first rewrite 等非目标
3. README、manual-steps、distribution-plan、roadmap、github-action docs 是否发生口径漂移
4. 是否真的降低了 first-run friction，而不是只增加了文档长度
5. 是否把“代码改动”和“手工激活步骤”分开说明
```

---

## 9. 建议同步落地一个仓库级 `AGENTS.md`

下面这段可以直接作为初稿，让 Codex 以后少跑偏。

```md
# AGENTS.md

## Mission
This repository’s near-term goal is not net-new product expansion.
Prioritize activation of existing distribution, trial, onboarding, and GitHub-native adoption surfaces.

## Canonical product description
AnswerLens is a CLI-first AI visibility auditor for product websites.
Tagline: CI for AI discoverability.
Public brand: AnswerLens.
Repository slug: ai-visibility-auditor.

## Hard non-goals
- No consumer AI UI scraping
- No ranking guarantees on answer surfaces
- No dashboard-first rewrite
- No connector work that outruns the core audit and validation story

## Working rules
- For any multi-file or ambiguous task, start with a plan before editing.
- Keep diffs scoped to one surface when possible: README, Action docs, Pages/release, or install narrative.
- Separate code changes from manual repository settings.
- Prefer activating existing scaffolding over introducing new features.
- Preserve brand consistency across README, distribution docs, roadmap, Action docs, and release copy.

## Verification
- Docs-only changes: verify consistency across README.md, docs/distribution-plan.md, docs/manual-steps.md, docs/github-action.md, docs/roadmap.md.
- Packaging/workflow changes: run:
  - corepack pnpm test
  - corepack pnpm build:site
  - corepack pnpm pack:cli:dry-run
- Demo/onboarding changes: run:
  - corepack enable
  - corepack pnpm install
  - corepack pnpm demo:fixture

## Done means
- The change improves at least one funnel step: discover, understand, trust, try, activate, share, or revisit.
- The change does not violate non-goals.
- The change includes a short note explaining which funnel step improved.
```

OpenAI 官方建议把稳定工作约定写进 `AGENTS.md`，并保持其简洁；如果工作流已经反复出现，再把它升级为 skill。[^codex-agents][^codex-best-review]

---

## 10. 推荐给 Codex 的 skill 候选清单（不是现在立刻做，而是跑顺后再做）

只有在本地流程已经跑顺后，再考虑把这些能力做成 `.agents/skills/`：

1. **docs-consistency-check**
   - 输入：改动后的 README / docs / roadmap / action docs
   - 输出：不一致点清单 + 建议修正
2. **release-surface-check**
   - 输入：release notes / README / manual steps
   - 输出：是否具备 Try now / Install / Action / Demo 四件套
3. **demo-verification**
   - 输入：仓库根目录
   - 动作：跑 `pnpm demo:fixture`，检查生成物是否完整
4. **action-adoption-sanity**
   - 输入：`docs/github-action.md`
   - 输出：外部消费仓库视角下的路径自洽性检查

OpenAI 在 OSS 维护的公开经验里，强调 repo-local skills + `AGENTS.md` + GitHub Action 的组合，能把验证、release 准备、examples 集成测试、PR review 这类重复工作转成稳定工作流；而“仓库定义的 verified 状态”最好被技能和 `AGENTS.md` 共同约束。[^oss-skills]

---

## 11. 这个仓库里，Codex 明确不要做什么

1. 不要把项目重写成 SaaS dashboard。[^repo-roadmap]
2. 不要把 README 改成“帮你在 ChatGPT 排第一”的话术。[^repo-roadmap]
3. 不要把 Search Console / Bing / manual-import 提前成首次试用主路径。[^repo-readme]
4. 不要把 provider coverage 扩大当成当前阶段的主线。[^repo-roadmap]
5. 不要为了自动化而自动化；先把本地/手动流程跑顺，再上 skill / automation / CI。[^codex-automations][^oss-skills]
6. 不要在一个线程里同时做 README、Action docs、release、workflow、site builder 的所有改动。优先 worktree 分拆。[^codex-app-features][^codex-worktree]
7. 不要在没有验证与 `/review` 的情况下就把改动当完成。[^codex-best-review]

---

## 12. 推荐的最小执行节奏

### 第一步：先用一个 planning 线程定里程碑
- 用 `/plan`
- 生成 4–6 个 milestone
- 标出哪些是 code，哪些是 repo settings

### 第二步：开 2–3 个 worktree 线程并行做独立 surface
- README / quickstart
- GitHub Action adoption
- Pages / release / install surface

### 第三步：每个线程完成后立即验证
- `corepack pnpm test`
- `corepack pnpm build:site`
- `corepack pnpm pack:cli:dry-run`
- 必要时 `corepack pnpm demo:fixture`

### 第四步：统一 review
- 用 diff pane 看关键文件
- `/review` 做一次总审
- 明确写出本次改动提升的漏斗步骤

### 第五步：把稳定规则沉淀回仓库
- `AGENTS.md`
- 如有必要，再做 `.agents/skills/`

---

## 13. 一句话给 Codex 的最终提醒

**这个仓库当前不是“缺更多功能”，而是“缺一个更完整的公开前门”。**  
请优先把已有能力、报告产物、Action、Pages、release 和 quickstart 串成一个对陌生访客更友好的转化链，而不是继续横向扩功能。

---

## 参考来源

[^codex-prompt]: OpenAI Developers, *Best practices – Codex*: 官方建议在 prompt 中明确 Goal / Context / Constraints / Done when，并按任务难度选择 reasoning level。<https://developers.openai.com/codex/learn/best-practices>
[^codex-plan]: OpenAI Developers, *Best practices – Codex*: 官方建议复杂任务先用 Plan mode，使用 `/plan` 先收集上下文并生成执行计划。<https://developers.openai.com/codex/learn/best-practices>
[^codex-agents]: OpenAI Developers, *Custom instructions with AGENTS.md*: Codex 会在开始工作前读取 `AGENTS.md`，支持全局/仓库/子目录分层覆盖。<https://developers.openai.com/codex/guides/agents-md>
[^codex-best-review]: OpenAI Developers, *Best practices – Codex*: 官方建议保持 config 稳定、approval/sandbox 默认收紧、要求 Codex 运行测试并在接受前 review；还支持 `/review`。<https://developers.openai.com/codex/learn/best-practices>
[^codex-app]: OpenAI Developers, *Codex app*: Codex app 是支持 parallel threads、worktrees、automations 和 Git 功能的桌面 command center。<https://developers.openai.com/codex/app>
[^codex-app-features]: OpenAI Developers, *Codex app features*: 官方建议用 Local / Worktree / Cloud 模式区分场景，并可在 diff pane 中直接 review / stage / revert / commit。<https://developers.openai.com/codex/app/features>
[^codex-worktree]: OpenAI Developers, *Worktrees – Codex app*: worktree 适合并行独立任务，避免不同线程互相污染。<https://developers.openai.com/codex/app/worktrees>
[^codex-automations]: OpenAI Developers, *Automations – Codex app*: automations 可在后台运行，并可与 skills 组合；Git 仓库可运行在独立 worktree 中。<https://developers.openai.com/codex/app/automations>
[^codex-security]: OpenAI Developers, *Agent approvals & security*: 默认网络关闭，本地有 OS-enforced sandbox，approval policy 控制何时需要人工确认。<https://developers.openai.com/codex/agent-approvals-security>
[^codex-slash]: OpenAI Developers, *Slash commands in Codex CLI*: `/fork` 可从当前对话分叉出新线程，用于探索替代方案而不丢失当前上下文。<https://developers.openai.com/codex/cli/slash-commands>
[^codex-subagents]: OpenAI Developers, *Subagents – Codex*: 可以显式要求 Codex 为不同检查点各开一个 subagent 并汇总结果。<https://developers.openai.com/codex/subagents>
[^codex-skills]: OpenAI Developers, *Agent Skills*: skills 用于封装可复用工作流，适合 task-specific capabilities。<https://developers.openai.com/codex/skills>
[^codex-longhorizon]: OpenAI Developers Blog, *Run long horizon tasks with Codex*: 复杂工作应拆为小 milestone，并给每个 milestone 明确 acceptance criteria、validation commands 与 stop-and-fix rule。<https://developers.openai.com/blog/run-long-horizon-tasks-with-codex>
[^oss-skills]: OpenAI Developers Blog, *Using skills to accelerate OSS maintenance*: OpenAI 在 OSS 维护中使用 repo-local skills、`AGENTS.md` 和 GitHub Action，把 verification / release prep / integration testing / PR review 变为可复用流程；本地流程稳定后再进 CI。<https://developers.openai.com/blog/skills-agents-sdk>
[^community-parallel]: Simon Willison, *Embracing the parallel coding agent lifestyle*: 并行 agent 特别适合 research、系统解释和小型维护任务，值得把有效解释沉淀为可复用上下文。<https://simonwillison.net/2025/Oct/5/parallel-coding-agents/>
[^repo-readme]: GitHub repo README（当前公开状态）显示：AnswerLens 的 tagline 为 `CI for AI discoverability`，定位为 `CLI-first AI visibility auditor for product websites`，并强调 no consumer UI scraping / no ranking promises。<https://github.com/YSCJRH/ai-visibility-auditor>
[^repo-dist]: `docs/distribution-plan.md` 明确写到：当前主要瓶颈是 public install surface、stable Action adoption path、Pages/homepage/public activation 等“启用问题”，而非缺少仓库内脚手架。<https://github.com/YSCJRH/ai-visibility-auditor/blob/main/docs/distribution-plan.md>
[^repo-manual]: `docs/manual-steps.md` 已列出 npm trusted publishing / Pages / homepage / social preview / topics 等最小人工步骤。<https://github.com/YSCJRH/ai-visibility-auditor/blob/main/docs/manual-steps.md>
[^repo-ghaction]: `docs/github-action.md` 当前 minimal workflow 仍引用 `examples/acme/*.yaml` 和 `actions/upload-artifact@v4`，更像本仓库 dogfooding，而不是外部 repo adoption 示例。<https://github.com/YSCJRH/ai-visibility-auditor/blob/main/docs/github-action.md>
[^repo-action]: 根 `action.yml` 已提供 `out-dir`、`share-summary-path`、`pr-snippet-path`、`run-json-path` 等稳定输出。<https://github.com/YSCJRH/ai-visibility-auditor/blob/main/action.yml>
[^repo-pkg]: `package.json` 要求 Node `>=22.0.0`，并定义了 `demo:fixture`、`build:site`、`pack:cli:dry-run`、`test` 等脚本。<https://github.com/YSCJRH/ai-visibility-auditor/blob/main/package.json>
[^repo-roadmap]: `docs/roadmap.md` 已把 no consumer AI UI scraping、no ranking guarantees、no dashboard-first rewrite、no connector-first drift 明确列为非目标。<https://github.com/YSCJRH/ai-visibility-auditor/blob/main/docs/roadmap.md>
