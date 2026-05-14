/**
 * build_threads.mjs
 * 从 interactions.json 构建对话线程 them/threads.json
 * 算法：replyToStatusId 链接 + 24h 时间窗口合并
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const BASE = 'D:/islander';
const WINDOW_MS = 24 * 60 * 60 * 1000; // 24h

const raw = JSON.parse(readFileSync(resolve(BASE, 'them/interactions.json'), 'utf-8'));
const interactions = raw.interactions;

// Load source tweets for full context lookup
const dao = JSON.parse(readFileSync(resolve(BASE, 'bohedao/twitter/bohedaouo_tweets.json'), 'utf-8'));
const mei = JSON.parse(readFileSync(resolve(BASE, 'meistingray/meistingray_timeline.json'), 'utf-8'));

function getId(href) {
  const m = href?.match(/status\/(\d+)/);
  return m ? m[1] : null;
}

// Build href→interaction and id→interaction maps
const byHref = new Map();
const byId = new Map();
for (const i of interactions) {
  byHref.set(i.href, i);
  const id = getId(i.href);
  if (id) byId.set(id, i);
}

// Build id→tweet maps for root tweet lookup
const allTweetsById = new Map();
for (const t of dao.tweets) allTweetsById.set(getId(t.href), { ...t, author: 'bohedaouo' });
for (const t of mei.tweets) allTweetsById.set(getId(t.href), { ...t, author: 'MeiStingray' });

// Union-Find for grouping
const parent = new Map();
function find(x) {
  if (!parent.has(x)) parent.set(x, x);
  if (parent.get(x) !== x) parent.set(x, find(parent.get(x)));
  return parent.get(x);
}
function union(a, b) {
  const ra = find(a), rb = find(b);
  if (ra !== rb) parent.set(ra, rb);
}

// Phase 1: Link by replyToStatusId
for (const i of interactions) {
  const myId = getId(i.href);
  if (!myId) continue;
  if (i.replyToStatusId && byId.has(i.replyToStatusId)) {
    union(myId, i.replyToStatusId);
  }
  if (i.targetHref) {
    const targetId = getId(i.targetHref);
    if (targetId && byId.has(targetId)) union(myId, targetId);
  }
}

// Phase 2: Time-window merge for unlinked interactions
const sorted = [...interactions].sort((a, b) => new Date(a.time) - new Date(b.time));
for (let i = 0; i < sorted.length - 1; i++) {
  const curr = sorted[i];
  const next = sorted[i + 1];
  const currId = getId(curr.href);
  const nextId = getId(next.href);
  if (!currId || !nextId) continue;

  const gap = new Date(next.time) - new Date(curr.time);
  if (gap <= WINDOW_MS && curr.initiator !== next.initiator) {
    // Only merge if they're talking to each other (different initiators, close in time)
    // and at least one doesn't already have a link
    if (!next.replyToStatusId && !next.targetHref) {
      union(currId, nextId);
    }
  }
}

// Phase 3: Group into threads
const groups = new Map();
for (const i of interactions) {
  const id = getId(i.href);
  if (!id) continue;
  const root = find(id);
  if (!groups.has(root)) groups.set(root, []);
  groups.get(root).push(i);
}

// Phase 4: Build thread objects
const threads = [];
let threadNum = 0;

for (const [rootId, messages] of groups) {
  messages.sort((a, b) => new Date(a.time) - new Date(b.time));
  threadNum++;

  // Find root tweet (the original that started the conversation)
  let rootTweet = null;
  const firstMsg = messages[0];
  if (firstMsg.targetHref) {
    const rootTweetId = getId(firstMsg.targetHref);
    if (rootTweetId) rootTweet = allTweetsById.get(rootTweetId);
  }

  const threadMessages = [];

  // Include root tweet if it exists and isn't already in messages
  if (rootTweet && !messages.find(m => getId(m.href) === getId(rootTweet.href))) {
    threadMessages.push({
      time: rootTweet.time,
      author: rootTweet.author,
      text: rootTweet.fullText || rootTweet.text,
      href: rootTweet.href,
      isRoot: true,
    });
  }

  for (const m of messages) {
    threadMessages.push({
      time: m.time,
      author: m.initiator,
      text: m.text,
      href: m.href,
      type: m.type,
    });
  }

  threadMessages.sort((a, b) => new Date(a.time) - new Date(b.time));

  threads.push({
    threadId: `t_${String(threadNum).padStart(3, '0')}`,
    startTime: threadMessages[0].time,
    endTime: threadMessages[threadMessages.length - 1].time,
    messageCount: threadMessages.length,
    messages: threadMessages,
  });
}

// Sort threads by start time
threads.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
// Re-number after sorting
threads.forEach((t, i) => { t.threadId = `t_${String(i + 1).padStart(3, '0')}`; });

const output = {
  schema_version: '1.0',
  generatedAt: new Date().toISOString(),
  algorithm: 'replyToStatusId linking + 24h time-window merge for unlinked cross-author interactions',
  totalThreads: threads.length,
  totalMessages: threads.reduce((s, t) => s + t.messageCount, 0),
  threads,
};

writeFileSync(resolve(BASE, 'them/threads.json'), JSON.stringify(output, null, 2), 'utf-8');
console.log(`Generated ${threads.length} threads (${output.totalMessages} messages)`);
console.log(`  Single-message threads: ${threads.filter(t => t.messageCount === 1).length}`);
console.log(`  Multi-message threads: ${threads.filter(t => t.messageCount > 1).length}`);
console.log(`  Longest thread: ${Math.max(...threads.map(t => t.messageCount))} messages`);
