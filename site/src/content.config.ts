import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { SEGMENT_KEYS, PAPER_SLUG_RE, UNIT_RE, dayOfUnit } from './lib/paper-rules.mjs';
import { TAG_WHITELIST } from './data/tags.mjs';

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

// ── 资源导读（独立集合、独立 schema；确定版，严格校验，未知字段报错） ──
export const RESOURCE_KINDS = ['course', 'article', 'guide', 'repo', 'cookbook', 'blog', 'catalog'] as const;
export const RESOURCE_STATUS = ['active', 'archived', 'dated'] as const;
// 并行支线：theory = 「原理支线」（不进入主线编号与步数）
export const RESOURCE_TRACKS = ['theory'] as const;
const stageNum = (what: string) =>
  z.number({ required_error: `缺少 ${what}（1–4）`, invalid_type_error: `${what} 必须是 1–4 的整数` }).int(`${what} 必须是整数`).min(1, `${what} 须在 1–4`).max(4, `${what} 须在 1–4`);
const routeEntry = z
  .object({
    part: z.string({ required_error: 'route 条目缺少 part' }).min(1, 'route.part 不能为空'),
    // 必须显式写出：笔记 slug 或 null（null = 所属阶段开头）
    after: z.string({ required_error: 'route 条目缺少 after（笔记 slug 或 null）', invalid_type_error: 'route.after 必须是笔记 slug 字符串或 null' }).nullable(),
    // 不用 coerce：step: null / 0 / 小数 都报错。
    // 非选读条目 step 必填；选读条目（optional: true，或资源级 optional: true）不写 step——见下方 superRefine
    step: z.number({ invalid_type_error: 'route.step 必须是正整数（选读条目请不写 step，不要写 null）' }).int('route.step 必须是整数').positive('route.step 必须 ≥ 1').optional(),
    stage: stageNum('route.stage').optional(),
    optional: z.boolean({ invalid_type_error: 'route.optional 必须是 true/false' }).optional(),
  })
  .strict();
const resources = defineCollection({
  // 读取 ../resources/r-*.md；目录不存在或为空时集合为空，构建照常通过
  loader: glob({ pattern: 'r-*.md', base: process.env.RESOURCES_DIR ?? '../resources', generateId: ({ entry }) => entry.replace(/\.md$/, '') }),
  schema: z
    .object({
      title_zh: z.string({ required_error: '缺少 title_zh（中文标题）' }).min(1),
      slug: z.string({ required_error: '缺少 slug' }).regex(/^r-[a-z0-9-]+$/, '资源 slug 须匹配 ^r-[a-z0-9-]+$'),
      kind: z.enum(RESOURCE_KINDS, { required_error: '缺少 kind', invalid_type_error: `kind 须为 ${RESOURCE_KINDS.join('/')}` }),
      stage: stageNum('stage'),
      route: z.array(routeEntry, { required_error: '缺少 route（至少 1 条）' }).min(1, 'route 至少 1 条'),
      source_url: z.string({ required_error: '缺少 source_url' }).url('source_url 不是合法 URL'),
      provider: z.string({ required_error: '缺少 provider' }).min(1),
      last_checked: z.coerce.date({ required_error: '缺少 last_checked（YYYY-MM-DD）', invalid_type_error: 'last_checked 必须是日期 YYYY-MM-DD' }),
      status: z.enum(RESOURCE_STATUS, { required_error: '缺少 status', invalid_type_error: `status 须为 ${RESOURCE_STATUS.join('/')}` }),
      summary: z.string({ required_error: '缺少 summary' }).min(1),
      pairs_with: z.array(z.string(), { required_error: '缺少 pairs_with（笔记 slug 数组）' }),
      tags: z.array(z.string(), { required_error: '缺少 tags（数组）' }),
      // 可选
      title_en: z.string().optional(),
      optional: z.boolean().optional(), // 整个资源为选读：路线中不占编号
      source_url_zh: z.string().url('source_url_zh 不是合法 URL').optional(),
      authors_en: z.array(z.string()).optional(),
      published: z.coerce.date().optional(),
      cost: z.string().optional(),
      license_note: z.string().optional(),
      estimated_hours: z.number({ invalid_type_error: 'estimated_hours 必须是数字' }).positive().optional(),
      source_note: z.string().optional(),
      // 并行支线：track: theory 的资源不进主线，单独渲染为「原理支线」；其 route 条目须全部 optional: true 且不写 step
      track: z.enum(RESOURCE_TRACKS, { invalid_type_error: `track 须为 ${RESOURCE_TRACKS.join('/')}` }).optional(),
    })
    .strict()
    .superRefine((d, ctx) => {
      d.route.forEach((e, i) => {
        const path = ['route', i];
        if (d.track === 'theory' && e.optional !== true)
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: [...path, 'optional'], message: `track: ${d.track} 的 route 条目必须写 optional: true（支线不占主线编号）` });
        const opt = e.optional ?? d.optional ?? false;
        if (opt && e.step !== undefined)
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: [...path, 'step'], message: `选读/支线条目不应写 step（当前 ${e.step}）` });
        if (!opt && e.step === undefined)
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: [...path, 'step'], message: '非选读条目必须写 step（选读条目请写 optional: true）' });
      });
    }),
});

// ── 论文笔记（30u30 书单，papers/p-<两位天数>-<slug>.md；严格模式，未知字段报错） ──
// unit 必填：30u30 papers/ 下的单元目录名；check-site.mjs 另核对它与 resources/r-30u30.md 的单元链接一致。
const papers = defineCollection({
  loader: glob({ pattern: 'p-*.md', base: process.env.PAPERS_DIR ?? '../papers', generateId: ({ entry }) => entry.replace(/\.md$/, '') }),
  schema: z
    .object({
      title_zh: z.string({ required_error: '缺少 title_zh（中文标题）' }).min(1),
      title_en: z.string({ required_error: '缺少 title_en（论文原题）' }).min(1),
      slug: z.string({ required_error: '缺少 slug' }).regex(PAPER_SLUG_RE, 'slug 须为 p-<两位天数>-<slug>，且与文件名一致'),
      day: z.number({ required_error: '缺少 day（1–30）', invalid_type_error: 'day 必须是 1–30 的整数' }).int('day 必须是整数').min(1, 'day 须在 1–30').max(30, 'day 须在 1–30'),
      segment: z.enum(SEGMENT_KEYS as [string, ...string[]], { required_error: '缺少 segment', invalid_type_error: `segment 须为 ${SEGMENT_KEYS.join('/')}` }),
      unit: z.string({ required_error: '缺少 unit（30u30 papers/ 下的单元目录名）' }).regex(UNIT_RE, 'unit 须为 30u30 papers/ 下的单元目录名'),
      source_url: z.string({ required_error: '缺少 source_url' }).url('source_url 不是合法 URL'),
      published: z.coerce.date({ required_error: '缺少 published（YYYY-MM-DD）', invalid_type_error: 'published 必须是日期 YYYY-MM-DD' }),
      summary: z.string({ required_error: '缺少 summary' }).min(1),
      tags: z.array(z.string().refine((t) => TAG_WHITELIST.includes(t), (t) => ({ message: `标签「${t}」不在白名单内（见 CONTENT-GUIDE 现行标签表）` })), { required_error: '缺少 tags（数组）' }),
      reading_time: z.number({ required_error: '缺少 reading_time（分钟）' }).positive(),
      authors_en: z.array(z.string().min(1), { required_error: '缺少 authors_en（作者英文名数组）' }).min(1, 'authors_en 至少 1 人'),
      // 可选
      notes_updated: z.coerce.date().optional(),
      source_note: z.string().optional(),
      venue: z.string().min(1).optional(),
      source_version: z.string().min(1).optional(),
    })
    .strict()
    .superRefine((d, ctx) => {
      if (+d.slug.slice(2, 4) !== d.day) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['slug'], message: `slug 天数 ${d.slug.slice(2, 4)} 与 day ${d.day} 不一致` });
      if (d.unit && dayOfUnit(d.unit) !== d.day) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['unit'], message: `unit ${d.unit} 的天数与 day ${d.day} 不一致` });
    }),
});

export const collections = { notes, resources, papers };
