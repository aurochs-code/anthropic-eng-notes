import { defineConfig } from 'astro/config';
import { remarkMermaid, remarkNoteLinks } from './src/lib/remark-plugins.mjs';

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
  },
});
