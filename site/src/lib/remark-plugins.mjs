import { visit, SKIP } from 'unist-util-visit';
import { readPapers, UNIT_URL_RE, dayOfUnit, PAPER_SLUG_RE } from './paper-rules.mjs';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function splitSourceNote(text) {
  const trimmed = text.trim();
  const cut = trimmed.indexOf('。');
  if (cut === -1) return { lead: trimmed, rest: '' };
  return { lead: trimmed.slice(0, cut + 1), rest: trimmed.slice(cut + 1).trim() };
}

/** ```mermaid 代码块 → <pre class="mermaid">（绕过语法高亮，交给客户端 mermaid 渲染） */
export function remarkMermaid() {
  return (tree) => {
    visit(tree, 'code', (node, index, parent) => {
      if (node.lang !== 'mermaid' || !parent) return;
      parent.children[index] = { type: 'html', value: `<pre class="mermaid" data-pagefind-ignore>${esc(node.value)}</pre>` };
    });
    visit(tree, (node) => {
      if (node.type === 'code') return SKIP;
      if (node.type !== 'blockquote') return;
      const para = node.children[0];
      if (!para || para.type !== 'paragraph') return;
      const text = para.children[0];
      if (!text || text.type !== 'text' || !/^\u26A0\uFE0F?/.test(text.value.trimStart())) return;
      if (!node.data) node.data = {};
      if (!node.data.hProperties) node.data.hProperties = {};
      node.data.hProperties.className = ['callout', 'warn'];
    });
  };
}

/**
 * 站内 .md 相对链接改写（只处理相对路径，外部 URL 不动）：
 *   ./r-xxx.md(#h)  → {base}/resources/r-xxx/(#h)
 *   ./p-NN-xxx.md(#h) → {base}/papers/p-NN-xxx/(#h)
 *   ./slug.md(#h)   → {base}/notes/slug/(#h)
 * 允许带 ../ 或 notes/、resources/、papers/ 目录前缀（论文笔记里写 ../notes/x.md、../resources/r-x.md）。
 */
export const LINK_RE = /^(?:\.{1,2}\/)*(?:notes\/|resources\/|papers\/)?([\w-]+)\.md(#.*)?$/;
export const sectionOf = (slug) => (slug.startsWith('r-') ? 'resources' : PAPER_SLUG_RE.test(slug) ? 'papers' : 'notes');
export function rewriteMdLink(href, base = '') {
  const m = LINK_RE.exec(href);
  if (!m) return null;
  const slug = m[1].toLowerCase();
  const section = sectionOf(slug);
  return `${base.replace(/\/$/, '')}/${section}/${slug}/${m[2] ?? ''}`;
}
/**
 * papersDir 给出时：指向尚未写好的论文笔记（papers/ 只有部分篇目）的 .md 链接不生成死链，
 * 而是去掉链接、保留文字；写好后重新构建即自动变成链接。
 */
export function remarkNoteLinks({ base = '', papersDir } = {}) {
  const papers = papersDir ? new Set(readPapers(papersDir).map((p) => p.id)) : null;
  return (tree) => {
    visit(tree, 'link', (node, index, parent) => {
      const u = rewriteMdLink(node.url, base);
      if (!u) return;
      const slug = LINK_RE.exec(node.url)[1].toLowerCase();
      if (papers && parent && sectionOf(slug) === 'papers' && !papers.has(slug)) {
        parent.children.splice(index, 1, ...node.children);
        return index;
      }
      node.url = u;
    });
  };
}

/**
 * 标题锚点（rehype）：给带 id 的 h2–h4 末尾追加 `<a class="anchor" href="#id">#</a>`。
 * 须排在 rehypeHeadingIds 之后（astro.config.mjs 里显式先放 rehypeHeadingIds）。
 * Astro 收集的 headings（TOC 用）在 rehypeHeadingIds 阶段生成，不含这个 "#"。
 */
export function rehypeHeadingAnchors() {
  return (tree) => {
    visit(tree, 'element', (node) => {
      if (!/^h[2-4]$/.test(node.tagName) || !node.properties?.id) return;
      node.children.push({
        type: 'element',
        tagName: 'a',
        properties: { className: ['anchor'], href: `#${node.properties.id}`, ariaLabel: '本节链接', dataPagefindIgnore: '' },
        children: [{ type: 'text', value: '#' }],
      });
    });
  };
}

/**
 * 30u30 单元链接 → 站内论文笔记（渲染层，不改内容文件）：
 * 正文里 https://github.com/Ojhaharsh/30u30/tree/main/papers/<unit> 的链接，若有对应论文笔记
 * （frontmatter unit 相同；没写 unit 时按单元目录名开头的天数与 day 匹配），
 * 改指 {base}/papers/<slug>/，并紧跟一个小的「↗」链接保留 GitHub 单元地址。
 * 论文笔记目录在构建开始时读取一次（构建前须清 .astro 缓存，否则资源页渲染结果可能被缓存）。
 */
export function remarkPaperLinks({ base = '', papersDir } = {}) {
  const byUnit = new Map(), byDay = new Map();
  for (const p of readPapers(papersDir)) {
    const d = p.d ?? {};
    if (typeof d.slug !== 'string' || d.slug !== p.id || !PAPER_SLUG_RE.test(d.slug)) continue;
    if (typeof d.unit === 'string') byUnit.set(d.unit, d.slug);
    if (Number.isInteger(d.day) && !byDay.has(d.day)) byDay.set(d.day, d.slug);
  }
  const b = base.replace(/\/$/, '');
  return (tree) => {
    visit(tree, 'link', (node, index, parent) => {
      const unit = UNIT_URL_RE.exec(node.url)?.[1];
      if (!unit || !parent || node.data?.paperLink) return;
      const slug = byUnit.get(unit) ?? byDay.get(dayOfUnit(unit));
      if (!slug) return;
      const gh = node.url;
      node.url = `${b}/papers/${slug}/`;
      node.data = { ...node.data, paperLink: true, hProperties: { ...(node.data?.hProperties ?? {}), 'data-paper-link': slug, title: '站内论文笔记' } };
      parent.children.splice(index + 1, 0, {
        type: 'link', url: gh,
        data: { paperLink: true, hProperties: { className: ['unit-gh'], title: `30u30 单元 ${unit}（GitHub）`, 'aria-label': `30u30 单元 ${unit}（GitHub）`, 'data-unit-gh': unit } },
        children: [{ type: 'text', value: '↗' }],
      });
      return index + 2;
    });
  };
}
