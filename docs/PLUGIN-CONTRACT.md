# dsh-plugin-mingli · 插件模块契约 v0.1

> 目标：一个 **带完整 UI 的 DSH 客户端插件**，形态对标 tianfu-ai.com：左侧命主档案、主区命盘（四柱/紫微/五行/大运流年/奇门）、人生轨迹、AI 分析报告。
> 计算全部在**浏览器端**完成（iztro / lunar-javascript / kinqimen），不需要 Host RPC、不联网。

## 0. 运行形态

- 客户端插件：`window.__ModuleLoader__.load({id:'dsh-plugin-mingli', factory(require){...}})`，`factory` 返回 `{inject, apply(ctx)}`。
- 只注册一个槽：`shell.overlay`（order 60）。组件自己用 Shadow DOM 隔离样式。
- `require` 可用：`react`、`react-dom`、`react-dom/client`、`react/jsx-runtime`（平台共享模块）。
- Host 入口 `lib/index.js` 目前为空插件（保留后续挂工具的位置）。
- 所有数据存 `localStorage`，键前缀 `mingli.`。禁止联网。

## 1. 目录与归属（**只改自己名下文件**）

```
plugins/dsh-plugin-mingli/
  src/
    client-entry.jsx      Lead：ModuleLoader 包装 + slot 注册
    store.js              Lead：localStorage 档案/轨迹读写
    ui/theme.css          Lead：设计 token + 全局样式（Shadow DOM 内）
    app/
      App.jsx             A：主面板（左栏 + 顶部 + tab 路由 + 新建表单）
      Launcher.jsx        A：右下角浮动入口按钮
      BirthForm.jsx       A：出生信息表单（含校验、真太阳时）
      ProfileList.jsx     A：命主档案列表
      ReportTab.jsx       A：报告页（结构化文本 + 复制分析提示词）
    engines/
      index.js            C：buildAll()/buildQimen() 统一出口
      bazi.js             C
      ziwei.js            C
      qimen.js            C
    render/
      ChartBazi.jsx       B：四柱盘 + 五行（条形/雷达）+ 神煞关系
      ChartZiwei.jsx      B：紫微 4×4 十二宫（交互：点宫看详情）
      ChartQimen.jsx      B：奇门 3×3 九宫
      ChartDayun.jsx      B：大运/流年时间轴
      chart.css           B：图表局部样式（注入 Shadow DOM）
    timeline/
      model.js            D：轨迹数据模型（事件/分支 CRUD、持久化接口）
      TimelineSvg.jsx     D：多泳道 SVG 时间线
      TimelineTab.jsx     D：轨迹页（录入/分支切换/时间线）
  src/host/index.js       Lead：Host 入口骨架
  tools/build.mjs         Lead：esbuild 构建（client / host / preview）
  tools/parity.mjs        Lead+C：与 Python 引擎的对照自测
  tools/shot.mjs          Lead：无头 Chrome 截图
  preview/index.html      Lead：离线预览壳（截图/自测用）
```

## 2. 数据模型（**全插件统一 snake_case，与 mingli/docs/CONTRACT.md 对齐**）

### 2.1 命主 Profile

```js
{
  id: 'p_ab12cd',
  name: '张三',
  gender: 'male' | 'female',
  solar: '1990-05-15T10:30',      // 本地时间，无时区
  birthplace: '北京',
  longitude: 116.4 | null,
  use_true_solar: true,
  created_at: '2026-10-26T17:40:00',
  updated_at: '...'
}
```

### 2.2 `engines.bazi(profile) -> data`

必须对齐 `mingli/docs/CONTRACT.md` §6（字段可裁剪到 UI 所需，但键名必须是 snake_case）：

```js
{
  solar, lunar, zodiac, jieqi: {month, current_term},
  pillars: { year|month|day|time: {
      ganzhi, gan, zhi, hide_gan: string[], shishen_gan, shishen_zhi: string[],
      nayin, xunkong, dishi } },
  day_master: { gan, wuxing, yinyang, strength: {score, level, de_ling, de_di, de_shi} },
  wuxing: { count: {木,火,土,金,水}, percent: {...}, score: {...}, missing: [] },
  relations: { chong: [], he: [], xing: [], hai: [], po: [], fuyin: [] },
  shensha: [{ name, zhis }],
  dayun: { qiyun: {years, months, days, solar, forward}, list: [
      { index, ganzhi, start_year, end_year, start_age, end_age } ] },
  liunian: [ { year, ganzhi, age, shishen_gan, relations_to_year } ],
  hints: string[]
}
```

### 2.3 `engines.ziwei(profile) -> data`

对齐 CONTRACT §7：

```js
{
  solar, lunar, chinese_date, time, time_range, gender,
  five_elements_class, soul, body,
  soul_palace_branch, body_palace_branch, soul_palace_name, body_palace_name,
  palaces: [ { index, name,           // 12 宫名：命宫 兄弟 夫妻 子女 财帛 疾厄 迁移 交友 官禄 田宅 福德 父母
      heavenly_stem, earthly_branch, direction,
      is_body_palace, is_soul_palace,
      major_stars: [{ name, brightness, mutagen }],
      minor_stars: [{ name, brightness, mutagen }],
      adjective_stars: string[],
      changsheng12, decadal: { range:[a,b], ganzhi }, ages: number[] } ],
  mutagen_summary: { 禄:[{star,palace}], 权:[], 科:[], 忌:[] },
  daxian: [ { range:[a,b], palace, ganzhi } ],
  liunian: { year, age, ganzhi, palace, mutagen: {禄,权,科,忌}, palace_stars: [] },
  hints: string[]
}
```

### 2.4 `engines.qimen({ solar, ask }) -> data`

对齐 CONTRACT §8（字段名 snake_case；palace 用「坎一宫」等中文名）：

```js
{
  solar, ganzhi, ask,
  jieqi: { current, yuan, yang_dun, ju, xunshou, futou },
  zhifu: { star, palace, gong },
  zhishi: { gate, palace, gong },
  palaces: [ { gong, number, direction, trigram,
      dipan_gan, tianpan_gan, tianpan_gan_extra: [],
      star, star_extra: [], gate, shen,
      star_wuxing, gate_wuxing, shen_wuxing,
      is_zhifu_star, is_zhishi_gate, is_zhifu_shen, kong_wang } ],
  kong_wang: string[], yongshen: [{target, gong, direction, why}], hints: []
}
```

## 3. Store 接口（Lead 提供，A/D 只用这些）

```js
// src/store.js
export function loadState()                       // { profiles: Profile[], activeId }
export function saveState(state)
export function upsertProfile(profile) -> Profile  // 生成 id、写入并设为 active
export function removeProfile(id)
export function getProfile(id)
export function getTimeline(profileId)             // { branches: [...] } 见 §4
export function saveTimeline(profileId, timeline)
export function uid(prefix)                        // 'p_x9f2a1'
```

## 4. 人生轨迹数据（D 实现，结构与 mingli/tools/timeline.py 对齐）

```js
{
  version: 1, profile_id,
  branches: [
    { id: 'actual', name: '实际人生', kind: 'actual', parent: null, color: '#b8860b',
      assumptions: [], nodes: [ { id, year, month, age, kind, title, desc, tags: [], source, confidence, important } ] },
    { id: 'b_1', name: '如果当年读研', kind: 'branch', parent: 'actual', fork_year: 2015,
      color: '#1565c0', assumptions: ['2015 选择读研'], nodes: [...] }
  ]
}
```
- `kind ∈ event|milestone|decision|turning`；`source ∈ user|model`；`confidence ∈ high|medium|low`。
- `age = year - 出生年`。

## 5. 视觉规范

- Shadow DOM 内渲染；`--dsw-alias-*` token 优先，回退值自带 light/dark。
- 主色：纸 `#fbfaf7`、墨 `#1a1a1a`、金 `#b8860b`、线 `#e3e0d8`；深色模式用 `prefers-color-scheme` + token。
- 字体：标题 `"Noto Serif SC","Songti SC","SimSun",serif`；正文 `"Noto Sans SC","Microsoft YaHei",sans-serif`。
- 布局：面板最大 1240×820，左栏 232px，主区余下；≤900px 单列。
- 密度参照 tianfu：信息卡 + 细分隔线 + 金色小标题 + 宫格；禁止大色块。

## 6. 组件 props 契约

所有图表组件接收**纯数据**、不读 localStorage：

```js
<ChartBazi data={baziData} />
<ChartZiwei data={ziweiData} />
<ChartQimen data={qimenData} />
<ChartDayun data={baziData} currentYear={2026} />
<TimelineSvg timeline={timeline} profile={profile} width={880} />
```

`App.jsx` 负责：读取 store → 计算 engines → 分发数据 / tab 状态 / 新建表单。

## 7. 构建与验证

```powershell
cd plugins/dsh-plugin-mingli
npm run build          # lib/client.js + lib/index.js + preview/index.html
node tools/parity.mjs  # JS 引擎 vs Python 引擎（mingli 技能）逐字段对照
node tools/shot.mjs    # 无头 Chrome 截 preview/index.html → out/shot.png
```
- `npm run build` 必须零错误；client bundle 里**不得**出现 `http://` / `https://` 字面量（`http://www.w3.org/2000/svg` 除外）。
- preview 用于截图验收；真实 GUI 由 Lead 安装插件后用 puppeteer 点击入口验证。

## 8. 禁止事项

- 不改 profile 的 `package.json` / `cordis.patch.yml`（安装走 `plugin_manager.install_bundle`）。
- 不 import 除 `react*` 之外的平台模块（primitives 尽量不用，自己写控件更稳）。
- 不联网、不写 `document.body`、不替换 root、不改其他插件的 DOM/CSS。
- 不把 `<iframe>` 当主渲染方式（拿不到主题 token）。
