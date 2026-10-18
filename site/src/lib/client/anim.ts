// 动画加载器：只在有 figure.anim / [data-anim-steps] 的页面由 Base.astro 动态导入。
// 每个组件单独成块，按页面实际用到的组件加载。
import { makeCtx, type Cfg, type Component } from '../../anim/core.ts';

/** 浏览器端组件表（与 src/anim/static.ts、rules.mjs 的 COMPONENT_NAMES 一致） */
export const REGISTRY: Record<string, () => Promise<{ default: Component }>> = {
  'function-plot': () => import('../../anim/components/function-plot.ts'),
  'step-player': () => import('../../anim/components/step-player.ts'),
  'token-timeline': () => import('../../anim/components/token-timeline.ts'),
  'pipeline-grid': () => import('../../anim/components/pipeline-grid.ts'),
};

export async function initAnim() {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const figs = [...document.querySelectorAll<HTMLElement>('figure.anim[data-anim]')];
  await Promise.all(figs.map(async (fig) => {
    try {
      const cfg = JSON.parse(fig.querySelector('script.anim-cfg')!.textContent!) as Cfg;
      const load = REGISTRY[cfg.component];
      if (!load) { fig.dataset.animState = 'unknown'; return; }
      const comp = (await load()).default;
      comp.mount(makeCtx(fig, cfg, reduced), cfg);
      fig.dataset.animState = 'mounted';
    } catch (e) { fig.dataset.animState = 'error'; console.error('[anim]', e); }
  }));
  if (document.querySelector('[data-anim-steps]')) (await import('./mermaid-steps')).initMermaidSteps(reduced);
  document.documentElement.dataset.anim = 'ready';
}
