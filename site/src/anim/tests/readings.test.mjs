// 分镜给出的读数快照（anim/storyboards/*.md）。运行：npm run test:anim
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clipObjective } from '../components/function-plot.ts';
import { attention } from '../components/step-player.ts';
import { bubble, schedule } from '../components/pipeline-grid.ts';
import { total } from '../components/token-timeline.ts';

const f2 = (x) => x.toFixed(2), f3 = (x) => x.toFixed(3);

test('PPO 截断目标读数（ε = 0.2）', () => {
  const cases = [
    [1, 1, '1.00', '1.00', '1.00'], [1.5, 1, '1.50', '1.20', '1.20'], [0.5, 1, '0.50', '0.80', '0.50'],
    [0.5, -1, '-0.50', '-0.80', '-0.80'], [1.5, -1, '-1.50', '-1.20', '-1.50'],
  ];
  for (const [r, A, un, cl, min] of cases) {
    const o = clipObjective(r, 0.2, A);
    assert.deepEqual([f2(o.un), f2(o.cl), f2(o.min)], [un, cl, min], `r=${r} A=${A}`);
  }
});

const D = { Q: [[1, 0, 1, 0], [1, 1, 0, 1], [0, 1, 0, 0]], K: [[2, 0, 1, 0], [0, 1, 0, 0], [0, 2, 0, 1]], V: [[1, 0], [0, 1], [1, 1]] };
test('注意力读数（缩放）', () => {
  const a = attention(D.Q, D.K, D.V, true);
  assert.deepEqual(a.dots, [[3, 0, 0], [2, 1, 3], [0, 1, 2]]);
  assert.deepEqual(a.scaled, [[1.5, 0, 0], [1, 0.5, 1.5], [0, 0.5, 1]]);
  assert.deepEqual(a.weights.map((r) => r.map(f3)), [['0.691', '0.154', '0.154'], ['0.307', '0.186', '0.506'], ['0.186', '0.307', '0.506']]);
  assert.deepEqual(a.out.map((r) => r.map(f3)), [['0.846', '0.309'], ['0.814', '0.693'], ['0.693', '0.814']]);
});
test('注意力读数（不缩放对比）', () => {
  const a = attention(D.Q, D.K, D.V, false);
  assert.deepEqual(a.weights.map((r) => r.map(f3)), [['0.909', '0.045', '0.045'], ['0.245', '0.090', '0.665'], ['0.090', '0.245', '0.665']]);
});

test('GPipe 参考值（K = 4）', () => {
  const exp = { 1: ['75.0', '1.00'], 4: ['42.9', '2.29'], 8: ['27.3', '2.91'], 16: ['15.8', '3.37'], 32: ['8.6', '3.66'] };
  for (const [M, [idle, sp]] of Object.entries(exp)) {
    const b = bubble(4, +M);
    assert.deepEqual([(b.idle * 100).toFixed(1), f2(b.speedup)], [idle, sp], `M=${M}`);
    assert.equal(b.total, 2 * (+M + 3));
  }
});
test('GPipe 排程：每格至多一个任务，每设备 M 次前向 + M 次反向，空格数与占比一致', () => {
  for (const [K, M] of [[4, 1], [4, 4], [4, 16], [1, 3], [8, 32]]) {
    const { cols, grid } = schedule(K, M);
    const busy = grid.flat().filter(Boolean).length;
    assert.equal(busy, 2 * K * M);
    assert.ok(Math.abs((K * cols - busy) / (K * cols) - bubble(K, M).idle) < 1e-12);
  }
});

test('上下文窗口各步合计', () => {
  const st = [{ S: 10 }, { S: 10, U: 4, A: 8, R: 30 }, { S: 10, U: 8, A: 16, R: 62 }, { S: 10, U: 8, A: 16, R: 10, P: 4 }, { S: 10, Σ: 8, F: 15 }, { S: 10, N: 5 }, { S: 10, A: 5, C: 4 }];
  assert.deepEqual(st.map(total), [10, 52, 96, 48, 33, 15, 19]);
  assert.equal(total({ S: 10, U: 8, A: 16, R: 56, P: 4 }), 94);
});

test('上下文窗口校验：sum(returns) 须等于 main.C', async () => {
  const comp = (await import('../components/token-timeline.ts')).default;
  const base = { capacity: 100, warn_at: 90, segments: { S: 's', A: 'a', C: 'c' } };
  const ok = comp.validate({ ...base, states: [{ label: 'x', main: { S: 10, A: 5, C: 4 }, children: [40, 40], returns: [2, 2] }] }, [{ text: 't' }]);
  assert.deepEqual(ok, []);
  const bad = comp.validate({ ...base, states: [{ label: 'x', main: { S: 10, A: 5, C: 3 }, children: [40, 40], returns: [2, 2] }] }, [{ text: 't' }]);
  assert.ok(bad.some((m) => m.includes('sum(returns)')));
});
