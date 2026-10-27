/* Unit test for chat-extract (no browser needed). */
import { extractMessages, pairQuestions, matchNodeAnswers } from '../src/app/workbench/chat-extract.js';

function makeSnapshot(nodes) {
  return { nodes: new Map(nodes.map((node, index) => [String(index), node])) };
}

const snapshot = makeSnapshot([
  { kind: 'turn', anchorSeq: 1, data: { turn: 1 } },
  { kind: 'user', anchorSeq: 2, data: { state: { kind: 'user', seq: 2, content: [{ type: 'text', text: '这个月适合签约吗？' }] } } },
  { kind: 'assistant-step', anchorSeq: 3, data: { step: { content: [{ type: 'text', text: '生门落艮八，可成但有阻滞。' }] } } },
  { kind: 'tool-call', anchorSeq: 4, data: { root: { name: 'qimen_pan', callId: 'c1' } } },
  { kind: 'assistant-step', anchorSeq: 5, data: { step: { content: [{ type: 'text', text: '建议先备齐材料。' }] } } },
  { kind: 'user', anchorSeq: 6, data: { state: { kind: 'user', seq: 6, content: [{ type: 'text', text: '今年换工作合适吗？' }] } } },
  { kind: 'assistant-step', anchorSeq: 7, data: { step: { content: [{ type: 'text', text: '流年冲日支，宜上半年落定。' }] } } },
]);

const messages = extractMessages(snapshot);
console.log('messages:', messages.map((m) => `${m.role}:${m.text.slice(0, 12)}`).join(' | '));

const pairs = pairQuestions(messages);
console.log('pairs:', pairs.map((p) => `${p.question.slice(0, 8)} -> ${p.answer.slice(0, 12)}`).join(' | '));

const patches = matchNodeAnswers(
  [
    { id: 'q1', question: '这个月适合签约吗？', answerSummary: '' },
    { id: 'q2', question: '今年换工作合适吗？', answerSummary: '' },
    { id: 'q3', question: '不存在的提问', answerSummary: '' },
  ],
  pairs,
);
console.log('patches:', JSON.stringify(patches, null, 1));

// containment matching: node stores the short question, payload carried context
const contextual = matchNodeAnswers(
  [{ id: 'q4', question: '今日反馈 · 2026-10-27', answerSummary: '' }],
  pairQuestions([
    { seq: 1, role: 'user', text: '你是命理推演助手…\n问题：今日反馈 · 2026-10-27\n输出 3 段' },
    { seq: 2, role: 'assistant', text: '今日主题：宜守。宜整理不宜签约。' },
  ]),
);
console.log('contextual patches:', JSON.stringify(contextual, null, 1));

// reasoning must never leak into the answer summary
const withReasoning = makeSnapshot([
  { kind: 'user', anchorSeq: 2, data: { state: { kind: 'user', seq: 2, content: [{ type: 'text', text: '这个问题怎么选？' }] } } },
  { kind: 'assistant-step', anchorSeq: 3, data: { step: {
    reasoning: 'The user asks how to choose. I should compare options...',
    content: [{ type: 'text', text: '建议选 A，依据是四柱日主偏弱。' }],
  } } },
]);
const reasoningPairs = pairQuestions(extractMessages(withReasoning));
console.log('reasoning pairs:', JSON.stringify(reasoningPairs));
const reasoningOk = reasoningPairs.length === 1
  && reasoningPairs[0].answer.includes('建议选 A')
  && !reasoningPairs[0].answer.includes('The user asks');

const ok = messages.length === 5
  && messages[0].role === 'user'
  && messages[1].role === 'assistant'
  && pairs.length === 2
  && patches.length === 2
  && patches[0].answerSummary.includes('生门')
  && patches[1].answerSummary.includes('流年')
  && contextual.length === 1
  && contextual[0].answerSummary.includes('今日主题')
  && reasoningOk;
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);

