# dsh-plugin-mingli · 命理推演（Tianfu 风格 UI）

DeepSeek Harness 桌面端插件。把 `mingli` 技能的三套排盘引擎（紫微斗数 / 子平八字 / 时家奇门）搬进 Web GUI，
并做成对标 tianfu-ai.com 的完整界面：命主档案、命盘图、大运流年、奇门九宫、人生轨迹、AI 推演报告。

- **纯前端计算**：`iztro` + `lunar-javascript` + `kinqimen` 在浏览器里排盘，不联网、不上传、不需要 Host RPC。
- **Shadow DOM 隔离**：样式只用 `--dsw-alias-*` 主题 token，明暗主题自动跟随 DSH。
- **单文件本地安装**：`link:` 到本目录，改代码后重新 `npm run build` 即可（client 产物走 HMR）。

## 使用

1. 打开 DSH 桌面端（更新插件后先 Ctrl+R 刷新一次）。入口：
   - **会话视图页签「命理」**（推荐）：每个会话面板的「对话 / 轨迹」旁，点开是**三栏工作台**——左侧命主/收藏/历史提问，中间对话与提问输入，右侧八字/紫微/奇门/命途/报告盘面（Tianfu 风格）
   - 会话标题栏右侧的「命」按钮 / 输入框旁的「命理」chip：打开右栏「命理」工作台（每日反馈卡）
   - 右下角金色「命盘」胶囊：完整命盘浮窗
2. 左栏「新建命主」填姓名/性别/公历生日/出生时间/出生地/经度。
3. 数据存浏览器 `localStorage`（`mingli.*`），纯本地排盘，不联网。
   - **命盘**：四柱（十神/藏干/纳音/旬空）、日主旺衰、五行条形+雷达、神煞、刑冲合害
   - **紫微**：4×4 十二宫命盘，主星亮度 + 四化徽标，点宫看详情（大限、长生、博士…）
   - **大运流年**：大运色带 + 11 年流年刻度，当前年高亮
   - **奇门**：按当前时间起局 + 问事关键词 → 九宫（天地盘干/九星/八门/八神/值符值使/用神）
   - **人生轨迹**：录入过往事件 → 多泳道时间线（大运色带 + 假设分支）→ 命途回溯
   - **报告**：结构化报告草稿 + 「复制给 DeepSeek 分析」提示词
4. 数据存在浏览器 `localStorage`（`mingli.*`），清掉即重置。

## 开发

```powershell
cd "C:\Users\Administrator\Desktop\deepseek 插件开发\plugins\dsh-plugin-mingli"
npm install          # 首次
npm run build        # → lib/client.js（生产 bundle）+ lib/index.js + preview/
npm run parity       # JS 引擎 vs Python 引擎（mingli 技能）逐字段对照
npm run verify       # puppeteer 驱动生产 bundle：6 个 tab 截图 + 交互 + console 错误
npm run shot -- --page harness.html --out out/harness.png   # ModuleLoader harness 截图
```

## 验证状态（2026-10-26）

| 验证 | 结果 |
|---|---|
| `npm run build` | exit 0，client bundle 1.28 MB，无远程加载调用 |
| `npm run parity` | **105 项检查 0 差异**（八字/紫微/奇门 vs Python 已验证实现） |
| `npm run verify` | **PASS**：6 个 tab 全部渲染、紫微点宫切换详情、关闭回入口、0 console 错误 |
| ModuleLoader harness | 生产 `lib/client.js` 经 loader 模拟装载后正常注册 `shell.overlay` 并渲染 |
| 真实 GUI | 已安装进 `desktop` profile（`dsh plugin --profile desktop add <path>`），bundle 由 HMR 重组加载 |

验收截图在 `out/verify/`：命盘 / 紫微 / 大运流年 / 奇门 / 人生轨迹 / 报告 / 紫微-点宫详情。

### 目录

```
src/
  client-entry.jsx   ModuleLoader 包装 + shell.overlay 槽注册
  app/               UI 外壳：Launcher / App / BirthForm / ProfileList / ReportTab
  engines/           bazi.js / ziwei.js / qimen.js（浏览器端排盘）
  render/            ChartBazi / ChartZiwei / ChartQimen / ChartDayun
  timeline/          人生轨迹 model + SVG + Tab
  store.js           localStorage 档案/轨迹
  ui/theme.css       主题 token 与基础控件
tools/               build / parity / shot
preview/             离线预览壳 + ModuleLoader harness
docs/                插件契约与 fixtures
```

### 安装到 profile

```powershell
& "C:\Users\Administrator\AppData\Local\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd" `
  plugin --profile desktop add "<本目录绝对路径>"
```

新增 bundle 由 HMR 实时重组，无需重启；覆盖已装 Host 代码时才需要完全退出 DSH 重开。

## 设计边界

- 只做传统文化研究与结构化推演，不做医疗/法律/投资决策，不承诺改运。
- 盘面全部来自本地引擎；报告草稿只复述盘面事实，判断交给对话里的 DeepSeek。
- 不引入第三方图表库；SVG 全部手写，保证离线与主题一致性。

## 已知限制

- 公历输入（农历转换在 v0.2 计划内）；奇门只实现拆补法·转盘。
- 晚子时（23:00 后）默认不换日；紫微年界按正月初一，八字按立春。
- 报告 tab 是草稿生成 + 复制提示词，不直接调用模型（避免与当前会话上下文互相干扰）。
