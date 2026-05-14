/**
 * build_interactions.mjs
 * 从两个主文件派生互动索引 them/interactions.json
 * 提取所有 岛岛↔青梅 的互相回复/引用/提及
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const BASE = 'D:/islander';

function getId(href) {
  const m = href.match(/status\/(\d+)/);
  return m ? m[1] : null;
}

// Load both timelines
const dao = JSON.parse(readFileSync(resolve(BASE, 'bohedao/twitter/bohedaouo_tweets.json'), 'utf-8'));
const mei = JSON.parse(readFileSync(resolve(BASE, 'meistingray/meistingray_timeline.json'), 'utf-8'));

// Build ID→tweet lookup for context
const daoById = new Map(dao.tweets.map(t => [getId(t.href), t]));
const meiById = new Map(mei.tweets.map(t => [getId(t.href), t]));

const interactions = [];

// 岛岛 → 青梅: replies/quotes/mentions
for (const t of dao.tweets) {
  const isReplyToMei = t.replyTo && t.replyTo.toLowerCase().replace('@','') === 'meistingray';
  const isQuoteMei = t.quotedScreenName && t.quotedScreenName.toLowerCase() === 'meistingray';
  const mentionsMei = t.fullText && t.fullText.toLowerCase().includes('@meistingray');

  if (isReplyToMei || isQuoteMei || mentionsMei) {
    let type = 'mention';
    if (isReplyToMei) type = 'reply';
    else if (isQuoteMei) type = 'quote';

    const targetTweet = t.replyToStatusId ? meiById.get(t.replyToStatusId) : null;

    interactions.push({
      time: t.time,
      initiator: 'bohedaouo',
      type,
      href: t.href,
      text: t.fullText || t.text,
      replyToStatusId: t.replyToStatusId || null,
      targetHref: targetTweet?.href || null,
      targetText: targetTweet ? (targetTweet.fullText || targetTweet.text) : null,
      targetTime: targetTweet?.time || null,
    });
  }
}

// 青梅 → 岛岛: replies/quotes/mentions
for (const t of mei.tweets) {
  const isReplyToDao = t.replyTo && t.replyTo.toLowerCase().replace('@','') === 'bohedaouo';
  const isQuoteDao = t.quotedScreenName && t.quotedScreenName.toLowerCase() === 'bohedaouo';
  const mentionsDao = t.fullText && t.fullText.toLowerCase().includes('@bohedaouo');
  const textMentions = t.text && t.text.toLowerCase().includes('@bohedaouo');

  if (isReplyToDao || isQuoteDao || mentionsDao || textMentions) {
    let type = 'mention';
    if (isReplyToDao) type = 'reply';
    else if (isQuoteDao) type = 'quote';

    const targetTweet = t.replyToStatusId ? daoById.get(t.replyToStatusId) : null;

    interactions.push({
      time: t.time,
      initiator: 'MeiStingray',
      type,
      href: t.href,
      text: t.fullText || t.text,
      replyToStatusId: t.replyToStatusId || null,
      targetHref: targetTweet?.href || null,
      targetText: targetTweet ? (targetTweet.fullText || targetTweet.text) : null,
      targetTime: targetTweet?.time || null,
    });
  }
}

// Sort by time
interactions.sort((a, b) => new Date(a.time) - new Date(b.time));

// Output
const output = {
  schema_version: '2.1',
  generatedAt: new Date().toISOString(),
  generatedFrom: ['bohedaouo_tweets.json', 'meistingray_timeline.json'],
  coverage: {
    earliest: interactions[0]?.time?.slice(0, 10) || null,
    latest: interactions[interactions.length - 1]?.time?.slice(0, 10) || null,
  },
  total: interactions.length,
  byInitiator: {
    bohedaouo: interactions.filter(i => i.initiator === 'bohedaouo').length,
    MeiStingray: interactions.filter(i => i.initiator === 'MeiStingray').length,
  },
  interactions,
};

writeFileSync(resolve(BASE, 'them/interactions.json'), JSON.stringify(output, null, 2), 'utf-8');
console.log(`Generated ${interactions.length} interactions`);
console.log(`  bohedaouo → MeiStingray: ${output.byInitiator.bohedaouo}`);
console.log(`  MeiStingray → bohedaouo: ${output.byInitiator.MeiStingray}`);
console.log(`  Coverage: ${output.coverage.earliest} → ${output.coverage.latest}`);

