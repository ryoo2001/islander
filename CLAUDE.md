# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Archive + data-collection workspace focused on **@bohedaouo** (岛岛 Islander) across X/Twitter and Goofish (闲鱼). No build system — this is a data repo with scraping tooling.

**Downstream consumers** (all skills under `.claude/skills/`):
- `/daodao` — 扮演岛岛
- `/read-daodao` — 第三方视角分析岛岛
- `/read-meistingray` — 第三方视角分析青梅
- `/read-them` — 研究者视角分析岛×青关系

## ⭐ Single Source of Truth — `FACTS.md`

**`D:/islander/FACTS.md` 是关于岛岛、青梅、汐宝所有已确认事实的唯一真相源。** 所有 persona / memory / skill 文件都引用 FACT ID（F001、F200 等），不重复写事实内容。

**更新协议**：
1. 新发现 → 往 `FACTS.md` 加一张新 FACT 卡片（在对应 ID 区间取下一个编号）
2. 订正 → 在旧卡片底部追加 `CORRECTION:` 行，**不删原文**
3. 修改 `FACTS.md` 头部版本号
4. 其他文件下次加载时自动同步（它们会先读 FACTS.md）

**ID 区间**：
- `F001-F049` 岛岛基础
- `F050-F079` 青梅基础
- `F080-F099` 汐宝基础
- `F200-F299` 岛×汐事件
- `F300-F349` 岛×青事件
- `F350-F399` 青×汐事件
- `F400-F499` 理论模型
- `F500-F599` 元层 / 误认档案
- `F600-F699` 语料库

**新抓取数据**放到对应子目录 —— Twitter 数据 → `bohedao/twitter/`，Goofish 数据 → `bohedao/goofish/`，图片 → `bohedao/pics/`。**新的人物/关系事实**要进 FACTS.md 而不是分散到各个 skill 文件里。

## Data layout

```
D:\islander\
├── FACTS.md              # 唯一真相源
├── CLAUDE.md
├── bohedao/              # 岛岛原始数据（对齐 meistingray/ 结构）
│   ├── twitter/          # bohedaouo_*.{json,md} — schema v2.0
│   ├── goofish/
│   │   ├── *.json        # goofish_*.json × 3
│   │   └── pics/         # 177 个产品图集
│   └── pics/
│       ├── x_pic/        # X/Twitter 媒体 247 张
│       └── telegram/     # Telegram 导出 13 张
├── hers/daodao/          # 岛岛 persona skill
├── meistingray/          # 青梅个人数据 + pics/ — schema v2.0
├── them/                 # 岛×青 共同数据
│   ├── interactions.json # 互动索引（从主文件派生，871 条）
│   ├── REPORT.md/docx/pdf  # 岛×青深度研究报告（17 章）
│   └── pdf-config.json / pdf-style.css
├── scripts/              # 数据处理脚本
├── archive/              # 旧版本归档 + 去重前备份
└── .claude/skills/       # 所有 skill 入口
```

### X/Twitter archive (`bohedao/twitter/`)
Four topic-split JSON files (schema v2.0, deduplicated 2026-05-14). Each also has a `.md` human-readable version.

| File | Contents |
|------|----------|
| `bohedaouo_tweets.json` | Full archive — 2840 unique tweets, 2022-01-31 to 2026-05-06 |
| `bohedaouo_originals.json` | 原创 (734) |
| `bohedaouo_replies.json` | 回复 (1991) |
| `bohedaouo_quotes.json` | 引用 (127) |

Tweet JSON shape (schema v2.0):
```json
{
  "href": "https://x.com/bohedaouo/status/...",
  "text": "...", "fullText": "...",
  "time": "2026-01-01T00:00:00.000Z",
  "type": "original | reply | quote",
  "stats": { "replies": 0, "retweets": 0, "likes": 0, "views": 0 },
  "images": ["https://pbs.twimg.com/media/..."],
  "hasVideo": false,
  "replyTo": "username | null", "replyToStatusId": "...",
  "quotedId": "...", "quotedScreenName": "...", "quotedText": "...",
  "source": "timeline | search_r1 | search_r2"
}
```

File header shape (both 岛岛 and 青梅):
```json
{
  "account": "bohedaouo | MeiStingray",
  "schema_version": "2.0",
  "scrapedAt": "...",
  "deduplicatedAt": "...",
  "coverage": { "earliest": "...", "latest": "...", "ownTweetCount": 2840, "note": "..." },
  "total": 2840,
  "tweets": [...]
}
```

### 青梅 Twitter archive (`meistingray/`)

| File | Contents |
|------|----------|
| `meistingray_timeline.json` | 2688 tweets, 2024-01-30 to 2026-05-11 (schema v2.0, enriched via Syndication API) |

青梅 tweet schema 与岛岛完全对齐（replyTo/type/stats/images 均已通过 Syndication API 补全）。额外保留 `hasPhoto` 布尔字段。类型分布：694 原创 / 1959 回复 / 31 引用。

### Goofish (闲鱼) archive (`bohedao/goofish/`)
Two stores owned by 岛岛. Each store has a `_full.json` (detail pass); store 1 also has a `_links.json` (listing pass).

| File | Store | Products |
|------|-------|----------|
| `goofish_links.json` / `goofish_daodao_full.json` | 岛岛Islander (userId `2983324902`) — handmade crochet main shop | 177 |
| `goofish_daodao2_full.json` | 岛Islander出物用 (userId `2948713792`) — second-hand/出物 alt | 189 |

`_full.json` top-level: `{ seller: {name, userId, location, profileUrl, bio?, scrapedAt}, totalProducts, products: [...] }`. Product entries add `price` and `desc` on top of the link-level fields.

### Media directories

| Dir | Count | Source | Naming |
|-----|-------|--------|--------|
| `bohedao/pics/x_pic/` | 247 | X media timeline | `NNNN_mediaId.jpg` |
| `bohedao/pics/telegram/` | 13 | Telegram export | `photo_N_YYYY-MM-DD_HH-MM-SS.jpg` |
| `bohedao/goofish/pics/<productId>/` | 177 dirs | Goofish product galleries | `N.jpg` per product |
| `meistingray/pics/` | 10 | 青梅截图 | mixed |

When adding X-CDN images, upgrade to original resolution by appending `?format=jpg&name=orig` to `pbs.twimg.com/media/` URLs.

### Interaction data (`them/`)

| File | Contents |
|------|----------|
| `interactions.json` | 岛×青互动索引 — 871 条，2023-08-12 to 2025-10-13（schema v2.1，含 replyToStatusId/targetTime） |
| `threads.json` | 对话线程 — 443 个线程（按回复链+24h窗口重建，含完整对话上下文） |
| `periods/` | 六期时间段切片（initiation/mutual/cooling/recovery/peak/collapse） |
| `REPORT.md/docx/pdf` | 岛×青深度研究报告（17 章） |

`interactions.json` 由 `scripts/build_interactions.mjs` 从两个主文件生成，可随时重建。`threads.json` 由 `scripts/build_threads.mjs` 从 interactions.json 派生。`periods/` 由 `scripts/build_periods.mjs` 按时间段切片。三个脚本可按顺序重跑：`build_interactions` → `build_threads` → `build_periods`。

旧的 `bohedaouo_to_meistingray.json` / `meistingray_to_bohedaouo.json` / `interactions_complete.json` 已归档到 `archive/them_pre_rebuild/`。

## Persona skill (`hers/daodao/`)

Invoke with `/daodao`. Generated via the `create-her` skill (predecessor: removed `exes/daodao/` from `create-ex`). Reads the tweet/goofish JSONs and image directories as memory sources (see `meta.json:memory_sources`). Structure:

| Path | Role |
|------|------|
| `SKILL.md` | Invocation contract + interaction guidelines |
| `persona.md` | Character sheet (Layer 0–5: identity, language, emotion, relationship, taboos) |
| `memory.md` | Evolving relationship memory |
| `memories/private_chat/` | Private chat screenshots (primary evidence, highest priority) |
| `meta.json` | Profile metadata (version, relationship, naming, health, memory_sources) |
| `versions/` | Snapshots on major revisions |

**Update workflow:**
- Corrections → append to `persona.md` / `memory.md` "Correction 记录" section; never edit the main body
- After any edit → update `meta.json:updated_at` and increment `corrections_count`
- Major revision → snapshot current files into `versions/vX.X_<tag>/` before changing
- New scraped file → add path to `meta.json:memory_sources`

**Evidence priority** (highest → lowest): private chat screenshots → 芒丁 replies (healthy-period reference) → public tweets → Goofish. Default roleplay is the low-period version.

## Data collection (`web-access` skill)

CDP browser automation via a local proxy on `http://localhost:3456`. Start + dep-check in one step:
```bash
node "D:/islander/.claude/skills/web-access/scripts/check-deps.mjs"
```

Full proxy API:
```bash
curl -s "http://localhost:3456/targets"                              # list open tabs
curl -s "http://localhost:3456/new?url=URL"                         # open tab, returns targetId
curl -s "http://localhost:3456/info?target=ID"                      # page title + URL
curl -s -X POST "http://localhost:3456/eval?target=ID" -d 'JS'      # run JS in tab
curl -s "http://localhost:3456/screenshot?target=ID&file=/tmp/s.png"
curl -s "http://localhost:3456/navigate?target=ID&url=URL"
curl -s "http://localhost:3456/back?target=ID"
curl -s -X POST "http://localhost:3456/click?target=ID" -d 'CSS'    # JS el.click()
curl -s -X POST "http://localhost:3456/clickAt?target=ID" -d 'CSS'  # real mouse event
curl -s -X POST "http://localhost:3456/setFiles?target=ID" -d '{"selector":"input[type=file]","files":["/path"]}'
curl -s "http://localhost:3456/scroll?target=ID&direction=bottom"
curl -s "http://localhost:3456/close?target=ID"
```

### Site-specific gotchas
- **X/Twitter** uses virtual scrolling — only ~10–40 tweets are in the DOM at once. Accumulate across passes with a persistent `window.__mediaUrls = new Set()`; stop when 3 consecutive scroll passes yield no new URLs.
- **Goofish** listings are also virtualized. The link pass should dedupe by `id`; the full pass opens each product URL and extracts `price` + `desc` from the detail view. Image URLs use `img.alicdn.com` (WebP thumbs); for product galleries, save as `goofish_pics/<productId>/N.jpg`.
- Some sites flag automation aggressively; the `web-access` skill includes mitigations but not guarantees — warn the user before heavy scraping.
- **New data goes to** `bohedao/twitter/` or `bohedao/goofish/` (not root). Update `hers/daodao/meta.json:memory_sources` after adding new files.
