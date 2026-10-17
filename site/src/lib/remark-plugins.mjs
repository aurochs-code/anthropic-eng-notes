import { visit } from 'unist-util-visit';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** ```mermaid 代码块 → <pre class="mermaid">（绕过语法高亮，交给客户端 mermaid 渲染） */
export function remarkMermaid() {
  return (tree) => {
    visit(tree, 'code', (node, index, parent) => {
      if (node.lang !== 'mermaid' || !parent) return;
      parent.children[index] = { type: 'html', value: `<pre class="mermaid">${esc(node.value)}</pre>` };
    });
  };
}

/**
 * 站内 .md 相对链接改写（只处理相对路径，外部 URL 不动）：
 *   ./r-xxx.md(#h)  → {base}/resources/r-xxx/(#h)
 *   ./slug.md(#h)   → {base}/notes/slug/(#h)
 * 允许带 ../ 或 notes/、resources/ 目录前缀。
 */
export const LINK_RE = /^(?:\.{1,2}\/)*(?:notes\/|resources\/)?([\w-]+)\.md(#.*)?$/;
export function rewriteMdLink(href, base = '') {
  const m = LINK_RE.exec(href);
  if (!m) return null;
  const slug = m[1].toLowerCase();
  const section = slug.startsWith('r-') ? 'resources' : 'notes';
  return `${base.replace(/\/$/, '')}/${section}/${slug}/${m[2] ?? ''}`;
}
export function remarkNoteLinks({ base = '' } = {}) {
  return (tree) => {
    visit(tree, 'link', (node) => {
      const u = rewriteMdLink(node.url, base);
      if (u) node.url = u;
    });
  };
}
