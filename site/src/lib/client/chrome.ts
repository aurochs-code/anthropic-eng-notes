// 页面通用交互：主题切换、侧栏抽屉、目录高亮与抽屉、代码复制、回到顶部
const root = document.documentElement;
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ── 主题：auto → light → dark → auto ── */
type Pref = 'auto' | 'light' | 'dark';
const PREF_LABEL: Record<Pref, string> = { auto: '自动', light: '浅色', dark: '深色' };
const sysDark = matchMedia('(prefers-color-scheme: dark)');
function applyTheme(pref: Pref) {
  const dark = pref === 'dark' || (pref === 'auto' && sysDark.matches);
  const theme = dark ? 'dark' : 'light';
  const changed = root.dataset.theme !== theme;
  root.dataset.themePref = pref;
  root.dataset.theme = theme;
  for (const b of document.querySelectorAll<HTMLButtonElement>('.theme-btn')) {
    b.querySelector('.theme-label')!.textContent = PREF_LABEL[pref];
    b.setAttribute('aria-label', `切换主题（当前：${pref === 'auto' ? '跟随系统' : PREF_LABEL[pref]}）`);
  }
  if (changed) document.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
}
function initTheme() {
  const cur = (): Pref => (root.dataset.themePref as Pref) || 'auto';
  applyTheme(cur());
  for (const b of document.querySelectorAll<HTMLButtonElement>('.theme-btn'))
    b.addEventListener('click', () => {
      const next: Pref = cur() === 'auto' ? 'light' : cur() === 'light' ? 'dark' : 'auto';
      try { localStorage.setItem('theme', next); } catch {}
      applyTheme(next);
    });
  sysDark.addEventListener('change', () => cur() === 'auto' && applyTheme('auto'));
}

/* ── 侧栏抽屉（< 1200px） ── */
function initSidebar() {
  const btn = document.querySelector<HTMLButtonElement>('.menu-btn');
  const side = document.getElementById('sidebar');
  const backdrop = document.querySelector<HTMLElement>('.sidebar-backdrop');
  if (!btn || !side || !backdrop) return;
  const set = (open: boolean) => {
    document.body.classList.toggle('sidebar-open', open);
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-label', open ? '关闭导航菜单' : '打开导航菜单');
    backdrop.hidden = !open;
    if (open) (side.querySelector('[aria-current="page"]') ?? side.querySelector('a'))?.focus({ preventScroll: false } as FocusOptions);
    else if (side.contains(document.activeElement)) btn.focus();
  };
  btn.addEventListener('click', () => set(!document.body.classList.contains('sidebar-open')));
  backdrop.addEventListener('click', () => set(false));
  document.addEventListener('keydown', (e) => e.key === 'Escape' && document.body.classList.contains('sidebar-open') && set(false));
  matchMedia('(min-width: 1200px)').addEventListener('change', (m) => m.matches && set(false));
  // 侧栏内当前项滚动到可见
  side.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'center' });
  window.scrollTo(0, 0);
}

/* ── 目录：滚动高亮 + 手机抽屉 ── */
function initToc() {
  const links = [...document.querySelectorAll<HTMLAnchorElement>('.toc a[href^="#"]')];
  if (!links.length) return;
  const ids = [...new Set(links.map((a) => decodeURIComponent(a.hash.slice(1))))];
  const heads = ids.map((id) => document.getElementById(id)).filter((h): h is HTMLElement => !!h);
  const side = document.querySelector<HTMLElement>('.toc-side');
  let current = '';
  const update = () => {
    const offset = 96;
    let id = heads[0]?.id ?? '';
    for (const h of heads) if (h.getBoundingClientRect().top - offset <= 0) id = h.id; else break;
    if (innerHeight + scrollY >= document.documentElement.scrollHeight - 2) id = heads[heads.length - 1]?.id ?? id;
    if (id === current) return;
    current = id;
    for (const a of links) {
      const on = decodeURIComponent(a.hash.slice(1)) === id;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
    }
    const act = side?.querySelector<HTMLElement>('a.active');
    if (side && act) {
      const r = act.getBoundingClientRect(), s = side.getBoundingClientRect();
      if (r.top < s.top || r.bottom > s.bottom) side.scrollTop += r.top - s.top - s.height / 3;
    }
  };
  let raf = 0;
  addEventListener('scroll', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(update); }, { passive: true });
  addEventListener('resize', update);
  update();

  const fab = document.querySelector<HTMLButtonElement>('.toc-fab');
  const drawer = document.querySelector<HTMLDialogElement>('#toc-drawer');
  if (fab && drawer) {
    fab.addEventListener('click', () => {
      drawer.showModal();
      drawer.querySelector<HTMLElement>('a.active')?.scrollIntoView({ block: 'center' });
    });
    drawer.querySelector('.drawer-close')?.addEventListener('click', () => drawer.close());
    drawer.addEventListener('click', (e) => {
      if (e.target === drawer || (e.target as HTMLElement).closest('a')) drawer.close();
    });
  }
  // 中屏折叠目录：点链接后收起
  for (const d of document.querySelectorAll<HTMLDetailsElement>('details.toc-inline'))
    d.addEventListener('click', (e) => (e.target as HTMLElement).closest('a') && (d.open = false));
}

/* ── 代码块复制（mermaid 源码块除外） ── */
function initCopy() {
  for (const pre of document.querySelectorAll<HTMLPreElement>('main pre:not(.mermaid)')) {
    const wrap = document.createElement('div');
    wrap.className = 'code-wrap';
    pre.replaceWith(wrap);
    wrap.append(pre);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'copy-btn';
    btn.textContent = '复制';
    btn.setAttribute('aria-label', '复制代码');
    btn.addEventListener('click', async () => {
      const text = pre.querySelector('code')?.innerText ?? pre.innerText;
      try { await navigator.clipboard.writeText(text); btn.textContent = '已复制'; } catch { btn.textContent = '复制失败'; }
      setTimeout(() => (btn.textContent = '复制'), 1500);
    });
    wrap.append(btn);
  }
}

/* ── 回到顶部 ── */
function initToTop() {
  const top = document.querySelector<HTMLButtonElement>('.to-top');
  if (!top) return;
  const onScroll = () => (top.hidden = scrollY < innerHeight);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  top.addEventListener('click', () => scrollTo({ top: 0, behavior: reduceMotion() ? 'auto' : 'smooth' }));
}

export function initChrome() {
  initTheme();
  initSidebar();
  initToc();
  initCopy();
  initToTop();
}
