// 站内搜索弹窗：Pagefind JS API（/pagefind/pagefind.js）+ 自绘结果。
// 中文查询按字检索再做子串过滤（见 src/lib/search-query.mjs），标题命中优先；英文走 Pagefind 原生排序。
import { parseQuery, cleanText, hasAll } from '../search-query.mjs';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
type Sub = { title: string; url: string; excerpt: string };
type Data = { url: string; content: string; excerpt: string; meta: { title?: string }; sub_results?: Sub[] };
type Hit = { url: string; title: string; excerpt: string; subs: { title: string; url: string; excerpt: string }[] };

let pf: any = null;
async function load() {
  if (!pf) {
    pf = await import(/* @vite-ignore */ `${BASE}/pagefind/pagefind.js`);
    await pf.options({ baseUrl: `${BASE}/`, excerptLength: 24 });
    await pf.init();
  }
  return pf;
}
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const stripTags = (s: string) => s.replace(/<[^>]+>/g, '');
/** 在纯文本里高亮所有词（中文词 + 英文词），返回 HTML */
function mark(text: string, words: string[]) {
  const ws = words.filter(Boolean).sort((a, b) => b.length - a.length);
  if (!ws.length) return esc(text);
  const re = new RegExp(ws.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'gi');
  let out = '', last = 0;
  for (const m of text.matchAll(re)) { out += esc(text.slice(last, m.index)) + `<mark>${esc(m[0])}</mark>`; last = m.index! + m[0].length; }
  return out + esc(text.slice(last));
}
/** 以第一个中文词出现处为中心截取摘要 */
function snippet(content: string, token: string, len = 70) {
  const i = content.indexOf(token);
  if (i < 0) return content.slice(0, len);
  const start = Math.max(0, i - Math.floor((len - token.length) / 2));
  return (start > 0 ? '…' : '') + content.slice(start, start + len).trim() + (start + len < content.length ? '…' : '');
}

async function search(raw: string): Promise<Hit[]> {
  const api = await load();
  const { query, tokens } = parseQuery(raw);
  const latin = raw.replace(/[\u3400-\u9fff\uf900-\ufaff]+/g, ' ').split(/\s+/).filter((w) => w.length > 1);
  const res = await api.search(query);
  const datas: Data[] = await Promise.all(res.results.slice(0, tokens.length ? 60 : 20).map((r: any) => r.data()));
  const hits: (Hit & { boost: number })[] = [];
  for (const d of datas) {
    const content = cleanText(d.content);
    if (tokens.length && !hasAll(content, tokens)) continue;
    const title = cleanText(d.meta?.title ?? d.url);
    const words = [...tokens, ...latin];
    const excerpt = tokens.length ? mark(snippet(content, tokens[0]), words) : cleanText(d.excerpt);
    const subs = (d.sub_results ?? [])
      .filter((s) => s.url !== d.url)
      .map((s) => ({ title: cleanText(s.title), url: s.url, text: cleanText(stripTags(s.excerpt)) }))
      .filter((s) => !tokens.length || hasAll(s.title + s.text, tokens.slice(0, 1)))
      .slice(0, 3)
      .map((s) => ({ title: s.title, url: s.url, excerpt: mark(s.text, words) }));
    const boost = tokens.length ? (hasAll(title, tokens) ? 2 : 0) : latin.some((w) => title.toLowerCase().includes(w.toLowerCase())) ? 1 : 0;
    hits.push({ url: d.url, title, excerpt, subs, boost });
  }
  // 标题命中的排前面，其余保持 Pagefind 的相关度顺序（sort 稳定）
  return hits.sort((a, b) => b.boost - a.boost).slice(0, 20);
}

export function initSearch() {
  const dlg = document.querySelector<HTMLDialogElement>('#search-dialog');
  if (!dlg) return;
  const input = dlg.querySelector<HTMLInputElement>('.search-input')!;
  const summary = dlg.querySelector<HTMLElement>('.search-summary')!;
  const list = dlg.querySelector<HTMLOListElement>('.search-results')!;
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
  for (const k of document.querySelectorAll('.search-btn kbd')) k.textContent = isMac ? '⌘K' : 'Ctrl K';
  let opener: HTMLElement | null = null;
  const open = (from?: HTMLElement | null) => {
    if (dlg.open) return;
    opener = from ?? (document.activeElement as HTMLElement);
    dlg.showModal();
    input.focus();
    input.select();
    load().catch(() => (summary.textContent = '搜索索引加载失败（本地开发需先 npm run build）'));
  };
  dlg.addEventListener('close', () => opener?.focus());
  for (const b of document.querySelectorAll<HTMLButtonElement>('.search-btn')) b.addEventListener('click', () => open(b));
  dlg.querySelector('.search-close')?.addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  document.addEventListener('keydown', (e) => {
    if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); open(); }
    else if (e.key === '/' && !dlg.open && !(e.target as HTMLElement).closest('input, textarea, [contenteditable]')) { e.preventDefault(); open(); }
  });

  let seq = 0, timer = 0;
  const run = async () => {
    const raw = input.value.trim();
    const my = ++seq;
    if (!raw) { list.replaceChildren(); summary.textContent = ''; dlg.dataset.state = 'idle'; return; }
    summary.textContent = '搜索中…';
    dlg.dataset.state = 'loading';
    try {
      const hits = await search(raw);
      if (my !== seq) return;
      list.innerHTML = hits.map((h) => `<li><a class="sr-main" href="${esc(h.url)}"><span class="sr-title">${esc(h.title)}</span><span class="sr-excerpt">${h.excerpt}</span></a>${
        h.subs.length ? `<ul class="sr-subs">${h.subs.map((s) => `<li><a href="${esc(s.url)}"><span class="sr-title"># ${esc(s.title)}</span><span class="sr-excerpt">${s.excerpt}</span></a></li>`).join('')}</ul>` : ''}</li>`).join('');
      summary.textContent = hits.length ? `「${raw}」找到 ${hits.length} 个页面` : `没有找到「${raw}」相关的内容`;
      dlg.dataset.state = 'done';
    } catch {
      if (my === seq) { summary.textContent = '搜索索引加载失败（本地开发需先 npm run build）'; dlg.dataset.state = 'error'; }
    }
  };
  input.addEventListener('input', () => { clearTimeout(timer); timer = window.setTimeout(run, 150); });
  // 键盘：↑/↓ 在输入框与结果之间移动，Enter 打开
  dlg.addEventListener('keydown', (e) => {
    const links = [...list.querySelectorAll<HTMLAnchorElement>('a')];
    const i = links.indexOf(document.activeElement as HTMLAnchorElement);
    if (e.key === 'ArrowDown' && links.length) { e.preventDefault(); links[Math.min(i + 1, links.length - 1)].focus(); }
    else if (e.key === 'ArrowUp' && links.length) { e.preventDefault(); if (i <= 0) input.focus(); else links[i - 1].focus(); }
    else if (e.key === 'Enter' && document.activeElement === input && links[0]) { e.preventDefault(); links[0].click(); }
    // type=search 的输入框里第一次按 Esc 只会清空内容；这里直接关闭弹窗
    else if (e.key === 'Escape') { e.preventDefault(); dlg.close(); }
  });
  list.addEventListener('click', (e) => { if ((e.target as HTMLElement).closest('a')) dlg.close(); });
}
