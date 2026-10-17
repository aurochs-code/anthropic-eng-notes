// 搜索查询处理（浏览器搜索弹窗与 check-site 共用；与 scripts/pagefind-index.mjs 的“逐字索引”配套）
//
// 索引里中文按“字”记录，所以：
// 1. 交给 Pagefind 的查询把中文拆成单字（“上下文工程” → “上 下 文 工 程”），Pagefind 按各字的词频排序、要求各字都出现；
// 2. 再用页面全文做子串过滤：查询里每个中文词都必须在页面里原样连续出现，去掉“字都在但不成词”的误命中。
// 英文词交给 Pagefind 原生处理（含词干），不做过滤。
export const CJK_RE = /[\u3400-\u9fff\uf900-\ufaff]/;
const CJK_RUN = /[\u3400-\u9fff\uf900-\ufaff]+/g;
const ZWSP_RE = /\u200b/g;

/** @returns {{ query: string, tokens: string[] }} query 交给 pagefind.search，tokens 为需整体出现的中文词 */
export function parseQuery(raw) {
  const q = String(raw ?? '').trim().replace(/\s+/g, ' ');
  const tokens = q.match(CJK_RUN) ?? [];
  const query = tokens.length ? q.replace(CJK_RUN, (run) => ` ${[...run].join(' ')} `).replace(/\s+/g, ' ').trim() : q;
  return { query, tokens };
}
/** 去掉索引副本里的零宽空格，得到可读文本 */
export const cleanText = (s) => String(s ?? '').replace(ZWSP_RE, '');
/** 页面文本是否包含全部中文词 */
export const hasAll = (text, tokens) => tokens.every((t) => text.includes(t));
