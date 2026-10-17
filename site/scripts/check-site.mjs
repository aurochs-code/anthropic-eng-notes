// 站点自检：node scripts/check-site.mjs [distDir]
// 起一个本地静态服务（按 BASE_PATH 挂载 dist），用 playwright 逐页检查：
// 页数、笔记 order 1–26、mermaid 块数 = svg 数且无报错、站内死链、首页 A–F 分组、路线/资源页、
// 主线 4 阶段 36 步（步数由资源数据推算，可用 EXPECT_STEPS 覆盖）、并行支线（track: theory）、
// 移动端 390px 无横向溢出、meta description/favicon/回到顶部、标题锚点、代码块复制按钮；
// B2：侧栏、三处目录、两种翻页与面包屑、布局断点、目录高亮、抽屉、Pagefind 搜索、暗色切换与 mermaid 重渲染、图表放大；
// B3：标签页、反向链接、路线勾选与阶段完成度、笔记标记已读联动、阅读进度条。
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
const tagPageCount = pages.filter((p) => /^tags\//.test(p)).length;
ok('页数', EXPECT_PAGES == null || pages.length === EXPECT_PAGES, `共 ${pages.length} 页（笔记 ${notePages.length}、资源 ${resPages.length}、标签 ${tagPageCount}）${EXPECT_PAGES ? `，期望 ${EXPECT_PAGES}` : ''}`);

const browser = await chromium.launch();
const internal = new Set(); const orders = []; const mermaidBad = []; let mTotal = 0;
const b1Pages = []; const overflow = []; const b2Pages = []; const noJs = [];
for (const rel of pages) {
  const page = await browser.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await page.goto(`${origin}${base}/${rel}`, { waitUntil: 'networkidle' });
  if (!(await page.$('html[data-js="ready"]'))) noJs.push(rel || '/');
  const hasM = await page.$('pre.mermaid');
  if (hasM) await page.waitForSelector('html[data-mermaid="done"]', { timeout: 20000 }).catch(() => errs.push('mermaid 未完成'));
  const m = await page.$$eval('pre.mermaid', (els) => els.map((e) => !!e.querySelector('svg') && !/Syntax error|Parse error/i.test(e.textContent)));
  mTotal += m.length;
  const svg = m.filter(Boolean).length;
  if (svg !== m.length || errs.length || (rel.startsWith('notes/') && m.length === 0)) mermaidBad.push(`${rel}: 块 ${m.length} / svg ${svg} ${errs.join(' | ')}`);
  if (rel.startsWith('notes/')) {
    const t = await page.$eval('article .meta span', (e) => e.textContent);
    orders.push(+/#(\d+)/.exec(t)[1]);
  }
  for (const h of await page.$$eval('a[href], link[rel="icon"][href]', (as) => as.map((a) => a.getAttribute('href')))) {
    if (/^(https?:|mailto:)/.test(h) && !h.startsWith(origin)) continue;
    internal.add(JSON.stringify([rel, h]));
  }
  // B1：每页 meta description / favicon / 回到顶部；正文标题锚点；代码块复制按钮
  const b1 = await page.evaluate(() => {
    const desc = document.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() ?? '';
    const icon = !!document.querySelector('link[rel="icon"]');
    const toTop = !!document.querySelector('button.to-top');
    const hs = [...document.querySelectorAll('article h2[id], article h3[id], article h4[id]')];
    const badAnchors = hs.filter((h) => h.querySelector(':scope > a.anchor')?.getAttribute('href') !== `#${h.id}`).map((h) => h.id);
    const pres = document.querySelectorAll('main pre:not(.mermaid)').length;
    const copies = document.querySelectorAll('main .code-wrap > .copy-btn').length;
    return { desc: desc.length, icon, toTop, headings: hs.length, badAnchors, pres, copies };
  });
  b1Pages.push({ rel, ...b1 });
  // B2：侧栏（26 篇 + 当前页高亮）、目录与正文标题一致、两种翻页、面包屑步号
  const b2 = await page.evaluate(() => {
    const side = document.querySelector('#sidebar .sidebar-nav');
    const noteLinks = side ? side.querySelectorAll('a[data-note-link]').length : 0;
    const current = side ? [...side.querySelectorAll('a[aria-current="page"]')].map((a) => a.getAttribute('href')) : [];
    const ids = [...document.querySelectorAll('article h2[id], article h3[id]')].map((h) => h.id);
    const tocOf = (sel) => [...document.querySelectorAll(`${sel} a`)].map((a) => decodeURIComponent(a.getAttribute('href').slice(1)));
    return {
      noteLinks, current, ids, here: location.pathname,
      side: tocOf('.toc-side'), inline: tocOf('details.toc-inline'), drawer: tocOf('#toc-drawer .toc'),
      pagerOrder: !!document.querySelector('nav[data-pager="order"]'), pagerRoute: !!document.querySelector('nav[data-pager="route"]'),
      crumbStep: document.querySelector('.breadcrumb [data-route-step]')?.getAttribute('data-route-step') ?? null,
    };
  });
  b2Pages.push({ rel, ...b2 });
  // 移动端：390px 视口无横向溢出
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(50);
  const ov = await page.evaluate(() => {
    const w = document.documentElement.clientWidth;
    const sw = document.documentElement.scrollWidth;
    const culprits = sw > w ? [...document.querySelectorAll('body *')].filter((e) => e.getBoundingClientRect().right > w + 1 && !e.closest('pre, table, .scroll-x')).slice(0, 3).map((e) => `${e.tagName.toLowerCase()}.${e.className}`.slice(0, 60)) : [];
    return { w, sw, culprits };
  });
  if (ov.sw > ov.w) overflow.push(`${rel || '/'}: scrollWidth ${ov.sw} > ${ov.w}（${ov.culprits.join('、')}）`);
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
ok('每页交互脚本', noJs.length === 0, noJs.length ? `${noJs.length} 页未跑起 Base 脚本：${noJs.slice(0, 8).join('、')}` : `${pages.length} 页均已运行主题/侧栏/搜索/进度脚本（html[data-js=ready]）`);
ok('移动端 390px 无横向溢出', overflow.length === 0, overflow.length ? '溢出：\n  ' + overflow.join('\n  ') : `${pages.length} 页 scrollWidth 均 ≤ 视口宽度`);
const noDesc = b1Pages.filter((p) => p.desc < 10).map((p) => p.rel || '/');
const noIcon = b1Pages.filter((p) => !p.icon || !p.toTop).map((p) => p.rel || '/');
ok('meta description / favicon / 回到顶部', noDesc.length === 0 && noIcon.length === 0, `缺 description：[${noDesc}]；缺 favicon 或回到顶部按钮：[${noIcon}]`);
const contentPages = b1Pages.filter((p) => /^(notes|resources)\/[^/]+\/$/.test(p.rel));
const anchorBad = contentPages.filter((p) => p.headings === 0 || p.badAnchors.length);
ok('标题锚点', anchorBad.length === 0, `${contentPages.length} 个笔记/资源页共 ${contentPages.reduce((n, p) => n + p.headings, 0)} 个 h2–h4，均带 #锚点` + (anchorBad.length ? '；问题：' + anchorBad.map((p) => `${p.rel}（${p.headings ? p.badAnchors.slice(0, 3).join(',') : '无标题'}）`).join('，') : ''));
const copyBad = b1Pages.filter((p) => p.pres !== p.copies);
ok('代码块复制按钮', copyBad.length === 0, `代码块 ${b1Pages.reduce((n, p) => n + p.pres, 0)} 个，复制按钮 ${b1Pages.reduce((n, p) => n + p.copies, 0)} 个` + (copyBad.length ? '；不一致：' + copyBad.map((p) => p.rel).join('，') : ''));

ok('站内死链', dead.length === 0, `检查 ${internal.size} 个（页面, 链接）对` + (dead.length ? '；死链：\n  ' + dead.join('\n  ') : ''));

const home = readFileSync(join(dist, 'index.html'), 'utf8');
const mods = [...home.matchAll(/<h2[^>]*>模块 ([A-F])/g)].map((x) => x[1]).join('');
const homeSums = (home.match(/<p class="sum zh">/g) ?? []).length;
ok('首页 A–F 分组', mods === 'ABCDEF' && homeSums === 26, `分组：${mods}；摘要 ${homeSums} 条`);

const pathHtml = readFileSync(join(dist, 'path/index.html'), 'utf8');
const stages = [...pathHtml.matchAll(/<h2[^>]*>阶段 (\d)/g)].map((x) => x[1]).join('');
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
const loadMd = (dir, re) => existsSync(dir)
  ? readdirSync(dir).filter((f) => re.test(f)).map((f) => {
      const src = readFileSync(join(dir, f), 'utf8');
      const fm = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(src);
      return { f, d: fm ? yaml.load(fm[1]) ?? {} : {}, body: fm ? fm[2] : src };
    })
  : [];
const resData = loadMd(resDir, /^r-.*\.md$/);
const noteData = loadMd(resolve(siteDir, process.env.NOTES_DIR ?? '../notes'), /\.md$/);
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

// ── B2：侧栏 / 目录 / 翻页 / 面包屑 ──
const sideBad = b2Pages.filter((p) => p.noteLinks !== 26 || (/^(notes|resources)\/[^/]+\/$/.test(p.rel) || p.rel === '' || p.rel === 'path/' || p.rel === 'resources/') && (p.current.length !== 1 || p.current[0] !== p.here));
ok('侧栏', sideBad.length === 0, `${b2Pages.length} 页均含 26 篇笔记链接，当前页高亮唯一且正确` + (sideBad.length ? '；问题：' + sideBad.map((p) => `${p.rel}（${p.noteLinks} 篇，高亮 ${p.current.join(',') || '无'}）`).join('，') : ''));
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const tocBad = contentPages.map((c) => b2Pages.find((p) => p.rel === c.rel)).filter((p) => !p.ids.length || !same(p.side, p.ids) || !same(p.inline, p.ids) || !same(p.drawer, p.ids));
ok('本页目录', tocBad.length === 0, `${contentPages.length} 个笔记/资源页：右栏、折叠、抽屉三处目录均与正文 h2/h3 一致（共 ${contentPages.reduce((n, c) => n + b2Pages.find((p) => p.rel === c.rel).ids.length, 0)} 条）` + (tocBad.length ? '；不一致：' + tocBad.map((p) => `${p.rel}（正文 ${p.ids.length}/右栏 ${p.side.length}/折叠 ${p.inline.length}/抽屉 ${p.drawer.length}）`).join('，') : ''));
// 面包屑“第 M 步”与路线页编号一致；笔记页两种翻页都在
const stepOfHref = new Map([...pathHtml.matchAll(/<li[^>]*data-shown-step="(\d+)"[^>]*>([\s\S]*?)<\/li>/g)].map((x) => [/href="([^"]+)"/.exec(x[2])?.[1], x[1]]).filter(([h]) => h && /\/notes\//.test(h)));
const noteB2 = b2Pages.filter((p) => /^notes\/[^/]+\/$/.test(p.rel));
const crumbBad = noteB2.filter((p) => !p.pagerOrder || !p.pagerRoute || p.crumbStep !== stepOfHref.get(p.here));
ok('上下篇与面包屑', crumbBad.length === 0 && noteB2.length === 26, `${noteB2.length} 篇笔记均有“按编号”“按学习路线”两组翻页，面包屑步号与路线页一致` + (crumbBad.length ? '；问题：' + crumbBad.map((p) => `${p.rel}（面包屑 ${p.crumbStep} / 路线 ${stepOfHref.get(p.here)}）`).join('，') : ''));

// ── B2 交互：布局断点、目录高亮、抽屉、搜索、暗色切换 + mermaid 重渲染、图表放大 ──
const NOTE = `${origin}${base}/notes/building-effective-agents/`;
const visible = (pg, sel) => pg.$eval(sel, (e) => { const r = e.getBoundingClientRect(); const c = getComputedStyle(e); return c.display !== 'none' && c.visibility !== 'hidden' && r.width > 0 && r.right > 0 && r.left < innerWidth; }).catch(() => false);
async function ctxPage(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts });
  const pg = await ctx.newPage(); const errs = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  return { ctx, pg, errs };
}
async function interact(name, fn, opts) {
  const { ctx, pg, errs } = await ctxPage(opts);
  try { const r = await fn(pg); ok(name, r.pass && errs.length === 0, r.detail + (errs.length ? '；页面错误：' + errs.join(' | ') : '')); }
  catch (e) { ok(name, false, `异常：${e.message.split('\n')[0]}`); }
  await ctx.close();
}
const waitM = (pg) => pg.waitForSelector('html[data-mermaid="done"]', { timeout: 20000 });

await interact('布局 1440 三栏', async (pg) => {
  await pg.goto(NOTE, { waitUntil: 'networkidle' });
  const v = { side: await visible(pg, '#sidebar'), toc: await visible(pg, '.toc-side'), inline: await visible(pg, 'details.toc-inline'), menu: await visible(pg, '.menu-btn') };
  return { pass: v.side && v.toc && !v.inline && !v.menu, detail: `侧栏 ${v.side ? '显示' : '隐藏'}、右目录 ${v.toc ? '显示' : '隐藏'}、折叠目录 ${v.inline ? '显示' : '隐藏'}、菜单按钮 ${v.menu ? '显示' : '隐藏'}` };
});
await interact('目录滚动高亮', async (pg) => {
  await pg.goto(NOTE, { waitUntil: 'networkidle' });
  const id = await pg.evaluate(() => { const h = document.querySelectorAll('article h2[id]')[3]; window.scrollTo(0, h.getBoundingClientRect().top + scrollY - 70); return h.id; });
  await pg.waitForTimeout(400);
  const act = await pg.$$eval('.toc-side a.active', (as) => as.map((a) => decodeURIComponent(a.hash.slice(1))));
  return { pass: act.length === 1 && act[0] === id, detail: `滚到「${id}」，右栏高亮：${act.join(',') || '无'}` };
});
await interact('布局 1000 中屏（侧栏抽屉 + 折叠目录）', async (pg) => {
  await pg.goto(NOTE, { waitUntil: 'networkidle' });
  const before = { side: await visible(pg, '#sidebar'), toc: await visible(pg, '.toc-side'), inline: await visible(pg, 'details.toc-inline') };
  await pg.click('.menu-btn'); await pg.waitForTimeout(350);
  const opened = await visible(pg, '#sidebar') && (await pg.getAttribute('.menu-btn', 'aria-expanded')) === 'true';
  const focusIn = await pg.evaluate(() => !!document.activeElement?.closest('#sidebar'));
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(350);
  const closed = !(await visible(pg, '#sidebar'));
  return { pass: !before.side && !before.toc && before.inline && opened && focusIn && closed, detail: `初始侧栏 ${before.side ? '显示' : '隐藏'}/右目录 ${before.toc ? '显示' : '隐藏'}/折叠目录 ${before.inline ? '显示' : '隐藏'}；菜单打开 ${opened}、焦点进入 ${focusIn}、Esc 关闭 ${closed}` };
}, { viewport: { width: 1000, height: 800 } });
await interact('布局 390 手机（菜单 + 底部目录抽屉）', async (pg) => {
  await pg.goto(NOTE, { waitUntil: 'networkidle' });
  const v = { inline: await visible(pg, 'details.toc-inline'), fab: await visible(pg, '.toc-fab'), nav: await visible(pg, 'nav.top') };
  await pg.click('.toc-fab');
  const open = await pg.$eval('#toc-drawer', (d) => d.open);
  const n = await pg.$$eval('#toc-drawer .toc a', (as) => as.length);
  const target = await pg.$eval('#toc-drawer .toc a:nth-child(1)', (a) => a.hash).catch(() => null);
  const href = await pg.$$eval('#toc-drawer .toc a', (as) => as[2].hash);
  await pg.click(`#toc-drawer .toc a[href="${await pg.$$eval('#toc-drawer .toc a', (as) => as[2].getAttribute('href'))}"]`);
  await pg.waitForTimeout(300);
  const closed = await pg.$eval('#toc-drawer', (d) => !d.open);
  const hashOk = (await pg.evaluate(() => location.hash)) === href;
  await pg.click('.menu-btn'); await pg.waitForTimeout(350);
  const menu = await visible(pg, '#sidebar');
  return { pass: !v.inline && v.fab && open && n > 0 && closed && hashOk && menu && target !== undefined, detail: `折叠目录 ${v.inline ? '显示' : '隐藏'}、底部目录按钮 ${v.fab ? '显示' : '隐藏'}；抽屉打开 ${open}（${n} 条），点条目后关闭 ${closed} 且跳转 ${hashOk}；菜单打开侧栏 ${menu}` };
}, { viewport: { width: 390, height: 844 } });
ok('搜索索引', existsSync(join(dist, 'pagefind/pagefind.js')) && existsSync(join(dist, 'pagefind/pagefind-entry.json')), `dist/pagefind/ ${existsSync(join(dist, 'pagefind')) ? '存在' : '缺失（build 需运行 pagefind --site dist）'}`);
for (const [label, vp, open] of [['桌面 Ctrl+K', { width: 1440, height: 900 }, (pg) => pg.keyboard.press('Control+k')], ['手机 搜索按钮', { width: 390, height: 844 }, (pg) => pg.click('.search-btn')]]) {
  await interact(`搜索弹窗（${label}）`, async (pg) => {
    await pg.goto(NOTE, { waitUntil: 'networkidle' });
    await open(pg);
    await pg.waitForSelector('#search-dialog .search-input', { state: 'visible', timeout: 5000 });
    const focused = await pg.evaluate(() => document.activeElement?.classList.contains('search-input'));
    const res = {};
    for (const q of ['上下文工程', '沙箱', 'harness', 'Claude Code 沙箱']) {
      await pg.fill('#search-dialog .search-input', q);
      await pg.waitForFunction((q) => document.querySelector('#search-dialog')?.dataset.state === 'done' && document.querySelector('#search-dialog .search-summary')?.textContent.includes(`「${q}」`), q, { timeout: 10000 }).catch(() => {});
      res[q] = await pg.$$eval('#search-dialog .search-results a.sr-main', (as) => as.map((a) => a.getAttribute('href')));
    }
    const bad = Object.entries(res).filter(([, hs]) => !hs.length || hs.some((h) => !h.startsWith(base + '/')));
    const sandbox = res['沙箱'].slice(0, 3).some((h) => h.startsWith(`${base}/notes/claude-code-sandboxing/`));
    const ctxTop = (res['上下文工程'][0] ?? '').startsWith(`${base}/notes/effective-context-engineering-for-ai-agents/`);
    // 键盘：↓ 进入结果，Enter 打开
    await pg.fill('#search-dialog .search-input', 'harness');
    await pg.waitForFunction(() => document.querySelector('#search-dialog')?.dataset.state === 'done' && document.querySelector('#search-dialog .search-summary')?.textContent.includes('「harness」'), null, { timeout: 10000 }).catch(() => {});
    await pg.keyboard.press('ArrowDown');
    const kbFocus = await pg.evaluate(() => !!document.activeElement?.closest('#search-dialog .search-results'));
    await pg.keyboard.press('ArrowUp');
    const backToInput = await pg.evaluate(() => document.activeElement?.classList.contains('search-input'));
    const first = res['上下文工程']?.[0];
    const st = first ? (await fetch(new URL(first, origin))).status : 0;
    await pg.keyboard.press('Escape');
    const closed = await pg.$eval('#search-dialog', (d) => !d.open);
    return { pass: focused && bad.length === 0 && sandbox && ctxTop && st === 200 && kbFocus && backToInput && closed, detail: `打开后输入框获得焦点 ${focused}；` + Object.entries(res).map(([q, hs]) => `「${q}」${hs.length} 页`).join('，') + `；「沙箱」前 3 含沙箱笔记 ${sandbox}；「上下文工程」首条为上下文工程笔记 ${ctxTop}（${first ?? '无'} → ${st}）；↓/↑ 键盘导航 ${kbFocus && backToInput}；Esc 关闭 ${closed}` };
  }, { viewport: vp });
}
// 中文召回：正文含该词的页面，必须都能搜到（JS API + 与弹窗相同的查询改写）
await interact('中文搜索召回', async (pg) => {
  const { parseQuery, cleanText, hasAll } = await import('../src/lib/search-query.mjs');
  const TERMS = ['上下文', '上下文工程', '上下文窗口', '沙箱', '提示缓存', '智能体', '多智能体', '评测', '检索', '记忆', '编排', '提示注入', '基础设施', '编译器', '原理支线', '学习路线', '工作流', '护栏'];
  const texts = pages.filter((rel) => /<main[^>]*data-pagefind-body/.test(readFileSync(join(dist, rel, 'index.html'), 'utf8'))).map((rel) => [rel, (/<main[^>]*>([\s\S]*)<\/main>/.exec(readFileSync(join(dist, rel, 'index.html'), 'utf8'))?.[1] ?? '')
    .replace(/<pre class="mermaid"[\s\S]*?<\/pre>/g, '').replace(/<(nav|details)\b[\s\S]*?<\/\1>/g, '').replace(/<(section|div)\b[^>]*data-pagefind-ignore[^>]*>[\s\S]*?<\/\1>/g, '').replace(/<a class="anchor"[^>]*>#<\/a>/g, '').replace(/<[^>]+>/g, '')]);
  await pg.goto(`${origin}${base}/`, { waitUntil: 'networkidle' });
  // 与弹窗相同：按字检索 + 子串过滤（过滤在 Node 侧用同一模块做）
  const raw = await pg.evaluate(async ([bp, qs]) => {
    const pf = await import(bp + 'pagefind.js'); await pf.options({ baseUrl: '/' }); await pf.init();
    const r = {}; for (const [t, q] of qs) { const s = await pf.search(q); r[t] = (await Promise.all(s.results.map((x) => x.data()))).map((d) => [d.url.replace(/^\//, ''), d.content]); } return r;
  }, [`${base}/pagefind/`, TERMS.map((t) => [t, parseQuery(t).query])]);
  const got = Object.fromEntries(Object.entries(raw).map(([t, rs]) => [t, rs.filter(([, c]) => hasAll(cleanText(c), parseQuery(t).tokens)).map(([u]) => u)]));
  let extra = 0;
  let want = 0, hit = 0; const miss = [];
  for (const t of TERMS) {
    const exp = texts.filter(([, x]) => x.includes(t)).map(([r]) => r);
    const h = exp.filter((r) => got[t].includes(r)).length;
    extra += got[t].filter((r) => !exp.includes(r)).length;
    want += exp.length; hit += h;
    if (h < exp.length) miss.push(`${t} ${h}/${exp.length}`);
  }
  return { pass: miss.length === 0 && want > 0, detail: `${TERMS.length} 个中文词，正文含词的 ${want} 个（词, 页面）搜到 ${hit}，多出 ${extra}` + (miss.length ? '；漏：' + miss.join('，') : '') };
});
await interact('暗色切换 + mermaid 重渲染 + 记忆', async (pg) => {
  await pg.goto(NOTE, { waitUntil: 'networkidle' }); await waitM(pg);
  const t0 = await pg.evaluate(() => document.documentElement.dataset.theme);
  const n = await pg.$$eval('pre.mermaid', (e) => e.length);
  const svg0 = await pg.$eval('pre.mermaid svg', (s) => s.outerHTML.length + ':' + s.innerHTML.slice(0, 400));
  await pg.click('.theme-btn'); await pg.click('.theme-btn'); // auto → light → dark
  await pg.waitForSelector('html[data-theme="dark"][data-mermaid="done"][data-mermaid-theme="dark"]', { timeout: 20000 });
  const svgs = await pg.$$eval('pre.mermaid', (e) => e.filter((x) => x.querySelector('svg') && !/Syntax error|Parse error/i.test(x.textContent)).length);
  const svg1 = await pg.$eval('pre.mermaid svg', (s) => s.outerHTML.length + ':' + s.innerHTML.slice(0, 400));
  await pg.reload({ waitUntil: 'networkidle' }); await waitM(pg);
  const after = await pg.evaluate(() => [document.documentElement.dataset.theme, document.documentElement.dataset.mermaidTheme, localStorage.getItem('theme')].join('/'));
  await pg.click('.theme-btn'); await pg.waitForSelector('html[data-theme="light"][data-mermaid="done"][data-mermaid-theme="default"]', { timeout: 20000 });
  const back = await pg.evaluate(() => [document.documentElement.dataset.themePref, document.documentElement.dataset.theme].join('/'));
  return { pass: t0 === 'light' && svgs === n && svg0 !== svg1 && after === 'dark/dark/dark' && back === 'auto/light', detail: `初始 ${t0}；切到深色后 ${svgs}/${n} 个图重渲染为 svg（内容${svg0 !== svg1 ? '已变' : '未变'}）；刷新后 主题/图主题/存储 = ${after}；再切回 ${back}` };
}, { colorScheme: 'light' });
await interact('暗色跟随系统 + 首屏无闪烁', async (pg) => {
  await pg.goto(NOTE, { waitUntil: 'domcontentloaded' });
  const t = await pg.evaluate(() => document.documentElement.dataset.theme);
  const html = readFileSync(join(dist, 'notes/building-effective-agents/index.html'), 'utf8');
  const head = html.slice(0, html.indexOf('</head>'));
  const early = head.indexOf("localStorage.getItem('theme')") > -1 && head.indexOf("localStorage.getItem('theme')") < head.indexOf('<link rel="stylesheet"');
  return { pass: t === 'dark' && early, detail: `系统深色、未设置偏好 → ${t}；主题脚本内联在 <head> 且先于样式表：${early}` };
}, { colorScheme: 'dark' });
await interact('图表放大', async (pg) => {
  await pg.goto(NOTE, { waitUntil: 'networkidle' }); await waitM(pg);
  await pg.click('pre.mermaid');
  const open = await pg.$eval('dialog.zoom-dialog', (d) => d.open && !!d.querySelector('.zoom-stage svg'));
  const w0 = await pg.$eval('.zoom-stage svg', (s) => s.getBoundingClientRect().width);
  await pg.click('.zoom-bar [data-z="in"]');
  const w1 = await pg.$eval('.zoom-stage svg', (s) => s.getBoundingClientRect().width);
  await pg.keyboard.press('Escape');
  const closed = await pg.$eval('dialog.zoom-dialog', (d) => !d.open);
  await pg.focus('pre.mermaid'); await pg.keyboard.press('Enter');
  const kb = await pg.$eval('dialog.zoom-dialog', (d) => d.open);
  return { pass: open && w1 > w0 * 1.2 && closed && kb, detail: `点击打开 ${open}；放大 ${Math.round(w0)} → ${Math.round(w1)}px；Esc 关闭 ${closed}；键盘 Enter 打开 ${kb}` };
});

// ── B3：标签页、反向链接（静态 HTML 对照源文件计算）；学习进度、阅读进度条（交互） ──
const tagSlug = (t) => String(t).trim().toLowerCase().replace(/\s+/g, '-');
const tagMap = new Map();
for (const [kind, list] of [['notes', noteData], ['resources', resData]])
  for (const x of list) for (const t of new Set((x.d.tags ?? []).map(tagSlug))) { const e = tagMap.get(t) ?? { notes: 0, resources: 0 }; e[kind]++; tagMap.set(t, e); }
const tagBad = [];
if (!pages.includes('tags/')) tagBad.push('缺 /tags/');
const tagIndex = existsSync(join(dist, 'tags/index.html')) ? readFileSync(join(dist, 'tags/index.html'), 'utf8') : '';
if (+(/data-tag-count="(\d+)"/.exec(tagIndex)?.[1] ?? -1) !== tagMap.size) tagBad.push(`/tags/ 标注 ${/data-tag-count="(\d+)"/.exec(tagIndex)?.[1]} 个，数据 ${tagMap.size} 个`);
for (const [t, e] of tagMap) {
  const f = join(dist, 'tags', t, 'index.html');
  if (!existsSync(f)) { tagBad.push(`缺 /tags/${t}/`); continue; }
  const h = readFileSync(f, 'utf8');
  const n = +(/data-tag-notes="(\d+)"/.exec(h)?.[1] ?? 0), r = +(/data-tag-resources="(\d+)"/.exec(h)?.[1] ?? 0);
  if (n !== e.notes || r !== e.resources) tagBad.push(`${t}: 页面 ${n}+${r} / 数据 ${e.notes}+${e.resources}`);
}
const tagPages = pages.filter((p) => /^tags\/[^/]+\/$/.test(p)).length;
ok('标签页', tagBad.length === 0 && tagPages === tagMap.size, `${tagMap.size} 个标签（笔记 + 资源 tags 去重），/tags/ 与 ${tagPages} 个标签页，条目数均与数据一致` + (tagBad.length ? '；问题：' + tagBad.slice(0, 8).join('，') : ''));

const { LINK_RE } = await import('../src/lib/remark-plugins.mjs');
const linksOf = (body) => new Set([...body.matchAll(/\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)].map((m) => LINK_RE.exec(m[1])?.[1]?.toLowerCase()).filter(Boolean));
const slugOf = (x) => x.d.slug;
const validSlugs = new Set([...noteData, ...resData].map(slugOf));
const expBack = new Map();
const addBack = (t, href) => { if (!validSlugs.has(t)) return; (expBack.get(t) ?? expBack.set(t, new Set()).get(t)).add(href); };
for (const n of noteData) for (const t of linksOf(n.body)) if (t !== slugOf(n)) addBack(t, `${base}/notes/${slugOf(n)}/`);
for (const r of resData) for (const t of new Set([...linksOf(r.body), ...(r.d.pairs_with ?? [])])) if (t !== slugOf(r)) addBack(t, `${base}/resources/${slugOf(r)}/`);
const backBad = []; let backTotal = 0;
for (const x of [...noteData.map((n) => ['notes', n]), ...resData.map((r) => ['resources', r])]) {
  const [sec, item] = x; const f = join(dist, sec, slugOf(item), 'index.html');
  if (!existsSync(f)) continue;
  const h = readFileSync(f, 'utf8');
  const sect = /<section class="backlinks"[\s\S]*?<\/section>/.exec(h)?.[0];
  if (!sect) { backBad.push(`${sec}/${slugOf(item)}: 缺反向链接区块`); continue; }
  const got = new Set([...sect.matchAll(/<a data-backlink[^>]*href="([^"]+)"/g)].map((m) => m[1]));
  const exp = expBack.get(slugOf(item)) ?? new Set();
  backTotal += got.size;
  if (got.size !== exp.size || [...exp].some((u) => !got.has(u))) backBad.push(`${sec}/${slugOf(item)}: 页面 ${got.size} / 期望 ${exp.size}`);
}
ok('反向链接', backBad.length === 0, `${noteData.length + resData.length} 个笔记/资源页均有反向链接区块，共 ${backTotal} 条，与源文件中的 .md 链接 + pairs_with 一致` + (backBad.length ? '；问题：' + backBad.slice(0, 8).join('，') : ''));

const PATH = `${origin}${base}/path/`;
const theoryCount = resData.filter((r) => r.d.track === 'theory').reduce((n, r) => n + (r.d.route ?? []).length, 0);
for (const [rel, label] of [['', '首页'], ['path/', '路线页'], ['tags/', '标签页']]) await interact(`非笔记页交互（${label}，手机）`, async (pg) => {
  await pg.goto(`${origin}${base}/${rel}`, { waitUntil: 'networkidle' });
  await pg.click('.menu-btn'); await pg.waitForTimeout(350);
  const menu = await visible(pg, '#sidebar');
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(350);
  await pg.click('.search-btn');
  const search = await pg.waitForSelector('#search-dialog .search-input', { state: 'visible', timeout: 5000 }).then(() => true, () => false);
  await pg.keyboard.press('Escape');
  const t0 = await pg.evaluate(() => document.documentElement.dataset.themePref);
  await pg.click('.theme-btn');
  const t1 = await pg.evaluate(() => document.documentElement.dataset.themePref);
  return { pass: menu && search && t0 !== t1, detail: `菜单 ${menu}、搜索弹窗 ${search}、主题切换 ${t0}→${t1}` };
}, { viewport: { width: 390, height: 844 } });
await interact('学习进度：路线勾选与阶段完成度', async (pg) => {
  pg.on('dialog', (d) => d.accept());
  await pg.goto(PATH, { waitUntil: 'networkidle' });
  const main = await pg.$$eval('section[data-progress-group^="stage-"] input.done-box', (b) => b.length);
  const track = await pg.$$eval('section[data-progress-group^="track-"] input.done-box', (b) => b.length);
  const stepBoxes = await pg.$$eval('li[data-shown-step] > input.done-box', (b) => b.length);
  await pg.check('#step-1 input.done-box');
  await pg.check('#step-2 input.done-box');
  const s1 = await pg.$eval('section[data-progress-group="stage-1"]', (s) => s.dataset.progressDone);
  const all = await pg.$eval('.progress-card', (s) => [s.dataset.progressDone, s.querySelector('.progress-bar').getAttribute('aria-valuenow')].join('/'));
  const w = await pg.$eval('section[data-progress-group="stage-1"] .progress-bar > span', (e) => parseFloat(e.style.width));
  await pg.reload({ waitUntil: 'networkidle' });
  const kept = await pg.$$eval('#step-1 input.done-box, #step-2 input.done-box', (b) => b.every((x) => x.checked));
  const resetShown = await visible(pg, '.progress-reset');
  await pg.click('.progress-reset');
  const cleared = await pg.$$eval('input.done-box', (b) => b.every((x) => !x.checked)) && (await pg.evaluate(() => localStorage.getItem('progress:v1'))) === '{}';
  const pass = main === EXPECT_STEPS && stepBoxes === EXPECT_STEPS && track === theoryCount && s1 === '2' && all === '2/2' && w > 0 && kept && resetShown && cleared;
  return { pass, detail: `主线勾选框 ${main}（期望 ${EXPECT_STEPS}），支线 ${track}（期望 ${theoryCount}）；勾 2 步后阶段 1 = ${s1}、总进度/aria = ${all}、进度条 ${w.toFixed(1)}%；刷新后保留 ${kept}；清除进度 ${resetShown && cleared}` };
});
await interact('学习进度：笔记“标记为已读”联动', async (pg) => {
  const slug = 'building-effective-agents';
  await pg.goto(NOTE, { waitUntil: 'networkidle' });
  await pg.click('.mark-read');
  const pressed = await pg.getAttribute('.mark-read', 'aria-pressed');
  const side = await pg.$eval(`#sidebar a[data-note-link="${slug}"]`, (a) => a.hasAttribute('data-read'));
  await pg.goto(PATH, { waitUntil: 'networkidle' });
  const onPath = await pg.$eval(`li[data-shown-step]:has(a[data-note-link="${slug}"]) input.done-box`, (b) => b.checked);
  await pg.goto(`${origin}${base}/`, { waitUntil: 'networkidle' });
  const onHome = await pg.$eval(`main a[data-note-link="${slug}"]`, (a) => a.hasAttribute('data-read'));
  await pg.goto(NOTE, { waitUntil: 'networkidle' });
  await pg.click('.mark-read');
  const unpressed = await pg.getAttribute('.mark-read', 'aria-pressed');
  const sideOff = await pg.$eval(`#sidebar a[data-note-link="${slug}"]`, (a) => !a.hasAttribute('data-read'));
  return { pass: pressed === 'true' && side && onPath && onHome && unpressed === 'false' && sideOff, detail: `标记后按钮 ${pressed}、侧栏 ✓ ${side}、路线页勾选 ${onPath}、首页 ✓ ${onHome}；取消后按钮 ${unpressed}、侧栏取消 ${sideOff}` };
});
await interact('阅读进度条', async (pg) => {
  await pg.goto(NOTE, { waitUntil: 'networkidle' });
  const val = async () => +(await pg.getAttribute('.read-progress', 'aria-valuenow'));
  const top = await val();
  await pg.evaluate(() => { const a = document.querySelector('main article'); const r = a.getBoundingClientRect(); scrollTo(0, scrollY + r.top + (r.height - innerHeight) / 2); });
  await pg.waitForTimeout(200); const mid = await val();
  await pg.evaluate(() => { const a = document.querySelector('main article'); const r = a.getBoundingClientRect(); scrollTo(0, scrollY + r.bottom - innerHeight + 2); });
  await pg.waitForTimeout(200); const end = await val();
  const onPath = existsSync(join(dist, 'path/index.html')) && !readFileSync(join(dist, 'path/index.html'), 'utf8').includes('class="read-progress"');
  return { pass: top === 0 && mid >= 40 && mid <= 60 && end === 100 && onPath, detail: `顶部 ${top}%、正文中部 ${mid}%、正文末尾 ${end}%；路线页无进度条 ${onPath}` };
});

await browser.close(); server.close();
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}：${r.detail}`);
process.exit(results.every((r) => r.pass) ? 0 : 1);
