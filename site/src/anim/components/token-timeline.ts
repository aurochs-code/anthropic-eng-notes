// token-timeline：上下文窗口时间轴（分步）。试点用于上下文工程（分镜 anim/storyboards/context-window.md）。
// 一条长条 = 主上下文窗口（capacity 格），按段类型着色；可选「窗口外」卡片、子智能体窗口、交回的摘要。
import { svg, text, line, rect, esc, notesHtml, table, hatchDef, onlyKeys, isObj, type Errs } from '../svg.ts';
import { el, type Cfg, type Ctx, type Component } from '../core.ts';

type State = { label: string; main?: Record<string, number>; transition_from?: Record<string, number>; outside?: string[]; children?: number[]; returns?: number[]; table?: boolean };
export const total = (m: Record<string, number> = {}) => Object.values(m).reduce((a, b) => a + b, 0);

const W = 640, BX = 70, BW = 500;
function bar(p: any, uid: string, y: number, m: Record<string, number>, s: State, opts: { title?: string; small?: boolean } = {}): string {
  const cap = p.capacity, X = (n: number) => BX + (n / cap) * BW, h = opts.small ? 18 : 30;
  let b = '';
  if (opts.title) b += text(BX - 6, y + h / 2 + 4, opts.title, 't-small', 'end');
  b += rect(BX, y, BW, h, 'box');
  let at = 0;
  for (const k of Object.keys(p.segments)) {
    const n = m[k]; if (!n) continue;
    b += rect(X(at), y, X(at + n) - X(at), h, `seg-${k}`, `data-seg="${esc(k)}" data-n="${n}"`);
    if (k === 'R') b += rect(X(at), y, X(at + n) - X(at), h, '', `fill="url(#${uid})"`);
    if (k === 'N') b += rect(X(at), y, X(at + n) - X(at), h, '', `fill="url(#${uid}-dot)"`);
    if (X(at + n) - X(at) >= 16) b += text((X(at) + X(at + n)) / 2, y + h / 2 + 4, k, `t-small ${k === 'Σ' ? 't-onacc' : ''}`, 'middle');
    at += n;
  }
  b += line(X(p.warn_at), y - 6, X(p.warn_at), y + h + 6, 'warn') + line(X(cap), y - 8, X(cap), y + h + 8, 'limit');
  b += text(X(cap) + 6, y + h / 2 + 4, `${total(m)} / ${cap}`, 't-small t-muted');
  if (s.outside?.length) s.outside.forEach((o, i) => { const x = BX + BW - 140 - i * 150; b += rect(x, y + h + 12, 130, 24, 'box-on', 'rx="4"') + text(x + 65, y + h + 28, `窗口外：${o}`, 't-small', 'middle'); });
  if (s.children?.length) s.children.forEach((c, i) => {
    const cy = y + h + 14 + i * 26;
    b += text(BX - 6, cy + 13, `子智能体 ${i + 1}`, 't-small t-muted', 'end') + rect(BX, cy, (BW * c) / cap, 16, 'seg-A', `data-child="${c}"`);
    b += text(BX + (BW * c) / cap + 6, cy + 12, `自己的窗口约 ${c} 格 → 交回 ${s.returns?.[i] ?? '?'} 格摘要`, 't-small t-muted');
  });
  return b;
}
function frame(p: any, uid: string, s: State, m: Record<string, number>, label: string): string {
  let b = hatchDef(uid);
  b += text(BX, 18, '主上下文窗口', 't-small t-muted') + text(BX + (p.warn_at / p.capacity) * BW, 18, `接近上限（${p.warn_at}）`, 't-small t-accent', 'middle');
  b += text(BX + BW, 34, '窗口上限', 't-small t-muted', 'end');
  b += bar(p, uid, 44, m, s, { title: s.label });
  const h = s.children?.length ? 44 + 30 + 14 + s.children.length * 26 + 30 : s.outside?.length ? 130 : 100;
  b += text(BX, h - 8, `已用 ${total(m)} / ${p.capacity} 格`, 't-big');
  return svg(W, h, b, label);
}
const legend = (p: any) => `<ul class="anim-legend">${Object.entries(p.segments).map(([k, v]) => `<li><svg width="14" height="10" class="anim-svg" style="display:inline;width:14px;margin:0 4px 0 0"><rect width="14" height="10" class="seg-${esc(k)}"/></svg>${esc(k)} ${esc(v)}</li>`).join('')}</ul>`;
const chooseTable = (p: any) => table(['技术', '适合的任务'], (p.choose ?? []).map((c: any) => [c.technique, c.when]), '怎么选');

const comp: Component = {
  validate(p, steps) {
    const e: Errs = [];
    onlyKeys(p, ['capacity', 'warn_at', 'segments', 'states', 'choose', 'notes', 'fallback_steps'], 'params', e);
    if (!(p.capacity > 0) || !(p.warn_at > 0 && p.warn_at < p.capacity)) e.push('params.capacity / warn_at 必须是正数，且 warn_at < capacity');
    if (!isObj(p.segments)) e.push('params.segments 必须是 { 段代号: 含义 }');
    if (!Array.isArray(p.states) || !p.states.length) e.push('params.states 必须是非空列表');
    else p.states.forEach((s: any, i: number) => {
      onlyKeys(s, ['label', 'main', 'transition_from', 'outside', 'children', 'returns', 'table'], `params.states[${i}]`, e);
      for (const k of ['main', 'transition_from']) if (s[k] !== undefined) {
        if (!isObj(s[k])) { e.push(`params.states[${i}].${k} 必须是对象`); continue; }
        for (const [seg, n] of Object.entries(s[k])) { if (isObj(p.segments) && !(seg in p.segments)) e.push(`params.states[${i}].${k} 的段「${seg}」未在 segments 里定义`); if (typeof n !== 'number' || n < 0) e.push(`params.states[${i}].${k}.${seg} 必须是非负数`); }
        if (total(s[k]) > p.capacity) e.push(`params.states[${i}].${k} 合计 ${total(s[k])} 超过 capacity`);
      }
      if (!s.table && !s.main) e.push(`params.states[${i}] 需要 main 或 table: true`);
    });
    if (Array.isArray(p.states) && steps.length !== p.states.length) e.push(`steps（${steps.length}）与 params.states（${p.states?.length}）条数须一致`);
    if (p.fallback_steps !== undefined && (!Array.isArray(p.fallback_steps) || p.fallback_steps.some((n: number) => !p.states?.[n - 1]?.main))) e.push('params.fallback_steps 须为有 main 的步号列表（1 起）');
    steps.forEach((s, i) => { for (const k of Object.keys(s)) if (k !== 'text') e.push(`steps[${i}] 不认识的字段 ${k}`); });
    return e;
  },
  renderStatic(cfg) {
    const p = cfg.params, uid = `${cfg.id}-h`;
    const list: number[] = p.fallback_steps ?? p.states.map((_: State, i: number) => i + 1).filter((n: number) => p.states[n - 1].main);
    let b = hatchDef(uid), y = 30;
    b += text(BX, 16, '主上下文窗口（静态对照）', 't-small t-muted') + text(BX + (p.warn_at / p.capacity) * BW, 16, `接近上限（${p.warn_at}）`, 't-small t-accent', 'middle');
    for (const n of list) {
      const s: State = p.states[n - 1];
      b += bar(p, uid, y, s.main!, s, { title: `${n} ${s.label}` });
      y += 30 + 22 + (s.children?.length ? s.children.length * 26 : 0) + (s.outside?.length ? 30 : 0);
    }
    return svg(W, y, b, cfg.alt) + legend(p) + (p.choose ? chooseTable(p) : '') + notesHtml(p.notes);
  },
  mount(ctx: Ctx, cfg: Cfg) {
    const p = cfg.params, uid = `${cfg.id}-i`;
    const host = el('div'), tbl = el('div');
    ctx.stage.replaceChildren(host, tbl); ctx.stage.insertAdjacentHTML('beforeend', legend(p) + notesHtml(p.notes));
    let last = 0, timer: ReturnType<typeof setTimeout> | null = null;
    const show = (i: number) => {
      const s: State = p.states[i];
      if (timer) clearTimeout(timer); timer = null;
      tbl.innerHTML = s.table ? chooseTable(p) : '';
      host.hidden = !!s.table;
      if (s.table) return;
      // 过渡态（如压缩前先填到接近上限）：≤400ms，减少动态效果时直接显示结果
      if (s.transition_from && i === last + 1 && !ctx.reduced) {
        host.innerHTML = frame(p, uid, { ...s, label: `${s.label}（压缩前）` }, s.transition_from, cfg.alt);
        timer = setTimeout(() => { host.innerHTML = frame(p, uid, s, s.main!, cfg.alt); }, 400);
      } else host.innerHTML = frame(p, uid, s, s.main!, cfg.alt);
    };
    ctx.stepper((i) => { show(i); last = i; ctx.fig.dataset.used = String(total(p.states[i].main)); });
  },
};
export default comp;
