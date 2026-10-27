import fs from 'node:fs';
import path from 'node:path';

const file = path.join(process.env.TEMP, 'dsh-asar', 'dsh', 'node_modules', '@deepseek-ai', 'dsh-client-ui-conversation', 'lib', 'client.js');
const s = fs.readFileSync(file, 'latin1');
for (const pattern of ['views.register', 'views.', 'openView', 'viewRequest', 'selectView', 'provide("uiConversation"', 'uiConversation =']) {
  let i = s.indexOf(pattern);
  let n = 0;
  console.log('===== ' + pattern + ' @' + i + ' =====');
  while (i >= 0 && n < 3) {
    console.log(s.slice(Math.max(0, i - 260), i + 320).replace(/\s+/g, ' '));
    console.log('---');
    i = s.indexOf(pattern, i + pattern.length);
    n += 1;
  }
  console.log();
}
