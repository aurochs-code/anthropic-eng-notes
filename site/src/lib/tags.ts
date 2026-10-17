import { getSortedNotes } from './notes';
import { getSortedResources, type Resource } from './resources';
import { getSortedPapers, type Paper } from './papers';

type Note = Awaited<ReturnType<typeof getSortedNotes>>[number];
export const tagSlug = (t: string) => t.trim().toLowerCase().replace(/\s+/g, '-');

/** 全站标签：笔记与资源的 tags 合并；按使用次数降序、同次数按字母序 */
export async function getTags() {
  const [notes, resources, papers] = await Promise.all([getSortedNotes(), getSortedResources(), getSortedPapers()]);
  const map = new Map<string, { tag: string; slug: string; notes: Note[]; resources: Resource[]; papers: Paper[] }>();
  const get = (t: string) => {
    const slug = tagSlug(t);
    if (!map.has(slug)) map.set(slug, { tag: t.trim(), slug, notes: [], resources: [], papers: [] });
    return map.get(slug)!;
  };
  for (const n of notes) for (const t of new Set(n.data.tags.map(tagSlug))) get(t).notes.push(n);
  for (const r of resources) for (const t of new Set(r.data.tags.map(tagSlug))) get(t).resources.push(r);
  for (const p of papers) for (const t of new Set(p.data.tags.map(tagSlug))) get(t).papers.push(p);
  return [...map.values()].sort((a, b) => b.notes.length + b.resources.length + b.papers.length - (a.notes.length + a.resources.length + a.papers.length) || a.slug.localeCompare(b.slug));
}
