import { getCollection, type CollectionEntry } from 'astro:content';
import { getSortedNotes } from './notes';
import { STAGES, stageOfOrder } from '../data/stages';

const warned = new Set<string>();
const warnOnce = (m: string) => { if (!warned.has(m)) { warned.add(m); console.warn(m); } };

export type Resource = CollectionEntry<'resources'>;
export const resSlug = (r: Resource) => r.data.slug ?? r.id;

/** 资源按主阶段、首次出现的 step 排序；顺带检查 slug 与引用（引用错误只警告，不中断构建） */
export async function getSortedResources() {
  const [list, notes] = await Promise.all([getCollection('resources'), getSortedNotes()]);
  const noteSlugs = new Set(notes.map((n) => n.data.slug));
  for (const r of list) {
    if (r.data.slug && r.data.slug !== r.id)
      throw new Error(`[resources] ${r.id}.md: frontmatter slug "${r.data.slug}" 与文件名不一致`);
    for (const s of r.data.pairs_with) if (!noteSlugs.has(s)) warnOnce(`[resources] ${r.id}.md: pairs_with 中的 "${s}" 不是现有笔记 slug（页面上将不显示该链接）`);
    for (const e of r.data.route) if (e.after && !noteSlugs.has(e.after)) warnOnce(`[resources] ${r.id}.md: route.after "${e.after}" 不是现有笔记 slug（将排在所属阶段开头）`);
  }
  const firstStep = (r: Resource) => Math.min(...r.data.route.map((e) => e.step ?? Infinity), Infinity);
  return list.sort((a, b) => (a.data.stage ?? 9) - (b.data.stage ?? 9) || firstStep(a) - firstStep(b) || a.id.localeCompare(b.id));
}

export type PathItem =
  | { type: 'note'; note: Awaited<ReturnType<typeof getSortedNotes>>[number] }
  | { type: 'resource'; res: Resource; part?: string; optional?: boolean };

/**
 * 合成学习路线：笔记按 order 归入阶段；资源的每个 route 条目插在 `after` 指向的笔记之后。
 * 条目所属阶段 = route.stage ?? （after 笔记所在阶段）?? 资源 stage；
 * 若 after 笔记在更早的阶段（或为 null），则放在所属阶段开头。同一位置多条按 step 排序。
 */
export async function getLearningPath() {
  const [notes, resources] = await Promise.all([getSortedNotes(), getSortedResources()]);
  const orderOf = new Map(notes.map((n) => [n.data.slug, n.data.order]));
  type Keyed = { stage: number; pos: number; tie: number; item: PathItem };
  const rows: Keyed[] = notes.map((n) => ({ stage: stageOfOrder(n.data.order), pos: n.data.order, tie: -1, item: { type: 'note', note: n } }));
  for (const res of resources) {
    const entries = res.data.route.length ? res.data.route : [{ after: null } as (typeof res.data.route)[number]];
    for (const e of entries) {
      const afterOrder = e.after ? orderOf.get(e.after) : undefined;
      const stage = e.stage ?? (afterOrder ? stageOfOrder(afterOrder) : undefined) ?? res.data.stage ?? STAGES.length;
      const pos = afterOrder && stageOfOrder(afterOrder) === stage ? afterOrder : 0;
      rows.push({ stage, pos, tie: e.step ?? 1e6, item: { type: 'resource', res, part: e.part, optional: e.optional ?? res.data.optional } });
    }
  }
  rows.sort((a, b) => a.stage - b.stage || a.pos - b.pos || a.tie - b.tie);
  return STAGES.map((s) => ({ ...s, items: rows.filter((r) => r.stage === s.n).map((r) => r.item) }));
}
