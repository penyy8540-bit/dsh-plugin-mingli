import React from 'react';
import chartCss from './chart.css';

/* --------------------------------------------------------------------------
 * ChartZiwei · 经典 4×4 紫微命盘
 * 外圈 12 宫按地支环布（寅在左下，顺时针经卯辰巳…），中心 2×2 为命盘信息区。
 * 点击任意宫 → 下方显示该宫详情。props: { data } —— engines.ziwei() 输出。
 * ------------------------------------------------------------------------ */

/* 地支 → 4×4 棋盘 row/col（0 起）。行优先的 DOM 顺序见 SLOT_ORDER。 */
const POS = {
  巳: [0, 0], 午: [0, 1], 未: [0, 2], 申: [0, 3],
  辰: [1, 0], 酉: [1, 3],
  卯: [2, 0], 戌: [2, 3],
  寅: [3, 0], 丑: [3, 1], 子: [3, 2], 亥: [3, 3],
};
const SLOT_ORDER = (() => {
  const slots = [];
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      if (row >= 1 && row <= 2 && col >= 1 && col <= 2) continue;
      const branch = Object.keys(POS).find((b) => POS[b][0] === row && POS[b][1] === col);
      if (branch) slots.push(branch);
    }
  }
  return slots;
})();
const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const MUT_CLASS = { 禄: 'lu', 权: 'quan', 科: 'ke', 忌: 'ji' };
const MUT_KEYS = ['禄', '权', '科', '忌'];

const list = (v) => (Array.isArray(v) ? v : []);
const num = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

function Style() {
  return React.createElement('style', null, chartCss);
}

function Head() {
  return React.createElement('header', { className: 'ml-chart-head' },
    React.createElement('h2', { className: 'ml-chart-title' }, '紫微斗数'),
    React.createElement('span', { className: 'ml-chart-sub' }, '4×4 · 十二宫 · 四化'),
    React.createElement('span', { className: 'ml-chart-tail' }, 'ZIWEI · 12 PALACES'),
  );
}

function Mut({ value }) {
  const cls = MUT_CLASS[value];
  if (!cls) return null;
  return React.createElement('span', {
    className: `ml-mut ml-mut--${cls}`,
    title: `四化 · ${value}`,
  }, value);
}

function StarName({ star, major }) {
  if (!star || !star.name) return null;
  return React.createElement(React.Fragment, null,
    React.createElement('span', { className: major ? 'ml-zw-star-name' : 'ml-zw-minor-name' }, star.name),
    star.brightness ? React.createElement('sup', null, star.brightness) : null,
    React.createElement(Mut, { value: star.mutagen }),
  );
}

function oppositePalace(palaces, palace) {
  if (!palace) return null;
  const byIndex = palaces.find((p) => p && p.index === ((num(palace.index) + 6) % 12));
  if (byIndex) return byIndex;
  const i = ZHI.indexOf(palace.earthly_branch);
  if (i < 0) return null;
  const branch = ZHI[(i + 6) % 12];
  return palaces.find((p) => p && p.earthly_branch === branch) || null;
}

function PalaceCell({ palace, active, soulBranch, bodyBranch, onSelect }) {
  const branch = palace.earthly_branch || '';
  const isSoul = palace.is_soul_palace || (!!soulBranch && branch === soulBranch);
  const isBody = palace.is_body_palace || (!!bodyBranch && branch === bodyBranch);
  const majors = list(palace.major_stars);
  const minors = list(palace.minor_stars);
  const decadal = palace.decadal || {};
  const range = list(decadal.range);
  const ages = list(palace.ages);

  return React.createElement('button', {
    type: 'button',
    className: [
      'ml-zw-cell',
      isSoul ? 'is-soul' : '',
      isBody ? 'is-body' : '',
      active ? 'is-active' : '',
    ].filter(Boolean).join(' '),
    onClick: () => onSelect(palace.index),
    title: `${palace.name || ''}${palace.ganzhi ? ` · ${palace.ganzhi}` : ''}（点击查看详情）`,
    'aria-pressed': !!active,
  },
    React.createElement('span', { className: 'ml-zw-top' },
      React.createElement('span', { className: 'ml-zw-name' }, palace.name || '—'),
      isSoul ? React.createElement('span', { className: 'ml-zw-flag ml-zw-flag--soul' }, '命') : null,
      isBody ? React.createElement('span', { className: 'ml-zw-flag ml-zw-flag--body' }, '身') : null,
      React.createElement('span', { className: 'ml-zw-gz' }, palace.ganzhi || `${palace.heavenly_stem || ''}${branch}`),
    ),
    majors.length
      ? React.createElement('span', { className: 'ml-zw-stars' },
        majors.map((s, i) => React.createElement('span', { className: 'ml-zw-star', key: `M-${s.name}-${i}` },
          React.createElement(StarName, { star: s, major: true }))))
      : React.createElement('span', { className: 'ml-zw-stars' },
        React.createElement('span', { className: 'ml-zw-empty' }, '空宫'),
      ),
    minors.length
      ? React.createElement('span', { className: 'ml-zw-minor' },
        minors.map((s, i) => React.createElement('span', { key: `m-${s.name}-${i}` },
          React.createElement(StarName, { star: s, major: false }))))
      : null,
    React.createElement('span', { className: 'ml-zw-bot' },
      palace.changsheng12
        ? React.createElement('span', {
          className: 'ml-zw-dec',
          title: '长生十二神',
        }, palace.changsheng12)
        : null,
      range.length === 2
        ? React.createElement('span', { className: 'ml-zw-dec' }, `大限 ${range[0]}–${range[1]}`)
        : null,
      ages.length ? React.createElement('span', null, `小限 ${ages.slice(0, 3).join(' · ')}`) : null,
    ),
  );
}

function Center({ data }) {
  const liunian = data.liunian || {};
  const mutSummary = data.mutagen_summary || {};
  const daxian = list(data.daxian);
  const age = num(liunian.age);
  const decadalFromAge = daxian.find((d) => {
    const r = list(d.range);
    return r.length === 2 && age >= num(r[0]) && age <= num(r[1]);
  });
  const current = liunian.decadal || decadalFromAge || null;
  const currentRange = list(current && (current.range || (current.decadal && current.decadal.range)));
  const yearMut = liunian.mutagen || {};
  const decMut = (liunian.decadal && liunian.decadal.mutagen) || {};

  const facts = [
    ['命主', data.soul || '—'],
    ['身主', data.body || '—'],
    ['五行局', data.five_elements_class || '—'],
    ['命宫', data.soul_palace_branch || '—'],
    ['身宫', `${data.body_palace_name || ''} ${data.body_palace_branch || ''}`.trim() || '—'],
    ['生时', `${data.time || '—'}${data.time_range ? ` ${data.time_range}` : ''}`],
  ];

  const sihuaRow = (muts, prefix) => MUT_KEYS.map((k) => (muts[k]
    ? React.createElement('span', { className: 'ml-zw-sihua-item', key: `${prefix}-${k}` },
      React.createElement(Mut, { value: k }), muts[k])
    : null));

  return React.createElement('div', { className: 'ml-zw-center' },
    React.createElement('div', { className: 'ml-zw-center-title' }, '本命 · 十二宫'),
    React.createElement('dl', { className: 'ml-zw-facts' },
      facts.map(([k, v]) => React.createElement('div', { className: 'ml-zw-fact', key: k },
        React.createElement('dt', null, k),
        React.createElement('dd', { title: v }, v),
      )),
    ),
    React.createElement('div', { className: 'ml-zw-center-line' },
      React.createElement('em', null, '大限'),
      currentRange.length === 2
        ? React.createElement('b', null,
          `${currentRange[0]}–${currentRange[1]} 虚岁`,
          current.palace ? ` · ${current.palace}` : '',
          current.ganzhi ? ` · ${current.ganzhi}` : '')
        : React.createElement('span', null, '—'),
    ),
    React.createElement('div', { className: 'ml-zw-center-line' },
      React.createElement('span', { className: 'ml-zw-sihua' }, sihuaRow(decMut, 'dm')),
    ),
    React.createElement('div', { className: 'ml-zw-center-line' },
      React.createElement('em', null, '流年'),
      liunian.year
        ? React.createElement('b', null,
          `${liunian.year} ${liunian.ganzhi || ''} · 虚岁 ${age}`,
          liunian.palace ? ` · ${liunian.palace}` : '')
        : React.createElement('span', null, '—'),
    ),
    React.createElement('div', { className: 'ml-zw-center-line' },
      React.createElement('span', { className: 'ml-zw-sihua' }, sihuaRow(yearMut, 'ym')),
    ),
    React.createElement('div', { className: 'ml-zw-sihua' },
      MUT_KEYS.map((k) => {
        const items = list(mutSummary[k]);
        if (!items.length) return null;
        const text = items
          .map((it) => (typeof it === 'string' ? it : `${it.star || ''}${it.palace ? `·${it.palace}` : ''}`))
          .join(' / ');
        return React.createElement('span', { className: 'ml-zw-sihua-item', key: `sm-${k}` },
          React.createElement(Mut, { value: k }), text);
      }),
    ),
  );
}

function PalaceDetail({ palace, liunian, palaces, age }) {
  if (!palace) {
    return React.createElement('div', { className: 'ml-zw-detail' },
      React.createElement('div', { className: 'ml-zw-detail-head' },
        React.createElement('span', { className: 'ml-zw-detail-name' }, '宫位详情'),
      ),
      React.createElement('div', { className: 'ml-chart-empty', style: { minHeight: 64 } }, '点选上方任意宫位查看详情'),
    );
  }
  const majors = list(palace.major_stars);
  const minors = list(palace.minor_stars);
  const adjective = list(palace.adjective_stars);
  const decadal = palace.decadal || {};
  const range = list(decadal.range);
  const ages = list(palace.ages);
  const opposite = oppositePalace(palaces, palace);
  const yearly = list(liunian && liunian.palace_map).find((m) => m && m.index === palace.index);

  const field = (label, content, key) => React.createElement('div', { className: 'ml-zw-field', key },
    React.createElement('em', null, label),
    React.createElement('span', null, content),
  );
  const starLine = (stars) => stars.map((s, i) => React.createElement(React.Fragment, { key: `s-${i}` },
    i ? ' · ' : null,
    React.createElement('b', null, s.name),
    s.brightness ? React.createElement('sup', { style: { fontSize: 9, color: 'var(--ml-tertiary)' } }, s.brightness) : null,
    React.createElement(Mut, { value: s.mutagen }),
  ));

  return React.createElement('div', { className: 'ml-zw-detail' },
    React.createElement('div', { className: 'ml-zw-detail-head' },
      React.createElement('span', { className: 'ml-zw-detail-name' },
        palace.name || '宫位',
        React.createElement('i', null, `${palace.ganzhi || ''}${palace.direction ? ` · ${palace.direction}` : ''}`),
      ),
      palace.is_soul_palace ? React.createElement('span', { className: 'ml-chip ml-chip--gold' }, '命宫') : null,
      palace.is_body_palace ? React.createElement('span', { className: 'ml-chip ml-chip--gold' }, '身宫') : null,
      React.createElement('span', { className: 'ml-zw-detail-hint' }, '点选宫位以切换详情'),
    ),
    React.createElement('div', { className: 'ml-zw-detail-grid' },
      field('主星', majors.length ? starLine(majors) : '空宫（借对宫）', 'major'),
      field('辅星', minors.length ? starLine(minors) : '—', 'minor'),
      field('杂曜', adjective.length ? adjective.join(' · ') : '—', 'adj'),
      field('长生 / 博士 / 将前 / 岁前',
        [palace.changsheng12, palace.boshi12, palace.jiangqian12, palace.suiqian12].filter(Boolean).join(' · ') || '—',
        'cycle'),
      field('大限', range.length === 2
        ? `${range[0]}–${range[1]} 虚岁 · ${decadal.ganzhi || `${decadal.heavenly_stem || ''}${decadal.earthly_branch || ''}`}`
        : '—', 'decadal'),
      field('流年宫位', yearly
        ? `${yearly.yearly || ''}${yearly.origin ? `（本命 ${yearly.origin}）` : ''}`
        : '—', 'yearly'),
      field('对宫', opposite
        ? `${opposite.name || ''} ${opposite.ganzhi || ''}：${list(opposite.major_stars).map((s) => s.name).join('、') || '空宫'}`
        : '—', 'opposite'),
      field('小限', ages.length
        ? React.createElement('span', { className: 'ml-zw-ages' },
          ages.map((a) => React.createElement('span', {
            key: a,
            className: `ml-zw-age${a === age ? ' is-now' : ''}`,
          }, String(a))))
        : '—', 'ages'),
    ),
  );
}

export default function ChartZiwei({ data }) {
  const [selected, setSelected] = React.useState(null);
  const palaces = list(data && data.palaces);

  if (!data || !palaces.length) {
    return React.createElement('section', { className: 'ml-chart ml-ziwei' },
      React.createElement(Style),
      React.createElement(Head),
      React.createElement('div', { className: 'ml-chart-empty' }, '暂无紫微命盘数据'),
    );
  }

  const soulPalace = palaces.find((p) => p && p.is_soul_palace) || null;
  const selectedPalace = palaces.find((p) => p && p.index === selected) || soulPalace || palaces[0];
  const liunian = data.liunian || {};
  const age = num(liunian.age);

  const meta = [
    ['命主', data.soul],
    ['身主', data.body],
    ['五行局', data.five_elements_class],
    ['命宫', data.soul_palace_branch],
    ['身宫', `${data.body_palace_name || ''} ${data.body_palace_branch || ''}`.trim()],
    ['生时', `${data.time || ''} ${data.time_range || ''}`.trim()],
    ['四柱', data.chinese_date],
    ['农历', data.lunar],
  ].filter(([, v]) => v);

  return React.createElement('section', { className: 'ml-chart ml-ziwei' },
    React.createElement(Style),
    React.createElement(Head),
    React.createElement('div', { className: 'ml-zw-meta' },
      meta.map(([k, v]) => React.createElement('span', { key: k },
        React.createElement('span', { className: 'ml-k' }, k),
        React.createElement('b', null, v))),
    ),
    React.createElement('div', { className: 'ml-zw-board' },
      SLOT_ORDER.map((branch) => {
        const palace = palaces.find((p) => p && p.earthly_branch === branch) || null;
        if (!palace) {
          const [row, col] = POS[branch];
          return React.createElement('div', {
            key: `empty-${branch}`,
            className: 'ml-zw-cell ml-zw-empty-cell',
            style: { gridRow: row + 1, gridColumn: col + 1 },
          },
            React.createElement('span', { className: 'ml-zw-top' },
              React.createElement('span', { className: 'ml-zw-name' }, '—'),
              React.createElement('span', { className: 'ml-zw-gz' }, branch),
            ),
            React.createElement('span', { className: 'ml-zw-empty' }, '暂无宫位'),
          );
        }
        return React.createElement(PalaceCell, {
          key: `p-${branch}`,
          palace,
          active: !!selectedPalace && selectedPalace.index === palace.index,
          soulBranch: data.soul_palace_branch,
          bodyBranch: data.body_palace_branch,
          onSelect: setSelected,
        });
      }),
      React.createElement(Center, { data }),
    ),
    React.createElement(PalaceDetail, {
      palace: selectedPalace,
      liunian,
      palaces,
      age,
    }),
  );
}
