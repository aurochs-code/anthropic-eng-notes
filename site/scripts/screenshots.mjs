// 用法：先 npm run build && npm run preview（默认 http://localhost:4321），再 node scripts/screenshots.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const origin = process.env.PREVIEW_ORIGIN ?? 'http://localhost:4321';
const base = (process.env.BASE_PATH ?? '/anthropic-eng-notes').replace(/\/$/, '');
const out = new URL('../screenshots/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const shots = [
  ['home-desktop', `${base}/`, { width: 1280, height: 900 }],
  ['home-mobile', `${base}/`, { width: 390, height: 844 }],
  ['note-desktop', `${base}/notes/building-effective-agents/`, { width: 1280, height: 900 }],
  ['note-mobile', `${base}/notes/building-effective-agents/`, { width: 390, height: 844 }],
];
let ok = true;
for (const [name, path, viewport] of shots) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(origin + path, { waitUntil: 'networkidle' });
  if (path.includes('/notes/')) {
    await page.waitForSelector('html[data-mermaid="done"]', { timeout: 20000 }).catch(() => {});
    const r = await page.$$eval('pre.mermaid', (els) => els.map((e) => !!e.querySelector('svg') && !e.textContent.includes('Syntax error')));
    console.log(`${name}: mermaid 块 ${r.length} 个，渲染成 svg ${r.filter(Boolean).length} 个`);
    if (!r.length || r.includes(false)) ok = false;
    // 单独截一张图解区
    if (name === 'note-desktop') {
      const el = await page.$('pre.mermaid');
      await el.scrollIntoViewIfNeeded();
      await el.screenshot({ path: `${out}mermaid-fig1.png` });
    }
  }
  if (errors.length) { console.log(`${name} 页面错误:`, errors); ok = false; }
  await page.screenshot({ path: `${out}${name}.png`, fullPage: true });
  await page.close();
}
await browser.close();
console.log(ok ? 'OK' : 'FAILED');
process.exit(ok ? 0 : 1);
