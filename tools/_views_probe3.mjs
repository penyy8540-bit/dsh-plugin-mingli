import fs from 'node:fs';
import path from 'node:path';

const file = path.join(process.env.TEMP, 'dsh-asar', 'dsh', 'node_modules', '@deepseek-ai', 'dsh-client-ui-conversation', 'lib', 'client.js');
const s = fs.readFileSync(file, 'latin1');
for (const pattern of ['openView(sessionId', 'setView(sessionId', 'this.openView', 'this.setView', 'selectView = ', 'viewsFor(']) {
  const i = s.indexOf(pattern);
  console.log('===== ' + pattern + ' @' + i + ' =====');
  if (i >= 0) console.log(s.slice(Math.max(0, i - 500), i + 700).replace(/\s+/g, ' '));
  console.log();
}
