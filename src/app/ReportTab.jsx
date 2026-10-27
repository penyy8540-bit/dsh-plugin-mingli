import React from 'react';
import { copyText } from '../store.js';

/**
 * 报告页：把八字 / 紫微盘面整理成结构化中文报告草稿，
 * 并可一键复制带盘面摘要的分析提示词给 DeepSeek 继续推演。
 *
 * props: { profile, bazi, ziwei }
 */

const CURRENT_YEAR = 2026;

const PILLAR_KEYS = ['year', 'month', 'day', 'time'];
const PILLAR_NAMES = { year: '年柱', month: '月柱', day: '日柱', time: '时柱' };
const WUXING_KEYS = ['木', '火', '土', '金', '水'];

function show(value, fallback = '—') {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
}

function list(values, fallback = '无') {
  const items = (Array.isArray(values) ? values : []).filter(Boolean);
  return items.length ? items.join('、') : fallback;
}

function pct(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return `${Math.round(number * 10) / 10}%`;
}

function solarText(solar) {
  return String(solar || '').replace('T', ' ').slice(0, 16) || '—';
}

function moonText(profile, bazi, ziwei) {
  return show(bazi?.lunar || ziwei?.lunar, '—');
}

/** One relation item -> readable Chinese, e.g. "年日：戌卯六合" / "年月：丙辛干合化水". */
function relationItemText(item, label) {
  if (item === null || item === undefined) return '';
  if (typeof item === 'string') return item;
  if (typeof item !== 'object') return String(item);
  const pillars = Array.isArray(item.pillars)
    ? item.pillars.map((key) => (PILLAR_NAMES[key] || key).replace('柱', '')).join('/')
    : '';
  const chars = Array.isArray(item.zhi)
    ? item.zhi.join('')
    : Array.isArray(item.gan)
      ? item.gan.join('')
      : '';
  const hua = item.hua ? `化${item.hua}` : '';
  // Long engine notes (e.g. 干合 的流派说明) are replaced by a compact form.
  const note = typeof item.note === 'string' ? item.note.replace(/（[^）]*）/g, '').trim() : '';
  const compact = `${chars}${label}${hua}`;
  const core = label === '干合' && chars
    ? compact
    : note && note.length <= 12
      ? note
      : chars
        ? compact
        : note || label;
  return pillars ? `${pillars}：${core}` : core || label;
}

function relationsText(relations) {
  if (!relations || typeof relations !== 'object') return '无';
  const labels = {
    chong: '冲', he: '合', xing: '刑', hai: '害', po: '破', fuyin: '伏吟',
    gan_he: '干合', gan_chong: '干冲', sanhe: '三合', sanhui: '三会', banhe: '半合',
  };
  const parts = [];
  Object.keys(labels).forEach((key) => {
    const items = Array.isArray(relations[key]) ? relations[key].filter(Boolean) : [];
    if (!items.length) return;
    const text = items.map((item) => relationItemText(item, labels[key])).filter(Boolean).join('、');
    if (text) parts.push(`${labels[key]}：${text}`);
  });
  return parts.length ? parts.join('；') : '无';
}

function mutagenText(mutagen) {
  if (!mutagen || typeof mutagen !== 'object') return '—';
  return ['禄', '权', '科', '忌']
    .map((key) => {
      const value = mutagen[key];
      if (!value) return null;
      if (Array.isArray(value)) {
        return value
          .map((item) => `${item.star || item.name || '—'}化${key}${item.palace ? `（${item.palace}）` : ''}`)
          .join('、');
      }
      return `${value}化${key}`;
    })
    .filter(Boolean)
    .join('；') || '—';
}

export default function ReportTab({ profile, bazi, ziwei }) {
  const [copied, setCopied] = React.useState('');
  const timerRef = React.useRef(null);

  React.useEffect(() => () => {
    if (timerRef.current) globalThis.clearTimeout(timerRef.current);
  }, []);

  const data = React.useMemo(() => {
    const p = profile || {};
    const b = bazi || null;
    const z = ziwei || null;
    const pillars = b?.pillars || {};
    const dm = b?.day_master || null;
    const strength = dm?.strength || null;
    const wuxing = b?.wuxing || null;
    const qiyun = b?.dayun?.qiyun || null;
    const dayunList = Array.isArray(b?.dayun?.list) ? b.dayun.list : [];
    const currentDayun =
      dayunList.find((item) => CURRENT_YEAR >= Number(item.start_year) && CURRENT_YEAR <= Number(item.end_year)) ||
      dayunList.find((item) => item.index === 1) ||
      null;
    const liunian = (Array.isArray(b?.liunian) ? b.liunian : []).find((item) => Number(item.year) === CURRENT_YEAR) || null;
    const palaces = Array.isArray(z?.palaces) ? z.palaces : [];
    const soulPalace = palaces.find((palace) => palace.name === z?.soul_palace_name) || null;
    const bodyPalace = palaces.find((palace) => palace.name === z?.body_palace_name) || null;
    const soulStars = (soulPalace?.major_stars || []).map((star) => `${star.name}${star.brightness ? `（${star.brightness}）` : ''}`);
    const bodyStars = (bodyPalace?.major_stars || []).map((star) => `${star.name}${star.brightness ? `（${star.brightness}）` : ''}`);
    const zLiunian = z?.liunian || null;
    return { p, b, z, pillars, dm, strength, wuxing, qiyun, dayunList, currentDayun, liunian, palaces, soulPalace, bodyPalace, soulStars, bodyStars, zLiunian };
  }, [profile, bazi, ziwei]);

  const reportText = React.useMemo(() => {
    const { p, b, z, pillars, dm, strength, wuxing, qiyun, currentDayun, liunian, soulPalace, bodyPalace, soulStars, zLiunian } = data;
    const lines = [];
    lines.push('【命理推演报告草稿】');
    lines.push(`命主：${show(p.name, '未命名')}（${p.gender === 'female' ? '女' : '男'}）`);
    lines.push(`公历：${solarText(p.solar)}${p.birthplace ? ` · ${p.birthplace}` : ''}${p.longitude !== null && p.longitude !== undefined ? ` · 东经 ${p.longitude}°` : ''}`);
    lines.push(`农历：${moonText(p, b, z)}${b?.zodiac ? ` · 生肖${b.zodiac}` : ''}`);
    if (b?.solar_true && p.use_true_solar) lines.push(`真太阳时：${solarText(b.solar_true)}`);
    lines.push(`四柱：${PILLAR_KEYS.map((key) => pillars[key]?.ganzhi || '—').join(' ')}`);
    if (dm) lines.push(`日主：${dm.gan}` + (dm.wuxing ? `${dm.wuxing}` : '') + (dm.yinyang ? `（${dm.yinyang}）` : '') + (strength ? ` · ${strength.level} ${strength.score}/100（得令${strength.de_ling} 得地${strength.de_di} 得势${strength.de_shi}）` : ''));
    if (wuxing?.percent) {
      lines.push(`五行分布：${WUXING_KEYS.map((key) => `${key}${pct(wuxing.percent[key])}`).join(' / ')}；缺失：${list(wuxing.missing)}`);
    }
    if (b?.jieqi) lines.push(`节气：${show(b.jieqi.current_term)}（${show(b.jieqi.month)}）`);
    if (qiyun) lines.push(`起运：${qiyun.years || 0}年${qiyun.months || 0}月后起运（${show(qiyun.solar)}），${qiyun.forward ? '顺排' : '逆排'}`);
    if (currentDayun) lines.push(`当前大运：${currentDayun.ganzhi}（${currentDayun.start_year}-${currentDayun.end_year}，虚岁${currentDayun.start_age}-${currentDayun.end_age}）`);
    if (liunian) lines.push(`${CURRENT_YEAR}流年：${liunian.ganzhi} · 虚岁${show(liunian.age)} · 流年干十神${show(liunian.shishen_gan)} · 所属大运${show(liunian.dayun_ganzhi)}`);
    if (b?.shensha?.length) lines.push(`神煞：${b.shensha.map((item) => `${item.name}${item.pillars?.length ? `（${item.pillars.join('/')}）` : ''}`).join('、')}`);
    if (b?.relations) lines.push(`干支关系：${relationsText(b.relations)}`);
    if (z) {
      lines.push(`紫微：${show(z.five_elements_class)} · 命主${show(z.soul)} · 身主${show(z.body)}`);
      if (soulPalace) lines.push(`命宫：${soulPalace.earthly_branch}${soulPalace.heavenly_stem}，主星${list(soulStars, '无主星')}`);
      if (bodyPalace) lines.push(`身宫：${show(z.body_palace_name)}（${show(bodyPalace.earthly_branch)}）`);
      lines.push(`本命四化：${mutagenText(z.mutagen_summary)}`);
      if (zLiunian) {
        lines.push(`${CURRENT_YEAR}流年：${show(zLiunian.ganzhi)} · 流年命宫${show(zLiunian.palace)} · 流年四化 ${mutagenText(zLiunian.mutagen)}`);
      }
    }
    if (b?.hints?.length) {
      lines.push('引擎提示：');
      b.hints.slice(0, 8).forEach((hint) => lines.push(`· ${hint}`));
    }
    return lines.join('\n');
  }, [data]);

  const promptText = React.useMemo(() => {
    const p = data.p || {};
    const intro = [
      '你是精通紫微斗数、子平八字、时家奇门的命理研究者。请基于下面这份已经排好的盘面做交叉推演，',
      '不要重新排盘、不要改动干支；结论要分流派说明依据，并给出置信度（高/中/低）。',
      '',
      '【命主】',
      `姓名：${show(p.name, '未命名')}；性别：${p.gender === 'female' ? '女' : '男'}；`,
      `公历：${solarText(p.solar)}；出生地：${show(p.birthplace, '未填')}${p.longitude !== null && p.longitude !== undefined ? `；经度：${p.longitude}°` : ''}；真太阳时校正：${p.use_true_solar ? '开启' : '关闭'}`,
      '',
      '【盘面摘要】',
      reportText,
      '',
      '【请输出】',
      '1. 格局判断与用神取舍（八字）',
      '2. 性格底色、优势与易踩的坑',
      '3. 事业方向与财富结构',
      '4. 感情婚姻倾向',
      '5. 健康注意事项',
      `6. ${CURRENT_YEAR}—${CURRENT_YEAR + 2} 年流年节奏与建议`,
      '7. 多流派交叉验证：一致点、分歧点、置信度',
      '8. 可执行的三条具体建议（避免宿命论表述）',
      '',
      '说明：仅作传统文化研究与自我认识参考，不构成医疗、投资、法律决策建议。',
    ];
    return intro.join('\n');
  }, [data, reportText]);

  const flash = (kind, message) => {
    setCopied(`${kind}:${message}`);
    if (timerRef.current) globalThis.clearTimeout(timerRef.current);
    timerRef.current = globalThis.setTimeout(() => setCopied(''), 2000);
  };

  const doCopy = (text, kind, okMessage) => {
    try {
      const result = copyText(text);
      if (result && typeof result.then === 'function') {
        result.then(() => flash(kind, okMessage)).catch(() => flash(kind, '复制失败，请手动选中文本复制'));
      } else {
        flash(kind, okMessage);
      }
    } catch {
      flash(kind, '复制失败，请手动选中文本复制');
    }
  };

  const copiedLabel = (kind, label) => (copied.startsWith(`${kind}:`) ? copied.split(':')[1] : label);

  const { p, pillars, dm, strength, wuxing, qiyun, currentDayun, liunian, z, soulPalace, bodyPalace, soulStars, bodyStars, zLiunian, palaces } = data;

  if (!bazi && !ziwei) {
    return (
      <div className="ml-report">
        <div className="ml-error">
          <div className="ml-error-title">排盘失败：暂无可用的盘面数据</div>
          <div className="ml-error-msg">排盘引擎没有返回八字 / 紫微数据，请检查出生信息后重新保存命主。</div>
          <div className="ml-error-hint">若问题持续出现，可在「命盘」页查看具体错误信息。</div>
        </div>
      </div>
    );
  }

  const soulStarsText = soulStars.length ? soulStars.join('、') : '无主星';
  const bodyStarsText = bodyStars.length ? bodyStars.join('、') : '无主星';

  return (
    <div className="ml-report">
      <div className="ml-report-head">
        <div>
          <div className="ml-report-title">推演报告</div>
          <div className="ml-report-sub">
            基于本地排盘结果生成的结构化草稿：四柱、旺衰、五行、大运流年与紫微宫位先归纳成事实，再交给 DeepSeek 做多流派交叉分析。
          </div>
        </div>
        <div className="ml-report-actions">
          <button
            type="button"
            className="ml-btn ml-btn--gold"
            onClick={() => doCopy(promptText, 'prompt', '提示词已复制')}
          >
            {copiedLabel('prompt', '复制给 DeepSeek 分析')}
          </button>
          <button
            type="button"
            className="ml-btn"
            onClick={() => doCopy(reportText, 'report', '报告已复制')}
          >
            {copiedLabel('report', '复制报告全文')}
          </button>
        </div>
      </div>

      <section className="ml-card ml-report-section">
        <div className="ml-report-h">
          命主与盘面 <small>PROFILE</small>
        </div>
        <dl className="ml-kv">
          <dt>姓名</dt>
          <dd>{show(p.name, '未命名命主')} · {p.gender === 'female' ? '女（坤造）' : '男（乾造）'}</dd>
          <dt>公历</dt>
          <dd>{solarText(p.solar)}{bazi?.solar_true ? `（真太阳时 ${solarText(bazi.solar_true)}）` : ''}</dd>
          <dt>农历</dt>
          <dd>{moonText(p, bazi, ziwei)}{bazi?.zodiac ? ` · 生肖${bazi.zodiac}` : ''}</dd>
          <dt>出生地</dt>
          <dd>{show(p.birthplace, '未填')}{p.longitude !== null && p.longitude !== undefined ? ` · 东经 ${p.longitude}°` : ' · 经度未填'}</dd>
          <dt>节气</dt>
          <dd>{bazi?.jieqi ? `${show(bazi.jieqi.current_term)}（${show(bazi.jieqi.month)}）` : '—'}{ziwei?.time ? ` · ${ziwei.time}` : ''}</dd>
          <dt>说明</dt>
          <dd>真太阳时校正：{p.use_true_solar ? '已开启' : '未开启'}；排盘全部在本机浏览器完成，不上传任何数据。</dd>
        </dl>
      </section>

      <section className="ml-card ml-report-section">
        <div className="ml-report-h">
          四柱与十神 <small>FOUR PILLARS</small>
        </div>
        <table className="ml-table">
          <thead>
            <tr>
              <th>四柱</th>
              <th>干支</th>
              <th>天干十神</th>
              <th>藏干（十神）</th>
              <th>纳音</th>
              <th>地势</th>
              <th>空亡</th>
            </tr>
          </thead>
          <tbody>
            {PILLAR_KEYS.map((key) => {
              const pillar = pillars[key] || {};
              const hide = (pillar.hide_gan || []).map((gan, index) => {
                const shishen = pillar.shishen_zhi?.[index];
                return shishen ? `${gan}${shishen}` : gan;
              });
              return (
                <tr key={key}>
                  <td>{PILLAR_NAMES[key]}{key === 'day' ? '（日主）' : ''}</td>
                  <td><b>{show(pillar.ganzhi)}</b></td>
                  <td>{show(pillar.shishen_gan)}</td>
                  <td>{list(hide)}</td>
                  <td>{show(pillar.nayin)}</td>
                  <td>{show(pillar.dishi)}</td>
                  <td>{show(pillar.xunkong)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="ml-card ml-report-section">
        <div className="ml-report-h">
          日主旺衰与五行 <small>DAY MASTER</small>
        </div>
        <dl className="ml-kv">
          <dt>日主</dt>
          <dd>{dm ? `${dm.gan}${dm.wuxing || ''}${dm.yinyang ? `（${dm.yinyang}）` : ''}` : '—'}</dd>
          <dt>旺衰</dt>
          <dd>{strength ? `${strength.level} · ${strength.score}/100（得令 ${strength.de_ling} / 得地 ${strength.de_di} / 得势 ${strength.de_shi}）` : '—'}</dd>
          <dt>五行</dt>
          <dd>{wuxing?.percent ? WUXING_KEYS.map((key) => `${key}${pct(wuxing.percent[key])}`).join(' / ') : '—'}</dd>
          <dt>缺失</dt>
          <dd>{wuxing?.missing ? list(wuxing.missing) : '—'}</dd>
          <dt>干支关系</dt>
          <dd>{relationsText(bazi?.relations)}</dd>
          <dt>神煞</dt>
          <dd>{bazi?.shensha?.length ? bazi.shensha.map((item) => `${item.name}${item.pillars?.length ? `（${item.pillars.map((k) => PILLAR_NAMES[k] || k).join('/')}）` : ''}`).join('、') : '—'}</dd>
        </dl>
      </section>

      <section className="ml-card ml-report-section">
        <div className="ml-report-h">
          大运与流年 <small>LUCK CYCLES</small>
        </div>
        <dl className="ml-kv">
          <dt>起运</dt>
          <dd>{qiyun ? `${qiyun.years || 0} 年 ${qiyun.months || 0} 月后起运（${show(qiyun.solar)}）· ${qiyun.forward ? '顺排' : '逆排'}` : '—'}</dd>
          <dt>当前大运</dt>
          <dd>{currentDayun ? `${currentDayun.ganzhi} · ${currentDayun.start_year}–${currentDayun.end_year} · 虚岁 ${currentDayun.start_age}–${currentDayun.end_age}${currentDayun.shishen_gan ? ` · 大运干十神${currentDayun.shishen_gan}` : ''}` : '—'}</dd>
          <dt>{CURRENT_YEAR} 流年</dt>
          <dd>{liunian ? `${liunian.ganzhi} · 虚岁 ${show(liunian.age)} · 流年干十神 ${show(liunian.shishen_gan)} · 所属大运 ${show(liunian.dayun_ganzhi)}${liunian.relations_to_year ? ` · 与年支 ${liunian.relations_to_year}` : ''}` : '—'}</dd>
          <dt>紫微大限</dt>
          <dd>{zLiunian?.decadal ? `${zLiunian.decadal.range?.join('–')} 虚岁 · ${show(zLiunian.decadal.palace)}宫（${show(zLiunian.decadal.ganzhi)}）` : '—'}</dd>
        </dl>
      </section>

      {z ? (
        <section className="ml-card ml-report-section">
          <div className="ml-report-h">
            紫微斗数要点 <small>ZIWEI</small>
          </div>
          <dl className="ml-kv">
            <dt>五行局</dt>
            <dd>{show(z.five_elements_class)} · 命主 {show(z.soul)} · 身主 {show(z.body)}</dd>
            <dt>命宫</dt>
            <dd>{soulPalace ? `${show(soulPalace.heavenly_stem)}${show(soulPalace.earthly_branch)} · 主星 ${soulStarsText}` : '—'}</dd>
            <dt>身宫</dt>
            <dd>{bodyPalace ? `${show(z.body_palace_name)}宫（${show(bodyPalace.earthly_branch)}）· 主星 ${bodyStarsText}` : '—'}</dd>
            <dt>本命四化</dt>
            <dd>{mutagenText(z.mutagen_summary)}</dd>
            <dt>宫位</dt>
            <dd>共 {palaces.length || 12} 宫；当前大限与流年宫位见「紫微」页交互详情。</dd>
            <dt>{CURRENT_YEAR} 流年</dt>
            <dd>{zLiunian ? `${show(zLiunian.ganzhi)} · 流年命宫 ${show(zLiunian.palace)} · 流年四化 ${mutagenText(zLiunian.mutagen)}` : '—'}</dd>
          </dl>
        </section>
      ) : null}

      <section className="ml-card ml-report-section">
        <div className="ml-report-h">
          分析提示词 <small>PROMPT</small>
        </div>
        <p className="ml-note" style={{ marginTop: 0 }}>
          点击「复制给 DeepSeek 分析」后，把提示词粘贴到对话里即可获得多流派交叉推演；提示词已带精简盘面摘要，不会上传原始档案。
        </p>
        <pre className="ml-pre">{promptText}</pre>
      </section>

      <div className="ml-report-foot">
        以上为传统命理结构化推演，仅供文化研究与自我认识参考，不构成医疗、法律、投资建议；重大决定请结合现实信息与专业意见。
      </div>
    </div>
  );
}
