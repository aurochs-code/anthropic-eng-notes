// mermaid：首渲染、主题切换后重渲染、点击放大查看
import mermaid from 'mermaid';
const root = document.documentElement;
const blocks = [...document.querySelectorAll<HTMLPreElement>('pre.mermaid')];
for (const b of blocks) b.dataset.src = b.textContent ?? '';

let running: Promise<void> = Promise.resolve();
function render() {
  running = running.then(async () => {
    root.dataset.mermaid = 'pending';
    const theme = root.dataset.theme === 'dark' ? 'dark' : 'default';
    for (const b of blocks) {
      b.removeAttribute('data-processed');
      b.textContent = b.dataset.src ?? '';
    }
    mermaid.initialize({ startOnLoad: false, theme, securityLevel: 'strict' });
    await mermaid.run({ nodes: blocks });
    root.dataset.mermaidTheme = theme;
    root.dataset.mermaid = 'done';
  });
  return running;
}

/* ── 放大查看：<dialog> 内克隆 svg，按钮 / Ctrl+滚轮缩放，容器可双向滚动 ── */
let dlg: HTMLDialogElement | null = null;
let scale = 1, natural = 0, current: SVGSVGElement | null = null;
function buildDialog() {
  dlg = document.createElement('dialog');
  dlg.className = 'zoom-dialog';
  dlg.setAttribute('aria-label', '放大查看图表');
  dlg.innerHTML = `<div class="zoom-bar" role="toolbar" aria-label="缩放">
      <button type="button" data-z="out" aria-label="缩小">−</button>
      <output class="zoom-level" aria-live="polite">100%</output>
      <button type="button" data-z="in" aria-label="放大">＋</button>
      <button type="button" data-z="fit">适应宽度</button>
      <button type="button" data-z="close" class="zoom-close" aria-label="关闭">✕</button>
    </div><div class="zoom-stage" tabindex="0"></div>`;
  document.body.append(dlg);
  dlg.addEventListener('click', (e) => {
    const z = (e.target as HTMLElement).closest<HTMLElement>('[data-z]')?.dataset.z;
    if (z === 'close' || e.target === dlg) dlg!.close();
    else if (z === 'in') setScale(scale * 1.25);
    else if (z === 'out') setScale(scale / 1.25);
    else if (z === 'fit') fit();
  });
  dlg.querySelector('.zoom-stage')!.addEventListener('wheel', (e) => {
    const we = e as WheelEvent;
    if (!we.ctrlKey && !we.metaKey) return;
    we.preventDefault();
    setScale(scale * (we.deltaY < 0 ? 1.1 : 1 / 1.1));
  }, { passive: false });
  dlg.addEventListener('keydown', (e) => {
    if (e.key === '+' || e.key === '=') setScale(scale * 1.25);
    else if (e.key === '-') setScale(scale / 1.25);
    else if (e.key === '0') fit();
  });
  dlg.addEventListener('close', () => { dlg!.querySelector('.zoom-stage')!.replaceChildren(); current = null; });
}
function setScale(s: number) {
  if (!current || !dlg) return;
  scale = Math.min(6, Math.max(0.2, s));
  current.style.width = `${Math.round(natural * scale)}px`;
  current.style.maxWidth = 'none';
  current.style.height = 'auto';
  dlg.querySelector('.zoom-level')!.textContent = `${Math.round(scale * 100)}%`;
}
function fit() {
  if (!dlg) return;
  const stage = dlg.querySelector<HTMLElement>('.zoom-stage')!;
  setScale((stage.clientWidth - 32) / natural);
}
function open(pre: HTMLPreElement) {
  const svg = pre.querySelector('svg');
  if (!svg) return;
  if (!dlg) buildDialog();
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.removeAttribute('height');
  const vb = svg.viewBox.baseVal;
  natural = vb && vb.width ? vb.width : svg.getBoundingClientRect().width;
  current = clone;
  dlg!.querySelector('.zoom-stage')!.replaceChildren(clone);
  dlg!.showModal();
  fit();
  if (scale < 1 && natural < 900) setScale(1); // 小图不缩小
}

export async function initMermaid() {
  for (const b of blocks) {
    b.tabIndex = 0;
    b.setAttribute('role', 'button');
    b.setAttribute('aria-label', '图表：点击放大查看');
    b.title = '点击放大查看';
    b.addEventListener('click', () => open(b));
    b.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), open(b)));
  }
  document.addEventListener('themechange', () => render());
  await render();
}
