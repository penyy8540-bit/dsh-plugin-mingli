import { buildDaily } from '../src/engines/daily.js';

const profile = {
  name: 'aaa', gender: 'male', solar: '2007-01-09T12:00', longitude: 116.4, use_true_solar: true,
};
const daily = buildDaily({ profile, date: new Date() });
console.log('aspects:', daily.aspects.map((a) => `${a.label}${a.score}(${a.level})`).join(' '));
console.log('--- explain ---');
console.log(daily.explain);
