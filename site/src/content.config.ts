import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

export const MODULES = {
  A: '智能体设计与架构',
  B: '工具与 MCP',
  C: '上下文与检索',
  D: 'Claude Code 实践与安全',
  E: '评测',
  F: '工程基础设施与可靠性',
} as const;

const notes = defineCollection({
  // 直接读取仓库根目录下的 notes/，不复制内容
  loader: glob({ pattern: '*.md', base: process.env.NOTES_DIR ?? '../notes', generateId: ({ entry }) => entry.replace(/\.md$/, '') }),
  schema: z
    .object({
      title_zh: z.string({ required_error: '缺少 title_zh（中文标题）' }).min(1),
      title_en: z.string({ required_error: '缺少 title_en（英文原题）' }).min(1),
      slug: z
        .string({ required_error: '缺少 slug' })
        .regex(/^[a-z0-9-]+$/, 'slug 只能是小写字母、数字、短横线'),
      module: z
        .string({ required_error: '缺少 module（A–F，如 A 或 A-agent-design）' })
        .regex(/^[A-F](-[a-z0-9-]+)?$/, 'module 必须以 A–F 开头，如 "A" 或 "A-agent-design"'),
      order: z.number({ required_error: '缺少 order（1–26）', invalid_type_error: 'order 必须是数字' }).int().min(1).max(26),
      source_url: z.string({ required_error: '缺少 source_url' }).url('source_url 不是合法 URL'),
      published: z.coerce.date({ required_error: '缺少 published（YYYY-MM-DD）', invalid_type_error: 'published 必须是日期 YYYY-MM-DD' }),
      summary: z.string({ required_error: '缺少 summary' }).min(1),
      tags: z.array(z.string(), { required_error: '缺少 tags（数组）' }),
      reading_time: z.number({ required_error: '缺少 reading_time（分钟）' }).positive(),
      // 可选
      source_note: z.string().optional(),
      authors_en: z.array(z.string()).optional(),
      notes_updated: z.coerce.date().optional(),
    })
    .transform((d) => ({ ...d, moduleKey: d.module[0] as keyof typeof MODULES })),
});

export const collections = { notes };
