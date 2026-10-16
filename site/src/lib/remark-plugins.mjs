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

/** 笔记间相对链接 ./slug.md(#hash) → {base}/notes/slug/(#hash) */
export function remarkNoteLinks({ base = '' } = {}) {
  const b = base.replace(/\/$/, '');
  return (tree) => {
    visit(tree, 'link', (node) => {
      const m = /^(?:\.\/)?([\w-]+)\.md(#.*)?$/.exec(node.url);
      if (m) node.url = `${b}/notes/${m[1].toLowerCase()}/${m[2] ?? ''}`;
    });
  };
}
