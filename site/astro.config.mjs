import { defineConfig } from 'astro/config';
import { resolve } from 'node:path';
import { rehypeHeadingIds } from '@astrojs/markdown-remark';
import { remarkMermaid, remarkNoteLinks, remarkPaperLinks, rehypeHeadingAnchors } from './src/lib/remark-plugins.mjs';

// 自定义域名根路径部署：https://learn.thinkloop.dev/（site/public/CNAME）。BASE_PATH、SITE_URL 仅供临时覆盖
const base = process.env.BASE_PATH ?? '/';
const papersDir = resolve(process.env.PAPERS_DIR ?? '../papers');
const site = process.env.SITE_URL ?? 'https://learn.thinkloop.dev';

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
