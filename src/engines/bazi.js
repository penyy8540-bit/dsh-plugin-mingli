/**
 * 八字引擎（浏览器端，纯 ESM）
 *
 * 与 `mingli/tools/lib/bazi.py` 逐字段对齐：四柱、十神、藏干、纳音、旬空、地势、
 * 五行加权统计、日主旺衰（三要素加权 v1）、刑冲合害/伏吟、神煞、起运 + 8 步大运、
 * 今年 ±5 的流年、hints（只写客观盘面事实，禁吉凶/建议）。
 *
 * 依赖 lunar-javascript（API 与 lunar_python 同源）；藏干/十神/关系/神煞表按
 * mingli/tools/lib/common.py 原样移植，避免两库藏干次序差异导致十神顺序不同。
 */
import lua from 'lunar-javascript';

const { Solar, LunarUtil } = lua;

// ------------------------------------------------------------------ 基础表
const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const GAN_WUXING = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
const GAN_YINYANG = { 甲: '阳', 乙: '阴', 丙: '阳', 丁: '阴', 戊: '阳', 己: '阴', 庚: '阳', 辛: '阴', 壬: '阳', 癸: '阴' };
const ZHI_WUXING = { 子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水' };
const ZHI_YINYANG = { 子: '阳', 丑: '阴', 寅: '阳', 卯: '阴', 辰: '阳', 巳: '阴', 午: '阳', 未: '阴', 申: '阳', 酉: '阴', 戌: '阳', 亥: '阴' };
const WUXING = ['木', '火', '土', '金', '水'];
const WUXING_SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const WUXING_KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
const WUXING_KE_BY = { 土: '木', 水: '土', 火: '水', 金: '火', 木: '金' };
const WUXING_SHENG_BY = { 火: '木', 土: '火', 金: '土', 水: '金', 木: '水' };

// 藏干（本气 → 中气 → 余气），与 common.py 完全一致
const HIDE_GAN = {
  子: ['癸'], 丑: ['己', '癸', '辛'], 寅: ['甲', '丙', '戊'], 卯: ['乙'],
  辰: ['戊', '乙', '癸'], 巳: ['丙', '戊', '庚'], 午: ['丁', '己'],
  未: ['己', '丁', '乙'], 申: ['庚', '壬', '戊'], 酉: ['辛'],
  戌: ['戊', '辛', '丁'], 亥: ['壬', '甲'],
};

const ZHI_CHONG = [['子', '午'], ['丑', '未'], ['寅', '申'], ['卯', '酉'], ['辰', '戌'], ['巳', '亥']];
const ZHI_HE = [['子', '丑'], ['寅', '亥'], ['卯', '戌'], ['辰', '酉'], ['巳', '申'], ['午', '未']];
const ZHI_HAI = [['子', '未'], ['丑', '午'], ['寅', '巳'], ['卯', '辰'], ['申', '亥'], ['酉', '戌']];
const ZHI_PO = [['子', '酉'], ['丑', '辰'], ['寅', '亥'], ['卯', '午'], ['巳', '申'], ['未', '戌']];
const SAN_HE = { 申子辰: '水', 亥卯未: '木', 寅午戌: '火', 巳酉丑: '金' };
const SAN_HUI = { 寅卯辰: '木', 巳午未: '火', 申酉戌: '金', 亥子丑: '水' };
const XING_GROUPS = [['寅', '巳', '申'], ['丑', '戌', '未']];
const XING_PAIRS = [['子', '卯']];
const SELF_XING = new Set(['辰', '午', '酉', '亥']);
const GAN_HE = [
  { pair: ['甲', '己'], hua: '土' }, { pair: ['乙', '庚'], hua: '金' }, { pair: ['丙', '辛'], hua: '水' },
  { pair: ['丁', '壬'], hua: '木' }, { pair: ['戊', '癸'], hua: '火' },
];
const GAN_CHONG = [['甲', '庚'], ['乙', '辛'], ['丙', '壬'], ['丁', '癸']];

const TIANYI = {
  甲: ['丑', '未'], 戊: ['丑', '未'], 庚: ['丑', '未'], 乙: ['子', '申'], 己: ['子', '申'],
  丙: ['亥', '酉'], 丁: ['亥', '酉'], 壬: ['卯', '巳'], 癸: ['卯', '巳'], 辛: ['午', '寅'],
};
const WENCHANG = { 甲: '巳', 乙: '午', 丙: '申', 丁: '酉', 戊: '申', 己: '酉', 庚: '亥', 辛: '子', 壬: '寅', 癸: '卯' };
const YANGREN = { 甲: '卯', 乙: '寅', 丙: '午', 丁: '巳', 戊: '午', 己: '巳', 庚: '酉', 辛: '申', 壬: '子', 癸: '亥' };
const LUSHEN = { 甲: '寅', 乙: '卯', 丙: '巳', 丁: '午', 戊: '巳', 己: '午', 庚: '申', 辛: '酉', 壬: '亥', 癸: '子' };
const TAOHUA = { 申子辰: '酉', 寅午戌: '卯', 巳酉丑: '午', 亥卯未: '子' };
const YIMA = { 申子辰: '寅', 寅午戌: '申', 巳酉丑: '亥', 亥卯未: '巳' };
const HUAGAI = { 申子辰: '辰', 寅午戌: '戌', 巳酉丑: '丑', 亥卯未: '未' };
const JIANGXING = { 申子辰: '子', 寅午戌: '午', 巳酉丑: '酉', 亥卯未: '卯' };
const YUEDE = { 寅午戌: '丙', 申子辰: '壬', 亥卯未: '甲', 巳酉丑: '庚' };
const TIANDE = { 寅: '丁', 卯: '申', 辰: '壬', 巳: '辛', 午: '亥', 未: '甲', 申: '癸', 酉: '寅', 戌: '丙', 亥: '乙', 子: '巳', 丑: '庚' };
const KUIGANG = new Set(['庚辰', '庚戌', '壬辰', '戊戌']);
const YINYANG_CUO = new Set(['丙子', '丁丑', '戊寅', '辛卯', '壬辰', '癸巳', '丙午', '丁未', '戊申', '辛酉', '壬戌', '癸亥']);
const GUCHEN = { 寅卯辰: '巳', 巳午未: '申', 申酉戌: '亥', 亥子丑: '寅' };
const GUASU = { 寅卯辰: '丑', 巳午未: '辰', 申酉戌: '未', 亥子丑: '戌' };

const JIAZI = Array.from({ length: 60 }, (_, i) => GAN[i % 10] + ZHI[i % 12]);
const SHENGXIAO = '鼠牛虎兔龙蛇马羊猴鸡狗猪';
const ZHI_SHENGXIAO = Object.fromEntries(ZHI.map((z, i) => [z, SHENGXIAO[i]]));
const PILLAR_KEYS = ['year', 'month', 'day', 'time'];
const PILLAR_CAP = ['Year', 'Month', 'Day', 'Time'];
const PILLAR_CN = { year: '年柱', month: '月柱', day: '日柱', time: '时柱' };

// 五行统计权重：天干 1.0；地支藏干 本气 1.0 / 中气 0.5 / 余气 0.3；仅月支（月令）整体 ×1.5
const HIDE_WEIGHT = [1.0, 0.5, 0.3];
const MONTH_ZHI_FACTOR = 1.5;
const WUXING_METHOD = '本气1.0/中气0.5/余气0.3 + 天干1.0，月支（月令）藏干整体×1.5；'
  + 'count 为八字表面八字五行（天干按干五行、地支按本气五行）';

// 日主旺衰：三要素加权 v1（0-100）
const DE_LING_BASE = { 同我: 40, 生我: 36, 我生: 20, 我克: 16, 克我: 8 };
const DE_LING_EXTRA = 2;
const ROOT_TABLE = {
  '同我-0': 12, '同我-1': 5, '同我-2': 3,
  '生我-0': 6, '生我-1': 3, '生我-2': 2,
};
const DE_SHI_PER_GAN = 8;
const DE_SHI_MAX = 30;
const STRENGTH_LEVELS = [[80, '旺'], [61, '偏强'], [45, '中和'], [28, '偏弱'], [0, '弱']];
const STRENGTH_METHOD = '三要素加权 v1：得令(月支本气对日主旺相休囚死，基准 8-40，月支中余气同我/生我再+2，满40)'
  + ' + 得地(四支藏干通根：同类本气12中气5余气3，印星本气6中气3余气2，满30)'
  + ' + 得势(天干比劫/印每见+8，满30)；合计 0-100，'
  + '等级阈值 ≥80 旺 / 61-79 偏强 / 45-60 中和 / 28-44 偏弱 / <28 弱';

const DAYUN_STEPS = 8;
const LIUNIAN_SPAN = 5; // 今年 ±5 → 11 条

// ------------------------------------------------------------------ 基础工具
/** 带 code 的错误（BAD_DATETIME / BAD_GENDER / OUT_OF_RANGE）。 */
function fail(code, msg) {
  const e = new Error(msg);
  e.code = code;
  return e;
}

/** 解析 `YYYY-MM-DD[ T]HH:mm[:ss]` / `YYYY-MM-DD`，返回分解后的本地时间。 */
function parseSolar(solar) {
  if (typeof solar !== 'string' || !solar.trim()) throw fail('BAD_DATETIME', 'solar 不能为空');
  const s = solar.trim().replace(/\//g, '-').replace(' ', 'T');
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:T(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
  if (!m) throw fail('BAD_DATETIME', `无法解析时间：${JSON.stringify(solar)}，示例 1990-05-15T10:30`);
  const dt = {
    y: +m[1], m: +m[2], d: +m[3],
    h: m[4] === undefined ? 12 : +m[4],
    mi: m[5] === undefined ? 0 : +m[5],
    s: m[6] === undefined ? 0 : +m[6],
  };
  if (dt.m < 1 || dt.m > 12 || dt.d < 1 || dt.d > 31 || dt.h > 23 || dt.mi > 59 || dt.s > 59) {
    throw fail('BAD_DATETIME', `时间分量越界：${JSON.stringify(solar)}`);
  }
  // 用 UTC 回读校验日期真实存在（如 2 月 30 日）
  const probe = new Date(Date.UTC(dt.y, dt.m - 1, dt.d, dt.h, dt.mi, dt.s));
  if (probe.getUTCFullYear() !== dt.y || probe.getUTCMonth() !== dt.m - 1 || probe.getUTCDate() !== dt.d) {
    throw fail('BAD_DATETIME', `日期不存在：${JSON.stringify(solar)}`);
  }
  const ms = Date.UTC(dt.y, dt.m - 1, dt.d, dt.h, dt.mi, dt.s);
  if (ms < Date.UTC(1900, 0, 1) || ms > Date.UTC(2100, 11, 31, 23, 59, 59)) {
    throw fail('OUT_OF_RANGE', '本文档支持 1900-2100 年');
  }
  dt.ms = ms;
  return dt;
}

/** 性别归一化：male/female 与 男/女（含 m/f/乾/坤）。 */
function normalizeGender(gender) {
  const g = String(gender == null ? '' : gender).trim().toLowerCase();
  if (['male', 'm', '男', '乾', '乾造'].includes(g)) return 'male';
  if (['female', 'f', '女', '坤', '坤造'].includes(g)) return 'female';
  throw fail('BAD_GENDER', 'gender 需为 male/female 或 男/女');
}

/** ISO 时间字符串（无时区）。 */
function iso(dt) {
  const p = (n) => String(n).padStart(2, '0');
  return `${dt.y}-${p(dt.m)}-${p(dt.d)}T${p(dt.h)}:${p(dt.mi)}:${p(dt.s)}`;
}

/** 公历年内第几天（1-366）。 */
function dayOfYear(y, m, d) {
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86400000) + 1;
}

/** 均时差（分钟），与 common.py 公式一致。 */
function equationOfTimeMinutes(dt) {
  const n = dayOfYear(dt.y, dt.m, dt.d);
  const b = (2 * Math.PI * (n - 81)) / 364.0;
  return 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
}

/** 真太阳时：北京时间 + (经度-120)×4 分 + 均时差。 */
function trueSolarTime(dt, longitude, useEot) {
  if (longitude == null) {
    return {
      dt,
      info: { applied: false, delta_minutes: 0, longitude: null, equation_of_time_minutes: 0, note: '未提供出生地经度，使用北京时间' },
    };
  }
  const lon = Number(longitude);
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) throw fail('OUT_OF_RANGE', 'longitude 需在 -180~180');
  const eot = useEot ? equationOfTimeMinutes(dt) : 0;
  const delta = (lon - 120.0) * 4.0 + eot;
  const ms = dt.ms + Math.round(delta * 60000);
  const t = new Date(ms);
  const out = {
    y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(),
    h: t.getUTCHours(), mi: t.getUTCMinutes(), s: t.getUTCSeconds(), ms,
  };
  return {
    dt: out,
    info: {
      applied: true,
      delta_minutes: round(delta, 2),
      longitude: lon,
      equation_of_time_minutes: round(eot, 2),
      note: '真太阳时 = 北京时间 + (经度-120)×4分 + 均时差',
    },
  };
}

/** 四舍五入到指定位数（对齐 Python round 的常规结果）。 */
function round(x, digits = 0) {
  return Number(Number(x).toFixed(digits));
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function dedup(seq) {
  const seen = new Set();
  const out = [];
  for (const x of seq) {
    if (!seen.has(x)) { seen.add(x); out.push(x); }
  }
  return out;
}

// ------------------------------------------------------------------ 五行 / 十神 / 关系
/** 五行生克：同我 / 我生 / 我克 / 克我 / 生我。 */
function shengKe(me, other) {
  if (me === other) return '同我';
  if (WUXING_SHENG[me] === other) return '我生';
  if (WUXING_KE[me] === other) return '我克';
  if (WUXING_KE_BY[me] === other) return '克我';
  return '生我';
}

const SS_SAME = {
  '我生-同': '食神', '我生-异': '伤官', '我克-同': '偏财', '我克-异': '正财',
  '克我-同': '七杀', '克我-异': '正官', '生我-同': '偏印', '生我-异': '正印',
};

/** 以日干为我，求另一天干的十神。 */
function shishen(dayGan, otherGan) {
  const me = GAN_WUXING[dayGan];
  const other = GAN_WUXING[otherGan];
  const same = GAN_YINYANG[dayGan] === GAN_YINYANG[otherGan];
  const k = same ? '同' : '异';
  if (me === other) return same ? '比肩' : '劫财';
  if (WUXING_SHENG[me] === other) return SS_SAME[`我生-${k}`];
  if (WUXING_KE[me] === other) return SS_SAME[`我克-${k}`];
  if (WUXING_KE_BY[me] === other) return SS_SAME[`克我-${k}`];
  return SS_SAME[`生我-${k}`];
}

function shishenOfZhi(dayGan, zhi) {
  return HIDE_GAN[zhi].map((g) => shishen(dayGan, g));
}

function pairIn(list, a, b) {
  const i = ZHI.indexOf(a);
  const j = ZHI.indexOf(b);
  const lo = i <= j ? a : b;
  const hi = i <= j ? b : a;
  return list.some(([x, y]) => x === lo && y === hi);
}

/** 两地支关系（冲/六合/害/破/刑/自刑），返回中文标签数组。 */
function zhiRelation(a, b) {
  const out = [];
  if (a !== b && pairIn(ZHI_CHONG, a, b)) out.push('冲');
  if (a !== b && pairIn(ZHI_HE, a, b)) out.push('六合');
  if (a !== b && pairIn(ZHI_HAI, a, b)) out.push('害');
  if (a !== b && pairIn(ZHI_PO, a, b)) out.push('破');
  if (a === b && SELF_XING.has(a)) out.push('自刑');
  if (a !== b && pairIn(XING_PAIRS, a, b)) out.push('刑');
  for (const group of XING_GROUPS) {
    if (a !== b && group.includes(a) && group.includes(b)) { out.push('刑'); break; }
  }
  return out;
}

/** 两干关系（冲/合化/比）。 */
function ganRelation(a, b) {
  const out = [];
  const lo = GAN.indexOf(a) <= GAN.indexOf(b) ? a : b;
  const hi = lo === a ? b : a;
  if (a !== b && GAN_CHONG.some(([x, y]) => x === lo && y === hi)) out.push('冲');
  for (const item of GAN_HE) {
    const [x, y] = item.pair;
    const p = GAN.indexOf(x) <= GAN.indexOf(y) ? item.pair : [y, x];
    if (a !== b && p[0] === lo && p[1] === hi) out.push(`合化${item.hua}`);
  }
  if (a === b) out.push('比');
  return out;
}

function sanheOfThree(zhis) {
  const s = new Set(zhis);
  const found = [];
  const push = (type, combo, hua) => {
    if ([...combo].every((z) => s.has(z))) found.push({ type, zhi: [...combo], hua });
  };
  for (const [combo, hua] of Object.entries(SAN_HE)) push('三合', combo, hua);
  for (const [combo, hua] of Object.entries(SAN_HUI)) push('三会', combo, hua);
  return found;
}

function banheOf(zhis) {
  const s = new Set(zhis);
  const found = [];
  const seen = new Set();
  for (const [combo, hua] of Object.entries(SAN_HE)) {
    for (let i = 0; i < 3; i += 1) {
      for (let j = i + 1; j < 3; j += 1) {
        const a = combo[i];
        const b = combo[j];
        const key = [a, b].sort().join('');
        if (s.has(a) && s.has(b) && !seen.has(key)) {
          seen.add(key);
          found.push({ type: '半合', zhi: [a, b], hua });
        }
      }
    }
  }
  return found;
}

/** 地支所属三合局字符串（申子辰…），无则 null。 */
function zhiGroup(zhi) {
  for (const combo of Object.keys(SAN_HE)) {
    if (combo.includes(zhi)) return combo;
  }
  return null;
}

// ------------------------------------------------------------------ 四柱
const NAYIN = LunarUtil.NAYIN || {};

function nayinOf(gz) {
  return NAYIN[gz] || '';
}

/** 干支 → 旬空（借用 LunarUtil 查表，需绑定 this）。 */
function xunkongOf(gz) {
  return LunarUtil.getXunKong ? LunarUtil.getXunKong.call(LunarUtil, gz) : '';
}

function buildPillars(ec, dayGan) {
  const out = {};
  PILLAR_KEYS.forEach((key, idx) => {
    const cap = PILLAR_CAP[idx];
    const gz = ec[`get${cap}`]();
    const gan = gz[0];
    const zhi = gz[1];
    const hide = HIDE_GAN[zhi].slice();
    out[key] = {
      name: PILLAR_CN[key],
      ganzhi: gz,
      gan,
      zhi,
      gan_wuxing: GAN_WUXING[gan],
      zhi_wuxing: ZHI_WUXING[zhi],
      gan_yinyang: GAN_YINYANG[gan],
      zhi_yinyang: ZHI_YINYANG[zhi],
      hide_gan: hide,
      hide_gan_wuxing: hide.map((g) => GAN_WUXING[g]),
      shishen_gan: key === 'day' ? '日主' : shishen(dayGan, gan),
      shishen_zhi: shishenOfZhi(dayGan, zhi),
      nayin: ec[`get${cap}NaYin`](),
      xunkong: ec[`get${cap}XunKong`](),
      dishi: ec[`get${cap}DiShi`](),
      zhi_wuxing_full: dedup(hide.map((g) => GAN_WUXING[g])),
    };
  });
  return out;
}

// ------------------------------------------------------------------ 五行统计
function wuxingStats(pillars) {
  const count = Object.fromEntries(WUXING.map((w) => [w, 0]));
  const score = Object.fromEntries(WUXING.map((w) => [w, 0.0]));
  for (const key of PILLAR_KEYS) {
    const p = pillars[key];
    count[p.gan_wuxing] += 1;
    score[p.gan_wuxing] += 1.0;
    const factor = key === 'month' ? MONTH_ZHI_FACTOR : 1.0;
    p.hide_gan.forEach((gan, i) => {
      score[GAN_WUXING[gan]] += HIDE_WEIGHT[i] * factor;
    });
    count[p.zhi_wuxing] += 1;
  }
  const total = WUXING.reduce((acc, w) => acc + score[w], 0);
  const percent = {};
  for (const w of WUXING) percent[w] = total ? round((score[w] / total) * 100, 1) : 0.0;
  const ranked = WUXING.slice().sort((a, b) => score[b] - score[a]);
  return {
    count,
    score: Object.fromEntries(WUXING.map((w) => [w, round(score[w], 2)])),
    percent,
    strongest: ranked[0],
    weakest: ranked[ranked.length - 1],
    missing: WUXING.filter((w) => count[w] === 0),
    missing_note: 'missing 指八字表面（天干+地支本气）count=0，藏干中仍可能见该五行',
    method: WUXING_METHOD,
    total_score: round(total, 2),
  };
}

// ------------------------------------------------------------------ 旺衰
function levelOf(score) {
  for (const [threshold, name] of STRENGTH_LEVELS) {
    if (score >= threshold) return name;
  }
  return '弱';
}

function strengthOf(dayGan, pillars) {
  const me = GAN_WUXING[dayGan];
  const details = [];
  const monthHide = pillars.month.hide_gan;
  const lingRel = shengKe(me, GAN_WUXING[monthHide[0]]);
  let deLing = DE_LING_BASE[lingRel];
  details.push(
    `得令 ${deLing}/40：月支${pillars.month.zhi}本气${monthHide[0]}${GAN_WUXING[monthHide[0]]}，`
    + `对日主${dayGan}${me}为「${lingRel}」`,
  );
  monthHide.slice(1).forEach((gan, idx) => {
    const rel = shengKe(me, GAN_WUXING[gan]);
    if (rel === '同我' || rel === '生我') {
      const add = Math.min(DE_LING_EXTRA, 40 - deLing);
      deLing = Math.min(40, deLing + DE_LING_EXTRA);
      details.push(`  月支藏${gan}（${rel}）位次${idx + 1}，得令 +${add}`);
    } else {
      details.push(`  月支藏${gan}（${rel}）位次${idx + 1}，得令 +0`);
    }
  });

  // 得地：四支藏干通根
  let deDi = 0;
  for (const key of PILLAR_KEYS) {
    const p = pillars[key];
    const hits = [];
    p.hide_gan.forEach((gan, idx) => {
      const rel = shengKe(me, GAN_WUXING[gan]);
      const pts = ROOT_TABLE[`${rel}-${idx}`] || 0;
      if (pts) {
        hits.push(`${gan}(${rel},位次${idx})+${pts}`);
        deDi += pts;
      }
    });
    if (hits.length) details.push(`得地[${PILLAR_CN[key]}]: ${hits.join('、')}`);
  }
  deDi = Math.min(30, deDi);
  details.push(`得地 ${deDi}/30：四支藏干通根与印星合计（封顶30）`);

  // 得势：天干比劫/印星
  let deShi = 0;
  const ganHits = [];
  for (const key of PILLAR_KEYS) {
    if (key === 'day') continue;
    const p = pillars[key];
    const rel = shengKe(me, GAN_WUXING[p.gan]);
    if (rel === '同我' || rel === '生我') {
      deShi += DE_SHI_PER_GAN;
      ganHits.push(`${PILLAR_CN[key]}${p.gan}(${rel})+${DE_SHI_PER_GAN}`);
    }
  }
  deShi = Math.min(DE_SHI_MAX, deShi);
  details.push(`得势 ${deShi}/30：${ganHits.length ? ganHits.join('、') : '天干无比劫/印星帮扶'}`);

  const score = clamp(deLing + deDi + deShi, 0, 100);
  const level = levelOf(score);
  details.push(`合计 ${score}/100 → ${level}（阈值 ≥80旺 / 61-79偏强 / 45-60中和 / 28-44偏弱 / <28弱）`);
  return {
    score, level, method: STRENGTH_METHOD,
    de_ling: deLing, de_di: deDi, de_shi: deShi,
    ling_relation: lingRel, details,
  };
}

// ------------------------------------------------------------------ 关系
const REL_KEYS = ['chong', 'he', 'xing', 'hai', 'po', 'gan_he', 'gan_chong', 'sanhe', 'sanhui', 'banhe', 'fuyin'];
const REL_KEY = { 冲: 'chong', 六合: 'he', 害: 'hai', 破: 'po', 刑: 'xing', 自刑: 'xing' };

function pillarsOfZhis(pillars, zhis) {
  const used = new Set();
  const out = [];
  for (const z of zhis) {
    for (const key of PILLAR_KEYS) {
      if (!used.has(key) && pillars[key].zhi === z) { used.add(key); out.push(key); break; }
    }
  }
  return out;
}

function buildRelations(pillars) {
  const out = Object.fromEntries(REL_KEYS.map((k) => [k, []]));
  const zhis = PILLAR_KEYS.map((k) => pillars[k].zhi);
  for (let i = 0; i < 4; i += 1) {
    for (let j = i + 1; j < 4; j += 1) {
      const a = zhis[i];
      const b = zhis[j];
      if (a === b) {
        out.fuyin.push({ pillars: [PILLAR_KEYS[i], PILLAR_KEYS[j]], zhi: [a, b], note: `${a}${b}同支并见（伏吟）` });
      }
      for (const label of zhiRelation(a, b)) {
        const key = REL_KEY[label];
        if (!key) continue;
        out[key].push({ pillars: [PILLAR_KEYS[i], PILLAR_KEYS[j]], zhi: [a, b], note: `${a}${b}${label}` });
      }
    }
  }
  for (let i = 0; i < 4; i += 1) {
    for (let j = i + 1; j < 4; j += 1) {
      const a = pillars[PILLAR_KEYS[i]].gan;
      const b = pillars[PILLAR_KEYS[j]].gan;
      for (const label of ganRelation(a, b)) {
        if (label === '冲') {
          out.gan_chong.push({ pillars: [PILLAR_KEYS[i], PILLAR_KEYS[j]], gan: [a, b], note: `${a}${b}相冲` });
        } else if (label.startsWith('合化')) {
          out.gan_he.push({
            pillars: [PILLAR_KEYS[i], PILLAR_KEYS[j]], gan: [a, b], hua: label.slice(2),
            note: `${a}${b}相合，传统合化${label.slice(2)}（本引擎不判化气成败）`,
          });
        }
      }
    }
  }
  const foundSanhe = [];
  for (const item of sanheOfThree(zhis)) {
    const entry = {
      zhi: item.zhi.slice(),
      hua: item.hua,
      pillars: pillarsOfZhis(pillars, item.zhi),
      note: `${item.zhi.join('')}${item.type}局化${item.hua}`,
    };
    if (item.type === '三合') { foundSanhe.push(new Set(item.zhi)); out.sanhe.push(entry); }
    else out.sanhui.push(entry);
  }
  for (const item of banheOf(zhis)) {
    const pair = new Set(item.zhi);
    if (foundSanhe.some((full) => [...pair].every((z) => full.has(z)))) continue;
    out.banhe.push({
      zhi: item.zhi.slice(), hua: item.hua,
      pillars: pillarsOfZhis(pillars, item.zhi),
      note: `${item.zhi.join('')}半合${item.hua}局`,
    });
  }
  return out;
}

// ------------------------------------------------------------------ 神煞
function pillarsHoldingZhi(pillars, zhi) {
  return PILLAR_KEYS.filter((k) => pillars[k].zhi === zhi);
}

function pillarsHoldingGan(pillars, gan) {
  return PILLAR_KEYS.filter((k) => pillars[k].gan === gan);
}

function buildShensha(pillars, dayGan) {
  const zhis = PILLAR_KEYS.map((k) => pillars[k].zhi);
  const gans = PILLAR_KEYS.map((k) => pillars[k].gan);
  const zhiSet = new Set(zhis);
  const out = [];
  const index = {};

  const add = (name, opts = {}) => {
    const hitZhis = opts.hitZhis || [];
    const hitGans = opts.hitGans || [];
    const rule = opts.rule || '';
    let hitKeys = (opts.keys || []).slice();
    for (const z of hitZhis) hitKeys = hitKeys.concat(pillarsHoldingZhi(pillars, z));
    for (const g of hitGans) hitKeys = hitKeys.concat(pillarsHoldingGan(pillars, g));
    hitKeys = dedup(hitKeys);
    if (!hitKeys.length) return;
    if (name in index) {
      const entry = out[index[name]];
      entry.pillars = dedup(entry.pillars.concat(hitKeys));
      if (rule && !entry.rule.includes(rule)) entry.rule += `；${rule}`;
      return;
    }
    index[name] = out.length;
    out.push({ name, pillars: hitKeys, rule });
  };

  // 日干类：天乙 / 文昌 / 羊刃 / 禄神
  const tianyiHit = (TIANYI[dayGan] || []).filter((z) => zhiSet.has(z));
  if (tianyiHit.length) add('天乙贵人', { hitZhis: tianyiHit, rule: `日干${dayGan}→${(TIANYI[dayGan] || []).join('')}` });
  if (zhiSet.has(WENCHANG[dayGan])) add('文昌贵人', { hitZhis: [WENCHANG[dayGan]], rule: `日干${dayGan}→${WENCHANG[dayGan]}` });
  if (zhiSet.has(YANGREN[dayGan])) add('羊刃', { hitZhis: [YANGREN[dayGan]], rule: `日干${dayGan}→${YANGREN[dayGan]}` });
  if (zhiSet.has(LUSHEN[dayGan])) add('禄神', { hitZhis: [LUSHEN[dayGan]], rule: `日干${dayGan}→${LUSHEN[dayGan]}` });

  // 年支 / 日支三合类：桃花 驿马 华盖 将星
  for (const baseKey of ['year', 'day']) {
    const baseZhi = pillars[baseKey].zhi;
    const group = zhiGroup(baseZhi);
    if (!group) continue;
    for (const [name, table] of [['桃花', TAOHUA], ['驿马', YIMA], ['华盖', HUAGAI], ['将星', JIANGXING]]) {
      const target = table[group];
      if (zhiSet.has(target)) add(name, { hitZhis: [target], rule: `${PILLAR_CN[baseKey]}${baseZhi}（${group}局）→${target}` });
    }
  }
  // 月德（月支三合局 → 天干）
  const monthGroup = zhiGroup(pillars.month.zhi);
  if (monthGroup && gans.includes(YUEDE[monthGroup])) {
    add('月德贵人', { hitGans: [YUEDE[monthGroup]], rule: `月支${pillars.month.zhi}属${monthGroup}局→天干${YUEDE[monthGroup]}` });
  }
  // 天德（月支 → 天干或地支）
  const tiande = TIANDE[pillars.month.zhi];
  if (tiande) {
    if (gans.includes(tiande)) add('天德贵人', { hitGans: [tiande], rule: `月支${pillars.month.zhi}→${tiande}（天干）` });
    else if (zhiSet.has(tiande)) add('天德贵人', { hitZhis: [tiande], rule: `月支${pillars.month.zhi}→${tiande}（地支）` });
  }
  // 魁罡
  if (KUIGANG.has(pillars.day.ganzhi)) add('魁罡', { keys: ['day'], rule: `日柱${pillars.day.ganzhi}属魁罡四柱` });
  // 孤辰 / 寡宿（年支）
  for (const [name, table] of [['孤辰', GUCHEN], ['寡宿', GUASU]]) {
    for (const [combo, target] of Object.entries(table)) {
      if (combo.includes(pillars.year.zhi) && zhiSet.has(target)) {
        add(name, { hitZhis: [target], rule: `年支${pillars.year.zhi}属${combo}→${target}` });
        break;
      }
    }
  }
  // 阴阳差错
  if (YINYANG_CUO.has(pillars.day.ganzhi)) add('阴阳差错', { keys: ['day'], rule: `日柱${pillars.day.ganzhi}属阴阳差错日` });
  // 额外补一个 zhis 字段（PLUGIN-CONTRACT §2.2 要求 shensha:[{name,zhis}]）
  return out.map((entry) => ({ ...entry, zhis: dedup(entry.pillars.map((k) => pillars[k].zhi)) }));
}

// ------------------------------------------------------------------ 大运
function buildDayun(ec, gender, dayGan, yearGan, birthDt) {
  const yang = GAN_YINYANG[yearGan] === '阳';
  const forward = (yang && gender === 'male') || (!yang && gender === 'female');
  const yun = ec.getYun(gender === 'male' ? 1 : 0, 1); // sect=1：传统时辰折算法（3日折1年）
  const dys = yun.getDaYun(DAYUN_STEPS + 1);
  const list = [];
  for (const dy of dys.slice(1)) {
    const gz = dy.getGanZhi();
    list.push({
      index: dy.getIndex(),
      ganzhi: gz,
      gan: gz[0],
      zhi: gz[1],
      gan_wuxing: GAN_WUXING[gz[0]],
      shishen_gan: shishen(dayGan, gz[0]),
      hide_gan: HIDE_GAN[gz[1]].slice(),
      shishen_zhi: shishenOfZhi(dayGan, gz[1]),
      nayin: nayinOf(gz),
      xunkong: xunkongOf(gz),
      start_year: dy.getStartYear(),
      end_year: dy.getEndYear(),
      start_age: dy.getStartAge(),
      end_age: dy.getEndAge(),
      note: 'start_age/end_age 为虚岁（出生年记 1 岁）',
    });
  }
  const startSolar = yun.getStartSolar();
  const pad = (n) => String(n).padStart(2, '0');
  const qiyun = {
    years: yun.getStartYear(),
    months: yun.getStartMonth(),
    days: yun.getStartDay(),
    hours: yun.getStartHour(),
    solar: startSolar.toYmd(),
    solar_full: startSolar.toYmdHms(),
    forward: Boolean(yun.isForward()),
    rule: '阳男阴女顺行 v1：年干阳+男 / 年干阴+女 顺排大运，否则逆排',
    method: '传统时辰折算法（sect=1）：3日折1年、1时辰折10日',
    note: `出生 ${birthDt.y}-${pad(birthDt.m)}-${pad(birthDt.d)}，起运时点 ${startSolar.toYmdHms()}`,
  };
  return {
    qiyun,
    start_age: qiyun.years,
    age_basis: 'dayun.start_age 为起运周岁年限；list 内 start_age/end_age 为虚岁',
    list,
  };
}

function findDayun(dayun, year) {
  return dayun.list.find((item) => item.start_year <= year && year <= item.end_year) || null;
}

// ------------------------------------------------------------------ 流年
function buildLiunian(dayGan, pillars, dayun, birthYear, baseYear) {
  const out = [];
  for (let year = baseYear - LIUNIAN_SPAN; year <= baseYear + LIUNIAN_SPAN; year += 1) {
    const gz = JIAZI[(((year - 4) % 60) + 60) % 60];
    const gan = gz[0];
    const zhi = gz[1];
    const dy = findDayun(dayun, year);
    const rels = {};
    for (const key of PILLAR_KEYS) {
      const labels = zhiRelation(zhi, pillars[key].zhi);
      rels[key] = labels.length ? labels.join('') : '无';
    }
    const yearRel = rels.year;
    const dayRel = rels.day;
    out.push({
      year,
      ganzhi: gz,
      gan,
      zhi,
      branch: zhi,
      age: year - birthYear + 1,
      age_basis: '虚岁',
      shishen_gan: shishen(dayGan, gan),
      shishen_zhi: shishenOfZhi(dayGan, zhi),
      hide_gan: HIDE_GAN[zhi].slice(),
      xunkong: xunkongOf(gz),
      relations_to_year: yearRel === '无' ? '无' : `${zhi}${pillars.year.zhi}${yearRel}`,
      relations_to_day: dayRel === '无' ? '无' : `${zhi}${pillars.day.zhi}${dayRel}`,
      relations_to_pillars: rels,
      dayun_ganzhi: dy ? dy.ganzhi : '',
      dayun_index: dy ? dy.index : 0,
      note: '流年干支以立春为界',
    });
  }
  return out;
}

// ------------------------------------------------------------------ 节气
function solarToDt(solar) {
  return {
    y: solar.getYear(), m: solar.getMonth(), d: solar.getDay(),
    h: solar.getHour(), mi: solar.getMinute(), s: solar.getSecond(),
    ms: Date.UTC(solar.getYear(), solar.getMonth() - 1, solar.getDay(), solar.getHour(), solar.getMinute(), solar.getSecond()),
  };
}

function buildJieqi(lunar, pillars, dt) {
  const prevJie = lunar.getPrevJie();
  const nextJie = lunar.getNextJie();
  const prevDt = solarToDt(prevJie.getSolar());
  const nextDt = solarToDt(nextJie.getSolar());
  const pad = (n) => String(n).padStart(2, '0');
  return {
    month: `${pillars.month.zhi}月`,
    current_term: prevJie.getName(),
    next_term: nextJie.getName(),
    term_day: `${prevDt.y}-${pad(prevDt.m)}-${pad(prevDt.d)}`,
    current_term_at: iso(prevDt),
    next_term_at: iso(nextDt),
    days_since_term: round((dt.ms - prevDt.ms) / 86400000, 2),
    days_to_next_term: round((nextDt.ms - dt.ms) / 86400000, 2),
    year_boundary: '年柱以立春为界',
    month_boundary: '月柱以节令（立春/惊蛰/清明/立夏/芒种/小暑/立秋/白露/寒露/立冬/大雪/小寒）为界',
  };
}

// ------------------------------------------------------------------ hints（只写客观盘面事实）
function pillarsGanzhi(pillars) {
  return PILLAR_KEYS.map((k) => pillars[k].ganzhi).join(' ');
}

function buildHints(dayGan, pillars, strength, wuxing, relations, shensha, dayun, liunian, jieqi, baseYear, hour) {
  const me = GAN_WUXING[dayGan];
  const hints = [];
  const p = pillars;
  hints.push(
    `日主${dayGan}${me}（${GAN_YINYANG[dayGan]}干）生于${p.month.zhi}月，月令本气`
    + `${p.month.hide_gan[0]}${p.month.zhi_wuxing}，交节${jieqi.current_term}`
    + `（${jieqi.current_term_at.slice(0, 16)}），距下节${jieqi.next_term}`
    + `${jieqi.days_to_next_term}天`,
  );
  hints.push(
    `四柱干支：${pillarsGanzhi(p)}；天干序列${p.year.gan}${p.month.gan}`
    + `${p.day.gan}${p.time.gan}，日主十神分布`
    + `（年/月/时）：${p.year.shishen_gan}、${p.month.shishen_gan}、`
    + `${p.time.shishen_gan}`,
  );
  hints.push(
    `地支序列 ${PILLAR_KEYS.map((k) => p[k].zhi).join('')}；藏干：${p.year.zhi}藏${p.year.hide_gan.join('')}、`
    + `${p.month.zhi}藏${p.month.hide_gan.join('')}、`
    + `${p.day.zhi}藏${p.day.hide_gan.join('')}、`
    + `${p.time.zhi}藏${p.time.hide_gan.join('')}`,
  );
  const ws = WUXING.map((w) => `${w}${wuxing.score[w]}`).join('、');
  const miss = wuxing.missing.length ? wuxing.missing.join('、') : '无';
  hints.push(
    `五行加权得分（${wuxing.method.split('；')[0]}）：${ws}；`
    + `分数最高${wuxing.strongest}、最低${wuxing.weakest}；表面缺：${miss}`,
  );
  hints.push(
    `旺衰（${strength.method.split('：')[0]}）：${strength.score}/100 → ${strength.level}；`
    + `得令${strength.de_ling}/40、得地${strength.de_di}/30、得势${strength.de_shi}/30`,
  );
  const relTxt = [];
  const relLabel = {
    chong: '冲', he: '六合', xing: '刑', hai: '害', po: '破',
    sanhe: '三合', sanhui: '三会', banhe: '半合', fuyin: '伏吟',
  };
  for (const [key, cn] of Object.entries(relLabel)) {
    const items = relations[key] || [];
    if (!items.length) continue;
    relTxt.push(`${cn}：` + items.map((i) => (
      i.pillars && i.pillars.length === 2
        ? `${i.zhi.join('')}（${PILLAR_CN[i.pillars[0]]}/${PILLAR_CN[i.pillars[1]]}）`
        : `${(i.zhi || []).join('')}化${i.hua || ''}`
    )).join('、'));
  }
  if (relations.gan_he.length) {
    relTxt.push('天干合：' + relations.gan_he.map((i) => `${i.gan.join('')}合化${i.hua}`).join('、'));
  }
  if (relations.gan_chong.length) {
    relTxt.push('天干冲：' + relations.gan_chong.map((i) => i.gan.join('')).join('、'));
  }
  hints.push('地支/天干关系：' + (relTxt.length ? relTxt.join('；') : '四柱间无刑冲合害'));
  hints.push(shensha.length
    ? '神煞命中：' + shensha.map((s) => `${s.name}（${s.pillars.map((k) => PILLAR_CN[k]).join('/')}）`).join('、')
    : '神煞命中：无');
  const q = dayun.qiyun;
  const first = dayun.list[0];
  hints.push(
    `起运：${q.rule}，${q.years}年${q.months}月${q.days}天后起运（${q.solar}）；`
    + (first
      ? `首运${first.ganzhi}（${first.start_year}-${first.end_year}，虚岁${first.start_age}-${first.end_age}）`
      : '无大运'),
  );
  const cur = liunian.find((x) => x.year === baseYear);
  if (cur) {
    hints.push(
      `流年${baseYear}${cur.ganzhi}，虚岁${cur.age}，流年干十神${cur.shishen_gan}，`
      + `与年支关系「${cur.relations_to_year}」，与日支关系「${cur.relations_to_day}」，`
      + `所属大运${cur.dayun_ganzhi || '未起运'}`,
    );
  }
  if (hour === 23) {
    hints.push('时柱边界：生于 23:00-23:59 晚子时；默认 sect=2 约定为「日柱不换日、时干按次日日干起」');
  } else {
    hints.push('时柱边界：非晚子时，日柱与时柱按当日日干五鼠遁；四柱用 lunar-javascript 默认 sect=2');
  }
  return hints;
}

// ------------------------------------------------------------------ 入口
/**
 * 排八字盘。
 * @param {{solar:string, gender:'male'|'female'|'男'|'女', longitude?:number|null,
 *          use_true_solar?:boolean, use_eot?:boolean, year?:number}} profile
 */
export function buildBazi(profile) {
  const p = profile || {};
  const baseDt = parseSolar(p.solar);
  const gender = normalizeGender(p.gender);
  const longitude = p.longitude == null ? null : Number(p.longitude);
  const useEot = p.use_eot !== false;
  const applyTrueSolar = longitude != null && p.use_true_solar !== false;
  const { dt, info: tsInfo } = applyTrueSolar
    ? trueSolarTime(baseDt, longitude, useEot)
    : {
      dt: baseDt,
      info: { applied: false, delta_minutes: 0, longitude: null, equation_of_time_minutes: 0, note: '未提供出生地经度，使用北京时间' },
    };

  let lunar;
  let ec;
  let pillars;
  let dayGan;
  let yearGan;
  try {
    const solarObj = Solar.fromYmdHms(dt.y, dt.m, dt.d, dt.h, dt.mi, dt.s);
    lunar = solarObj.getLunar();
    ec = lunar.getEightChar();
    dayGan = ec.getDayGan();
    yearGan = ec.getYearGan();
    pillars = buildPillars(ec, dayGan);
  } catch (e) {
    if (e && e.code) throw e;
    throw fail('BAD_DATETIME', `lunar-javascript 排盘失败：${e.message}`);
  }

  // 流年基准年：默认当前年，可用 profile.year 覆盖
  let baseYear = Number(p.year);
  if (!Number.isFinite(baseYear)) baseYear = new Date().getFullYear();
  baseYear = clamp(Math.trunc(baseYear), 1902, 2100);

  const wuxing = wuxingStats(pillars);
  const strength = strengthOf(dayGan, pillars);
  const relations = buildRelations(pillars);
  const shensha = buildShensha(pillars, dayGan);
  const dayun = buildDayun(ec, gender, dayGan, yearGan, dt);
  const liunian = buildLiunian(dayGan, pillars, dayun, baseDt.y, baseYear);
  const jieqi = buildJieqi(lunar, pillars, dt);
  const hints = buildHints(dayGan, pillars, strength, wuxing, relations, shensha, dayun, liunian, jieqi, baseYear, dt.h);

  return {
    solar: iso(baseDt),
    gender,
    lunar: lunar.toString(),
    solar_true: iso(dt),
    true_solar: tsInfo,
    zodiac: ZHI_SHENGXIAO[pillars.year.zhi],
    jieqi,
    pillars,
    day_master: {
      gan: dayGan,
      wuxing: GAN_WUXING[dayGan],
      yinyang: GAN_YINYANG[dayGan],
      shishen_zhi: pillars.day.shishen_zhi,
      strength,
    },
    wuxing,
    relations,
    shensha,
    taiyuan: ec.getTaiYuan(),
    minggong: ec.getMingGong(),
    shengong: ec.getShenGong(),
    taixi: ec.getTaiXi(),
    dayun,
    liunian,
    hints,
    engine_note: '本引擎只输出可计算事实，不含吉凶判断与建议；判断由推理层完成',
  };
}

// 供 ziwei.js / qimen.js 复用的时间与校验工具（index.js 不导出这些）
export { parseSolar, normalizeGender, trueSolarTime, iso, round, clamp, fail };
