// function-plot：函数曲线 + 滑块。试点用于 PPO 截断目标（分镜 anim/storyboards/ppo-clip.md）：
// 未截断项 r·Â（虚线）、截断项 clip(r,1−ε,1+ε)·Â（点线）、最终目标 min(…)（粗实线），平台区铺底，可拖动 r 点。
import { svg, text, line, rect, poly, circle, fx, esc, notesHtml, range, strList, onlyKeys, isObj, type Errs } from '../svg.ts';
import { el, type Cfg, type Ctx, type Component, type Step } from '../core.ts';

/** 单个样本的 PPO 目标（论文公式 (7) 去掉期望） */
export function clipObjective(r: number, eps: number, A: number) {
  const c = Math.min(1 + eps, Math.max(1 - eps, r));
  const un = r * A, cl = c * A;
  return { un, cl, min: Math.min(un, cl) };
}

// 宽屏画布 560；内容宽度 < 560px 时画布取 360 重画（字号见 .anim-svg.narrow），保证 390px 下字不小于 11px
const geo = (narrow: boolean) => ({ W: narrow ? 360 : 560, H: narrow ? 280 : 300, L: narrow ? 34 : 52, R: 14, T: 18, B: 40 });
function plot(eps: number, A: number, r: number | null, label: string, lbl: Labels, narrow = false): string {
  const { W, H, L, R, T, B } = geo(narrow);
  const X = (r: number) => L + (r / 2) * (W - L - R);
  const [y0, y1] = A > 0 ? [-0.2, 2.2] : [-2.2, 0.2];
  const Y = (v: number) => T + ((y1 - v) / (y1 - y0)) * (H - T - B);
  const xs = Array.from({ length: 81 }, (_, i) => i / 40);
  const pts = (f: (r: number) => number) => xs.map((x) => [X(x), Y(f(x))] as [number, number]);
  const lo = 1 - eps, hi = 1 + eps;
  const [p0, p1] = A > 0 ? [hi, 2] : [0, lo]; // 平台区
  let b = rect(X(p0), T, X(p1) - X(p0), H - T - B, 'soft');
  // 平台区窄于约 150 画布单位时（窄屏或 ε 较大）改用短标签
  b += text((X(p0) + X(p1)) / 2, T + 14, narrow || X(p1) - X(p0) < 150 ? lbl.plateauShort : lbl.plateau, 't-small t-accent', 'middle');
  for (let v = Math.ceil(y0); v <= Math.floor(y1); v++) { b += line(L, Y(v), W - R, Y(v), 'grid'); b += text(L - 6, Y(v) + 4, v, 't-small t-muted', 'end'); }
  b += line(L, Y(0), W - R, Y(0), 'axis');
  for (const x of [0, 0.5, 1, 1.5, 2]) b += text(X(x), H - B + 16, x, 't-small t-muted', 'middle');
  b += line(L, T, L, H - B, 'axis');
  b += line(X(1), T, X(1), H - B, 'ref-faint') + line(X(lo), T, X(lo), H - B, 'ref') + line(X(hi), T, X(hi), H - B, 'ref');
  // 三条参考线的标签在所有线之后再画，带底色描边（t-halo），不被虚线穿过；「旧策略（r = 1）」在 r = 1 线顶端、图内离上边约 4px，窄屏用短标签
  const refLabels = text(X(1), T + 4 + 10, narrow ? lbl.oldShort : lbl.old, 't-small t-muted t-halo', 'middle') +
    text(X(lo) - 3, T + 30, '1−ε', 't-small t-muted t-halo', 'end') + text(X(hi) + 3, T + 30, '1+ε', 't-small t-muted t-halo', 'start');
  b += poly(pts((x) => clipObjective(x, eps, A).un), 'l-un');
  b += poly(pts((x) => clipObjective(x, eps, A).cl), 'l-clip');
  b += poly(pts((x) => clipObjective(x, eps, A).min), 'l-main');
  b += text(W - R, H - 4, lbl.xAxis, 't-small t-muted', 'end');
  b += text(L + 4, T - 4, `${A > 0 ? '好动作 Â = +1' : '坏动作 Â = −1'} · ε = ${fx(eps, 2)}`, 't-small t-muted');
  b += refLabels;
  if (r !== null) b += circle(X(r), Y(clipObjective(r, eps, A).min), 7, 'knob');
  return svg(W, H, b, label, narrow ? 'narrow' : '');
}
type Labels = { plateau: string; plateauShort: string; old: string; oldShort: string; xAxis: string };
const LBL: Labels = { plateau: '这里梯度为 0：不再推动 r', plateauShort: '梯度为 0', old: '旧策略（r = 1）', oldShort: 'r = 1', xAxis: '概率比 r' };
const legend = `<ul class="anim-legend"><li><i style="border-style:dashed"></i>未截断项 r·Â</li><li><i style="border-style:dotted"></i>截断项 clip(r, 1−ε, 1+ε)·Â</li><li><i style="background:var(--accent);border-color:var(--accent)"></i>最终目标 min(…)</li><li><i style="background:var(--accent-soft)"></i>平台区</li></ul>`;

const comp: Component = {
  validate(p, steps) {
    const e: Errs = [];
    onlyKeys(p, ['epsilon', 'advantage', 'r', 'notes', 'paper_note'], 'params', e);
    range(p.epsilon, 'epsilon', e, ['note']);
    range(p.r, 'r', e, ['draggable']);
    const a = p.advantage;
    if (!isObj(a) || JSON.stringify(a.options) !== '[1,-1]' || ![1, -1].includes(a.default) || !Array.isArray(a.labels) || a.labels.length !== 2) e.push('params.advantage 须为 { options: [1, -1], default: 1|-1, labels: [两项] }');
    strList(p.notes, 'notes', e);
    if (p.paper_note !== undefined && (!isObj(p.paper_note) || !Array.isArray(p.paper_note.at) || typeof p.paper_note.text !== 'string')) e.push('params.paper_note 须为 { at: [ε 值], text }');
    steps.forEach((s: Step, i) => {
      for (const k of Object.keys(s)) if (!['text', 'state'].includes(k)) e.push(`steps[${i}] 不认识的字段 ${k}`);
      if (s.state !== undefined && (!isObj(s.state) || Object.keys(s.state).some((k) => !['r', 'advantage', 'epsilon'].includes(k)))) e.push(`steps[${i}].state 只能含 r、advantage、epsilon`);
    });
    return e;
  },
  renderStatic(cfg) {
    const p = cfg.params, eps = p.epsilon.default;
    return `<div class="anim-static-scroll"><div class="anim-stack">${plot(eps, 1, null, `${cfg.alt}（上图：优势为正）`, LBL)}${plot(eps, -1, null, `${cfg.alt}（下图：优势为负）`, LBL)}</div></div>${legend}${notesHtml(p.notes)}`;
  },
  mount(ctx: Ctx, cfg: Cfg) {
    const p = cfg.params;
    const st = { eps: p.epsilon.default as number, A: p.advantage.default as number, r: p.r.default as number };
    const host = el('div');
    ctx.stage.replaceChildren(host);
    ctx.stage.insertAdjacentHTML('beforeend', legend + notesHtml(p.notes));
    const seg = el('div', { class: 'anim-seg', role: 'group', 'aria-label': '优势的符号' });
    const advBtns = (p.advantage.options as number[]).map((v, i) => {
      const b = el('button', { type: 'button', class: 'anim-btn', 'data-adv': String(v) }, esc(p.advantage.labels[i]));
      b.addEventListener('click', () => { st.A = v; manual(); }); seg.append(b); return b;
    });
    const mk = (spec: any, key: 'eps' | 'r') => {
      const wrap = el('label', { class: 'anim-range' });
      const inp = el('input', { type: 'range', min: String(spec.min), max: String(spec.max), step: String(spec.step), 'data-param': key });
      const out = el('output');
      wrap.append(document.createTextNode(spec.label), inp, out);
      inp.addEventListener('input', () => { st[key] = +inp.value; manual(); });
      return { wrap, inp, out };
    };
    const eS = mk(p.epsilon, 'eps'), rS = mk(p.r, 'r');
    const readout = el('div', { class: 'anim-readout', 'aria-live': 'polite' });
    const paper = el('p', { class: 'anim-hint' });
    ctx.controls.append(seg, eS.wrap, rS.wrap, readout, paper);
    function draw() {
      host.innerHTML = plot(st.eps, st.A, st.r, cfg.alt, LBL, ctx.narrow());
      const o = clipObjective(st.r, st.eps, st.A);
      readout.innerHTML = `<span>r = <b data-v="r">${fx(st.r, 2)}</b></span><span>r·Â = <b data-v="un">${fx(o.un, 2)}</b></span><span>clip·Â = <b data-v="cl">${fx(o.cl, 2)}</b></span><span>min = <b data-v="min">${fx(o.min, 2)}</b></span>`;
      eS.inp.value = String(st.eps); rS.inp.value = String(st.r);
      eS.out.textContent = fx(st.eps, 2) + (Math.abs(st.eps - 0.2) < 1e-9 && p.epsilon.note ? `（${p.epsilon.note}）` : '');
      rS.out.textContent = fx(st.r, 2);
      advBtns.forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.adv! === st.A)));
      const show = p.paper_note && (p.paper_note.at as number[]).some((v) => Math.abs(v - st.eps) < 1e-9);
      paper.textContent = show ? p.paper_note.text : ''; paper.hidden = !show;
      ctx.fig.dataset.r = fx(st.r, 2);
    }
    // 在图上拖动 r 点（指针或触屏）
    const toR = (ev: PointerEvent) => {
      const s = host.querySelector('svg')!; const b = s.getBoundingClientRect();
      const { W, L, R } = geo(ctx.narrow());
      const x = ((ev.clientX - b.left) / b.width) * W;
      return Math.round(Math.min(2, Math.max(0, ((x - L) / (W - L - R)) * 2)) / p.r.step) * p.r.step;
    };
    let drag = false;
    host.addEventListener('pointerdown', (ev) => { drag = true; host.setPointerCapture(ev.pointerId); st.r = toR(ev); manual(); });
    host.addEventListener('pointermove', (ev) => { if (drag) { st.r = toR(ev); manual(); } });
    host.addEventListener('pointerup', () => { drag = false; });
    host.style.touchAction = 'pan-y';
    // 手动调节（滑块、拖动、优势按钮）后与当前步的状态比对：不一致就进入「自由调节」
    let stepper: ReturnType<Ctx['stepper']> | null = null;
    const same = (a: number, b: number | undefined) => b === undefined || Math.abs(a - b) < 1e-9;
    function manual() {
      draw();
      if (!stepper) return;
      const s = cfg.steps[stepper.cur()].state ?? {};
      stepper.free(!(same(st.r, s.r) && same(st.A, s.advantage) && same(st.eps, s.epsilon)));
    }
    ctx.onNarrow(draw);
    if (cfg.steps.length) stepper = ctx.stepper((i) => { const s = cfg.steps[i].state ?? {}; if (s.r !== undefined) st.r = s.r; if (s.advantage !== undefined) st.A = s.advantage; if (s.epsilon !== undefined) st.eps = s.epsilon; draw(); });
    else draw();
  },
};
export default comp;
