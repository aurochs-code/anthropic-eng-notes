// 反向链接：构建时扫描笔记与资源正文里的站内 .md 链接（与 remarkNoteLinks 同一规则），
// 加上资源的 pairs_with（资源 → 笔记）。结果：目标页 → 引用它的笔记 / 资源。
import { LINK_RE } from './remark-plugins.mjs';
import { getSortedNotes } from './notes';
import { getSortedResources, type Resource } from './resources';
import { getSortedPapers, type Paper } from './papers';

type Note = Awaited<ReturnType<typeof getSortedNotes>>[number];
export type Backlink = { kind: 'note'; note: Note; via: 'link' } | { kind: 'paper'; paper: Paper; via: 'link' } | { kind: 'resource'; res: Resource; via: 'link' | 'pairs' | 'both' };

const MD_LINK = /\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g;
/** 正文里指向站内页面的 slug 集合（笔记 slug 或 r-xxx） */
export function linkedSlugs(body: string | undefined) {
  const out = new Set<string>();
  for (const m of (body ?? '').matchAll(MD_LINK)) {
    const r = LINK_RE.exec(m[1]);
    if (r) out.add(r[1].toLowerCase());
  }
  return out;
}

let cache: Map<string, Backlink[]> | null = null;
/** key：笔记 slug 或资源 slug（r-xxx） */
export async function getBacklinks() {
  if (cache) return cache;
  const [notes, resources, papers] = await Promise.all([getSortedNotes(), getSortedResources(), getSortedPapers()]);
  const valid = new Set([...notes.map((n) => n.data.slug), ...resources.map((r) => r.data.slug), ...papers.map((p) => p.data.slug)]);
  const map = new Map<string, Backlink[]>();
  const add = (target: string, b: Backlink) => (map.get(target) ?? map.set(target, []).get(target)!).push(b);
  for (const n of notes)
    for (const t of linkedSlugs(n.body)) if (t !== n.data.slug && valid.has(t)) add(t, { kind: 'note', note: n, via: 'link' });
  for (const p of papers)
    for (const t of linkedSlugs(p.body)) if (t !== p.data.slug && valid.has(t)) add(t, { kind: 'paper', paper: p, via: 'link' });
  for (const r of resources) {
    const links = linkedSlugs(r.body);
    const pairs = new Set(r.data.pairs_with);
    for (const t of new Set([...links, ...pairs])) {
      if (t === r.data.slug || !valid.has(t)) continue;
      add(t, { kind: 'resource', res: r, via: links.has(t) && pairs.has(t) ? 'both' : links.has(t) ? 'link' : 'pairs' });
    }
  }
  cache = map;
  return map;
}
