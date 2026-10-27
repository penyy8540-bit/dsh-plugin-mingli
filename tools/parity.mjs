#!/usr/bin/env node
/**
 * 引擎对照自测：JS 引擎 vs 已验证的 Python 引擎（mingli 技能）。
 *
 * 四个样例：
 *   1) 1990-05-15T10:30 male —— 期望值取自 docs/fixtures/charts.json（Python envelope 的 data.bazi / data.ziwei）
 *   2) 2001-02-03T23:10 female —— 晚子时边界，期望值为 Python 引擎参考值（内嵌常量）
 *   3) 1958-12-31T05:00 male  —— 期望值为 Python 引擎参考值（内嵌常量）
 *   4) 2026-10-26T15:00 申时（阴遁八局）—— 期望值取自 docs/fixtures/qimen.json
 *
 * 输出：每个字段一行 `OK 字段`；不一致时 `MISMATCH 字段 期望=… 实际=…`。有差异退出码 1。
 * 说明：只比对「契约必填 + Python 引擎实际输出」的键；fixture 有而 JS 未输出的可选字段
 *      （如 bazi.liuyue / rules_fired）不参与比对。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBazi } from '../src/engines/bazi.js';
import { buildZiwei } from '../src/engines/ziwei.js';
import { buildQimen } from '../src/engines/qimen.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURES = path.join(ROOT, 'docs', 'fixtures');

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const pick = (obj, dotted) => dotted.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);

// 神煞条目额外补了 zhis（PLUGIN-CONTRACT §2.2），比对时只取 Python 同名字段
const projectShensha = (list) => (list || []).map((s) => ({ name: s.name, pillars: s.pillars, rule: s.rule }));

// 引擎实现库名不同（Python 用 lunar_python、JS 用 lunar-javascript），只影响 hints 文案
const normalizeLib = (v) => JSON.parse(JSON.stringify(v, (key, val) => (
  typeof val === 'string'
    ? val.replace('lunar_python 1.4.8', '<lib>').replace('lunar-javascript', '<lib>')
    : val
)));

// ------------------------------------------------------------------ 参考值（Python 引擎输出）
// 2)、3) 两个样例的期望值由 mingli/tools/lib/bazi.py、ziwei.py 实测生成（year=2026）。
const PY_EXTRA_CASES = [
  {
    solar: '2001-02-03T23:10:00',
    gender: 'female',
    bazi: {
      solar: '2001-02-03T23:10:00',
      lunar: '二〇〇一年正月十一',
      zodiac: '龙',
      pillars: {
        year: ['庚辰', ['戊', '乙', '癸'], ['伤官', '偏印', '七杀']],
        month: ['己丑', ['己', '癸', '辛'], ['食神', '七杀', '偏财']],
        day: ['丁酉', ['辛'], ['偏财']],
        time: ['壬子', ['癸'], ['七杀']],
      },
      wuxing: {
        count: { 木: 0, 火: 1, 土: 3, 金: 2, 水: 2 },
        percent: { 木: 4.8, 火: 9.5, 土: 33.3, 金: 23.3, 水: 29.0 },
      },
      strength: [23, '弱', 20, 3, 0],
      shensha: ['天乙贵人', '文昌贵人', '桃花', '华盖', '将星', '月德贵人', '天德贵人', '寡宿'],
      dayun0: ['戊子', 1, 2010],
      qiyun: [9, 9, 10, false, '2010-11-13'],
      liunian: [
        [2021, '辛丑', 21, '丑辰破', '无', '丁亥'], [2022, '壬寅', 22, '无', '无', '丁亥'],
        [2023, '癸卯', 23, '卯辰害', '卯酉冲', '丁亥'], [2024, '甲辰', 24, '辰辰自刑', '辰酉六合', '丁亥'],
        [2025, '乙巳', 25, '无', '无', '丁亥'], [2026, '丙午', 26, '无', '无', '丁亥'],
        [2027, '丁未', 27, '无', '无', '丁亥'], [2028, '戊申', 28, '无', '无', '丁亥'],
        [2029, '己酉', 29, '酉辰六合', '酉酉自刑', '丁亥'], [2030, '庚戌', 30, '戌辰冲', '戌酉害', '丙戌'],
        [2031, '辛亥', 31, '无', '无', '丙戌'],
      ],
    },
    ziwei: {
      lunar: '二〇〇一年正月十一',
      chinese_date: '庚辰 己丑 戊戌 壬子',
      time: '晚子时',
      time_range: '23:00~23:59',
      time_index: 12,
      five_elements_class: '土五局',
      soul: '禄存',
      body: '文昌',
      soul_palace_branch: '寅',
      body_palace_branch: '寅',
      palaces: [
        [0, '命宫', '寅', [], true], [1, '父母', '卯', ['天府'], false],
        [2, '福德', '辰', ['太阴'], false], [3, '田宅', '巳', ['廉贞', '贪狼'], false],
        [4, '官禄', '午', ['巨门'], false], [5, '交友', '未', ['天相'], false],
        [6, '迁移', '申', ['天同', '天梁'], false], [7, '疾厄', '酉', ['武曲', '七杀'], false],
        [8, '财帛', '戌', ['太阳'], false], [9, '子女', '亥', [], false],
        [10, '夫妻', '子', ['天机'], false], [11, '兄弟', '丑', ['紫微', '破军'], false],
      ],
      liunian: [2026, 26, '丙午', '官禄', '午'],
    },
  },
  {
    solar: '1958-12-31T05:00:00',
    gender: 'male',
    bazi: {
      solar: '1958-12-31T05:00:00',
      lunar: '一九五八年冬月廿一',
      zodiac: '狗',
      pillars: {
        year: ['戊戌', ['戊', '辛', '丁'], ['七杀', '正印', '正财']],
        month: ['甲子', ['癸'], ['劫财']],
        day: ['壬午', ['丁', '己'], ['正财', '正官']],
        time: ['癸卯', ['乙'], ['伤官']],
      },
      wuxing: {
        count: { 木: 2, 火: 1, 土: 2, 金: 0, 水: 3 },
        percent: { 木: 20.4, 火: 13.3, 土: 25.5, 金: 5.1, 水: 35.7 },
      },
      strength: [63, '偏强', 40, 15, 8],
      shensha: ['天乙贵人', '羊刃', '桃花', '华盖', '将星', '月德贵人'],
      dayun0: ['乙丑', 1, 1961],
      qiyun: [2, 0, 20, true, '1961-01-20'],
      liunian: [
        [2021, '辛丑', 64, '丑戌刑', '丑午害', '辛未'], [2022, '壬寅', 65, '无', '无', '辛未'],
        [2023, '癸卯', 66, '卯戌六合', '卯午破', '辛未'], [2024, '甲辰', 67, '辰戌冲', '无', '辛未'],
        [2025, '乙巳', 68, '无', '无', '辛未'], [2026, '丙午', 69, '无', '午午自刑', '辛未'],
        [2027, '丁未', 70, '未戌破刑', '未午六合', '辛未'], [2028, '戊申', 71, '无', '无', '辛未'],
        [2029, '己酉', 72, '酉戌害', '无', '辛未'], [2030, '庚戌', 73, '无', '无', '辛未'],
        [2031, '辛亥', 74, '无', '无', '壬申'],
      ],
    },
    ziwei: {
      lunar: '一九五八年冬月廿一',
      chinese_date: '戊戌 甲子 壬午 癸卯',
      time: '卯时',
      time_range: '05:00~06:59',
      time_index: 3,
      five_elements_class: '木三局',
      soul: '文曲',
      body: '文昌',
      soul_palace_branch: '酉',
      body_palace_branch: '卯',
      palaces: [
        [0, '交友', '寅', ['七杀'], false], [1, '迁移', '卯', ['天同'], true],
        [2, '疾厄', '辰', ['武曲'], false], [3, '财帛', '巳', ['太阳'], false],
        [4, '子女', '午', ['破军'], false], [5, '夫妻', '未', ['天机'], false],
        [6, '兄弟', '申', ['紫微', '天府'], false], [7, '命宫', '酉', ['太阴'], false],
        [8, '父母', '戌', ['贪狼'], false], [9, '福德', '亥', ['巨门'], false],
        [10, '田宅', '子', ['廉贞', '天相'], false], [11, '官禄', '丑', ['天梁'], false],
      ],
      liunian: [2026, 69, '丙午', '子女', '午'],
    },
  },
];

// ------------------------------------------------------------------ 比对框架
const rows = [];
let checked = 0;
const fmt = (v) => {
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s.length > 220 ? `${s.slice(0, 217)}…` : s;
};

/** 逐路径比对 expected 与 actual（深比较用 JSON 序列化）。 */
function comparePaths(prefix, expected, actual, paths) {
  let okCount = 0;
  for (const p of paths) {
    checked += 1;
    const exp = pick(expected, p);
    const act = pick(actual, p);
    if (JSON.stringify(exp) === JSON.stringify(act)) {
      okCount += 1;
      continue;
    }
    rows.push({ ok: false, label: `${prefix}.${p}`, expected: exp, actual: act });
  }
  if (okCount === paths.length) rows.push({ ok: true, label: `${prefix}（${okCount} 项）` });
}

/** 逐顶层键比对两个对象。 */
function compareKeys(prefix, expected, actual) {
  let okCount = 0;
  const keys = Object.keys(expected);
  for (const k of keys) {
    checked += 1;
    const exp = expected[k];
    const act = actual[k];
    if (JSON.stringify(exp) === JSON.stringify(act)) {
      okCount += 1;
      continue;
    }
    rows.push({ ok: false, label: `${prefix}.${k}`, expected: exp, actual: act });
  }
  if (okCount === keys.length) rows.push({ ok: true, label: `${prefix}（${okCount} 项）` });
}

// ------------------------------------------------------------------ 1) 双盘 fixture（charts.json）
function runChartsFixture() {
  const envelope = readJson(path.join(FIXTURES, 'charts.json'));
  const fixture = envelope.data;
  const input = envelope.input || {};
  const options = input.options || {};
  const year = fixture.bazi.liunian[Math.floor(fixture.bazi.liunian.length / 2)].year;
  const profile = {
    solar: input.solar,
    gender: input.gender,
    longitude: options.longitude == null ? null : options.longitude,
    use_eot: options.use_eot !== false,
    use_true_solar: options.longitude != null,
    year,
  };
  const bazi = buildBazi(profile);
  const ziwei = buildZiwei(profile);

  const expectedBazi = {
    ...fixture.bazi,
    hints: normalizeLib(fixture.bazi.hints),
    shensha: projectShensha(fixture.bazi.shensha),
  };
  const actualBazi = {
    ...bazi,
    hints: normalizeLib(bazi.hints),
    shensha: projectShensha(bazi.shensha),
  };
  comparePaths('bazi', expectedBazi, actualBazi, [
    'solar', 'lunar', 'solar_true', 'true_solar', 'zodiac', 'jieqi', 'pillars',
    'day_master', 'wuxing', 'relations', 'shensha', 'taiyuan', 'minggong',
    'shengong', 'taixi', 'dayun', 'liunian', 'hints',
  ]);

  const expectedZiwei = { ...fixture.ziwei, hints: normalizeLib(fixture.ziwei.hints) };
  const actualZiwei = { ...ziwei, hints: normalizeLib(ziwei.hints) };
  comparePaths('ziwei', expectedZiwei, actualZiwei, [
    'solar', 'lunar', 'chinese_date', 'time', 'time_range', 'time_range_iztro',
    'zodiac', 'sign', 'gender', 'time_index', 'five_elements_class', 'soul', 'body',
    'soul_palace_branch', 'body_palace_branch', 'soul_palace_name', 'body_palace_name',
    'palaces', 'mutagen_summary', 'daxian', 'liunian', 'solar_true', 'hints',
  ]);
}

// ------------------------------------------------------------------ 2) 内嵌 Python 参考值（两个边界样例）
function compactBazi(b) {
  const pillars = {};
  for (const k of ['year', 'month', 'day', 'time']) {
    pillars[k] = [b.pillars[k].ganzhi, b.pillars[k].hide_gan, b.pillars[k].shishen_zhi];
  }
  return {
    solar: b.solar,
    lunar: b.lunar,
    zodiac: b.zodiac,
    pillars,
    wuxing: { count: b.wuxing.count, percent: b.wuxing.percent },
    strength: [b.day_master.strength.score, b.day_master.strength.level,
      b.day_master.strength.de_ling, b.day_master.strength.de_di, b.day_master.strength.de_shi],
    shensha: b.shensha.map((s) => s.name),
    dayun0: [b.dayun.list[0].ganzhi, b.dayun.list[0].index, b.dayun.list[0].start_year],
    qiyun: [b.dayun.qiyun.years, b.dayun.qiyun.months, b.dayun.qiyun.days,
      b.dayun.qiyun.forward, b.dayun.qiyun.solar],
    liunian: b.liunian.map((x) => [x.year, x.ganzhi, x.age, x.relations_to_year, x.relations_to_day, x.dayun_ganzhi]),
  };
}

function compactZiwei(z) {
  return {
    lunar: z.lunar,
    chinese_date: z.chinese_date,
    time: z.time,
    time_range: z.time_range,
    time_index: z.time_index,
    five_elements_class: z.five_elements_class,
    soul: z.soul,
    body: z.body,
    soul_palace_branch: z.soul_palace_branch,
    body_palace_branch: z.body_palace_branch,
    palaces: z.palaces.map((p) => [p.index, p.name, p.earthly_branch, p.major_stars.map((s) => s.name), p.is_body_palace]),
    liunian: [z.liunian.year, z.liunian.age, z.liunian.ganzhi, z.liunian.palace, z.liunian.palace_branch],
  };
}

function runEmbeddedCase(ref) {
  const profile = { solar: ref.solar, gender: ref.gender, year: 2026 };
  compareKeys('bazi', ref.bazi, compactBazi(buildBazi(profile)));
  compareKeys('ziwei', ref.ziwei, compactZiwei(buildZiwei(profile)));
}

// ------------------------------------------------------------------ 3) 奇门 fixture（qimen.json）
function runQimenFixture() {
  const envelope = readJson(path.join(FIXTURES, 'qimen.json'));
  const input = envelope.input || {};
  const options = input.options || {};
  const qimen = buildQimen({
    solar: input.solar,
    ask: options.ask == null ? null : options.ask,
    gender: input.gender,
    longitude: options.longitude == null ? null : options.longitude,
    use_eot: options.use_eot !== false,
    use_true_solar: options.longitude != null,
  });
  comparePaths('qimen', envelope.data, qimen, [
    'solar', 'solar_true', 'true_solar', 'gender', 'lunar', 'ganzhi', 'pillars',
    'time', 'time_range', 'ask', 'jieqi', 'zhifu', 'zhishi', 'palaces',
    'kong_wang', 'kong_wang_info', 'yongshen', 'hints', 'notes', 'note',
  ]);
}

// ------------------------------------------------------------------ 主流程
const CASES = [
  {
    title: 'bazi + ziwei · 1990-05-15T10:30 male（fixture charts.json，longitude=116.4 真太阳时）',
    run: runChartsFixture,
  },
  {
    title: 'bazi + ziwei · 2001-02-03T23:10 female（晚子时 time_index=12，Python 参考值）',
    run: () => runEmbeddedCase(PY_EXTRA_CASES[0]),
  },
  {
    title: 'bazi + ziwei · 1958-12-31T05:00 male（Python 参考值）',
    run: () => runEmbeddedCase(PY_EXTRA_CASES[1]),
  },
  {
    title: 'qimen · 2026-10-26T15:00 申时 · 阴遁八局（fixture qimen.json）',
    run: runQimenFixture,
  },
];

let failed = 0;
CASES.forEach((testCase, i) => {
  console.log('');
  console.log('='.repeat(96));
  console.log(`样例 ${i + 1}/${CASES.length}：${testCase.title}`);
  console.log('='.repeat(96));
  const before = rows.length;
  try {
    testCase.run();
  } catch (e) {
    rows.push({ ok: false, label: 'engine.exception', expected: 'no throw', actual: `${e.code || ''} ${e.message}` });
  }
  const caseRows = rows.slice(before);
  for (const row of caseRows) {
    if (row.ok) {
      console.log(`OK        ${row.label}`);
    } else {
      failed += 1;
      console.log(`MISMATCH  ${row.label}  期望=${fmt(row.expected)}  实际=${fmt(row.actual)}`);
    }
  }
});

const okCount = rows.filter((r) => r.ok).length;
const totalFields = rows.reduce((acc, r) => acc + (r.ok ? Number((r.label.match(/（(\d+) 项）/) || [])[1] || 1) : 1), 0);
console.log('');
console.log('='.repeat(96));
console.log(`对照结果：${failed === 0 ? '全部一致 ✔' : '存在差异 ✘'}  检查项=${checked + failed}  差异=${failed}`);
console.log('='.repeat(96));
process.exit(failed === 0 ? 0 : 1);
