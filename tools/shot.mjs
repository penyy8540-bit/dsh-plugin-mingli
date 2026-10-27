/* Headless screenshot of the offline preview / ModuleLoader harness.
 * Uses puppeteer-core (installed dev dependency) because Chrome's one-shot
 * `--screenshot` occasionally paints before shadow-DOM styles settle.
 *
 * Usage: node tools/shot.mjs [--out out/shot.png] [--width 1280] [--height 900]
 *        [--page index.html|harness.html?entry=overlay|view|workbench]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const pick = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const out = path.resolve(root, pick('--out', 'out/shot.png'));
const width = Number(pick('--width', 1280));
const height = Number(pick('--height', 900));
const pageArg = pick('--page', 'index.html');
const [pageFile, pageQuery] = pageArg.split('?');

const target = path.join(root, 'preview', pageFile);
if (!fs.existsSync(target)) throw new Error(`Missing preview/${pageFile}; run "node tools/build.mjs" first`);
const candidates = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
const executablePath = candidates.find((p) => fs.existsSync(p));
if (!executablePath) throw new Error('No Chrome/Edge found');

fs.mkdirSync(path.dirname(out), { recursive: true });
const browser = await puppeteer.launch({
  executablePath,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
  defaultViewport: { width, height, deviceScaleFactor: 1 },
});
try {
  const page = await browser.newPage();
  // The harness has no DSH theme tokens; pin the light colour scheme so the
  // preview is deterministic instead of following the headless UA preference.
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
  const url = `file:///${target.replace(/\\/g, '/')}${pageQuery ? `?${pageQuery}` : ''}`;
  await page.goto(url, { waitUntil: 'load', timeout: 30_000 });
  await new Promise((resolve) => setTimeout(resolve, 1200));
  await page.screenshot({ path: out });
  console.log(`[shot] ${out} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
} finally {
  await browser.close();
}
