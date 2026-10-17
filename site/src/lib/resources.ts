import { getCollection, type CollectionEntry } from 'astro:content';
import { getSortedNotes } from './notes';
import { STAGES, stageOfOrder } from '../data/stages';

export type Resource = CollectionEntry<'resources'>;
export const resSlug = (r: Resource) => r.data.slug;

/**
 * 资源按主阶段、首个 step 排序；跨文件校验（任一失败即中断构建）：
 * slug = 文件名；pairs_with / route.after 必须是现有笔记；step 全站唯一；
 * 非选读条目必须写 step，选读条目（条目或资源 optional: true）不写 step。
 */
let validated = false;
export async function getSortedResources() {
  const [list, notes] = await Promise.all([getCollection('resources'), getSortedNotes()]);
  if (!validated) {
    const noteSlugs = new Set(notes.map((n) => n.data.slug));
    const errs: string[] = [];
    const steps = new Map<number, string>();
    for (const r of list) {
      const f = `resources/${r.id}.md`;
      if (r.data.slug !== r.id) errs.push(`${f}: slug "${r.data.slug}" 与文件名不一致`);
      for (const s of r.data.pairs_with) if (!noteSlugs.has(s)) errs.push(`${f}: pairs_with 中的 "${s}" 不是现有笔记 slug`);
      r.data.route.forEach((e, i) => {
        const at = `${f}: route[${i}]`;
        if (e.after !== null && !noteSlugs.has(e.after)) errs.push(`${at}.after "${e.after}" 不是现有笔记 slug`);
        const opt = e.optional ?? r.data.optional ?? false;
        if (opt && e.step !== undefined) errs.push(`${at}: 选读条目不应写 step（当前 ${e.step}）`);
        if (!opt && e.step === undefined) errs.push(`${at}: 非选读条目必须写 step`);
        if (e.step !== undefined) {
          if (steps.has(e.step)) errs.push(`${at}: step ${e.step} 与 ${steps.get(e.step)} 重复`);
          else steps.set(e.step, `${f} route[${i}]`);
        }
      });
    }
    if (errs.length) throw new Error(`[resources] 资源导读校验失败：\n  - ${errs.join('\n  - ')}`);
    validated = true;
  }
  const firstStep = (r: Resource) => Math.min(...r.data.route.map((e) => e.step ?? Infinity));
  return list.sort((a, b) => a.data.stage - b.data.stage || firstStep(a) - firstStep(b) || a.id.localeCompare(b.id));
}

export type PathItem =
  | { type: 'note'; note: Awaited<ReturnType<typeof getSortedNotes>>[number] }
  | { type: 'resource'; res: Resource; part?: string; step?: number; optional?: boolean };

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
  // track（如 theory）资源不进入主线，见 getTracks()
  for (const res of resources.filter((r) => !r.data.track)) {
    for (const e of res.data.route) {
      const afterOrder = e.after ? orderOf.get(e.after) : undefined;
      const stage = e.stage ?? (afterOrder ? stageOfOrder(afterOrder) : undefined) ?? res.data.stage;
      const pos = afterOrder && stageOfOrder(afterOrder) === stage ? afterOrder : 0;
      rows.push({ stage, pos, tie: e.step ?? 1e6, item: { type: 'resource', res, part: e.part, step: e.step, optional: e.optional ?? res.data.optional } });
    }
  }
  rows.sort((a, b) => a.stage - b.stage || a.pos - b.pos || a.tie - b.tie);
  return STAGES.map((s) => ({ ...s, items: rows.filter((r) => r.stage === s.n).map((r) => r.item) }));
}

export const TRACKS = {
  theory: { name: '原理支线', startsAfter: 1, parallelWith: [2, 3] },
} as const;
export type TrackItem = { res: Resource; part: string; after: string | null; stage?: number };

/**
 * 并行支线：按 track 分组，资源按 getSortedResources 顺序、条目按 route 顺序排列。
 * 没有该 track 的资源时不返回该支线（页面不渲染空支线）。
 */
export async function getTracks() {
  const resources = await getSortedResources();
  return (Object.keys(TRACKS) as (keyof typeof TRACKS)[])
    .map((key) => ({
      key,
      ...TRACKS[key],
      items: resources
        .filter((r) => r.data.track === key)
        .flatMap((res) => res.data.route.map((e): TrackItem => ({ res, part: e.part, after: e.after, stage: e.stage }))),
    }))
    .filter((t) => t.items.length > 0);
}

export type SeqItem = { n: number; stage: number; item: PathItem };
/**
 * 主线编号序列（与 /path/ 页编号一致）：笔记与非选读资源条目依次编号 1..N；选读、支线不计。
 * 供“按学习路线的上一步/下一步”和面包屑“第 M 步”使用。
 */
export async function getMainSequence(): Promise<SeqItem[]> {
  const stages = await getLearningPath();
  const seq: SeqItem[] = [];
  for (const s of stages)
    for (const it of s.items) if (it.type === 'note' || !it.optional) seq.push({ n: seq.length + 1, stage: s.n, item: it });
  return seq;
}
