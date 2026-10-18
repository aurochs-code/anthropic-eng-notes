// 构建期组件表（remark 插件预渲染静态兜底用）。浏览器端按需加载的表在 src/lib/client/anim.ts，两处须一致（check 会核对）。
import type { Component } from './core.ts';
import functionPlot from './components/function-plot.ts';
import stepPlayer from './components/step-player.ts';
import tokenTimeline from './components/token-timeline.ts';
import pipelineGrid from './components/pipeline-grid.ts';
export const COMPONENTS: Record<string, Component> = {
  'function-plot': functionPlot,
  'step-player': stepPlayer,
  'token-timeline': tokenTimeline,
  'pipeline-grid': pipelineGrid,
};
