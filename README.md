# DSH 命理插件（dsh-plugin-mingli）

DeepSeek Harness 的命理推演插件：**紫微斗数 / 子平八字 / 时家奇门** 排盘，博采多流派校正，输出带依据与置信度的结构化命盘；附 **每日黄历 + 六维运势**、**人生轨迹** 与 **推演报告**。

- 纯前端本地排盘，**不联网、不上传**任何数据（`localStorage` 存储）
- 无外部 CDN 依赖，client bundle 自带引擎（lunar-javascript / iztro / kinqimen）
- 只做传统文化研究与自我参照，不做医疗 / 法律 / 投资决策

## 功能

| 模块 | 说明 |
|---|---|
| 八字 | 四柱、十神、藏干、纳音、旬空、地势、日主旺衰（得令/得地/得势）、五行占比、旺衰说明 |
| 紫微斗数 | 十二宫、主星/辅煞、四化、格局、限运、点宫详情（iztro 精确历法） |
| 奇门遁甲 | 时家奇门转盘 + 拆补，九宫、八门九星八神、值符值使、旬首 |
| 每日黄历 | 干支、农历、值神黑黄道、建除、宜忌、冲煞、喜财福方位、彭祖百忌、吉神凶煞 |
| 六维运势 | 事业 / 财运 / 桃花 / 健康 / 出行 / 人际：黄历宜忌 × 本命冲合刑害 × 十神 × 喜用五行 × 神煞 双标准打分，附依据与建议 |
| 每日存档 | 每天自动存一份黄历快照，可翻看历史日期（‹ › 或日期条），按日重算补录 |
| 人生轨迹 | 多泳道时间轴：大运背景带、事实/里程碑/抉择/转折节点、分支 |
| 推演报告 | 结构化报告（命主与盘面、四柱十神、旺衰五行、紫微四化、流年大运、行动建议），可复制全文 |

## 安装

### 方式 A：下载即用（推荐）

1. 到 [Releases](https://github.com/penyy8540-bit/dsh-plugin-mingli/releases) 下载 `dsh-plugin-mingli-v0.1.0.zip` 并解压
2. 安装到 DSH profile（路径换成你解压后的目录）：

```bash
dsh plugin --profile desktop add "<解压路径>/dsh-plugin-mingli"
```

3. 重启 / 刷新 DSH（Ctrl+R）

### 方式 B：从源码构建

```bash
git clone https://github.com/penyy8540-bit/dsh-plugin-mingli.git
cd dsh-plugin-mingli
npm install          # 仅构建期需要
npm run build        # 生成 lib/client.js（含引擎）与 lib/index.js
dsh plugin --profile desktop add "$PWD"
```

## 使用

刷新后有三个入口：

1. **会话视图页签「命理」**（主入口）：任一会话顶部 `对话 | 轨迹 | 命理`，点「命理」打开三栏工作台
   - 左：命主档案（新建/切换）
   - 中：每日黄历 + 六维运势 + 每日存档日期条
   - 右：黄历 / 八字 / 紫微 / 奇门 / 命途 / 报告 六个页签
2. **右下角「命盘」胶囊 / 输入框「命」chip / 标题栏「命」按钮**：优先跳到「命理」页签；找不到时打开三栏浮层
3. **右侧栏「命理」tab**：窄版每日反馈卡（适合常驻右栏）

## 开发

```bash
npm run build     # esbuild → lib/client.js（ModuleLoader 包装）、lib/index.js、preview/harness.html
npm run serve     # 本地静态服务预览
npm run shot      # puppeteer 截图（harness）
npm run verify    # E2E：打开工作台 → 遍历 6 个页签 → 紫微点宫 → 关闭 → 0 console 错误
npm run parity    # 引擎一致性（JS vs Python 基准），105 项
```

目录：

```
src/engines/     八字 / 紫微 / 奇门 / 每日黄历引擎（纯函数）
src/render/      盘面组件（八字、紫微、奇门、大运）
src/timeline/    人生轨迹 SVG 时间轴
src/app/         工作台三栏页、每日黄历 tab、报告、浮层
tools/           build / verify / shot / parity
docs/            插件契约、方案文档、黄金样例
```

## 数据与隐私

- 档案、每日黄历存档、轨迹节点都存浏览器 `localStorage`（`mingli.*`）
- 排盘在本地完成，不发网络请求
- 卸载插件不会自动清数据；需要清除时在 DevTools 里删除 `mingli.*` 键

## 免责声明

本项目基于传统命理规则做程序化推演，结果仅供文化研究与自我参照，不构成任何医疗、法律、投资或人生决策建议。

## License

MIT（如需正式使用请补充 LICENSE 文件）
