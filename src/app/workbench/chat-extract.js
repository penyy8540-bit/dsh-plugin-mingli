/**
 * Best-effort extraction of user/assistant text from a DSH Chat snapshot.
 *
 * The Chat view store exposes `snapshot.nodes` (a Map of view nodes). Different
 * node kinds carry text in different places, so this walks defensively instead
 * of hard-coding one shape. Everything is read-only and bounded.
 */

const MAX_DEPTH = 4;
const MAX_TEXT = 4000;
const SKIP_KEYS = new Set(['prompt', 'system', 'systemPrompt', 'instructions', 'toolName', 'callId', 'id', 'key', 'name', 'type', 'role', 'kind', 'source', 'reason', 'code', 'phase', 'status',
  // Reasoning / thinking blocks must never be mistaken for the final answer.
  'reasoning', 'reasoningContent', 'thinking', 'thought', 'thoughts', 'analysis', 'chainOfThought', 'cot']);
const ROLE_WORDS = new Set(['user', 'assistant', 'system', 'developer', 'tool', 'text', 'complete', 'start', 'end']);

function collectText(value, depth, out) {
  if (out.length >= 40 || depth > MAX_DEPTH || value === null || value === undefined) return;
  if (typeof value === 'string') {
    if (value.length > 1 && value.length <= MAX_TEXT && !ROLE_WORDS.has(value.trim().toLowerCase())) out.push(value);
    return;
  }
  if (typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value.slice(0, 24)) {
      if (item && typeof item === 'object' && item.type === 'text' && typeof item.text === 'string') out.push(item.text);
      else collectText(item, depth + 1, out);
      if (out.length >= 40) break;
    }
    return;
  }
  if (value.type === 'text' && typeof value.text === 'string') {
    out.push(value.text);
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (SKIP_KEYS.has(key)) continue;
    collectText(child, depth + 1, out);
    if (out.length >= 40) break;
  }
}

function nodeRole(node) {
  const kind = String(node?.kind || '');
  const stateKind = String(node?.data?.state?.kind || '');
  if (kind === 'user' || kind === 'input-message' || kind === 'user-message' || stateKind === 'user') return 'user';
  if (kind === 'assistant-step' || kind === 'assistant' || stateKind === 'assistant') return 'assistant';
  if (kind === 'message') {
    const tag = JSON.stringify(node?.data?.source || node?.data?.state?.source || {});
    return /assistant|agent/i.test(tag) ? 'assistant' : 'user';
  }
  return null;
}

/** @returns {{seq:number, role:'user'|'assistant', text:string, nodeId:string|null}[]} */
export function extractMessages(snapshot) {
  const nodes = snapshot?.nodes;
  if (!nodes || typeof nodes.values !== 'function') return [];
  const result = [];
  let index = 0;
  for (const node of nodes.values()) {
    index += 1;
    const role = nodeRole(node);
    if (!role) continue;
    const out = [];
    const data = node?.data ?? node;
    if (role === 'assistant') {
      // Prefer the explicit answer payload; the step object also carries
      // reasoning/tool blocks that must not leak into the summary.
      const preferred = data?.step?.content ?? data?.content ?? data?.step?.text ?? data?.step?.answer ?? data?.answer ?? data?.text;
      if (preferred !== undefined) collectText(preferred, 0, out);
    }
    if (!out.length) collectText(data, 0, out);
    const text = out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    if (!text) continue;
    const seq = Number(node?.anchorSeq ?? node?.data?.state?.seq ?? node?.data?.seq ?? index);
    result.push({ seq, role, text: text.slice(0, MAX_TEXT), nodeId: node?.id ? String(node.id) : null });
  }
  return result.sort((a, b) => a.seq - b.seq);
}

/** Pair each user message with the next assistant message after it. */
export function pairQuestions(messages) {
  const pairs = [];
  let pending = null;
  for (const message of messages) {
    if (message.role === 'user') {
      pending = { question: message.text, seq: message.seq, answer: '' };
      pairs.push(pending);
      continue;
    }
    if (message.role === 'assistant' && pending && !pending.answer) pending.answer = message.text;
  }
  return pairs.filter((pair) => pair.question);
}

const normalize = (text) => String(text || '').replace(/\s+/g, ' ').trim().slice(0, 120);

/**
 * Match stored question nodes against the current transcript.
 * @param {Array} nodes stored nodes (with question/answerSummary)
 * @param {Array} pairs output of pairQuestions
 * @returns {{id:string, question:string, answerSummary:string}[]} patches
 */
export function matchNodeAnswers(nodes, pairs) {
  const patches = [];
  const normalizedPairs = (pairs || []).map((pair) => ({ ...pair, key: normalize(pair.question) }));
  for (const node of nodes || []) {
    const wanted = normalize(node?.question);
    if (!wanted) continue;
    // Exact match first; otherwise fall back to containment so questions sent
    // with an injected context block (payload = context + question) still match.
    let hit = normalizedPairs.find((pair) => pair.key === wanted);
    if (!hit) hit = normalizedPairs.find((pair) => pair.key.includes(wanted) || wanted.includes(pair.key));
    if (!hit || !hit.answer) continue;
    const summary = hit.answer.replace(/\s+/g, ' ').trim().slice(0, 240);
    if (summary && summary !== node.answerSummary) {
      patches.push({ id: node.id, question: node.question, answerSummary: summary });
    }
  }
  return patches;
}
