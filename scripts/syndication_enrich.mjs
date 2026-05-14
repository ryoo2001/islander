/**
 * syndication_enrich.mjs
 * 用 Syndication API 批量补全青梅推文的 replyTo/stats/photos/type
 * 片段化保存：每 100 条存一个 batch 文件，支持断点续传
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { execSync } from 'child_process';
import { resolve } from 'path';

const CACHE_DIR = resolve('D:/islander/scripts/syndication_cache');
const TIMELINE = resolve('D:/islander/meistingray/meistingray_timeline.json');
const BATCH_SIZE = 100;
const DELAY_MS = 130; // ~7.7 req/s, safe margin

if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });

function getId(href) {
  const m = href.match(/status\/(\d+)/);
  return m ? m[1] : null;
}

function sleep(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {}
}

// Load already-completed IDs from cache
function getCompletedIds() {
  const completed = new Set();
  const files = readdirSync(CACHE_DIR).filter(f => f.startsWith('batch_') && f.endsWith('.json'));
  for (const f of files) {
    const batch = JSON.parse(readFileSync(resolve(CACHE_DIR, f), 'utf-8'));
    for (const r of batch.results) {
      if (!r.error) completed.add(r.id);
    }
  }
  return completed;
}

function fetchTweet(id) {
  try {
    const raw = execSync(
      `curl -s "https://cdn.syndication.twimg.com/tweet-result?id=${id}&token=1"`,
      { timeout: 15000 }
    ).toString();
    const d = JSON.parse(raw);
    return {
      id,
      in_reply_to_screen_name: d.in_reply_to_screen_name || null,
      in_reply_to_status_id_str: d.in_reply_to_status_id_str || null,
      favorite_count: d.favorite_count || 0,
      conversation_count: d.conversation_count || 0,
      photos: (d.photos || []).map(p => p.url),
      quoted_tweet_id: d.quoted_tweet?.id_str || null,
      quoted_screen_name: d.quoted_tweet?.user?.screen_name || null,
      text: d.text || null,
    };
  } catch (e) {
    return { id, error: e.message?.slice(0, 100) };
  }
}

// --- Main ---
const timeline = JSON.parse(readFileSync(TIMELINE, 'utf-8'));
const allIds = timeline.tweets.map(t => getId(t.href)).filter(Boolean);
const completedIds = getCompletedIds();
const pendingIds = allIds.filter(id => !completedIds.has(id));

console.log(`Total: ${allIds.length} | Already done: ${completedIds.size} | Pending: ${pendingIds.length}`);

if (pendingIds.length === 0) {
  console.log('All tweets already enriched. Run apply step.');
  process.exit(0);
}

// Process in batches
const batchStart = readdirSync(CACHE_DIR).filter(f => f.startsWith('batch_mei_')).length;
let batchNum = batchStart;

for (let i = 0; i < pendingIds.length; i += BATCH_SIZE) {
  const batchIds = pendingIds.slice(i, i + BATCH_SIZE);
  const results = [];
  let success = 0, fail = 0;

  for (const id of batchIds) {
    const result = fetchTweet(id);
    results.push(result);
    if (result.error) fail++;
    else success++;
    if (i + results.length < pendingIds.length) sleep(DELAY_MS);
  }

  batchNum++;
  const fragment = {
    batchId: `mei_${String(batchNum).padStart(3, '0')}`,
    timestamp: new Date().toISOString(),
    account: 'MeiStingray',
    total: batchIds.length,
    success,
    fail,
    results,
  };

  const outFile = resolve(CACHE_DIR, `batch_mei_${String(batchNum).padStart(3, '0')}.json`);
  writeFileSync(outFile, JSON.stringify(fragment, null, 2));
  console.log(`Batch ${batchNum}: ${success}/${batchIds.length} ok | ${completedIds.size + i + batchIds.length}/${allIds.length} total`);
}

console.log('\nDone! Run apply step to merge enrichment into timeline.');
