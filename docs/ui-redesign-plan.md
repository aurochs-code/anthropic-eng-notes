# learn.thinkloop.dev UI 改造方案（详细版）

> 仓库：aurochs-code/anthropic-eng-notes · 站点源码在 `site/`（Astro 5 静态站）
> 本文档只是方案，不包含任何代码改动。所有路径都相对于 `site/`，除非另有说明。

## 0. 已确认的决策

| # | 决策 | 结论 |
|---|------|------|
| 1 | 视觉方向 | **A · 暖色编辑风**：米白纸感底色、陶土橙强调色、标题用宋体 |
| 2 | 网络字体 | **可以引入** Google Fonts |
| 3 | 改动范围 | **外观和结构一起改**（含首页改版） |
| 4 | 默认主题 | **继续跟随系统**（保留 auto / light / dark 三态切换） |
| 5 | 重复提醒块 | **可以删除**正文里与 `source_note` 重复的 ⚠️ 引用 |
| 6 | 开发目录 / 提交方式 | 尚未确定，实施前再定（建议：开分支 `ui-redesign`，提 PR） |

---

## 1. 现状诊断

| # | 问题 | 位置 | 影响范围 |
|---|------|------|----------|
| 1 | 配色基本照搬 GitHub Primer（`#0d1117 / #d0d7de / #f6f8fa`），没有自己的识别度 | `src/styles.css` 第 2–4 行 | 全站 |
| 2 | 首页 26 条平铺：每条都有下划线橙色标题、英文标题、2–3 行摘要、一排标签、虚线分隔，第一屏没有"这是什么、从哪开始" | `src/pages/index.astro` | 首页 |
| 3 | `.en`（设为斜体）被用在中文说明上，中文被拉成伪斜体 | 首页、路线、论文列表、资源列表、标签列表、单个标签页共 6 处 | 列表页 |
| 4 | 链接一律强调色 + 下划线，列表标题也一样，噪音很大 | `a { color: var(--accent) }` | 全站 |
| 5 | 笔记页头部堆叠：面包屑 + 步骤胶囊 + 标题 + 英文名 + meta + 标签 + 提醒框 + 正文里重复的 ⚠️ 引用；手机上第一屏看不到正文 | `pages/notes/[slug].astro` + 2 篇 md | 笔记页 |
| 6 | 字号层级弱：h1 1.6rem；h2 带 GitHub 式下划线；正文列宽 760px（中文约 47 字/行，偏宽） | 正文样式 | 阅读 |
| 7 | 侧栏：顶部 5 个链接与顶栏重复；分组标题 13px 灰色；条目标题经常折成两行 | `components/Sidebar.astro` | 桌面端 |
| 8 | 标签胶囊出现在每个列表条目和笔记头部，占空间，对浏览帮助不大 | `components/TagList.astro` | 列表 / 笔记 |
| 9 | 路线页同时用了徽章方框、底色块、虚线、左边框，样式语汇不统一 | `pages/path.astro` | 路线页 |
| 10 | 表格、代码块、引用块、提醒框都是默认外观，圆角、底色、间距各不相同 | 正文 | 笔记页 |

---

## 2. 设计系统（所有改动的基础）

全部定义在 `src/styles.css` 顶部的 `:root`。**变量名尽量沿用现有的**（`--fg --muted --bg --bg-soft --line --accent --accent-soft --code --shadow`），这样 anim 组件、mermaid 高亮这些依赖变量的代码会自动跟着换色，不用改。新增的变量用新名字。

### 2.1 颜色

| 变量 | 用途 | 亮色 | 暗色 |
|------|------|------|------|
| `--bg` | 页面底色 | `#faf9f5`（米白纸感） | `#1a1915`（暖黑） |
| `--bg-soft` | 卡片、侧栏 hover、callout 底色 | `#f2efe6` | `#24221d` |
| `--surface` 新增 | 抬起的卡片（首页入口卡、翻页卡） | `#ffffff` | `#2a2823` |
| `--line` | 边框、分隔线 | `#e4dfd2` | `#3a372f` |
| `--line-strong` 新增 | 输入框、表头下边框 | `#cfc8b8` | `#4a463c` |
| `--fg` | 正文 | `#1f1e1b` | `#ece8de` |
| `--muted` | 次要文字 | `#6b665c` | `#a39d90` |
| `--accent` | 强调色（陶土橙） | `#c15f3c` | `#e08a63` |
| `--accent-strong` 新增 | 小号强调文字（满足 AA） | `#a94d2c` | `#eda07c` |
| `--accent-soft` | 选中底色、标记高亮 | `#f6e6dc` | `#3a2a21` |
| `--code` | 行内代码、代码块底色 | `#f0ece2` | `#211f1a` |
| `--ok` 新增 | 已读 ✓、完成态 | `#4f7a4a` | `#8fb987` |
| `--warn-bg` / `--warn-line` 新增 | 警告 callout | `#fbf1dc` / `#d9a441` | `#33291a` / `#c89a45` |

对比度自测（需在实施时用工具复核）：`--accent` 在 `--bg` 上约 5.3:1、暗色约 6.6:1，正文字可用；12–13px 的小字强调统一用 `--accent-strong`。

暗色要写三处，保持现有机制：`:root[data-theme="dark"]`，以及 `@media (prefers-color-scheme: dark) { :root:not([data-theme]) {...} }`（无 JS 兜底）。建议把暗色变量写一次，然后用 `:is()` 选择器合并这两处，避免两份色值不同步（现在第 3、4 行就是重复的）。

### 2.2 字体

| 角色 | 字体栈 | 来源 |
|------|--------|------|
| 标题（h1–h3、品牌字、首页大标题、模块标题） | `"Noto Serif SC", "Source Han Serif SC", "Songti SC", "STSong", serif` | Google Fonts，字重 600 / 700 |
| 正文、界面 | `-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", sans-serif`（不变，正文不加载网络字体，控制体积） | 系统 |
| 英文副标题（`.en`） | `"Source Serif 4", Georgia, serif`，斜体只用在这里 | Google Fonts，400 italic |
| 等宽 | `ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace` | 系统 |

加载方式（写在 `layouts/Base.astro` 的 `<head>` 里）：

```html
<!-- 必须放在主题内联脚本之后：check-site.mjs 会断言 localStorage.getItem('theme') 出现在第一个 <link rel="stylesheet"> 之前 -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@600;700&family=Source+Serif+4:ital,wght@1,400&display=swap">
```

- Google Fonts 对中文字体会按 `unicode-range` 自动切片，浏览器只下载页面用到的那几片，标题字数少，实际体积约一两百 KB。
- `display=swap`：字体到达前先用宋体 / 系统衬线显示，不会白屏。
- 风险：国内访问 `fonts.googleapis.com` 可能慢或不通。字体栈已有 `Songti SC / STSong` 兜底，最坏情况是标题回退成系统宋体，不影响可用性。如果后续发现国内访问占比高，可以换成自托管子集（这是后续可选项，不在本次范围）。

### 2.3 字号阶梯（正文基准 17px）

| token | 值 | 用在 |
|-------|----|------|
| `--fs-xs` | 12px | 徽章、kbd、计数 |
| `--fs-sm` | 14px | meta、侧栏、目录、说明 |
| `--fs-base` | 17px（移动端 16px） | 正文 |
| `--fs-lg` | 20px | h3、卡片标题 |
| `--fs-xl` | 26px | h2 |
| `--fs-2xl` | 34px（移动端 28px） | h1 |
| `--fs-hero` | 44px（移动端 32px） | 首页大标题 |

行高：正文 1.85，标题 1.3。中文排版加 `text-wrap: pretty`（不支持的浏览器自动忽略）。

### 2.4 间距、圆角、阴影、动效

- 间距：4 的倍数，`--sp-1`…`--sp-12` = 4 / 8 / 12 / 16 / 24 / 32 / 48。
- 圆角：`--r-sm: 6px`（按钮、kbd、代码）、`--r-md: 10px`（callout、表格容器）、`--r-lg: 16px`（卡片、对话框）。
- 阴影：`--shadow-sm: 0 1px 2px rgb(60 50 30 / .06), 0 1px 1px rgb(60 50 30 / .04)`（卡片静止）；`--shadow`（保留变量名，用于浮层），暗色下改用 `--line` 描边，阴影弱化。
- 动效：hover 统一 `.15s ease`；继续尊重 `prefers-reduced-motion`。

### 2.5 布局尺寸

| 项目 | 现在 | 改为 |
|------|------|------|
| 正文列宽 | 760px | **680px**（中文约 40 字/行） |
| 左侧栏 | 250–260px | 248px |
| 右目录 | 220px | 208px |
| 三栏断点 | ≥1200 | 不变（1200 / 768 两个断点保持，check-site 有断言） |
| 首页、列表页 | 与笔记页同宽 | 首页内容区放宽到 **880px**（入口卡片需要宽度），其他列表页 760px |

---

## 3. 全局组件规范

### 3.1 链接
- 正文链接（`main article a`）：颜色 `--accent-strong`，`text-decoration: underline`，`text-decoration-color: color-mix(in srgb, currentColor 35%, transparent)`，`text-underline-offset: 3px`；hover 时下划线变实色。
- 列表标题链接、卡片链接、导航链接：**不加下划线**，颜色 `--fg`，hover 变 `--accent`。
- 外链 `↗` 保留。

### 3.2 顶栏 `header.site`
- 高度 60px，底色 `color-mix(in srgb, var(--bg) 85%, transparent)` + 毛玻璃（保留现有做法），下边框 `--line`。
- 品牌位：左边放 28px 圆角方块 logo（复用 `public/favicon.svg`，改成新陶土色 `#c15f3c`），右边是衬线字的"Anthropic 工程笔记"（长短两种文案保持现有逻辑）。
- 主导航 `nav.top`：14px、`--muted`；当前项改为 `--fg` + 底部 2px `--accent` 指示条（`box-shadow: inset 0 -2px var(--accent)`），不再只靠颜色区分。
- 搜索按钮：圆角 999px 的胶囊，底色 `--bg-soft`，宽度 240px；主题按钮保持图标 + 文字。
- 阅读进度条 `.read-progress` 保留，颜色改 `--accent`，高度 2px。

### 3.3 侧栏 `components/Sidebar.astro`
- 顶部 5 个链接（`ul.side-top`）：**≥768px 时隐藏**（与顶栏重复）；**<768px 必须保留**，因为手机上 `nav.top` 是隐藏的，这里是唯一的全站导航入口。
- 分组标题 `summary`：改为 13px、字重 600、`--fg`，右侧显示"已读 / 总数"（如 `2/5`）。计数在 `lib/client/progress.ts` 的 `render()` 里顺带计算（遍历组内 `[data-note-link][data-read]`），给 `<summary>` 加一个 `<span class="side-count">`。
- 条目：单行，`white-space: nowrap; overflow: hidden; text-overflow: ellipsis`，在 `<a>` 上加 `title={完整标题}`；左侧编号 12px 等宽数字。
- 当前页：`--accent-soft` 底 + 左侧 2px `--accent` 条（替换现在整块底色 + 粗体）。
- 已读 ✓：现在是 `::after` 加 ✓，改为编号左边一个 6px 实心小圆点（`--ok` 色），未读是空心圆，单行布局下更整齐。

### 3.4 标签 `components/TagList.astro`
- 胶囊改成无边框：底色 `--bg-soft`，12px，`--muted`，前缀 `#`（如 `#agents`），hover 时 `--accent`。
- 从列表页条目里**移除**（首页、论文列表）；笔记页从头部**移到文末**（与"标记已读"放同一区域）。标签页本身不变。

### 3.5 徽章 `.badge`（路线页、列表页统一）
统一成实心浅底胶囊，去掉方框和虚线：

| 类型 | 底色 | 文字 |
|------|------|------|
| 笔记 | `--bg-soft` | `--muted` |
| 资源 `.badge.res` | `--accent-soft` | `--accent-strong` |
| 原理支线 `.badge.track` | 暗绿浅底 `color-mix(in srgb, var(--ok) 14%, transparent)` | `--ok` |
| 选读 | 透明 + 1px 虚线 `--line-strong` | `--muted` |

⚠️ 类名和文本不能改：check-site.mjs 用正则数 `badge">笔记 #` 和 `badge res">资源`。

### 3.6 Callout（提醒框）
新增统一组件样式 `.callout`，有两种变体：
- `.callout.warn`：`--warn-bg` 底 + 左侧 3px `--warn-line` + 圆角 `--r-md`，标题行"⚠ 原文已更新"（衬线字体、14px、粗体）。
- `.callout.info`：`--bg-soft` 底 + 左侧 3px `--accent`。

`source_note` 用 `<details class="callout warn">` 渲染：默认收起，只显示标题行和第一句；点开显示全文。原来的 `.note-box` 删除。

正文 markdown 里的 `> ⚠️ ...` 引用：在 `lib/remark-plugins.mjs` 里加一个小 remark 插件，把开头是 ⚠️ 的 blockquote 加上 `class="callout warn"`，这样 `claude-think-tool.md` 里那条"笔者核对注"也能用统一样式，而 md 文件不用改写法。

### 3.7 正文元素
- **h2**：去掉下边框；衬线 26px；上间距 2.4em；左侧 hover 锚点 `#` 保留。
- **h3**：衬线 20px，上间距 1.8em。
- **段落**：段间距 1em；正文颜色 `--fg`。
- **列表**：`li + li` 间距 .4em；`li::marker` 用 `--accent`。
- **引用块**：左侧 3px `--line-strong`，斜体去掉，`--muted`。
- **表格**：外包一层圆角容器（`--r-md`、1px `--line`、横向滚动保留）；表头 `--bg-soft` 底、13px、字重 600；行之间只用横线，去掉竖线；奇数行不加斑马纹（暖色底上斑马纹显脏）。
- **行内代码**：`--code` 底，`--accent-strong` 字色，13.5px。
- **代码块**：`--code` 底、圆角 `--r-md`、1px `--line`、内边距 16px；复制按钮改成悬停才出现（触屏设备常驻）。
- **mermaid 图**：外面加一个 `figure` 式容器（`--bg-soft` 底、圆角、内边距 16px），点击放大逻辑不动。mermaid 主题改用 `theme: 'base'` + `themeVariables`（从 CSS 变量读：`primaryColor = --bg-soft`、`lineColor = --muted`、`primaryTextColor = --fg`、`fontFamily` = 正文字体），让图和页面配色一致。⚠️ check-site 断言 `data-mermaid-theme` 为 `dark` / `default`，`lib/client/mermaid.ts` 里写这个 dataset 时保持原值即可（只换传给 mermaid 的 theme 参数）。
- **anim 组件**：只用变量，不需要改；实施后逐个目测（5 个分镜：attention-weights、context-window、gpipe-bubble、ppo-clip、agent-loop-steps）。

### 3.8 翻页卡片 `nav.pager`
- 两张卡片：`--surface` 底、`--r-lg` 圆角、`--shadow-sm`，hover 时边框变 `--accent` 并上移 1px。
- 小字（"← 上一篇 #3"）12px `--muted`，标题用衬线 16px，最多两行截断。
- "按学习路线"那组（`.route-pager`）做成一条细长横条放在编号翻页下方，降低视觉权重。

---

## 4. 页面方案

### 4.1 首页 `pages/index.astro`（结构改版）

**目标结构：**

```
┌─────────────────────────────────────────────────────────┐
│  Anthropic 工程博客 · 中文学习笔记          ← 衬线 44px   │
│  26 篇工程博客精读 + 30 篇经典论文 + 外部课程导读，         │
│  按 4 个阶段、36 步串成一条学习路线。         ← 17px muted │
│                                                         │
│  ┌────────────────────────┐  已完成 12 / 36 步           │
│  │ 继续阅读 · 第 13 步  →  │  ▓▓▓▓▓▓░░░░░░░░             │
│  │ 上下文工程…             │                              │
│  └────────────────────────┘                              │
├──────────────┬──────────────┬──────────────┬────────────┤
│ 📘 笔记       │ 🧭 学习路线   │ 📄 论文笔记   │ 🔗 资源导读  │
│ 26 篇         │ 4 阶段 36 步  │ 30 篇        │ 9 个        │
│ 一句说明       │ 一句说明      │ 一句说明      │ 一句说明     │
├──────────────┴──────────────┴──────────────┴────────────┤
│ A  智能体设计与架构                          5 篇 · 已读 2 │
│ ─────────────────────────────────────────────────────── │
│ ● 01  构建高效的智能体：从简单可组合的模式出发     16 分钟 │
│        Anthropic 把"智能体系统"分为预先编排的工作流和… (单行)│
│ ○ 16  我们如何构建多智能体研究系统               13 分钟 │
│        …                                               │
│ B  工具与 MCP ……                                        │
└─────────────────────────────────────────────────────────┘
```

**1）Hero 区**
- 大标题用衬线体；下面一句话定位（文案见上图，数字从数据里算，不写死）。
- "继续阅读"按钮（`--accent` 实心、白字、`--r-md`）：
  - 实现：在 `index.astro` 里调用 `getMainSequence()`，把主线每一步的 `{ n, pid, title, href }` 序列化到 `<script type="application/json" id="route-seq">`；在 `lib/client/progress.ts` 的 `render()` 末尾加一段：找第一个没完成的步，填进按钮的 href 和文字；全部完成时显示"已读完全部 36 步 · 回顾路线"。
  - 没有任何进度时显示"从第 1 步开始"。
  - pid 规则直接用 `lib/resources.ts` 的 `progressId`，跟路线页勾选框是同一份数据。
- 右侧的进度条复用现有 `.progress-card` 的结构和 `data-progress-*` 属性，或者单独加一个 `data-progress-home` 由上面那段代码填充（推荐后者，免得和路线页的分组逻辑耦合）。
- 没有 JS 时：按钮显示"从第 1 步开始"（服务端默认渲染），进度条隐藏。

**2）四个入口卡片**
- `--surface` 底、`--r-lg`、`--shadow-sm`，4 列网格（≥1024）→ 2 列（≥600）→ 1 列。
- 每张：小图标（内联 SVG 线性图标，不用 emoji）、名称（衬线 18px）、数量（大号数字 28px）、一句说明（14px muted）。
- 数量全部从数据计算：笔记数、主线步数、论文数、资源数。

**3）模块列表**
- 模块标题：大号字母 `A`（衬线 32px，`--accent`）+ 模块名（衬线 22px）+ 右侧"5 篇 · 已读 2"。
- 条目：
  - 第一行：已读圆点 + 编号（等宽数字 `--muted`）+ 标题（`--fg` 无下划线，17px 字重 500）+ 右对齐阅读时长。
  - 第二行：摘要单行截断（`-webkit-line-clamp: 1`），14px `--muted`。
  - 英文标题、标签从首页移除（在笔记页可见）。
  - 整行可点（标题 `<a>` 用 `::after { position:absolute; inset:0 }` 扩大点击区），hover 时整行 `--bg-soft` 底。
  - 条目之间用 1px `--line` 实线，去掉虚线。
- ⚠️ check-site 兼容：保留 `<h2>模块 X …` 文字前缀（正则 `<h2[^>]*>模块 ([A-F])`），所以大字母要写在 `<h2>` 内部且以"模块 A"开头，可以视觉上把"模块 "用 `.sr-only` 之类的样式藏掉，或者直接改 check 正则；摘要的 `<p class="sum zh">` 保留这个类名（断言 26 条）。

**4）去掉"共 26 篇规划，已完成 26 篇"这句**（规划已经全部完成，这句信息过时）。

### 4.2 笔记页 `pages/notes/[slug].astro`

**新的头部顺序：**

```
笔记 › 模块 A · 智能体设计与架构                 [ 阶段 1 · 第 2 步 ]
构建高效的智能体：从简单可组合的模式出发          ← 衬线 34px
Building effective agents                      ← Source Serif 斜体 17px muted
模块 A · 2024-12-19 发布 · 阅读 16 分钟 · Erik S., Barry Zhang · 原文 ↗   ← 单行 14px
┌ ⚠ 原文已更新 · 在线原文顶部已加注：文中描述的工具生态…  [展开] ┐  ← 折叠 callout
└──────────────────────────────────────────────────────────┘
────────────────────────────── (正文开始)
```

- 面包屑去掉 `#1`（与 meta 重复）；步骤胶囊保留（check-site 依赖 `.breadcrumb [data-route-step]`）。
- meta 合并为一行，用 `·` 分隔，加上 `authors_en`（frontmatter 里已有）。现在的"#1 · 模块 A 智能体设计与架构"去掉"#1"。
- 标签移到文末。
- `source_note` → 折叠 callout（见 3.6）。
- 移动端：头部总高度目标 ≤ 一屏的 45%，确保第一屏能看到正文开头。

**文末区域（新的顺序）：**
1. 标签行（`#agents #workflows …`）
2. "标记为已读"主按钮（`--accent` 实心；已读态改为 `--ok` 描边 + ✓）+ 说明文字
3. 反向链接卡片（`section.backlinks` 保留类名，样式改为 `--bg-soft` 底、无边框、`--r-lg`）
4. 编号翻页卡片
5. 路线翻页细条

**论文页 `papers/[slug].astro`、资源页 `resources/[slug].astro`** 使用同一套头部和文末样式（它们已经共用 `.breadcrumb / .en / .meta / .note-box / dl.facts`），只需同步改模板里的类名。`dl.facts`（资源/论文的信息表）改成两列小卡片：`--bg-soft` 底、`--r-md`，键 `--muted` 13px。

### 4.3 学习路线 `pages/path.astro`

- 顶部进度卡 `.progress-card`：`--surface` 卡片 + 大号数字"12 / 36"（衬线 32px）+ 粗进度条（8px，圆角，`--accent`）；说明文字缩成一行，详细说明放进 `title` 或折叠。
- 每个阶段改成**时间线样式**：
  - 左侧一条 2px 竖线（`--line`），每一步是线上的一个节点：未完成空心圆，完成实心 `--ok` 圆（复选框 `.done-box` 保留，用 `appearance: none` 自绘成圆形节点，`accent-color` 不再需要）。
  - 阶段标题：衬线 26px "阶段 1 · 入门"，下面一行目标说明 + 阶段进度条（宽 200px，右侧数字）。
  - 资源条目：去掉整块底色，只靠 `.badge.res` 徽章区分。
  - 选读条目：节点改为虚线小圆，文字 `--muted`。
- 原理支线：整个区块放进 `--bg-soft` 底的圆角面板，节点用 `--ok` 色系，与主线区分；去掉现在的左侧 3px 橙色边框。
- `#step-N` 锚点跳转时的高亮（`li:target`）改为 `--accent-soft` 底色闪一下（1.2s 动画后淡出），替换现在的描边。
- ⚠️ 保留：`<li class="res"` 的写法、`data-shown-step / data-declared-step / data-track / data-track-item / data-progress-*` 等所有 data 属性、`badge">笔记 #` 文本。

### 4.4 论文列表 `pages/papers/index.astro`
- 与首页模块列表用同一种条目样式（编号 `D01`、标题、阅读时长、单行摘要）。
- 英文标题 + 期刊放到摘要上方一行小字（`--muted` 13px），删掉标签。
- "30u30 单元 ↗"外链改成条目右侧的小图标链接。

### 4.5 资源列表 `pages/resources/index.astro`
- 每个资源一张卡片（2 列网格）：类型徽章（course / article / repo…）+ 标题 + provider + 预计时长 + 单行摘要；`status: archived / dated` 时右上角显示灰色"已归档 / 可能过时"标记。

### 4.6 标签 `pages/tags/index.astro`、`pages/tags/[tag].astro`
- 标签云：按使用次数分 3 档字号（14 / 16 / 19px），同一种无边框胶囊。
- 单个标签页：复用首页条目样式，按"笔记 / 论文 / 资源"三组列出。

### 4.7 404 `pages/404.astro`
- 居中的衬线大字"404"（`--accent`）+ 一句话 + 两个按钮（回首页 / 打开搜索）。

### 4.8 搜索弹窗
- 对话框圆角 `--r-lg`，输入框去掉 2px 橙色粗边，改成 1px `--line-strong` + 聚焦时 `--accent` 外发光（`box-shadow: 0 0 0 3px var(--accent-soft)`）。
- 结果条目：去边框，hover / 选中时 `--bg-soft` 底；标题衬线；高亮 `mark` 用 `--accent-soft` 底。

### 4.9 页脚
- 两列：左边"学习笔记，非翻译；原文版权归 Anthropic 所有"，右边 GitHub 仓库链接 + "最近更新 2026-10-xx"（取构建时间）。字号 13px，上边框 `--line`，宽度与内容区对齐。

---

## 5. 内容文件改动

| 文件（相对仓库根目录） | 改动 |
|------|------|
| `notes/building-effective-agents.md` 第 17 行 | 删除 `> ⚠️ 原文已被更新过（见 frontmatter 中的 source_note）…`，与 `source_note` 完全重复 |
| `notes/claude-code-best-practices.md` 第 16 行 | 删除 `> ⚠️ **重要说明**：原博文已改为持续更新的官方文档…`。这条比 `source_note` 多两点信息："依据 2026-10-17 读取的文档版本撰写"和"命令、参数以官方文档为准"。删之前先把这两句并入 frontmatter 的 `source_note`，避免信息丢失 |
| `notes/claude-think-tool.md` 第 65 行 | **保留**。这是正文中段的"笔者核对注"，与 `source_note` 无关，交给 3.6 里的 remark 插件自动套 callout 样式 |

另外还有 41 个文件有 `source_note`，不需要改，统一走新的折叠 callout。

---

## 6. 涉及文件清单

| 文件 | 改动类型 | 主要内容 |
|------|----------|----------|
| `src/styles.css` | 重写大部分 | 设计 token、全局组件、各页面样式（预计从 336 行到 ~480 行；anim 部分 120 行基本不动） |
| `src/layouts/Base.astro` | 小改 | 字体 `<link>`（放在主题脚本之后）、品牌 logo、页脚 |
| `src/pages/index.astro` | 重写 | Hero、入口卡片、模块列表、主线序列 JSON |
| `src/pages/notes/[slug].astro` | 中改 | 头部重排、callout、标签移到文末 |
| `src/pages/papers/[slug].astro`、`src/pages/resources/[slug].astro` | 中改 | 同上 |
| `src/pages/path.astro` | 中改 | 时间线结构（保留所有 data 属性和断言文本） |
| `src/pages/papers/index.astro`、`resources/index.astro`、`tags/*.astro`、`404.astro` | 小改 | `.en` → `.lede`，套统一条目样式 |
| `src/components/Sidebar.astro` | 小改 | 计数 span、`title` 属性、side-top 的响应式隐藏 |
| `src/components/TagList.astro` | 小改 | `#` 前缀 |
| `src/lib/client/progress.ts` | 小改 | 继续阅读按钮、首页进度、侧栏分组计数 |
| `src/lib/client/mermaid.ts` | 小改 | `theme: 'base'` + `themeVariables`（保留 `data-mermaid-theme` 的值） |
| `src/lib/remark-plugins.mjs` | 新增一个小插件 | ⚠️ 引用块 → `.callout.warn` |
| `public/favicon.svg` | 换色 | `#b4532a` → `#c15f3c`，字体改衬线 |
| `scripts/check-site.mjs` | 视情况小改 | 只在首页 h2 结构确实变了时更新正则；其他断言应全部原样通过 |
| `notes/*.md`（仓库根目录） | 删 2 处 | 见第 5 节 |

**不改**：`content.config.ts`、`lib/notes.ts / papers.ts / resources.ts / tags.ts / backlinks.ts`、`search.ts`、`chrome.ts`、`src/anim/**`、`astro.config.mjs`、部署 workflow。

---

## 7. 实施顺序（每一步都能单独构建、单独验收）

| 阶段 | 内容 | 验收 |
|------|------|------|
| **S1 · 设计 token + 字体** | 只换 `:root` 变量、引字体、改 h1–h3 / 链接 / `.en` → `.lede` | 全站换色生效，暗色正常，`npm run check` 全绿 |
| **S2 · 全局组件** | 顶栏、侧栏、标签、徽章、callout、表格、代码块、翻页卡片、搜索弹窗、页脚 | 笔记页对照第 3 节逐项检查 |
| **S3 · 笔记 / 论文 / 资源详情页** | 头部重排、文末重排、remark callout 插件、删 2 处重复提醒 | 390px 宽度下第一屏能看到正文第一段 |
| **S4 · 首页改版** | Hero、继续阅读、入口卡片、模块列表 | 无进度 / 部分进度 / 全部完成三种状态都正确；无 JS 时可用 |
| **S5 · 路线页时间线** | 时间线、自绘复选节点、支线面板 | 勾选、清除、多标签页同步都正常；`#step-N` 跳转高亮 |
| **S6 · 其余列表页 + 404** | 论文 / 资源 / 标签 / 404 | 与首页条目视觉一致 |
| **S7 · 全面验证** | 见第 8 节 | 全部通过后提 PR |

建议每个阶段一个 commit，方便回退。

---

## 8. 验证清单

1. `npm run build && npm run check`：现有全部断言通过（重点：首页 A–F 分组 26 条摘要、路线 36 步、三处目录一致、主题切换 + mermaid 重渲染、首屏无闪烁、标记已读、学习进度）。
2. `npm run screenshots`：改造前后各截一次（1280 和 390 两档），把首页、笔记、路线、资源对比图放进 PR 描述。另外手动补截暗色和 1024px（抽屉模式）。
3. 对比度：用 axe 或 Chrome DevTools 检查正文、`--muted`、`--accent-strong` 小字、徽章文字都达到 WCAG AA（4.5:1）。
4. mermaid：随机抽 5 篇有图的笔记，亮 / 暗两种主题下检查连线和文字是否清楚，放大对话框是否正常。
5. anim：5 个动画组件在两种主题下逐个检查。
6. 字体：断网或屏蔽 `fonts.googleapis.com` 后，标题回退到系统宋体，布局不跳动、不错位。
7. 性能：Lighthouse 移动端性能分不低于改造前；比较首页传输体积（字体增量预计 ≤ 200KB）。
8. 键盘：Tab 顺序、`:focus-visible` 外框、搜索快捷键（Ctrl/⌘ K、`/`）、抽屉的焦点陷阱都正常。

---

## 9. 风险与对策

| 风险 | 对策 |
|------|------|
| Google Fonts 在国内加载慢或不通 | 字体栈带 `Songti SC / STSong` 兜底 + `display=swap`；以后需要时再改成自托管子集 |
| check-site 断言依赖 HTML 结构（类名、正则文本） | 第 3.5、4.1、4.3 节已列出必须保留的类名和文本；确实要改结构时同步改 check 正则，不要删断言 |
| 暗色变量在两处重复定义，容易漏改 | 合并成一处 `:is()` 选择器（见 2.1） |
| 首页"继续阅读"依赖 localStorage | 读写都已有 try/catch；没有存储时按"无进度"处理，服务端默认渲染"从第 1 步开始" |
| 改动面大，一次性 PR 不好审 | 按第 7 节分 commit；PR 描述附前后截图 |

---

## 10. 实施前还需要确认

1. **开发目录**：在本机哪个目录克隆仓库来改？（`~/Documents/workspace/` 下目前没有这个仓库）
2. **提交方式**：建议开分支 `ui-redesign` 提 PR，审完再合并并手动触发部署 workflow。还是直接推 main？
3. **首页 hero 文案**：本方案的草拟文案是"26 篇工程博客精读 + 30 篇经典论文 + 外部课程导读，按 4 个阶段、36 步串成一条学习路线"。可以直接用，也可以换成你自己的说法。
