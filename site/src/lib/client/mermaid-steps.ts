// mermaid 分步高亮（```anim-steps）：在紧邻的 mermaid 图上按步点亮元素。
// 引用：时序图 = 参与者别名（顶部与底部两个框都亮）/ msg:n（第 n 条消息，源码顺序）/ block:n（第 n 个 loop/opt/alt… 块，源码开始顺序）；
// 流程图 = 节点 id。基于 mermaid 12.2 生成的 DOM（见 resolve()），主题切换重渲染后按当前步重新挂上。
import { makeCtx, el, type Cfg } from '../../anim/core.ts';
import { mermaidModel } from '../../anim/mermaid-model.mjs';

type Model = ReturnType<typeof mermaidModel>;
type StepsCfg = Cfg & { src: string; steps: { text: string; highlight: string[]; sequence?: string[]; repeat?: number; counter?: string }[] };

/** 时序图的消息分组：每个 text.messageText 开始一组，收紧随其后的消息线、序号 */
function messageGroups(svg: SVGSVGElement) {
  const groups: Element[][] = [];
  for (const c of [...svg.children]) {
    if (c.matches('text.messageText')) {
      const prev = c.previousElementSibling; // 多行消息文本：连续的 messageText 归同一条
      if (prev?.matches('text.messageText') && groups.length) groups.at(-1)!.push(c); else groups.push([c]);
    } else if (groups.length && (c.matches('.messageLine0, .messageLine1, text.sequenceNumber') || (c.tagName === 'line' && !c.getAttribute('class')))) groups.at(-1)!.push(c);
  }
  return groups;
}
export function resolve(svg: SVGSVGElement, model: Model, ref: string): Element[] {
  if (model.kind === 'sequence') {
    const m = /^(msg|block):(\d+)$/.exec(ref);
    if (m && m[1] === 'msg') return messageGroups(svg)[+m[2] - 1] ?? [];
    if (m) {
      const blocks = [...svg.children].filter((c) => c.tagName === 'g' && c.querySelector(':scope > .loopLine'));
      const pos = model.endOrder.indexOf(+m[2] - 1); // DOM 按块结束顺序排列
      return pos >= 0 && blocks[pos] ? [blocks[pos]] : [];
    }
    const i = model.participants.indexOf(ref);
    // 参与者竖线 id 为 actor{n}，n 是页面级递增计数（主题切换重渲染后会继续往上数），所以按数值排序后取第 i 个
    const lines = [...svg.querySelectorAll('line[id^="actor"]')].filter((l) => /^actor\d+$/.test(l.id)).sort((a, b) => +a.id.slice(5) - +b.id.slice(5));
    const topLine = i >= 0 ? lines[i] : undefined;
    const top = topLine?.parentElement;
    const topRect = top?.querySelector('rect.actor-top');
    if (!top || !topRect) return [];
    const x = topRect.getAttribute('x');
    const bottom = [...svg.querySelectorAll('rect.actor-bottom')].find((r) => r.getAttribute('x') === x)?.parentElement;
    return bottom ? [top, bottom] : [top];
  }
  if (model.kind === 'flowchart') {
    const re = new RegExp(`^${svg.id.replace(/[^\w-]/g, '')}-flowchart-${ref}-\\d+$`);
    return [...svg.querySelectorAll('g.node')].filter((g) => re.test(g.id));
  }
  return [];
}
const dimmables = (svg: SVGSVGElement, model: Model) =>
  model.kind === 'sequence'
    ? [...svg.children].filter((c) => !/^(defs|style)$/i.test(c.tagName))
    : [...svg.querySelectorAll('g.node, .edgePaths > *, .edgeLabels > *')];

export function initMermaidSteps(reduced: boolean) {
  for (const fig of document.querySelectorAll<HTMLElement>('figure[data-anim-steps]')) {
    const pre = fig.previousElementSibling as HTMLElement | null;
    if (!pre?.matches('pre.mermaid')) { fig.dataset.animState = 'error'; continue; }
    const cfg = JSON.parse(fig.querySelector('script.anim-cfg')!.textContent!) as StepsCfg;
    const model = mermaidModel(cfg.src);
    // 复用通用控件：figure 里没有 .anim-stage，就在列表前插一个空的
    const stage = el('div', { class: 'anim-stage anim-stage-empty' });
    fig.querySelector('figcaption')!.after(stage);
    const ctx = makeCtx(fig, cfg, reduced);
    let cur = 0, round = 1, seqAt = -1;
    const counter = el('span', { class: 'anim-counter', 'aria-live': 'polite' });
    const apply = () => {
      const svg = pre.querySelector('svg') as SVGSVGElement | null;
      if (!svg) return;
      const s = cfg.steps[cur];
      const refs = [...s.highlight, ...(s.sequence && seqAt >= 0 ? [s.sequence[seqAt]] : [])];
      const on = new Set(refs.flatMap((r) => resolve(svg, model, r)));
      svg.classList.add('ms-active');
      for (const d of dimmables(svg, model)) { d.classList.toggle('ms-on', on.has(d)); d.classList.toggle('ms-dim', !on.has(d)); }
      for (const e of on) { e.classList.add('ms-on'); e.classList.remove('ms-dim'); }
      fig.dataset.lit = String(on.size);
    };
    const seqTicker = ctx.ticker(() => {
      const s = cfg.steps[cur];
      if (!s.sequence) return false;
      seqAt++;
      if (seqAt >= s.sequence.length) {
        if (round > (s.repeat ?? 0)) { seqAt = -1; apply(); return false; } // 最多演示到第 repeat+1 轮
        round++; seqAt = 0;
      }
      counter.textContent = (s.counter ?? '第 {n} 轮').replace('{n}', String(round));
      apply();
    }, 1000);
    const play = ctx.playButton(seqTicker, ['▶ 再来一轮', '❚❚ 暂停']);
    play.hidden = true;
    ctx.controls.append(counter, play);
    const stepper = ctx.stepper((i) => {
      seqTicker.stop(); cur = i; seqAt = -1; round = 1;
      const s = cfg.steps[i];
      play.hidden = !s.sequence; counter.textContent = s.sequence ? (s.counter ?? '第 {n} 轮').replace('{n}', '1') : '';
      apply();
      if (s.sequence) ctx.autoplay(seqTicker); // 减少动态效果时不自动循环，读者点「再来一轮」
    });
    play.addEventListener('click', () => { if (!seqTicker.playing() && seqAt < 0) round = 1; }, { capture: true }); // 播完后「再来一轮」从第 1 轮重新开始
    // 主题切换后 mermaid 会重渲染：等 data-mermaid=done 再挂高亮
    new MutationObserver(() => { if (document.documentElement.dataset.mermaid === 'done') apply(); })
      .observe(document.documentElement, { attributes: true, attributeFilter: ['data-mermaid'] });
    if (document.documentElement.dataset.mermaid === 'done') apply();
    fig.dataset.animState = 'mounted';
    void stepper;
  }
}
