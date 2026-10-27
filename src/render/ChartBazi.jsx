import React from 'react';
import chartCss from './chart.css';

/* --------------------------------------------------------------------------
 * ChartBazi · 四柱盘 + 日主旺衰 + 五行（条形 / 雷达）+ 神煞 / 刑冲合害
 * props: { data } —— engines.bazi() 的输出（纯数据，不读 store / 不发请求）
 * ------------------------------------------------------------------------ */

const PILLAR_KEYS = ['year', 'month', 'day', 'time'];
const WX_ORDER = ['木', '火', '土', '金', '水'];
const WX_CLASS = { 木: 'ml-wx-mu', 火: 'ml-wx-huo', 土: 'ml-wx-tu', 金: 'ml-wx-jin', 水: 'ml-wx-shui' };
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
const ZHI_WX = {
  子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火',
  午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水',
};
const PILLAR_SHORT = { year: '年', month: '月', day: '日', time: '时' };
const ZONES = [
  { label: '弱', flex: 28 },
  { label: '偏弱', flex: 16 },
  { label: '中和', flex: 16 },
  { label: '偏强', flex: 19 },
  { label: '旺', flex: 21 },
];
const REL_GROUPS = [
  ['chong', '冲', 'ml-chip--red'],
  ['he', '六合', 'ml-chip--jade'],
  ['xing', '刑', 'ml-chip--brown'],
  ['hai', '害', 'ml-chip--gold'],
  ['po', '破', ''],
  ['sanhe', '三合', 'ml-chip--jade'],
  ['sanhui', '三会', 'ml-chip--brown'],
  ['banhe', '半合', 'ml-chip--jade'],
  ['fuyin', '伏吟', 'ml-chip--violet'],
  ['gan_he', '干合', 'ml-chip--gold'],
  ['gan_chong', '干冲', 'ml-chip--red'],
];

const num = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const list = (v) => (Array.isArray(v) ? v : []);
const wxOf = (gan, fallback) => fallback || GAN_WX[gan] || '';
const zhiWxOf = (zhi, fallback) => fallback || ZHI_WX[zhi] || '';
const wxClass = (wx) => WX_CLASS[wx] || '';
const wxVar = (wx) => WX_VAR[wx] || 'var(--ml-gold)';
const pillarsText = (pillars) =>
  PILLAR_KEYS.map((k) => (pillars && pillars[k] && pillars[k].ganzhi) || '—').join(' ');

function Style() {
  return React.createElement('style', null, chartCss);
}

function Head({ meta }) {
  return React.createElement(
    React.Fragment,
    null,
    React.createElement('header', { className: 'ml-chart-head' },
      React.createElement('h2', { className: 'ml-chart-title' }, '四柱'),
      React.createElement('span', { className: 'ml-chart-sub' }, '年 · 月 · 日 · 时'),
      React.createElement('span', { className: 'ml-chart-tail' }, 'FOUR PILLARS'),
    ),
    meta ? React.createElement('div', { className: 'ml-chart-meta' }, meta) : null,
  );
}

function MetaItem({ k, children }) {
  return React.createElement('span', null,
    React.createElement('span', { className: 'ml-k' }, k),
    children);
}

/* ---------------- 四柱 grid ---------------- */
function PillarTable({ pillars }) {
  const headCells = PILLAR_KEYS.map((k) => {
    const p = pillars[k] || {};
    return React.createElement('div', {
      key: `h-${k}`,
      className: `ml-bz-head${k === 'day' ? ' ml-bz-col-day' : ''}`,
    },
      p.name || `${PILLAR_SHORT[k]}柱`,
      k === 'day' ? React.createElement('span', { className: 'ml-bz-daytag' }, '日主') : null,
    );
  });

  const rows = [
    ['十神', (p, k) => React.createElement('div', {
      className: `ml-bz-ss${k === 'day' ? ' ml-bz-ss--day' : ''}`,
    }, p.shishen_gan || '日主')],
    ['天干', (p) => {
      const wx = wxOf(p.gan, p.gan_wuxing);
      return React.createElement('div', { className: 'ml-bz-gz' },
        React.createElement('b', { className: `ml-bz-ch ${wxClass(wx)}` }, p.gan || '—'),
        React.createElement('span', { className: 'ml-bz-yinyang' },
          React.createElement('span', null, p.gan_yinyang || ''),
          React.createElement('span', null, wx),
        ),
      );
    }],
    ['地支', (p) => {
      const wx = zhiWxOf(p.zhi, p.zhi_wuxing);
      return React.createElement('div', { className: 'ml-bz-gz' },
        React.createElement('b', { className: `ml-bz-ch ml-bz-ch--zhi ${wxClass(wx)}` }, p.zhi || '—'),
        React.createElement('span', { className: 'ml-bz-yinyang' },
          React.createElement('span', null, p.zhi_yinyang || ''),
          React.createElement('span', null, wx),
        ),
      );
    }],
    ['藏干', (p) => {
      const gans = list(p.hide_gan);
      const wxs = list(p.hide_gan_wuxing);
      const ss = list(p.shishen_zhi);
      if (!gans.length) return React.createElement('div', { className: 'ml-bz-mini' }, '—');
      return React.createElement('div', { className: 'ml-bz-hide' },
        gans.map((g, i) => React.createElement('span', { className: 'ml-bz-hide-item', key: `${g}-${i}` },
          React.createElement('b', { className: wxClass(wxOf(g, wxs[i])) }, g),
          React.createElement('i', null, ss[i] || ''),
        )),
      );
    }],
    ['纳音', (p) => React.createElement('div', { className: 'ml-bz-mini' }, p.nayin || '—')],
    ['旬空', (p) => React.createElement('div', { className: 'ml-bz-mini' }, p.xunkong || '—')],
    ['地势', (p) => React.createElement('div', { className: 'ml-bz-mini' }, p.dishi || '—')],
  ];

  const children = [React.createElement('div', { className: 'ml-bz-corner', key: 'corner' }), ...headCells];
  rows.forEach(([label, render]) => {
    children.push(React.createElement('div', { className: 'ml-bz-rowlabel', key: `l-${label}` }, label));
    PILLAR_KEYS.forEach((k) => {
      children.push(React.createElement('div', {
        key: `${label}-${k}`,
        className: `ml-bz-cell${k === 'day' ? ' ml-bz-col-day' : ''}`,
      }, render(pillars[k] || {}, k)));
    });
  });

  // eslint-disable-next-line no-unused-vars
  return React.createElement('div', { className: 'ml-bz-table' }, children);
}

/* ---------------- 日主旺衰 ---------------- */
function Strength({ dayMaster }) {
  const dm = dayMaster || {};
  const st = dm.strength || {};
  const score = Math.max(0, Math.min(100, num(st.score)));
  const level = st.level || '—';
  const zoneIndex = score >= 80 ? 4 : score >= 61 ? 3 : score >= 45 ? 2 : score >= 28 ? 1 : 0;
  const subs = [
    { label: '得令', value: num(st.de_ling), max: 40 },
    { label: '得地', value: num(st.de_di), max: 30 },
    { label: '得势', value: num(st.de_shi), max: 30 },
  ];

  return React.createElement('div', { className: 'ml-bz-strength' },
    React.createElement('h3', { className: 'ml-block-title' }, '日主旺衰', React.createElement('span', null, 'STRENGTH')),
    React.createElement('div', { className: 'ml-bz-strength-head' },
      React.createElement('span', { className: 'ml-bz-dm' },
        '日主 ',
        React.createElement('b', { className: wxClass(dm.wuxing) }, dm.gan || '—'),
        ` · ${dm.yinyang || ''}${dm.wuxing || ''}`,
      ),
      React.createElement('span', { className: 'ml-bz-level' }, level),
      React.createElement('span', { className: 'ml-bz-score' }, String(score), React.createElement('i', null, '/ 100')),
    ),
    React.createElement('div', { className: 'ml-bz-zones' },
      ZONES.map((z, i) => React.createElement('div', {
        key: z.label,
        className: `ml-bz-zone${i === zoneIndex ? ' is-current' : ''}`,
        style: { flexBasis: `${z.flex}%` },
      }, z.label)),
      React.createElement('div', { className: 'ml-bz-marker', style: { left: `${score}%` }, title: `旺衰得分 ${score}/100` }),
    ),
    React.createElement('div', { className: 'ml-bz-subs' },
      subs.map((s) => {
        const pct = Math.max(0, Math.min(100, (s.value / s.max) * 100));
        return React.createElement('div', { className: 'ml-bz-sub', key: s.label },
          React.createElement('div', { className: 'ml-bz-sub-head' },
            React.createElement('span', null, s.label),
            React.createElement('b', null, `${s.value}/${s.max}`),
          ),
          React.createElement('div', { className: 'ml-bz-sub-track' },
            React.createElement('div', { className: 'ml-bz-sub-fill', style: { width: `${pct}%` } }),
          ),
        );
      }),
    ),
    st.method ? React.createElement('p', { className: 'ml-note' }, st.method) : null,
  );
}

/* ---------------- 五行条形图 ---------------- */
function WuxingBars({ wuxing }) {
  const w = wuxing || {};
  const percent = w.percent || {};
  const count = w.count || {};
  const missing = list(w.missing);
  const maxPct = Math.max(1, ...WX_ORDER.map((k) => num(percent[k])));
  const BAR_MAX = 296;
  const rowH = 35;
  const barX = 36;
  const pctX = barX + BAR_MAX + 12;
  const countX = pctX + 58;
  const height = 6 + WX_ORDER.length * rowH;

  return React.createElement('svg', {
    className: 'ml-bz-bars',
    viewBox: `0 0 470 ${height}`,
    role: 'img',
    'aria-label': '五行分布条形图',
  },
    WX_ORDER.map((k, i) => {
      const pct = num(percent[k]);
      const cnt = num(count[k]);
      const miss = missing.indexOf(k) >= 0;
      const y = 6 + i * rowH;
      const width = Math.max(pct > 0 ? 4 : 0, (pct / maxPct) * BAR_MAX);
      return React.createElement('g', { key: k },
        React.createElement('text', {
          x: 0, y: y + 12, fontSize: 14,
          style: { fontFamily: 'var(--ml-serif)', fill: miss ? 'var(--ml-cinnabar)' : 'var(--ml-ink)' },
        }, k),
        miss ? React.createElement('text', {
          x: countX + 26, y: y + 10.5, fontSize: 9,
          style: { fill: 'var(--ml-cinnabar)', letterSpacing: '0.02em' },
        }, '缺') : null,
        React.createElement('rect', {
          x: barX, y, width: BAR_MAX, height: 11, rx: 5.5,
          style: { fill: 'var(--ml-paper-2)' },
        }),
        React.createElement('rect', {
          x: barX, y, width, height: 11, rx: 5.5,
          style: { fill: wxVar(k), opacity: miss ? 0.3 : 0.85 },
        }),
        React.createElement('text', {
          x: pctX, y: y + 10.5, fontSize: 11.5,
          style: { fill: miss ? 'var(--ml-cinnabar)' : 'var(--ml-ink)', fontVariantNumeric: 'tabular-nums' },
        }, `${num(pct).toFixed(1)}%`),
        React.createElement('text', {
          x: countX, y: y + 10.5, fontSize: 10,
          style: { fill: 'var(--ml-tertiary)' },
        }, `× ${cnt}`),
      );
    }),
  );
}

/* ---------------- 五行雷达图 ---------------- */
function WuxingRadar({ wuxing }) {
  const w = wuxing || {};
  const percent = w.percent || {};
  const missing = list(w.missing);
  const maxPct = Math.max(1, ...WX_ORDER.map((k) => num(percent[k])));
  const cx = 150;
  const cy = 112;
  const R = 74;
  const angle = (i) => ((-90 + i * 72) * Math.PI) / 180;
  const point = (i, r) => [cx + Math.cos(angle(i)) * r, cy + Math.sin(angle(i)) * r];
  const ring = (r) => WX_ORDER.map((_, i) => point(i, r).join(',')).join(' ');
  const dataRing = WX_ORDER.map((k, i) => point(i, R * Math.max(0.04, num(percent[k]) / maxPct)).join(',')).join(' ');

  const labels = WX_ORDER.map((k, i) => {
    const [x, y] = point(i, R + 22);
    const cos = Math.cos(angle(i));
    const sin = Math.sin(angle(i));
    const anchor = Math.abs(cos) < 0.12 ? 'middle' : cos > 0 ? 'start' : 'end';
    const miss = missing.indexOf(k) >= 0;
    return React.createElement('g', { key: `lb-${k}` },
      React.createElement('text', {
        x, y: y + (sin > 0.3 ? 4 : 0), fontSize: 12, textAnchor: anchor,
        style: { fontFamily: 'var(--ml-serif)', fill: miss ? 'var(--ml-cinnabar)' : 'var(--ml-ink)' },
      }, k),
      React.createElement('text', {
        x, y: y + (sin > 0.3 ? 15 : 11), fontSize: 9, textAnchor: anchor,
        style: { fill: miss ? 'var(--ml-cinnabar)' : 'var(--ml-tertiary)', fontVariantNumeric: 'tabular-nums' },
      }, `${num(percent[k]).toFixed(1)}%`),
    );
  });

  return React.createElement('svg', {
    className: 'ml-bz-radar',
    viewBox: '0 0 300 232',
    role: 'img',
    'aria-label': '五行雷达图',
  },
    [0.25, 0.5, 0.75, 1].map((scale, i) => React.createElement('polygon', {
      key: `ring-${i}`,
      points: ring(R * scale),
      fill: 'none',
      style: { stroke: 'var(--ml-hairline)' },
      strokeWidth: 1,
    })),
    WX_ORDER.map((k, i) => {
      const [x, y] = point(i, R);
      return React.createElement('line', {
        key: `axis-${k}`, x1: cx, y1: cy, x2: x, y2: y,
        style: { stroke: 'var(--ml-hairline)' }, strokeWidth: 1,
      });
    }),
    React.createElement('polygon', {
      points: dataRing,
      style: { fill: 'var(--ml-gold)', fillOpacity: 0.16, stroke: 'var(--ml-gold)' },
      strokeWidth: 1.5,
      strokeLinejoin: 'round',
    }),
    WX_ORDER.map((k, i) => {
      const [x, y] = point(i, R * Math.max(0.04, num(percent[k]) / maxPct));
      return React.createElement('circle', {
        key: `dot-${k}`, cx: x, cy: y, r: 2.6,
        style: { fill: wxVar(k) },
      });
    }),
    labels,
    React.createElement('text', {
      x: 150, y: 227, fontSize: 8.5, textAnchor: 'middle',
      style: { fill: 'var(--ml-tertiary)' },
    }, '环刻度 25 / 50 / 75 / 100（按最高五行归一）'),
  );
}

/* ---------------- 神煞 / 关系 chips ---------------- */
function Chips({ bazi }) {
  const shensha = list(bazi.shensha).filter((s) => s && s.name);
  const rel = bazi.relations || {};
  const rows = [];

  if (shensha.length) {
    rows.push(['神煞', shensha.map((s, i) => React.createElement('span', {
      className: 'ml-chip ml-chip--gold', key: `ss-${i}`, title: s.rule || '',
    },
      s.name,
      list(s.pillars).length ? React.createElement('i', null, list(s.pillars).map((p) => PILLAR_SHORT[p] || '').join('')) : null,
    ))]);
  }

  const relChips = [];
  REL_GROUPS.forEach(([key, label, variant]) => {
    list(rel[key]).forEach((item, i) => {
      if (item == null) return;
      if (typeof item === 'string') {
        relChips.push(React.createElement('span', { className: `ml-chip ${variant}`, key: `r-${key}-${i}` },
          React.createElement('b', null, label), ' ', item));
        return;
      }
      const charsSrc = item.zhi || item.gan || [];
      const chars = Array.isArray(charsSrc) ? charsSrc.join('') : String(charsSrc || '');
      const ps = list(item.pillars).map((p) => PILLAR_SHORT[p] || '').join('');
      relChips.push(React.createElement('span', {
        className: `ml-chip ${variant}`, key: `r-${key}-${i}`, title: item.note || '',
      },
        React.createElement('b', null, label),
        chars ? React.createElement('span', null, chars) : null,
        ps ? React.createElement('i', null, ps) : null,
      ));
    });
  });
  if (relChips.length) rows.push(['关系', relChips]);

  if (!rows.length) return null;
  return React.createElement('div', { className: 'ml-bz-extra' },
    rows.map(([label, chips]) => React.createElement('div', { className: 'ml-bz-chiprow', key: label },
      React.createElement('em', null, label),
      React.createElement('div', { className: 'ml-chips' }, chips),
    )),
  );
}

export default function ChartBazi({ data }) {
  if (!data || !data.pillars) {
    return React.createElement('section', { className: 'ml-chart ml-bazi' },
      React.createElement(Style),
      React.createElement(Head, { meta: null }),
      React.createElement('div', { className: 'ml-chart-empty' }, '暂无八字数据'),
    );
  }

  const bazi = data;
  const pillars = bazi.pillars || {};
  const jieqi = bazi.jieqi || {};
  const wuxing = bazi.wuxing || {};
  const dm = bazi.day_master || {};
  const trueSolar = bazi.true_solar || {};

  const meta = [
    React.createElement(MetaItem, { key: 'solar', k: '公历' }, bazi.solar || '—'),
    bazi.lunar ? React.createElement(MetaItem, { key: 'lunar', k: '农历' }, bazi.lunar) : null,
    React.createElement(MetaItem, { key: 'pillars', k: '四柱' },
      React.createElement('b', null, pillarsText(pillars))),
    jieqi.month || jieqi.current_term
      ? React.createElement(MetaItem, { key: 'jieqi', k: '月令' },
        `${jieqi.month || ''}${jieqi.current_term ? ` · ${jieqi.current_term}` : ''}`)
      : null,
    bazi.zodiac ? React.createElement(MetaItem, { key: 'zodiac', k: '生肖' }, bazi.zodiac) : null,
    trueSolar.applied
      ? React.createElement(MetaItem, { key: 'true', k: '真太阳时' },
        `${bazi.solar_true || ''}${typeof trueSolar.delta_minutes === 'number' ? `（${trueSolar.delta_minutes > 0 ? '+' : ''}${trueSolar.delta_minutes} 分）` : ''}`)
      : null,
  ].filter(Boolean);

  const extras = [
    ['胎元', bazi.taiyuan],
    ['命宫', bazi.minggong],
    ['身宫', bazi.shengong],
    ['胎息', bazi.taixi],
  ].filter(([, v]) => v);

  const strongest = wuxing.strongest;
  const weakest = wuxing.weakest;
  const missing = list(wuxing.missing);

  return React.createElement('section', { className: 'ml-chart ml-bazi' },
    React.createElement(Style),
    React.createElement(Head, { meta }),
    React.createElement(PillarTable, { pillars, wuxing }),
    React.createElement(Strength, { dayMaster: dm }),
    React.createElement('div', { className: 'ml-bz-wx' },
      React.createElement('h3', { className: 'ml-block-title' },
        '五行', React.createElement('span', null, 'FIVE ELEMENTS')),
      React.createElement(WuxingBars, { wuxing }),
      React.createElement(WuxingRadar, { wuxing }),
      React.createElement('div', { className: 'ml-bz-wx-foot' },
        strongest ? React.createElement('span', null, React.createElement('b', null, '最旺 '), `${strongest} ${num(wuxing.percent && wuxing.percent[strongest]).toFixed(1)}%`) : null,
        weakest ? React.createElement('span', null, React.createElement('b', null, '最弱 '), `${weakest} ${num(wuxing.percent && wuxing.percent[weakest]).toFixed(1)}%`) : null,
        missing.length ? React.createElement('span', { className: 'ml-wx-void' }, React.createElement('b', null, '表面缺 '), missing.join('、'), '（藏干中仍可能见）') : null,
        wuxing.total_score ? React.createElement('span', null, React.createElement('b', null, '加权总分 '), String(wuxing.total_score)) : null,
      ),
    ),
    React.createElement(Chips, { bazi }),
    extras.length ? React.createElement('div', { className: 'ml-bz-notes' },
      extras.map(([label, value]) => React.createElement('span', { key: label },
        React.createElement('b', null, label), ` ${value}`)),
    ) : null,
  );
}
