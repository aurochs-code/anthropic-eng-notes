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
2. frontmatter 目前是宽松 schema：只有 `title_zh` 必填；其余可选：`title_en`、`slug`（须 = 文件名）、`kind`、`stage`（1–4）、`optional`（整个资源为选读）、`route`、`source_url`、`source_url_zh`、`provider`、`authors_en`、`published`、`last_checked`、`status`、`cost`、`license_note`、`estimated_hours`、`summary`、`pairs_with`（笔记 slug 数组）、`tags`、`source_note`。未知字段也允许。
3. `route` 决定在学习路线中的位置，可出现多次：
   ```yaml
   route:
     - step: 22                 # 同一位置多条时按 step 排序
       part: "Unit 2"           # 显示在条目后
       after: ai-resistant-technical-evaluations   # 插在这篇笔记之后；null = 所属阶段开头
       stage: 2                 # 可选：覆盖所属阶段（默认取 after 笔记的阶段，否则取资源 stage）
       optional: true           # 可选：选读，不占编号
   ```
4. `pairs_with`、`route.after` 写了不存在的笔记 slug 时构建会打印警告（不中断）。
5. 链接：`./slug.md` → 笔记页，`./r-xxx.md` → 资源页（笔记和资源里都适用）。
6. 学习路线的阶段划分（按笔记 order）在 `src/data/stages.ts`。

## 构建 / 本地预览
```bash
npm ci
npm run build          # 输出 dist/
npm run preview        # http://localhost:4321/anthropic-eng-notes/
npm run screenshots    # 需 preview 运行中；截图到 screenshots/ 并校验 mermaid 渲染成 svg
npm run check          # 自检：order、mermaid、站内死链、首页分组、路线/资源页（自带静态服务，读 dist/）
```
环境变量：`BASE_PATH`（默认 `/anthropic-eng-notes`，根域名部署用 `BASE_PATH=/`）、`SITE_URL`、`NOTES_DIR`（默认 `../notes`）、`RESOURCES_DIR`（默认 `../resources`）。

## 部署到 GitHub Pages
- 工作流在仓库根目录 `.github/workflows/deploy.yml`（构建 `site/` 子目录），目前**只允许手动触发**（Actions → Deploy to GitHub Pages → Run workflow）。
- 先在仓库 Settings → Pages → Source 选 “GitHub Actions”。确认要自动发布时，可在 `on:` 下加回 `push: branches: [main]`。
- base 默认取 `/<仓库名>`，可用仓库变量 `BASE_PATH` 覆盖。
