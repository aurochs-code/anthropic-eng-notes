// step-player：分步播放器 + SVG 场景 + 点选。试点用于缩放点积注意力（分镜 anim/storyboards/attention-weights.md）。
import { svg, text, line, rect, circle, fx, esc, notesHtml, table, onlyKeys, isObj, type Errs } from '../svg.ts';
import { el, type Cfg, type Ctx, type Component } from '../core.ts';

const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0);
/** softmax(Q·Kᵀ / √d_k)·V（scale=false 时不除以 √d_k） */
export function attention(Q: number[][], K: number[][], V: number[][], scale = true) {
  const dk = K[0].length, sc = scale ? Math.sqrt(dk) : 1;
  const dots = Q.map((q) => K.map((k) => dot(q, k)));
  const scaled = dots.map((r) => r.map((x) => x / sc));
  const weights = scaled.map((r) => { const m = Math.max(...r); const ex = r.map((x) => Math.exp(x - m)); const s = ex.reduce((a, b) => a + b, 0); return ex.map((x) => x / s); });
  const out = weights.map((w) => V[0].map((_, j) => w.reduce((s, wi, i) => s + wi * V[i][j], 0)));
  return { dk, dots, scaled, weights, out };
}
const vec = (v: number[], d = 0) => `[${v.map((x) => fx(x, d)).join(', ')}]`;

const W = 600, H = 400;
/** step: 1–6；qi: 查询词下标 */
function scene(p: any, step: number, qi: number, scale: boolean, label: string): string {
  const { tokens, Q, K, V } = p.data;
  const a = attention(Q, K, V, scale);
  let b = '';
  // 顶部 token 卡片
  tokens.forEach((t: string, i: number) => {
    const x = 40 + i * 120;
    b += rect(x, 10, 100, 34, i === qi ? 'box-on' : 'box', `rx="6" data-token="${i}"`) + text(x + 50, 32, t, i === qi ? 't-accent' : '', 'middle');
  });
  b += text(W - 8, 22, '示意数据', 't-small t-muted', 'end');
  // 中左：q 与 k、点积、缩放
  b += text(20, 72, `查询 q（${tokens[qi]}）= ${vec(Q[qi])}`, step >= 1 ? 't-accent' : '');
  tokens.forEach((t: string, j: number) => {
    const y = 98 + j * 26;
    let s = `k（${t}）= ${vec(K[j])}`;
    if (step >= 2) s += `　q·k = ${fx(a.dots[qi][j], 0)}`;
    if (step >= 3) s += `　÷${scale ? fx(Math.sqrt(a.dk), 0) : '1'} = ${fx(a.scaled[qi][j], 1)}`;
    b += text(20, y, s, step >= 2 ? '' : 't-muted');
  });
  if (step === 1) tokens.forEach((t: string, j: number) => { b += text(20, 186 + j * 18, `v（${t}）= ${vec(V[j])}`, 't-small t-muted'); });
  // 中右：3×3 权重网格（行 = 查询，列 = 键），只用强调色深浅
  const gx = 400, gy = 70, cs = 52;
  b += text(gx + 1.5 * cs, gy - 6, step >= 4 ? (scale ? '注意力权重' : '注意力权重（不缩放）') : '权重（第 4 步起）', 't-small t-muted', 'middle');
  tokens.forEach((t: string, j: number) => { b += text(gx + j * cs + cs / 2, gy + 3 * cs + 14, t, 't-small t-muted', 'middle'); b += text(gx - 4, gy + j * cs + cs / 2 + 4, t, 't-small t-muted', 'end'); });
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    const shown = step >= 6 || (step >= 4 && i === qi);
    const w = a.weights[i][j];
    b += rect(gx + j * cs, gy + i * cs, cs - 2, cs - 2, shown ? 'cell' : 'box', shown ? `fill-opacity="${(0.12 + 0.88 * w).toFixed(3)}" data-w="${fx(w, 3)}"` : '');
    if (shown) b += text(gx + j * cs + cs / 2 - 1, gy + i * cs + cs / 2 + 4, fx(w, 3), w > 0.45 ? 't-small t-onacc' : 't-small', 'middle');
  }
  // 底部：二维坐标系里的值向量与加权和
  const ox = 60, oy = 380, s = 120; const P = (v: number[]) => [ox + v[0] * s, oy - v[1] * s] as const;
  b += line(ox, oy, ox + 1.25 * s, oy, 'axis') + line(ox, oy, ox, oy - 1.25 * s, 'axis');
  b += text(ox + 1.25 * s, oy + 14, '1.2', 't-small t-muted', 'end') + text(ox - 4, oy - 1.2 * s + 4, '1.2', 't-small t-muted', 'end');
  b += `<polygon points="${V.map((v: number[]) => P(v).join(',')).join(' ')}" class="soft"/>`;
  V.forEach((v: number[], j: number) => { const [x, y] = P(v); b += circle(x, y, 4.5, 'acc') + text(x + 8, y - 6, `v（${tokens[j]}）`, 't-small'); });
  if (step >= 5) {
    const [x, y] = P(a.out[qi]);
    b += `<line x1="${ox}" y1="${oy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" class="ref"/>` + circle(x, y, 6, 'knob');
  }
  b += text(250, 300, step >= 5 ? `○ 输出（${tokens[qi]}）= Σ 权重 × v = ${vec(a.out[qi], 3)}` : '', 't-small t-accent');
  b += text(250, 320, step >= 4 ? `权重：${a.weights[qi].map((w) => fx(w, 3)).join('、')}（和为 1，四舍五入）` : '', 't-small t-muted');
  return svg(W, H, b, label);
}

const comp: Component = {
  validate(p, steps) {
    const e: Errs = [];
    onlyKeys(p, ['data', 'query', 'scale', 'notes'], 'params', e);
    const d = p.data;
    const mat = (m: unknown, r: number) => Array.isArray(m) && m.length === r && m.every((row) => Array.isArray(row) && row.every((x) => typeof x === 'number'));
    if (!isObj(d) || !Array.isArray(d.tokens) || !d.tokens.length) e.push('params.data.tokens 必须是非空列表');
    else {
      const n = d.tokens.length;
      if (!mat(d.Q, n) || !mat(d.K, n) || !mat(d.V, n)) e.push(`params.data 的 Q、K、V 必须各有 ${n} 行数字`);
      else if (d.Q.some((r: number[]) => r.length !== d.K[0].length)) e.push('Q、K 的维度 d_k 必须一致');
    }
    if (!isObj(p.query) || !Array.isArray(p.query.options) || !p.query.options.includes(p.query.default)) e.push('params.query 须为 { options, default, selectable_from_step }');
    if (!isObj(p.scale) || typeof p.scale.default !== 'boolean') e.push('params.scale 须为 { options, default, labels, enabled_from_step, note? }');
    if (steps.length !== 6) e.push('step-player（注意力）需要 6 步');
    steps.forEach((s, i) => { for (const k of Object.keys(s)) if (k !== 'text') e.push(`steps[${i}] 不认识的字段 ${k}`); });
    return e;
  },
  renderStatic(cfg) {
    const p = cfg.params, { tokens, Q, K, V } = p.data;
    const qi = tokens.indexOf(p.query.default);
    const a = attention(Q, K, V, true);
    const rows = (m: number[][], d: number) => m.map((r, i) => [tokens[i], ...r.map((x) => fx(x, d))]);
    return scene(p, 6, qi, true, cfg.alt) + notesHtml(p.notes) +
      table(['', ...tokens], rows(a.dots, 0), '点积 Q·Kᵀ（行 = 查询，列 = 键）') +
      table(['', ...tokens], rows(a.scaled, 1), `除以 √d_k = √${a.dk} = ${fx(Math.sqrt(a.dk), 0)}`) +
      table(['', ...tokens], rows(a.weights, 3), '按行 softmax 后的注意力权重') +
      table(['', '输出（d_v = 2）'], a.out.map((o, i) => [tokens[i], vec(o, 3)]), '加权求和后的输出');
  },
  mount(ctx: Ctx, cfg: Cfg) {
    const p = cfg.params, toks: string[] = p.data.tokens;
    let step = 1, qi = toks.indexOf(p.query.default), scale = p.scale.default as boolean;
    const host = el('div'); ctx.stage.replaceChildren(host); ctx.stage.insertAdjacentHTML('beforeend', notesHtml(p.notes));
    const qg = el('div', { class: 'anim-seg', role: 'group', 'aria-label': '查询词' });
    const qb = toks.map((t, i) => { const b = el('button', { type: 'button', class: 'anim-btn', 'data-query': t }, `查询：${esc(t)}`); b.addEventListener('click', () => { qi = i; draw(); }); qg.append(b); return b; });
    const sb = el('button', { type: 'button', class: 'anim-btn', 'data-act': 'scale' });
    sb.addEventListener('click', () => { scale = !scale; draw(); });
    const hint = el('p', { class: 'anim-hint' });
    ctx.controls.append(qg, sb, hint);
    function draw() {
      const qFrom = p.query.selectable_from_step ?? 1, sFrom = p.scale.enabled_from_step ?? 1;
      if (step < qFrom) qi = toks.indexOf(p.query.default);
      if (step < sFrom) scale = p.scale.default;
      host.innerHTML = scene(p, step, qi, scale, cfg.alt);
      qb.forEach((b, i) => { b.disabled = step < qFrom; b.setAttribute('aria-pressed', String(i === qi)); });
      sb.disabled = step < sFrom;
      sb.textContent = scale ? p.scale.labels?.[0] ?? '除以 √d_k' : p.scale.labels?.[1] ?? '不缩放';
      sb.setAttribute('aria-pressed', String(!scale));
      hint.textContent = !scale && p.scale.note ? p.scale.note : '';
      hint.hidden = !hint.textContent;
      ctx.fig.dataset.query = toks[qi]; ctx.fig.dataset.scale = String(scale);
    }
    ctx.stepper((i) => { step = i + 1; draw(); });
  },
};
export default comp;
