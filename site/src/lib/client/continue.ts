declare const mainlinePid: unique symbol;
export type MainlinePid = string & { readonly [mainlinePid]: 'mainline' };

export type MainlineInput = {
  readonly n: number;
  readonly pid: string;
  readonly title: string;
  readonly href: string;
};

export type RouteStep = {
  readonly n: number;
  readonly pid: MainlinePid;
  readonly title: string;
  readonly href: string;
};

export type RoutePayload = {
  readonly reviewHref: string;
  readonly steps: readonly RouteStep[];
};

export type ProgressMap = Record<string, number>;

type ContinueReading =
  | { readonly kind: 'start'; readonly href: string; readonly done: 0; readonly total: number }
  | { readonly kind: 'resume'; readonly href: string; readonly n: number; readonly title: string; readonly done: number; readonly total: number }
  | { readonly kind: 'done'; readonly href: string; readonly done: number; readonly total: number };

export type HomeView = {
  readonly href: string;
  readonly label: string;
  readonly title: string | null;
  readonly barHidden: boolean;
  readonly done: number;
  readonly total: number;
  readonly width: string;
};

export const START_LABEL = '从第 1 步开始';

const PID_RE = /^(?:n:[a-z0-9-]+|r:[a-z0-9-]+:[0-9]+)$/;
const DROPPED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function plainHref(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && !/\s/.test(value);
}

function brandPid(pid: string): MainlinePid {
  return pid as MainlinePid;
}

function assertPayload(value: unknown): RoutePayload {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('bad payload');
  const body = value as Record<string, unknown>;
  if (!plainHref(body.reviewHref)) throw new Error('bad reviewHref');
  if (!Array.isArray(body.steps) || body.steps.length === 0) throw new Error('bad steps');
  const seen = new Set<string>();
  const steps: RouteStep[] = [];
  for (let i = 0; i < body.steps.length; i++) {
    const raw = body.steps[i];
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('bad step');
    const step = raw as Record<string, unknown>;
    if (step.n !== i + 1) throw new Error('bad n');
    if (typeof step.pid !== 'string' || !PID_RE.test(step.pid)) throw new Error('bad pid');
    if (seen.has(step.pid)) throw new Error('duplicate pid');
    seen.add(step.pid);
    if (typeof step.title !== 'string' || step.title.trim() === '') throw new Error('bad title');
    if (!plainHref(step.href)) throw new Error('bad href');
    steps.push({ n: i + 1, pid: brandPid(step.pid), title: step.title, href: step.href });
  }
  return { reviewHref: body.reviewHref, steps };
}

export function routePayload(steps: readonly MainlineInput[], reviewHref: string): RoutePayload {
  return assertPayload({ reviewHref, steps });
}

export function routePayloadJson(payload: RoutePayload): string {
  return JSON.stringify(payload).replace(/</g, '\\u003c');
}

export function parseRoutePayload(raw: string | null | undefined): RoutePayload | null {
  try {
    if (raw == null) return null;
    return assertPayload(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function parseProgressJson(raw: string | null): ProgressMap {
  const out: ProgressMap = Object.create(null);
  if (raw == null || raw === '') return out;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return out;
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return out;
  for (const key of Object.keys(parsed)) {
    if (DROPPED_KEYS.has(key)) continue;
    const value = (parsed as Record<string, unknown>)[key];
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) out[key] = value;
  }
  return out;
}

function isDone(done: ProgressMap, id: string): boolean {
  return typeof done[id] === 'number' && done[id] > 0;
}

function continueState(payload: RoutePayload, done: ProgressMap): ContinueReading {
  let doneCount = 0;
  let firstMissing: RouteStep | null = null;
  for (const step of payload.steps) {
    if (isDone(done, step.pid)) doneCount += 1;
    else if (firstMissing === null) firstMissing = step;
  }
  const total = payload.steps.length;
  if (doneCount === 0) return { kind: 'start', href: payload.steps[0].href, done: 0, total };
  if (firstMissing === null) return { kind: 'done', href: payload.reviewHref, done: doneCount, total };
  return {
    kind: 'resume',
    href: firstMissing.href,
    n: firstMissing.n,
    title: firstMissing.title,
    done: doneCount,
    total,
  };
}

function continueLabel(state: ContinueReading): string {
  if (state.kind === 'start') return START_LABEL;
  if (state.kind === 'resume') return `继续阅读 · 第 ${state.n} 步`;
  return `已读完全部 ${state.total} 步 · 回顾路线`;
}

export function homeView(payload: RoutePayload, done: ProgressMap): HomeView {
  const state = continueState(payload, done);
  const width = state.done === 0 || state.total === 0 ? '0%' : `${(state.done / state.total) * 100}%`;
  return {
    href: state.href,
    label: continueLabel(state),
    title: state.kind === 'resume' ? state.title : null,
    barHidden: state.done === 0,
    done: state.done,
    total: state.total,
    width,
  };
}

function countNoteReads(slugs: readonly string[], done: ProgressMap): { read: number; total: number } | null {
  if (slugs.length === 0) return null;
  let read = 0;
  for (const slug of slugs) if (isDone(done, `n:${slug}`)) read += 1;
  return { read, total: slugs.length };
}

export function sideCountText(slugs: readonly string[], done: ProgressMap): string {
  const count = countNoteReads(slugs, done);
  return count === null ? '' : `${count.read}/${count.total}`;
}

export function moduleReadText(slugs: readonly string[], done: ProgressMap): string | null {
  const count = countNoteReads(slugs, done);
  return count === null ? null : ` · 已读 ${count.read}`;
}
