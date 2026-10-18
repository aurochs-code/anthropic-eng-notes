// 动画组件的浏览器端公共部分：步骤导航、播报、可暂停的计时器（滚出视口 / 页面隐藏时自动暂停）、减少动态效果。
// 只在有动画的页面由 src/lib/client/anim.ts 动态加载。模块顶层不访问 DOM（构建期也会被导入）。
export type Step = { text: string; [k: string]: any };
export type Cfg = { id: string; component: string; caption: string; alt: string; params: any; steps: Step[] };
/** free(true)：读者手动调节后参数与当前步不一致——去掉步骤高亮，计数处显示「自由调节」；free(false) 恢复当前步的高亮（不重画） */
export type Stepper = { go(i: number): void; cur(): number; free(on: boolean): void };
export type Ticker = { start(): void; stop(): void; playing(): boolean };
export type Ctx = {
  fig: HTMLElement; stage: HTMLElement; controls: HTMLElement; reduced: boolean;
  announce(t: string): void;
  stepper(onChange: (i: number) => void, n?: number): Stepper;
  /** fn 返回 false 时自动停止；ms 为间隔 */
  ticker(fn: () => boolean | void, ms: number): Ticker;
  /** 播放/暂停按钮（WCAG 2.2.2：超过 5 秒的动画可暂停） */
  playButton(t: Ticker, labels?: [string, string]): HTMLButtonElement;
  /** 自动播放：减少动态效果时什么都不做 */
  autoplay(t: Ticker): void;
  /** 内容宽度 < 560px（窄屏布局：画布宽取 360、字号放大） */
  narrow(): boolean;
  /** 窄 / 宽切换时回调（ResizeObserver） */
  onNarrow(cb: (narrow: boolean) => void): void;
};
export type Component = {
  validate(params: any, steps: Step[]): string[];
  renderStatic(cfg: Cfg): string;
  mount(ctx: Ctx, cfg: Cfg): void;
};

export const el = <K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, html = ''): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (html) e.innerHTML = html;
  return e;
};

export function makeCtx(fig: HTMLElement, cfg: Cfg, reduced: boolean): Ctx {
  const stage = fig.querySelector<HTMLElement>('.anim-stage')!;
  const controls = el('div', { class: 'anim-controls' });
  stage.after(controls);
  const live = el('p', { class: 'anim-live', 'aria-live': 'polite' });
  fig.querySelector('figcaption')!.before(live);
  const list = fig.querySelector<HTMLOListElement>('ol.anim-steps');
  let visible = true;
  const tickers: { t: Ticker; want: () => boolean; resume: () => void; halt: () => void }[] = [];
  const sync = () => { for (const x of tickers) (visible && !document.hidden && x.want() ? x.resume : x.halt)(); };
  new IntersectionObserver((es) => { visible = es.some((e) => e.isIntersecting); sync(); }).observe(fig);
  document.addEventListener('visibilitychange', sync);
  const ctx: Ctx = {
    fig, stage, controls, reduced,
    announce: (t) => { live.textContent = t; },
    stepper(onChange, n = cfg.steps.length) {
      let i = 0;
      const nav = el('div', { class: 'anim-nav', role: 'group', 'aria-label': '分步' });
      const prev = el('button', { type: 'button', class: 'anim-btn', 'data-act': 'prev' }, '← 上一步');
      const pos = el('span', { class: 'anim-pos' });
      const next = el('button', { type: 'button', class: 'anim-btn', 'data-act': 'next' }, '下一步 →');
      nav.append(prev, pos, next); controls.prepend(nav);
      const items = list ? [...list.children] as HTMLElement[] : [];
      items.forEach((li, k) => { li.tabIndex = 0; li.setAttribute('role', 'button'); li.addEventListener('click', () => go(k)); li.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(k); } }); });
      let isFree = false;
      const mark = () => {
        pos.textContent = isFree ? '自由调节' : `第 ${i + 1} / ${n} 步`;
        // 自由调节时上一步 / 下一步都可用：在边界上点它就恢复成当前这一步
        prev.disabled = !isFree && i === 0; next.disabled = !isFree && i === n - 1;
        items.forEach((li, j) => (j === i && !isFree ? li.setAttribute('aria-current', 'step') : li.removeAttribute('aria-current')));
        fig.dataset.step = String(i + 1);
        if (isFree) fig.dataset.free = '1'; else delete fig.dataset.free;
      };
      function go(k: number) {
        i = Math.max(0, Math.min(n - 1, k)); isFree = false;
        mark();
        onChange(i);
        ctx.announce(`第 ${i + 1} 步：${cfg.steps[i]?.text ?? ''}`);
      }
      const free = (on: boolean) => { if (on === isFree) return; isFree = on; mark(); if (on) ctx.announce('自由调节'); };
      prev.addEventListener('click', () => go(i - 1));
      next.addEventListener('click', () => go(i + 1));
      fig.addEventListener('keydown', (e) => {
        const t = e.target as HTMLElement;
        if (t.closest('input, select, textarea')) return;
        if (e.key === 'ArrowRight') { e.preventDefault(); go(i + 1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); go(i - 1); }
      });
      go(0);
      return { go, cur: () => i, free };
    },
    ticker(fn, ms) {
      let want = false, h: ReturnType<typeof setTimeout> | null = null;
      const tick = () => { h = null; if (fn() === false) { t.stop(); return; } h = setTimeout(tick, ms); };
      const resume = () => { if (!h) h = setTimeout(tick, ms); fig.dataset.playing = '1'; };
      const halt = () => { if (h) clearTimeout(h); h = null; fig.dataset.playing = want ? 'paused' : '0'; };
      const t: Ticker = { start() { want = true; sync(); notify(); }, stop() { want = false; halt(); notify(); }, playing: () => want };
      const listeners: (() => void)[] = []; const notify = () => listeners.forEach((f) => f());
      (t as any).on = (f: () => void) => listeners.push(f);
      tickers.push({ t, want: () => want, resume, halt });
      return t;
    },
    playButton(t, labels = ['▶ 播放', '❚❚ 暂停']) {
      const b = el('button', { type: 'button', class: 'anim-btn anim-play', 'data-act': 'play', 'aria-pressed': 'false' });
      const upd = () => { b.textContent = t.playing() ? labels[1] : labels[0]; b.setAttribute('aria-pressed', String(t.playing())); };
      (t as any).on(upd); upd();
      b.addEventListener('click', () => (t.playing() ? t.stop() : t.start()));
      return b;
    },
    autoplay(t) { if (!reduced) { fig.dataset.autoplay = '1'; t.start(); } },
    narrow: () => (stage.clientWidth || fig.clientWidth) < 560,
    onNarrow(cb) {
      let last = ctx.narrow();
      new ResizeObserver(() => { const now = ctx.narrow(); if (now !== last) { last = now; cb(now); } }).observe(fig);
    },
  };
  fig.tabIndex = fig.tabIndex >= 0 ? fig.tabIndex : 0;
  return ctx;
}
