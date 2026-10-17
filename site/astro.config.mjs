import { defineConfig } from 'astro/config';
import { rehypeHeadingIds } from '@astrojs/markdown-remark';
import { remarkMermaid, remarkNoteLinks, rehypeHeadingAnchors } from './src/lib/remark-plugins.mjs';

// GitHub Pages 项目页：BASE_PATH 默认 /anthropic-eng-notes，SITE_URL 可选
const base = process.env.BASE_PATH ?? '/anthropic-eng-notes';
const site = process.env.SITE_URL ?? 'https://example.github.io';

export default defineConfig({
  output: 'static',
  site,
  base,
  trailingSlash: 'always',
  markdown: {
    remarkPlugins: [remarkMermaid, [remarkNoteLinks, { base }]],
    // 先生成标题 id，再追加锚点链接
    rehypePlugins: [rehypeHeadingIds, rehypeHeadingAnchors],
  },
});
