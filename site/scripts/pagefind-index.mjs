// 构建后建 Pagefind 搜索索引：node scripts/pagefind-index.mjs [distDir]
//
// 为什么不直接 `pagefind --site dist`：Pagefind 建索引时用自带词典（jieba）给中文分词，
// 浏览器端却用 Intl.Segmenter（ICU）切分查询词，两边切法常常不同，导致搜不到。实测：
// 「上下文」被索引成「上下 / 文」、查询却是「上下文」，30 页里只搜到 1 页；
// 「沙箱」查询被切成「沙 / 箱」，《Claude Code 沙箱》那篇搜不到。
// 做法：用 Pagefind 官方 Node API 建索引，喂给索引器的 HTML 副本里，中文字与字之间插零宽空格（U+200B），
// 让索引按“字”记录（含位置）；前端 src/lib/search-query.mjs 把中文查询改写成逐字的精确短语，
// 等价于子串匹配。dist 里的页面本身不动；零宽空格不可见，结果摘要显示正常。
import * as pagefind from 'pagefind';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const dist = process.argv[2] ?? new URL('../dist/', import.meta.url).pathname;
const CJK = /[\u3400-\u9fff\uf900-\ufaff\u3000-\u303f\uff00-\uffef]/;
const seg = new Intl.Segmenter('zh-CN', { granularity: 'grapheme' });
const ZWSP = '\u200b';

/** 相邻两个字符只要有一侧是中文（或全角标点），就在中间插入零宽空格 */
function segmentText(text) {
  if (!CJK.test(text)) return text;
  let out = '', prev = '';
  for (const { segment } of seg.segment(text)) {
    if (prev && (CJK.test(prev.at(-1)) || CJK.test(segment[0])) && !/\s/.test(prev.at(-1)) && !/\s/.test(segment[0])) out += ZWSP;
    out += segment;
    prev = segment;
  }
  return out;
}
/** 只处理标签之间的文本；跳过 script/style/template 内容 */
export function segmentHtml(html) {
  const parts = html.split(/(<[^>]*>)/);
  let skip = null;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (p.startsWith('<')) {
      const m = /^<(\/?)(script|style|template)\b/i.exec(p);
      if (m) skip = m[1] ? null : m[2].toLowerCase();
      continue;
    }
    if (!skip && p) parts[i] = segmentText(p);
  }
  return parts.join('');
}

const files = [];
(function walk(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    if (e.isDirectory()) { if (e.name !== 'pagefind' && e.name !== '_astro') walk(join(d, e.name)); }
    else if (e.name.endsWith('.html')) files.push(join(d, e.name));
  }
})(dist);

const { index, errors } = await pagefind.createIndex({});
if (!index) throw new Error(`pagefind createIndex 失败：${errors.join('; ')}`);
let pages = 0;
for (const f of files) {
  const r = await index.addHTMLFile({ sourcePath: relative(dist, f), content: segmentHtml(readFileSync(f, 'utf8')) });
  if (r.errors.length) throw new Error(`${f}: ${r.errors.join('; ')}`);
  if (r.file) pages++;
}
const w = await index.writeFiles({ outputPath: join(dist, 'pagefind') });
if (w.errors.length) throw new Error(`pagefind writeFiles: ${w.errors.join('; ')}`);
await pagefind.close();
console.log(`[pagefind] 已索引 ${pages} 个页面（共扫描 ${files.length} 个 HTML，中文按字索引）→ ${relative(process.cwd(), join(dist, 'pagefind'))}/`);
