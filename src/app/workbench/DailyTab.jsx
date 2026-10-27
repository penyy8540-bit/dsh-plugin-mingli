import React from 'react';

/** Full daily almanac + six-aspect reading (almanac × natal chart). */
export default function DailyTab({ daily, profile }) {
  if (!daily || daily.error) {
    return React.createElement('div', { className: 'ml-dt-empty' },
      daily?.error ? `今日数据未就绪：${daily.error}` : '选择命主后显示黄历');
  }
  const a = daily.almanac || {};
  const aspects = daily.aspects || [];

  return React.createElement('div', { className: 'ml-dt' },
    React.createElement('div', { className: 'ml-dt-head' },
      React.createElement('div', null,
        React.createElement('div', { className: 'ml-dt-date' }, `${daily.date} · ${daily.ganzhi}日`),
        React.createElement('div', { className: 'ml-dt-lunar' },
          `${daily.lunar} · 值神${a.zhiShen}（${a.zhiShenType}） · 建除「${a.jian}」`),
        React.createElement('div', { className: 'ml-dt-who' },
          `${profile?.name || '命主'} · 日主${daily.dayMaster?.gan || ''}${daily.dayMaster?.wuxing || ''}` +
          `${daily.dayMaster?.level ? `（${daily.dayMaster.level}）` : ''} · 今日十神${daily.tenGod || '—'}`)),
      React.createElement('div', { className: 'ml-dt-score' },
        React.createElement('b', null, String(daily.score)),
        React.createElement('span', null, daily.level))),

    React.createElement('div', { className: 'ml-dt-grid' },
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
          : null))),

    React.createElement('div', { className: 'ml-dt-section' },
      React.createElement('div', { className: 'ml-dt-title' }, '宜'),
      React.createElement('div', { className: 'ml-dt-chips' },
        (a.yi || []).length
          ? a.yi.map((item) => React.createElement('span', { key: item, className: 'ml-dt-chip ml-dt-chip--yi' }, item))
          : React.createElement('span', { className: 'ml-dt-muted' }, '无'))),

    React.createElement('div', { className: 'ml-dt-section' },
      React.createElement('div', { className: 'ml-dt-title' }, '忌'),
      React.createElement('div', { className: 'ml-dt-chips' },
        (a.ji || []).length
          ? a.ji.map((item) => React.createElement('span', { key: item, className: 'ml-dt-chip ml-dt-chip--ji' }, item))
          : React.createElement('span', { className: 'ml-dt-muted' }, '无'))),

    React.createElement('div', { className: 'ml-dt-grid2' },
      React.createElement('div', { className: 'ml-dt-section' },
        React.createElement('div', { className: 'ml-dt-title' }, '吉神'),
        React.createElement('div', { className: 'ml-dt-chips' },
          (a.jiShen || []).map((item) => React.createElement('span', { key: item, className: 'ml-dt-chip' }, item)))),
      React.createElement('div', { className: 'ml-dt-section' },
        React.createElement('div', { className: 'ml-dt-title' }, '凶煞'),
        React.createElement('div', { className: 'ml-dt-chips' },
          (a.xiongSha || []).map((item) => React.createElement('span', { key: item, className: 'ml-dt-chip ml-dt-chip--ji' }, item))))),

    React.createElement('div', { className: 'ml-dt-meta' },
      `冲${a.chong}煞${a.sha} · 喜神${a.xi} · 财神${a.cai} · 福神${a.fu}`),
    React.createElement('div', { className: 'ml-dt-meta' },
      `彭祖百忌：${a.pengzuGan || '—'}；${a.pengzuZhi || '—'}`),

    React.createElement('div', { className: 'ml-dt-explain' },
      React.createElement('div', { className: 'ml-dt-explain-title' }, '今日解读'),
      String(daily.explain || '').split('\n').filter(Boolean).map((line, index) => React.createElement('p', { key: index }, line))),

    React.createElement('div', { className: 'ml-dt-note' },
      '双标准说明：黄历宜忌按事项类别映射到六大领域，再叠加今日干支与本命四柱的冲合刑害、十神关系与喜用五行；分数为规则推演，仅供传统文化研究与自我参照。'));
}
