import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  homeView,
  moduleReadText,
  parseProgressJson,
  parseRoutePayload,
  routePayload,
  sideCountText,
} from './continue.ts';

const step1 = {
  n: 1,
  pid: 'r:r-hf-agents-course:0',
  title: 'Hugging Face AI 智能体课程 · Unit 0–1：入门与智能体基础',
  href: '/resources/r-hf-agents-course/',
};
const step2 = { n: 2, pid: 'n:building-effective-agents', title: '构建高效的智能体', href: '/notes/building-effective-agents/' };
const step3 = { n: 3, pid: 'n:other', title: '下一步', href: '/notes/other/' };

const payload = routePayload([step1, step2, step3], '/path/');

test('empty store is the start state', () => {
  assert.deepEqual(homeView(payload, {}), {
    href: '/resources/r-hf-agents-course/',
    label: '从第 1 步开始',
    title: null,
    barHidden: true,
    done: 0,
    total: 3,
    width: '0%',
  });
});

test('a prefix resume names the next missing step', () => {
  assert.deepEqual(homeView(payload, { 'r:r-hf-agents-course:0': 1, 'n:building-effective-agents': 1 }), {
    href: '/notes/other/',
    label: '继续阅读 · 第 3 步',
    title: '下一步',
    barHidden: false,
    done: 2,
    total: 3,
    width: '66.66666666666666%',
  });
});

test('a non-prefix store names the first missing step', () => {
  assert.deepEqual(homeView(payload, { 'n:building-effective-agents': 1 }), {
    href: '/resources/r-hf-agents-course/',
    label: '继续阅读 · 第 1 步',
    title: 'Hugging Face AI 智能体课程 · Unit 0–1：入门与智能体基础',
    barHidden: false,
    done: 1,
    total: 3,
    width: '33.33333333333333%',
  });
});

test('every mainline step done reviews the path', () => {
  assert.deepEqual(homeView(payload, {
    'r:r-hf-agents-course:0': 1,
    'n:building-effective-agents': 1,
    'n:other': 1,
  }), {
    href: '/path/',
    label: '已读完全部 3 步 · 回顾路线',
    title: null,
    barHidden: false,
    done: 3,
    total: 3,
    width: '100%',
  });
});

test('a track id does not count as mainline progress', () => {
  assert.deepEqual(homeView(payload, { 't:r-30u30:0': 1 }), {
    href: '/resources/r-hf-agents-course/',
    label: '从第 1 步开始',
    title: null,
    barHidden: true,
    done: 0,
    total: 3,
    width: '0%',
  });
});

test('routePayload rejects empty, track, gapped, and duplicate steps', () => {
  const row = (n: number, pid: string) => ({ n, pid, title: 't', href: '/x/' });
  assert.throws(() => routePayload([], '/path/'));
  assert.throws(() => routePayload([row(1, 't:r-30u30:0')], '/path/'));
  assert.throws(() => routePayload([row(1, 'n:a'), row(2, 'n:b'), row(4, 'n:c')], '/path/'));
  assert.throws(() => routePayload([row(1, 'n:a'), row(2, 'n:a')], '/path/'));
});

test('parseRoutePayload returns null for the same bad shapes and for broken JSON', () => {
  const asJson = (steps: unknown) => JSON.stringify({ reviewHref: '/path/', steps });
  const row = (n: number, pid: string) => ({ n, pid, title: 't', href: '/x/' });
  assert.equal(parseRoutePayload(asJson([])), null);
  assert.equal(parseRoutePayload(asJson([row(1, 't:r-30u30:0')])), null);
  assert.equal(parseRoutePayload(asJson([row(1, 'n:a'), row(2, 'n:b'), row(4, 'n:c')])), null);
  assert.equal(parseRoutePayload(asJson([row(1, 'n:a'), row(2, 'n:a')])), null);
  assert.equal(parseRoutePayload(null), null);
  assert.equal(parseRoutePayload(''), null);
  assert.equal(parseRoutePayload('{'), null);
  assert.equal(parseRoutePayload('[]'), null);
});

test('parseProgressJson keeps positive known and unknown ids and drops the rest', () => {
  const parsed = parseProgressJson('{"n:a":1,"nope":"x","r:b:0":0,"t:c:1":5,"__proto__":1}');
  assert.deepEqual(Object.fromEntries(Object.entries(parsed)), { 'n:a': 1, 't:c:1': 5 });
});

test('side and module counts follow the note anchors in the group', () => {
  assert.equal(sideCountText([], {}), '');
  assert.equal(sideCountText(['a', 'b'], { 'n:a': 1 }), '1/2');
  assert.equal(moduleReadText([], {}), null);
  assert.equal(moduleReadText(['a'], {}), ' · 已读 0');
  assert.equal(moduleReadText(['a'], { 'n:a': 1 }), ' · 已读 1');
});
