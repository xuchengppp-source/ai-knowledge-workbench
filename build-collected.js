#!/usr/bin/env node
/**
 * 采集发现数据生成器
 * 从 AI 电视工作台的来源池与 Feed 生成 collected.js，供知识库工作台「采集发现」页读取。
 *
 * 数据流（只读）：
 *   AI 电视工作台/data/source-pools/*.json  （每轮完整来源池）
 *   AI 电视工作台/data/insight-feed.json    （已上屏卡）
 *   30_资料库/原始资料/                       （已录入原始资料的编号）
 *        ↓
 *   collected.js → index.html / mobile.html「采集发现」
 *
 * 用法：node build-collected.js
 */
const fs = require('fs');
const path = require('path');

const PROJECT = '/Users/xucheng/Documents/Codex项目/AI 电视工作台';
const VAULT = '/Users/xucheng/Documents/c 徐的知识库';
const DATA_DIR = path.join(PROJECT, 'data');
const RAW_DIR = path.join(VAULT, '30_资料库', '原始资料');
const OUT = path.join(__dirname, 'collected.js');

function readJSON(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch (e) { return null; }
}

// 去重键归一化：同一链接只算一条（历史上有全半角冒号/标题微差导致同文重复入库）
function normUrl(u) {
  const s = String(u || '').trim();
  if (!s) return '';
  try {
    const x = new URL(s);
    x.hash = '';
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'spm', 'from', 'from_source', 'share_token', 'shareId'].forEach(k => x.searchParams.delete(k));
    const host = x.hostname.replace(/^www\./, '');
    const p = x.pathname.replace(/\/+$/, '');
    return host + p + (x.search || '');
  } catch (e) { return s.replace(/\/+$/, ''); }
}
function normTitle(t) {
  return String(t || '').toLowerCase()
    .replace(/[：:，,。.、；;！!？?“”"'‘’（）()\[\]【】《》〈〉\-—_·\s]/g, '');
}


// 1) 已录入原始资料的编号
const archived = new Set();
// 未上屏候选按采集编号（C0001…）入库的，同样要标「已入库」，否则回看时会被当候选重复挑。
const archivedCids = new Set();
if (fs.existsSync(RAW_DIR)) {
  for (const name of fs.readdirSync(RAW_DIR)) {
    const m = name.match(/AI-\d{4}-\d{2}/);
    if (m) archived.add(m[0]);
    const c = name.match(/C\d{4}/);
    if (c) archivedCids.add(c[0]);
  }
}

// 2) Feed：编号 → 卡片信息
const feed = readJSON(path.join(DATA_DIR, 'insight-feed.json')) || { items: [] };
const removed = readJSON(path.join(DATA_DIR, 'feed-removed-archived.json')) || { items: [] };
const feedByUrl = {};
const feedByTitle = {};
for (const item of feed.items || []) {
  const src = (item.sources || [])[0] || {};
  const rec = {
    displayId: item.displayId,
    priority: item.priority,
    summary: item.takeaway || item.signal || '',
    why: item.whyItMatters || '',
    archived: archived.has(item.displayId),
  };
  if (src.url) feedByUrl[normUrl(src.url)] = rec;
  if (item.title) feedByTitle[normTitle(item.title)] = rec;
}
// 已录入原始资料并从 Feed 移出的卡片，仍要标出「已入库」，避免看漏或重复挑
for (const item of removed.items || []) {
  const rec = {
    displayId: item.displayId,
    priority: item.priority,
    summary: '',
    why: '',
    archived: true,
  };
  if (item.matchedArchivedUrl) feedByUrl[normUrl(item.matchedArchivedUrl)] = rec;
  if (item.title) feedByTitle[normTitle(item.title)] = rec;
}

// 2.5) 采集编号：给每条采集记录一个稳定短号（C0001…），录入时按号指认，不必复述标题。
// 编号一经分配永不改号（map 只增不减），避免历史指认失效。
const ID_MAP_FILE = path.join(__dirname, 'collected-id-map.json');
const idMap = readJSON(ID_MAP_FILE) || {};
let idSeq = 0;
for (const v of Object.values(idMap)) {
  const n = parseInt(String(v).slice(1), 10);
  if (n > idSeq) idSeq = n;
}
function cidOf(url) {
  if (!url) return '';
  if (idMap[url]) return idMap[url];
  idSeq += 1;
  const v = 'C' + String(idSeq).padStart(4, '0');
  idMap[url] = v;
  return v;
}

// 3) 合并全部来源池（跨轮去重）
// Codex 的判定回写文件（公众号待评清单的答案）：键为 cid
const DECISIONS_FILE = path.join(DATA_DIR, 'codex-review-decisions.json');
let codexDecisions = {};
try {
  if (fs.existsSync(DECISIONS_FILE)) codexDecisions = JSON.parse(fs.readFileSync(DECISIONS_FILE, 'utf-8')) || {};
} catch (e) { codexDecisions = {}; }

const poolDir = path.join(DATA_DIR, 'source-pools');
const files = fs.existsSync(poolDir)
  ? fs.readdirSync(poolDir).filter(f => f.endsWith('.json')).sort()
  : [];
const seen = new Map();
const rounds = [];
let rawTotal = 0;
let dupMerged = 0;

// 采集渠道分档：公众号清单（星标关注号）优先，其次搜狗补充，最后通用网页扩展。
// 徐总 2026-11-26 明确：采集顺序是公众号星标在前，扩展渠道在后，页面呈现必须按这个优先级。
const PRIORITY_RANK = { P1: 1, P2: 2, P3: 3 };
// 号主页占位/无新内容，不是文章，不进待评队列
const PLACEHOLDER_RE = /主页|常看流|推送列表|无新内容|暂无文章|未发现新稿/;
function tierOf(channel) {
  const c = String(channel || '');
  if (c.indexOf('公众号清单') === 0) return 'wechat';
  if (c.indexOf('搜狗') === 0) return 'sogou';
  return 'web';
}
function rankOf(priority, hasFeed, decision, tier) {
  if (PRIORITY_RANK[priority]) return PRIORITY_RANK[priority];
  if (hasFeed) return 4;
  // 徐总 2026-11-26 明确：公众号星标的文章由伊森全量梳理出来即可，谁候选、谁上屏交给 Codex 评。
  // 因此公众号来源一律 rank 5（默认可见），不再因历史 background/excluded 判定被藏起来。
  if (tier === 'wechat') return 5;
  if (decision === 'candidate') return 5;
  return 9; // 扩展渠道的背景 / 排除：默认隐藏，只在「全部」里看
}

for (const f of files) {
  const d = readJSON(path.join(poolDir, f));
  if (!d) continue;
  const srcs = d.sources || [];
  rawTotal += srcs.length;
  const runId = d.runId || f.replace(/\.json$/, '');
  let added = 0;
  for (const s of srcs) {
    const key = normUrl(s.canonicalUrl) || ('T:' + normTitle(s.title));
    if (seen.has(key)) { dupMerged++; continue; }
    if (s.dedup === 'duplicate' || s.decision === 'duplicate') continue;
    const card = feedByUrl[normUrl(s.canonicalUrl)] || feedByTitle[normTitle(s.title)] || null;
    const rec = {
      title: s.title || '',
      publisher: s.publisher || '',
      date: (s.publishedDate || '').slice(0, 10),
      channel: s.discoveryChannel || '',
      tier: tierOf(s.discoveryChannel),
      decision: s.decision || '',
      reason: s.excludeReason || '',
      url: s.canonicalUrl || '',
      cid: cidOf(normUrl(s.canonicalUrl) || ('T:' + normTitle(s.title))),
      readStatus: s.readStatus || '',
      displayId: card ? card.displayId : '',
      priority: card ? card.priority : '',
      summary: card ? card.summary : '',
      round: runId,
      // 公众号来源：只要梳理出来就算待评，判定权在 Codex，不在伊森。
      reviewOwner: tierOf(s.discoveryChannel) === 'wechat' ? 'codex' : '',
      myPriorDecision: s.decision || '', // 保留我原来的判定留痕，仅供 Codex 参考，不作为过滤依据
      placeholder: tierOf(s.discoveryChannel) === 'wechat' && PLACEHOLDER_RE.test(String(s.title || '')) ? true : false,
    };
    if (card && (card.archived || archived.has(card.displayId))) rec.archived = true;
    else rec.archived = false;
    if (rec.cid && archivedCids.has(rec.cid)) rec.archived = true;
    rec.rank = rankOf(rec.priority, !!rec.displayId, rec.decision, rec.tier);
    // Codex 的判定（若已回写）优先于我的历史判定展示
    const cdec = rec.cid ? codexDecisions[rec.cid] : null;
    if (cdec) {
      rec.codexDecision = cdec.decision || '';
      rec.codexPriority = cdec.priority || '';
      rec.codexNote = cdec.note || '';
    }
    seen.set(key, rec);
    added++;
  }
  const cnt = { candidate: 0, background: 0, excluded: 0 };
  for (const s of srcs) if (cnt[s.decision] !== undefined) cnt[s.decision]++;
  rounds.push({ runId, file: f, total: srcs.length, added, ...cnt });
}

const items = Array.from(seen.values());
// 排序：有日期的按日期倒序，未知日期靠后；同日按编号倒序
items.sort((a, b) => {
  const da = a.date || '0000';
  const db = b.date || '0000';
  if (da !== db) return db.localeCompare(da);
  return String(b.displayId || '').localeCompare(String(a.displayId || ''));
});

const stat = {
  all: items.length,
  mergedDuplicates: dupMerged,
  onFeed: items.filter(x => x.displayId).length,
  archived: items.filter(x => x.archived).length,
  notOnFeed: items.filter(x => !x.displayId).length,
  candidate: items.filter(x => x.decision === 'candidate').length,
  background: items.filter(x => x.decision === 'background').length,
  excluded: items.filter(x => x.decision === 'excluded').length,
  // 重要：已上屏（Feed 通过两道门）或来源池判为候选
  important: items.filter(x => x.rank <= 5).length,
  p1: items.filter(x => x.priority === 'P1').length,
  p2: items.filter(x => x.priority === 'P2').length,
  wechat: items.filter(x => x.tier === 'wechat').length,
  // 公众号全量：梳理出来就算数，不看历史判定（徐总 2026-11-26 口径）
  wechatAll: items.filter(x => x.tier === 'wechat' && !x.placeholder).length,
  wechatImportant: items.filter(x => x.tier === 'wechat' && x.rank <= 5).length,
  // 待 Codex 评：公众号来源里还没上屏、也没入库的
  wechatPendingReview: items.filter(x => x.tier === 'wechat' && !x.placeholder && !x.displayId && !x.archived).length,
  sogou: items.filter(x => x.tier === 'sogou').length,
  web: items.filter(x => x.tier === 'web').length,
  webImportant: items.filter(x => x.tier === 'web' && x.rank <= 5).length,
};

function localStamp() {
  const d = new Date(Date.now() + 8 * 3600 * 1000); // 东八区
  const p = n => String(n).padStart(2, '0');
  return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate()) +
    ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes());
}

const out = {
  schemaVersion: 1,
  generatedAt: localStamp(),
  sourceRounds: rounds.length,
  rawTotal,
  mergedDuplicates: dupMerged,
  feedRunId: feed.runId || '',
  feedGeneratedAt: feed.generatedAt || '',
  stat,
  rounds,
  items,
};

fs.writeFileSync(OUT, 'window.OBSIDIAN_COLLECTED = ' + JSON.stringify(out) + ';\n', 'utf-8');

// 给 Codex 的待评队列：公众号星标全量梳理清单。
// 分工（徐总 2026-11-26 拍板）：伊森只负责"梳理出来"（抓全、去重、编号、给链接），
// 谁进候选、谁上屏由 Codex 判。Codex 把判定写进 codex-review-decisions.json，本文件下次重建时带出来。
const reviewQueue = items
  .filter(x => x.tier === 'wechat' && !x.placeholder)
  .map(x => {
    const dec = codexDecisions[x.cid] || null;
    return {
      cid: x.cid,
      title: x.title,
      publisher: x.publisher,
      date: x.date,
      url: x.url,
      channel: x.channel,
      round: x.round,
      readStatus: x.readStatus,
      onFeed: x.displayId || '',
      archived: !!x.archived,
      myPriorDecision: x.myPriorDecision || '',  // 仅供参考，不作判定
      codexDecision: dec ? (dec.decision || '') : '',
      codexPriority: dec ? (dec.priority || '') : '',
      codexNote: dec ? (dec.note || '') : '',
      codexReviewedAt: dec ? (dec.reviewedAt || '') : '',
    };
  })
  .sort((a, b) => {
    const da = a.date || '0000', db = b.date || '0000';
    if (da !== db) return db.localeCompare(da);
    return String(a.cid).localeCompare(String(b.cid));
  });

const queueOut = {
  schemaVersion: 1,
  generatedAt: localStamp(),
  owner: 'codex',
  note: '星标公众号全量梳理清单，伊森只梳理不淘汰。Codex 判定写进 data/codex-review-decisions.json，键为 cid，值形如 {"decision":"feed|candidate|background|excluded","priority":"P1|P2|P3","note":"理由","reviewedAt":"2026-11-27"}。',
  count: reviewQueue.length,
  unreviewed: reviewQueue.filter(x => !x.codexDecision).length,
  items: reviewQueue,
};
fs.writeFileSync(path.join(DATA_DIR, 'codex-review-queue.json'), JSON.stringify(queueOut, null, 1), 'utf-8');


// 采集编号映射回写（键排序，diff 稳定；只增不减）
const sortedMap = {};
Object.keys(idMap).sort().forEach(k => { sortedMap[k] = idMap[k]; });
fs.writeFileSync(ID_MAP_FILE, JSON.stringify(sortedMap, null, 1), 'utf-8');

// 每次生成后刷新两页的 collected.js 版本号，避免浏览器读旧缓存
const stamp = out.generatedAt.replace(/[-: ]/g, '');
for (const page of ['index.html', 'mobile.html']) {
  const p = path.join(__dirname, page);
  if (!fs.existsSync(p)) continue;
  const html = fs.readFileSync(p, 'utf-8');
  const next = html.replace(/collected\.js\?v=\d+/g, 'collected.js?v=' + stamp);
  if (next !== html) fs.writeFileSync(p, next, 'utf-8');
}

const kb = (fs.statSync(OUT).size / 1024).toFixed(0);
console.log('written', OUT, kb + 'KB');
console.log('rounds', rounds.length, '| raw', rawTotal, '| unique', stat.all);
console.log('onFeed', stat.onFeed, '| archived', stat.archived, '| notOnFeed', stat.notOnFeed);
