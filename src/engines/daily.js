/**
 * Daily almanac + natal cross-check engine (pure client-side, no network).
 *
 * Produces the deterministic half of the daily feedback card:
 *   - today's 干支 / 农历 / 黄历（宜忌、冲煞、值神、吉神凶煞、喜财福方位、彭祖百忌）
 *   - relations between today's branch and the natal four branches
 *   - a 0-100 day score and a rule-based 3-paragraph summary
 *
 * The AI narrative (optional) is composed on top of this data elsewhere; this
 * module never calls a model.
 */
import lunarJs from 'lunar-javascript';
import { buildBazi } from './bazi.js';

const { Solar } = lunarJs;

const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const ZHI_WUXING = { 子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水' };
const GAN_WUXING = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
const ZHI_CHONG = [['子', '午'], ['丑', '未'], ['寅', '申'], ['卯', '酉'], ['辰', '戌'], ['巳', '亥']];
const ZHI_HE = [['子', '丑'], ['寅', '亥'], ['卯', '戌'], ['辰', '酉'], ['巳', '申'], ['午', '未']];
const ZHI_HAI = [['子', '未'], ['丑', '午'], ['寅', '巳'], ['卯', '辰'], ['申', '亥'], ['酉', '戌']];
const ZHI_PO = [['子', '酉'], ['丑', '辰'], ['寅', '亥'], ['卯', '午'], ['巳', '申'], ['未', '戌']];
const XING_GROUPS = [['寅', '巳', '申'], ['丑', '戌', '未']];
const XING_PAIRS = [['子', '卯']];
const PILLAR_NAMES = { year: '年支', month: '月支', day: '日支', time: '时支' };

/** UTC+8 local ISO date string for a Date. */
export function localDateKey(date = new Date()) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 10);
}

function pairKey(a, b) {
  return [a, b].sort((x, y) => ZHI.indexOf(x) - ZHI.indexOf(y)).join('');
}

function zhiRelation(a, b) {
  if (!a || !b) return null;
  if (a === b) return XING_PAIRS.some((p) => p[0] === a) ? '刑' : null;
  const key = pairKey(a, b);
  if (ZHI_CHONG.some((p) => p.join('') === key)) return '冲';
  if (ZHI_HE.some((p) => p.join('') === key)) return '合';
  if (ZHI_HAI.some((p) => p.join('') === key)) return '害';
  if (ZHI_PO.some((p) => p.join('') === key)) return '破';
  if (XING_PAIRS.some((p) => p.join('') === key)) return '刑';
  if (XING_GROUPS.some((group) => group.includes(a) && group.includes(b))) return '刑';
  return null;
}

/** Favorable elements from the day-master strength (扶抑法). */
function favorableElements(bazi) {
  const strength = bazi?.day_master?.strength || {};
  const me = bazi?.day_master?.wuxing;
  const level = strength.level || '';
  const weak = /弱/.test(level);
  if (!me) return [];
  if (weak) return [SHENG[Object.keys(SHENG).find((k) => SHENG[k] === me)] || me, me]; // 印 + 比
  return [KE[me], SHENG[me]]; // 财 + 食伤
}

function timeOfDayTip(dayGanZhi) {
  return `吉时参考：${dayGanZhi}日可优先用在上午（辰时~巳时）处理需要推动的事，傍晚后收敛复盘。`;
}

// ── 分项运势（黄历 × 本命 双标准） ─────────────────────────────────────
const REL_SCORE = { 合: 8, 冲: -8, 刑: -6, 害: -5, 破: -4 };
const PILLAR_WEIGHT = { day: 1.2, month: 1, year: 0.7, time: 0.6 };
const CATEGORY_PILLARS = {
  career: { month: 1, day: 0.8 },
  wealth: { day: 0.9, year: 0.6 },
  love: { day: 1, month: 0.6 },
  health: { day: 1, year: 0.7 },
  travel: { year: 0.9, time: 0.8 },
  social: { month: 1, day: 0.8 },
};
const CATEGORY_KEYWORDS = {
  career: ['开市', '赴任', '求职', '上任', '会议', '立券', '交易', '纳财', '修造', '动土'],
  wealth: ['开市', '交易', '立券', '纳财', '出货财', '放水', '经络', '纳畜', '开仓'],
  love: ['嫁娶', '纳采', '订盟', '会亲友', '求嗣', '安床', '造仓', '沐浴'],
  health: ['求医', '治病', '针灸', '祭祀', '祈福', '解除', '沐浴', '扫舍'],
  travel: ['出行', '移徙', '赴任', '开市', '经络', '立券'],
  social: ['会亲友', '纳采', '订盟', '祭祀', '祈福', '宴请', '出行'],
};
const TEN_GOD_CATEGORIES = { 官杀: ['career'], 财: ['wealth'], 食伤: ['love', 'health'], 印: ['health', 'career'], 比劫: ['social', 'travel'] };
const ELEMENT_CATEGORIES = { 木: ['career'], 火: ['social', 'love'], 土: ['health'], 金: ['wealth'], 水: ['wealth', 'travel'] };
const JIAN_SCORE = { 成: 6, 开: 6, 定: 5, 执: 4, 建: 3, 满: 2, 除: 3, 平: 0, 收: 1, 危: -5, 破: -7, 闭: -6 };
const AUSPICIOUS_KEYWORDS = { career: ['天德', '月德', '玉堂', '司命', '金匮'], wealth: ['金匮', '天财', '禄', '财'], love: ['天喜', '红鸾', '天愿'], health: ['福生', '天医', '解神'], travel: ['驿马', '天马', '王日'], social: ['天德', '月德', '天恩', '益后'] };
const INAUSPICIOUS_KEYWORDS = ['白虎', '天刑', '劫煞', '大煞', '天火', '五虚', '九空', '月煞', '灾煞', '死气', '触水龙'];
const TIAN_GOD_LABEL = { career: '官杀', wealth: '财星', love: '食伤', health: '印星', travel: '比劫', social: '比劫' };

function tenGodOf(dayGan, dayMasterGan) {
  const ganElement = GAN_WUXING[dayGan];
  const me = GAN_WUXING[dayMasterGan];
  if (!ganElement || !me) return '';
  if (ganElement === me) return '比劫';
  if (SHENG[ganElement] === me) return '印';
  if (SHENG[me] === ganElement) return '食伤';
  if (KE[me] === ganElement) return '财';
  if (KE[ganElement] === me) return '官杀';
  return '';
}

function levelOf(score) {
  if (score >= 72) return '顺';
  if (score >= 58) return '平稳';
  if (score >= 44) return '留意';
  return '谨慎';
}

/** Deterministic bottom-of-page reading composed from the almanac + aspects. */
function buildExplain({ dateKey, dayGanZhi, almanac, relations, aspects, tenGod, dayMaster, favorable, score, level }) {
  if (!aspects?.length) return '';
  const sorted = [...aspects].sort((a, b) => b.score - a.score);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  const relText = relations.length
    ? relations.map((relation) => `今日${relation.zhi?.[0] || ''}${relation.type}本命${relation.label}${relation.zhi?.[1] || ''}`).join('；')
    : '今日与四支无直接冲合，节奏偏中性';

  return [
    `【今日定性】${dateKey} 为${dayGanZhi}日，值神${almanac.zhiShen}（${almanac.zhiShenType}），建除「${almanac.jian}」。` +
      `日主${dayMaster?.gan || ''}${dayMaster?.wuxing || ''}${dayMaster?.level ? `（${dayMaster.level}）` : ''}，今日天干对其为${tenGod || '—'}。`,
    `【与本命】${relText}。喜用五行为${favorable?.length ? favorable.join('、') : '未判定'}${dayMaster?.wuxing ? `，日主属${dayMaster.wuxing}` : ''}。`,
    `【六维】${sorted.map((aspect) => `${aspect.label}${aspect.score}`).join('、')}，总分 ${score}/100（${level}）。` +
      `最强是${best.label}（${best.score}·${best.level}），最弱是${worst.label}（${worst.score}·${worst.level}）。`,
    `【建议】相对最顺的是${best.label}（${best.score}·${best.level}）：${best.advice}；${worst.label}方面最需要收着（${worst.score}·${worst.level}）：${worst.advice}。` +
      `黄历给出的宜事集中在「${(almanac.yi || []).slice(0, 3).join('、') || '无'}」，忌事「${(almanac.ji || []).slice(0, 3).join('、') || '无'}」，重要安排尽量避开忌项。`,
    `【说明】分数由黄历宜忌、本命冲合刑害、十神、喜用五行与神煞规则合成，属传统文化推演，仅供参考，不做医疗/投资建议。`,
  ].join('\n');
}


/**
 * Six aspects, each blending today's almanac with the natal chart.
 * @returns {{key:string,label:string,score:number,level:string,reasons:string[],advice:string}[]}
 */
export function buildAspects({ almanac, relations, favorable, bazi, dayGan, dayZhi }) {
  const dayMasterGan = bazi?.pillars?.day?.gan || bazi?.day_master?.gan || '';
  const tenGod = tenGodOf(dayGan, dayMasterGan);
  const dayElement = GAN_WUXING[dayGan] || '';
  const branchElement = ZHI_WUXING[dayZhi] || '';
  const yi = almanac?.yi || [];
  const ji = almanac?.ji || [];
  const jiShen = (almanac?.jiShen || []).join(' ');
  const xiongSha = (almanac?.xiongSha || []).join(' ');
  const labels = { career: '事业', wealth: '财运', love: '桃花', health: '健康', travel: '出行', social: '人际' };

  return Object.keys(labels).map((key) => {
    let score = 50;
    const reasons = [];
    const push = (delta, text) => {
      if (!delta) return;
      score += delta;
      if (text) reasons.push(text);
    };

    // 1) 黄历宜忌：同一件事出现在宜/忌即加减
    const hitYi = yi.filter((item) => (CATEGORY_KEYWORDS[key] || []).some((word) => item.includes(word)));
    const hitJi = ji.filter((item) => (CATEGORY_KEYWORDS[key] || []).some((word) => item.includes(word)));
    if (hitYi.length) push(Math.min(10, 4 + hitYi.length * 2), `宜${hitYi.slice(0, 2).join('、')}`);
    if (hitJi.length) push(-Math.min(9, 4 + hitJi.length * 2), `忌${hitJi.slice(0, 2).join('、')}`);

    // 2) 本命冲合：按柱位权重作用到对应领域
    relations.forEach((relation) => {
      const weight = (CATEGORY_PILLARS[key] || {})[relation.pillar] ?? PILLAR_WEIGHT[relation.pillar] ?? 0;
      const delta = (REL_SCORE[relation.type] || 0) * weight;
      if (delta) push(Math.round(delta), `${relation.label}${relation.type}`);
    });

    // 3) 十神：今日天干对日主的十神
    if (tenGod && (TEN_GOD_CATEGORIES[tenGod] || []).includes(key)) {
      push(6, `今日${dayGan}为${TIAN_GOD_LABEL[key] || tenGod}`);
    }

    // 4) 用神：今日干支五行是否为喜用
    if (dayElement && favorable?.includes(dayElement)) push(5, `${dayElement}助用神`);
    if (branchElement && favorable?.includes(branchElement)) push(3, `${dayZhi}${branchElement}助用神`);
    if (dayElement && favorable?.length && !favorable.includes(dayElement)) {
      (ELEMENT_CATEGORIES[dayElement] || []).forEach(() => push(-2, `${dayElement}非喜用`));
    }

    // 5) 黄历神煞与建除
    if (almanac?.zhiShenLuck === '吉') push(4, `值神${almanac.zhiShen}`);
    if (almanac?.zhiShenLuck === '凶') push(-4, `值神${almanac.zhiShen}`);
    const jianDelta = JIAN_SCORE[almanac?.jian] || 0;
    if (jianDelta) push(Math.round(jianDelta / 2), `建除${almanac?.jian}`);
    (AUSPICIOUS_KEYWORDS[key] || []).forEach((word) => {
      if (jiShen.includes(word)) push(2, `吉神${word}`);
    });
    INAUSPICIOUS_KEYWORDS.forEach((word) => {
      if (xiongSha.includes(word)) push(-1, `凶煞${word}`);
    });

    score = Math.max(5, Math.min(95, Math.round(score)));
    const advice = hitJi.length
      ? `避开${hitJi.slice(0, 2).join('、')}类安排`
      : hitYi.length
        ? `可安排${hitYi.slice(0, 2).join('、')}类事项`
        : score >= 58
          ? '按既定节奏推进'
          : '降低预期、先做可控部分';
    return { key, label: labels[key], score, level: levelOf(score), reasons: reasons.slice(0, 3), advice };
  });
}


/**
 * @param {{profile: object, date?: Date}} input
 * @returns daily feedback payload (plain JSON, safe to cache)
 */
export function buildDaily({ profile, date = new Date() } = {}) {
  if (!profile?.solar) throw new Error('buildDaily 需要命主档案（缺少 solar）');
  const day = date instanceof Date ? date : new Date(date);
  const dateKey = localDateKey(day);
  const solar = Solar.fromYmdHms(
    Number(dateKey.slice(0, 4)), Number(dateKey.slice(5, 7)), Number(dateKey.slice(8, 10)),
    day.getHours(), day.getMinutes(), 0,
  );
  const lunar = solar.getLunar();
  const dayGanZhi = lunar.getDayInGanZhiExact ? lunar.getDayInGanZhiExact() : lunar.getDayInGanZhi();
  const dayGan = dayGanZhi.slice(0, 1);
  const dayZhi = dayGanZhi.slice(1, 2);

  const almanac = {
    yi: lunar.getDayYi?.() || [],
    ji: lunar.getDayJi?.() || [],
    chong: lunar.getDayChong?.() || '',
    chongGanZhi: lunar.getDayChongDesc?.() || '',
    sha: lunar.getDaySha?.() || '',
    zhiShen: lunar.getDayTianShen?.() || '',
    zhiShenType: lunar.getDayTianShenType?.() || '',
    zhiShenLuck: lunar.getDayTianShenLuck?.() || '',
    jiShen: lunar.getDayJiShen?.() || [],
    xiongSha: lunar.getDayXiongSha?.() || [],
    xi: lunar.getDayPositionXiDesc?.() || lunar.getDayPositionXi?.() || '',
    cai: lunar.getDayPositionCaiDesc?.() || lunar.getDayPositionCai?.() || '',
    fu: lunar.getDayPositionFuDesc?.() || lunar.getDayPositionFu?.() || '',
    pengzuGan: lunar.getPengZuGan?.() || '',
    pengzuZhi: lunar.getPengZuZhi?.() || '',
    jian: lunar.getZhiXing?.() || '',
  };

  let bazi = null;
  let error = '';
  try {
    bazi = buildBazi(profile);
  } catch (cause) {
    error = String(cause?.message || cause);
  }

  const relations = [];
  if (bazi?.pillars) {
    Object.keys(PILLAR_NAMES).forEach((key) => {
      const branch = bazi.pillars[key]?.zhi;
      const type = zhiRelation(dayZhi, branch);
      if (type) {
        relations.push({
          type,
          pillar: key,
          label: PILLAR_NAMES[key],
          zhi: [dayZhi, branch],
          note: `今日${dayZhi}${type}本命${PILLAR_NAMES[key]}${branch}`,
        });
      }
    });
  }

  const favorable = [...new Set(favorableElements(bazi))];
  const dayElement = GAN_WUXING[dayGan] || '';
  const dayBranchElement = ZHI_WUXING[dayZhi] || '';
  let score = 50;
  const notes = [];
  relations.forEach((rel) => {
    if (rel.type === '合') { score += 7; notes.push(`${rel.label}相合，人和/机会面偏顺`); }
    if (rel.type === '冲') { score -= 11; notes.push(`${rel.label}受冲，变动与摩擦偏多`); }
    if (rel.type === '刑') { score -= 7; notes.push(`${rel.label}见刑，易有内耗或反复`); }
    if (rel.type === '害') { score -= 5; notes.push(`${rel.label}有害，注意沟通误会`); }
    if (rel.type === '破') { score -= 3; notes.push(`${rel.label}逢破，节奏易被打断`); }
  });
  if (dayElement && favorable.includes(dayElement)) { score += 9; notes.push(`今日天干${dayGan}（${dayElement}）助用神`); }
  if (dayBranchElement && favorable.includes(dayBranchElement)) { score += 5; notes.push(`今日地支${dayZhi}（${dayBranchElement}）助用神`); }
  if (dayElement && favorable.length && !favorable.includes(dayElement) && KE[dayElement] === (bazi?.day_master?.wuxing || '')) {
    score -= 6;
    notes.push(`今日${dayElement}气克日主，宜守不宜进`);
  }
  if (almanac.zhiShenLuck === '吉') { score += 5; notes.push(`值神${almanac.zhiShen}（黄道）`); }
  if (almanac.zhiShenLuck === '凶') { score -= 5; notes.push(`值神${almanac.zhiShen}（黑道）`); }
  score = Math.max(5, Math.min(95, Math.round(score)));

  const level = score >= 75 ? '顺势' : score >= 60 ? '平稳偏吉' : score >= 45 ? '平常' : score >= 30 ? '宜守' : '低气压';
  const yi = almanac.yi.slice(0, 5);
  const ji = almanac.ji.slice(0, 4);

  const summary = [
    `${dateKey} · ${dayGanZhi}日 · ${lunar.getMonthInChinese?.() || ''}月${lunar.getDayInChinese?.() || ''} · 值神${almanac.zhiShen}（${almanac.zhiShenType}）· 建除「${almanac.jian}」。`,
    relations.length
      ? `与本命：${relations.map((r) => r.note).join('；')}。`
      : '与本命四支无直接冲合，今日节奏偏中性。',
    `宜：${yi.length ? yi.join('、') : '按既定计划推进'}；忌：${ji.length ? ji.join('、') : '无特别禁忌'}。冲${almanac.chong}煞${almanac.sha}，喜神${almanac.xi}、财神${almanac.cai}、福神${almanac.fu}。`,
    notes.length ? `要点：${notes.slice(0, 4).join('；')}。` : '',
    timeOfDayTip(dayGanZhi),
  ].filter(Boolean).join('\n');

  const aspects = error ? [] : buildAspects({ almanac, relations, favorable, bazi, dayGan, dayZhi });
  const tenGod = tenGodOf(dayGan, bazi?.pillars?.day?.gan || bazi?.day_master?.gan || '');
  const dayMaster = {
    gan: bazi?.pillars?.day?.gan || bazi?.day_master?.gan || '',
    wuxing: bazi?.day_master?.wuxing || '',
    level: bazi?.day_master?.strength?.level || '',
  };
  const explain = error ? '' : buildExplain({
    dateKey, dayGanZhi, almanac, relations, aspects, tenGod, dayMaster, favorable, score, level,
  });

  return {
    version: 2,
    date: dateKey,
    ganzhi: dayGanZhi,
    gan: dayGan,
    zhi: dayZhi,
    lunar: `${lunar.getYearInChinese?.() || ''}年${lunar.getMonthInChinese?.() || ''}月${lunar.getDayInChinese?.() || ''}`,
    lunarDay: lunar.getDayInChinese?.() || '',
    almanac,
    relations,
    favorable,
    aspects,
    tenGod,
    dayMaster,
    explain,
    score,
    level,
    summary,
    baziError: error,
    generatedAt: new Date().toISOString(),
  };
}
