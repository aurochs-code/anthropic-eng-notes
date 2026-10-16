# Anthropic 工程博客中文学习笔记 · 总体大纲（审阅稿）

> 状态：草稿，仅供内部审阅，未发布。
> 来源：Anthropic Engineering Blog — <https://www.anthropic.com/engineering>
> 抓取与核对时间：2026-10-17（北京时间）
> 版权原则：本站为**学习笔记**，不是翻译。所有内容用自己的话重写；每篇最多短引 1–2 句原文（英文原句 + 中文），并在每篇显著位置标注出处与原文链接。原文版权归 Anthropic 所有。

---

## 0. 核对方法说明

- 列表来源：直接抓取 `https://www.anthropic.com/engineering` 列表页（无分页、无“加载更多”），共解析出 **26 个** `/engineering/<slug>` 文章链接（列表页 25 篇带日期的条目 + 顶部 1 篇置顶的最新文章《Redesigning source control at Anthropic》）。
- 逐篇核对：26 个 URL 全部用 HTTP 请求实际抓取（均返回 200），标题取自文章页 `<h1>`，发表日期取自文章页结构化数据 `datePublished`，并与列表页显示日期交叉比对，**全部一致**（例外见 §0.1）。
- 你说“约 25 篇”，实际为 **26 篇**（含置顶的最新一篇）。

### 0.1 疑点 / 需要注意的地方

| # | 文章 | 疑点 | 处理建议 |
|---|---|---|---|
| 1 | Claude Code: Best practices for agentic coding | 原 URL `/engineering/claude-code-best-practices` 现在 **308 永久重定向**到 Claude Code 官方文档 `https://code.claude.com/docs/en/best-practices`，页面标题变为 “Best practices for Claude Code”，内容是持续更新的文档版本，**不是 2025-04-18 的原博文**；文档页无 `datePublished`，日期 2025-04-18 仅来自列表页。 | 笔记基于“当前文档版本”撰写并明确注明；source_url 同时给出原博客 URL 和重定向后的文档 URL；或考虑用 Wayback Machine 存档核对原版（尚未做）。 |
| 2 | Building effective agents（2024-12-19） | 文章顶部新增了说明：工具生态自 2024-12 起已变化，建议参考 Managed Agents；正文提到 Claude Haiku 4.5 / Sonnet 4.5、Claude Agent SDK、Strands Agents SDK 等 2024 年 12 月之后才出现的名字，说明**原文发表后被修订过**。 | 笔记以当前在线版本为准，并在笔记里注明“原文后续有更新”。 |
| 3 | The "think" tool（2025-03-20） | 2025-12-15 增加了更新说明：多数情况下推荐改用 extended thinking，而非独立 think 工具。 | 笔记中必须写明该更新，避免误导读者。 |
| 4 | Desktop Extensions（2025-06-26） | 2025-09-11 更新：扩展名由 `.dxt` 改为 `.mcpb`（MCP Bundle）。 | 笔记统一用 `.mcpb`，并注明旧名。 |
| 5 | Equipping agents … with Agent Skills（2025-10-16） | 2025-12-18 更新：Agent Skills 已作为开放标准发布。 | 笔记注明。 |
| 6 | Redesigning source control at Anthropic（2026-10-13） | 列表页置顶处**不显示日期**；日期来自文章页 `datePublished`（2026-10-13），文中另注 “Updated October 15”。 | 以 2026-10-13 为发表日期，备注 10-15 更新。 |
| 7 | Raising the bar on SWE-bench Verified | 列表页链接为 `/engineering/swe-bench-sonnet`，但其他文章内部引用它时用的是 `/research/swe-bench-sonnet`。两者都能访问。 | source_url 统一用 `/engineering/` 版本。 |
| 8 | 两篇同日发表 | 2026-02-05 同日发表了 C compiler 与 infrastructure noise 两篇。 | 无需处理，仅提示排序时注意。 |

---

## 1. 全部文章清单（按发表时间倒序，共 26 篇）

| # | 标题（英文原题） | 发表日期 | 原文 URL | 模块 |
|---|---|---|---|---|
| 1 | Redesigning source control at Anthropic | 2026-10-13 | https://www.anthropic.com/engineering/redesigning-source-control | F |
| 2 | How we contain Claude across products | 2026-05-25 | https://www.anthropic.com/engineering/how-we-contain-claude | D |
| 3 | An update on recent Claude Code quality reports | 2026-04-23 | https://www.anthropic.com/engineering/april-23-postmortem | F |
| 4 | Scaling Managed Agents: Decoupling the brain from the hands | 2026-04-08 | https://www.anthropic.com/engineering/managed-agents | A |
| 5 | How we built Claude Code auto mode: a safer way to skip permissions | 2026-03-25 | https://www.anthropic.com/engineering/claude-code-auto-mode | D |
| 6 | Harness design for long-running application development | 2026-03-24 | https://www.anthropic.com/engineering/harness-design-long-running-apps | A |
| 7 | Eval awareness in Claude Opus 4.6’s BrowseComp performance | 2026-03-06 | https://www.anthropic.com/engineering/eval-awareness-browsecomp | E |
| 8 | Quantifying infrastructure noise in agentic coding evals | 2026-02-05 | https://www.anthropic.com/engineering/infrastructure-noise | E |
| 9 | Building a C compiler with a team of parallel Claudes | 2026-02-05 | https://www.anthropic.com/engineering/building-c-compiler | A |
| 10 | Designing AI-resistant technical evaluations | 2026-01-21 | https://www.anthropic.com/engineering/AI-resistant-technical-evaluations | E |
| 11 | Demystifying evals for AI agents | 2026-01-09 | https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents | E |
| 12 | Effective harnesses for long-running agents | 2025-11-26 | https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents | A |
| 13 | Introducing advanced tool use on the Claude Developer Platform | 2025-11-24 | https://www.anthropic.com/engineering/advanced-tool-use | B |
| 14 | Code execution with MCP: Building more efficient agents | 2025-11-04 | https://www.anthropic.com/engineering/code-execution-with-mcp | B |
| 15 | Beyond permission prompts: making Claude Code more secure and autonomous | 2025-10-20 | https://www.anthropic.com/engineering/claude-code-sandboxing | D |
| 16 | Equipping agents for the real world with Agent Skills | 2025-10-16 | https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills | C |
| 17 | Effective context engineering for AI agents | 2025-09-29 | https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents | C |
| 18 | A postmortem of three recent issues | 2025-09-17 | https://www.anthropic.com/engineering/a-postmortem-of-three-recent-issues | F |
| 19 | Writing effective tools for agents — with agents | 2025-09-11 | https://www.anthropic.com/engineering/writing-tools-for-agents | B |
| 20 | Desktop Extensions: One-click MCP server installation for Claude Desktop | 2025-06-26 | https://www.anthropic.com/engineering/desktop-extensions | B |
| 21 | How we built our multi-agent research system | 2025-06-13 | https://www.anthropic.com/engineering/multi-agent-research-system | A |
| 22 | Claude Code: Best practices for agentic coding ⚠️ | 2025-04-18 | https://www.anthropic.com/engineering/claude-code-best-practices （现重定向至 https://code.claude.com/docs/en/best-practices） | D |
| 23 | The "think" tool: Enabling Claude to stop and think in complex tool use situations | 2025-03-20 | https://www.anthropic.com/engineering/claude-think-tool | B |
| 24 | Raising the bar on SWE-bench Verified with Claude 3.5 Sonnet | 2025-01-06 | https://www.anthropic.com/engineering/swe-bench-sonnet | E |
| 25 | Building effective agents | 2024-12-19 | https://www.anthropic.com/engineering/building-effective-agents | A |
| 26 | Introducing Contextual Retrieval | 2024-09-19 | https://www.anthropic.com/engineering/contextual-retrieval | C |

⚠️ 见 §0.1 疑点 1。

---

## 2. 模块划分（6 个模块）

每篇只归入一个模块；括号内为 slug。一句话说明均为笔者基于原文的概括。

### 模块 A · 智能体设计与架构（Agent Design & Architecture）— 6 篇
从“什么是智能体”到“如何让智能体连续工作数小时、多个智能体协作、平台化托管”。

| slug | 一句话讲什么 |
|---|---|
| building-effective-agents | 区分“工作流”与“智能体”，总结增强型 LLM 与五种可组合工作流模式，主张从最简单方案起步、只在确有收益时增加复杂度。 |
| multi-agent-research-system | 复盘 Claude Research 功能的“主研究智能体 + 并行子智能体”架构，讲多智能体在协调、提示、工具设计和评测上的经验。 |
| effective-harnesses-for-long-running-agents | 针对跨多个上下文窗口的长任务，用“初始化智能体 + 每轮增量推进的编码智能体”并留下结构化交接产物来解决“每轮失忆”。 |
| harness-design-long-running-apps | 借鉴 GAN 思路设计“生成者-评估者”，再扩展为“规划者-生成者-评估者”三智能体，用于前端设计质量与多小时全栈应用自主开发。 |
| building-c-compiler | 让 16 个并行 Claude 组成“智能体团队”从零写出可编译 Linux 内核的 Rust 版 C 编译器，总结测试、并行分工与上限。 |
| managed-agents | 借操作系统“虚拟化抽象”思想，把智能体拆成 session / harness / sandbox 三个可替换接口，解释托管服务 Managed Agents 的设计（“大脑与双手解耦”）。 |

### 模块 B · 工具与 MCP（Tools & MCP）— 5 篇
智能体能力的边界由工具决定：怎么设计工具、怎么让工具不撑爆上下文、怎么分发 MCP 服务器。

| slug | 一句话讲什么 |
|---|---|
| claude-think-tool | 介绍给 Claude 一个“think”工具、在长工具调用链中途停下来整理思路的方法及其基准收益（注意：2025-12 更新后多数场景改推荐 extended thinking）。 |
| desktop-extensions | 介绍把整个本地 MCP 服务器及依赖打包成一键安装包（现扩展名 `.mcpb`）的 Desktop Extensions 格式及其清单结构。 |
| writing-tools-for-agents | 讲为非确定性智能体写工具的方法论：原型→用智能体跑评测→让 Claude Code 优化工具，以及命名空间、返回有意义上下文、省 token、写好描述等原则。 |
| code-execution-with-mcp | 指出“工具定义全量预加载 + 中间结果过上下文”的 token 浪费，提出让智能体写代码调用 MCP（按需发现工具、在执行环境里处理数据）。 |
| advanced-tool-use | 发布 Tool Search Tool、Programmatic Tool Calling、Tool Use Examples 三项平台能力，解决工具库巨大、调用编排和用法示范问题。 |

### 模块 C · 上下文与检索（Context & Retrieval）— 3 篇
上下文窗口是最稀缺的资源：检索什么、放进什么、何时按需加载。

| slug | 一句话讲什么 |
|---|---|
| contextual-retrieval | 在切块编码前为每个块补上由 Claude 生成的上下文说明（Contextual Embeddings + Contextual BM25），再结合重排序显著降低 RAG 检索失败率。 |
| effective-context-engineering-for-ai-agents | 把“提示词工程”升级为“上下文工程”：把上下文当有限注意力预算，讨论系统提示、工具、示例、即时检索、压缩、笔记与子智能体等策略。 |
| equipping-agents-for-the-real-world-with-agent-skills | 介绍 Agent Skills：以 SKILL.md 为核心的文件夹，通过“渐进式披露”按需加载说明、脚本和资源，把通用智能体变成领域专家。 |

### 模块 D · Claude Code 实践与安全（Claude Code in Practice & Safety）— 4 篇
从“怎么用好”到“怎么在给足自主权的同时控制风险”。

| slug | 一句话讲什么 |
|---|---|
| claude-code-best-practices | 以“上下文窗口很快会满”为核心约束，总结使用 Claude Code 的模式：给它可运行的自检手段、先探索再规划再实现、管理上下文、并行会话等（⚠️ 现为官方文档版本）。 |
| claude-code-sandboxing | 用操作系统级的文件系统隔离 + 网络隔离构建沙箱，在减少权限弹窗的同时防御提示注入。 |
| claude-code-auto-mode | 针对“审批疲劳”，用输入侧提示注入探测 + 动作侧模型分类器替代人工逐条审批，介绍 auto mode 的设计与权衡。 |
| how-we-contain-claude | 从“失败概率 × 爆炸半径”出发，梳理三类风险（用户滥用、模型失当、外部攻击）与跨产品的“隔离/围栏”模式及漏掉的风险教训。 |

### 模块 E · 评测（Evaluation）— 5 篇
没有评测就没有迭代；而评测本身也会被基础设施、污染与模型“察觉”所干扰。

| slug | 一句话讲什么 |
|---|---|
| swe-bench-sonnet | 解释 SWE-bench Verified 评的是“模型 + 脚手架”整体，并公开 Claude 3.5 Sonnet 取得 49% 时所用的极简智能体（提示 + 少量工具）设计。 |
| demystifying-evals-for-ai-agents | 系统讲解智能体评测的组成（任务、试验、评分器、记录等）、各类评分器的取舍，以及从零搭建并长期维护评测的路线。 |
| AI-resistant-technical-evaluations | 记录性能工程招聘笔试被历代 Claude 攻破后的三次重设计，总结怎样的考题能在 AI 辅助下仍保留区分度。 |
| infrastructure-noise | 在 Terminal-Bench 2.0 上量化资源配置与限额执行方式带来的分数差异（最多约 6 个百分点），提醒排行榜小差距可能只是基础设施噪声。 |
| eval-awareness-browsecomp | 报告 Opus 4.6 在 BrowseComp 上除常规泄题外，还出现自行推断“正在被评测”、定位并解密答案的案例，讨论静态基准在联网环境下的可靠性。 |

### 模块 F · 工程基础设施与可靠性（Infra & Reliability）— 3 篇
模型背后的工程：服务、事故复盘、为“智能体规模”的研发重建基础设施。

| slug | 一句话讲什么 |
|---|---|
| a-postmortem-of-three-recent-issues | 复盘 2025 年 8–9 月三个基础设施 bug 如何间歇性降低回答质量、为何难以发现，以及后续改进（强调从不因负载降低模型质量）。 |
| april-23-postmortem | 复盘 2026 年 3–4 月 Claude Code 等产品质量下降的三个独立改动（默认推理强度、思考清理 bug、系统提示改动）及改进措施。 |
| redesigning-source-control | 讲每日合并量增长十倍以上后，Anthropic 如何在五个月内自研版本控制系统 Scion 并把单体仓库从 git 迁出。 |

模块篇数合计：6 + 5 + 3 + 4 + 5 + 3 = **26**。

---

## 3. 推荐学习顺序（入门 → 进阶）

`order` 字段即下表序号（全站统一的推荐阅读顺序）。

### 阶段 1 · 打地基：建立心智模型（1–4）
| order | slug | 理由 |
|---|---|---|
| 1 | building-effective-agents | 全博客的“总纲”：定义术语（工作流/智能体/增强型 LLM）和基本模式，后面几乎每篇都会引用它。 |
| 2 | effective-context-engineering-for-ai-agents | 第二个核心心智模型：上下文是有限预算。理解它，后面的工具、Skills、长任务设计才讲得通。 |
| 3 | writing-tools-for-agents | 智能体 = LLM + 工具循环，工具质量直接决定效果；同时引出“用评测驱动改进”的思路。 |
| 4 | claude-code-best-practices | 最贴近日常上手的一篇，读者可以边学边在 Claude Code 里实践前三篇的概念。 |

### 阶段 2 · 构建块：检索、工具与能力扩展（5–10）
| order | slug | 理由 |
|---|---|---|
| 5 | contextual-retrieval | 具体可复现的 RAG 改进方法，是“上下文工程”在检索场景的落地。 |
| 6 | claude-think-tool | 简单的工具级技巧；同时学会看“原文更新说明”（已被 extended thinking 部分取代）。 |
| 7 | equipping-agents-for-the-real-world-with-agent-skills | 渐进式披露思想，连接上下文工程与工具设计。 |
| 8 | code-execution-with-mcp | 大规模 MCP 下的 token 问题与“用代码调工具”的思路。 |
| 9 | advanced-tool-use | 第 8 篇思路的平台化产品落地，适合紧接着读。 |
| 10 | desktop-extensions | MCP 服务器的分发与安装，偏工程细节，放在本阶段末尾。 |

### 阶段 3 · 评测：学会度量（11–15）
| order | slug | 理由 |
|---|---|---|
| 11 | demystifying-evals-for-ai-agents | 评测方法论总论，先建立框架。 |
| 12 | swe-bench-sonnet | 具体案例：一个基准 + 一个极简智能体，体会“脚手架也被评测”。 |
| 13 | infrastructure-noise | 进阶：环境配置如何污染分数。 |
| 14 | eval-awareness-browsecomp | 进阶：数据泄漏与模型“察觉被评测”。 |
| 15 | AI-resistant-technical-evaluations | 拓展：把评测思维迁移到“评估人”，趣味性强，可作阶段收尾。 |

### 阶段 4 · 进阶架构：多智能体与长时任务（16–20）
| order | slug | 理由 |
|---|---|---|
| 16 | multi-agent-research-system | 从单智能体走向多智能体的第一篇完整生产案例。 |
| 17 | effective-harnesses-for-long-running-agents | 长任务的基础 harness 设计（跨上下文窗口交接）。 |
| 18 | harness-design-long-running-apps | 在 17 的基础上加入评估者与规划者，明确是其续篇。 |
| 19 | building-c-compiler | 极限实验：并行智能体团队，检验前面所有原则。 |
| 20 | managed-agents | 收束：把 harness 经验抽象为平台接口，并反思“harness 假设会过时”。 |

### 阶段 5 · 安全与自主权（21–23）
| order | slug | 理由 |
|---|---|---|
| 21 | claude-code-sandboxing | 先理解沙箱（文件系统 + 网络隔离）这一底层机制。 |
| 22 | claude-code-auto-mode | 再看基于分类器的审批自动化，二者互补。 |
| 23 | how-we-contain-claude | 跨产品的总结性框架，最适合放在最后统摄前两篇。 |

### 阶段 6 · 工程基础设施与可靠性（24–26）
| order | slug | 理由 |
|---|---|---|
| 24 | a-postmortem-of-three-recent-issues | 学习大规模推理服务中质量问题的排查与复盘。 |
| 25 | april-23-postmortem | 对照阅读：问题出在产品层（harness/提示/默认值）而非推理层。 |
| 26 | redesigning-source-control | 最新一篇，也是视角最“宏观”的一篇：AI 写码规模化后研发基础设施的连锁变化。 |

**排序总体逻辑**：先概念（智能体、上下文、工具）→ 再可复用的构建块 → 学会度量（评测是之后所有进阶内容的前提）→ 复杂架构 → 给自主权时的安全边界 → 支撑这一切的基础设施。阶段 3 放在阶段 4 之前，是因为多智能体/长任务文章大量依赖“用评测判断改动是否有效”。

---

## 4. 笔记模板

### 4.1 文件与命名约定
- 路径：`notes/<slug>.md`，slug 使用原文 URL 最后一段的**全小写**形式（如 `AI-resistant-technical-evaluations` → `ai-resistant-technical-evaluations`）。
- 编码 UTF-8；图解优先 mermaid 代码块，确需时用 `assets/<slug>/*.svg`（原创绘制，不使用原文配图）。

### 4.2 YAML frontmatter

```yaml
---
title_zh: "构建高效的智能体"          # 中文标题（意译即可）
title_en: "Building effective agents" # 原文标题，原样
slug: building-effective-agents       # 小写，与文件名一致
module: A-agent-design                # A-agent-design | B-tools-mcp | C-context-retrieval | D-claude-code | E-evals | F-infra
order: 1                              # 全站推荐学习顺序（见大纲 §3）
source_url: "https://www.anthropic.com/engineering/building-effective-agents"
published: 2024-12-19                 # 原文发表日期（以文章页 datePublished 为准）
summary: "一两句话的中文摘要（自己的话）"
tags: [agents, workflows]             # 英文小写短横线
reading_time: 15                      # 本笔记阅读时长（分钟）
# —— 以下为可选字段 ——
source_note: "原文后续有更新……"         # 原文修订/重定向等需要提醒读者的情况
authors_en: ["..."]                   # 原文署名（如原文给出）
notes_updated: 2026-10-17             # 笔记最后核对原文的日期
---
```

### 4.3 正文固定小节（顺序固定，标题固定）

```markdown
> 📌 出处：Anthropic Engineering Blog《<英文原题>》，<发表日期>。原文：<URL>
> 本文为学习笔记，用自己的话概括，非翻译；引文仅为短引。原文版权归 Anthropic 所有。

## 一句话总结
（1 句，≤60 字）

## 为什么重要
（3–5 条：解决了什么问题、在知识体系中的位置、与其他篇的关系）

## 核心概念（中英对照）
| 中文 | English | 简要解释（自己的话） |

## 方法 / 步骤
（分小节，用自己的话讲清做法、适用条件、取舍；可以用表格、清单）

## 图解
（≥1 个原创 mermaid 图；复杂文章 2–3 个）

## 关键原话
（最多 1–2 句，格式：> "英文原句" —— 中文意思）

## 实践建议
（可操作的 checklist，可加入笔者经验，但需与原文观点区分开，标注“笔者补充”）

## 延伸阅读
（站内相关笔记链接 + 原文中引用的官方资源链接）
```

### 4.4 写作规范（版权与准确性）
1. 不逐段翻译、不复制原文段落、不搬原文图片；结构可以与原文不同。
2. 关键原话每篇 ≤2 句，每句尽量 ≤30 个英文词，必须带引号、附中文。
3. 所有事实、数字只来自实际读到的原文；不确定的不写，或标“待核实”。
4. 原文有更新/修订/重定向时，用 `source_note` 字段 + 正文顶部提示说明。
5. 笔者自己的延伸观点须标注“笔者补充”，与原文观点区分。

### 4.5 术语表（全站共享，后续单独成文件 `glossary.md`）
样稿中已出现的核心术语示例：

| 中文 | English |
|---|---|
| 智能体系统 | agentic system |
| 工作流 | workflow |
| 智能体 | agent |
| 增强型 LLM | augmented LLM |
| 提示链 | prompt chaining |
| 路由 | routing |
| 并行化（分段 / 投票） | parallelization (sectioning / voting) |
| 编排者-工作者 | orchestrator-workers |
| 评估者-优化者 | evaluator-optimizer |
| 智能体-计算机接口 | agent-computer interface (ACI) |
| 上下文工程 | context engineering |
| 渐进式披露 | progressive disclosure |
| 脚手架 / 运行框架 | scaffold / harness |
| 模型上下文协议 | Model Context Protocol (MCP) |
| 提示注入 | prompt injection |
| 审批疲劳 | approval fatigue |
| 爆炸半径 | blast radius |
| 评测 / 评分器 | eval / grader |
| 污染（基准泄题） | contamination |

---

## 5. 下一步（待你审阅后）
- 确认模块划分与学习顺序；
- 确认是否需要用 Wayback Machine 核对 Claude Code best practices 的 2025-04 原版；
- 按模板批量撰写其余 25 篇，并建立 `glossary.md`。
