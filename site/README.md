# Anthropic 工程博客 · 中文学习笔记（静态站）

Astro 静态站，内容直接读取上级目录 `../notes/*.md`（不复制）。新增笔记后重新构建即可。

## 加笔记
1. 在 `../notes/` 新建 `<slug>.md`（文件名 = frontmatter `slug`，全小写）。
2. 必填 frontmatter：`title_zh`、`title_en`、`slug`、`module`（`A`–`F` 开头，如 `A-agent-design`）、`order`（1–26，不可重复）、`source_url`、`published`（YYYY-MM-DD）、`summary`、`tags`（数组）、`reading_time`（分钟）。
   可选：`source_note`（显示为提醒框）、`authors_en`、`notes_updated`。缺字段/类型错误时构建失败并指出文件和字段。
3. 图用 ```` ```mermaid ```` 代码块，浏览器端渲染。
4. 笔记间互链写 `./other-slug.md`，构建时自动改成站内链接。

## 加资源导读
1. 在 `../resources/` 新建 `r-<slug>.md`（文件名须以 `r-` 开头；只有 `r-*.md` 会被读取）。目录为空或不存在时构建照常通过。
2. frontmatter 为严格 schema，**不认识的字段会报错**：
   - 必填：`title_zh`、`slug`（`^r-[a-z0-9-]+$`，= 文件名）、`kind`（course/article/guide/repo/cookbook/blog/catalog）、`stage`（1–4）、`route`（≥1 条）、`source_url`、`provider`、`last_checked`（日期）、`status`（active/archived/dated）、`summary`、`pairs_with`（笔记 slug 数组）、`tags`。
   - 可选：`title_en`、`optional`（整个资源为选读）、`source_url_zh`、`authors_en`、`published`、`cost`、`license_note`、`estimated_hours`（页面标注“估算”）、`source_note`。
3. `route` 决定在学习路线中的位置，可出现多次：
   ```yaml
   route:
     - step: 19                 # 正整数、全站唯一，= 路线页显示的步号；选读条目不写（不要写 null/0）
       part: "Unit 2"           # 必填，显示在条目后
       after: ai-resistant-technical-evaluations   # 必填：插在这篇笔记之后；null = 所属阶段开头
       stage: 2                 # 可选：覆盖所属阶段（默认取 after 笔记的阶段，否则取资源 stage）
       optional: true           # 可选：选读，不占编号
   ```
4. 构建时跨文件校验，失败即中断：`pairs_with`、`route.after` 必须是现有笔记；`step` 全站唯一；非选读条目必须有 `step`，选读条目不能有。
5. 链接：`./slug.md` → 笔记页，`./r-xxx.md` → 资源页（笔记和资源里都适用）。
6. 学习路线的阶段划分（按笔记 order）在 `src/data/stages.ts`。

## 构建 / 本地预览
需要 Node ≥ 22（`package.json` 的 `engines`，CI 同为 Node 22）。
```bash
npm ci
npm run build          # astro build + 建搜索索引（scripts/pagefind-index.mjs → dist/pagefind/）
npm run preview        # http://localhost:4321/anthropic-eng-notes/
npm run screenshots    # 需 preview 运行中；截图到 screenshots/ 并校验 mermaid 渲染成 svg
npm run check          # 自检：order、mermaid、站内死链、首页分组、路线/资源页（自带静态服务，读 dist/）
```
环境变量：`BASE_PATH`（默认 `/anthropic-eng-notes`，根域名部署用 `BASE_PATH=/`）、`SITE_URL`、`NOTES_DIR`（默认 `../notes`）、`RESOURCES_DIR`（默认 `../resources`）。

## 部署到 GitHub Pages
- 工作流在仓库根目录 `.github/workflows/deploy.yml`（构建 `site/` 子目录），目前**只允许手动触发**（Actions → Deploy to GitHub Pages → Run workflow）。
- 先在仓库 Settings → Pages → Source 选 “GitHub Actions”。确认要自动发布时，可在 `on:` 下加回 `push: branches: [main]`。
- base 默认取 `/<仓库名>`，可用仓库变量 `BASE_PATH` 覆盖。

## 页面功能与实现位置
- 布局（`src/layouts/Base.astro`）：≥1200px 三栏（左侧栏 `components/Sidebar.astro` + 正文 + 右侧本页目录 `components/Toc.astro`）；768–1199px 侧栏收进菜单抽屉、目录折叠在正文顶部；<768px 菜单抽屉 + 底部“本页目录”抽屉。
- 交互脚本在 `src/lib/client/`：`chrome.ts`（主题三态切换并存 localStorage、侧栏抽屉、目录滚动高亮、代码复制、回到顶部）、`mermaid.ts`（渲染、切换主题后重渲染、点击放大）、`search.ts`（搜索弹窗）、`progress.ts`（学习进度、阅读进度条）。全站只有 `Base.astro` 里的一个 `<script>`，mermaid 在页面有图时才动态加载；不要写 `{cond && <script>}`：Astro 不支持条件渲染的 script，会把错误的脚本挂到页面上。
- 搜索：Pagefind。`scripts/pagefind-index.mjs` 用 Pagefind Node API 建索引，中文按“字”索引；`src/lib/search-query.mjs` 把中文查询按字检索后再做子串过滤（原因见脚本开头注释）。首页和资源列表页不进索引（`searchable={false}`）。快捷键 Ctrl/⌘ K 或 `/`。
- 笔记页有两组翻页：按编号、按学习路线（主线 36 步，下一步可能是资源）；面包屑里的“第 M 步”链接到路线页对应条目（`/path/#step-M`）。
- 学习进度只存在本机浏览器 `localStorage['progress:v1']`（`{ id: 完成时间 }`）。id 规则见 `lib/resources.ts` 的 `progressId`：笔记 `n:<slug>`；主线上的资源条目 `r:<slug>:<route 下标>`；支线条目 `t:<slug>:<route 下标>`。路线页可以逐步勾选，并显示各阶段和支线的完成度。笔记页底部的“标记为已读”与路线页勾选是同一份数据，侧栏、首页的笔记链接也会带 ✓。选读条目不计入进度。
- 反向链接（`lib/backlinks.ts`、`components/Backlinks.astro`）：从笔记和资源正文里指向其他笔记或资源的 .md 链接，加上资源的 `pairs_with`，在被引用页的底部列出。
- 标签：`/tags/` 列出全部标签，`/tags/<slug>/` 列出该标签下的笔记和资源（`lib/tags.ts`，slug 是小写加连字符）。标签页不进搜索索引。
- 改了 remark/rehype 插件后，本地要先删 `node_modules/.astro` 再 build（Astro 内容层会缓存渲染结果）。
