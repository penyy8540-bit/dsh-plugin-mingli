import React from 'react';
import chartCss from './chart.css';

/* --------------------------------------------------------------------------
 * ChartQimen · 时家奇门 3×3 九宫（洛书方位，上南下北）
 *   巽四 · 离九 · 坤二
 *   震三 · 中五 · 兑七
 *   艮八 · 坎一 · 乾六
 * props: { data } —— engines.qimen() 输出（纯数据）。
 * ------------------------------------------------------------------------ */

/* 洛书方位 → 九宫数字（行优先） */
const LAYOUT = [4, 9, 2, 3, 5, 7, 8, 1, 6];
const GAN_WX = {
  甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土',
  己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水',
};
const WX_CLASS = { 木: 'ml-wx-mu', 火: 'ml-wx-huo', 土: 'ml-wx-tu', 金: 'ml-wx-jin', 水: 'ml-wx-shui' };
const WX_VAR = {
  木: 'var(--ml-jade)',
  火: 'var(--ml-cinnabar)',
  土: 'var(--ml-brown)',
  金: 'var(--ml-gold)',
  水: 'var(--ml-indigo)',
};

const list = (v) => (Array.isArray(v) ? v : []);
const txt = (v) => (v === null || v === undefined || v === '' ? '' : String(v));
const ganWx = (gan) => GAN_WX[gan] || '';

function Style() {
  return React.createElement('style', null, chartCss);
}

function Gan({ char, extra, big, side }) {
  if (!char) {
    return React.createElement('span', { className: `ml-qm-gan${big ? '' : ' ml-qm-gan--di'}` },
      React.createElement('em', null, side),
      React.createElement('small', null, '—'),
    );
  }
  const wx = ganWx(char);
  return React.createElement('span', { className: `ml-qm-gan${big ? '' : ' ml-qm-gan--di'}` },
    React.createElement('em', null, side),
    React.createElement('b', { className: WX_CLASS[wx] }, char),
    wx ? React.createElement('small', null, wx) : null,
    list(extra).map((g, i) => React.createElement('small', {
      key: `x-${g}-${i}`,
      className: WX_CLASS[ganWx(g)] || '',
      title: `同宫奇仪 ${g}`,
    }, `/${g}`)),
  );
}

function Tag({ children, variant }) {
  return React.createElement('span', { className: `ml-qm-tag${variant ? ` ml-qm-tag--${variant}` : ''}` }, children);
}

function Palace({ palace, index }) {
  if (!palace) {
    return React.createElement('div', { className: 'ml-qm-cell', 'data-empty': index },
      React.createElement('div', { className: 'ml-qm-head' },
        React.createElement('span', { className: 'ml-qm-gong' }, '—'),
        React.createElement('span', { className: 'ml-qm-dir' }, '『缺失』'),
      ),
    );
  }
  const isCenter = palace.number === 5;
  const cls = [
    'ml-qm-cell',
    isCenter ? 'ml-qm-cell--center' : '',
    palace.is_zhifu_star ? 'ml-qm-cell--zhifu' : '',
    palace.is_zhishi_gate ? 'ml-qm-cell--zhishi' : '',
    palace.kong_wang ? 'ml-qm-cell--void' : '',
  ].filter(Boolean).join(' ');
  const starWx = palace.star_wuxing || '';
  const gateWx = palace.gate_wuxing || '';

  return React.createElement('div', { className: cls },
    React.createElement('div', { className: 'ml-qm-head' },
      React.createElement('span', { className: 'ml-qm-gong' }, palace.gong || '—'),
      React.createElement('span', { className: 'ml-qm-dir' }, palace.direction || ''),
    ),
    React.createElement('div', { className: 'ml-qm-gans' },
      React.createElement(Gan, {
        char: palace.tianpan_gan,
        extra: palace.tianpan_gan_extra,
        big: true,
        side: isCenter ? '天盘' : '天',
      }),
      React.createElement(Gan, {
        char: palace.dipan_gan,
        extra: palace.dipan_gan_extra,
        big: false,
        side: '地',
      }),
    ),
    React.createElement('div', { className: 'ml-qm-rows' },
      React.createElement('div', { className: 'ml-qm-row' },
        React.createElement('em', null, '九星'),
        React.createElement('span', { className: WX_CLASS[starWx] || '' }, palace.star || '—',
          list(palace.star_extra).map((s) => React.createElement('span', { key: s }, `/${s}`))),
        starWx || palace.star_wangshuai
          ? React.createElement('span', { className: 'wxi' }, `${starWx}${palace.star_wangshuai || ''}`)
          : null,
      ),
      React.createElement('div', { className: 'ml-qm-row' },
        React.createElement('em', null, '八门'),
        palace.gate
          ? React.createElement('span', { className: WX_CLASS[gateWx] || '' }, palace.gate)
          : React.createElement('span', { className: 'ml-muted' }, '—'),
        palace.gate_wangshuai
          ? React.createElement('span', { className: 'wxi' }, `${gateWx}${palace.gate_wangshuai}`)
          : null,
      ),
      React.createElement('div', { className: 'ml-qm-row' },
        React.createElement('em', null, '八神'),
        palace.shen ? React.createElement('span', null, palace.shen) : React.createElement('span', { className: 'ml-muted' }, '—'),
      ),
    ),
    React.createElement('div', { className: 'ml-qm-tags' },
      palace.is_zhifu_star ? React.createElement(Tag, { variant: 'fu' }, '值符星') : null,
      palace.is_zhifu_shen ? React.createElement(Tag, { variant: 'fu' }, '值符神') : null,
      palace.is_zhishi_gate ? React.createElement(Tag, { variant: 'shi' }, '值使门') : null,
      palace.kong_wang ? React.createElement(Tag, { variant: 'kong' }, '空亡') : null,
      isCenter ? React.createElement(Tag, null, '寄坤二宫') : null,
    ),
  );
}

export default function ChartQimen({ data }) {
  const palaces = list(data && data.palaces);

  if (!data || !palaces.length) {
    return React.createElement('section', { className: 'ml-chart ml-qimen' },
      React.createElement(Style),
      React.createElement('header', { className: 'ml-chart-head' },
        React.createElement('h2', { className: 'ml-chart-title' }, '奇门遁甲'),
        React.createElement('span', { className: 'ml-chart-sub' }, '时家 · 九宫'),
        React.createElement('span', { className: 'ml-chart-tail' }, 'QIMEN · 9 PALACES'),
      ),
      React.createElement('div', { className: 'ml-chart-empty' }, '暂无奇门盘数据'),
    );
  }

  const jieqi = data.jieqi || {};
  const zhifu = data.zhifu || {};
  const zhishi = data.zhishi || {};
  const kong = list(data.kong_wang);
  const yongshen = list(data.yongshen);
  const jushu = jieqi.jushu || `${jieqi.yin_yang || ''}${jieqi.ju ? `${jieqi.ju}局` : ''}`;
  const byNumber = (n) => palaces.find((p) => p && p.number === n) || null;

  const meta = [
    ['公历', data.solar || '—'],
    data.lunar ? ['农历', data.lunar] : null,
    data.ganzhi ? ['四柱', data.ganzhi] : null,
    data.time ? ['时辰', `${data.time}${data.time_range ? ` ${data.time_range}` : ''}`] : null,
    data.ask ? ['问事', data.ask] : null,
  ].filter(Boolean);

  return React.createElement('section', { className: 'ml-chart ml-qimen' },
    React.createElement(Style),
    React.createElement('header', { className: 'ml-chart-head' },
      React.createElement('h2', { className: 'ml-chart-title' }, '奇门遁甲'),
      React.createElement('span', { className: 'ml-chart-sub' }, '时家 · 洛书九宫 · 上南下北'),
      React.createElement('span', { className: 'ml-chart-tail' }, 'QIMEN · 9 PALACES'),
    ),
    React.createElement('div', { className: 'ml-chart-meta' },
      meta.map(([k, v]) => React.createElement('span', { key: k },
        React.createElement('span', { className: 'ml-k' }, k),
        k === '四柱' ? React.createElement('b', null, v) : v)),
    ),
    React.createElement('div', { className: 'ml-qm-top' },
      React.createElement('span', { className: 'ml-qm-ju' }, jushu || '—'),
      React.createElement('span', null,
        React.createElement('span', { className: 'ml-k' }, '节气'),
        React.createElement('b', null, `${jieqi.current || '—'}${jieqi.yuan ? ` · ${jieqi.yuan}` : ''}`)),
      React.createElement('span', null,
        React.createElement('span', { className: 'ml-k' }, '旬首'),
        React.createElement('b', null, `${jieqi.xunshou || zhifu.xunshou || '—'}${jieqi.xunshou_yi ? `（遁${jieqi.xunshou_yi}）` : ''}`)),
      React.createElement('span', null,
        React.createElement('span', { className: 'ml-k' }, '值符'),
        React.createElement('b', null, `${zhifu.star || '—'} · ${zhifu.palace || '—'}`)),
      React.createElement('span', null,
        React.createElement('span', { className: 'ml-k' }, '值使'),
        React.createElement('b', null, `${zhishi.gate || '—'} · ${zhishi.palace || '—'}`)),
      kong.length
        ? React.createElement('span', null,
          React.createElement('span', { className: 'ml-k' }, '空亡'),
          React.createElement('b', { className: 'ml-wx-void' }, kong.join('')))
        : null,
    ),
    React.createElement('div', { className: 'ml-qm-board' },
      LAYOUT.map((n, i) => React.createElement(Palace, { key: `${n}-${i}`, palace: byNumber(n), index: i })),
    ),
    yongshen.length
      ? React.createElement('div', { className: 'ml-qm-yongshen' },
        React.createElement('h3', { className: 'ml-block-title' },
          '用神落宫', React.createElement('span', null, 'YONGSHEN')),
        yongshen.map((ys, i) => React.createElement('div', { className: 'ml-qm-ys', key: `ys-${i}` },
          React.createElement('span', { className: 'ml-qm-ys-tag' },
            `用神 · ${ys.target || '—'}${ys.kind ? `（${ys.kind}）` : ''}`),
          React.createElement('span', { className: 'ml-qm-ys-main' },
            React.createElement('b', null, ys.gong || ys.palace || '—'),
            ys.direction ? React.createElement('i', null, `（${ys.direction}）`) : null,
            React.createElement('i', null,
              [ys.tianpan_gan ? `天盘${ys.tianpan_gan}` : '', ys.star, ys.gate, ys.shen].filter(Boolean).join(' · ')),
          ),
          React.createElement('span', { className: 'ml-qm-ys-why' }, ys.why || ''),
        )),
      )
      : null,
  );
}
