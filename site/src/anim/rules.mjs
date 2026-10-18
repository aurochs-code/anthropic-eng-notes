// ```anim / ```anim-steps 代码块的字段规则（严格校验）。构建（remark 插件）、check-site.mjs、仓库外审计脚本共用。
// 组件自己的 params 校验在各组件模块里（构建时随预渲染一起执行）。
import yaml from 'js-yaml';
import { mermaidModel, checkRef } from './mermaid-model.mjs';

export const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** 已注册组件名（与 src/anim/registry 两处保持一致；检查脚本会核对） */
export const COMPONENT_NAMES = ['function-plot', 'step-player', 'token-timeline', 'pipeline-grid'];
export const ANIM_KEYS = ['id', 'component', 'caption', 'alt', 'params', 'steps'];
export const STEPS_KEYS = ['id', 'caption', 'alt', 'steps'];
export const STEP_ITEM_KEYS = ['text', 'highlight', 'sequence', 'repeat', 'counter'];

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const str = (v) => typeof v === 'string' && v.trim().length > 0;
/** 在块正文里找某个键所在的行（相对块正文第 1 行，0 起） */
export function keyLine(body, key) {
  const i = String(body).split('\n').findIndex((l) => new RegExp(`^\\s*-?\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:`).test(l));
  return i < 0 ? 0 : i;
}
export function parseBlock(body) {
  try { return { data: yaml.load(body) }; }
  catch (e) { return { error: `YAML 解析失败：${e.reason ?? e.message.split('\n')[0]}`, line: e.mark ? e.mark.line : 0 }; }
}
/** ```anim：返回 [{ key, msg }] */
export function validateAnim(d, components = COMPONENT_NAMES) {
  const e = []; const add = (key, msg) => e.push({ key, msg });
  if (!isObj(d)) return [{ key: '', msg: '正文必须是 YAML 对象' }];
  for (const k of Object.keys(d)) if (!ANIM_KEYS.includes(k)) add(k, `不认识的字段 ${k}（允许：${ANIM_KEYS.join('、')}）`);
  if (!str(d.id)) add('id', '缺少 id'); else if (!ID_RE.test(d.id)) add('id', `id「${d.id}」须为 kebab-case（小写字母、数字、短横线）`);
  if (!str(d.component)) add('component', '缺少 component'); else if (!components.includes(d.component)) add('component', `组件「${d.component}」未注册（可用：${components.join('、')}）`);
  if (!str(d.caption)) add('caption', '缺少 caption');
  if (!str(d.alt)) add('alt', '缺少 alt');
  if (d.params !== undefined && !isObj(d.params)) add('params', 'params 必须是对象');
  if (d.steps !== undefined) {
    if (!Array.isArray(d.steps) || !d.steps.length) add('steps', 'steps 必须是非空列表');
    else d.steps.forEach((s, i) => { if (!isObj(s) || !str(s.text)) add('steps', `steps[${i}] 必须是对象且有 text`); });
  }
  return e;
}
/** ```anim-steps：prev = 紧邻的上一个 mermaid 源码（没有则为 null） */
export function validateAnimSteps(d, prev) {
  const e = []; const add = (key, msg) => e.push({ key, msg });
  if (prev == null) add('', '```anim-steps 必须紧跟在一个 ```mermaid 代码块后面');
  if (!isObj(d)) return [...e, { key: '', msg: '正文必须是 YAML 对象' }];
  for (const k of Object.keys(d)) if (!STEPS_KEYS.includes(k)) add(k, `不认识的字段 ${k}（允许：${STEPS_KEYS.join('、')}）`);
  if (!str(d.id)) add('id', '缺少 id'); else if (!ID_RE.test(d.id)) add('id', `id「${d.id}」须为 kebab-case`);
  if (!str(d.caption)) add('caption', '缺少 caption');
  if (d.alt !== undefined && !str(d.alt)) add('alt', 'alt 若写须为非空字符串');
  const model = prev == null ? null : mermaidModel(prev);
  if (!Array.isArray(d.steps) || !d.steps.length) add('steps', '缺少 steps（非空列表）');
  else d.steps.forEach((s, i) => {
    const at = `steps[${i}]`;
    if (!isObj(s)) return add('steps', `${at} 必须是对象`);
    for (const k of Object.keys(s)) if (!STEP_ITEM_KEYS.includes(k)) add('steps', `${at} 不认识的字段 ${k}（允许：${STEP_ITEM_KEYS.join('、')}）`);
    if (!str(s.text)) add('steps', `${at} 缺少 text`);
    if (!Array.isArray(s.highlight) || !s.highlight.length || !s.highlight.every(str)) add('steps', `${at} highlight 必须是非空字符串列表`);
    const refs = [...(Array.isArray(s.highlight) ? s.highlight : []), ...(Array.isArray(s.sequence) ? s.sequence : [])];
    if (model) for (const r of refs) { const m = checkRef(model, String(r)); if (m) add('steps', `${at} ${m}`); }
    if (s.sequence !== undefined || s.repeat !== undefined || s.counter !== undefined) {
      if (!Array.isArray(s.sequence) || !s.sequence.length) add('steps', `${at} 写了 repeat/counter 就必须写 sequence（依次点亮的引用列表）`);
      if (!(Number.isInteger(s.repeat) && s.repeat >= 1 && s.repeat <= 3)) add('steps', `${at} repeat 须为 1–3 的整数（额外循环次数）`);
      if (s.counter !== undefined && !(str(s.counter) && s.counter.includes('{n}'))) add('steps', `${at} counter 须包含 {n}`);
    }
  });
  return e;
}

/** 从 Markdown 源码里找出所有 anim / anim-steps 块（跳过其它围栏代码），带行号（1 起，相对传入文本） */
export function findBlocks(md) {
  const lines = String(md).split('\n'); const out = []; let lastMermaid = null; let lastEnd = -2;
  for (let i = 0; i < lines.length; i++) {
    const m = /^(\s*)(`{3,}|~{3,})\s*([\w-]*)\s*$/.exec(lines[i]);
    if (!m) { if (lines[i].trim()) lastMermaid = null; continue; }
    const fence = m[2], lang = m[3]; let j = i + 1;
    while (j < lines.length && !new RegExp(`^\\s*${fence[0]}{${fence.length},}\\s*$`).test(lines[j])) j++;
    const body = lines.slice(i + 1, j).join('\n');
    // “紧跟”：mermaid 块与 anim-steps 之间只允许空行
    const between = lines.slice(lastEnd + 1, i).every((l) => !l.trim());
    if (lang === 'anim' || lang === 'anim-steps') out.push({ lang, line: i + 1, body, prevMermaid: lang === 'anim-steps' && lastMermaid !== null && between ? lastMermaid : null });
    lastMermaid = lang === 'mermaid' ? body : null; lastEnd = j;
    i = j;
  }
  return out;
}
export const ANIM_READING_MINUTES = 0.5;
