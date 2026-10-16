import { getCollection } from 'astro:content';

export async function getSortedNotes() {
  const notes = await getCollection('notes');
  const seenOrder = new Map<number, string>();
  const seenSlug = new Map<string, string>();
  for (const n of notes) {
    if (n.data.slug !== n.id)
      throw new Error(`[notes] ${n.id}.md: frontmatter slug "${n.data.slug}" 与文件名不一致`);
    if (seenOrder.has(n.data.order))
      throw new Error(`[notes] order ${n.data.order} 重复：${seenOrder.get(n.data.order)} 与 ${n.id}`);
    seenOrder.set(n.data.order, n.id);
    seenSlug.set(n.data.slug, n.id);
  }
  return notes.sort((a, b) => a.data.order - b.data.order);
}

export const fmtDate = (d: Date) => d.toISOString().slice(0, 10);
export const url = (p: string) => `${import.meta.env.BASE_URL.replace(/\/$/, '')}/${p.replace(/^\//, '')}`;
