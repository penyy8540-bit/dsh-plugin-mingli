/**
 * Mingli local storage layer (profiles + life timeline).
 * Everything stays in this browser's localStorage, namespaced under "mingli.".
 */
const PROFILES_KEY = 'mingli.profiles.v1';

function safeParse(text, fallback) {
  try {
    const value = JSON.parse(text);
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

export function uid(prefix = 'p') {
  const bytes = new Uint8Array(4);
  (globalThis.crypto?.getRandomValues?.(bytes)) || bytes.set([1, 2, 3, 4]);
  return `${prefix}_${[...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}

export function loadState() {
  const raw = globalThis.localStorage?.getItem(PROFILES_KEY);
  const state = safeParse(raw || 'null', null);
  if (!state || !Array.isArray(state.profiles)) return { profiles: [], activeId: null };
  return {
    profiles: state.profiles.filter((p) => p && typeof p.solar === 'string'),
    activeId: state.activeId ?? state.profiles[0]?.id ?? null,
  };
}

export function saveState(state) {
  try {
    globalThis.localStorage?.setItem(PROFILES_KEY, JSON.stringify(state));
  } catch {
    /* storage full or blocked: keep the session working in memory */
  }
  return state;
}

export function upsertProfile(profile) {
  const state = loadState();
  const now = new Date().toISOString();
  const next = { ...profile };
  if (!next.id) next.id = uid('p');
  next.updated_at = now;
  if (!next.created_at) next.created_at = now;
  const index = state.profiles.findIndex((p) => p.id === next.id);
  if (index >= 0) state.profiles[index] = { ...state.profiles[index], ...next };
  else state.profiles.unshift(next);
  state.activeId = next.id;
  saveState(state);
  return next;
}

export function removeProfile(id) {
  const state = loadState();
  state.profiles = state.profiles.filter((p) => p.id !== id);
  if (state.activeId === id) state.activeId = state.profiles[0]?.id ?? null;
  saveState(state);
  try { globalThis.localStorage?.removeItem(`mingli.timeline.${id}`); } catch { /* ignore */ }
  return state;
}

export function getProfile(id) {
  const state = loadState();
  return state.profiles.find((p) => p.id === id) ?? null;
}

export function setActiveProfile(id) {
  const state = loadState();
  state.activeId = id;
  saveState(state);
  return state;
}

export function getTimeline(profileId) {
  const raw = globalThis.localStorage?.getItem(`mingli.timeline.${profileId}`);
  const parsed = safeParse(raw || 'null', null);
  return parsed && Array.isArray(parsed.branches) ? parsed : emptyTimeline(profileId);
}

export function emptyTimeline(profileId) {
  return {
    version: 1,
    profile_id: profileId,
    updated_at: new Date().toISOString(),
    branches: [{
      id: 'actual',
      name: '实际人生',
      kind: 'actual',
      parent: null,
      color: '#b8860b',
      assumptions: [],
      nodes: [],
    }],
  };
}

export function saveTimeline(profileId, timeline) {
  const value = { ...timeline, profile_id: profileId, updated_at: new Date().toISOString() };
  try {
    globalThis.localStorage?.setItem(`mingli.timeline.${profileId}`, JSON.stringify(value));
  } catch { /* ignore */ }
  return value;
}

export function copyText(text) {
  try {
    if (navigator?.clipboard?.writeText) return navigator.clipboard.writeText(text);
  } catch { /* fall through */ }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
    return Promise.resolve();
  } catch {
    return Promise.reject(new Error('copy failed'));
  }
}

// ---------------------------------------------------------------- 提问节点
// 每次提问一条节点，挂在命主下，供工作台「历史提问 / 收藏 / 搜索」使用。

export function nodesKey(profileId) {
  return `mingli.nodes.${profileId}`;
}

export function readNodes(profileId) {
  try {
    const raw = globalThis.localStorage?.getItem(nodesKey(profileId));
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed?.nodes) ? parsed.nodes : [];
  } catch {
    return [];
  }
}

export function writeNodes(profileId, nodes) {
  try {
    globalThis.localStorage?.setItem(nodesKey(profileId), JSON.stringify({ version: 1, nodes: nodes.slice(0, 500) }));
  } catch { /* storage full: keep the UI working */ }
  return nodes;
}

export function addQuestionNode(profileId, node) {
  const nodes = readNodes(profileId);
  const next = [node, ...nodes];
  writeNodes(profileId, next);
  return node;
}

export function updateQuestionNode(profileId, id, patch) {
  const nodes = readNodes(profileId).map((node) => (node.id === id ? { ...node, ...patch } : node));
  writeNodes(profileId, nodes);
  return nodes;
}

export function removeQuestionNode(profileId, id) {
  const nodes = readNodes(profileId).filter((node) => node.id !== id);
  writeNodes(profileId, nodes);
  return nodes;
}

// ---------------------------------------------------------------- 每日黄历存档
// 每天生成一份快照（命主维度），供「每日黄历」历史回看。

export function dailyHistoryKey(profileId) {
  return `mingli.daily.${profileId}`;
}

export function readDailyHistory(profileId) {
  try {
    const raw = globalThis.localStorage?.getItem(dailyHistoryKey(profileId));
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed.days === 'object' && parsed.days ? parsed.days : {};
  } catch {
    return {};
  }
}

export function saveDailyRecord(profileId, record) {
  if (!profileId || !record?.date) return null;
  const days = readDailyHistory(profileId);
  days[record.date] = record;
  const keys = Object.keys(days).sort();
  while (keys.length > 366) delete days[keys.shift()];
  try {
    globalThis.localStorage?.setItem(dailyHistoryKey(profileId), JSON.stringify({ version: 1, days }));
  } catch { /* storage full: keep current UI working */ }
  return record;
}
