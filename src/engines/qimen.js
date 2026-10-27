/**
 * 时家奇门遁甲引擎（浏览器端，纯 ESM）· 拆补法 · 转盘
 *
 * 与 `mingli/tools/lib/qimen.py` 逐字段对齐：定局（节气 + 三元 + 阴阳遁 + 拆补法）、
 * 地盘三奇六仪、天盘九星/天盘干、八门、八神、9 宫输出、值符值使、空亡、用神落宫、
 * hints（只写客观盘面事实）。
 *
 * 排盘数据来自 kinqimen（pan({type:'转盘', juMethod:'拆补'})）；四柱、节气时刻与
 * 旬空用 lunar-javascript 取（与 Python 引擎同一算法口径），凡 kinqimen 用单字
 * 表示的星/门/神在此映射为契约要求的全名（蓬→天蓬、休→休门、符→值符…）。
 */
import { Qimen } from 'kinqimen';
import lua from 'lunar-javascript';
import { parseSolar, trueSolarTime, iso } from './bazi.js';

const { Solar } = lua;

const METHOD = '拆补法 v1（符头定元 · 节气定局 · 转盘）';

// ------------------------------------------------------------------ 宫位常量
const LUOSHU = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const GONG_NAME = {
  1: '坎一宫', 2: '坤二宫', 3: '震三宫', 4: '巽四宫', 5: '中五宫',
  6: '乾六宫', 7: '兑七宫', 8: '艮八宫', 9: '离九宫',
};
const GONG_DIR = {
  1: '北', 2: '西南', 3: '东', 4: '东南', 5: '中', 6: '西北', 7: '西', 8: '东北', 9: '南',
};
const GONG_TRIGRAM = { 1: '坎', 2: '坤', 3: '震', 4: '巽', 5: '中', 6: '乾', 7: '兑', 8: '艮', 9: '离' };
const TRIGRAM_NUM = { 坎: 1, 坤: 2, 震: 3, 巽: 4, 中: 5, 乾: 6, 兑: 7, 艮: 8, 离: 9 };
const ZHI_GONG = {
  子: 1, 丑: 8, 寅: 8, 卯: 3, 辰: 4, 巳: 4, 午: 9, 未: 2, 申: 2, 酉: 7, 戌: 6, 亥: 6,
};

const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const JIAZI = Array.from({ length: 60 }, (_, i) => GAN[i % 10] + ZHI[i % 12]);
const GAN_WUXING = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
const ZHI_WUXING = { 子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水' };
const WUXING_SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const WUXING_KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };

// 六甲旬首 → 所遁之仪
const XUNSHOU_YI = { 0: '戊', 10: '己', 20: '庚', 30: '辛', 40: '壬', 50: '癸' };

// 九星
const STAR_HOME = {
  1: '天蓬', 2: '天芮', 3: '天冲', 4: '天辅', 5: '天禽', 6: '天心', 7: '天柱', 8: '天任', 9: '天英',
};
const STAR_WUXING = { 天蓬: '水', 天芮: '土', 天冲: '木', 天辅: '木', 天禽: '土', 天心: '金', 天柱: '金', 天任: '土', 天英: '火' };
const STAR_CHAR = { 蓬: '天蓬', 任: '天任', 冲: '天冲', 辅: '天辅', 英: '天英', 芮: '天芮', 柱: '天柱', 心: '天心', 禽: '天芮' };
const ZHIFU_STAR_CHAR = { 蓬: '天蓬', 任: '天任', 冲: '天冲', 辅: '天辅', 英: '天英', 芮: '天芮', 柱: '天柱', 心: '天心', 禽: '天禽' };

// 八门
const GATE_HOME = { 1: '休门', 2: '死门', 3: '伤门', 4: '杜门', 6: '开门', 7: '惊门', 8: '生门', 9: '景门' };
const GATE_WUXING = { 休门: '水', 生门: '土', 伤门: '木', 杜门: '木', 景门: '火', 死门: '土', 惊门: '金', 开门: '金' };
const GATE_CHAR = { 休: '休门', 生: '生门', 伤: '伤门', 杜: '杜门', 景: '景门', 死: '死门', 惊: '惊门', 开: '开门' };

// 八神
const SHEN_WUXING = { 值符: '土', 腾蛇: '火', 太阴: '金', 六合: '木', 白虎: '金', 玄武: '水', 九地: '土', 九天: '金' };
const GOD_CHAR = { 符: '值符', 蛇: '腾蛇', 阴: '太阴', 合: '六合', 虎: '白虎', 玄: '玄武', 地: '九地', 天: '九天' };

const YUAN_NAMES = ['上元', '中元', '下元'];
const JU_CN = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };

/**
 * 用神映射：只给「用神为何、落何宫、为何这样取」，不给吉凶、不给建议。
 */
const YONGSHEN_RULES = [
  {
    target: '求财',
    keywords: ['求财', '财运', '財', '财', '赚钱', '投资', '生意', '买卖', '开张', '利'],
    items: [{ kind: '门', name: '生门', why: '生门为财货之门' }, { kind: '干', name: '戊', why: '戊为资本、资金之仪' }],
  },
  {
    target: '事业',
    keywords: ['事业', '工作', '升职', '求职', '官运', '职业', '升迁', '调动'],
    items: [{ kind: '门', name: '开门', why: '开门主事业、官途' }],
  },
  {
    target: '婚姻',
    keywords: ['婚姻', '感情', '恋爱', '夫妻', '婚恋', '对象', '结婚', '桃花'],
    items: [{ kind: '门', name: '休门', why: '休门主婚姻、蓄养' }, { kind: '神', name: '六合', why: '六合主婚配、和合' }],
  },
  {
    target: '疾病',
    keywords: ['疾病', '病', '健康', '医疗', '看病', '手术', '身体'],
    items: [{ kind: '星', name: '天芮', why: '天芮为病星' }, { kind: '门', name: '死门', why: '死门主疾病、终结' }],
  },
  {
    target: '官非',
    keywords: ['官非', '官司', '诉讼', '法律', '纠纷', '打官司', '合同纠纷'],
    items: [{ kind: '门', name: '惊门', why: '惊门主惊恐、口舌官非' }, { kind: '门', name: '开门', why: '开门主官府、公门' }],
  },
  {
    target: '出行',
    keywords: ['出行', '旅游', '旅行', '出差', '远行', '外出', '搬迁', '搬家', '迁移'],
    items: [{ kind: '门', name: '开门', why: '开门主出行、通达' }, { kind: '马星', name: '驿马', why: '驿马主远行、迁移' }],
  },
  {
    target: '学业',
    keywords: ['学业', '考试', '学习', '升学', '考研', '考公', '读书', '成绩'],
    items: [{ kind: '星', name: '天辅', why: '天辅主文教、学业' }, { kind: '门', name: '景门', why: '景门主文书、考试' }],
  },
  {
    target: '文书',
    keywords: ['文书', '合同', '文件', '签约', '协议', '证件', '审批'],
    items: [{ kind: '门', name: '景门', why: '景门主文书、契据' }, { kind: '干', name: '丁', why: '丁奇主文书、文信' }],
  },
  {
    target: '求人',
    keywords: ['求人', '贵人', '求助', '靠山', '谋事', '合作', '找人'],
    items: [{ kind: '神', name: '值符', why: '值符为八神之首，主贵人、主导者' }, { kind: '星', name: '天心', why: '天心主谋略、医药、高层' }],
  },
  {
    target: '失物',
    keywords: ['失物', '寻物', '丢失', '找东西', '丢东西'],
    items: [{ kind: '门', name: '生门', why: '失物多取生门为用神' }, { kind: '星', name: '天蓬', why: '天蓬主盗贼、隐匿' }],
  },
];

// ------------------------------------------------------------------ 小工具
function gzIndex(gan, zhi) {
  const gi = GAN.indexOf(gan);
  const zi = ZHI.indexOf(zhi);
  for (let i = 0; i < 60; i += 1) {
    if (i % 10 === gi && i % 12 === zi) return i;
  }
  return -1;
}

function gzStr(idx) {
  const i = ((idx % 60) + 60) % 60;
  return GAN[i % 10] + ZHI[i % 12];
}

/** 旺相休囚死（按月令五行），客观五行关系。 */
function wangshuai(el, monthEl) {
  if (!el) return null;
  if (el === monthEl) return '旺';
  if (WUXING_SHENG[monthEl] === el) return '相';
  if (WUXING_SHENG[el] === monthEl) return '休';
  if (WUXING_KE[el] === monthEl) return '囚';
  if (WUXING_KE[monthEl] === el) return '死';
  return null;
}

function cnNum(n) {
  return n >= 1 && n <= 9 ? '一二三四五六七八九'[n - 1] : String(n);
}

/** 时支对应的公历时间范围（子时按 23:00~00:59 表述）。 */
function timeRange(dt) {
  const idx = Math.floor(((dt.h + 1) / 2) % 12);
  if (idx === 0) return '23:00~00:59';
  const start = idx * 2 - 1;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(start)}:00~${pad(start + 1)}:59`;
}

function dateOnlyUtc(dt) {
  return Date.UTC(dt.y, dt.m - 1, dt.d);
}

function fmtDate(ms) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

/** 拆补法符头：最近甲/己日（含当日）与三元。 */
function dingJu(dayGz) {
  const d = gzIndex(dayGz[0], dayGz[1]);
  const dm = d % 10;
  const back = dm >= 5 ? dm - 5 : dm;
  const futou = gzStr(d - back);
  const fzhi = futou[1];
  let yuan = '上元';
  if ('寅申巳亥'.includes(fzhi)) yuan = '中元';
  else if ('辰戌丑未'.includes(fzhi)) yuan = '下元';
  return { futou, yuan, back };
}

function solarToDt(solar) {
  return {
    y: solar.getYear(), m: solar.getMonth(), d: solar.getDay(),
    h: solar.getHour(), mi: solar.getMinute(), s: solar.getSecond(),
    ms: Date.UTC(solar.getYear(), solar.getMonth() - 1, solar.getDay(), solar.getHour(), solar.getMinute(), solar.getSecond()),
  };
}

// ------------------------------------------------------------------ 用神
function findPalaceBy(palaces, kind, name) {
  if (kind === '门') return palaces.find((p) => p.gate === name) || null;
  if (kind === '星') {
    return palaces.find((p) => p.star === name || (p.star_extra || []).includes(name)) || null;
  }
  if (kind === '神') return palaces.find((p) => p.shen === name) || null;
  if (kind === '干') {
    const byTian = palaces.find((p) => p.tianpan_gan === name || (p.tianpan_gan_extra || []).includes(name));
    if (byTian) return byTian;
    return palaces.find((p) => p.dipan_gan === name) || null;
  }
  return null;
}

function yimaZhi(timeZhi) {
  const groups = { 申子辰: '寅', 寅午戌: '申', 巳酉丑: '亥', 亥卯未: '巳' };
  for (const [combo, horse] of Object.entries(groups)) {
    if (combo.includes(timeZhi)) return horse;
  }
  return '';
}

function yongshenOf(data, ask) {
  if (!ask) return [];
  const palaces = data.palaces;
  const out = [];
  let matched = false;
  for (const rule of YONGSHEN_RULES) {
    if (!rule.keywords.some((kw) => ask.includes(kw))) continue;
    matched = true;
    for (const item of rule.items) {
      if (item.kind === '马星') {
        const horse = yimaZhi(data.pillars.time.zhi);
        const gong = ZHI_GONG[horse];
        out.push({
          target: rule.target,
          palace: `驿马（${horse}）`,
          gong: GONG_NAME[gong],
          direction: GONG_DIR[gong],
          kind: '马星',
          wuxing: ZHI_WUXING[horse],
          why: `${item.why}；以时支${data.pillars.time.zhi}所属三合局取马星${horse}，该支后天八卦位在${GONG_NAME[gong]}`,
        });
        continue;
      }
      const p = findPalaceBy(palaces, item.kind, item.name);
      if (!p) continue;
      const extra = [];
      if (p.tianpan_gan) extra.push(`天盘${p.tianpan_gan}`);
      if (p.star) extra.push(p.star);
      if (p.gate) extra.push(p.gate);
      out.push({
        target: rule.target,
        palace: item.name,
        gong: p.gong,
        direction: p.direction,
        kind: item.kind,
        wuxing: STAR_WUXING[item.name] || GATE_WUXING[item.name] || SHEN_WUXING[item.name] || GAN_WUXING[item.name],
        tianpan_gan: p.tianpan_gan,
        star: p.star,
        gate: p.gate,
        shen: p.shen,
        why: `${item.why}；现落${p.gong}（${p.direction}），宫内${extra.filter(Boolean).join('、')}`,
      });
    }
  }
  if (!matched) {
    // 通用用神：日干代表求测人，时干代表所问之事（均看天盘，兼看地盘）
    for (const [label, key, role] of [['日干', 'day', '求测人'], ['时干', 'time', '所问之事']]) {
      const pil = data.pillars[key];
      const gan = pil.gan;
      let p = null;
      let disp = '';
      let why = '';
      if (gan === '甲') {
        const idx = gzIndex(pil.ganzhi[0], pil.ganzhi[1]);
        const yi = XUNSHOU_YI[Math.floor(idx / 10) * 10];
        p = findPalaceBy(palaces, '干', yi);
        disp = `${label}甲（遁${yi}）`;
        why = `${label}甲无地盘位，遁于本旬旬首之仪${yi}，以${yi}之地盘宫${p ? p.gong : '—'}为甲之落宫`;
      } else {
        p = findPalaceBy(palaces, '干', gan);
        disp = `${label}${gan}`;
        why = p
          ? `${label}${gan}为${role}，${gan}之天盘落${p.gong}（${p.direction}）`
          : `${label}${gan}未落宫`;
      }
      if (!p) continue;
      out.push({
        target: '通用', palace: disp, gong: p.gong, direction: p.direction, kind: '干',
        wuxing: GAN_WUXING[gan],
        tianpan_gan: p.tianpan_gan, star: p.star, gate: p.gate, shen: p.shen, why,
      });
    }
  }
  return out;
}

// ------------------------------------------------------------------ hints / notes
function makeHints(data) {
  const jq = data.jieqi;
  const zf = data.zhifu;
  const zs = data.zhishi;
  const hints = [
    `节气${jq.current}（交节${jq.term_time.replace('T', ' ')}），`
    + `日干支符头${jq.futou}，故${jq.yuan}；${jq.yin_yang}${cnNum(jq.ju)}局`
    + `（距交节 ${jq.days_from_term} 天，本节气第 ${jq.term_day_index} 天）`,
    `时柱${data.pillars.time.ganzhi}属${jq.xun}`
    + `（旬首${jq.xunshou}，遁${jq.xunshou_yi}），时旬空亡${data.kong_wang.join('')}`,
    `值符${zf.star}落${zf.palace}，值使${zs.gate}落${zs.palace}`,
    '中五宫寄坤二宫：地盘干寄坤二，天禽随天芮同宫；中五宫无门、无神',
  ];
  if (zf.original_palace === GONG_NAME[5]) {
    hints.push(`值符本宫为中五宫（天禽），今落${zf.palace}`);
    hints.push('值使本门为寄宫坤二之死门（中五宫无门）');
  }
  hints.push(
    `日干${data.pillars.day.gan}、时干${data.pillars.time.gan}之地盘落宫分别为`
    + `${ganGong(data, data.pillars.day.gan, 'day')}、${ganGong(data, data.pillars.time.gan, 'time')}`,
  );
  if (data.pillars.time.gan === '甲') {
    hints.push('时干为甲，值符加本旬旬首本宫，天盘九星与地盘九星重合（九星伏吟）');
  }
  return hints;
}

/** 某天干的地盘落宫；甲无地盘位，以其所属旬之旬首仪落宫表示。 */
function ganGong(data, gan, pillarKey) {
  if (gan === '甲') {
    const pil = data.pillars[pillarKey];
    const idx = gzIndex(pil.ganzhi[0], pil.ganzhi[1]);
    const yi = XUNSHOU_YI[Math.floor(idx / 10) * 10];
    const p = data.palaces.find((x) => x.dipan_gan === yi);
    return p ? `${p.gong}（甲遁${yi}）` : '—';
  }
  const p = data.palaces.find((x) => x.dipan_gan === gan);
  return p ? p.gong : '—';
}

function makeNotes(data, lateZi) {
  const jq = data.jieqi;
  const notes = [
    '中五宫寄坤二宫：中五宫地盘干同时视为寄于坤二宫（故坤二宫带 dipan_gan_extra），'
    + '天禽星永远与天芮星同宫（star_extra），中五宫本身排门、排神、排天盘干均不参与，'
    + '输出中，中五宫的 gate / shen / tianpan_gan 为 null。',
    '奇门为「时家」盘：定局取日干支符头（拆补法），阴阳遁与局数取当前节气与三元；'
    + '值符随时干、值使随时支（本旬第几个时辰），八神阳顺阴逆。',
    '转盘法（两套环序，勿混）：① 地盘三奇六仪与「值使飞宫」走洛书九宫数序 1→2→…→9'
    + '（阳遁顺、阴遁逆）；② 天盘九星、天盘干、八门、八神在「后天八卦方位顺时针环」'
    + '坎1→艮8→震3→巽4→离9→坤2→兑7→乾6 上整体刚性转动（环上 ±4 位即对冲/反吟）。'
    + '八门以值使门落宫为起点、八神以天盘值符星宫为起点，阳遁沿环顺行、阴遁逆行。',
  ];
  if (jq.yuan !== '上元') {
    notes.push(
      `拆补法说明：当前日之符头（${jq.futou}）所定为${jq.yuan}，并非上元。`
      + '拆补法以符头定元、不置闰，故节气内首元未必是上元；'
      + `此时局数取「${jq.current}·${jq.yuan}」对应的局。`,
    );
  }
  if (jq.days_from_term === 0) {
    notes.push(`交节当日：${jq.current}交节时刻为 ${jq.term_time.replace('T', ' ')}，此时刻之后才按新节气定局。`);
  }
  if (lateZi) {
    notes.push('晚子时（23:00 后）：本盘四柱采用「子时换日」流派（日柱按次日起算），'
      + '以保证时柱与日柱满足五鼠遁；另有「日柱不换日」流派，日柱会差一天，但符头三元不变。');
  }
  return notes;
}

// ------------------------------------------------------------------ 入口
/**
 * 时家奇门排盘（拆补法 · 转盘）。
 * @param {{solar:string, ask?:string, gender?:string, longitude?:number|null,
 *          use_true_solar?:boolean, use_eot?:boolean}} opts
 */
export function buildQimen(opts) {
  const p = opts || {};
  const baseDt = parseSolar(p.solar);
  const ask = p.ask == null ? null : (String(p.ask).trim() || null);
  const longitude = p.longitude == null ? null : Number(p.longitude);
  const useEot = p.use_eot !== false;
  const applyTrueSolar = longitude != null && p.use_true_solar !== false;
  const { dt, info: tsInfo } = applyTrueSolar
    ? trueSolarTime(baseDt, longitude, useEot)
    : {
      dt: baseDt,
      info: { applied: false, delta_minutes: 0, longitude: null, equation_of_time_minutes: 0, note: '' },
    };

  // ---- 四柱（奇门默认「子时换日」sect=1，与 Python 引擎一致）与节气时刻
  let lunar;
  let ec;
  try {
    lunar = Solar.fromYmdHms(dt.y, dt.m, dt.d, dt.h, dt.mi, dt.s).getLunar();
    ec = lunar.getEightChar();
    if (typeof ec.setSect === 'function') ec.setSect(1);
  } catch (e) {
    const err = new Error(`lunar-javascript 排盘失败：${e.message}`);
    err.code = 'BAD_DATETIME';
    throw err;
  }
  const pillarGz = { year: ec.getYear(), month: ec.getMonth(), day: ec.getDay(), time: ec.getTime() };
  const pillars = {};
  for (const key of ['year', 'month', 'day', 'time']) {
    const gz = pillarGz[key];
    const gan = gz[0];
    const zhi = gz[1];
    pillars[key] = { ganzhi: gz, gan, zhi, gan_wuxing: GAN_WUXING[gan], zhi_wuxing: ZHI_WUXING[zhi] };
  }
  const dayGz = pillarGz.day;
  const timeGz = pillarGz.time;
  const timeZhi = timeGz[1];
  const monthWuxing = ZHI_WUXING[pillarGz.month[1]];

  const prevJq = lunar.getPrevJieQi();
  const nextJq = lunar.getNextJieQi();
  const term = prevJq.getName();
  const termDt = solarToDt(prevJq.getSolar());
  const nextTermDt = solarToDt(nextJq.getSolar());
  const daysFromTerm = Math.round((dateOnlyUtc(dt) - dateOnlyUtc(termDt)) / 86400000);

  // ---- kinqimen 排盘（拆补 · 转盘）
  let pan;
  try {
    pan = new Qimen({ year: dt.y, month: dt.m, day: dt.d, hour: dt.h, minute: dt.mi })
      .pan({ type: '转盘', juMethod: '拆补' });
  } catch (e) {
    const err = new Error(`kinqimen 排盘失败：${e && e.message ? e.message : e}`);
    err.code = 'BAD_DATETIME';
    throw err;
  }

  // ---- 定局（拆补法）：局数/阴阳遁/三元/符头
  const juMatch = /^(阳|阴)([一二三四五六七八九])局(上|中|下)$/.exec(String(pan.ju || ''));
  if (!juMatch) {
    const err = new Error(`kinqimen 返回局数格式异常：${pan.ju}`);
    err.code = 'BAD_DATETIME';
    throw err;
  }
  const yangDun = juMatch[1] === '阳';
  const ju = JU_CN[juMatch[2]];
  const yuan = `${juMatch[3]}元`;
  const { futou, back } = dingJu(dayGz);
  const futouSolar = fmtDate(dateOnlyUtc(dt) - back * 86400000);

  // ---- 旬首 / 旬空
  const tIdx = gzIndex(timeGz[0], timeGz[1]);
  const xsIdx = Math.floor(tIdx / 10) * 10;
  const xunshou = gzStr(xsIdx);
  const xunshouYi = XUNSHOU_YI[xsIdx];
  const steps = tIdx - xsIdx;
  const xunIndex = steps + 1;
  const timeKong = String(ec.getTimeXunKong()).split('').filter((c) => ZHI.includes(c));
  const dayKong = String(ec.getDayXunKong()).split('').filter((c) => ZHI.includes(c));
  const kongSet = new Set(timeKong);
  const kongGongs = [...new Set(timeKong.map((z) => ZHI_GONG[z]))].sort((a, b) => a - b);

  // ---- 地盘三奇六仪 / 天盘 / 八门 / 八神（kinqimen 面板 → 宫号）
  const earthByNum = {};
  const skyByNum = {};
  const starByNum = {};
  const gateByNum = {};
  const godByNum = {};
  for (const num of LUOSHU) {
    const tri = GONG_TRIGRAM[num];
    earthByNum[num] = pan.earthPan[tri];
    skyByNum[num] = pan.skyPan[tri];
    starByNum[num] = pan.starPan[tri];
    gateByNum[num] = pan.doorPan[tri];
    godByNum[num] = pan.godPan[tri];
  }
  const g5 = earthByNum[5]; // 中五宫地盘干（寄坤二）

  // ---- 值符星 / 值使门（Python 同口径：旬首仪落宫定值符本宫）
  const xunshouGong = LUOSHU.find((n) => earthByNum[n] === xunshouYi);
  if (!xunshouGong) {
    const err = new Error(`奇门地盘未找到旬首仪 ${xunshouYi}`);
    err.code = 'BAD_DATETIME';
    throw err;
  }
  const zhifuStar = STAR_HOME[xunshouGong];
  const zhishiHomeGong = xunshouGong === 5 ? 2 : xunshouGong;
  const zhishiGate = GATE_HOME[zhishiHomeGong];

  // 值符加时干：时干为甲则用本旬旬首仪；落中五宫时寄坤二
  let targetGong;
  let jiaNote = '';
  if (timeGz[0] === '甲') {
    targetGong = xunshouGong;
    jiaNote = '时干为甲，以本旬旬首之仪代甲';
  } else {
    targetGong = LUOSHU.find((n) => earthByNum[n] === timeGz[0]);
    if (!targetGong) {
      const err = new Error(`奇门地盘未找到时干 ${timeGz[0]}`);
      err.code = 'BAD_DATETIME';
      throw err;
    }
  }
  const zhifuLayoutGong = targetGong === 5 ? 2 : targetGong;

  // 值使随时支：本旬第几个时辰，洛书九宫数序阳顺阴逆
  let zhishiTarget;
  if (yangDun) zhishiTarget = ((xunshouGong - 1 + steps) % 9) + 1;
  else zhishiTarget = ((((xunshouGong - 1 - steps) % 9) + 9) % 9) + 1;
  const zhishiLayoutGong = zhishiTarget === 5 ? 2 : zhishiTarget;

  // 天禽随天芮同宫：落宫由 kinqimen starPan 中「禽」的位置给出
  const ruisGong = LUOSHU.find((n) => starByNum[n] === '禽') || 0;

  // ---- 9 宫输出
  const palaces = [];
  for (const num of LUOSHU) {
    const isZhong5 = num === 5;
    const rawStar = starByNum[num];
    const star = isZhong5 ? STAR_HOME[5] : (rawStar ? STAR_CHAR[rawStar] : null);
    const starExtra = (!isZhong5 && rawStar === '禽') ? ['天禽'] : [];
    const gate = isZhong5 ? null : (GATE_CHAR[gateByNum[num]] || null);
    const shen = isZhong5 ? null : (GOD_CHAR[godByNum[num]] || null);
    const tianpanGan = isZhong5 ? null : (skyByNum[num] || null);
    const tianpanGanExtra = (!isZhong5 && rawStar === '禽') ? [g5] : [];
    const starWuxing = star ? STAR_WUXING[star] : null;
    const gateWuxing = gate ? GATE_WUXING[gate] : null;
    const shenWuxing = shen ? SHEN_WUXING[shen] : null;
    const palace = {
      gong: GONG_NAME[num],
      number: num,
      direction: GONG_DIR[num],
      trigram: GONG_TRIGRAM[num],
      dipan_gan: earthByNum[num],
      dipan_gan_extra: num === 2 ? [g5] : [],
      tianpan_gan: tianpanGan,
      tianpan_gan_extra: tianpanGanExtra,
      star,
      star_extra: starExtra,
      gate,
      shen,
      star_wuxing: starWuxing,
      gate_wuxing: gateWuxing,
      shen_wuxing: shenWuxing,
      star_wangshuai: wangshuai(starWuxing, monthWuxing),
      gate_wangshuai: wangshuai(gateWuxing, monthWuxing),
      is_zhifu_star: num === zhifuLayoutGong,
      is_zhishi_gate: num === zhishiLayoutGong,
      is_zhifu_shen: num === zhifuLayoutGong,
      kong_wang: kongGongs.includes(num),
      note: '',
    };
    palace.star_ji = palace.is_zhifu_star;
    palace.gate_ji = palace.is_zhishi_gate;
    palace.shen_ji = palace.is_zhifu_shen;
    if (isZhong5) {
      palace.note = '中五宫寄坤二宫：地盘干寄坤二，天禽随天芮同宫，中五宫无门无神、无独立天盘干';
    } else if (num === ruisGong) {
      palace.note = '天禽随天芮同宫；中五宫地盘干随天芮转动';
    }
    if (kongGongs.includes(num)) {
      palace.note = (palace.note ? `${palace.note}；` : '') + `时旬空亡（${[...kongSet].sort().join('')}）落此宫`;
    }
    palaces.push(palace);
  }

  // ---- 值符 / 值使 摘要
  const zhifuLayoutP = palaces.find((x) => x.number === zhifuLayoutGong);
  const zhishiLayoutP = palaces.find((x) => x.number === zhishiLayoutGong);
  const zhifuNoteParts = [];
  if (xunshouGong === 5) zhifuNoteParts.push('中五宫值符：旬首之仪落中五宫，值符取天禽，天禽寄坤二宫');
  zhifuNoteParts.push(`值符加时干：时干${timeGz[0]}之地盘宫为${GONG_NAME[targetGong]}`);
  if (targetGong === 5) zhifuNoteParts.push('时干落中五宫，寄坤二宫，故值符加临坤二宫');
  if (jiaNote) zhifuNoteParts.push(jiaNote);
  if (targetGong === xunshouGong) zhifuNoteParts.push('值符归本宫，九星伏吟');
  const zhifu = {
    star: zhifuStar,
    palace: GONG_NAME[targetGong],
    gong: targetGong,
    direction: GONG_DIR[targetGong],
    layout_palace: zhifuLayoutP.gong,
    layout_gong: zhifuLayoutGong,
    original_palace: GONG_NAME[xunshouGong],
    xunshou,
    xunshou_yi: xunshouYi,
    dipan_gan: earthByNum[zhifuLayoutGong],
    tianpan_gan: zhifuLayoutP.tianpan_gan,
    tianpan_gan_extra: zhifuLayoutP.tianpan_gan_extra,
    note: zhifuNoteParts.join('；'),
  };
  const zhishiNoteParts = [];
  if (xunshouGong === 5) zhishiNoteParts.push('旬首之仪落中五宫，中五无门，值使取寄宫坤二之死门');
  zhishiNoteParts.push(
    `值使随时支：本旬第 ${xunIndex} 个时辰（${steps} 步），`
    + `自值使本宫（${GONG_NAME[xunshouGong === 5 ? 2 : xunshouGong]}）起在洛书九宫数序上`
    + `${yangDun ? '顺' : '逆'}行，落${GONG_NAME[zhishiTarget]}`,
  );
  if (zhishiTarget === 5) zhishiNoteParts.push(`值使飞宫落中五宫（${GONG_NAME[zhishiLayoutGong]}），中五无门，寄坤二宫`);
  const zhishi = {
    gate: zhishiGate,
    palace: GONG_NAME[zhishiTarget],
    gong: zhishiTarget,
    direction: GONG_DIR[zhishiTarget],
    layout_palace: zhishiLayoutP.gong,
    layout_gong: zhishiLayoutGong,
    original_palace: GONG_NAME[zhishiHomeGong],
    original_gate: zhishiGate,
    xun_index: xunIndex,
    steps,
    note: zhishiNoteParts.join('；'),
  };

  const data = {
    solar: iso(baseDt),
    solar_true: iso(dt),
    true_solar: tsInfo,
    gender: p.gender ? String(p.gender) : 'male',
    lunar: lunar.toString(),
    ganzhi: `${pillarGz.year} ${pillarGz.month} ${pillarGz.day} ${pillarGz.time}`,
    pillars,
    time: `${timeZhi}时`,
    time_range: timeRange(dt),
    ask,
    jieqi: {
      current: term,
      next: nextJq.getName(),
      term_time: iso(termDt),
      next_term_time: iso(nextTermDt),
      days_from_term: daysFromTerm,
      term_day_index: daysFromTerm + 1,
      yuan,
      futou,
      futou_solar: futouSolar,
      days_from_futou: back,
      yuan_day_index: back + 1,
      yang_dun: yangDun,
      yin_yang: yangDun ? '阳遁' : '阴遁',
      ju,
      jushu: `${yangDun ? '阳遁' : '阴遁'}${cnNum(ju)}局`,
      method: METHOD,
      xunshou,
      xun: `${xunshou}旬`,
      xunshou_yi: xunshouYi,
    },
    zhifu,
    zhishi,
    palaces,
    kong_wang: timeKong,
    kong_wang_info: {
      xun: `${xunshou}旬`,
      zhi: timeKong,
      gong: kongGongs.map((g) => GONG_NAME[g]),
      day_kong_zhi: dayKong,
      rule: '时柱旬空（甲子旬空戌亥、甲戌旬空申酉、甲申旬空午未、甲午旬空辰巳、甲辰旬空寅卯、甲寅旬空子丑）',
    },
    yongshen: [],
    hints: [],
    notes: [],
    note: METHOD,
  };
  data.notes = makeNotes(data, dt.h >= 23);
  data.yongshen = yongshenOf(data, ask);
  data.hints = makeHints(data);
  data.note = data.notes[0];
  return data;
}
