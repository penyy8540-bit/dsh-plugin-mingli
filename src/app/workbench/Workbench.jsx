import React from 'react';
import wbCss from './workbench.css';
import { buildDaily, localDateKey } from '../../engines/daily.js';
import { requestOpen } from '../panel-bus.js';
import { loadState, copyText } from '../../store.js';

const QUICK_TABS = ['命盘', '紫微', '大运流年', '奇门', '人生轨迹', '报告'];

function readNodes(profileId) {
  try {
    const raw = globalThis.localStorage?.getItem(`mingli.nodes.${profileId}`);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed?.nodes) ? parsed.nodes : [];
  } catch {
    return [];
  }
}

function scoreTone(score) {
  if (score >= 75) return 'good';
  if (score >= 60) return 'ok';
  if (score >= 45) return 'flat';
  return 'low';
}

function buildAiPrompt(profile, daily) {
  return [
    '你是命理推演助手。请严格依据下面的盘面与今日黄历，给出今天（' + daily.date + '）的每日反馈。',
    '',
    `命主：${profile.name || '未命名'} · ${profile.gender === 'female' ? '女' : '男'} · ${profile.solar}`,
    `今日：${daily.ganzhi}日 · ${daily.lunar} · 值神${daily.almanac.zhiShen}（${daily.almanac.zhiShenType}）`,
    `宜：${daily.almanac.yi.slice(0, 5).join('、') || '—'}`,
    `忌：${daily.almanac.ji.slice(0, 4).join('、') || '—'}`,
    `冲煞：冲${daily.almanac.chong}煞${daily.almanac.sha} · 喜神${daily.almanac.xi} · 财神${daily.almanac.cai}`,
    `与本命关系：${daily.relations.map((r) => r.note).join('；') || '无明显冲合'}`,
    `规则评分：${daily.score}/100（${daily.level}）`,
    '',
    '输出要求：3 段以内、每段 ≤60 字：① 今日主题 ② 宜做/避免 ③ 一句提醒（可含方位或时辰）。不要编造盘面，不做医疗/投资断言。',
  ].join('\n');
}

export default function Workbench({ ctx } = {}) {
  const [state, setState] = React.useState(() => loadState());
  const [refreshAt, setRefreshAt] = React.useState(0);
  const [search, setSearch] = React.useState('');
  const [toast, setToast] = React.useState('');

  const activeId = state.activeId || state.profiles[0]?.id || null;
  const profile = state.profiles.find((item) => item.id === activeId) || state.profiles[0] || null;
  const todayKey = localDateKey();

  const daily = React.useMemo(() => {
    if (!profile) return null;
    try {
      return buildDaily({ profile });
    } catch (error) {
      return { error: String(error?.message || error) };
    }
  }, [profile?.id, profile?.solar, profile?.longitude, profile?.use_true_solar, refreshAt]);

  const nodes = React.useMemo(() => (profile ? readNodes(profile.id) : []), [profile?.id, refreshAt]);
  const filtered = React.useMemo(() => {
    const keyword = search.trim();
    const list = [...nodes].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    if (!keyword) return list;
    return list.filter((node) => `${node.question || ''}${node.tags?.join('') || ''}${node.answerSummary || ''}`.includes(keyword));
  }, [nodes, search]);

  const flash = (text) => {
    setToast(text);
    setTimeout(() => setToast(''), 1800);
  };

  const startSession = () => {
    try {
      const started = ctx?.uiWorkspace?.startSession?.();
      if (started) flash('已新建会话');
      else flash('无法新建会话，请用主界面 +');
    } catch {
      flash('无法新建会话，请用主界面 +');
    }
  };

  const askWithPrompt = async () => {
    if (!profile || !daily || daily.error) return;
    try {
      await copyText(buildAiPrompt(profile, daily));
      flash('已复制今日解读提示词，粘贴到对话即可');
    } catch {
      flash('复制失败');
    }
  };

  return React.createElement('div', { className: 'ml-wb' },
    React.createElement('style', { dangerouslySetInnerHTML: { __html: wbCss } }),

    React.createElement('div', { className: 'ml-wb-head' },
      React.createElement('div', { className: 'ml-wb-title' },
        React.createElement('span', { className: 'ml-wb-seal' }, '命'),
        React.createElement('span', null, '命理工作台'),
        React.createElement('span', { className: 'ml-wb-badge' }, '窄版')),
      React.createElement('button', {
        type: 'button', className: 'ml-wb-icon-btn', title: '刷新', onClick: () => setRefreshAt(Date.now()),
      }, '↻')),

    React.createElement('div', { className: 'ml-wb-hintbar' },
      '完整三栏工作台：点会话上方的',
      React.createElement('b', null, '「命理」'),
      '页签（与「对话 / 轨迹」同一排）'),

    React.createElement('div', { className: 'ml-wb-profile' },
      React.createElement('select', {
        className: 'ml-wb-select',
        value: activeId || '',
        onChange: (event) => {
          const next = { ...state, activeId: event.target.value };
          setState(next);
          try { globalThis.localStorage?.setItem('mingli.profiles.v1', JSON.stringify(next)); } catch { /* ignore */ }
        },
        'aria-label': '切换命主',
      },
      state.profiles.length
        ? state.profiles.map((item) => React.createElement('option', { key: item.id, value: item.id },
          `${item.name || '未命名'}${item.gender === 'female' ? '（女）' : '（男）'}`))
        : React.createElement('option', { value: '' }, '暂无命主档案')),
      React.createElement('button', { type: 'button', className: 'ml-wb-btn', onClick: () => requestOpen('命盘') }, '管理')),

    profile
      ? React.createElement(React.Fragment, null,
        daily && !daily.error
          ? React.createElement('div', { className: 'ml-wb-daily' },
            React.createElement('div', { className: 'ml-wb-daily-top' },
              React.createElement('div', null,
                React.createElement('div', { className: 'ml-wb-date' }, daily.date),
                React.createElement('div', { className: 'ml-wb-ganzhi' }, `${daily.ganzhi}日 · ${daily.lunar}`)),
              React.createElement('div', { className: `ml-wb-score ml-wb-score--${scoreTone(daily.score)}` },
                React.createElement('b', null, daily.score),
                React.createElement('span', null, daily.level))),
            React.createElement('div', { className: 'ml-wb-meta' },
              React.createElement('span', null, `值神 ${daily.almanac.zhiShen}·${daily.almanac.zhiShenType}`),
              React.createElement('span', null, `冲${daily.almanac.chong} 煞${daily.almanac.sha}`),
              React.createElement('span', null, `喜${daily.almanac.xi} 财${daily.almanac.cai} 福${daily.almanac.fu}`)),
            React.createElement('div', { className: 'ml-wb-chips' },
              daily.almanac.yi.slice(0, 4).map((text) => React.createElement('span', { key: 'yi-' + text, className: 'ml-wb-chip ml-wb-chip--yi' }, `宜 ${text}`)),
              daily.almanac.ji.slice(0, 3).map((text) => React.createElement('span', { key: 'ji-' + text, className: 'ml-wb-chip ml-wb-chip--ji' }, `忌 ${text}`))),
            React.createElement('pre', { className: 'ml-wb-summary' }, daily.summary),
            React.createElement('div', { className: 'ml-wb-row' },
              React.createElement('button', { type: 'button', className: 'ml-wb-btn', onClick: () => requestOpen('命盘') }, '看盘面')))
          : React.createElement('div', { className: 'ml-wb-error' }, `今日数据生成失败：${daily?.error || '未选择命主'}`))
      : React.createElement('div', { className: 'ml-wb-empty' },
        React.createElement('p', null, '还没有命主档案。'),
        React.createElement('button', { type: 'button', className: 'ml-wb-btn ml-wb-btn--gold', onClick: () => requestOpen('命盘') }, '去新建档案')),

    React.createElement('div', { className: 'ml-wb-section' },
      React.createElement('div', { className: 'ml-wb-section-title' }, '快捷盘面'),
      React.createElement('div', { className: 'ml-wb-quick' },
        QUICK_TABS.map((tab) => React.createElement('button', {
          key: tab, type: 'button', className: 'ml-wb-quick-btn',
          onClick: () => requestOpen(tab),
        }, tab)))),

    React.createElement('div', { className: 'ml-wb-section' },
      React.createElement('div', { className: 'ml-wb-section-title' },
        '提问节点',
        React.createElement('span', { className: 'ml-wb-count' }, String(nodes.length))),
      React.createElement('div', { className: 'ml-wb-row' },
        React.createElement('input', {
          className: 'ml-wb-search', type: 'search', placeholder: '搜索记录…',
          value: search, onChange: (event) => setSearch(event.target.value),
        })),
      filtered.length
        ? React.createElement('div', { className: 'ml-wb-nodes' }, filtered.slice(0, 30).map((node) => React.createElement('div', {
          key: node.id, className: 'ml-wb-node', title: node.question,
        },
        React.createElement('div', { className: 'ml-wb-node-q' }, node.question || '（未记录问题）'),
        React.createElement('div', { className: 'ml-wb-node-meta' },
          React.createElement('span', null, String(node.createdAt || '').slice(0, 16).replace('T', ' ')),
          node.favorite ? React.createElement('span', { className: 'ml-wb-star' }, '★') : null,
          (node.tags || []).slice(0, 2).map((tag) => React.createElement('span', { key: node.id + tag, className: 'ml-wb-tag' }, tag))))))
        : React.createElement('p', { className: 'ml-wb-hint' },
          nodes.length ? '没有匹配的提问。' : '还没有提问记录。在命理会话里提问，这里会自动按问题建立节点。')),

    React.createElement('div', { className: 'ml-wb-foot' }, '仅供传统文化研究与自我反思参考，不构成医疗/法律/投资建议。'),
    toast ? React.createElement('div', { className: 'ml-wb-toast' }, toast) : null);
}
