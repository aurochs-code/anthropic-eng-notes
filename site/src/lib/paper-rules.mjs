// 论文笔记（papers/p-<两位天数>-<slug>.md）的共享规则：站点构建（content.config / remark 插件 / 页面）
// 与 scripts/check-site.mjs、仓库外审计脚本共用。只依赖 node:fs 和 js-yaml（astro 依赖）。
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';

export const SEGMENTS = {
  P1: '序列与预测下一个 token',
  P2: '注意力与 Transformer',
  P3: '外部记忆与指针',
  P4: '规模定律',
  P5: 'PPO 与 RLHF',
  P6: '压缩、复杂性、通用智能',
  补完: '按单元补完',
};
export const SEGMENT_KEYS = Object.keys(SEGMENTS);
export const PAPER_SLUG_RE = /^p-(\d{2})-[a-z0-9-]+$/;
export const UNIT_RE = /^[A-Za-z0-9_.-]+$/;
export const UNIT_BASE = 'https://github.com/Ojhaharsh/30u30/tree/main/papers/';
export const unitUrl = (unit) => `${UNIT_BASE}${unit}`;
/** 单元目录名开头的两位数字就是 Day，如 01_Unreasonable_Effectiveness → 1 */
export const dayOfUnit = (unit) => { const m = /^(\d{1,2})_/.exec(unit ?? ''); return m ? +m[1] : null; };
/** 从 30u30 单元网址取单元目录名 */
export const UNIT_URL_RE = /^https:\/\/github\.com\/Ojhaharsh\/30u30\/tree\/main\/papers\/([A-Za-z0-9_.-]+)\/?$/;

export const PAPER_REQUIRED = ['title_zh', 'title_en', 'slug', 'day', 'segment', 'unit', 'source_url', 'published', 'summary', 'tags', 'reading_time', 'authors_en'];
export const PAPER_OPTIONAL = ['notes_updated', 'source_note', 'venue', 'source_version'];

function splitFm(src) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(src);
  return m ? { fm: m[1], body: m[2] } : { fm: '', body: src };
}
/** 读取目录下的 md：[{ file, id, d, body, err }]（frontmatter 解析失败时 err 有值） */
export function readMdDir(dir, re) {
  if (!dir || !existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => re.test(f)).sort().map((f) => {
    const { fm, body } = splitFm(readFileSync(join(dir, f), 'utf8'));
    try { return { file: f, id: f.replace(/\.md$/, ''), d: yaml.load(fm) ?? {}, body }; }
    catch (e) { return { file: f, id: f.replace(/\.md$/, ''), d: {}, body, err: `frontmatter 解析失败：${e.message.split('\n')[0]}` }; }
  });
}
export const readPapers = (dir) => readMdDir(dir, /^p-.*\.md$/);

/** r-30u30 资源页正文里的单元链接：Map<unit, day> */
export function readUnitLinks(resDir) {
  const f = resDir && join(resDir, 'r-30u30.md');
  const out = new Map();
  if (!f || !existsSync(f)) return out;
  for (const m of readFileSync(f, 'utf8').matchAll(/\]\((https:\/\/github\.com\/Ojhaharsh\/30u30\/tree\/main\/papers\/[^)\s]+)\)/g)) {
    const u = UNIT_URL_RE.exec(m[1])?.[1];
    if (u) out.set(u, dayOfUnit(u));
  }
  return out;
}

const isDate = (v) => v instanceof Date ? !isNaN(v) : typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isUrl = (v) => { try { return /^https?:$/.test(new URL(v).protocol); } catch { return false; } };
const strArr = (v) => Array.isArray(v) && v.every((x) => typeof x === 'string' && x.trim());
/**
 * 纯 JS 校验（与 content.config 的 zod schema 同一套规则，unit 在这里是必填）。
 * 返回 [{ field, msg }]。opts.tags：标签白名单；opts.units：r-30u30 的单元集合（Map/Set）。
 */
export function validatePaper(p, { tags, units } = {}) {
  const d = p.d ?? {}; const errs = []; const e = (field, msg) => errs.push({ field, msg });
  if (p.err) return [{ field: '(frontmatter)', msg: p.err }];
  for (const k of PAPER_REQUIRED) if (d[k] === undefined || d[k] === null || d[k] === '') e(k, '缺少（必填）');
  for (const k of Object.keys(d)) if (!PAPER_REQUIRED.includes(k) && !PAPER_OPTIONAL.includes(k)) e(k, '不认识的字段');
  for (const k of ['title_zh', 'title_en', 'summary']) if (d[k] != null && (typeof d[k] !== 'string' || !d[k].trim())) e(k, '须为非空字符串');
  if (d.slug != null) {
    if (!PAPER_SLUG_RE.test(String(d.slug))) e('slug', '须匹配 p-<两位天数>-<slug>（小写字母、数字、短横线）');
    if (d.slug !== p.id) e('slug', `与文件名 ${p.id} 不一致`);
    const dd = PAPER_SLUG_RE.exec(String(d.slug))?.[1];
    if (dd && d.day != null && +dd !== d.day) e('slug', `文件名天数 ${dd} 与 day ${d.day} 不一致`);
  }
  if (d.day != null && !(Number.isInteger(d.day) && d.day >= 1 && d.day <= 30)) e('day', `须为 1–30 的整数（当前 ${JSON.stringify(d.day)}）`);
  if (d.segment != null && !SEGMENT_KEYS.includes(d.segment)) e('segment', `须为 ${SEGMENT_KEYS.join(' / ')}（当前 ${JSON.stringify(d.segment)}）`);
  if (d.unit != null) {
    if (typeof d.unit !== 'string' || !UNIT_RE.test(d.unit)) e('unit', '须为 30u30 papers/ 下的单元目录名');
    else {
      if (dayOfUnit(d.unit) !== d.day) e('unit', `单元 ${d.unit} 的天数与 day ${d.day} 不一致`);
      if (units && !units.has(d.unit)) e('unit', `${d.unit} 不在 resources/r-30u30.md 的单元链接里`);
    }
  }
  if (d.source_url != null && !isUrl(d.source_url)) e('source_url', '不是合法 URL');
  if (d.published != null && !isDate(d.published)) e('published', '须为日期 YYYY-MM-DD');
  if (d.notes_updated != null && !isDate(d.notes_updated)) e('notes_updated', '须为日期 YYYY-MM-DD');
  if (d.tags != null) {
    if (!strArr(d.tags) && !(Array.isArray(d.tags) && d.tags.length === 0)) e('tags', '须为字符串数组');
    else if (tags) for (const t of d.tags) if (!tags.includes(t)) e('tags', `「${t}」不在标签白名单内`);
  }
  if (d.reading_time != null && !(typeof d.reading_time === 'number' && d.reading_time > 0)) e('reading_time', '须为正数（分钟）');
  if (d.authors_en != null && !(strArr(d.authors_en) && d.authors_en.length)) e('authors_en', '须为非空字符串数组');
  for (const k of ['venue', 'source_version', 'source_note']) if (d[k] != null && (typeof d[k] !== 'string' || !d[k].trim())) e(k, '须为非空字符串');
  return errs;
}
