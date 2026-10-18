// mermaid 源码的轻量模型（无依赖，构建期、检查脚本和浏览器共用）：
// 时序图：参与者别名（按首次出现顺序）、消息条数（源码顺序）、loop/opt/alt/par/critical/break 块（源码开始顺序 + 结束顺序）；
// 流程图：出现过的节点 id。用于 ```anim-steps 的 highlight 引用：别名 / msg:n / block:n / 节点 id。
const ARROW = /^\s*([^\s:;+\-<>()]+?)\s*(?:<<)?(-->>|->>|-->|->|--x|-x|--\)|-\))\s*[+-]?\s*([^\s:;+\-<>()]+?)\s*:/;
const BLOCK = /^\s*(loop|opt|alt|par|critical|break|rect)\b/;
export function mermaidModel(src) {
  const lines = String(src).split('\n').map((l) => l.replace(/%%.*$/, ''));
  const head = (lines.find((l) => l.trim()) ?? '').trim();
  if (/^sequenceDiagram\b/.test(head)) {
    const participants = []; const add = (a) => { if (!participants.includes(a)) participants.push(a); };
    let messages = 0; const stack = []; const blocks = []; const endOrder = [];
    for (const l of lines.slice(1)) {
      const p = /^\s*(?:participant|actor)\s+(\S+?)(?:\s+as\s+.*)?\s*$/.exec(l);
      if (p) { add(p[1]); continue; }
      const b = BLOCK.exec(l);
      if (b) { if (b[1] === 'rect') stack.push(-1); else { stack.push(blocks.length); blocks.push(b[1]); } continue; }
      if (/^\s*end\s*$/.test(l)) { const i = stack.pop(); if (i !== undefined && i >= 0) endOrder.push(i); continue; }
      const m = ARROW.exec(l);
      if (m) { add(m[1]); add(m[3]); messages++; }
    }
    return { kind: 'sequence', participants, messages, blocks, endOrder };
  }
  if (/^(flowchart|graph)\b/.test(head)) {
    const nodes = new Set();
    for (const l of lines.slice(1)) {
      const s = l.replace(/"[^"]*"/g, '""').replace(/\|[^|]*\|/g, ' ');
      if (/^\s*(subgraph|end|direction|classDef|class|style|linkStyle|click)\b/.test(s)) continue;
      for (const m of s.matchAll(/(?:^|[\s;&>-])([A-Za-z_][\w]*)(?=\s*(?:[[({>]|-->|---|-\.|==|&|;|$))/g)) nodes.add(m[1]);
    }
    return { kind: 'flowchart', nodes: [...nodes] };
  }
  return { kind: 'other' };
}
export const REF_RE = /^(?:msg:\d+|block:\d+|[A-Za-z_][\w-]*)$/;
/** 静态核对一个引用；返回错误文字或 null */
export function checkRef(model, ref) {
  if (!REF_RE.test(ref)) return `「${ref}」不是合法引用（参与者别名、msg:n、block:n 或流程图节点 id）`;
  if (model.kind === 'sequence') {
    const m = /^(msg|block):(\d+)$/.exec(ref);
    if (m) {
      const n = +m[2], max = m[1] === 'msg' ? model.messages : model.blocks.length;
      return n >= 1 && n <= max ? null : `${ref} 超出范围（该图共 ${max} 条${m[1] === 'msg' ? '消息' : '块'}，从 1 开始）`;
    }
    return model.participants.includes(ref) ? null : `「${ref}」不是该时序图的参与者别名（${model.participants.join('、')}）`;
  }
  if (model.kind === 'flowchart') return model.nodes.includes(ref) ? null : `「${ref}」不是该流程图的节点 id`;
  return '前一个 mermaid 图既不是时序图也不是流程图，无法分步高亮';
}
