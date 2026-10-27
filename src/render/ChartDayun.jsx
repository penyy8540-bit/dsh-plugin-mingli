import React from 'react';
import chartCss from './chart.css';

/* --------------------------------------------------------------------------
 * ChartDayun · 横向大运轴（10 年一步）+ 流年刻度
 * props: { data, currentYear } —— data 为 engines.bazi() 输出（使用 dayun / liunian）。
 * ------------------------------------------------------------------------ */

const WX_VAR = {
  木: 'var(--ml-jade)',
  火: 'var(--ml-cinnabar)',
  土: 'var(--ml-brown)',
  金: 'var(--ml-gold)',
  水: 'var(--ml-indigo)',
};
const GAN_WX = {
  甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土',
  己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水',
};
const WX_CLASS = { 木: 'ml-wx-mu', 火: 'ml-wx-huo', 土: 'ml-wx-tu', 金: 'ml-wx-jin', 水: 'ml-wx-shui' };

const list = (v) => (Array.isArray(v) ? v : []);
const num = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const wxOf = (step) => step.gan_wuxing || GAN_WX[step.gan] || '';

function Style() {
  return React.createElement('style', null, chartCss);
}

function Head() {
  return React.createElement('header', { className: 'ml-chart-head' },
    React.createElement('h2', { className: 'ml-chart-title' }, '大运 · 流年'),
    React.createElement('span', { className: 'ml-chart-sub' }, '十年一步 · 流年刻度'),
    React.createElement('span', { className: 'ml-chart-tail' }, 'LUCK CYCLES'),
  );
}

export default function ChartDayun({ data, currentYear }) {
  const year = typeof currentYear === 'number' && Number.isFinite(currentYear)
    ? currentYear
    : new Date().getFullYear();
  const dayun = (data && data.dayun) || {};
  const steps = list(dayun.list);
  const liunian = list(data && data.liunian);
  const qiyun = dayun.qiyun || {};

  if (!steps.length && !liunian.length) {
    return React.createElement('section', { className: 'ml-chart ml-dayun' },
      React.createElement(Style),
      React.createElement(Head),
      React.createElement('div', { className: 'ml-chart-empty' }, '暂无大运流年数据'),
    );
  }

  const currentStep = steps.find((s) => s && year >= num(s.start_year) && year <= num(s.end_year)) || null;
  const currentQiyun = qiyun;

  const qiyunText = [
    currentQiyun.solar ? `起运 ${currentQiyun.solar}` : '',
    currentQiyun.years || currentQiyun.months || currentQiyun.days
      ? `${num(currentQiyun.years)} 年 ${num(currentQiyun.months)} 月 ${num(currentQiyun.days)} 天`
      : '',
    currentQiyun.forward === true ? '顺行' : currentQiyun.forward === false ? '逆行' : '',
  ].filter(Boolean);

  const meta = [
    data && data.solar ? ['公历', data.solar] : null,
    data && data.day_master && data.day_master.gan
      ? ['日主', `${data.day_master.gan} · ${data.day_master.wuxing || ''}${data.day_master.yinyang || ''}`]
      : null,
    dayun.start_age !== undefined ? ['起运周岁', `${dayun.start_age}`] : null,
    ['今年', `${year} 年`],
  ].filter(Boolean);

  return React.createElement('section', { className: 'ml-chart ml-dayun' },
    React.createElement(Style),
    React.createElement(Head),
    React.createElement('div', { className: 'ml-chart-meta' },
      meta.map(([k, v]) => React.createElement('span', { key: k },
        React.createElement('span', { className: 'ml-k' }, k),
        k === '今年' ? React.createElement('b', { className: 'ml-wx-jin' }, v) : v)),
    ),
    React.createElement('div', { className: 'ml-dy-qiyun' },
      React.createElement('span', { className: 'ml-dy-tag' }, '起运'),
      qiyunText.length
        ? qiyunText.map((t, i) => React.createElement('span', { key: `q-${i}` },
          i === 0 ? React.createElement('b', null, t) : t))
        : React.createElement('span', null, '—'),
      currentQiyun.rule
        ? React.createElement('span', { className: 'ml-rule' }, currentQiyun.rule)
        : null,
    ),
    React.createElement('div', { className: 'ml-dy-rail' },
      React.createElement('span', { className: 'ml-dy-rail-line' }),
      React.createElement('span', { className: 'ml-dy-rail-dot' }),
      React.createElement('span', { className: 'ml-dy-rail-label' },
        currentQiyun.solar
          ? `起运标记 ${currentQiyun.solar}${steps[0] ? ` · 首运 ${steps[0].ganzhi || ''}` : ''}`
          : '起运标记'),
    ),
    React.createElement('div', { className: 'ml-dy-axis' },
      steps.map((s, i) => {
        const wx = wxOf(s);
        const now = currentStep === s;
        return React.createElement('div', {
          key: `${s.index || i}-${s.ganzhi || i}`,
          className: `ml-dy-step${now ? ' is-now' : ''}`,
          style: { '--ml-wx-color': WX_VAR[wx] || 'var(--ml-gold)' },
          title: [
            s.ganzhi ? `${s.ganzhi}` : '',
            s.start_year && s.end_year ? `${s.start_year}–${s.end_year}` : '',
            s.shishen_gan ? `天干十神：${s.shishen_gan}` : '',
            s.nayin ? `纳音：${s.nayin}` : '',
          ].filter(Boolean).join(' · '),
        },
          now ? React.createElement('span', { className: 'ml-dy-nowtag' }, '当前') : null,
          React.createElement('div', { className: `ml-dy-gz ${WX_CLASS[wx] || ''}` }, s.ganzhi || '—'),
          React.createElement('div', { className: 'ml-dy-age' },
            s.start_age !== undefined && s.end_age !== undefined
              ? `${s.start_age}–${s.end_age} 岁`
              : '—'),
          React.createElement('div', { className: 'ml-dy-year' },
            s.start_year !== undefined && s.end_year !== undefined
              ? `${s.start_year}–${s.end_year}`
              : ''),
          React.createElement('div', { className: 'ml-dy-ss' }, s.shishen_gan || ''),
        );
      }),
    ),
    liunian.length
      ? React.createElement(React.Fragment, null,
        React.createElement('div', { className: 'ml-dy-liunian-head' },
          React.createElement('h3', { className: 'ml-block-title' },
            '流年刻度', React.createElement('span', null, 'ANNUAL')),
          React.createElement('span', { className: 'ml-hint' },
            `共 ${liunian.length} 年 · 金色为当前年份`),
        ),
        React.createElement('div', { className: 'ml-dy-liunian' },
          liunian.map((ly) => {
            const now = num(ly.year) === year;
            return React.createElement('div', {
              key: ly.year,
              className: `ml-dy-year-cell${now ? ' is-now' : ''}`,
              title: [
                `${ly.year} ${ly.ganzhi || ''}`,
                ly.shishen_gan ? `十神：${ly.shishen_gan}` : '',
                ly.relations_to_year ? `与年支：${ly.relations_to_year}` : '',
                ly.relations_to_day ? `与日支：${ly.relations_to_day}` : '',
                ly.dayun_ganzhi ? `所属大运：${ly.dayun_ganzhi}` : '',
              ].filter(Boolean).join(' · '),
            },
              now ? React.createElement('span', { className: 'ml-dy-ly-now' }, '今年') : null,
              React.createElement('span', { className: 'ml-dy-ly-year' }, String(ly.year || '')),
              React.createElement('span', { className: `ml-dy-ly-gz ${WX_CLASS[GAN_WX[ly.gan] || ''] || ''}` }, ly.ganzhi || '—'),
              React.createElement('span', { className: 'ml-dy-ly-age' },
                ly.age !== undefined ? `虚岁 ${ly.age}` : ''),
              React.createElement('span', { className: 'ml-dy-ly-ss' }, ly.shishen_gan || ''),
            );
          }),
        ),
      )
      : null,
    React.createElement('div', { className: 'ml-dy-foot' },
      currentStep
        ? React.createElement('span', null,
          React.createElement('b', null, '当前大运 '),
          `${currentStep.ganzhi || ''}（${num(currentStep.start_year)}–${num(currentStep.end_year)} · 虚岁 ${num(currentStep.start_age)}–${num(currentStep.end_age)}）`,
          currentStep.shishen_gan ? ` · 天干十神 ${currentStep.shishen_gan}` : '')
        : null,
      React.createElement('span', null, '大运按 10 年一步，色条取运干五行；流年虚岁以出生年为 1 岁。'),
    ),
  );
}
