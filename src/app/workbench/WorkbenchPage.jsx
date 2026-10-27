import React from 'react';
import pageCss from './workbench-page.css';
import dailyCss from './daily-tab.css';
import DailyTab from './DailyTab.jsx';
import { buildDaily, localDateKey } from '../../engines/daily.js';
import { buildAll, buildQimen } from '../../engines/index.js';
import ChartBazi from '../../render/ChartBazi.jsx';
import ChartZiwei from '../../render/ChartZiwei.jsx';
import ChartQimen from '../../render/ChartQimen.jsx';
import TimelineSvg from '../../timeline/TimelineSvg.jsx';
import ReportTab from '../ReportTab.jsx';
import { requestOpen } from '../panel-bus.js';
import { loadState, getTimeline, readDailyHistory, saveDailyRecord } from '../../store.js';

const RIGHT_TABS = ['黄历', '八字', '紫微', '奇门', '命途', '报告'];

const PILLAR_CN = { year: '年', month: '月', day: '日', hour: '时' };
const REL_CN = { chong: '冲', he: '合', xing: '刑', hai: '害', po: '破', ganhe: '干合', banhe: '半合' };

function shiftDate(key, delta) {
  const base = new Date(`${key}T12:00:00`);
  base.setDate(base.getDate() + delta);
  return localDateKey(base);
}

function RelationsList({ relations }) {
  if (!relations || !relations.length) return null;
  return React.createElement('div', { className: 'ml-wp-rel' },
    relations.map((relation, index) => React.createElement('span', {
      key: index,
      className: 'ml-wp-rel-item',
      title: relation.note || '',
    }, `${PILLAR_CN[relation.pillar] || relation.pillar || ''}柱·${REL_CN[relation.type] || relation.type || '关联'}`)));
}

function AspectCards({ aspects }) {
  if (!aspects || !aspects.length) return null;
  return React.createElement('div', { className: 'ml-dt-grid' },
    aspects.map((aspect) => React.createElement('div', { key: aspect.key, className: 'ml-dt-card' },
      React.createElement('div', { className: 'ml-dt-card-top' },
        React.createElement('b', null, aspect.label),
        React.createElement('span', { className: 'ml-dt-card-score' }, `${aspect.score} · ${aspect.level}`)),
      React.createElement('div', { className: 'ml-dt-bar' },
        React.createElement('i', { style: { width: `${aspect.score}%` } })),
      React.createElement('div', { className: 'ml-dt-advice' }, aspect.advice),
      aspect.reasons.length
        ? React.createElement('ul', { className: 'ml-dt-reasons' },
          aspect.reasons.map((reason, index) => React.createElement('li', { key: index }, reason)))
        : null)));
}

/** Read-only workbench: profiles / daily almanac + six aspects / charts. No chat. */
export default function WorkbenchPage() {
  const [state, setState] = React.useState(() => loadState());
  const [tab, setTab] = React.useState('八字');
  const [refreshAt, setRefreshAt] = React.useState(0);
  const [selectedDate, setSelectedDate] = React.useState(() => localDateKey());

  const activeId = state.activeId || state.profiles[0]?.id || null;
  const profile = state.profiles.find((item) => item.id === activeId) || state.profiles[0] || null;
  const todayKey = localDateKey();

  // Today's snapshot is archived so every day keeps its own almanac record.
  const history = React.useMemo(
    () => (profile ? readDailyHistory(profile.id) : {}),
    [profile?.id, refreshAt],
  );

  const daily = React.useMemo(() => {
    if (!profile) return null;
    try {
      if (selectedDate === todayKey) return buildDaily({ profile, date: new Date() });
      return buildDaily({ profile, date: new Date(`${selectedDate}T12:00:00`) });
    } catch (error) {
      return { error: String(error?.message || error) };
    }
  }, [profile?.id, profile?.solar, selectedDate, todayKey, refreshAt]);

  // Archive today's reading (idempotent per date).
  React.useEffect(() => {
    if (!profile || !daily || daily.error) return;
    saveDailyRecord(profile.id, {
      date: daily.date,
      ganzhi: daily.ganzhi,
      lunar: daily.lunar,
      score: daily.score,
      level: daily.level,
      tenGod: daily.tenGod,
      dayMaster: daily.dayMaster,
      favorable: daily.favorable,
      relations: daily.relations,
      aspects: daily.aspects,
      almanac: daily.almanac,
      explain: daily.explain,
      savedAt: new Date().toISOString(),
    });
  }, [profile?.id, daily?.date, refreshAt]);

  const historyDates = React.useMemo(() => {
    const keys = Object.keys(history).sort().reverse();
    if (!keys.includes(todayKey)) keys.unshift(todayKey);
    return keys.slice(0, 21);
  }, [history, todayKey]);

  const charts = React.useMemo(() => {
    if (!profile) return null;
    try {
      return buildAll(profile);
    } catch (error) {
      return { error: String(error?.message || error) };
    }
  }, [profile?.id, profile?.solar, profile?.longitude, profile?.use_true_solar, refreshAt]);

  const qimen = React.useMemo(() => {
    if (tab !== '奇门' || !profile) return null;
    try {
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const solar = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
      return buildQimen({ solar, ask: '近期运势' });
    } catch (error) {
      return { error: String(error?.message || error) };
    }
  }, [tab, profile?.id, refreshAt]);

  const timeline = React.useMemo(() => {
    if (!profile) return null;
    try {
      return getTimeline(profile.id);
    } catch {
      return null;
    }
  }, [profile?.id, refreshAt]);

  const switchProfile = (id) => {
    setSelectedDate(localDateKey());
    const next = { ...state, activeId: id };
    setState(next);
    try { globalThis.localStorage?.setItem('mingli.profiles.v1', JSON.stringify(next)); } catch { /* ignore */ }
  };

  // Roll over at midnight so the almanac always shows "today".
  React.useEffect(() => {
    const timer = setInterval(() => {
      if (localDateKey() !== todayKey) setRefreshAt(Date.now());
    }, 60_000);
    return () => clearInterval(timer);
  }, [todayKey]);

  return React.createElement('div', { className: 'ml-wp' },
    React.createElement('style', { dangerouslySetInnerHTML: { __html: pageCss + dailyCss } }),

    // ── left rail: profiles only ────────────────────────────────────────
    React.createElement('aside', { className: 'ml-wp-rail' },
      React.createElement('div', { className: 'ml-wp-brand' },
        React.createElement('span', { className: 'ml-wp-seal' }, '命'),
        React.createElement('div', null,
          React.createElement('div', { className: 'ml-wp-brand-name' }, 'MINGLI'),
          React.createElement('div', { className: 'ml-wp-brand-sub' }, '命理推演引擎'))),

      React.createElement('button', {
        type: 'button', className: 'ml-wp-new', onClick: () => requestOpen('命盘'),
      }, '＋ 新建命主'),

      React.createElement('div', { className: 'ml-wp-rail-body' },
        React.createElement('div', { className: 'ml-wp-group' },
          React.createElement('div', { className: 'ml-wp-group-title' }, '命主'),
          state.profiles.length
            ? state.profiles.map((item) => React.createElement('button', {
              key: item.id,
              type: 'button',
              className: `ml-wp-profile${item.id === activeId ? ' is-active' : ''}`,
              onClick: () => switchProfile(item.id),
            },
            React.createElement('span', { className: 'ml-wp-profile-name' }, item.name || '未命名'),
            React.createElement('span', { className: 'ml-wp-profile-meta' },
              `${item.gender === 'female' ? '女' : '男'} · ${String(item.solar).slice(0, 10)}`)))
            : React.createElement('p', { className: 'ml-wp-hint' }, '还没有命主档案')))),

    // ── centre: daily almanac + six aspects ─────────────────────────────
    React.createElement('main', { className: 'ml-wp-main' },
      React.createElement('div', { className: 'ml-wp-top' },
        React.createElement('div', { className: 'ml-wp-top-profile' },
          React.createElement('b', null, profile?.name || '未选择命主'),
          React.createElement('span', null, profile ? `${profile.solar.slice(0, 16).replace('T', ' ')} · ${profile.gender === 'female' ? '女' : '男'}` : '—')),
        React.createElement('div', { className: 'ml-wp-top-right' },
          daily && !daily.error
            ? React.createElement('span', { className: 'ml-wp-today' },
              `${todayKey} · ${daily.ganzhi}日 · ${daily.score} 分 ${daily.level}`)
            : null,
          React.createElement('button', { type: 'button', className: 'ml-wp-btn', onClick: () => setRefreshAt(Date.now()) }, '刷新'))),

      React.createElement('div', { className: 'ml-wp-scroll' },
        React.createElement('div', { className: 'ml-wp-days' },
          React.createElement('span', { className: 'ml-wp-days-label' }, '每日黄历'),
          React.createElement('button', {
            type: 'button', className: 'ml-wp-day', title: '前一天',
            onClick: () => setSelectedDate(shiftDate(selectedDate, -1)),
          }, '‹'),
          historyDates.map((key) => React.createElement('button', {
            key,
            type: 'button',
            className: `ml-wp-day${key === selectedDate ? ' is-active' : ''}${key === todayKey ? ' is-today' : ''}`,
            title: key,
            onClick: () => setSelectedDate(key),
          }, key === todayKey ? '今天' : key.slice(5))),
          React.createElement('button', {
            type: 'button', className: 'ml-wp-day', title: '后一天',
            disabled: selectedDate >= todayKey,
            onClick: () => setSelectedDate(shiftDate(selectedDate, 1)),
          }, '›')),
        daily && !daily.error
          ? React.createElement('section', { className: 'ml-wp-daily' },
            React.createElement('div', { className: 'ml-wp-daily-head' },
              React.createElement('div', null,
                React.createElement('b', null, `${daily.date} · ${daily.ganzhi}日`),
                React.createElement('span', null, `${daily.lunar} · 值神${daily.almanac.zhiShen}（${daily.almanac.zhiShenType}）`)),
              React.createElement('div', { className: `ml-wp-score is-${daily.level === '宜守' ? 'guard' : 'normal'}` },
                React.createElement('b', null, String(daily.score)),
                React.createElement('span', null, daily.level))),
            React.createElement('div', { className: 'ml-wp-chips' },
              React.createElement('span', { className: 'ml-wp-chip-label' }, '宜'),
              daily.almanac.yi.slice(0, 6).map((item) => React.createElement('span', {
                key: 'yi-' + item, className: 'ml-wp-chip ml-wp-chip--good',
              }, item))),
            React.createElement('div', { className: 'ml-wp-chips' },
              React.createElement('span', { className: 'ml-wp-chip-label' }, '忌'),
              daily.almanac.ji.slice(0, 6).map((item) => React.createElement('span', {
                key: 'ji-' + item, className: 'ml-wp-chip ml-wp-chip--bad',
              }, item))),
            React.createElement(RelationsList, { relations: daily.relations }),
            React.createElement(AspectCards, { aspects: daily.aspects }))
          : React.createElement('p', { className: 'ml-wp-hint' }, daily?.error ? `今日数据未就绪：${daily.error}` : '选择命主后显示今日反馈'))),

    // ── right: charts ───────────────────────────────────────────────────
    React.createElement('aside', { className: 'ml-wp-right' },
      React.createElement('div', { className: 'ml-wp-right-tabs' },
        RIGHT_TABS.map((name) => React.createElement('button', {
          key: name, type: 'button', className: 'ml-wp-right-tab', 'data-active': tab === name ? 'true' : 'false',
          onClick: () => setTab(name),
        }, name)),
        React.createElement('button', {
          type: 'button', className: 'ml-wp-right-open', title: '打开完整命盘面板',
          onClick: () => requestOpen(tab === '命途' ? '人生轨迹' : tab === '报告' ? '报告' : tab === '奇门' ? '奇门' : tab === '紫微' ? '紫微' : '命盘'),
        }, '⤢')),
      React.createElement('div', { className: 'ml-wp-right-body' },
        !profile
          ? React.createElement('p', { className: 'ml-wp-hint' }, '请先创建一个命主档案')
          : tab === '黄历'
            ? React.createElement(DailyTab, { daily, profile })
            : charts?.error
              ? React.createElement('p', { className: 'ml-wp-hint' }, `排盘失败：${charts.error}`)
              : tab === '八字'
                ? React.createElement(ChartBazi, { data: charts.bazi })
                : tab === '紫微'
                  ? React.createElement(ChartZiwei, { data: charts.ziwei })
                  : tab === '奇门'
                    ? (qimen?.error
                      ? React.createElement('p', { className: 'ml-wp-hint' }, `起局失败：${qimen.error}`)
                      : qimen ? React.createElement(ChartQimen, { data: qimen }) : React.createElement('p', { className: 'ml-wp-hint' }, '起局中…'))
                    : tab === '命途'
                      ? React.createElement(TimelineSvg, { timeline, profile, bazi: charts.bazi, width: 420 })
                      : React.createElement(ReportTab, { profile, bazi: charts.bazi, ziwei: charts.ziwei }))));
}


