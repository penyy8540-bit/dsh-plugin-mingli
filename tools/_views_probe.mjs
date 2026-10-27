import fs from 'node:fs';
import path from 'node:path';

const base = path.join(process.env.TEMP, 'dsh-asar', 'dsh', 'node_modules', '@deepseek-ai');
const hits = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(file); continue; }
    if (!entry.name.endsWith('.js')) continue;
    const text = fs.readFileSync(file, 'latin1');
    if (!text.includes('uiConversation')) continue;
    const idx = text.search(/uiConversation/);
    hits.push(file.replace(base + '\\', ''));
    console.log('===== ' + file.replace(base + '\\', '') + ' @' + idx + ' =====');
    console.log(text.slice(Math.max(0, idx - 400), idx + 900).replace(/\s+/g, ' '));
    console.log();
  }
}
walk(base);
console.log('files:', hits.length);
