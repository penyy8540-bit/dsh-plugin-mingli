/**
 * 人生轨迹（命途回溯）· 数据模型
 *
 * 字段与 Python 实现 mingli/tools/timeline.py 对齐（全插件统一 snake_case）：
 *   timeline = { version, profile_id, branches: [ { id, name, kind, parent, color,
 *                assumptions, fork_year?, nodes: [ { id, year, month, age, kind,
 *                title, desc, tags, source, confidence, important } ] } ] }
 *
 * 设计约束：
 *  - 纯函数：不修改入参、不读 localStorage、不写 Date.now（唯一例外是 UI 层的默认年份）；
 *  - 返回新对象（branches / nodes 浅拷贝到被修改的那一层）；
 *  - 非法输入抛 Error（中文 message），由 UI 捕获并展示；
 *  - id 规则：节点全局 n1,n2…；分支 b_1,b_2…（跨删除不复用，沿用当前最大序号 +1）。
 */

export const VERSION = 1;
export const ACTUAL_BRANCH_ID = 'actual';
export const ACTUAL_COLOR = '#b8860b';
export const BRANCH_COLORS = ['#1565c0', '#6a1b9a', '#2e7d32', '#c62828'];

export const KINDS = ['event', 'milestone', 'decision', 'turning'];
export const SOURCES = ['user', 'model'];
export const CONFIDENCES = ['high', 'medium', 'low'];

export const KIND_LABELS = { event: '事实', milestone: '里程碑', decision: '抉择', turning: '转折' };
export const SOURCE_LABELS = { user: '用户口述', model: '模型推演' };
export const CONFIDENCE_LABELS = { high: '高置信', medium: '中置信', low: '低置信' };
export const CONFIDENCE_SHORT = { high: '高', medium: '中', low: '低' };

/** 主轨之外的分支配色（按创建顺序轮换，与契约一致）。 */
export function branchColorAt(index) {
  const i = Number.isFinite(index) ? Math.floor(index) : 0;
  return BRANCH_COLORS[((i % BRANCH_COLORS.length) + BRANCH_COLORS.length) % BRANCH_COLORS.length];
}

/** 分支颜色（非法/缺失时回退到轮换色；主轨回退到金色）。 */
export function branchColor(branch, laneIndex = 0) {
  const color = typeof branch?.color === 'string' ? branch.color.trim() : '';
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return color;
  return branch?.kind === 'actual' ? ACTUAL_COLOR : branchColorAt(laneIndex - 1);
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function toInt(value, label, { min = -Infinity, max = Infinity, required = true } = {}) {
  if (value === '' || value === null || value === undefined) {
    if (required) throw new Error(`请填写${label}`);
    return null;
  }
  const num = Number(value);
  if (!Number.isInteger(num)) throw new Error(`${label}必须是整数`);
  if (num < min || num > max) throw new Error(`${label}需在 ${min}–${max} 之间`);
  return num;
}

function toText(value, fallback = '') {
  return typeof value === 'string' ? value : value === null || value === undefined ? fallback : String(value);
}

function toTags(value) {
  const list = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[,，、\s]+/) : [];
  return list.map((tag) => toText(tag).trim()).filter(Boolean);
}

function cloneBranch(branch) {
  return {
    ...branch,
    assumptions: Array.isArray(branch?.assumptions) ? [...branch.assumptions] : [],
    nodes: Array.isArray(branch?.nodes) ? branch.nodes.map((node) => ({ ...node })) : [],
  };
}

/** 浅拷贝到 branches/nodes 层（纯函数操作的基础）。 */
export function cloneTimeline(timeline) {
  if (!isPlainObject(timeline)) return null;
  return {
    ...timeline,
    branches: Array.isArray(timeline.branches) ? timeline.branches.filter(isPlainObject).map(cloneBranch) : [],
  };
}

/** 节点日期展示：`2015-06` / `2015`；所有 UI 统一用它。 */
export function formatNodeDate(node) {
  const year = Number(node?.year);
  if (!Number.isFinite(year)) return '';
  const month = Number(node?.month);
  return Number.isInteger(month) && month >= 1 && month <= 12
    ? `${year}-${String(month).padStart(2, '0')}`
    : `${year}`;
}

/** 空时间线：只含主轨「实际人生」。profileId 可为 null。 */
export function createEmptyTimeline(profileId) {
  return {
    version: VERSION,
    profile_id: profileId ?? null,
    branches: [
      {
        id: ACTUAL_BRANCH_ID,
        name: '实际人生',
        kind: 'actual',
        parent: null,
        color: ACTUAL_COLOR,
        assumptions: [],
        nodes: [],
      },
    ],
  };
}

/** 按 (year, month, id) 排序节点（不改入参）。 */
export function sortNodes(nodes) {
  return [...(Array.isArray(nodes) ? nodes : [])].sort((a, b) => {
    const ya = Number(a?.year) || 0;
    const yb = Number(b?.year) || 0;
    if (ya !== yb) return ya - yb;
    const ma = Number(a?.month) || 0;
    const mb = Number(b?.month) || 0;
    if (ma !== mb) return ma - mb;
    return String(a?.id ?? '').localeCompare(String(b?.id ?? ''));
  });
}

/** 取分支（不存在返回 null）。 */
export function getBranch(timeline, branchId = ACTUAL_BRANCH_ID) {
  const list = Array.isArray(timeline?.branches) ? timeline.branches : [];
  return list.find((branch) => branch?.id === branchId) ?? null;
}

/** 取节点（可跨分支）。返回 { branch, node } 或 null。 */
export function findNode(timeline, nodeId) {
  const list = Array.isArray(timeline?.branches) ? timeline.branches : [];
  for (const branch of list) {
    const node = (branch.nodes || []).find((item) => item?.id === nodeId);
    if (node) return { branch, node };
  }
  return null;
}

function maxNodeNumber(timeline) {
  let max = 0;
  for (const branch of Array.isArray(timeline?.branches) ? timeline.branches : []) {
    for (const node of Array.isArray(branch?.nodes) ? branch.nodes : []) {
      const match = /^n(\d+)$/.exec(String(node?.id ?? ''));
      if (match) max = Math.max(max, Number(match[1]));
    }
  }
  return max;
}

function maxBranchNumber(timeline) {
  let max = 0;
  for (const branch of Array.isArray(timeline?.branches) ? timeline.branches : []) {
    const match = /^b_(\d+)$/.exec(String(branch?.id ?? ''));
    if (match) max = Math.max(max, Number(match[1]));
  }
  return max;
}

export function nextNodeId(timeline) {
  return `n${maxNodeNumber(timeline) + 1}`;
}

export function nextBranchId(timeline) {
  return `b_${maxBranchNumber(timeline) + 1}`;
}

/** 周岁口径：year − 出生年（对齐契约，不扣生日）。solar 无效时返回 null。 */
export function ageAt(profile, year) {
  const birthYear = Number.parseInt(String(profile?.solar ?? '').slice(0, 4), 10);
  const target = Number(year);
  if (!Number.isFinite(birthYear) || !Number.isFinite(target)) return null;
  return target - birthYear;
}

/**
 * 规范化时间线（容错手工/旧版数据，不修改入参）：
 * 补齐主轨与默认字段、纠正非法枚举、重算缺失年龄、分配缺失 id、按年份排序。
 * profile 仅用于补 age（可省略）。
 */
export function normalizeTimeline(timeline, profile = null) {
  const base = isPlainObject(timeline) ? timeline : {};
  const profileId = base.profile_id ?? profile?.id ?? null;
  let branches = Array.isArray(base.branches) ? base.branches.filter(isPlainObject) : [];
  branches = branches.map((branch) => cloneBranch(branch));
  if (!branches.some((branch) => branch.kind === 'actual')) {
    branches.unshift(cloneBranch(createEmptyTimeline(profileId).branches[0]));
  }
  // 主轨置顶，其余保持原顺序（稳定排序）。
  branches.sort((a, b) => (a.kind === 'actual' ? 0 : 1) - (b.kind === 'actual' ? 0 : 1));

  let nodeSeq = 0;
  for (const branch of branches) {
    for (const node of branch.nodes) {
      const match = /^n(\d+)$/.exec(String(node?.id ?? ''));
      if (match) nodeSeq = Math.max(nodeSeq, Number(match[1]));
    }
  }

  branches = branches.map((branch, index) => {
    const id = toText(branch.id, '') || (index === 0 ? ACTUAL_BRANCH_ID : `b_${index}`);
    const isActual = branch.kind === 'actual';
    const color = /^#[0-9a-fA-F]{6}$/.test(toText(branch.color, '')) ? branch.color : branchColorAt(index - 1);
    const nodes = [];
    for (const node of branch.nodes) {
      const year = Number(node?.year);
      // 无合法年份的节点忽略（与 Python 版一致，避免整条时间线不可用）。
      if (!Number.isInteger(year)) continue;
      const monthNum = Number(node?.month);
      const month = Number.isInteger(monthNum) && monthNum >= 1 && monthNum <= 12 ? monthNum : null;
      let nodeId = toText(node?.id, '');
      if (!/^n\d+$/.test(nodeId)) nodeId = `n${(nodeSeq += 1)}`;
      const kind = KINDS.includes(node?.kind) ? node.kind : 'event';
      const source = SOURCES.includes(node?.source) ? node.source : 'user';
      const confidence = CONFIDENCES.includes(node?.confidence) ? node.confidence : 'medium';
      let age = Number(node?.age);
      if (!Number.isInteger(age)) age = profile ? ageAt(profile, year) : null;
      nodes.push({
        id: nodeId,
        year,
        month,
        age: Number.isInteger(age) ? age : null,
        kind,
        title: toText(node?.title, '').trim(),
        desc: toText(node?.desc, ''),
        tags: toTags(node?.tags),
        source,
        confidence,
        important: Boolean(node?.important),
      });
    }
    return {
      id,
      name: toText(branch.name, '') || (isActual ? '实际人生' : id),
      kind: isActual ? 'actual' : 'branch',
      parent: isActual ? null : toText(branch.parent, '') || ACTUAL_BRANCH_ID,
      color: isActual ? ACTUAL_COLOR : color,
      assumptions: (Array.isArray(branch.assumptions) ? branch.assumptions : []).map((item) => toText(item).trim()).filter(Boolean),
      fork_year: isActual ? null : Number.isInteger(Number(branch.fork_year)) ? Number(branch.fork_year) : null,
      nodes: sortNodes(nodes),
    };
  });
  return { ...base, version: VERSION, profile_id: profileId, branches };
}

/**
 * 添加节点（返回新 timeline，不修改入参）。
 * @param {object} timeline
 * @param {{branchId?:string, year:number|string, month?:number|string|null,
 *          title:string, kind?:string, desc?:string, tags?:string[]|string,
 *          source?:string, confidence?:string, important?:boolean, age?:number}} opts
 */
export function addNode(timeline, opts = {}) {
  const base = cloneTimeline(timeline) ?? createEmptyTimeline(null);
  if (!base.branches.some((branch) => branch.kind === 'actual')) {
    base.branches.unshift(cloneBranch(createEmptyTimeline(base.profile_id).branches[0]));
  }
  const branchId = toText(opts.branchId, ACTUAL_BRANCH_ID) || ACTUAL_BRANCH_ID;
  const index = base.branches.findIndex((branch) => branch.id === branchId);
  assert(index >= 0, `分支 ${branchId} 不存在`);

  const year = toInt(opts.year, '年份', { min: 1, max: 9999 });
  const month = opts.month === '' || opts.month === null || opts.month === undefined
    ? null
    : toInt(opts.month, '月份', { min: 1, max: 12 });
  const title = toText(opts.title, '').trim();
  assert(title, '请填写事件标题');
  const kind = toText(opts.kind, 'event') || 'event';
  assert(KINDS.includes(kind), `节点类型必须是 ${KINDS.join(' / ')}`);
  const source = toText(opts.source, 'user') || 'user';
  assert(SOURCES.includes(source), `来源必须是 ${SOURCES.join(' / ')}`);
  const confidence = toText(opts.confidence, 'medium') || 'medium';
  assert(CONFIDENCES.includes(confidence), `置信度必须是 ${CONFIDENCES.join(' / ')}`);
  const age = Number.isInteger(Number(opts.age)) ? Number(opts.age) : null;

  const node = {
    id: nextNodeId(base),
    year,
    month,
    age,
    kind,
    title,
    desc: toText(opts.desc, ''),
    tags: toTags(opts.tags),
    source,
    confidence,
    important: Boolean(opts.important),
  };
  const branch = base.branches[index];
  base.branches[index] = { ...branch, nodes: sortNodes([...branch.nodes, node]) };
  return base;
}

/**
 * 创建假设分支（返回新 timeline）。
 * @param {{name:string, forkYear:number|string, assumptions?:string[]|string}} opts
 */
export function createBranch(timeline, opts = {}) {
  const base = cloneTimeline(timeline) ?? createEmptyTimeline(null);
  const name = toText(opts.name, '').trim();
  assert(name, '请填写分支名称');
  assert(!base.branches.some((branch) => branch.name === name), `分支「${name}」已存在，请换一个名字`);
  const forkYear = toInt(opts.forkYear, '分叉年份', { min: 1, max: 9999 });
  const assumptions = toTags(opts.assumptions);
  const branchCount = base.branches.filter((branch) => branch.kind !== 'actual').length;
  const branch = {
    id: nextBranchId(base),
    name,
    kind: 'branch',
    parent: ACTUAL_BRANCH_ID,
    color: branchColorAt(branchCount),
    assumptions,
    fork_year: forkYear,
    nodes: [],
  };
  return { ...base, branches: [...base.branches, branch] };
}

function normalizeRemoveArgs(nodeIdOrRef, branchIdMaybe) {
  if (isPlainObject(nodeIdOrRef)) {
    return {
      nodeId: toText(nodeIdOrRef.nodeId, ''),
      branchId: toText(nodeIdOrRef.branchId, ACTUAL_BRANCH_ID) || ACTUAL_BRANCH_ID,
    };
  }
  return { nodeId: toText(nodeIdOrRef, ''), branchId: toText(branchIdMaybe, ACTUAL_BRANCH_ID) || ACTUAL_BRANCH_ID };
}

/** 删除节点：removeNode(timeline, nodeId, branchId?) 或 removeNode(timeline, {nodeId, branchId})。 */
export function removeNode(timeline, nodeIdOrRef, branchIdMaybe) {
  const base = cloneTimeline(timeline);
  if (!base) return timeline;
  const { nodeId, branchId } = normalizeRemoveArgs(nodeIdOrRef, branchIdMaybe);
  const index = base.branches.findIndex((branch) => branch.id === branchId);
  if (index < 0) return timeline;
  const branch = base.branches[index];
  if (!branch.nodes.some((node) => node.id === nodeId)) return timeline;
  base.branches[index] = { ...branch, nodes: branch.nodes.filter((node) => node.id !== nodeId) };
  return base;
}

/** 删除分支（主轨不可删）。 */
export function removeBranch(timeline, branchId) {
  const id = toText(branchId, '');
  assert(id !== ACTUAL_BRANCH_ID, '主轨「实际人生」不能删除');
  const base = cloneTimeline(timeline);
  if (!base) return timeline;
  assert(base.branches.some((branch) => branch.id === id), `分支 ${id} 不存在`);
  return { ...base, branches: base.branches.filter((branch) => branch.id !== id) };
}

/**
 * 更新分支（名称 / 假设 / 分叉年份 / 颜色，返回新 timeline）。
 * @param {object} patch {name?, assumptions?, fork_year?, color?}
 */
export function updateBranch(timeline, branchId, patch = {}) {
  const base = cloneTimeline(timeline);
  if (!base) return timeline;
  const index = base.branches.findIndex((branch) => branch.id === branchId);
  assert(index >= 0, `分支 ${branchId} 不存在`);
  const branch = base.branches[index];
  const next = { ...branch };
  if (patch.name !== undefined) {
    const name = toText(patch.name, '').trim();
    assert(name, '请填写分支名称');
    assert(!base.branches.some((item) => item.id !== branchId && item.name === name), `分支「${name}」已存在`);
    next.name = name;
  }
  if (patch.assumptions !== undefined) next.assumptions = toTags(patch.assumptions);
  if (patch.fork_year !== undefined) next.fork_year = toInt(patch.fork_year, '分叉年份', { min: 1, max: 9999 });
  if (patch.color !== undefined) {
    const color = toText(patch.color, '');
    assert(/^#[0-9a-fA-F]{6}$/.test(color), '颜色需为 #RRGGBB');
    next.color = color;
  }
  base.branches[index] = next;
  return base;
}

/** 便捷函数：只改分支名。 */
export function updateBranchName(timeline, branchId, name) {
  return updateBranch(timeline, branchId, { name });
}

/** 统计信息（供页头徽标/空态使用）。 */
export function stats(timeline) {
  const branches = Array.isArray(timeline?.branches) ? timeline.branches : [];
  const kindCounts = Object.fromEntries(KINDS.map((kind) => [kind, 0]));
  const sourceCounts = Object.fromEntries(SOURCES.map((source) => [source, 0]));
  const confidenceCounts = Object.fromEntries(CONFIDENCES.map((confidence) => [confidence, 0]));
  const byBranch = [];
  let nodeCount = 0;
  let importantCount = 0;
  let nodeWithYear = 0;
  let yearMin = null;
  let yearMax = null;
  for (const branch of branches) {
    const nodes = Array.isArray(branch?.nodes) ? branch.nodes : [];
    byBranch.push({ id: branch?.id, name: branch?.name, kind: branch?.kind, count: nodes.length });
    for (const node of nodes) {
      if (!Number.isInteger(Number(node?.year))) continue;
      nodeCount += 1;
      nodeWithYear += 1;
      if (node.important) importantCount += 1;
      if (kindCounts[node.kind] !== undefined) kindCounts[node.kind] += 1;
      if (sourceCounts[node.source] !== undefined) sourceCounts[node.source] += 1;
      if (confidenceCounts[node.confidence] !== undefined) confidenceCounts[node.confidence] += 1;
      const year = Number(node.year);
      yearMin = yearMin === null ? year : Math.min(yearMin, year);
      yearMax = yearMax === null ? year : Math.max(yearMax, year);
    }
  }
  return {
    laneCount: branches.length,
    branchCount: branches.filter((branch) => branch?.kind !== 'actual').length,
    nodeCount,
    importantCount,
    nodeWithYear,
    kindCounts,
    sourceCounts,
    confidenceCounts,
    yearMin,
    yearMax,
    spanYears: yearMin !== null && yearMax !== null ? yearMax - yearMin + 1 : 0,
    byBranch,
    isEmpty: nodeCount === 0,
  };
}

const model = {
  VERSION,
  ACTUAL_BRANCH_ID,
  ACTUAL_COLOR,
  BRANCH_COLORS,
  KINDS,
  SOURCES,
  CONFIDENCES,
  KIND_LABELS,
  SOURCE_LABELS,
  CONFIDENCE_LABELS,
  CONFIDENCE_SHORT,
  branchColor,
  branchColorAt,
  cloneTimeline,
  createBranch,
  createEmptyTimeline,
  findNode,
  formatNodeDate,
  getBranch,
  nextBranchId,
  nextNodeId,
  normalizeTimeline,
  addNode,
  ageAt,
  removeBranch,
  removeNode,
  sortNodes,
  stats,
  updateBranch,
  updateBranchName,
};

export default model;
