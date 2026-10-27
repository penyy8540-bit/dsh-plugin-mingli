/**
 * 人生轨迹 · 多泳道 SVG 时间线
 *
 * 移植自 mingli/tools/timeline.py::render_timeline_svg：
 *  - 横轴年份线性映射（月份做 1/12 年偏移），主轨「实际人生」在上、分支依次向下；
 *  - 节点形状按 kind：event 圆 / milestone 菱形 / decision 方 / turning 三角；important 放大 1.5×；
 *  - source==='model' 加同色虚线外圈；confidence 控制透明度（low 0.8 / medium 0.92 / high 1）；
 *  - 分支从 fork_year 处用虚线从父轨引出（父轨实心点、分支空心点）；
 *  - 可选叠加八字大运色带（bazi.dayun.list 或 bazi.data.dayun.list），只画与显示区间相交的段；
 *  - 标题过长截断加「…」，完整信息放进 <title>；viewBox 自适应容器宽度。
 *
 * props: { timeline, profile, bazi, width = 880, showLegend = true, emptyHint }
 * 纯展示组件：不读 localStorage、不联网、不修改入参。
 */
import React from 'react';

import {
  KIND_LABELS,
  KINDS,
  SOURCE_LABELS,
  CONFIDENCE_LABELS,
  branchColor,
  ageAt,
  formatNodeDate,
  normalizeTimeline,
  sortNodes,
} from './model.js';

const INK = 'var(--ml-ink)';
const MUTED = 'var(--ml-muted)';
const TERTIARY = 'var(--ml-tertiary)';
const LINE = 'var(--ml-line)';
const PAPER = 'var(--ml-paper)';
const SURFACE = 'var(--ml-surface)';
const GOLD = 'var(--ml-gold)';
const BAND_A = 'var(--ml-paper-2)';
const BAND_B = 'var(--ml-gold-soft)';
const CINNABAR = 'var(--ml-cinnabar)';

/** 契约里的十六进制色 → 主题 token（深色模式自动适配）；自定义色保持原值。 */
const COLOR_TO_CSS = {
  '#b8860b': GOLD,
  '#1565c0': 'var(--ml-indigo)',
  '#6a1b9a': 'var(--ml-violet)',
  '#2e7d32': 'var(--ml-jade)',
  '#c62828': CINNABAR,
};

function cssColor(hex, fallback = MUTED) {
  const key = String(hex || '').toLowerCase();
  if (COLOR_TO_CSS[key]) return COLOR_TO_CSS[key];
  return /^#[0-9a-fA-F]{6}$/.test(key) ? key : fallback;
}

/** 文本宽度估算：中文 1em、西文 0.56em（与 Python 版同一套估算）。 */
export function textWidth(text, size = 12) {
  let width = 0;
  for (const char of String(text ?? '')) {
    const code = char.codePointAt(0) || 0;
    if (code < 128) width += 0.56;
    else if ('…“”‘’·—－（）'.includes(char)) width += 0.72;
    else width += 1;
  }
  return width * size;
}

function truncateText(text, maxChars) {
  const value = String(text ?? '');
  if (value.length <= maxChars) return value;
  return `${value.slice(0, Math.max(1, maxChars - 1))}…`;
}

function fitText(text, maxWidth, size = 12) {
  const value = String(text ?? '');
  if (textWidth(value, size) <= maxWidth + 0.5) return value;
  let kept = '';
  for (const char of value) {
    if (textWidth(`${kept}${char}…`, size) > maxWidth) break;
    kept += char;
  }
  return kept ? `${kept}…` : '…';
}

/** 在 rows（每行已占区间）里给「中心 x、宽 width」的标签找位置，返回 [row, 可用宽度]。 */
function placeLabel(x, width, rows, lo, hi, gap = 6) {
  let bestRow = 0;
  let bestAvail = -1;
  for (let row = 0; row < rows.length; row += 1) {
    let left = lo;
    let right = hi;
    for (const [start, end] of rows[row]) {
      if (end <= x) left = Math.max(left, end);
      else if (start >= x) right = Math.min(right, start);
      else {
        left = x;
        right = x;
        break;
      }
    }
    const avail = 2 * Math.min(Math.max(0, x - left - gap), Math.max(0, right - x - gap));
    if (avail >= width - 0.5) return [row, avail];
    if (avail > bestAvail) {
      bestRow = row;
      bestAvail = avail;
    }
  }
  return [bestRow, bestAvail];
}

/** 把「以 center 为中心、宽 width」的标签平移到可视区间内（避免贴边截断）。 */
function clampCenter(center, width, lo, hi, gap = 6) {
  const half = width / 2 + gap;
  if (hi - lo <= width + gap * 2) return Math.min(Math.max(center, lo), hi);
  return Math.min(Math.max(center, lo + half), hi - half);
}

/** 从 bazi 数据 / envelope 中提取大运列表（兼容 bazi.dayun.list、bazi.data.dayun.list 等）。 */
export function extractDayun(bazi) {
  if (!bazi || typeof bazi !== 'object') return [];
  const candidates = [
    bazi?.dayun?.list,
    bazi?.data?.dayun?.list,
    bazi?.data?.bazi?.dayun?.list,
    bazi?.bazi?.dayun?.list,
    Array.isArray(bazi) ? bazi : null,
  ];
  for (const list of candidates) {
    if (!Array.isArray(list)) continue;
    const good = list.filter(
      (item) => item && Number.isInteger(Number(item.start_year)) && Number.isInteger(Number(item.end_year)),
    );
    if (good.length) {
      return good
        .map((item) => ({
          ...item,
          start_year: Number(item.start_year),
          end_year: Number(item.end_year),
          start_age: Number.isFinite(Number(item.start_age)) ? Number(item.start_age) : null,
          end_age: Number.isFinite(Number(item.end_age)) ? Number(item.end_age) : null,
        }))
        .sort((a, b) => a.start_year - b.start_year);
    }
  }
  return [];
}

function axisStep(span) {
  for (const step of [1, 2, 5, 10, 20, 25, 50, 100, 200, 500]) {
    if (span / step <= 12) return step;
  }
  return 1000;
}

function buildNodeTip(node, profile) {
  const age = Number.isInteger(node.age) ? node.age : ageAt(profile, node.year);
  const bits = [String(node.title ?? '')];
  if (node.desc) bits.push(String(node.desc));
  bits.push(`${formatNodeDate(node)} · ${age === null || age === undefined ? '?' : age} 岁`);
  bits.push(KIND_LABELS[node.kind] || '事件');
  if (node.important) bits.push('重要节点');
  if (node.tags?.length) bits.push(`标签：${node.tags.join('、')}`);
  bits.push(`来源：${SOURCE_LABELS[node.source] || '未知'} · ${CONFIDENCE_LABELS[node.confidence] || '未知'}`);
  return bits.filter(Boolean).join('\n');
}

/** 节点形状（圆/菱/方/三角），返回 <g> 便于挂 <title>。 */
function NodeShape({ kind, x, y, scale = 1, color, opacity = 1 }) {
  const radius = 6 * scale;
  const common = {
    style: { fill: color, stroke: SURFACE, strokeWidth: 1.8, opacity },
  };
  let shape;
  if (kind === 'milestone') {
    const r = radius * 1.35;
    shape = (
      <polygon
        points={`${x},${y - r} ${x + r},${y} ${x},${y + r} ${x - r},${y}`}
        {...common}
      />
    );
  } else if (kind === 'decision') {
    const side = radius * 1.9;
    shape = <rect x={x - side / 2} y={y - side / 2} width={side} height={side} rx={1.5} {...common} />;
  } else if (kind === 'turning') {
    shape = (
      <polygon
        points={`${x},${y - radius * 1.75} ${x + radius * 1.55},${y + radius * 1.05} ${x - radius * 1.55},${y + radius * 1.05}`}
        {...common}
      />
    );
  } else {
    shape = <circle cx={x} cy={y} r={radius} {...common} />;
  }
  return shape;
}

function LegendShape({ kind, x, y }) {
  return <NodeShape kind={kind} x={x} y={y} scale={0.72} color={MUTED} opacity={0.9} />;
}

export default function TimelineSvg({
  timeline,
  profile,
  bazi,
  width = 880,
  showLegend = true,
  emptyHint = '尚无轨迹节点 · 从下面「录入事件」添加第一条',
}) {
  const normalized = React.useMemo(() => normalizeTimeline(timeline, profile), [timeline, profile]);
  const branches = normalized.branches;
  const bands = React.useMemo(() => extractDayun(bazi), [bazi]);

  // ---- 显示区间：节点/分叉年份 ±1；跨度 < 4 年扩成 5 年窗口；没有节点时用「今年 ±5」。
  const today = new Date().getFullYear();
  const years = [];
  for (const branch of branches) {
    for (const node of branch.nodes) {
      if (Number.isInteger(node.year)) years.push(node.year);
    }
    if (Number.isInteger(branch.fork_year)) years.push(branch.fork_year);
  }
  let start = years.length ? Math.min(...years) - 1 : today - 5;
  let end = years.length ? Math.max(...years) + 1 : today + 5;
  if (years.length && end - start < 4) {
    const mid = Math.floor((start + end) / 2);
    start = mid - 2;
    end = mid + 2;
  }
  if (end <= start) end = start + 1;
  const span = end - start;

  // ---- 画布与布局（与 Python 版同一套比例）。
  const canvasW = Math.max(Math.round(Number(width) || 880), 560);
  const padL = 58;
  const padR = 30;
  const plotW = canvasW - padL - padR;
  const plotRight = canvasW - padR;
  const laneGap = 84;
  const laneTop = 116;
  const bandTop = 46;
  const bandBottom = laneTop + laneGap * (branches.length - 1) + 34;
  const canvasH = bandBottom + 34;
  const totalNodes = branches.reduce((sum, branch) => sum + branch.nodes.length, 0);

  const xOf = (year, month) => {
    const frac = Number.isInteger(month) && month >= 1 && month <= 12 ? (month - 1) / 12 : 0;
    return padL + Math.min(Math.max((year + frac - start) / span, 0), 1) * plotW;
  };

  const laneColor = (branch, index) => cssColor(branchColor(branch, index), index === 0 ? GOLD : MUTED);

  // ---- 大运色带（背景）
  const bandEls = [];
  bands.forEach((band, index) => {
    const visStart = Math.max(start, band.start_year);
    const visEnd = Math.min(end, band.end_year);
    if (visStart > visEnd) return;
    const x1 = xOf(visStart);
    const x2 = Math.min(plotRight, xOf(visEnd) + plotW / span);
    if (x2 - x1 < 1) return;
    bandEls.push(
      <g key={`band-${band.start_year}-${index}`}>
        <rect
          x={x1}
          y={bandTop}
          width={x2 - x1}
          height={bandBottom - bandTop}
          style={{ fill: index % 2 === 0 ? BAND_A : BAND_B }}
        />
        {x2 - x1 >= textWidth(`${band.ganzhi ?? '?'} 虚岁${band.start_age ?? '?'}-${band.end_age ?? '?'}`, 10.5) + 8 ? (
          <text
            x={(x1 + x2) / 2}
            y={bandTop + 13}
            fontSize={10.5}
            textAnchor="middle"
            style={{ fill: GOLD, opacity: 0.85 }}
          >
            {`${band.ganzhi ?? '?'} 虚岁${band.start_age ?? '?'}-${band.end_age ?? '?'}`}
          </text>
        ) : x2 - x1 >= 26 ? (
          <text x={(x1 + x2) / 2} y={bandTop + 13} fontSize={10.5} textAnchor="middle" style={{ fill: GOLD, opacity: 0.85 }}>
            {band.ganzhi ?? ''}
          </text>
        ) : null}
      </g>,
    );
  });

  // ---- 年份网格与刻度
  const step = axisStep(span);
  const gridEls = [];
  for (let tick = Math.ceil(start / step) * step; tick <= end; tick += step) {
    const x = xOf(tick);
    gridEls.push(
      <line
        key={`grid-${tick}`}
        x1={x}
        y1={bandTop}
        x2={x}
        y2={bandBottom}
        style={{ stroke: LINE, strokeWidth: 1 }}
        strokeDasharray="2 5"
      />,
    );
    gridEls.push(
      <text key={`tick-${tick}`} x={x} y={bandBottom + 17} fontSize={10} textAnchor="middle" style={{ fill: TERTIARY }}>
        {tick}
      </text>,
    );
  }

  // ---- 图例
  const legendItems = KINDS.map((kind) => [kind, KIND_LABELS[kind]]);
  const legendWidths = legendItems.map(([, label]) => textWidth(label, 10.5) + 24);
  const legendTotal = legendWidths.reduce((sum, item) => sum + item, 0) + 6 * (legendItems.length - 1);
  let legendX = plotRight - legendTotal;
  const legendEls = [];
  legendItems.forEach(([kind, label], index) => {
    legendEls.push(<LegendShape key={`legend-shape-${kind}`} kind={kind} x={legendX + 6} y={20} />);
    legendEls.push(
      <text key={`legend-text-${kind}`} x={legendX + 14} y={24} fontSize={10.5} textAnchor="start" style={{ fill: MUTED }}>
        {label}
      </text>,
    );
    legendX += legendWidths[index] + 6;
  });

  // ---- 泳道名（左侧竖排，避免与节点标题打架）
  const laneEls = [];
  const laneColorList = [];
  branches.forEach((branch, index) => {
    const y = laneTop + index * laneGap;
    const color = laneColor(branch, index);
    laneColorList[index] = color;
    laneEls.push(
      <line key={`lane-${branch.id}`} x1={padL} y1={y} x2={plotRight} y2={y} style={{ stroke: LINE, strokeWidth: 1.4 }} />,
    );
    laneEls.push(<circle key={`lane-dot-${branch.id}`} cx={padL - 7} cy={y} r={3} style={{ fill: color }} />);
    const fullName = String(branch.name || branch.id || '分支');
    const laneTip = [
      fullName,
      branch.assumptions?.length ? `假设：${branch.assumptions.join('；')}` : null,
      Number.isInteger(branch.fork_year) ? `分叉于 ${branch.fork_year} 年` : null,
    ]
      .filter(Boolean)
      .join('\n');
    laneEls.push(
      <text
        key={`lane-name-${branch.id}`}
        x={18}
        y={y}
        transform={`rotate(-90 18 ${y})`}
        fill={color}
        fontSize={11.5}
        fontWeight={600}
        textAnchor="middle"
        style={{ fill: color }}
      >
        <title>{laneTip}</title>
        {truncateText(fullName, Math.max(1, Math.floor((laneGap - 8) / 11.5)))}
      </text>,
    );
  });

  // ---- 分支虚线：从父轨 fork_year 引出
  const forkEls = [];
  const laneIndexById = new Map(branches.map((branch, index) => [branch.id, index]));
  branches.forEach((branch, index) => {
    if (branch.kind === 'actual') return;
    const forkYear = branch.fork_year;
    if (!Number.isInteger(forkYear) || forkYear < start || forkYear > end) return;
    const parentIndex = laneIndexById.get(branch.parent);
    const parentY = laneTop + (Number.isInteger(parentIndex) && parentIndex < index ? parentIndex : 0) * laneGap;
    const laneY = laneTop + index * laneGap;
    const forkX = xOf(forkYear);
    const color = laneColorList[index];
    forkEls.push(
      <g key={`fork-${branch.id}`}>
        <path
          d={`M ${forkX},${parentY} L ${forkX},${laneY}`}
          fill="none"
          style={{ stroke: color }}
          strokeWidth={1.6}
          strokeDasharray="5 4"
          strokeLinecap="round"
          opacity={0.85}
        >
          <title>{`分支「${branch.name}」自 ${forkYear} 年实际人生引出`}</title>
        </path>
        <circle cx={forkX} cy={parentY} r={3.2} style={{ fill: color }} />
        <circle cx={forkX} cy={laneY} r={2.4} style={{ fill: SURFACE, stroke: color, strokeWidth: 1.4 }} />
      </g>,
    );
  });

  // ---- 节点与标签（三行标题错位 + 两行副标题错位；超宽截断，全文进 <title>）
  const nodeEls = [];
  branches.forEach((branch, laneIndex) => {
    const laneY = laneTop + laneIndex * laneGap;
    const color = laneColorList[laneIndex];
    const visible = sortNodes(branch.nodes).filter((node) => node.year >= start && node.year <= end);
    const titleRows = [[], [], []];
    const subRows = [[], []];
    visible.forEach((node) => {
      const x = xOf(node.year, node.month);
      const kind = KINDS.includes(node.kind) ? node.kind : 'event';
      const scale = node.important ? 1.5 : 1;
      const opacity = node.confidence === 'low' ? 0.8 : node.confidence === 'medium' ? 0.92 : 1;
      const tip = buildNodeTip(node, profile);
      const age = Number.isInteger(node.age) ? node.age : ageAt(profile, node.year);
      const title = String(node.title ?? '');
      const desired = Math.min(textWidth(title, 12), 210);
      const lo = padL - 2;
      const hi = canvasW - 6;
      const titleCenter = clampCenter(x, desired, lo, hi);
      const [row, avail] = placeLabel(titleCenter, desired, titleRows, lo, hi);
      const shown = desired <= avail + 0.5 ? title : fitText(title, Math.max(30, Math.min(desired, avail)), 12);
      const shownW = textWidth(shown, 12);
      titleRows[row].push([titleCenter - shownW / 2 - 4, titleCenter + shownW / 2 + 4]);
      const offset = 16 + row * 15;
      const sub = `${formatNodeDate(node)}·${age === null || age === undefined ? '?' : age}岁`;
      const subDesired = textWidth(sub, 10);
      const subCenter = clampCenter(x, subDesired, lo, hi);
      const [subRow, subAvail] = placeLabel(subCenter, subDesired, subRows, lo, hi);
      const subShown = subDesired <= subAvail + 0.5 ? sub : fitText(sub, Math.max(34, subAvail), 10);
      const subW = textWidth(subShown, 10);
      subRows[subRow].push([subCenter - subW / 2 - 4, subCenter + subW / 2 + 4]);

      nodeEls.push(
        <g key={`node-${node.id}`}>
          {node.source === 'model' ? (
            <circle
              cx={x}
              cy={laneY}
              r={6 * scale + 3.6}
              fill="none"
              style={{ stroke: color }}
              strokeWidth={1}
              strokeDasharray="2 2.5"
              opacity={0.55}
            />
          ) : null}
          <g>
            <title>{tip}</title>
            <NodeShape kind={kind} x={x} y={laneY} scale={scale} color={color} opacity={opacity} />
          </g>
          {row > 0 ? (
            <line
              x1={x}
              y1={laneY - offset + 4}
              x2={x}
              y2={laneY - 9}
              style={{ stroke: MUTED, strokeWidth: 0.8 }}
              opacity={0.5}
            />
          ) : null}
          <text
            x={titleCenter}
            y={laneY - offset}
            fill={INK}
            fontSize={node.important ? 12.5 : 12}
            fontWeight={node.important ? 600 : 400}
            textAnchor="middle"
            style={{ fill: INK }}
          >
            <title>{tip}</title>
            {shown}
          </text>
          <text x={subCenter} y={laneY + 19 + subRow * 14} fontSize={10} textAnchor="middle" style={{ fill: MUTED }}>
            {subShown}
          </text>
        </g>,
      );
    });
  });

  const chartTitle = `人生轨迹 ${start}–${end} 年`;
  const chartDesc = `${branches.length} 条泳道、${totalNodes} 个节点${bands.length ? '；背景色带为八字大运' : ''}。`;
  const legendNote = bands.length ? '背景色带 = 八字大运 · 重要节点放大' : '重要节点放大';

  return (
    <div className="ml-scroll" style={{ width: '100%', overflowX: 'auto' }}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`0 0 ${canvasW} ${canvasH}`}
        width="100%"
        role="img"
        aria-label={chartTitle}
        preserveAspectRatio="xMidYMid meet"
        style={{ display: 'block', width: '100%', height: 'auto', minWidth: 560, fontFamily: 'var(--ml-serif)' }}
      >
        <title>{chartTitle}</title>
        <desc>{chartDesc}</desc>
        <rect x={0} y={0} width={canvasW} height={canvasH} style={{ fill: PAPER }} />

        {bandEls}

        {start <= today && today <= end ? (
          <g>
            <line
              x1={xOf(today)}
              y1={bandTop}
              x2={xOf(today)}
              y2={bandBottom}
              style={{ stroke: CINNABAR }}
              strokeWidth={1.2}
              strokeDasharray="4 4"
              opacity={0.32}
            />
            <text x={xOf(today) + 3} y={bandTop - 6} fontSize={9} textAnchor="start" style={{ fill: CINNABAR }}>
              今年
            </text>
          </g>
        ) : null}

        {gridEls}
        <line x1={padL} y1={bandBottom} x2={plotRight} y2={bandBottom} style={{ stroke: LINE, strokeWidth: 1.2 }} />

        {showLegend ? (
          <g>
            <text x={padL} y={24} fontSize={10.5} textAnchor="start" style={{ fill: MUTED }}>
              {legendNote}
            </text>
            {legendEls}
          </g>
        ) : null}

        {laneEls}
        {forkEls}
        {nodeEls}

        {totalNodes === 0 ? (
          <g>
            <rect
              x={canvasW / 2 - textWidth(emptyHint, 12) / 2 - 10}
              y={laneTop + 16}
              width={textWidth(emptyHint, 12) + 20}
              height={22}
              rx={6}
              style={{ fill: PAPER }}
            />
            <text x={canvasW / 2} y={laneTop + 30} fontSize={12} textAnchor="middle" style={{ fill: MUTED }}>
              {emptyHint}
            </text>
          </g>
        ) : null}
      </svg>
    </div>
  );
}
