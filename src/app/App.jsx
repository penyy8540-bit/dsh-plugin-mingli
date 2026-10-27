import React from 'react';
import appCss from './app.css';
import Launcher from './Launcher.jsx';
import BirthForm from './BirthForm.jsx';
import ProfileList from './ProfileList.jsx';
import ReportTab from './ReportTab.jsx';
import ChartBazi from '../render/ChartBazi.jsx';
import ChartZiwei from '../render/ChartZiwei.jsx';
import ChartDayun from '../render/ChartDayun.jsx';
import ChartQimen from '../render/ChartQimen.jsx';
import TimelineTab from '../timeline/TimelineTab.jsx';
import { PREVIEW_TIMELINE } from './preview-seed.js';
import { subscribeOpen } from './panel-bus.js';
import { buildAll, buildQimen } from '../engines/index.js';
import {
  loadState,
  upsertProfile,
  removeProfile,
  setActiveProfile,
  getTimeline,
  saveTimeline,
} from '../store.js';

/**
 * 面板外壳：右下角浮动入口 + 全屏弹层。
 * 数据流：store(localStorage) -> engines(buildAll / buildQimen) -> render 组件与各 tab。
 * 所有排盘在浏览器本地完成；切换 tab 不会重算命盘。
 */

const TABS = ['命盘', '紫微', '大运流年', '奇门', '人生轨迹', '报告'];
const CURRENT_YEAR = 2026;

const SAMPLE_PROFILE = {
  name: '示例命主',
  gender: 'male',
  solar: '1990-05-15T10:30',
  birthplace: '北京',
  longitude: 116.4,
  use_true_solar: true,
};

// 预览壳的调试入口：preview/index.html#launcher 时先收起面板，方便单独截浮动入口；
// #tab=<中文标签> 可直接落到某个 tab（截图/验收用）。真实用户不受影响。
function readHashParams() {
  try {
    const raw = decodeURIComponent(String(globalThis.location?.hash || '').replace(/^#/, ''));
    const params = {};
    raw.split('&').forEach((pair) => {
      if (!pair) return;
      const index = pair.indexOf('=');
      if (index < 0) params[pair] = '';
      else params[pair.slice(0, index)] = pair.slice(index + 1);
    });
    return params;
  } catch {
    return {};
  }
}

function previewStartOpen(preview) {
  if (!preview) return false;
  return !('launcher' in readHashParams());
}

function initialTab(preview) {
  if (!preview) return '命盘';
  const params = readHashParams();
  if (params.tab && TABS.includes(params.tab)) return params.tab;
  return '人生轨迹';
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function nowLocalIso() {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}T${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;
}

function formatSolar(solar) {
  const text = String(solar || '').replace('T', ' ').slice(0, 16);
  return text || '—';
}

function genderLabel(gender) {
  return gender === 'female' ? '女 · 坤造' : '男 · 乾造';
}

function birthYear(solar) {
  const matched = /^(\d{4})/.exec(String(solar || ''));
  return matched ? Number(matched[1]) : null;
}

function virtualAge(profile) {
  const year = birthYear(profile?.solar);
  return year ? CURRENT_YEAR - year + 1 : null;
}

function safeLoadState() {
  try {
    const state = loadState();
    return state && Array.isArray(state.profiles) ? state : { profiles: [], activeId: null };
  } catch {
    return { profiles: [], activeId: null };
  }
}

function safeGetTimeline(profileId) {
  if (!profileId) return null;
  try {
    return getTimeline(profileId);
  } catch {
    return null;
  }
}

function text(value, fallback = '—') {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
}

function ErrorCard({ title = '排盘失败', message, hint }) {
  return (
    <div className="ml-error" role="alert">
      <div className="ml-error-title">
        {title}：{text(message, '未知错误')}
      </div>
      {hint ? <div className="ml-error-hint">{hint}</div> : null}
    </div>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    try {
      globalThis.console?.error?.('[mingli] UI render error:', error, info);
    } catch {
      /* 日志失败不影响界面 */
    }
  }

  render() {
    if (this.state.error) {
      return (
        <ErrorCard
          title="界面渲染失败"
          message={this.state.error?.message || String(this.state.error)}
          hint="可以切换到其它标签页继续查看，或返回「命盘」页；盘面数据仍保存在本机。"
        />
      );
    }
    return this.props.children;
  }
}

function ContextBar({ items = [] }) {
  const shown = items.filter((item) => item && item.value);
  if (!shown.length) return null;
  return (
    <div className="ml-context">
      {shown.map((item, index) => (
        <span className="ml-context-item" key={`${item.label}-${index}`}>
          <span className="ml-context-k">{item.label}</span>
          <span className="ml-context-v">{item.value}</span>
        </span>
      ))}
    </div>
  );
}

function currentDayunOf(bazi) {
  const list = Array.isArray(bazi?.dayun?.list) ? bazi.dayun.list : [];
  return list.find((item) => CURRENT_YEAR >= Number(item.start_year) && CURRENT_YEAR <= Number(item.end_year)) || null;
}

function liunianOf(bazi) {
  const list = Array.isArray(bazi?.liunian) ? bazi.liunian : [];
  return list.find((item) => Number(item.year) === CURRENT_YEAR) || null;
}

function locationText(profile) {
  const lon = profile?.longitude !== null && profile?.longitude !== undefined ? `东经 ${profile.longitude}°` : '经度未填';
  return `${profile?.birthplace || '未填写'} · ${lon}`;
}

/* 命盘页顶部补充栏：只放图表自身没有的档案级信息（性别/出生地/起运/当前运/流年）。 */
function baziContext(profile, bazi) {
  const qiyun = bazi?.dayun?.qiyun;
  const dayun = currentDayunOf(bazi);
  const liunian = liunianOf(bazi);
  return [
    { label: '性别', value: genderLabel(profile.gender) },
    { label: '出生地', value: locationText(profile) },
    {
      label: '起运',
      value: qiyun ? `${qiyun.years || 0} 年 ${qiyun.months || 0} 月后（${text(qiyun.solar)} · ${qiyun.forward ? '顺排' : '逆排'}）` : '—',
    },
    {
      label: '当前大运',
      value: dayun ? `${dayun.ganzhi}（${dayun.start_year}–${dayun.end_year} · 虚岁${dayun.start_age}–${dayun.end_age}）` : '—',
    },
    {
      label: '本年流年',
      value: liunian ? `${liunian.ganzhi} · 虚岁${text(liunian.age)} · ${text(liunian.shishen_gan)}` : '—',
    },
  ];
}

/* 紫微页顶部补充栏：图表 header 已有命主/五行局/命宫，这里只补档案与真太阳时。 */
function ziweiContext(profile, ziwei) {
  const trueSolar = ziwei?.true_solar;
  const delta = trueSolar && Number.isFinite(Number(trueSolar.delta_minutes)) ? Number(trueSolar.delta_minutes) : null;
  return [
    { label: '性别', value: genderLabel(profile.gender) },
    { label: '出生地', value: locationText(profile) },
    {
      label: '真太阳时',
      value: trueSolar?.applied
        ? `已应用${delta !== null ? `（${delta > 0 ? '+' : ''}${delta.toFixed(1)} 分）` : ''}`
        : profile.use_true_solar
          ? '已开启，本盘按平太阳时'
          : '未开启',
    },
  ];
}

export default function App({ preview = false, inline = false, hideLauncher = false } = {}) {
  const [open, setOpen] = React.useState(() => inline || previewStartOpen(preview));
  const [tab, setTab] = React.useState(() => initialTab(preview));
  const [storeState, setStoreState] = React.useState(() => safeLoadState());
  const [form, setForm] = React.useState(null);
  const [timeline, setTimeline] = React.useState(null);
  const [askDraft, setAskDraft] = React.useState('这个月适合签约吗');
  const [ask, setAsk] = React.useState('这个月适合签约吗');
  const [qimenNonce, setQimenNonce] = React.useState(0);
  const storageRef = React.useRef(true);

  // 输入框 dock 上的「命盘」入口（另一个槽位的组件）通过这个总线打开面板。
  React.useEffect(() => subscribeOpen((wantedTab) => {
    setOpen(true);
    if (wantedTab) setTab(wantedTab);
  }), []);

  // 预览模式：预置示例命主 + 轨迹 demo（只影响 preview，真实用户不会写入）。
  React.useEffect(() => {
    if (!preview) return;
    const current = safeLoadState();
    let activeProfile = current.profiles.find((profile) => profile.id === current.activeId) || current.profiles[0] || null;

    if (activeProfile) {
      setStoreState(current);
    } else {
      let saved = null;
      try {
        saved = upsertProfile({ ...SAMPLE_PROFILE });
      } catch {
        saved = null;
      }
      const after = safeLoadState();
      activeProfile = after.profiles.find((profile) => profile.id === after.activeId) || after.profiles[0] || null;
      if (activeProfile) {
        setStoreState(after);
      } else {
        storageRef.current = false;
        activeProfile = saved || { ...SAMPLE_PROFILE, id: 'p_preview', created_at: '', updated_at: '' };
        setStoreState({ profiles: [activeProfile], activeId: activeProfile.id });
      }
    }

    if (!activeProfile) return;
    try {
      const existing = getTimeline(activeProfile.id);
      const hasNodes = (existing?.branches || []).some((branch) => (branch.nodes || []).length > 0);
      if (!hasNodes) {
        const seeded = saveTimeline(activeProfile.id, PREVIEW_TIMELINE);
        if (seeded) setTimeline(seeded);
      }
    } catch {
      /* 预览种子写入失败不影响界面 */
    }
  }, [preview]);

  const profiles = Array.isArray(storeState?.profiles) ? storeState.profiles : [];
  const active = profiles.find((profile) => profile.id === storeState?.activeId) || profiles[0] || null;
  const activeId = active?.id ?? null;

  // 命盘计算：只在命主关键字段变化时重算，切换 tab 不重算。
  const calc = React.useMemo(() => {
    if (!active) return { bazi: null, ziwei: null, error: null };
    try {
      const result = buildAll(active);
      if (!result || (!result.bazi && !result.ziwei)) {
        return { bazi: null, ziwei: null, error: '引擎未返回任何盘面数据' };
      }
      return { bazi: result.bazi || null, ziwei: result.ziwei || null, error: null };
    } catch (error) {
      return { bazi: null, ziwei: null, error: (error && error.message) || String(error) };
    }
  }, [active?.id, active?.solar, active?.gender, active?.longitude, active?.use_true_solar]);

  // 奇门：只在奇门 tab 用当前时间起局。
  const isQimenOpen = open && tab === '奇门';
  const qimen = React.useMemo(() => {
    if (!isQimenOpen) return { data: null, error: null, solar: null };
    const solar = nowLocalIso();
    try {
      const data = buildQimen({ solar, ask });
      if (!data) return { data: null, error: '引擎未返回奇门九宫数据', solar };
      return { data, error: null, solar };
    } catch (error) {
      return { data: null, error: (error && error.message) || String(error), solar };
    }
  }, [isQimenOpen, ask, qimenNonce, activeId]);

  // 人生轨迹：从 store 读取 / 写回。
  React.useEffect(() => {
    if (!activeId) {
      setTimeline(null);
      return;
    }
    setTimeline(safeGetTimeline(activeId));
  }, [activeId]);

  const handleSave = React.useCallback(
    (profilePatch) => {
      const merged = { ...(form?.profile?.id ? { id: form.profile.id } : {}), ...profilePatch };
      let saved = null;
      if (storageRef.current) {
        try {
          saved = upsertProfile(merged);
        } catch {
          saved = null;
        }
      }
      if (!saved) {
        storageRef.current = false;
        saved = { ...merged, id: merged.id || `p_local_${Date.now()}`, updated_at: new Date().toISOString() };
        setStoreState((prev) => ({
          profiles: [saved, ...(prev.profiles || []).filter((profile) => profile.id !== saved.id)],
          activeId: saved.id,
        }));
      } else {
        const after = safeLoadState();
        if (after.profiles.some((profile) => profile.id === saved.id)) setStoreState(after);
        else {
          storageRef.current = false;
          setStoreState({ profiles: [saved], activeId: saved.id });
        }
      }
      setForm(null);
      setTab('命盘');
    },
    [form],
  );

  const handleSelect = React.useCallback((id) => {
    if (!id) return;
    if (storageRef.current) {
      try {
        setActiveProfile(id);
      } catch {
        /* 存储不可用时退回内存态 */
      }
    }
    const after = safeLoadState();
    if (after.profiles.some((profile) => profile.id === id)) setStoreState(after);
    else setStoreState((prev) => ({ ...prev, activeId: id }));
  }, []);

  const handleDelete = React.useCallback((id) => {
    if (!id) return;
    if (storageRef.current) {
      try {
        removeProfile(id);
      } catch {
        /* ignore */
      }
      const after = safeLoadState();
      if (!after.profiles.some((profile) => profile.id === id)) {
        setStoreState(after);
        return;
      }
    }
    setStoreState((prev) => {
      const nextProfiles = (prev.profiles || []).filter((profile) => profile.id !== id);
      return {
        profiles: nextProfiles,
        activeId: prev.activeId === id ? nextProfiles[0]?.id ?? null : prev.activeId,
      };
    });
  }, []);

  const handleTimelineChange = React.useCallback(
    (nextTimeline) => {
      if (!nextTimeline || !activeId) return;
      setTimeline(nextTimeline);
      try {
        saveTimeline(activeId, nextTimeline);
      } catch {
        /* 内存态继续可用 */
      }
    },
    [activeId],
  );

  // Esc：先关表单，再关面板。
  React.useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      if (form) setForm(null);
      else setOpen(false);
    };
    globalThis.addEventListener('keydown', onKeyDown);
    return () => globalThis.removeEventListener('keydown', onKeyDown);
  }, [open, form]);

  const engineError = calc.error;

  let tabContent = null;
  if (!active) {
    tabContent = (
      <div className="ml-empty-state">
        <div className="ml-empty-glyph" aria-hidden="true">
          命
        </div>
        <div className="ml-empty-title">还没有命主档案</div>
        <div className="ml-empty-text">填写姓名、性别与出生时间，即可在本地排四柱、起紫微斗数盘，并按当前时间起奇门局。</div>
        <div className="ml-empty-actions">
          <button type="button" className="ml-btn ml-btn--gold" onClick={() => setForm({ mode: 'create', profile: null })}>
            新建第一张命盘
          </button>
        </div>
      </div>
    );
  } else if (tab === '命盘') {
    tabContent = (
      <div className="ml-stack">
        <ContextBar items={baziContext(active, calc.bazi)} />
        {engineError ? <ErrorCard message={engineError} hint="请检查出生信息是否完整，或在左栏重新保存命主后重试。" /> : null}
        {calc.bazi ? (
          <ChartBazi data={calc.bazi} />
        ) : engineError ? null : (
          <ErrorCard message="引擎未返回四柱数据" />
        )}
      </div>
    );
  } else if (tab === '紫微') {
    tabContent = (
      <div className="ml-stack">
        <ContextBar items={ziweiContext(active, calc.ziwei)} />
        {engineError ? <ErrorCard message={engineError} hint="紫微斗数与八字共用同一份出生信息，可在左栏「改」中修正。" /> : null}
        {calc.ziwei ? (
          <ChartZiwei data={calc.ziwei} />
        ) : engineError ? null : (
          <ErrorCard message="引擎未返回紫微盘数据" />
        )}
      </div>
    );
  } else if (tab === '大运流年') {
    tabContent = (
      <div className="ml-stack">
        {engineError ? <ErrorCard message={engineError} /> : null}
        {calc.bazi ? <ChartDayun data={calc.bazi} currentYear={2026} /> : engineError ? null : <ErrorCard message="引擎未返回大运数据" />}
      </div>
    );
  } else if (tab === '奇门') {
    tabContent = (
      <div className="ml-stack">
        <div className="ml-card ml-ask">
          <div className="ml-ask-row">
            <input
              className="ml-input"
              value={askDraft}
              onChange={(event) => setAskDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                setAsk(askDraft.trim());
                setQimenNonce((value) => value + 1);
              }}
              placeholder="想问的事，如：这个月适合签约吗"
              aria-label="奇门问事内容"
              maxLength={80}
            />
            <button
              type="button"
              className="ml-btn ml-btn--gold"
              onClick={() => {
                setAsk(askDraft.trim());
                setQimenNonce((value) => value + 1);
              }}
            >
              按此问事起局
            </button>
            <button type="button" className="ml-btn" onClick={() => setQimenNonce((value) => value + 1)}>
              重新起局
            </button>
          </div>
          <div className="ml-ask-meta">
            <span>
              起局时间 <b>{formatSolar(qimen.solar || nowLocalIso())}</b>（本地时间）
            </span>
            <span>奇门按当前时间起局，与命主出生时间无关</span>
          </div>
        </div>
        {qimen.error ? <ErrorCard title="起局失败" message={qimen.error} /> : null}
        {qimen.data ? (
          <ChartQimen data={qimen.data} />
        ) : qimen.error ? null : (
          <ErrorCard title="起局失败" message="引擎未返回奇门九宫数据" />
        )}
      </div>
    );
  } else if (tab === '人生轨迹') {
    tabContent = (
      <div className="ml-stack">
        {engineError ? <ErrorCard message={engineError} /> : null}
        <TimelineTab profile={active} timeline={timeline} bazi={calc.bazi} onChange={handleTimelineChange} />
      </div>
    );
  } else if (tab === '报告') {
    tabContent = <ReportTab profile={active} bazi={calc.bazi} ziwei={calc.ziwei} />;
  }

  return (
    <div className={`ml-app-root${inline ? ' ml-app-root--inline' : ''}`} data-preview={preview ? 'true' : 'false'} data-inline={inline ? 'true' : 'false'}>
      <style data-ml-app-style="" dangerouslySetInnerHTML={{ __html: appCss }} />
      {inline || hideLauncher ? null : <Launcher open={open} onClick={() => setOpen(true)} />}
      {open ? (
        <div
          className="ml-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className="ml-panel" role="dialog" aria-modal="true" aria-label="命理推演面板">
            <header className="ml-panel-header">
              <div className="ml-head-left">
                <div className="ml-seal" aria-hidden="true">
                  命
                </div>
                <div className="ml-brand">
                  <div className="ml-brand-title">
                    <b>MINGLI</b>
                    <span>·</span>
                    <span>命理推演</span>
                  </div>
                  <div className="ml-brand-sub">紫微斗数 · 子平八字 · 时家奇门 · 本地排盘</div>
                </div>
              </div>
              <div className="ml-head-right">
                <div className="ml-head-chip">
                  <span className="ml-head-chip-k">当前命主</span>
                  <span className="ml-head-chip-v">
                    {active ? `${active.name || '未命名'} · ${active.gender === 'female' ? '女' : '男'}` : '暂无档案'}
                  </span>
                </div>
                <button type="button" className="ml-close" onClick={() => setOpen(false)} title="关闭（Esc）" aria-label="关闭命理推演面板">
                  ×
                </button>
              </div>
            </header>

            <div className="ml-panel-body">
              <aside className="ml-aside" aria-label="命主档案">
                {form ? (
                  <BirthForm
                    initial={form.profile}
                    onSubmit={handleSave}
                    onCancel={() => setForm(null)}
                  />
                ) : (
                  <>
                    <div className="ml-aside-head">
                      <span className="ml-aside-title">命主档案</span>
                      <span className="ml-aside-count">{profiles.length} 位</span>
                    </div>
                    <div className="ml-aside-body ml-scroll">
                      <ProfileList
                        profiles={profiles}
                        activeId={activeId}
                        onSelect={handleSelect}
                        onEdit={(profile) => setForm({ mode: 'edit', profile })}
                        onDelete={handleDelete}
                      />
                      <div className="ml-aside-note">
                        <b>本地存储</b>：档案只保存在当前浏览器；排盘在本地完成，不联网、不上传。
                      </div>
                    </div>
                    <div className="ml-aside-foot">
                      <button type="button" className="ml-btn ml-btn--gold ml-aside-new" onClick={() => setForm({ mode: 'create', profile: null })}>
                        ＋ 新建命盘
                      </button>
                    </div>
                  </>
                )}
              </aside>

              <main className="ml-main">
                <div className="ml-mobilebar">
                  <select
                    className="ml-select"
                    value={activeId || ''}
                    onChange={(event) => handleSelect(event.target.value)}
                    aria-label="切换命主"
                  >
                    {profiles.length ? (
                      profiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.name || '未命名'}
                          {profile.gender === 'female' ? '（女）' : '（男）'}
                        </option>
                      ))
                    ) : (
                      <option value="">暂无档案</option>
                    )}
                  </select>
                  <button type="button" className="ml-btn ml-btn--gold ml-btn--sm" onClick={() => setForm({ mode: 'create', profile: null })}>
                    新建
                  </button>
                </div>

                <div className="ml-tabbar-row">
                  <div className="ml-tabs" role="tablist" aria-label="盘面标签">
                    {TABS.map((name) => (
                      <button
                        key={name}
                        type="button"
                        role="tab"
                        className="ml-tab"
                        data-active={tab === name ? 'true' : 'false'}
                        aria-selected={tab === name ? 'true' : 'false'}
                        onClick={() => setTab(name)}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                  <div className="ml-tab-meta">
                    {active ? (
                      <>
                        <i />
                        <span>{formatSolar(active.solar)}</span>
                        <i />
                        <span>虚岁 {virtualAge(active)}</span>
                      </>
                    ) : (
                      <span>未选择命主</span>
                    )}
                  </div>
                </div>

                <div className="ml-tab-body ml-scroll" role="tabpanel" aria-label={tab}>
                  <ErrorBoundary key={`${tab}-${activeId || 'none'}`}>{tabContent}</ErrorBoundary>
                </div>
              </main>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

