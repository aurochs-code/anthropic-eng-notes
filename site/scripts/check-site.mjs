// 站点自检：node scripts/check-site.mjs [distDir]
// 起一个本地静态服务（按 BASE_PATH 挂载 dist），用 playwright 逐页检查：
// 页数、笔记 order 1–26、mermaid 块数 = svg 数且无报错、站内死链、首页 A–F 分组、路线/资源页、
// 主线 4 阶段 36 步（步数由资源数据推算，可用 EXPECT_STEPS 覆盖）、并行支线（track: theory）。
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import yaml from 'js-yaml'; // astro 的依赖，已在 node_modules 中

const dist = process.argv[2] ?? new URL('../dist/', import.meta.url).pathname;
const base = (process.env.BASE_PATH ?? '/anthropic-eng-notes').replace(/\/$/, '');
const EXPECT_PAGES = process.env.EXPECT_PAGES ? +process.env.EXPECT_PAGES : null;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
const results = []; const ok = (name, pass, detail = '') => results.push({ name, pass, detail });

const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (!p.startsWith(base + '/')) { res.writeHead(404).end(); return; }
  let f = join(dist, p.slice(base.length));
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html');
  if (!existsSync(f)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': types[extname(f)] ?? 'application/octet-stream' }).end(readFileSync(f));
}).listen(0);
const origin = `http://127.0.0.1:${server.address().port}`;

// 收集页面
const pages = [];
(function walk(d, rel = '') {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    if (e.isDirectory()) walk(join(d, e.name), `${rel}${e.name}/`);
    else if (e.name === 'index.html') pages.push(rel);
  }
})(dist);
const notePages = pages.filter((p) => /^notes\/[^/]+\/$/.test(p));
const resPages = pages.filter((p) => /^resources\/[^/]+\/$/.test(p));
ok('页数', EXPECT_PAGES == null || pages.length === EXPECT_PAGES, `共 ${pages.length} 页（笔记 ${notePages.length}、资源 ${resPages.length}）${EXPECT_PAGES ? `，期望 ${EXPECT_PAGES}` : ''}`);

const browser = await chromium.launch();
const internal = new Set(); const orders = []; const mermaidBad = []; let mTotal = 0;
for (const rel of pages) {
  const page = await browser.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await page.goto(`${origin}${base}/${rel}`, { waitUntil: 'networkidle' });
  const hasM = await page.$('pre.mermaid');
  if (hasM) await page.waitForSelector('html[data-mermaid="done"]', { timeout: 20000 }).catch(() => errs.push('mermaid 未完成'));
  const m = await page.$$eval('pre.mermaid', (els) => els.map((e) => !!e.querySelector('svg') && !/Syntax error|Parse error/i.test(e.textContent)));
  mTotal += m.length;
  const svg = m.filter(Boolean).length;
  if (svg !== m.length || errs.length || (rel.startsWith('notes/') && m.length === 0)) mermaidBad.push(`${rel}: 块 ${m.length} / svg ${svg} ${errs.join(' | ')}`);
  if (rel.startsWith('notes/')) {
    const t = await page.$eval('.meta span', (e) => e.textContent);
    orders.push(+/#(\d+)/.exec(t)[1]);
  }
  for (const h of await page.$$eval('a[href]', (as) => as.map((a) => a.getAttribute('href')))) {
    if (/^(https?:|mailto:)/.test(h) && !h.startsWith(origin)) continue;
    internal.add(JSON.stringify([rel, h]));
  }
  await page.close();
}
orders.sort((a, b) => a - b);
const missing = [...Array(26)].map((_, i) => i + 1).filter((n) => !orders.includes(n));
const dup = orders.filter((n, i) => orders[i - 1] === n);
ok('order 1–26', missing.length === 0 && dup.length === 0 && orders.length === 26, `缺 [${missing}] 重复 [${dup}]`);
ok('mermaid', mermaidBad.length === 0, `共 ${mTotal} 个块` + (mermaidBad.length ? '；问题：\n  ' + mermaidBad.join('\n  ') : '，全部渲染为 svg'));

const dead = [];
for (const j of internal) {
  const [rel, h] = JSON.parse(j);
  const path = h.split('#')[0];
  if (!path) continue;
  const r = await fetch(new URL(path, `${origin}${base}/${rel}`));
  if (r.status !== 200) dead.push(`${rel} → ${h} (${r.status})`);
  if (/\.md$/.test(path)) dead.push(`${rel} → ${h}（未改写的 .md 链接）`);
}
ok('站内死链', dead.length === 0, `检查 ${internal.size} 个（页面, 链接）对` + (dead.length ? '；死链：\n  ' + dead.join('\n  ') : ''));

const home = readFileSync(join(dist, 'index.html'), 'utf8');
const mods = [...home.matchAll(/<h2>模块 ([A-F])/g)].map((x) => x[1]).join('');
ok('首页 A–F 分组', mods === 'ABCDEF', `分组：${mods}`);

const pathHtml = readFileSync(join(dist, 'path/index.html'), 'utf8');
const stages = [...pathHtml.matchAll(/<h2>阶段 (\d)/g)].map((x) => x[1]).join('');
const noteLinks = (pathHtml.match(/badge">笔记 #/g) ?? []).length;
const resLinks = (pathHtml.match(/badge res">资源/g) ?? []).length;
ok('路线页', stages === '1234' && noteLinks === 26, `阶段 ${stages}，笔记 ${noteLinks} 条，资源条目 ${resLinks} 条`);
const shown = [...pathHtml.matchAll(/data-shown-step="(\d+)"/g)].map((x) => +x[1]);
const totalSteps = shown.length ? Math.max(...shown) : 0;
const mismatch = [...pathHtml.matchAll(/<li class="res"([^>]*)>/g)]
  .map((x) => [/data-declared-step="(\d+)"/.exec(x[1])?.[1], /data-shown-step="(\d+)"/.exec(x[1])?.[1]])
  .filter(([d, sh]) => d !== sh).map(([d, sh]) => `声明 ${d ?? '无'} / 显示 ${sh ?? '选读'}`);
const lastLi = [...pathHtml.matchAll(/<li[^>]*data-shown-step="(\d+)"[^>]*>([\s\S]*?)<\/li>/g)].find((x) => +x[1] === totalSteps);
const lastText = lastLi ? lastLi[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : '';
// 从资源源文件推算：主线步数 = 26 篇笔记 + 主线（非 track）且非选读的 route 条目；支线条目数按 track 统计
const siteDir = new URL('../', import.meta.url).pathname;
const resDir = resolve(siteDir, process.env.RESOURCES_DIR ?? '../resources');
const resData = existsSync(resDir)
  ? readdirSync(resDir).filter((f) => /^r-.*\.md$/.test(f)).map((f) => {
      const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(readFileSync(join(resDir, f), 'utf8'));
      return { f, d: fm ? yaml.load(fm[1]) ?? {} : {} };
    })
  : [];
const mainResSteps = resData.filter((r) => !r.d.track).flatMap((r) => (r.d.route ?? []).filter((e) => !(e.optional ?? r.d.optional)));
const dataSteps = 26 + mainResSteps.length;
const EXPECT_STEPS = process.env.EXPECT_STEPS ? +process.env.EXPECT_STEPS : dataSteps;
const contiguous = [...shown].sort((a, b) => a - b).every((n, i) => n === i + 1);
ok('路线步数', totalSteps === EXPECT_STEPS && shown.length === totalSteps && contiguous && mismatch.filter((m) => !m.includes('选读') || !m.startsWith('声明 无')).length === 0,
  `主线共 ${totalSteps} 步（期望 ${EXPECT_STEPS}；数据推算 ${dataSteps}${contiguous ? '，编号连续' : '，编号不连续！'}；选读 ${(pathHtml.match(/class="num">选读/g) ?? []).length} 条不计）；资源 step 声明与显示${mismatch.length ? '不一致：' + mismatch.join('，') : '一致'}；最后一步：${lastText}`);

// 并行支线：有 track: theory 资源 → 支线区块存在、条目数 = 数据条目数、区块内无主线编号；没有 → 不得渲染空支线
const theoryData = resData.filter((r) => r.d.track === 'theory');
const theoryEntries = theoryData.reduce((n, r) => n + (r.d.route ?? []).length, 0);
const secM = /<section[^>]*data-track="theory"[^>]*>([\s\S]*?)<\/section>/.exec(pathHtml);
if (theoryData.length === 0) {
  ok('原理支线', !secM && !/data-track-item=/.test(pathHtml), secM ? '没有 track: theory 资源，却渲染了支线区块' : '无 track: theory 资源，未渲染支线（符合预期）');
} else {
  const sec = secM?.[1] ?? '';
  const declared = +(/data-track-items="(\d+)"/.exec(secM?.[0] ?? '')?.[1] ?? -1);
  const items = (sec.match(/data-track-item="theory"/g) ?? []).length;
  const leaked = (sec.match(/data-shown-step=/g) ?? []).length;
  const mainLeak = (pathHtml.replace(secM?.[0] ?? '', '').match(/data-track-item=/g) ?? []).length;
  ok('原理支线', !!secM && items === theoryEntries && declared === theoryEntries && leaked === 0 && mainLeak === 0,
    `${secM ? '区块存在' : '区块缺失！'}；数据 ${theoryData.length} 个资源（${theoryData.map((r) => r.f).join(', ')}）共 ${theoryEntries} 条，页面渲染 ${items} 条（标注 ${declared}）；区块内主线编号 ${leaked} 个、区块外支线条目 ${mainLeak} 个`);
}
ok('资源页', existsSync(join(dist, 'resources/index.html')), `资源列表页存在，单篇资源页 ${resPages.length} 个`);

await browser.close(); server.close();
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}：${r.detail}`);
process.exit(results.every((r) => r.pass) ? 0 : 1);
