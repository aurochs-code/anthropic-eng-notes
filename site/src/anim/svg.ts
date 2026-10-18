// 生成 SVG 字符串的小工具（构建期预渲染与浏览器端重绘共用；不碰 DOM）
export const esc = (s: unknown): string =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
const n = (x: number) => String(Math.round(x * 10) / 10);
export const fx = (x: number, d: number): string => { const s = x.toFixed(d); return /^-0\.?0*$/.test(s) ? s.slice(1) : s; };
export const svg = (w: number, h: number, body: string, label: string, cls = ''): string =>
  `<svg class="anim-svg ${cls}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}" preserveAspectRatio="xMidYMid meet">${body}</svg>`;
export const text = (x: number, y: number, s: unknown, cls = '', anchor = 'start'): string =>
  `<text x="${n(x)}" y="${n(y)}" class="${cls}" text-anchor="${anchor}">${esc(s)}</text>`;
export const line = (x1: number, y1: number, x2: number, y2: number, cls = ''): string =>
  `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" class="${cls}"/>`;
export const rect = (x: number, y: number, w: number, h: number, cls = '', extra = ''): string =>
  `<rect x="${n(x)}" y="${n(y)}" width="${n(Math.max(0, w))}" height="${n(Math.max(0, h))}" class="${cls}" ${extra}/>`;
export const poly = (pts: [number, number][], cls = ''): string =>
  `<polyline points="${pts.map(([x, y]) => `${n(x)},${n(y)}`).join(' ')}" class="${cls}"/>`;
export const circle = (x: number, y: number, r: number, cls = ''): string => `<circle cx="${n(x)}" cy="${n(y)}" r="${r}" class="${cls}"/>`;
/** 斜线花纹（颜色走 CSS 变量，见 .anim-hatch） */
export const hatchDef = (id: string): string =>
  `<defs><pattern id="${id}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" class="anim-hatch"/></pattern><pattern id="${id}-dot" width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="2.5" cy="2.5" r="1.1" class="anim-dot"/></pattern></defs>`;
export const notesHtml = (notes: unknown): string =>
  Array.isArray(notes) && notes.length ? `<ul class="anim-notes">${notes.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
export const table = (head: string[], rows: (string | number)[][], cap = ''): string =>
  `<div class="anim-table scroll-x"><table>${cap ? `<caption>${esc(cap)}</caption>` : ''}<thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;

// ── 组件 params 校验小工具：返回错误列表 ──
export type Errs = string[];
const isObj = (v: unknown): v is Record<string, any> => v !== null && typeof v === 'object' && !Array.isArray(v);
export function range(p: any, name: string, e: Errs, extraKeys: string[] = []): void {
  if (!isObj(p)) { e.push(`params.${name} 必须是对象 { min, max, step, default, label }`); return; }
  for (const k of Object.keys(p)) if (!['min', 'max', 'step', 'default', 'label', ...extraKeys].includes(k)) e.push(`params.${name} 不认识的字段 ${k}`);
  for (const k of ['min', 'max', 'step', 'default']) if (typeof p[k] !== 'number') e.push(`params.${name}.${k} 必须是数字`);
  if (typeof p.label !== 'string') e.push(`params.${name}.label 必须是字符串`);
  if (p.min > p.max || p.default < p.min || p.default > p.max || !(p.step > 0)) e.push(`params.${name} 的 min/max/step/default 不一致`);
}
export function strList(v: unknown, name: string, e: Errs, optional = true): void {
  if (v === undefined && optional) return;
  if (!Array.isArray(v) || !v.every((x) => typeof x === 'string' && x.trim())) e.push(`params.${name} 必须是字符串列表`);
}
export function onlyKeys(o: any, keys: string[], name: string, e: Errs): void {
  if (!isObj(o)) { e.push(`${name} 必须是对象`); return; }
  for (const k of Object.keys(o)) if (!keys.includes(k)) e.push(`${name} 不认识的字段 ${k}（允许：${keys.join('、')}）`);
}
export { isObj };
