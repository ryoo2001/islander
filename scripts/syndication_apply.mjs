/**
 * syndication_apply.mjs
 * 将 syndication_cache/ 中的补全数据合并回 meistingray_timeline.json
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { resolve } from 'path';

const CACHE_DIR = resolve('D:/islander/scripts/syndication_cache');
const TIMELINE = resolve('D:/islander/meistingray/meistingray_timeline.json');

function getId(href) {
  const m = href.match(/status\/(\d+)/);
  return m ? m[1] : null;
}

// Load all enrichment data from cache
const enrichMap = new Map();
const files = readdirSync(CACHE_DIR).filter(f => f.startsWith('batch_mei_') && f.endsWith('.json'));
for (const f of files) {
  const batch = JSON.parse(readFileSync(resolve(CACHE_DIR, f), 'utf-8'));
  for (const r of batch.results) {
    if (!r.error) enrichMap.set(r.id, r);
  }
}
console.log(`Loaded ${enrichMap.size} enrichment records from ${files.length} batch files`);

// Load and update timeline
const timeline = JSON.parse(readFileSync(TIMELINE, 'utf-8'));
let updated = 0, notFound = 0;

for (const tweet of timeline.tweets) {
  const id = getId(tweet.href);
  if (!id) continue;
  const enrich = enrichMap.get(id);
  if (!enrich) { notFound++; continue; }

  // Apply enrichment
  tweet.replyTo = enrich.in_reply_to_screen_name || tweet.replyTo || null;
  tweet.replyToStatusId = enrich.in_reply_to_status_id_str || tweet.replyToStatusId || null;
  tweet.quotedId = enrich.quoted_tweet_id || tweet.quotedId || null;
  tweet.quotedScreenName = enrich.quoted_screen_name || tweet.quotedScreenName || null;

  // Update stats (only if API returned non-zero or tweet had no stats)
  if (enrich.favorite_count > 0 || tweet.stats.likes === 0) {
    tweet.stats.likes = enrich.favorite_count;
  }
  if (enrich.conversation_count > 0 || tweet.stats.replies === 0) {
    tweet.stats.replies = enrich.conversation_count;
  }

  // Update images from photos
  if (enrich.photos && enrich.photos.length > 0 && (!tweet.images || tweet.images.length === 0)) {
    tweet.images = enrich.photos;
    tweet.hasPhoto = true;
  }

  // Infer type
  if (tweet.type === 'unknown' || !tweet.type) {
    if (enrich.in_reply_to_screen_name) tweet.type = 'reply';
    else if (enrich.quoted_tweet_id) tweet.type = 'quote';
    else tweet.type = 'original';
  }

  // Use API text if we have it (more complete than DOM scrape)
  if (enrich.text && enrich.text.length > (tweet.fullText || '').length) {
    tweet.fullText = enrich.text;
  }

  updated++;
}

// Update header
timeline.schema_version = '2.0';
timeline.enrichedAt = new Date().toISOString();
timeline.enrichedWith = 'Syndication API';

writeFileSync(TIMELINE, JSON.stringify(timeline, null, 2), 'utf-8');

console.log(`Updated: ${updated} | Not found in cache: ${notFound}`);
console.log(`Total tweets: ${timeline.total}`);

// Stats
const types = { original: 0, reply: 0, quote: 0, unknown: 0 };
let withReplyTo = 0, withStats = 0;
for (const t of timeline.tweets) {
  types[t.type || 'unknown']++;
  if (t.replyTo) withReplyTo++;
  if (t.stats.likes > 0) withStats++;
}
console.log('Type distribution:', types);
console.log('With replyTo:', withReplyTo);
console.log('With likes > 0:', withStats);

