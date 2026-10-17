import { getSortedNotes } from './notes';
import { getSortedResources, type Resource } from './resources';

type Note = Awaited<ReturnType<typeof getSortedNotes>>[number];
export const tagSlug = (t: string) => t.trim().toLowerCase().replace(/\s+/g, '-');

/** 全站标签：笔记与资源的 tags 合并；按使用次数降序、同次数按字母序 */
export async function getTags() {
  const [notes, resources] = await Promise.all([getSortedNotes(), getSortedResources()]);
  const map = new Map<string, { tag: string; slug: string; notes: Note[]; resources: Resource[] }>();
  const get = (t: string) => {
    const slug = tagSlug(t);
    if (!map.has(slug)) map.set(slug, { tag: t.trim(), slug, notes: [], resources: [] });
    return map.get(slug)!;
  };
  for (const n of notes) for (const t of new Set(n.data.tags.map(tagSlug))) get(t).notes.push(n);
  for (const r of resources) for (const t of new Set(r.data.tags.map(tagSlug))) get(t).resources.push(r);
  return [...map.values()].sort((a, b) => b.notes.length + b.resources.length - (a.notes.length + a.resources.length) || a.slug.localeCompare(b.slug));
}
