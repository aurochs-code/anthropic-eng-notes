import { defineConfig } from 'astro/config';
import { resolve } from 'node:path';
import { rehypeHeadingIds } from '@astrojs/markdown-remark';
import { remarkMermaid, remarkNoteLinks, remarkPaperLinks, rehypeHeadingAnchors } from './src/lib/remark-plugins.mjs';

// GitHub Pages 项目页：BASE_PATH 默认 /anthropic-eng-notes，SITE_URL 可选
const base = process.env.BASE_PATH ?? '/anthropic-eng-notes';
const papersDir = resolve(process.env.PAPERS_DIR ?? '../papers');
const site = process.env.SITE_URL ?? 'https://example.github.io';

export default defineConfig({
  output: 'static',
  site,
  base,
  trailingSlash: 'always',
  markdown: {
    remarkPlugins: [remarkMermaid, [remarkNoteLinks, { base, papersDir }], [remarkPaperLinks, { base, papersDir }]],
    // 先生成标题 id，再追加锚点链接
    rehypePlugins: [rehypeHeadingIds, rehypeHeadingAnchors],
  },
});
