/* End-to-end UI verification of the PRODUCTION client bundle.
 *
 * Loads preview/harness.html (executes lib/client.js through a ModuleLoader
 * stub), opens the workbench overlay, walks the right-column chart tabs,
 * checks key content, exercises palace click + close, and fails on console or
 * page errors.
 *
 * Usage: node tools/verify.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'out', 'verify');
fs.mkdirSync(outDir, { recursive: true });

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  const target = path.join(root, urlPath === '/' ? 'preview/index.html' : urlPath);
  if (!target.startsWith(root)) return res.writeHead(403).end('forbidden');
  fs.readFile(target, (error, data) => {
    if (error) return res.writeHead(404).end('not found');
    res.writeHead(200, { 'content-type': TYPES[path.extname(target)] || 'application/octet-stream' }).end(data);
  });
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;

const executablePath = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => fs.existsSync(p));
if (!executablePath) throw new Error('Chrome/Edge not found');

const errors = [];
const browser = await puppeteer.launch({
  executablePath,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
  defaultViewport: { width: 1400, height: 900, deviceScaleFactor: 1 },
});
const report = { steps: [], errors, tabs: {} };
try {
  const page = await browser.newPage();
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (/favicon\.ico/.test(text) || /Failed to load resource/.test(text)) return;
    errors.push('console: ' + text);
  });
  page.on('pageerror', (error) => errors.push('pageerror: ' + error.message));
  const missingResources = [];
  page.on('response', (response) => {
    if (response.status() >= 400 && !/favicon\.ico/.test(response.url())) missingResources.push(`${response.status()} ${response.url()}`);
  });

  await page.goto(`http://127.0.0.1:${port}/preview/harness.html`, { waitUntil: 'load', timeout: 30_000 });
  await page.waitForFunction(() => {
    const host = document.querySelector('#mount > div');
    return Boolean(host && host.shadowRoot && host.shadowRoot.querySelector('.ml-launcher'));
  }, { timeout: 20_000 });
  await page.evaluate(() => document.querySelector('#mount > div').shadowRoot.querySelector('.ml-launcher').click());
  await page.waitForFunction(() => {
    const root = document.querySelector('#mount > div').shadowRoot;
    return Boolean(root.querySelector('.ml-wbo-panel'));
  }, { timeout: 10_000 });
  await new Promise((r) => setTimeout(r, 800));

  const readPanel = () => page.evaluate(() => {
    const shadow = document.querySelector('#mount > div').shadowRoot;
    const panel = shadow.querySelector('.ml-wbo-panel');
    return {
      text: panel ? panel.innerText : '',
      tabs: [...shadow.querySelectorAll('.ml-wp-right-tab')].map((b) => b.textContent.trim()),
      activeTab: (shadow.querySelector('.ml-wp-right-tab[data-active="true"]') || {}).textContent,
      svg: panel ? panel.querySelectorAll('svg').length : 0,
    };
  });

  const clickTab = async (label) => {
    const ok = await page.evaluate((text) => {
      const shadow = document.querySelector('#mount > div').shadowRoot;
      const button = [...shadow.querySelectorAll('.ml-wp-right-tab')].find((b) => b.textContent.trim() === text);
      if (!button) return false;
      button.click();
      return true;
    }, label);
    if (!ok) throw new Error('right tab not found: ' + label);
    await new Promise((r) => setTimeout(r, 800));
  };

  const expectations = {
    黄历: ['黄历', '事业', '财运', '桃花', '双标准', '今日解读'],
    八字: ['四柱', '庚午', '五行'],
    紫微: ['紫微斗数', '火六局', '命宫'],
    奇门: ['奇门', '值符', '值使'],
    命途: ['尚无轨迹节点'],
    报告: ['报告', '四柱'],
  };

  const initial = await readPanel();
  report.steps.push({ step: 'workbench-opened', tabs: initial.tabs, activeTab: (initial.activeTab || '').trim() });
  if (initial.tabs.length !== 6) errors.push(`expected 6 chart tabs, got ${initial.tabs.length}`);

  for (const [label, keywords] of Object.entries(expectations)) {
    await clickTab(label);
    const view = await readPanel();
    const missing = keywords.filter((word) => !view.text.includes(word));
    report.tabs[label] = { activeTab: (view.activeTab || '').trim(), svg: view.svg, chars: view.text.length, missing };
    if (missing.length) errors.push(`tab ${label} missing keywords: ${missing.join(', ')}`);
    await page.screenshot({ path: path.join(outDir, `wp-${label}.png`) });
  }

  // palace detail interaction inside 紫微
  await clickTab('紫微');
  const palace = await page.evaluate(() => {
    const shadow = document.querySelector('#mount > div').shadowRoot;
    const cells = [...shadow.querySelectorAll('.ml-zw-cell')];
    if (!cells.length) return { cells: 0 };
    const before = shadow.querySelector('.ml-zw-detail')?.innerText || '';
    cells[Math.min(3, cells.length - 1)].click();
    return { cells: cells.length, before };
  });
  await new Promise((r) => setTimeout(r, 500));
  const after = await page.evaluate(() => document.querySelector('#mount > div').shadowRoot.querySelector('.ml-zw-detail')?.innerText || '');
  report.steps.push({ step: 'ziwei-palace-click', cells: palace.cells, changed: palace.before !== after });
  if (!palace.cells) errors.push('ziwei palace cells not found');
  else if (palace.before === after) errors.push('ziwei palace click did not change detail panel');

  // close via the overlay close button
  await page.evaluate(() => document.querySelector('#mount > div').shadowRoot.querySelector('.ml-wbo-close').click());
  await new Promise((r) => setTimeout(r, 500));
  const closed = await page.evaluate(() => {
    const shadow = document.querySelector('#mount > div').shadowRoot;
    return { panel: Boolean(shadow.querySelector('.ml-wbo-panel')), launcher: Boolean(shadow.querySelector('.ml-launcher')) };
  });
  report.steps.push({ step: 'close', ...closed });
  if (closed.panel || !closed.launcher) errors.push('close button did not return to the launcher');

  if (missingResources.length) errors.push('missing resources: ' + missingResources.join(' | '));
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  server.close();
}
process.exitCode = errors.length ? 1 : 0;
console.log(errors.length ? `\nFAIL (${errors.length} errors)` : '\nPASS: workbench + 6 chart tabs, no console errors');





