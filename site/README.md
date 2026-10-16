# Anthropic 工程博客 · 中文学习笔记（静态站）

Astro 静态站，内容直接读取上级目录 `../notes/*.md`（不复制）。新增笔记后重新构建即可。

## 加笔记
1. 在 `../notes/` 新建 `<slug>.md`（文件名 = frontmatter `slug`，全小写）。
2. 必填 frontmatter：`title_zh`、`title_en`、`slug`、`module`（`A`–`F` 开头，如 `A-agent-design`）、`order`（1–26，不可重复）、`source_url`、`published`（YYYY-MM-DD）、`summary`、`tags`（数组）、`reading_time`（分钟）。
   可选：`source_note`（显示为提醒框）、`authors_en`、`notes_updated`。缺字段/类型错误时构建失败并指出文件和字段。
3. 图用 ```` ```mermaid ```` 代码块，浏览器端渲染。
4. 笔记间互链写 `./other-slug.md`，构建时自动改成站内链接。

## 构建 / 本地预览
```bash
npm ci
npm run build          # 输出 dist/
npm run preview        # http://localhost:4321/anthropic-eng-notes/
npm run screenshots    # 需 preview 运行中；截图到 screenshots/ 并校验 mermaid 渲染成 svg
```
环境变量：`BASE_PATH`（默认 `/anthropic-eng-notes`，根域名部署用 `BASE_PATH=/`）、`SITE_URL`、`NOTES_DIR`（默认 `../notes`）。

## 部署到 GitHub Pages
- 工作流在仓库根目录 `.github/workflows/deploy.yml`（构建 `site/` 子目录），目前**只允许手动触发**（Actions → Deploy to GitHub Pages → Run workflow）。
- 先在仓库 Settings → Pages → Source 选 “GitHub Actions”。确认要自动发布时，可在 `on:` 下加回 `push: branches: [main]`。
- base 默认取 `/<仓库名>`，可用仓库变量 `BASE_PATH` 覆盖。
