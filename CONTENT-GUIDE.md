# 内容规范（改版后）

本文对应站点代码：`site/src/content.config.ts`（字段校验）、`site/src/pages/`（页面）、`site/src/lib/`（目录/路线/标签/反向链接的数据来源）、`site/scripts/check-site.mjs`（检查）。字段和行为以代码为准，代码改了请同步改本文。

**结论先说：改版不需要新增字段。** 现有 notes / resources 的 frontmatter 全部通过校验，原有字段也都不用改名。下面的“必须改”只有一条（一个被静默丢弃的字段），其余都是建议。

## 一、frontmatter 字段

### 1. 笔记 `notes/*.md`

笔记 schema 不是严格模式：**写了不认识的字段不会报错，而是在构建时被静默丢弃**（见第三节的问题清单）。

| 字段 | 类型 | 必填 | 用在哪里 | 示例 |
|---|---|---|---|---|
| `title_zh` | 字符串 | 必填 | 笔记页标题、浏览器标题、首页/侧栏/路线页/标签页/反向链接/上下篇里的链接文字 | `"构建高效的智能体：从简单可组合的模式出发"` |
| `title_en` | 字符串 | 必填 | 笔记页标题下方、首页卡片第一行 | `"Building effective agents"` |
| `slug` | 字符串，`^[a-z0-9-]+$` | 必填，**须与文件名一致** | 网址 `/notes/<slug>/`、学习进度 id `n:<slug>`、资源的 `pairs_with` / `route.after` 引用 | `building-effective-agents` |
| `module` | `A`–`F` 开头，如 `A` 或 `A-agent-design` | 必填 | 只取首字母：首页分组、侧栏分组、面包屑、标签页的“模块 X” | `A` |
| `order` | 整数 1–26，不可重复 | 必填 | 全站编号 `#N`、首页/侧栏排序、“按编号”上下篇；决定学习路线阶段（1–4 入门、5–16 体系、17–23 实战、24–26 前沿，区间写在 `site/src/data/stages.ts`） | `1` |
| `source_url` | URL | 必填 | 笔记页“原文链接 ↗” | `"https://www.anthropic.com/engineering/building-effective-agents"` |
| `published` | 日期 `YYYY-MM-DD` | 必填 | 笔记页“原文发布” | `2024-12-19` |
| `summary` | 字符串 | 必填 | 首页卡片（全文显示，不截断）、`<meta name="description">` 和 `og:description`、标签页条目 | 见第二节长度建议 |
| `tags` | 字符串数组 | 必填（可为空数组） | 笔记页、首页的标签胶囊；`/tags/` 和 `/tags/<slug>/` | `[agents, workflows, agentic-systems, design-patterns, tool-design, aci]` |
| `reading_time` | 正数（分钟） | 必填 | 笔记页“阅读约 N 分钟”、首页、路线页、标签页。**手填，不自动计算** | `15` |
| `source_note` | 字符串 | 可选 | 笔记页顶部的 ⚠️ 提示框 | `"原文顶部已加注：……"` |
| `authors_en` | 字符串数组 | 可选 | 只做校验，**目前没有页面显示** | `["Erik S.", "Barry Zhang"]` |
| `notes_updated` | 日期 | 可选 | 只做校验，**目前没有页面显示** | `2026-10-17` |

### 2. 资源导读 `resources/r-*.md`

资源 schema 是严格模式：**写了不认识的字段会直接构建失败**。另外构建时还会校验：`slug` 与文件名一致、`pairs_with` 和 `route.after` 必须是现有笔记 slug、主线 `step` 不重复。

| 字段 | 类型 | 必填 | 用在哪里 | 示例 |
|---|---|---|---|---|
| `title_zh` | 字符串 | 必填 | 资源页标题，以及路线页、资源列表、标签页、反向链接里的链接文字 | `"30u30：30 篇经典 AI 论文（原理支线）"` |
| `slug` | `^r-[a-z0-9-]+$`，与文件名一致 | 必填 | 网址 `/resources/<slug>/`、进度 id | `r-30u30` |
| `kind` | `course` / `article` / `guide` / `repo` / `cookbook` / `blog` / `catalog` | 必填 | 资源列表、资源页“类型” | `repo` |
| `stage` | 整数 1–4 | 必填 | 资源列表按阶段分组、资源页面包屑和“主阶段”；`route` 条目没写 `stage` 且 `after: null` 时，也用它决定放进哪个阶段 | `2` |
| `route` | 数组，至少 1 条，见下表 | 必填 | 学习路线页（主线步骤、选读、支线），资源页“路线位置”，路线翻页 | 见下 |
| `source_url` | URL | 必填 | 资源页“原文链接” | `"https://github.com/Ojhaharsh/30u30"` |
| `provider` | 字符串 | 必填 | 资源列表、资源页 | `"30u30（Harsh Ojha）"` |
| `last_checked` | 日期 | 必填 | 资源页“核实：日期” | `2026-10-18` |
| `status` | `active` / `archived` / `dated` | 必填 | 资源列表、资源页“状态” | `active` |
| `summary` | 字符串 | 必填 | 资源列表、meta description、标签页 | — |
| `pairs_with` | 笔记 slug 数组（可为空） | 必填 | 资源页“搭配笔记”；**被搭配的笔记页底部的反向链接**（标注“搭配笔记”） | `[building-effective-agents]` |
| `tags` | 字符串数组 | 必填 | 资源页标签胶囊、`/tags/` | `[papers, transformer]` |
| `title_en` | 字符串 | 可选 | 资源页标题下方 | `"30u30: 30 Foundational AI Papers in 30 Days"` |
| `optional` | 布尔 | 可选 | 整个资源都是选读：所有 route 条目都不占步号 | `true` |
| `source_url_zh` | URL | 可选 | 资源页“中文版 ↗” | — |
| `authors_en` | 字符串数组 | 可选 | 只做校验，目前没有页面显示 | `["Harsh Ojha"]` |
| `published` | 日期 | 可选 | 资源页“发布” | — |
| `cost` | 字符串 | 可选 | 资源页“费用” | `"免费、开源"` |
| `license_note` | 字符串 | 可选 | 资源页“许可” | — |
| `estimated_hours` | 正数 | 可选 | 资源列表、资源页“估计投入约 N 小时” | `133` |
| `source_note` | 字符串 | 可选 | 资源页提示框 | — |
| `track` | 目前只有 `theory` | 可选 | 写了就不进主线，在路线页单独渲染为「原理支线」；这个资源的所有 route 条目都必须写 `optional: true`，且不写 `step` | `theory` |

`route` 条目（严格模式）：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `part` | 字符串 | 必填 | 路线页、资源页显示的“这一步读什么” |
| `after` | 笔记 slug 或 `null` | 必填（必须显式写出） | 排在哪篇笔记之后；`null` 表示排在所属阶段开头 |
| `step` | 正整数 | 非选读条目必填，选读或支线条目不能写 | 主线步号（全站 1–36 连续、不重复，检查脚本会核对） |
| `stage` | 1–4 | 可选 | 条目所属阶段，优先级：`route.stage` → `after` 笔记所在阶段 → 资源的 `stage`。支线条目据此显示“对应主线 X 阶段” |
| `optional` | 布尔 | 可选 | 选读：显示为“选读”，不占步号，不计入进度 |

**改动时要注意的副作用（学习进度存在读者本机）：**
- 进度 id：笔记是 `n:<slug>`；资源主线条目是 `r:<slug>:<route 下标>`；支线条目是 `t:<slug>:<route 下标>`。
- 因此**改笔记或资源的 slug、调整资源 `route` 的条目顺序或在中间插入条目**，读者已经勾选的进度会对不上（不会报错，只是那几步变回未勾选）。新增条目尽量追加在 `route` 末尾。
- slug 同时也是网址，改 slug 还会让外链失效。

## 二、改版用到、内容侧可以配合的地方

| 项 | 现状（代码怎么用） | 建议 |
|---|---|---|
| summary 长度 | 首页卡片全文显示、不截断；同时作为 meta description 和分享摘要。现有长度 98–238 字，中位数 161 | **建议** 80–160 字；超过 160 字的首页卡片会很长，搜索引擎和分享卡片也只显示前面一段 |
| 标签 | 162 个标签，其中 128 个只用了 1 次；`/tags/` 每个标签一页（162 页，不进搜索） | **建议** 合并 5 组近义写法；资源的标签不要重复 `kind`/`status`/许可类信息（这些已有专门字段显示）；只出现一次、以后也不会复用的细粒度标签可以删掉或并入大类。不合并也不影响构建和检查 |
| 标题层级 | 正文 h2–h4 自动生成锚点 id；**本页目录只收 h2、h3**（右栏、折叠目录、手机抽屉三处一致）；页面 h1 由 `title_zh` 生成 | **必须**不写正文 `# H1`、不跳级（h2 后直接 h4）。现有内容已全部符合，无需改 |
| mermaid | 站点按浅色/深色主题渲染，切换主题时重新渲染；点击可放大；图里的文字**不进搜索** | **必须**不写 `%%{init: ...}`（会覆盖站点主题），不写死 `fill`/`color`/`stroke` 颜色或 `classDef`（深色下可能看不清）。现有 97 个图均符合。**建议**图中的关键术语在正文里也出现一次，否则搜不到 |
| 长 URL | 全站已设 `overflow-wrap:anywhere`，手机 390px 不会溢出（检查脚本逐页核对） | **建议**写成 `[描述](URL)` 或 `<URL>`；现有内容没有超过 60 字符的裸 URL |
| 阅读时长 | `reading_time` 手填，不自动计算 | **建议**按实际估。按中文约 400 字/分钟、英文约 200 词/分钟粗估，现有值是估算的 1–2.2 倍（笔记较密，可以理解）；偏差超过 2 倍的 3 篇可核对一下。是否改成自动计算需要改代码，内容侧不用动 |
| 站内链接 | 正文里指向 `xxx.md` / `notes/xxx.md` / `resources/r-xxx.md` 的链接，构建时改写为站内网址；**这些链接加上资源的 `pairs_with` 就是“反向链接”的数据来源** | 想让 A 页底部显示“B 引用了本篇”，就在 B 的正文里用 `.md` 相对链接指向 A，不要写站点绝对网址 |
| 搜索 | Pagefind 索引笔记页、资源页和路线页的正文；首页、资源列表、标签页不进索引；面包屑、翻页、反向链接、标记已读等页面框架不进索引 | 不用管 |

## 三、现有内容问题清单（脚本统计，2026-10-18）

统计脚本：`/workspace/content-audit/audit.mjs`（仓库外，只读内容文件）。共 **27 条**：必须改 1 条，建议 26 条（summary 18、阅读时长 3、标签近义 5 组）。另外标题跳级、正文 H1、mermaid 写死主题或颜色、长裸 URL 均为 0 条。

### 必须改（1 条）

| 文件 | 问题 |
|---|---|
| `notes/claude-code-best-practices.md:8` | `source_url_current` 不是笔记字段，构建时被静默丢弃，页面上看不到。若想显示“现行文档地址”，可以写进 `source_note` 文字里，或者请开发者加字段；否则删掉这一行 |

### 建议：summary 超过 160 字（18 条）

| 文件 | 长度 |
|---|---|
| `notes/a-postmortem-of-three-recent-issues.md` | 238 字 |
| `notes/redesigning-source-control.md` | 238 字 |
| `notes/april-23-postmortem.md` | 224 字 |
| `notes/how-we-contain-claude.md` | 224 字 |
| `notes/building-c-compiler.md` | 213 字 |
| `notes/claude-code-sandboxing.md` | 204 字 |
| `notes/managed-agents.md` | 203 字 |
| `notes/claude-code-auto-mode.md` | 200 字 |
| `notes/ai-resistant-technical-evaluations.md` | 180 字 |
| `resources/r-30u30.md` | 178 字 |
| `notes/advanced-tool-use.md` | 172 字 |
| `notes/eval-awareness-browsecomp.md` | 171 字 |
| `resources/r-deeplearning-ai-short-courses.md` | 169 字 |
| `notes/harness-design-long-running-apps.md` | 168 字 |
| `notes/swe-bench-sonnet.md` | 168 字 |
| `notes/infrastructure-noise.md` | 167 字 |
| `notes/multi-agent-research-system.md` | 164 字 |
| `notes/effective-harnesses-for-long-running-agents.md` | 161 字 |

### 建议：reading_time 与字数估算相差超过 2 倍（3 条）

| 文件 | reading_time | 估算 |
|---|---|---|
| `notes/advanced-tool-use.md` | 13 | 约 6 分钟（2042 汉字 + 221 英文词） |
| `notes/contextual-retrieval.md` | 12 | 约 5 分钟（1523 汉字 + 161 英文词） |
| `notes/demystifying-evals-for-ai-agents.md` | 20 | 约 9 分钟（3299 汉字 + 231 英文词） |

### 建议：标签近义写法合并（5 组）

| 组 | 出现位置 | 建议统一为 |
|---|---|---|
| `workflows` / `workflow` | building-effective-agents / claude-code-best-practices | `workflows` |
| `subagents` / `sub-agents` | claude-code-best-practices、multi-agent-research-system / effective-context-engineering-for-ai-agents | `subagents` |
| `sandbox` / `sandboxing` | managed-agents、how-we-contain-claude、r-openai-cookbook / claude-code-sandboxing、code-execution-with-mcp | `sandbox` |
| `context-window` / `context-windows` | r-12-factor-agents / effective-harnesses-for-long-running-agents | `context-window` |
| `coding-agents` / `coding-agent` | r-simon-willison / swe-bench-sonnet | `coding-agents` |

另：以下资源标签与已有字段重复，可删（同样只是建议）：`course`、`article`、`guide`、`repo`、`cookbook`、`blog`、`catalog`（重复 `kind`），`archived`、`dated`（重复 `status`），`cc-by-nc-nd`（已写在 `license_note`）。涉及 `r-deeplearning-ai-short-courses`、`r-hf-agents-course`、`r-anthropic-courses`、`r-chip-huyen-agents`、`r-12-factor-agents`、`r-30u30`、`r-openai-cookbook`、`r-simon-willison`、`r-lilian-weng-llm-agents`。

## 四、页面上的说明文字：写在哪里

下面这些文字目前都**写死在代码里，内容文件控制不了**；要改请找开发者，或直接改对应文件：

| 文字 | 位置 |
|---|---|
| 站点描述（首页、路线页、资源列表、标签页等没有 summary 的页面用作 meta description） | `site/src/layouts/Base.astro`（`SITE_DESC`） |
| 首页介绍“共 26 篇规划，已完成 N 篇……” | `site/src/pages/index.astro`（N 自动统计） |
| 模块 A–F 名称 | `site/src/content.config.ts`（`MODULES`） |
| 路线页介绍、进度说明（“进度只保存在本机浏览器……”） | `site/src/pages/path.astro` |
| 四个阶段的名称、目标、order 区间 | `site/src/data/stages.ts` |
| 支线名称“原理支线”及其起止阶段 | `site/src/lib/resources.ts`（`TRACKS`） |
| 笔记页“标记为已读”旁的提示 | `site/src/pages/notes/[slug].astro` |
| 资源列表、标签页的介绍 | `site/src/pages/resources/index.astro`、`site/src/pages/tags/index.astro` |

现在不需要内容侧补说明文字。如果希望由内容作者自己维护首页或路线页的介绍文字，需要另外做一个内容入口（例如一个 md 文件），这不在本次改版范围内。

## 五、不用管（自动生成）

- 标题锚点 id、`#` 链接、三处本页目录。
- 侧栏、首页分组和排序、两种上下篇、面包屑。
- 路线步号的显示、勾选框、阶段完成度（步号本身仍由资源 `route.step` 和笔记 `order` 决定）。
- 反向链接（来自正文的 `.md` 链接和 `pairs_with`）、`/tags/` 和每个标签的页面、标签 slug（小写，空格换成 `-`）。
- 搜索索引、代码块复制按钮、mermaid 的浅色/深色渲染和放大、阅读进度条、回到顶部、favicon 和分享 meta。

## 六、提交前自查

```bash
cd site
npm run build     # 字段校验失败会在这里报错，带文件名和字段
npm run check     # 步号、死链、标签/反向链接、390px 溢出、搜索召回等
```
