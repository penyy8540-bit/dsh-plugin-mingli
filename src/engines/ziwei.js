/**
 * 紫微斗数引擎（浏览器端，纯 ESM）
 *
 * 与 `mingli/tools/lib/ziwei.py` 逐字段对齐（数据源同源：iztro）：
 * 十二宫（「仆役」→「交友」）、主/辅/杂曜 + 亮度 + 四化、五行局、命主身主、
 * 命宫/身宫地支、大限 12 步、流年（流年宫、流年四化、小限）、hints（只写盘面事实）。
 *
 * 时辰索引：0=早子 … 11=亥、12=晚子（23:00 后），与 common.hour_index_for_iztro 一致。
 */
import iztro from 'iztro';
import { parseSolar, normalizeGender, trueSolarTime, iso } from './bazi.js';

// 与 Python 参考实现对齐：py-iztro 的紫微年界/月界按「立春 / 节气」（exact）。
// iztro 2.6.x 默认是「正月初一」（normal），跨年边界日期会差一天，故显式覆盖。
try {
  if (iztro.astro && typeof iztro.astro.config === 'function') {
    iztro.astro.config({ yearDivide: 'exact', horoscopeDivide: 'exact' });
  }
} catch (e) {
  /* 配置不可用时保持库默认值，不影响正常日期 */
}

const ENGINE = 'ziwei';
const ENGINE_VERSION = '0.1.0';

// 契约宫名（仅 iztro 的「仆役」需要映射为「交友」）
const PALACE_NAME_MAP = { 仆役: '交友' };
const CONTRACT_PALACE_NAMES = ['命宫', '兄弟', '夫妻', '子女', '财帛', '疾厄', '迁移', '交友', '官禄', '田宅', '福德', '父母'];

// 十二地支 → 盘面方位（八方制）
const BRANCH_DIRECTION = {
  子: '正北', 丑: '东北', 寅: '东北', 卯: '正东', 辰: '东南', 巳: '东南',
  午: '正南', 未: '西南', 申: '西南', 酉: '正西', 戌: '西北', 亥: '西北',
};

// iztro 时辰索引 → 时间区间（契约口径）
const TIME_RANGE = {
  0: '00:00~00:59', 1: '01:00~02:59', 2: '03:00~04:59', 3: '05:00~06:59',
  4: '07:00~08:59', 5: '09:00~10:59', 6: '11:00~12:59', 7: '13:00~14:59',
  8: '15:00~16:59', 9: '17:00~18:59', 10: '19:00~20:59', 11: '21:00~22:59',
  12: '23:00~23:59',
};

const MUTAGEN_ORDER = ['禄', '权', '科', '忌'];
const STAR_CATEGORY = {
  major: '主星', soft: '辅星', tough: '辅星', lucun: '辅星', tianma: '辅星',
  flower: '杂曜', helper: '杂曜', adjective: '杂曜',
};
const SIX_SHA = new Set(['擎羊', '陀罗', '火星', '铃星', '地空', '地劫']);

// ------------------------------------------------------------------ 小工具
/** 时辰索引：0=早子 1=丑 … 11=亥 12=晚子。 */
function hourIndexForIztro(dt) {
  if (dt.h === 23) return 12;
  return Math.floor(((dt.h + 1) / 2) % 12);
}

/** 契约口径星曜：name / brightness / mutagen（缺值归一为空串）。 */
function starBrief(star) {
  return {
    name: star.name || '',
    brightness: star.brightness || '',
    mutagen: star.mutagen || '',
  };
}

/** 完整星曜：附 category（主星/辅星/杂曜）与 iztro type。 */
function starDetail(star) {
  const type = star.type || '';
  return {
    name: star.name || '',
    category: STAR_CATEGORY[type] || '杂曜',
    type,
    scope: star.scope || 'origin',
    brightness: star.brightness || '',
    mutagen: star.mutagen || '',
  };
}

function palaceByIndex(palaces, index) {
  return palaces.find((p) => p.index === index) || null;
}

function palaceByName(palaces, name) {
  return palaces.find((p) => p.name === name) || null;
}

/** iztro 的四化星数组 → {禄,权,科,忌}（缺失补空串）。 */
function mutagenDict(stars) {
  const seq = stars || [];
  const out = {};
  MUTAGEN_ORDER.forEach((key, i) => { out[key] = i < seq.length && seq[i] ? seq[i] : ''; });
  return out;
}

/** 宫名标签：命宫不加「宫」字，避免「命宫宫」。 */
function nameLabel(name) {
  return name === '命宫' ? name : `${name}宫`;
}

/** 主星短语：X坐守 / XY同宫 / 无主星（空宫）。 */
function starPhrase(stars) {
  if (!stars.length) return '无主星（空宫）';
  if (stars.length === 1) {
    const s = stars[0];
    return `${s.name}${s.brightness ? `（${s.brightness}）` : ''}坐守`;
  }
  return `${stars.map((s) => s.name).join('')}同宫`;
}

/** iztro 宫位 → 契约 §2.3 宫位结构。 */
function buildPalace(p) {
  const nameIztro = p.name || '';
  const name = PALACE_NAME_MAP[nameIztro] || nameIztro;
  const majorRaw = p.majorStars || [];
  const minorRaw = p.minorStars || [];
  const adjRaw = p.adjectiveStars || [];
  const dec = p.decadal || {};
  return {
    index: Number(p.index || 0),
    name,
    name_iztro: nameIztro,
    heavenly_stem: p.heavenlyStem || '',
    earthly_branch: p.earthlyBranch || '',
    ganzhi: `${p.heavenlyStem || ''}${p.earthlyBranch || ''}`,
    direction: BRANCH_DIRECTION[p.earthlyBranch || ''] || '',
    is_body_palace: Boolean(p.isBodyPalace),
    is_soul_palace: nameIztro === '命宫',
    is_original_palace: Boolean(p.isOriginalPalace),
    major_stars: majorRaw.map(starBrief),
    minor_stars: minorRaw.map(starBrief),
    adjective_stars: adjRaw.map((s) => s.name || ''),
    all_stars: majorRaw.concat(minorRaw, adjRaw).map(starDetail),
    changsheng12: p.changsheng12 || '',
    boshi12: p.boshi12 || '',
    jiangqian12: p.jiangqian12 || '',
    suiqian12: p.suiqian12 || '',
    decadal: {
      range: (dec.range || []).map(Number),
      ganzhi: `${dec.heavenlyStem || ''}${dec.earthlyBranch || ''}`,
      heavenly_stem: dec.heavenlyStem || '',
      earthly_branch: dec.earthlyBranch || '',
    },
    ages: (p.ages || []).map(Number),
  };
}

/** 本命四化汇总：按 禄/权/科/忌 分组。 */
function mutagenSummary(palaces) {
  const summary = Object.fromEntries(MUTAGEN_ORDER.map((m) => [m, []]));
  for (const p of palaces) {
    for (const s of p.all_stars) {
      const mut = s.mutagen || '';
      if (mut in summary) {
        summary[mut].push({
          star: s.name, palace: p.name, palace_branch: p.earthly_branch, category: s.category,
        });
      }
    }
  }
  return summary;
}

/** 大限 12 步：按起始年龄升序。 */
function buildDaxian(palaces) {
  const items = [];
  for (const p of palaces) {
    const rng = p.decadal.range;
    if (rng.length !== 2) continue;
    items.push({
      range: rng.slice(),
      start_age: rng[0],
      end_age: rng[1],
      palace: p.name,
      palace_branch: p.earthly_branch,
      palace_index: p.index,
      ganzhi: p.decadal.ganzhi,
      heavenly_stem: p.decadal.heavenly_stem,
      earthly_branch: p.decadal.earthly_branch,
    });
  }
  items.sort((a, b) => (a.start_age - b.start_age) || (a.palace_index - b.palace_index));
  return items;
}

// ------------------------------------------------------------------ 流年
function buildLiunian(astrolabe, palaces, birthYear, year, timeIndex) {
  const hd = astrolabe.horoscope(`${year}-07-01`, timeIndex);
  const yearly = hd.yearly || {};
  const yi = Number(yearly.index);
  const pYearly = palaceByIndex(palaces, yi);
  if (!pYearly) throw new Error(`iztro 流年命宫索引异常：${yi}`);

  const mutagen = mutagenDict(yearly.mutagen);
  const starsGrid = yearly.stars || [];
  const yearlyStars = (yi >= 0 && yi < starsGrid.length && starsGrid[yi] ? starsGrid[yi] : [])
    .map((s) => (s ? s.name || '' : ''));

  const palaceNames = yearly.palaceNames || [];
  const palaceMap = palaces.map((p) => ({
    index: p.index,
    origin: p.name,
    yearly: p.index < palaceNames.length ? palaceNames[p.index] : '',
  }));

  // 大限（当前所在大限）
  let decadalInfo = null;
  try {
    const dIdx = Number(hd.decadal.index);
    const pDec = palaceByIndex(palaces, dIdx);
    if (pDec) {
      decadalInfo = {
        range: pDec.decadal.range.slice(),
        palace: pDec.name,
        palace_branch: pDec.earthly_branch,
        ganzhi: `${hd.decadal.heavenlyStem || ''}${hd.decadal.earthlyBranch || ''}`,
        mutagen: mutagenDict(hd.decadal.mutagen),
      };
    }
  } catch (e) {
    decadalInfo = null;
  }

  // 小限（虚岁对应宫）
  let xiaoxianInfo = null;
  let nominalAge = 0;
  try {
    nominalAge = Number((hd.age && hd.age.nominalAge) || 0);
    const pX = palaceByIndex(palaces, Number(hd.age.index));
    if (pX) {
      xiaoxianInfo = {
        age: nominalAge,
        palace: pX.name,
        palace_branch: pX.earthly_branch,
        ganzhi: `${hd.age.heavenlyStem || ''}${hd.age.earthlyBranch || ''}`,
      };
    }
  } catch (e) {
    xiaoxianInfo = null;
  }

  return {
    year,
    age: nominalAge || (year - birthYear + 1),
    ganzhi: `${yearly.heavenlyStem || ''}${yearly.earthlyBranch || ''}`,
    palace: pYearly.name,
    palace_branch: pYearly.earthly_branch,
    palace_stars: pYearly.major_stars.concat(pYearly.minor_stars).map((s) => s.name),
    yearly_stars: yearlyStars,
    mutagen,
    decadal: decadalInfo,
    xiaoxian: xiaoxianInfo,
    palace_map: palaceMap,
    source: 'iztro.horoscope',
    degraded: false,
  };
}

// ------------------------------------------------------------------ hints（只写盘面事实）
function buildHints(data) {
  const hints = [];
  const palaces = data.palaces;
  const soul = palaceByName(palaces, '命宫');
  const body = palaces.find((p) => p.is_body_palace) || null;
  if (soul) {
    let starDesc = starPhrase(soul.major_stars);
    if (soul.major_stars.length) starDesc = `主星${starDesc}`;
    hints.push(
      `命宫在${soul.earthly_branch}（${soul.ganzhi}），${starDesc}；`
      + `${data.five_elements_class}；命主${data.soul}，身主${data.body}`,
    );
  }
  if (body) {
    if (body === soul) hints.push(`身宫与命宫同宫（${body.earthly_branch}）`);
    else hints.push(`身宫在${body.earthly_branch}（${nameLabel(body.name)}）`);
  }

  const mutSeg = [];
  for (const m of MUTAGEN_ORDER) {
    const items = data.mutagen_summary[m] || [];
    if (items.length) {
      mutSeg.push(`${m}：${items.map((it) => `${it.star}在${nameLabel(it.palace)}`).join('、')}`);
    }
  }
  if (mutSeg.length) hints.push('本命四化 ' + mutSeg.join('；'));

  // 空宫及其对宫主星
  const empty = [];
  for (const p of palaces) {
    if (p.major_stars.length) continue;
    const opp = palaceByIndex(palaces, (p.index + 6) % 12);
    if (opp) {
      empty.push(`${nameLabel(p.name)}（${p.earthly_branch}）无主星，对宫${nameLabel(opp.name)}主星${starPhrase(opp.major_stars)}`);
    } else {
      empty.push(`${nameLabel(p.name)}（${p.earthly_branch}）无主星`);
    }
  }
  if (empty.length) hints.push('空宫：' + empty.join('；'));

  // 六煞星落宫（客观罗列）
  const shaHits = [];
  for (const p of palaces) {
    for (const s of p.all_stars) {
      if (SIX_SHA.has(s.name)) shaHits.push(`${s.name}在${nameLabel(p.name)}（${p.earthly_branch}）`);
    }
  }
  if (shaHits.length) hints.push('六煞星落宫：' + shaHits.join('、'));

  // 禄存 / 天马落宫
  const luMa = [];
  for (const p of palaces) {
    for (const s of p.all_stars) {
      if (s.name === '禄存' || s.name === '天马') luMa.push(`${s.name}在${nameLabel(p.name)}（${p.earthly_branch}）`);
    }
  }
  if (luMa.length) hints.push('禄存/天马落宫：' + luMa.join('、'));

  // 大限 / 小限 / 流年
  const ln = data.liunian || {};
  const dec = ln.decadal;
  if (dec && dec.range && dec.range.length) {
    const decMut = dec.mutagen || {};
    const decMutDesc = Object.values(decMut).some(Boolean)
      ? '，大限四化 ' + Object.entries(decMut).filter(([, v]) => v).map(([k, v]) => `${v}化${k}`).join('、')
      : '';
    hints.push(
      `当前大限${dec.range[0]}~${dec.range[1]}虚岁，`
      + `大限命宫落本命${nameLabel(dec.palace)}（${dec.palace_branch}），`
      + `大限干支${dec.ganzhi}${decMutDesc}`,
    );
  }
  if (ln.xiaoxian) hints.push(`虚岁${ln.xiaoxian.age}，小限落${nameLabel(ln.xiaoxian.palace)}（${ln.xiaoxian.palace_branch}）`);
  if (ln.palace) {
    const mut = ln.mutagen || {};
    const mutDesc = Object.entries(mut).filter(([, star]) => star).map(([k, star]) => `${star}化${k}`).join('、');
    hints.push(
      `${ln.year}年（${ln.ganzhi}）流年命宫落本命${nameLabel(ln.palace)}`
      + `（${ln.palace_branch}）` + (mutDesc ? `，流年四化 ${mutDesc}` : ''),
    );
  }
  return hints;
}

// ------------------------------------------------------------------ 入口
/**
 * 排紫微斗数本命盘 + 流年。
 * @param {{solar:string, gender:string, longitude?:number|null, use_true_solar?:boolean,
 *          use_eot?:boolean, year?:number, fix_leap?:boolean}} profile
 */
export function buildZiwei(profile) {
  const p = profile || {};
  const birthBase = parseSolar(p.solar);
  const gender = normalizeGender(p.gender);
  const genderIztro = gender === 'male' ? '男' : '女';
  const longitude = p.longitude == null ? null : Number(p.longitude);
  const useEot = p.use_eot !== false;
  const applyTrueSolar = longitude != null && p.use_true_solar !== false;
  const { dt, info: trueSolarInfo } = applyTrueSolar
    ? trueSolarTime(birthBase, longitude, useEot)
    : { dt: birthBase, info: null };

  const timeIndex = hourIndexForIztro(dt);
  const fixLeap = p.fix_leap !== false;

  let astrolabe;
  try {
    astrolabe = iztro.astro.bySolar(`${dt.y}-${dt.m}-${dt.d}`, timeIndex, genderIztro, fixLeap, 'zh-CN');
  } catch (e) {
    const err = new Error(`iztro 排盘失败：${e && e.message ? e.message : e}`);
    err.code = 'BAD_DATETIME';
    throw err;
  }

  const palaces = (astrolabe.palaces || []).map(buildPalace);
  if (palaces.length !== 12) {
    const err = new Error(`iztro 返回宫位数量异常：${palaces.length}（应为 12）`);
    err.code = 'BAD_DATETIME';
    throw err;
  }
  const names = new Set(palaces.map((x) => x.name));
  const missing = CONTRACT_PALACE_NAMES.filter((n) => !names.has(n));
  if (missing.length) {
    const err = new Error(`iztro 宫名与契约不匹配，缺少：${missing.join('、')}`);
    err.code = 'BAD_DATETIME';
    throw err;
  }

  const soulPalace = palaceByName(palaces, '命宫');
  const bodyPalace = palaces.find((x) => x.is_body_palace) || null;

  // 流年基准年：默认当前年；参考日固定取当年 07-01（稳妥落在正月初一之后）
  let liunianYear = Number(p.year);
  if (!Number.isFinite(liunianYear)) liunianYear = new Date().getFullYear();
  liunianYear = Math.trunc(liunianYear);
  if (liunianYear < 1900 || liunianYear > 2200) {
    const err = new Error('year 需在 1900~2200');
    err.code = 'OUT_OF_RANGE';
    throw err;
  }

  let liunian;
  try {
    liunian = buildLiunian(astrolabe, palaces, birthBase.y, liunianYear, timeIndex);
  } catch (e) {
    // 流年取数失败时降级：只给年干支与静态十干四化，不编造宫位
    liunian = {
      year: liunianYear, age: liunianYear - birthBase.y + 1,
      ganzhi: '', palace: null, palace_branch: null, palace_stars: [],
      yearly_stars: [], mutagen: { 禄: '', 权: '', 科: '', 忌: '' },
      decadal: null, xiaoxian: null, palace_map: [],
      source: 'static_mutagen_table', degraded: true,
    };
  }

  const data = {
    solar: iso(birthBase),
    lunar: astrolabe.lunarDate || '',
    chinese_date: astrolabe.chineseDate || '',
    time: astrolabe.time || '',
    time_range: TIME_RANGE[timeIndex] || '',
    time_range_iztro: astrolabe.timeRange || '',
    zodiac: astrolabe.zodiac || '',
    sign: astrolabe.sign || '',
    gender,
    time_index: timeIndex,
    five_elements_class: astrolabe.fiveElementsClass || '',
    soul: astrolabe.soul || '',
    body: astrolabe.body || '',
    soul_palace_branch: astrolabe.earthlyBranchOfSoulPalace || '',
    body_palace_branch: astrolabe.earthlyBranchOfBodyPalace || '',
    soul_palace_name: soulPalace ? soulPalace.name : '',
    body_palace_name: bodyPalace ? bodyPalace.name : '',
    palaces,
    mutagen_summary: mutagenSummary(palaces),
    daxian: buildDaxian(palaces),
    liunian,
    hints: [],
    warnings: [],
    engine: ENGINE,
    version: ENGINE_VERSION,
  };
  if (trueSolarInfo) {
    data.true_solar = trueSolarInfo;
    data.solar_true = iso(dt);
  }
  data.hints = buildHints(data);
  return data;
}
