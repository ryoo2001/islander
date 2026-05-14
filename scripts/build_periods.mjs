/**
 * build_periods.mjs
 * 从 interactions.json 按关系阶段切片到 them/periods/
 * 六期划分基于月度互动密度数据验证
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

const BASE = 'D:/islander';
const OUT_DIR = resolve(BASE, 'them/periods');
mkdirSync(OUT_DIR, { recursive: true });

const raw = JSON.parse(readFileSync(resolve(BASE, 'them/interactions.json'), 'utf-8'));
const interactions = raw.interactions;

const PERIODS = [
  { id: 'period_01_initiation', start: '2023-08-01', end: '2023-12-31',
    label: '岛岛单向试探期', note: '100% 岛岛发起，青梅零回应' },
  { id: 'period_02_mutual', start: '2024-01-01', end: '2024-04-30',
    label: '首次双向互动期', note: '青梅开始回应，逐渐平衡' },
  { id: 'period_03_cooling', start: '2024-05-01', end: '2024-09-30',
    label: '冷却期', note: '互动骤降，青梅反而更主动（60%）' },
  { id: 'period_04_recovery', start: '2024-10-01', end: '2024-12-31',
    label: '回暖期', note: '互动逐月回升' },
  { id: 'period_05_peak', start: '2025-01-01', end: '2025-04-30',
    label: '爆发期', note: '4月峰值176条，青梅占59%' },
  { id: 'period_06_collapse', start: '2025-05-01', end: '2025-10-31',
    label: '崩塌期', note: '9月完全沉默' },
];

for (const period of PERIODS) {
  const startMs = new Date(period.start).getTime();
  const endMs = new Date(period.end + 'T23:59:59Z').getTime();

  const filtered = interactions.filter(i => {
    const t = new Date(i.time).getTime();
    return t >= startMs && t <= endMs;
  });

  const byInitiator = {
    bohedaouo: filtered.filter(i => i.initiator === 'bohedaouo').length,
    MeiStingray: filtered.filter(i => i.initiator === 'MeiStingray').length,
  };

  const output = {
    period: period.id,
    label: period.label,
    note: period.note,
    range: { start: period.start, end: period.end },
    total: filtered.length,
    byInitiator,
    interactions: filtered,
  };

  const outPath = resolve(OUT_DIR, `${period.id}.json`);
  writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`${period.id}: ${filtered.length} interactions (${byInitiator.bohedaouo}→ / ${byInitiator.MeiStingray}←)`);
}

console.log(`\nDone. ${PERIODS.length} period files written to them/periods/`);
