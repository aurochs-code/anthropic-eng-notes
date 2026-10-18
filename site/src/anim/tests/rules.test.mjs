// 语法与 mermaid 引用规则的单元测试
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findBlocks, parseBlock, validateAnim, validateAnimSteps } from '../rules.mjs';
import { mermaidModel, checkRef } from '../mermaid-model.mjs';

const SEQ = `sequenceDiagram
    autonumber
    participant H as 人类用户
    participant A as 智能体
    H->>A: x
    loop L
        A->>A: y
        opt O
            A->>H: z
        end
    end
    A-->>H: w`;
test('时序图模型：参与者、消息、块', () => {
  const m = mermaidModel(SEQ);
  assert.equal(m.kind, 'sequence');
  assert.deepEqual(m.participants, ['H', 'A']);
  assert.equal(m.messages, 4);
  assert.deepEqual(m.endOrder, [1, 0]);
  assert.equal(m.blocks.length, 2);
  assert.equal(checkRef(m, 'msg:4'), null);
  assert.match(checkRef(m, 'msg:5'), /msg/);
  assert.match(checkRef(m, 'block:3'), /block/);
  assert.match(checkRef(m, 'X'), /X/);
});
test('anim-steps 必须紧跟 mermaid', () => {
  const md = '# t\n\n```mermaid\nflowchart LR\n  a-->b\n```\n\n```anim-steps\nid: x\n```\n\n文字\n\n```anim-steps\nid: y\n```\n';
  const b = findBlocks(md);
  assert.equal(b.length, 2);
  assert.ok(b[0].prevMermaid);
  assert.equal(b[1].prevMermaid, null);
});
test('anim 字段校验带出键名，YAML 错误带行号', () => {
  const errs = validateAnim({ id: 'Bad_Id', component: 'nope', caption: 'c' }, ['function-plot']);
  const keys = errs.map((e) => e.key);
  for (const k of ['id', 'component', 'alt']) assert.ok(keys.includes(k), k);
  const r = parseBlock('id: a\ncaption: [\n');
  assert.ok(r.error && r.line >= 1);
  const e2 = validateAnimSteps({ id: 'a', caption: 'c', steps: [{ text: 't', highlight: ['msg:9'] }] }, 'flowchart LR\n a-->b');
  assert.ok(e2.length);
});
