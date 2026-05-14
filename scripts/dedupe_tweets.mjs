import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const BASE = resolve('D:/islander/bohedao/twitter');

function getId(href) {
  const m = href.match(/status\/(\d+)/);
  return m ? m[1] : null;
}

function normalizeHref(href, account) {
  const id = getId(href);
  return id ? `https://x.com/${account}/status/${id}` : href;
}

function parseStats(tweet) {
  if (Array.isArray(tweet.stats)) {
    const [replies, retweets, likes] = tweet.stats.map(s => parseInt(s) || 0);
    return { replies, retweets, likes, views: 0 };
  }
  if (tweet.stats && typeof tweet.stats === 'object' && !Array.isArray(tweet.stats)) {
    return {
      replies: tweet.stats.replies || 0,
      retweets: tweet.stats.retweets || 0,
      likes: tweet.stats.likes || tweet.favoriteCount || 0,
      views: tweet.stats.views || 0
    };
  }
  return { replies: 0, retweets: 0, likes: tweet.favoriteCount || 0, views: 0 };
}

function normalizeTweet(tweet, account) {
  const source = tweet.source || 'timeline';
  return {
    href: normalizeHref(tweet.href, account),
    text: tweet.text || '',
    fullText: tweet.fullText || tweet.text || '',
    time: tweet.time,
    type: tweet.type || 'unknown',
    stats: parseStats(tweet),
    images: tweet.images || [],
    hasVideo: tweet.hasVideo || false,
    replyTo: tweet.replyTo ? tweet.replyTo.replace(/^@/, '') : null,
    replyToStatusId: tweet.replyToStatusId || null,
    quotedId: tweet.quotedId || null,
    quotedScreenName: tweet.quotedScreenName || null,
    quotedText: tweet.quotedText || null,
    source
  };
}

function mergeTweets(a, b) {
  const rich = a.source === 'timeline' ? a : b;
  const sparse = a.source === 'timeline' ? b : a;
  return {
    ...sparse,
    ...rich,
    images: rich.images.length > 0 ? rich.images : sparse.images,
    stats: rich.stats.likes > 0 || rich.stats.replies > 0 ? rich.stats : sparse.stats,
    source: rich.source
  };
}

function dedupeFile(filename, account) {
  const filepath = resolve(BASE, filename);
  const raw = JSON.parse(readFileSync(filepath, 'utf-8'));
  const tweets = raw.tweets;
  const idMap = new Map();

  for (const tweet of tweets) {
    const id = getId(tweet.href);
    if (!id) continue;
    const normalized = normalizeTweet(tweet, account);
    if (idMap.has(id)) {
      idMap.set(id, mergeTweets(idMap.get(id), normalized));
    } else {
      idMap.set(id, normalized);
    }
  }

  const deduped = [...idMap.values()].sort((a, b) =>
    new Date(a.time) - new Date(b.time)
  );

  const result = {
    account,
    schema_version: '2.0',
    scrapedAt: raw.scrapedAt || raw.mergedAt,
    deduplicatedAt: new Date().toISOString(),
    total: deduped.length,
    tweets: deduped
  };

  writeFileSync(filepath, JSON.stringify(result, null, 2), 'utf-8');
  return { filename, before: tweets.length, after: deduped.length };
}

function mergeExternalTweets(mainFile, externalFile, account) {
  const mainPath = resolve(BASE, mainFile);
  const main = JSON.parse(readFileSync(mainPath, 'utf-8'));
  const ext = JSON.parse(readFileSync(resolve('D:/islander/them', externalFile), 'utf-8'));

  const mainIds = new Set(main.tweets.map(t => getId(t.href)));
  let added = 0;

  for (const t of ext.tweets) {
    const id = getId(t.href);
    if (!id || mainIds.has(id)) continue;
    // Normalize external tweet to canonical schema
    const normalized = normalizeTweet({
      href: t.href,
      text: t.text || '',
      fullText: t.fullText || t.text || '',
      time: t.time,
      type: t.replyTo ? 'reply' : 'unknown',
      stats: t.stats || {},
      images: t.images || [],
      hasVideo: t.hasVideo || false,
      replyTo: t.replyTo || t.author === 'bohedaouo' ? null : null,
      replyToStatusId: null,
      quotedId: null,
      quotedScreenName: null,
      quotedText: null,
      source: 'search_interaction',
      ...t,
    }, account);
    main.tweets.push(normalized);
    mainIds.add(id);
    added++;
  }

  // Re-sort by time
  main.tweets.sort((a, b) => new Date(a.time) - new Date(b.time));
  main.total = main.tweets.length;
  main.deduplicatedAt = new Date().toISOString();

  writeFileSync(mainPath, JSON.stringify(main, null, 2), 'utf-8');
  return { mainFile, externalFile, added, newTotal: main.total };
}

// --- Main execution ---
const account = 'bohedaouo';
const results = [];

// Step 1: Dedupe
results.push(dedupeFile('bohedaouo_tweets.json', account));
results.push(dedupeFile('bohedaouo_replies.json', account));
results.push(dedupeFile('bohedaouo_originals.json', account));
results.push(dedupeFile('bohedaouo_quotes.json', account));

console.log('=== Deduplication Results ===');
for (const r of results) {
  const saved = r.before - r.after;
  console.log(`${r.filename}: ${r.before} → ${r.after} (removed ${saved} dupes)`);
}

// Step 2: Merge external interaction tweets
console.log('\n=== Merging External Tweets ===');
const mergeResult = mergeExternalTweets(
  'bohedaouo_tweets.json',
  'bohedaouo_to_meistingray.json',
  account
);
console.log(`Merged ${mergeResult.added} tweets from ${mergeResult.externalFile} → new total: ${mergeResult.newTotal}`);
