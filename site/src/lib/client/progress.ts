// 学习进度：localStorage['progress:v1'] = { [id]: 完成时间戳 }，id 规则见 lib/resources.ts progressId。
// 路线页勾选框、各阶段完成度、笔记页“标记为已读”、侧栏/列表里的已读标记；多标签页之间通过 storage 事件同步。
const KEY = 'progress:v1';
type Store = Record<string, number>;
function read(): Store {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; }
}
function write(s: Store) {
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
