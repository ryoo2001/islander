# 岛岛档案

<br>

> 见面后是更长久的分别。
>
> 她把他冰凉的手贴到自己脸上，没有说话。
> 另一个人认识她三天就"贴了"，然后慢慢稀释，没有断裂。
> 还有人用一笔闲鱼订单把她从消失里拽出来。
>
> 她说：不谈恋爱，在可以预见的将来。

<br>

---

> 关于 [@bohedaouo](https://x.com/bohedaouo)（岛岛 Islander）的数据归档与 AI Skill 工作区。

---

## 项目简介

本仓库是一个以数据为核心的研究工作区，收录岛岛在 X/Twitter 和 Goofish（闲鱼）上的公开内容，以及岛岛与青梅（[@MeiStingray](https://x.com/MeiStingray)）之间互动关系的深度分析。

**没有构建系统**——这是一个数据仓库，配套数据处理脚本和 Claude AI Skill。

---

## 数据结构

```
islander/
├── FACTS.md                  # 唯一真相源（所有已确认事实）
├── CLAUDE.md                 # 项目说明与协作规范
├── bohedao/
│   ├── twitter/              # 岛岛 X/Twitter 归档（schema v2.0）
│   │   ├── bohedaouo_tweets.json       # 全量 2840 条（2022–2026）
│   │   ├── bohedaouo_originals.json    # 原创 734 条
│   │   ├── bohedaouo_replies.json      # 回复 1991 条
│   │   └── bohedaouo_quotes.json       # 引用 127 条
│   └── goofish/              # 闲鱼店铺数据（两家店，共 366 件商品）
├── meistingray/
│   └── meistingray_timeline.json       # 青梅 2688 条推文（schema v2.0）
├── them/
│   ├── interactions.json     # 岛×青互动索引（871 条）
│   ├── threads.json          # 对话线程（443 个）
│   └── REPORT.md             # 岛×青深度研究报告（17 章）
├── hers/daodao/              # 岛岛 persona skill
├── scripts/                  # 数据处理脚本
└── .claude/skills/           # Claude AI Skill 入口
```

---

## AI Skill 使用

在 Claude Code 中调用以下 skill：

| 命令 | 功能 |
|------|------|
| `/daodao` | 扮演岛岛，基于推文 + 闲鱼数据 |
| `/read-daodao` | 第三方视角分析岛岛的回复与行为 |
| `/read-meistingray` | 第三方视角分析青梅 |
| `/read-them` | 研究者视角分析岛×青关系 |

---

## 数据脚本

脚本按顺序执行，可随时重建派生数据：

```bash
node scripts/build_interactions.mjs   # 从两个主文件生成 interactions.json
node scripts/build_threads.mjs        # 从 interactions.json 生成 threads.json
node scripts/build_periods.mjs        # 按时间段切片到 them/periods/
```

---

## FACTS.md 维护协议

`FACTS.md` 是所有已确认事实的唯一来源，所有 skill 文件通过 FACT ID（F001、F200 等）引用，不重复写内容。

- **新发现** → 在对应 ID 区间追加新 FACT 卡片
- **订正** → 在旧卡片底部追加 `CORRECTION:` 行，**不删原文**
- **修改后** → 更新文件头部版本号

| ID 区间 | 内容 |
|---------|------|
| F001–F049 | 岛岛基础信息 |
| F050–F079 | 青梅基础信息 |
| F080–F099 | 汐宝基础信息 |
| F200–F299 | 岛×汐事件 |
| F300–F349 | 岛×青事件 |
| F350–F399 | 青×汐事件 |
| F400–F499 | 理论模型 |
| F500–F599 | 元层 / 误认档案 |
| F600–F699 | 语料库 |

---

## 注意事项

- 图片目录（`bohedao/pics/`、`meistingray/pics/` 等）已 gitignore，不在仓库中
- 私聊截图（`hers/daodao/memories/private_chat/`）已 gitignore
- 新抓取数据放到对应子目录后，需更新 `hers/daodao/meta.json:memory_sources`
