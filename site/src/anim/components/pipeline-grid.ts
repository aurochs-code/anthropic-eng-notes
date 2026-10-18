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

// 甘特网格放在可横向滚动的容器里，按实际像素绘制（不随容器缩放，字号恒定）：格子最小 16×22px，
// 左侧「设备 k」标签列 sticky 固定；内容超宽时（容器查询，JS 关闭也有效）显示「← 左右滑动 →」。
const LW = 76, CH = 22;
export const cellW = (cols: number, avail: number, max = 28) => Math.max(16, Math.min(max, Math.floor(avail / cols)));
function grid(K: number, M: number, uid: string, label: string, opts: { upTo?: number; syncOn?: boolean; title?: string; avail?: number; maxCell?: number } = {}): string {
  const { cols, grid: g } = schedule(K, M);
  // 画布宽 = 格子 + 22（同步列：间隔 6 + 宽 14 + 余量 2），与计算格宽时扣掉的 LW + 22 一致
  const cw = cellW(cols, (opts.avail ?? 640) - LW - 22, opts.maxCell), top = 8;
  const gh = K * (CH + 4) - 4, yb = top + gh + 30, H = yb + 22, GW = cols * cw + 22;
  const showNum = M <= 8 && cw >= 14;
  let b = hatchDef(uid), lb = '';
  for (let k = 0; k < K; k++) {
    const y = top + k * (CH + 4);
    lb += text(LW - 8, y + 15, `设备 ${k + 1}`, 't-small t-muted', 'end');
    for (let t = 0; t < cols; t++) {
      const c = g[k][t], x = t * cw, dim = opts.upTo !== undefined && t > opts.upTo ? ' dim' : '';
      if (!c) { b += rect(x + 1, y, cw - 2, CH, `bubble${dim}`); continue; }
      const shade = c.m % SHADES.length;
      b += rect(x + 1, y, cw - 2, CH, `cell${dim}`, `fill-opacity="${SHADES[shade]}" data-cell="${c.dir}${c.m + 1}"`);
      if (c.dir === 'B') b += rect(x + 1, y, cw - 2, CH, dim.trim(), `fill="url(#${uid})"`);
      // M > 8 时不写数字；透明度 0.5、0.34 两档浅色格上数字用正文色
      if (showNum) b += text(x + cw / 2, y + 15, c.m + 1, `t-small ${shade >= 2 ? '' : 't-onacc'}${dim}`, 'middle');
    }
  }
  const sx = cols * cw + 6;
  b += rect(sx, top, 14, gh, opts.syncOn ? 'acc' : 'box', 'data-sync="1"');
  lb += text(LW - 8, yb, '空等设备数', 't-small t-muted', 'end');
  for (let t = 0; t < cols; t++) { const n = g.filter((r) => !r[t]).length; if (n) b += text(t * cw + cw / 2, yb, n, 't-small t-muted', 'middle'); }
  b += line(0, top + gh + 18, cols * cw, top + gh + 18, 'grid') + text(0, yb + 16, '时间 →', 't-small t-muted', 'start') + text(sx + 14, yb + 16, '同步更新', 't-small t-muted', 'end');
  if (opts.upTo !== undefined) b += line((opts.upTo + 1) * cw, top - 4, (opts.upTo + 1) * cw, top + gh + 4, 'pointer');
  const W = GW;
  return `<div class="pg-wrap" id="${uid}-w">${opts.title ? `<p class="pg-title">${esc(opts.title)}</p>` : ''}<div class="pg-scroll" tabindex="0" aria-label="${esc(label)}（可左右滚动）"><div class="pg-inner">` +
    `<svg class="anim-svg pg-svg pg-labels" width="${LW}" height="${H}" viewBox="0 0 ${LW} ${H}" aria-hidden="true">${lb}</svg>` +
    `<svg class="anim-svg pg-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}" data-cw="${cw}">${b}</svg>` +
    `</div></div><p class="pg-hint">← 左右滑动 →</p><style>@container pgw (max-width: ${LW + W + 1}px) { #${uid}-w .pg-hint { display: block; } }</style></div>`;
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
    return fb.map((f, i) => grid(f.K, f.M, `${cfg.id}-s${i}`, `${cfg.alt}（K = ${f.K}，M = ${f.M}）`, { title: `K = ${f.K}，M = ${f.M}：空等 ${pct(bubble(f.K, f.M).idle)}`, maxCell: 24 })).join('') + legend + ref + notesHtml(p.notes);
  },
  mount(ctx: Ctx, cfg: Cfg) {
    const p = cfg.params, K0 = p.K.default as number;
    const st = { K: K0, M: p.M.default as number, upTo: undefined as number | undefined, sync: false };
    // 内容宽度 < 560px：K 上限 4、M 上限 16
    const maxK = () => (ctx.narrow() ? Math.min(4, p.K.max) : p.K.max), maxM = () => (ctx.narrow() ? Math.min(16, p.M.max) : p.M.max);
    const host = el('div'); ctx.stage.replaceChildren(host); ctx.stage.insertAdjacentHTML('beforeend', legend + notesHtml(p.notes));
    const mk = (spec: any, key: 'K' | 'M') => {
      const wrap = el('label', { class: 'anim-range' });
      const inp = el('input', { type: 'range', min: String(spec.min), max: String(spec.max), step: String(spec.step), 'data-param': key });
      const out = el('output'); wrap.append(document.createTextNode(spec.label), inp, out);
      inp.addEventListener('input', () => { st[key] = +inp.value; manual(); });
      return { inp, out, wrap };
    };
    const kS = mk(p.K, 'K'), mS = mk(p.M, 'M');
    const pre = el('div', { class: 'anim-seg', role: 'group', 'aria-label': '预设' });
    // 第 i 个预设 = 第 i 步（1–3 步：M = 1、M = K、M = 4K）
    const pb = (p.presets as any[]).map((x, i) => { const b = el('button', { type: 'button', class: 'anim-btn', 'data-preset': String(x.M) }, esc(x.label)); b.addEventListener('click', () => {
      // K 是默认值：跳到对应的步；否则只按当前 K 设 M，进入自由调节
      if (st.K === K0) { stepper.go(i); runSweep(); return; }
      st.M = Math.min(maxM(), presetM(x.M, st.K)); manual();
    }); pre.append(b); return b; });
    const readout = el('div', { class: 'anim-readout', 'aria-live': 'polite' });
    // 时间扫描：每格 200ms；M、K 大时超过 5 秒，可暂停，滚出视口自动暂停；指针自动滚进可视区
    const sweep = ctx.ticker(() => { const cols = 2 * (st.M + st.K - 1); st.upTo = (st.upTo ?? -1) + 1; if (st.upTo >= cols) { st.upTo = undefined; draw(); return false; } draw(); follow(); }, 200);
    const play = ctx.playButton(sweep, ['▶ 播放时间推进', '❚❚ 暂停']);
    play.addEventListener('click', () => { if (!sweep.playing() && st.upTo === undefined) st.upTo = -1; }, { capture: true });
    ctx.controls.append(kS.wrap, mS.wrap, pre, play, readout);
    const scroller = () => host.querySelector<HTMLElement>('.pg-scroll');
    function follow() {
      const sc = scroller(), svgEl = host.querySelector<SVGElement>('svg[data-cw]'); if (!sc || !svgEl || st.upTo === undefined) return;
      const x = LW + (st.upTo + 1) * +svgEl.dataset.cw!;
      if (x < sc.scrollLeft + LW + 20 || x > sc.scrollLeft + sc.clientWidth - 20) sc.scrollLeft = Math.max(0, x - sc.clientWidth / 2);
    }
    function draw() {
      kS.inp.max = String(maxK()); mS.inp.max = String(maxM());
      st.K = Math.min(st.K, maxK()); st.M = Math.min(st.M, maxM());
      const keep = scroller()?.scrollLeft ?? 0;
      host.innerHTML = grid(st.K, st.M, `${cfg.id}-i`, cfg.alt, { upTo: st.upTo, syncOn: st.sync, avail: host.clientWidth || 640 });
      const sc = scroller(); if (sc) sc.scrollLeft = keep;
      const r = bubble(st.K, st.M), ro = p.readouts;
      readout.innerHTML = `<span>${esc(ro[0].label)}：<b data-v="total">${r.total}</b> 格</span><span>${esc(ro[1].label)}：<b data-v="idle">${pct(r.idle)}</b></span><span>${esc(ro[2].label)}：<b data-v="speedup">${fx(r.speedup, 2)}</b>${ro[2].note ? `（${esc(ro[2].note)}）` : ''}</span>`;
      kS.inp.value = String(st.K); mS.inp.value = String(st.M); kS.out.textContent = String(st.K); mS.out.textContent = String(st.M);
      pb.forEach((b) => b.setAttribute('aria-pressed', String(presetM(b.dataset.preset!, st.K) === st.M)));
      ctx.fig.dataset.k = String(st.K); ctx.fig.dataset.m = String(st.M);
    }
    // 每一步的状态：K = 默认值，M = 该步预设（第 4 步沿用 M = 4K，并点亮同步更新列）
    const stepState = (i: number) => { const x = p.presets[Math.min(i, p.presets.length - 1)]; return { K: K0, M: Math.min(maxM(), presetM(x.M, K0)) }; };
    function runSweep() { sweep.stop(); st.upTo = -1; ctx.autoplay(sweep); if (!sweep.playing()) { st.upTo = undefined; draw(); } }
    // 拖滑块：与当前步状态不一致就「自由调节」；读者改参数后播放一遍扫描（减少动态效果时不播放）
    function manual() { const s = stepState(stepper.cur()); sweep.stop(); st.upTo = undefined; draw(); stepper.free(st.K !== s.K || st.M !== s.M); runSweep(); }
    ctx.onNarrow(() => draw());
    const stepper = ctx.stepper((i) => {
      sweep.stop(); st.upTo = undefined; st.sync = i === 3;
      Object.assign(st, stepState(i));
      draw();
    });
  },
};
export default comp;
