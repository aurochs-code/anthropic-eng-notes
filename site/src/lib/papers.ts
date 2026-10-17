import { getCollection, type CollectionEntry } from 'astro:content';
import { SEGMENTS, SEGMENT_KEYS, unitUrl } from './paper-rules.mjs';

export type Paper = CollectionEntry<'papers'>;
export { SEGMENTS, SEGMENT_KEYS };
export const paperUrlPath = (slug: string) => `papers/${slug}/`;
export const dd = (n: number) => String(n).padStart(2, '0');

/** 论文笔记按 day 排序；slug = 文件名、day 不重复，否则中断构建。papers/ 只有部分篇目时照常构建。 */
let validated = false;
export async function getSortedPapers() {
  const list = await getCollection('papers');
  if (!validated) {
    const errs: string[] = []; const days = new Map<number, string>();
    for (const p of list) {
      if (p.data.slug !== p.id) errs.push(`papers/${p.id}.md: slug "${p.data.slug}" 与文件名不一致`);
      if (days.has(p.data.day)) errs.push(`papers/${p.id}.md: day ${p.data.day} 与 ${days.get(p.data.day)} 重复`);
      else days.set(p.data.day, p.id);
    }
    if (errs.length) throw new Error(`[papers] 论文笔记校验失败：\n  - ${errs.join('\n  - ')}`);
    validated = true;
  }
  return list.sort((a, b) => a.data.day - b.data.day);
}

/** 按支线段分组（P1–P6、补完），空段不返回 */
export async function getPaperGroups() {
  const papers = await getSortedPapers();
  return SEGMENT_KEYS.map((k) => ({ key: k, name: (SEGMENTS as Record<string, string>)[k], items: papers.filter((p) => p.data.segment === k) })).filter((g) => g.items.length);
}

/** 30u30 单元链接（unit 必填） */
export const unitOf = (p: Paper) => ({ unit: p.data.unit, url: unitUrl(p.data.unit) });
