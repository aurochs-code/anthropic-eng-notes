// 标签白名单（CONTENT-GUIDE「现行标签表」）。笔记、资源、论文笔记的 tags 都应从这里选；
// check-site.mjs 对论文笔记强制检查，审计脚本对全部内容列出白名单外的标签。新增标签时同步改 CONTENT-GUIDE。
export const TAG_WHITELIST = [
  'evals', 'agents', 'claude-code', 'security', 'benchmarks', 'coding-agents', 'mcp', 'sandbox', 'tool-use',
  'agent-frameworks', 'agent-skills', 'harness', 'infrastructure', 'long-running-agents', 'multi-agent',
  'prompt-engineering', 'prompt-injection', 'tool-design', 'workflows', 'code-execution', 'context-window',
  'human-in-the-loop', 'memory', 'model-capabilities', 'permissions', 'planning', 'production',
  'progressive-disclosure', 'subagents', 'testing', 'token-efficiency', 'compaction', 'context-engineering',
  'extended-thinking', 'failure-modes', 'papers', 'postmortem', 'prompt-caching', 'retrieval', 'ml-foundations',
  // 2026-10-18 为论文笔记新增
  'transformer', 'attention', 'reinforcement-learning', 'rlhf', 'scaling-laws', 'sequence-models',
];
