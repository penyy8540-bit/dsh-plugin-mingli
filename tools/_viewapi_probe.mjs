import fs from 'node:fs';
import path from 'node:path';

const base = path.join(process.env.TEMP, 'dsh-asar', 'dsh', 'node_modules', '@deepseek-ai');
const patterns = ['selectView(', 'setView(', 'uiConversation.views', 'openView(', 'uiWorkspace.openSession'];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(file); continue; }
    if (!entry.name.endsWith('.js')) continue;
    const text = fs.readFileSync(file, 'latin1');
    for (const pattern of patterns) {
      let i = text.indexOf(pattern);
      let n = 0;
      while (i >= 0 && n < 2) {
        const rel = file.replace(base + '\\', '');
        console.log(`[${pattern}] ${rel} @${i}`);
        console.log('   ' + text.slice(Math.max(0, i - 200), i + 240).replace(/\s+/g, ' '));
        i = text.indexOf(pattern, i + pattern.length);
        n += 1;
      }
    }
  }
}
walk(base);
