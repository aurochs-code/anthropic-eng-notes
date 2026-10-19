// 学习进度：localStorage['progress:v1'] = { [id]: 完成时间戳 }，id 规则见 lib/resources.ts progressId。
// 路线页勾选框、各阶段完成度、笔记页“标记为已读”、侧栏/列表里的已读标记；多标签页之间通过 storage 事件同步。
import {
  homeView,
  moduleReadText,
  parseProgressJson,
  parseRoutePayload,
  sideCountText,
  type ProgressMap,
} from './continue';

const KEY = 'progress:v1';
function read(): ProgressMap {
  try { return parseProgressJson(localStorage.getItem(KEY)); }
  catch { return Object.create(null); }
}
function write(s: ProgressMap) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}
export function setDone(id: string, done: boolean) {
  const s = read();
  if (done) s[id] = Date.now(); else delete s[id];
  write(s);
  render();
}

function render() {
  const s = read();
  for (const b of document.querySelectorAll<HTMLInputElement>('input.done-box[data-pid]')) {
    b.checked = !!s[b.dataset.pid!];
    b.closest('li')?.classList.toggle('is-done', b.checked);
  }
  // 各组完成度：组内勾选框
  for (const g of document.querySelectorAll<HTMLElement>('[data-progress-group]')) {
    const boxes = g.dataset.progressGroup === 'all'
      ? [...document.querySelectorAll<HTMLInputElement>('section[data-progress-group^="stage-"] input.done-box')]
      : [...g.querySelectorAll<HTMLInputElement>('input.done-box')];
    const total = Number(g.dataset.progressTotal) || boxes.length;
    const done = boxes.filter((b) => b.checked).length;
    for (const el of g.querySelectorAll(':scope > .progress-head .progress-done, :scope > .stage-progress .progress-done')) el.textContent = String(done);
    for (const bar of g.querySelectorAll<HTMLElement>(':scope > .progress-head + .progress-bar, :scope > .stage-progress .progress-bar')) {
      bar.setAttribute('aria-valuenow', String(done));
      bar.querySelector('span')!.style.width = `${total ? (done / total) * 100 : 0}%`;
    }
    g.classList.toggle('is-complete', total > 0 && done === total);
    g.dataset.progressDone = String(done);
  }
  const reset = document.querySelector<HTMLButtonElement>('.progress-reset');
  if (reset) reset.hidden = Object.keys(s).length === 0;
  // 笔记页按钮
  for (const btn of document.querySelectorAll<HTMLButtonElement>('.mark-read[data-pid]')) {
    const on = !!s[btn.dataset.pid!];
    btn.setAttribute('aria-pressed', String(on));
    btn.querySelector('.mark-label')!.textContent = on ? '已读 ✓（点击取消）' : '标记为已读';
  }
  // 侧栏 / 列表里的笔记链接
  for (const a of document.querySelectorAll<HTMLElement>('[data-note-link]')) a.toggleAttribute('data-read', !!s[`n:${a.dataset.noteLink}`]);
  paintContinue(s);
  paintModuleReads(s);
  paintSideCounts(s);
}

function noteSlugs(root: ParentNode | null): string[] {
  if (!root) return [];
  const slugs: string[] = [];
  for (const el of root.querySelectorAll<HTMLElement>('[data-note-link]')) {
    const slug = el.getAttribute('data-note-link');
    if (slug) slugs.push(slug);
  }
  return slugs;
}

function paintContinue(s: ProgressMap) {
  const btn = document.querySelector<HTMLAnchorElement>('a[data-continue]');
  const host = document.getElementById('route-seq');
  if (!btn || !host) return;
  const payload = parseRoutePayload(host.textContent);
  if (!payload) return;
  const view = homeView(payload, s);
  btn.href = view.href;
  const label = btn.querySelector('.home-continue-label');
  if (label) label.textContent = view.label;
  const title = btn.querySelector<HTMLElement>('.home-continue-title');
  if (title) {
    title.hidden = view.title === null;
    title.textContent = view.title ?? '';
  }
  const root = document.querySelector<HTMLElement>('[data-progress-home]');
  if (!root) return;
  root.hidden = view.barHidden;
  const doneEl = root.querySelector('[data-progress-home-done]');
  const totalEl = root.querySelector('[data-progress-home-total]');
  if (doneEl) doneEl.textContent = String(view.done);
  if (totalEl) totalEl.textContent = String(view.total);
  const bar = root.querySelector<HTMLElement>('.home-progress-bar');
  if (!bar) return;
  bar.setAttribute('aria-valuemax', String(view.total));
  bar.setAttribute('aria-valuenow', String(view.done));
  const fill = bar.querySelector('span');
  if (fill) fill.style.width = view.width;
}

function paintModuleReads(s: ProgressMap) {
  for (const slot of document.querySelectorAll<HTMLElement>('[data-module-done]')) {
    const text = moduleReadText(noteSlugs(slot.closest('section')), s);
    slot.hidden = text === null;
    slot.textContent = text ?? '';
  }
}

function paintSideCounts(s: ProgressMap) {
  for (const slot of document.querySelectorAll<HTMLElement>('[data-side-count]')) {
    slot.textContent = sideCountText(noteSlugs(slot.closest('details')), s);
  }
}

export function initProgress() {
  document.addEventListener('change', (e) => {
    const b = e.target as HTMLInputElement;
    if (b.matches?.('input.done-box[data-pid]')) setDone(b.dataset.pid!, b.checked);
  });
  for (const btn of document.querySelectorAll<HTMLButtonElement>('.mark-read[data-pid]'))
    btn.addEventListener('click', () => setDone(btn.dataset.pid!, btn.getAttribute('aria-pressed') !== 'true'));
  document.querySelector('.progress-reset')?.addEventListener('click', () => {
    if (confirm('清除本机保存的全部学习进度？')) { write({}); render(); }
  });
  addEventListener('storage', (e) => e.key === KEY && render());
  render();

  // 阅读进度条（笔记 / 资源页）：按正文 article 的滚动位置
  const bar = document.querySelector<HTMLElement>('.read-progress');
  const art = document.querySelector<HTMLElement>('main article');
  if (bar && art) {
    const upd = () => {
      const r = art.getBoundingClientRect();
      const span = r.height - innerHeight;
      const p = span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 1;
      bar.style.transform = `scaleX(${p})`;
      bar.setAttribute('aria-valuenow', String(Math.round(p * 100)));
    };
    let raf = 0;
    addEventListener('scroll', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(upd); }, { passive: true });
    addEventListener('resize', upd);
    upd();
  }
}
