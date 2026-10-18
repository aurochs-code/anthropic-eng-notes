// ```anim / ```anim-steps → 占位 figure（构建时预渲染静态 SVG + figcaption + 步骤列表，关 JS 也完整）。
// 须排在 remarkMermaid 之前（anim-steps 要看到紧邻的上一个 mermaid 代码块）。
// 出错时抛出「文件:行号 字段 原因」，中断构建。
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { parseBlock, validateAnim, validateAnimSteps, keyLine, COMPONENT_NAMES } from './rules.mjs';
import { COMPONENTS } from './static.ts';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const json = (o) => JSON.stringify(o).replace(/</g, '\\u003c');
const seen = new Map(); // id → 文件（同一文件重复渲染时覆盖，不同文件同 id 报错）
const stepsList = (steps) => `<ol class="anim-steps">${steps.map((s) => `<li>${esc(s.text)}</li>`).join('')}</ol>`;

export function remarkAnim({ repoRoot } = {}) {
  return (tree, file) => {
    const path = file.path || file.history?.[0] || '';
    let src = ''; try { src = path ? readFileSync(path, 'utf8') : ''; } catch {}
    const srcLines = src.split('\n');
    const fm = /^---\r?\n[\s\S]*?\r?\n---\r?\n/.exec(src);
    const fmLines = fm ? fm[0].split('\n').length - 1 : 0;
    const rel = path && repoRoot ? relative(repoRoot, path) : path || '(未知文件)';
    // remark 行号可能相对正文（去掉 frontmatter），按源码核对出真实行号
    const fileLine = (l) => (/^\s*(`{3,}|~{3,})\s*anim/.test(srcLines[l + fmLines - 1] ?? '') ? l + fmLines : l);
    const fail = (node, body, key, msg) => {
      const at = fileLine(node.position?.start.line ?? 1) + 1 + (key ? keyLine(body, key) : 0);
      throw new Error(`[anim] ${rel}:${at} ${msg}`);
    };
    const kids = tree.children;
    for (let i = 0; i < kids.length; i++) {
      const node = kids[i];
      if (node.type !== 'code' || (node.lang !== 'anim' && node.lang !== 'anim-steps')) continue;
      const body = node.value;
      const p = parseBlock(body);
      if (p.error) fail(node, body, '', p.error);
      const d = p.data;
      if (node.lang === 'anim') {
        const errs = validateAnim(d, COMPONENT_NAMES);
        if (errs.length) fail(node, body, errs[0].key, errs.map((e) => e.msg).join('；'));
        const comp = COMPONENTS[d.component];
        if (!comp) fail(node, body, 'component', `组件「${d.component}」在构建期组件表里不存在`);
        const cfg = { id: d.id, component: d.component, caption: d.caption, alt: d.alt, params: d.params ?? {}, steps: d.steps ?? [] };
        const perr = comp.validate(cfg.params, cfg.steps);
        if (perr.length) fail(node, body, 'params', `params 校验失败：${perr.join('；')}`);
        dup(d.id, rel, () => fail(node, body, 'id', `id「${d.id}」与 ${seen.get(d.id)} 重复`));
        kids[i] = { type: 'html', value:
          `<figure class="anim" id="anim-${d.id}" data-anim="${esc(d.component)}" data-anim-id="${esc(d.id)}">` +
          `<div class="anim-stage">${comp.renderStatic(cfg)}</div>` +
          `<figcaption>${esc(d.caption)}</figcaption>` + (cfg.steps.length ? stepsList(cfg.steps) : '') +
          `<script type="application/json" class="anim-cfg">${json(cfg)}</script></figure>` };
      } else {
        const prev = kids[i - 1]?.type === 'code' && kids[i - 1].lang === 'mermaid' ? kids[i - 1].value : null;
        const errs = validateAnimSteps(d, prev);
        if (errs.length) fail(node, body, errs[0].key, errs.map((e) => e.msg).join('；'));
        dup(d.id, rel, () => fail(node, body, 'id', `id「${d.id}」与 ${seen.get(d.id)} 重复`));
        const cfg = { id: d.id, caption: d.caption, alt: d.alt ?? '', steps: d.steps, src: prev };
        kids[i] = { type: 'html', value:
          `<figure class="anim-steps-fig" id="anim-${d.id}" data-anim-steps="${esc(d.id)}"${d.alt ? ` aria-label="${esc(d.alt)}"` : ''}>` +
          `<figcaption>${esc(d.caption)}</figcaption>${stepsList(d.steps)}` +
          `<script type="application/json" class="anim-cfg">${json(cfg)}</script></figure>` };
      }
    }
  };
}
function dup(id, rel, onDup) {
  if (seen.has(id) && seen.get(id) !== rel) onDup();
  seen.set(id, rel);
}
