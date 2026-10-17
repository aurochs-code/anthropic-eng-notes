// 学习路线阶段定义：按笔记 order 区间划分。改阶段只需改这里。
export const STAGES = [
  { n: 1, name: '入门', goal: '建立“LLM + 工具循环”的直觉，能调 API、写提示、定义工具', from: 1, to: 4 },
  { n: 2, name: '体系', goal: '建立完整概念框架：规划、记忆、工具、检索、MCP、评测、多智能体', from: 5, to: 16 },
  { n: 3, name: '实战', goal: '面向生产：长任务 harness、控制流、安全隔离、评测闭环', from: 17, to: 23 },
  { n: 4, name: '前沿', goal: '规模化后的可靠性与基础设施，建立持续跟进的信息源', from: 24, to: 26 },
] as const;
export const stageOfOrder = (order: number) => STAGES.find((s) => order >= s.from && order <= s.to)?.n ?? STAGES.length;
export const stageName = (n?: number) => STAGES.find((s) => s.n === n)?.name ?? '';
