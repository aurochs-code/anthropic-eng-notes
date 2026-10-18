// pipeline-grid：网格 / 甘特时间轴 + 滑块 + 公式联动。试点用于 GPipe 气泡（分镜 anim/storyboards/gpipe-bubble.md）。
// 理想化排程（分镜自拟）：F(k,m) 在第 k+m 格；B(k,m) 在第 (M+K−1)+(K−1−k)+(M−1−m) 格（倒序，待核实）；最后一列同步更新。
import { svg, text, line, rect, fx, esc, notesHtml, table, hatchDef, range, onlyKeys, isObj, type Errs } from '../svg.ts';
import { el, type Cfg, type Ctx, type Component } from '../core.ts';

/** 空等占比 (K−1)/(M+K−1)、理想加速比 K·M/(M+K−1)、总时间 2(M+K−1) 格 */
export function bubble(K: number, M: number) {
  return { total: 2 * (M + K - 1), idle: (K - 1) / (M + K - 1), speedup: (K * M) / (M + K - 1) };
}
export function schedule(K: number, M: number) {
  const cols = 2 * (M + K - 1);
  const grid: ({ m: number; dir: 'F' | 'B' } | null)[][] = Array.from({ length: K }, () => Array(cols).fill(null));
  for (let k = 0; k < K; k++) for (let m = 0; m < M; m++) {
    grid[k][k + m] = { m, dir: 'F' };
    grid[k][M + K - 1 + (K - 1 - k) + (M - 1 - m)] = { m, dir: 'B' };
  }
  return { cols, grid };
}
const presetM = (v: number | string, K: number) => (v === 'K' ? K : v === '4K' ? 4 * K : +v);
const pct = (x: number) => `${fx(x * 100, 1)}%`;
const SHADES = [1, 0.72, 0.5, 0.34];

function grid(K: number, M: number, uid: string, label: string, opts: { upTo?: number; syncOn?: boolean; title?: string } = {}): string {
  const { cols, grid: g } = schedule(K, M);
  const W = 640, LX = 64, top = opts.title ? 28 : 16, cw = Math.min(28, (W - LX - 44) / cols), ch = 22;
  let b = hatchDef(uid);
  if (opts.title) b += text(4, 16, opts.title, 't-small t-accent');
  for (let k = 0; k < K; k++) {
    const y = top + k * (ch + 4);
    b += text(LX - 6, y + 15, `设备 ${k + 1}`, 't-small t-muted', 'end');
    for (let t = 0; t < cols; t++) {
      const c = g[k][t], x = LX + t * cw, dim = opts.upTo !== undefined && t > opts.upTo ? ' dim' : '';
      if (!c) { b += rect(x + 1, y, cw - 2, ch, `bubble${dim}`); continue; }
      b += rect(x + 1, y, cw - 2, ch, `cell${dim}`, `fill-opacity="${SHADES[c.m % SHADES.length]}" data-cell="${c.dir}${c.m + 1}"`);
      if (c.dir === 'B') b += rect(x + 1, y, cw - 2, ch, dim.trim(), `fill="url(#${uid})"`);
      if (cw >= 14) b += text(x + cw / 2, y + 15, c.m + 1, `t-small t-onacc${dim}`, 'middle');
    }
  }
  const sx = LX + cols * cw + 6, gh = K * (ch + 4) - 4;
  b += rect(sx, top, 14, gh, opts.syncOn ? 'acc' : 'box', 'data-sync="1"') + text(sx + 7, top + gh + 14, '同步更新', 't-small t-muted', 'middle');
  // 底部汇总：每个时间格的空等设备数
  const yb = top + gh + 30;
  b += text(LX - 6, yb, '空等', 't-small t-muted', 'end');
  if (cw >= 10) for (let t = 0; t < cols; t++) { const n = g.filter((r) => !r[t]).length; if (n) b += text(LX + t * cw + cw / 2, yb, n, 't-small t-muted', 'middle'); }
  b += line(LX, top + gh + 18, LX + cols * cw, top + gh + 18, 'grid') + text(LX + cols * cw, yb + 16, '时间 →', 't-small t-muted', 'end');
  if (opts.upTo !== undefined) b += line(LX + (opts.upTo + 1) * cw, top - 4, LX + (opts.upTo + 1) * cw, top + gh + 4, 'pointer');
  return svg(W, yb + 22, b, label);
}
const legend = `<ul class="anim-legend"><li><i style="background:var(--accent);border-color:var(--accent)"></i>前向（颜色按微批次）</li><li><i style="background:repeating-linear-gradient(45deg,var(--accent) 0 3px,var(--bg) 3px 5px)"></i>反向</li><li><i style="border-style:dashed"></i>气泡（空等）</li></ul>`;

const comp: Component = {
  validate(p, steps) {
    const e: Errs = [];
    onlyKeys(p, ['K', 'M', 'presets', 'schedule', 'readouts', 'notes', 'fallback', 'reference'], 'params', e);
    range(p.K, 'K', e); range(p.M, 'M', e);
    if (!Array.isArray(p.presets) || p.presets.some((x: any) => !isObj(x) || typeof x.label !== 'string' || !(typeof x.M === 'number' || x.M === 'K' || x.M === '4K'))) e.push('params.presets 每项须为 { label, M: 数字 | "K" | "4K" }');
    if (p.schedule !== undefined) onlyKeys(p.schedule, ['forward', 'backward', 'final_column'], 'params.schedule', e);
    if (!Array.isArray(p.readouts) || p.readouts.length !== 3) e.push('params.readouts 须为 3 项（总时间、空等占比、理想加速比）');
    if (p.fallback !== undefined && (!Array.isArray(p.fallback) || p.fallback.some((f: any) => !isObj(f) || !(f.K >= 1) || !(f.M >= 1)))) e.push('params.fallback 每项须为 { K, M }');
    if (p.reference !== undefined && (!isObj(p.reference) || !Array.isArray(p.reference.M))) e.push('params.reference 须为 { K, M: [..] }');
    steps.forEach((s, i) => { for (const k of Object.keys(s)) if (k !== 'text') e.push(`steps[${i}] 不认识的字段 ${k}`); });
    return e;
  },
  renderStatic(cfg) {
    const p = cfg.params, fb: { K: number; M: number }[] = p.fallback ?? [{ K: p.K.default, M: p.M.default }];
    const ref = p.reference ? table(['M', '空等占比', '理想加速比'], p.reference.M.map((m: number) => { const r = bubble(p.reference.K, m); return [m, pct(r.idle), fx(r.speedup, 2)]; }), `参考值（K = ${p.reference.K}）`) : '';
    return fb.map((f, i) => grid(f.K, f.M, `${cfg.id}-s${i}`, `${cfg.alt}（K = ${f.K}，M = ${f.M}）`, { title: `K = ${f.K}，M = ${f.M}：空等 ${pct(bubble(f.K, f.M).idle)}` })).join('') + legend + ref + notesHtml(p.notes);
  },
  mount(ctx: Ctx, cfg: Cfg) {
    const p = cfg.params, st = { K: p.K.default as number, M: p.M.default as number, upTo: undefined as number | undefined, sync: false };
    const host = el('div'); ctx.stage.replaceChildren(host); ctx.stage.insertAdjacentHTML('beforeend', legend + notesHtml(p.notes));
    const mk = (spec: any, key: 'K' | 'M') => {
      const wrap = el('label', { class: 'anim-range' });
      const inp = el('input', { type: 'range', min: String(spec.min), max: String(spec.max), step: String(spec.step), 'data-param': key });
      const out = el('output'); wrap.append(document.createTextNode(spec.label), inp, out);
      inp.addEventListener('input', () => { st[key] = +inp.value; changed(); });
      return { inp, out, wrap };
    };
    const kS = mk(p.K, 'K'), mS = mk(p.M, 'M');
    const pre = el('div', { class: 'anim-seg', role: 'group', 'aria-label': '预设' });
    const pb = (p.presets as any[]).map((x) => { const b = el('button', { type: 'button', class: 'anim-btn', 'data-preset': String(x.M) }, esc(x.label)); b.addEventListener('click', () => { st.M = Math.min(p.M.max, presetM(x.M, st.K)); changed(); }); pre.append(b); return b; });
    const readout = el('div', { class: 'anim-readout', 'aria-live': 'polite' });
    // 时间扫描：每格 200ms；M、K 大时超过 5 秒，可暂停，滚出视口自动暂停
    const sweep = ctx.ticker(() => { const cols = 2 * (st.M + st.K - 1); st.upTo = (st.upTo ?? -1) + 1; if (st.upTo >= cols) { st.upTo = undefined; draw(); return false; } draw(); }, 200);
    const play = ctx.playButton(sweep, ['▶ 播放时间推进', '❚❚ 暂停']);
    play.addEventListener('click', () => { if (!sweep.playing() && st.upTo === undefined) st.upTo = -1; }, { capture: true });
    ctx.controls.append(kS.wrap, mS.wrap, pre, play, readout);
    function draw() {
      st.M = Math.min(st.M, p.M.max);
      host.innerHTML = grid(st.K, st.M, `${cfg.id}-i`, cfg.alt, { upTo: st.upTo, syncOn: st.sync });
      const r = bubble(st.K, st.M), ro = p.readouts;
      readout.innerHTML = `<span>${esc(ro[0].label)}：<b data-v="total">${r.total}</b> 格</span><span>${esc(ro[1].label)}：<b data-v="idle">${pct(r.idle)}</b></span><span>${esc(ro[2].label)}：<b data-v="speedup">${fx(r.speedup, 2)}</b>${ro[2].note ? `（${esc(ro[2].note)}）` : ''}</span>`;
      kS.inp.value = String(st.K); mS.inp.value = String(st.M); kS.out.textContent = String(st.K); mS.out.textContent = String(st.M);
      pb.forEach((b) => b.setAttribute('aria-pressed', String(presetM(b.dataset.preset!, st.K) === st.M)));
      ctx.fig.dataset.k = String(st.K); ctx.fig.dataset.m = String(st.M);
    }
    // 读者改参数后播放一遍扫描（减少动态效果时不播放）；载入时不自动播放
    function changed() { sweep.stop(); st.upTo = undefined; draw(); st.upTo = -1; ctx.autoplay(sweep); if (!sweep.playing()) st.upTo = undefined; }
    ctx.stepper((i) => {
      sweep.stop(); st.upTo = undefined; st.sync = i === 3;
      const x = p.presets[i]; if (x) st.M = Math.min(p.M.max, presetM(x.M, st.K));
      draw();
    });
  },
};
export default comp;
