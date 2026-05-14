/**
 * Round 2: until-only approach with 12-pass cap per window
 * Gets more results than since+until bounded windows
 * Saves full content (text, replyTo, images)
 */

import { readFileSync, writeFileSync, existsSync } from "fs";

const PROXY = "http://localhost:3456";
const TARGET = "DC58C8E568034FB5C4CF6712C2BE7658";
const OUT_FILE = "D:/bohedao/data/twitter/bohedaouo_replies_round2.json";
const PROGRESS_FILE = "D:/bohedao/data/twitter/bohedaouo_replies_r2_progress.json";

const existing = JSON.parse(readFileSync("D:/bohedao/data/twitter/bohedaouo_tweets.json", "utf8"));
const knownHrefs = new Set(existing.map(t => t.href));
// Also exclude round1 results
const r1 = JSON.parse(readFileSync("D:/bohedao/data/twitter/bohedaouo_replies_supplement.json", "utf8"));
for (const t of r1.tweets) knownHrefs.add(t.href);
console.log(`Known hrefs (orig+r1): ${knownHrefs.size}`);

let progress = { collected: [], lastUntil: "2026-05-07", done: false };
if (existsSync(PROGRESS_FILE)) {
  progress = JSON.parse(readFileSync(PROGRESS_FILE, "utf8"));
  console.log(`Resuming from until:${progress.lastUntil}, collected: ${progress.collected.length}`);
}
const collected = new Map(progress.collected.map(t => [t.href, t]));

async function cdp(path, body = null) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const opts = { method: body !== null ? "POST" : "GET", signal: AbortSignal.timeout(30000) };
      if (body !== null) opts.body = body;
      const r = await fetch(`${PROXY}${path}`, opts);
      const text = await r.text();
      if (!text) throw new Error("empty response");
      return JSON.parse(text);
    } catch (e) {
      if (attempt < 2) { await sleep(3000); continue; }
      throw e;
    }
  }
}

async function evalJS(js) {
  const r = await cdp(`/eval?target=${TARGET}`, js);
  if (r.error) throw new Error("eval: " + r.error);
  return r.value;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

const MAX_PASSES = 12;

const EXTRACT_JS = `(function(){
  window.__wc = window.__wc || {};
  var HUIFU = String.fromCharCode(22238, 22797);
  var MEIYOU = String.fromCharCode(27809,26377,32467,26524);
  var CUOLE = String.fromCharCode(20986,38169,20102);
  var arts = document.querySelectorAll("article[data-testid=tweet]");
  for(var i=0;i<arts.length;i++){
    var a = arts[i];
    var href="", time="";
    var links = a.querySelectorAll("a");
    for(var j=0;j<links.length;j++){
      var p = links[j].pathname||"";
      var parts = p.split("/");
      if(parts.length===4 && parts[2]==="status"){
        href = links[j].href; break;
      }
    }
    if(!href) continue;
    var timeEl = a.querySelector("time");
    if(timeEl) time = timeEl.getAttribute("datetime")||"";
    var textEl = a.querySelector("[data-testid=tweetText]");
    var text = textEl ? textEl.innerText : "";
    var imgs = [];
    var imgEls = a.querySelectorAll("img[src*=\\"pbs.twimg.com/media\\"]");
    for(var m=0;m<imgEls.length;m++) imgs.push(imgEls[m].src);
    var replyTo = "";
    var raw = a.innerText;
    var rIdx = raw.indexOf(HUIFU);
    if(rIdx > -1){
      var after = raw.slice(rIdx+2);
      var match = after.match(/@[\\w]+/);
      if(match) replyTo = match[0];
    }
    window.__wc[href] = JSON.stringify({time:time, text:text, replyTo:replyTo, images:imgs});
  }
  var body = document.body.innerText;
  var noRes = body.indexOf(MEIYOU)>-1 || body.indexOf("No results")>-1;
  var hasErr = body.indexOf(CUOLE)>-1 || body.indexOf("Something went wrong")>-1;
  return JSON.stringify({size: Object.keys(window.__wc).length, noRes: noRes, hasErr: hasErr});
})()`;

const DUMP_JS = `(function(){
  var out = [];
  var keys = Object.keys(window.__wc || {});
  for(var i=0;i<keys.length;i++){
    var val = JSON.parse(window.__wc[keys[i]]);
    val.href = keys[i];
    out.push(val);
  }
  return JSON.stringify(out);
})()`;

async function collectWindow(untilDate) {
  const q = encodeURIComponent("from:bohedaouo filter:replies until:" + untilDate);
  const pageUrl = "https://x.com/search?q=" + q + "&f=live";
  console.log("\n-> Window until:" + untilDate);
  await cdp(`/navigate?target=${TARGET}&url=${encodeURIComponent(pageUrl)}`);
  await sleep(rand(6000, 10000));
  await evalJS("window.__wc = {};");

  let prevSize = 0, noNewPasses = 0;

  for (let pass = 1; pass <= MAX_PASSES && noNewPasses < 3; pass++) {
    const raw = await evalJS(EXTRACT_JS);
    const { size, noRes, hasErr } = JSON.parse(raw);

    if (hasErr) {
      console.log("  Page error — stopping window");
      break;
    }
    if (noRes && pass === 1) {
      console.log("  No results");
      return { tweets: [], earliest: null };
    }
    // Page reset detection
    if (size < prevSize * 0.7 && prevSize > 20) {
      console.log("  Count dropped " + prevSize + "->" + size + " — page reset, stopping");
      break;
    }
    if (size <= prevSize) {
      noNewPasses++;
    } else {
      noNewPasses = 0;
      console.log("  Pass " + pass + ": " + size + " (+" + (size - prevSize) + ")");
    }
    prevSize = size;

    if (noNewPasses < 3 && pass < MAX_PASSES) {
      await evalJS("window.scrollTo(0, document.body.scrollHeight)");
      await sleep(rand(8000, 15000));
    }
  }

  const tweets = JSON.parse(await evalJS(DUMP_JS));
  const withTime = tweets.filter(t => t.time);
  const earliest = withTime.length > 0
    ? withTime.reduce((a, b) => a.time < b.time ? a : b).time.slice(0, 10)
    : null;
  console.log("  Got " + tweets.length + ", earliest: " + earliest);
  return { tweets, earliest };
}

function saveProgress() {
  writeFileSync(PROGRESS_FILE, JSON.stringify({
    collected: [...collected.values()],
    lastUntil: progress.lastUntil,
    done: progress.done
  }, null, 2));
}

async function main() {
  let untilDate = progress.lastUntil;
  const stopDate = "2022-01-30";
  let consecutiveEmpty = 0;

  while (untilDate > stopDate) {
    const { tweets, earliest } = await collectWindow(untilDate);

    let newCount = 0;
    for (const t of tweets) {
      if (!knownHrefs.has(t.href) && !collected.has(t.href)) {
        collected.set(t.href, t);
        newCount++;
      }
    }
    console.log("  New: " + newCount + " | Total: " + collected.size);

    if (tweets.length === 0 || !earliest) {
      consecutiveEmpty++;
      if (consecutiveEmpty >= 3) { console.log("3 empty — done"); break; }
      const d = new Date(untilDate); d.setDate(d.getDate() - 30);
      untilDate = d.toISOString().slice(0, 10);
    } else {
      consecutiveEmpty = 0;
      const d = new Date(earliest); d.setDate(d.getDate() - 1);
      untilDate = d.toISOString().slice(0, 10);
    }

    progress.lastUntil = untilDate;
    saveProgress();
    console.log("  Next: " + untilDate);
    await sleep(rand(15000, 25000));
  }

  const finalData = {
    scrapedAt: new Date().toISOString(),
    totalNew: collected.size,
    note: "Round 2: until-only with 12-pass cap, full content",
    tweets: [...collected.values()]
  };
  writeFileSync(OUT_FILE, JSON.stringify(finalData, null, 2));
  progress.done = true;
  saveProgress();
  console.log("\nDone! " + collected.size + " new tweets -> " + OUT_FILE);
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
