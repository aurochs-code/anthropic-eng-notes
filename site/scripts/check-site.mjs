// 站点自检：node scripts/check-site.mjs [distDir]
// 起一个本地静态服务（按 BASE_PATH 挂载 dist），用 playwright 逐页检查：
// 页数、笔记 order 1–26、mermaid 块数 = svg 数且无报错、站内死链、首页 A–F 分组、路线/资源页。
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, extname } from 'node:path';

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
ok('资源页', existsSync(join(dist, 'resources/index.html')), `资源列表页存在，单篇资源页 ${resPages.length} 个`);

await browser.close(); server.close();
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}：${r.detail}`);
process.exit(results.every((r) => r.pass) ? 0 : 1);
