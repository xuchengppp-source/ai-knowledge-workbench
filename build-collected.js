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
if (fs.existsSync(RAW_DIR)) {
  for (const name of fs.readdirSync(RAW_DIR)) {
    const m = name.match(/AI-\d{4}-\d{2}/);
    if (m) archived.add(m[0]);
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
function tierOf(channel) {
  const c = String(channel || '');
  if (c.indexOf('公众号清单') === 0) return 'wechat';
  if (c.indexOf('搜狗') === 0) return 'sogou';
  return 'web';
}
function rankOf(priority, hasFeed, decision) {
  if (PRIORITY_RANK[priority]) return PRIORITY_RANK[priority];
  if (hasFeed) return 4;
  if (decision === 'candidate') return 5;
  return 9; // 背景 / 排除：默认隐藏，只在「全部」里看
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
    };
    if (card && (card.archived || archived.has(card.displayId))) rec.archived = true;
    else rec.archived = false;
    rec.rank = rankOf(rec.priority, !!rec.displayId, rec.decision);
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
  wechatImportant: items.filter(x => x.tier === 'wechat' && x.rank <= 5).length,
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
