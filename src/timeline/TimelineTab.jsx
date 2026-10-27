/**
 * 人生轨迹 · 轨迹页（录入 / 分支切换 / 时间线 / 列表 / 空态）
 *
 * props: { profile, timeline, bazi, onChange }
 *  - profile：命主档案（store 的 Profile，可为 null）；
 *  - timeline：§4 轨迹数据（可为 null/旧数据，组件内部会 normalizeTimeline 容错）；
 *  - bazi：可选，八字数据或 envelope，用于时间线背景叠加「大运色带」；
 *  - onChange(nextTimeline)：所有写操作都通过它交给父组件持久化（本组件不读 localStorage）。
 */
import React from 'react';

import TimelineSvg from './TimelineSvg.jsx';
import {
  ACTUAL_BRANCH_ID,
  CONFIDENCES,
  CONFIDENCE_LABELS,
  KINDS,
  KIND_LABELS,
  SOURCES,
  SOURCE_LABELS,
  addNode,
  ageAt,
  branchColor,
  createBranch,
  formatNodeDate,
  normalizeTimeline,
  removeBranch,
  removeNode,
  sortNodes,
  stats,
} from './model.js';

const KIND_COLOR = {
  event: 'var(--ml-muted)',
  milestone: 'var(--ml-gold)',
  decision: 'var(--ml-indigo)',
  turning: 'var(--ml-cinnabar)',
};

const GENDER_LABEL = { male: '男', female: '女' };

const EMPTY_FORM = {
  year: '',
  month: '',
  title: '',
  kind: 'event',
  desc: '',
  tags: '',
  source: 'user',
  confidence: 'medium',
  important: false,
};

const EMPTY_BRANCH_FORM = { name: '', forkYear: '', assumptions: '' };

const S = {
  root: { display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 8 },
  header: { position: 'relative', display: 'flex', flexWrap: 'wrap', gap: '10px 18px', alignItems: 'flex-end' },
  headerMain: { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 200 },
  name: { fontFamily: 'var(--ml-serif)', fontSize: 22, letterSpacing: '0.04em' },
  meta: { display: 'flex', flexWrap: 'wrap', gap: '4px 14px', fontSize: 12.5, color: 'var(--ml-muted)' },
  stats: { display: 'flex', flexWrap: 'wrap', gap: 8, marginLeft: 'auto' },
  stat: { display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 58, padding: '5px 10px', border: '1px solid var(--ml-line)', borderRadius: 10, background: 'var(--ml-surface)' },
  statValue: { fontFamily: 'var(--ml-serif)', fontSize: 17, lineHeight: 1.1, color: 'var(--ml-gold)' },
  statLabel: { fontSize: 10.5, color: 'var(--ml-muted)', letterSpacing: '0.06em' },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  chip: {
    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 12px', borderRadius: 20,
    border: '1px solid var(--ml-line)', background: 'var(--ml-surface)', fontSize: 12.5, color: 'var(--ml-ink)',
  },
  chipActive: { borderColor: 'var(--ml-gold-line)', background: 'var(--ml-gold-soft)', fontWeight: 600 },
  chipDot: { width: 8, height: 8, borderRadius: '50%', flex: '0 0 auto' },
  chipCount: { fontSize: 11, color: 'var(--ml-muted)' },
  sectionHead: { display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  sectionTitle: { fontFamily: 'var(--ml-serif)', fontSize: 15, fontWeight: 600, letterSpacing: '0.08em' },
  hint: { fontSize: 11.5, color: 'var(--ml-muted)', lineHeight: 1.6 },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 },
  actions: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  error: { color: 'var(--ml-cinnabar)', fontSize: 12 },
  list: { display: 'flex', flexDirection: 'column', gap: 0 },
  listItem: { display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 2px', borderTop: '1px dashed var(--ml-line)' },
  listItemFirst: { borderTop: 0 },
  listMain: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 },
  listTop: { display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: '4px 8px' },
  when: { fontSize: 12, color: 'var(--ml-muted)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' },
  title: { fontSize: 14.5, fontWeight: 600, overflowWrap: 'anywhere' },
  metaLine: { fontSize: 11.5, color: 'var(--ml-muted)' },
  desc: { fontSize: 12.5, color: 'var(--ml-muted)', lineHeight: 1.6, overflowWrap: 'anywhere' },
  tags: { display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 2 },
  tag: { fontSize: 11, color: 'var(--ml-muted)', background: 'var(--ml-gold-soft)', border: '1px solid var(--ml-gold-line)', borderRadius: 10, padding: '0 7px' },
  empty: { display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', textAlign: 'center', padding: '22px 12px', color: 'var(--ml-muted)', fontSize: 12.5 },
  emptyTitle: { fontFamily: 'var(--ml-serif)', fontSize: 14, color: 'var(--ml-ink)' },
  steps: { margin: '4px 0 0', paddingLeft: 20, textAlign: 'left', lineHeight: 1.9 },
  inputRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  badge: { fontSize: 11, padding: '0 7px', borderRadius: 10, border: '1px solid currentColor', lineHeight: 1.7, whiteSpace: 'nowrap' },
  star: { color: 'var(--ml-gold)' },
  placeholder: { padding: '18px 0', textAlign: 'center', color: 'var(--ml-muted)', fontSize: 13 },
};

function kindOptions() {
  return KINDS.map((kind) => ({ value: kind, label: KIND_LABELS[kind] }));
}

function branchNodeCount(branch) {
  return Array.isArray(branch?.nodes) ? branch.nodes.length : 0;
}

function Field({ label, children, htmlFor }) {
  return (
    <label className="ml-field" htmlFor={htmlFor}>
      <span className="ml-label">{label}</span>
      {children}
    </label>
  );
}

function EmptyGuide() {
  return (
    <div className="ml-card" style={S.empty}>
      <span style={S.emptyTitle}>从一条真实经历开始</span>
      <span>先记录实际发生过的事，再尝试「如果当时……」的假设分支。</span>
      <ol style={S.steps}>
        <li>在下面「录入事件」填年份 + 一句话标题（如 2016 毕业入职）。</li>
        <li>用类型区分事实 / 里程碑 / 抉择 / 转折，重要的节点可勾选「重要」。</li>
        <li>想看另一种可能？新建一个「假设分支」，从某一年分叉出去。</li>
      </ol>
    </div>
  );
}

export default function TimelineTab({ profile, timeline, bazi, onChange }) {
  const normalized = React.useMemo(() => normalizeTimeline(timeline, profile), [timeline, profile]);
  const summary = React.useMemo(() => stats(normalized), [normalized]);
  const branches = normalized.branches;

  const [activeBranchId, setActiveBranchId] = React.useState(ACTUAL_BRANCH_ID);
  const [form, setForm] = React.useState(() => ({ ...EMPTY_FORM, year: String(new Date().getFullYear()) }));
  const [branchForm, setBranchForm] = React.useState(EMPTY_BRANCH_FORM);
  const [error, setError] = React.useState('');
  const [branchError, setBranchError] = React.useState('');

  const activeBranch = branches.find((branch) => branch.id === activeBranchId) ?? branches[0];
  React.useEffect(() => {
    if (!branches.some((branch) => branch.id === activeBranchId)) setActiveBranchId(branches[0]?.id ?? ACTUAL_BRANCH_ID);
  }, [branches, activeBranchId]);

  const activeNodes = React.useMemo(
    () => sortNodes(activeBranch?.nodes ?? []),
    [activeBranch],
  );
  const currentYear = new Date().getFullYear();
  const ageNow = ageAt(profile, currentYear);
  const nextBranchNo = branches.filter((branch) => branch.kind !== 'actual').length + 1;
  const defaultForkYear = activeNodes[0]?.year ?? summary.yearMin ?? currentYear;

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const setBranchField = (key, value) => setBranchForm((prev) => ({ ...prev, [key]: value }));
  const emit = (nextTimeline) => {
    if (typeof onChange === 'function') onChange(nextTimeline);
  };

  const handleAddNode = (event) => {
    event.preventDefault();
    try {
      const next = addNode(normalized, {
        branchId: activeBranch?.id ?? ACTUAL_BRANCH_ID,
        year: form.year,
        month: form.month,
        title: form.title,
        kind: form.kind,
        desc: form.desc,
        tags: form.tags,
        source: form.source,
        confidence: form.confidence,
        important: form.important,
        age: ageAt(profile, Number(form.year)),
      });
      emit(next);
      setError('');
      setForm({ ...EMPTY_FORM, year: String(new Date().getFullYear()) });
    } catch (err) {
      setError(err?.message || '保存失败');
    }
  };

  const handleRemoveNode = (nodeId) => {
    emit(removeNode(normalized, nodeId, activeBranch?.id ?? ACTUAL_BRANCH_ID));
  };

  const handleCreateBranch = (event) => {
    event.preventDefault();
    try {
      const assumptions = branchForm.assumptions
        .split(/\n+/)
        .map((item) => item.trim())
        .filter(Boolean);
      const next = createBranch(normalized, {
        name: branchForm.name,
        forkYear: branchForm.forkYear,
        assumptions,
      });
      const created = next.branches[next.branches.length - 1];
      emit(next);
      setActiveBranchId(created?.id ?? ACTUAL_BRANCH_ID);
      setBranchError('');
      setBranchForm(EMPTY_BRANCH_FORM);
    } catch (err) {
      setBranchError(err?.message || '创建分支失败');
    }
  };

  const handleRemoveBranch = (branchId, branchName) => {
    if (branchId === ACTUAL_BRANCH_ID) return;
    const confirmed = typeof globalThis.confirm === 'function'
      ? globalThis.confirm(`删除假设分支「${branchName}」及其全部节点？`)
      : true;
    if (!confirmed) return;
    try {
      emit(removeBranch(normalized, branchId));
      if (activeBranchId === branchId) setActiveBranchId(ACTUAL_BRANCH_ID);
    } catch (err) {
      setError(err?.message || '删除分支失败');
    }
  };

  if (!profile) {
    return (
      <div className="ml-card" style={S.empty}>
        <span style={S.emptyTitle}>还没有选中的命主</span>
        <span>先在左侧新建或选择一个命主档案，再来记录人生轨迹。</span>
      </div>
    );
  }

  const branchName = activeBranch?.kind === 'actual' ? '实际人生' : activeBranch?.name;

  return (
    <div style={S.root}>
      {/* 当前命主 */}
      <div className="ml-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={S.header}>
          <div style={S.headerMain}>
            <div style={S.name}>{profile.name || '未命名命主'}</div>
            <div style={S.meta}>
              <span>公历 {String(profile.solar || '—').replace('T', ' ')}</span>
              <span>性别 {GENDER_LABEL[profile.gender] || '—'}</span>
              {profile.birthplace ? <span>出生地 {profile.birthplace}</span> : null}
              {ageNow !== null ? <span>今年约 {ageNow} 周岁</span> : null}
            </div>
          </div>
          <div style={S.stats}>
            <div style={S.stat}>
              <span style={S.statValue}>{summary.laneCount}</span>
              <span style={S.statLabel}>泳道</span>
            </div>
            <div style={S.stat}>
              <span style={S.statValue}>{summary.nodeCount}</span>
              <span style={S.statLabel}>节点</span>
            </div>
            <div style={S.stat}>
              <span style={S.statValue}>{summary.importantCount}</span>
              <span style={S.statLabel}>重要</span>
            </div>
            <div style={S.stat}>
              <span style={S.statValue}>{summary.spanYears || '—'}</span>
              <span style={S.statLabel}>年跨度</span>
            </div>
          </div>
        </div>
        <div style={S.hint}>
          年龄口径：周岁 = 年份 − 出生年（按年份差，不扣生日）。分支是「如果当时……」的反事实假设，不是预测；
          模型推演的节点会标注来源与置信度。
        </div>
      </div>

      {/* 分支切换 */}
      <div style={S.chips}>
        {branches.map((branch, index) => {
          const active = branch.id === activeBranch?.id;
          return (
            <button
              key={branch.id}
              type="button"
              className="ml-btn"
              onClick={() => setActiveBranchId(branch.id)}
              style={{ ...S.chip, ...(active ? S.chipActive : null) }}
              title={branch.kind === 'actual' ? '主轨：实际人生' : `假设分支${Number.isInteger(branch.fork_year) ? `（${branch.fork_year} 年分叉）` : ''}`}
            >
              <span style={{ ...S.chipDot, background: branch.kind === 'actual' ? 'var(--ml-gold)' : branchColor(branch, index) }} />
              <span>{branch.kind === 'actual' ? '实际人生' : branch.name}</span>
              <span style={S.chipCount}>
                {branchNodeCount(branch)} 节点
                {Number.isInteger(branch.fork_year) ? ` · ${branch.fork_year} 分叉` : ''}
              </span>
            </button>
          );
        })}
      </div>

      {/* 时间线 */}
      <div className="ml-card">
        <div style={S.sectionHead}>
          <span className="ml-section-title" style={{ margin: 0 }}>时间线总览</span>
          <span className="ml-badge">主轨 + 假设分支</span>
          {summary.isEmpty ? <span className="ml-badge">空</span> : null}
        </div>
        <TimelineSvg
          timeline={normalized}
          profile={profile}
          bazi={bazi}
          width={880}
          emptyHint="尚无轨迹节点 · 从下面「录入事件」添加第一条"
        />
        <div style={{ ...S.hint, marginTop: 10 }}>
          形状 = 节点类型（圆·事实 / 菱形·里程碑 / 方·抉择 / 三角·转折）；颜色 = 泳道；
          虚线 = 假设分支从实际人生引出；背景色带 = 八字大运（档案有八字排盘时）。
        </div>
      </div>

      {summary.isEmpty ? <EmptyGuide /> : null}

      {/* 录入 + 当前分支节点列表 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.05fr) minmax(0, 1fr)', gap: 16 }}>
        <form className="ml-card" onSubmit={handleAddNode} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={S.sectionHead}>
            <span className="ml-section-title" style={{ margin: 0 }}>录入事件</span>
            <span className="ml-badge ml-badge--gold">→ {branchName}</span>
          </div>
          <div style={S.inputRow}>
            <Field label="年份 *" htmlFor="ml-tl-year">
              <input
                id="ml-tl-year"
                className="ml-input"
                type="number"
                min="1"
                max="9999"
                placeholder="如 2016"
                value={form.year}
                onChange={(e) => setField('year', e.target.value)}
              />
            </Field>
            <Field label="月份（可选）" htmlFor="ml-tl-month">
              <input
                id="ml-tl-month"
                className="ml-input"
                type="number"
                min="1"
                max="12"
                placeholder="1–12"
                value={form.month}
                onChange={(e) => setField('month', e.target.value)}
              />
            </Field>
          </div>
          <Field label="标题 *" htmlFor="ml-tl-title">
            <input
              id="ml-tl-title"
              className="ml-input"
              type="text"
              maxLength="60"
              placeholder="如 毕业入职 / 换城市 / 开始独立项目"
              value={form.title}
              onChange={(e) => setField('title', e.target.value)}
            />
          </Field>
          <div style={S.inputRow}>
            <Field label="类型" htmlFor="ml-tl-kind">
              <select id="ml-tl-kind" className="ml-select" value={form.kind} onChange={(e) => setField('kind', e.target.value)}>
                {kindOptions().map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </Field>
            <Field label="标签（逗号分隔）" htmlFor="ml-tl-tags">
              <input
                id="ml-tl-tags"
                className="ml-input"
                type="text"
                placeholder="工作, 家庭"
                value={form.tags}
                onChange={(e) => setField('tags', e.target.value)}
              />
            </Field>
          </div>
          <Field label="描述（可选）" htmlFor="ml-tl-desc">
            <textarea
              id="ml-tl-desc"
              className="ml-textarea"
              rows={2}
              placeholder="一句话补充当时的背景或感受"
              value={form.desc}
              onChange={(e) => setField('desc', e.target.value)}
            />
          </Field>
          <div style={S.inputRow}>
            <Field label="来源" htmlFor="ml-tl-source">
              <select id="ml-tl-source" className="ml-select" value={form.source} onChange={(e) => setField('source', e.target.value)}>
                {SOURCES.map((source) => (
                  <option key={source} value={source}>{SOURCE_LABELS[source]}</option>
                ))}
              </select>
            </Field>
            <Field label="置信度" htmlFor="ml-tl-confidence">
              <select
                id="ml-tl-confidence"
                className="ml-select"
                value={form.confidence}
                onChange={(e) => setField('confidence', e.target.value)}
              >
                {CONFIDENCES.map((confidence) => (
                  <option key={confidence} value={confidence}>{CONFIDENCE_LABELS[confidence]}</option>
                ))}
              </select>
            </Field>
          </div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12.5 }}>
            <input type="checkbox" checked={form.important} onChange={(e) => setField('important', e.target.checked)} />
            <span>标记为重要节点（时间线上放大）</span>
          </label>
          {error ? <div style={S.error}>{error}</div> : null}
          <div style={S.actions}>
            <button className="ml-btn ml-btn--gold" type="submit">＋ 添加到{branchName}</button>
            <span style={S.hint}>
              {ageNow !== null && form.year ? `预计年龄 ${ageAt(profile, Number(form.year)) ?? '—'} 岁` : ''}
            </span>
          </div>
        </form>

        <div className="ml-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={S.sectionHead}>
            <span className="ml-section-title" style={{ margin: 0 }}>「{branchName}」节点</span>
            <span className="ml-badge">{activeNodes.length} 条</span>
            {activeBranch?.assumptions?.length ? (
              <span style={S.hint}>假设：{activeBranch.assumptions.join('；')}</span>
            ) : null}
            {activeBranch && activeBranch.kind !== 'actual' ? (
              <button
                type="button"
                className="ml-btn ml-btn--ghost ml-btn--sm"
                style={{ marginLeft: 'auto', color: 'var(--ml-cinnabar)' }}
                onClick={() => handleRemoveBranch(activeBranch.id, activeBranch.name)}
              >
                删除该假设
              </button>
            ) : null}
          </div>
          {activeNodes.length ? (
            <div className="ml-scroll" style={{ ...S.list, maxHeight: 360 }}>
              {activeNodes.map((node, index) => {
                const age = Number.isInteger(node.age) ? node.age : ageAt(profile, node.year);
                return (
                  <div key={node.id} style={{ ...S.listItem, ...(index === 0 ? S.listItemFirst : null) }}>
                    <div style={S.listMain}>
                      <div style={S.listTop}>
                        <span style={S.when}>{formatNodeDate(node)}</span>
                        <span style={{ ...S.badge, color: KIND_COLOR[node.kind] || 'var(--ml-muted)' }}>
                          {KIND_LABELS[node.kind] || '事件'}
                        </span>
                        <span style={S.title}>{node.title || '（无标题）'}</span>
                        {node.important ? <span style={S.star} title="重要节点">★</span> : null}
                      </div>
                      <div style={S.metaLine}>
                        {age === null || age === undefined ? '' : `约 ${age} 岁 · `}
                        {SOURCE_LABELS[node.source] || '用户口述'} · {CONFIDENCE_LABELS[node.confidence] || '中置信'}
                      </div>
                      {node.desc ? <div style={S.desc}>{node.desc}</div> : null}
                      {node.tags?.length ? (
                        <div style={S.tags}>
                          {node.tags.map((tag) => <span key={tag} style={S.tag}>#{tag}</span>)}
                        </div>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className="ml-btn ml-btn--ghost ml-btn--sm"
                      style={{ color: 'var(--ml-muted)' }}
                      title={`删除节点「${node.title}」`}
                      onClick={() => handleRemoveNode(node.id)}
                    >
                      删除
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={S.empty}>
              <span style={S.emptyTitle}>
                {activeBranch?.kind === 'actual' ? '实际人生还没有节点' : '这个假设分支还没有节点'}
              </span>
              <span>
                {activeBranch?.kind === 'actual'
                  ? '从上面「录入事件」开始记录第一条真实经历。'
                  : '在「录入事件」里把事件加到当前分支，推演「如果当时……」的另一种可能。'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 新建假设分支 */}
      <form className="ml-card" onSubmit={handleCreateBranch} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={S.sectionHead}>
          <span className="ml-section-title" style={{ margin: 0 }}>新建假设分支</span>
          <span className="ml-badge">第 {nextBranchNo} 条假设</span>
          <span style={S.hint}>分支从「实际人生」的某一年分叉出去，节点独立记录。</span>
        </div>
        <div style={S.formGrid}>
          <Field label="分支名称 *" htmlFor="ml-tl-branch-name">
            <input
              id="ml-tl-branch-name"
              className="ml-input"
              type="text"
              maxLength="30"
              placeholder="如 如果当年读研"
              value={branchForm.name}
              onChange={(e) => setBranchField('name', e.target.value)}
            />
          </Field>
          <Field label="分叉年份 *" htmlFor="ml-tl-branch-year">
            <input
              id="ml-tl-branch-year"
              className="ml-input"
              type="number"
              min="1"
              max="9999"
              placeholder={`如 ${defaultForkYear}`}
              value={branchForm.forkYear}
              onChange={(e) => setBranchField('forkYear', e.target.value)}
            />
          </Field>
        </div>
        <Field label="假设说明（可多行，可选）" htmlFor="ml-tl-branch-assumptions">
          <textarea
            id="ml-tl-branch-assumptions"
            className="ml-textarea"
            rows={2}
            placeholder={'2016 选择读研而非直接工作\n如果当时留在学校，可能会…'}
            value={branchForm.assumptions}
            onChange={(e) => setBranchField('assumptions', e.target.value)}
          />
        </Field>
        {branchError ? <div style={S.error}>{branchError}</div> : null}
        <div style={S.actions}>
          <button className="ml-btn ml-btn--primary" type="submit">＋ 创建假设分支</button>
          <span style={S.hint}>分支是反事实假设，不代表预测；建议标注来源为「模型推演」、置信度「低」。</span>
        </div>
      </form>
    </div>
  );
}
