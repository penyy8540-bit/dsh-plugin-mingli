import fs from 'node:fs';

const file = 'src/app/workbench/WorkbenchPage.jsx';
let s = fs.readFileSync(file, 'utf8');

function cut(from, to, replacement = '') {
  const start = s.indexOf(from);
  if (start < 0) throw new Error('anchor not found: ' + from.slice(0, 40));
  const end = s.indexOf(to, start);
  if (end < 0) throw new Error('end anchor not found: ' + to.slice(0, 40));
  s = s.slice(0, start) + replacement + s.slice(end + to.length);
}

// 1) chat-ish state
cut("  const [search, setSearch] = React.useState('');\n", "  const [refreshAt, setRefreshAt] = React.useState(0);\n", "  const [refreshAt, setRefreshAt] = React.useState(0);\n");
// 2) node memo
cut('  const nodes = React.useMemo(() => (profile ? readNodes(profile.id) : []), [profile?.id, refreshAt]);\n', '  const charts = React.useMemo(() => {', '  const charts = React.useMemo(() => {');
// 3) filtered / favorites
cut('  const filtered = React.useMemo(() => {', '  const switchProfile = (id) => {', '  const switchProfile = (id) => {');
// 4) favorite + jump helpers
cut('  const toggleFavorite = (node) => {', '  const dailyLines = daily', '  const dailyLines = daily');

// 5) left rail: remove 收藏 + 提问记录 groups (keep profile group)
cut("        React.createElement('div', { className: 'ml-wp-group' },\n          React.createElement('div', { className: 'ml-wp-group-title' }, '收藏'", "            : React.createElement('p', { className: 'ml-wp-hint' },\n              nodes.length ? '没有匹配的记录' : '暂无记录'))),", '        )),\n');

// 6) centre records block
cut('        nodes.length\n          ? React.createElement(\'div\', { className: \'ml-wp-records\' },', '          : null)),', '        )),\n');

// 7) aspects chips -> cards
cut("            React.createElement('div', { className: 'ml-wp-aspects' },", "              React.createElement('i', null, String(aspect.score))))),", `            React.createElement('div', { className: 'ml-dt-grid' },
              (daily.aspects || []).map((aspect) => React.createElement('div', { key: aspect.key, className: 'ml-dt-card' },
                React.createElement('div', { className: 'ml-dt-card-top' },
                  React.createElement('b', null, aspect.label),
                  React.createElement('span', { className: 'ml-dt-card-score' }, \`\${aspect.score} · \${aspect.level}\`)),
                React.createElement('div', { className: 'ml-dt-bar' },
                  React.createElement('i', { style: { width: \`\${aspect.score}%\` } })),
                React.createElement('div', { className: 'ml-dt-advice' }, aspect.advice),
                aspect.reasons.length
                  ? React.createElement('ul', { className: 'ml-dt-reasons' },
                    aspect.reasons.map((reason, index) => React.createElement('li', { key: index }, reason)))
                  : null))),`);

// 8) drop unused helper at the end
cut('\nfunction taskTags(node) {', '\n}\n', '\n');

fs.writeFileSync(file, s);
console.log('pruned ok', s.length);
for (const bad of ['readNodes', 'updateQuestionNode', 'highlightId', 'favorites', 'filtered', 'toggleFavorite', 'jumpToNode', 'taskTags']) {
  if (s.includes(bad)) console.log('WARN leftover:', bad);
}
