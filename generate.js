#!/usr/bin/env node
/**
 * 知识库工作台 · 发布管道生成脚本
 * 功能：扫描 Obsidian 知识库两个专题 → 生成 data.js + 页面数据
 * 用法：node generate.js [--out 输出目录]
 * 输出：index.html（页面模板读取 data.js）、data.js（动态数据）
 *
 * 数据流（单向，只读 Obsidian）：
 *   Obsidian（正式来源，只读） → 本脚本编译 → 静态站点 → push GitHub → Pages 部署 → 手机访问
 */
const fs = require('fs');
const path = require('path');

// ========== 配置 ==========
const VAULT = '/Users/xucheng/Documents/c 徐的知识库';
const TOPICS = [
  { key: 'agent',     name: 'AI Agent工程知识',        dir: 'AI Agent工程知识',              icon: '🤖', color: 'agent' },
  { key: 'enterprise', name: '企业AI与智能体商业化',    dir: '企业AI与智能体商业化',          icon: '🏢', color: 'enterprise' },
];
const DAILY_DIR = path.join(VAULT, '知识流水线', '每日学习整理');
const OUT_DIR = process.argv.includes('--out')
  ? process.argv[process.argv.indexOf('--out') + 1]
  : '/Users/xucheng/Documents/知识库工作台-publish';

// 排除敏感/非精选文件（白名单策略：只发布学习向内容，跳过原始资料、备份、内部维护页）
const EXCLUDE_PATTERNS = [
  /^原始资料/, /原始资料$/, /资料池/, /蒸馏笔记/, /研究问题/,
  /\.bak/, /\.tmp/, /nohup/, /^日志/, /^全局记忆/,
];

// ========== 工具函数 ==========
function readMDFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(e => e.isFile() && e.name.endsWith('.md'))
    .map(e => path.join(dir, e.name));
}

function parseMD(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const rel = path.relative(VAULT, filePath).replace(/\\/g, '/');

  // frontmatter
  let title = '', updated = '';
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
  if (fmMatch) {
    const fm = fmMatch[1];
    const t = fm.match(/^title:\s*(.+)$/m);
    const u = fm.match(/^updated:\s*([\d-]+)/m);
    const c = fm.match(/^created:\s*([\d-]+)/m);
    if (t) title = t[1].trim().replace(/["']/g, '');
    if (u) updated = u[1].trim();
    else if (c) updated = c[1].trim();
  }
  if (!title) {
    const h1 = raw.match(/^#\s+(.+)$/m);
    if (h1) title = h1[1].trim();
  }
  if (!title) title = path.basename(filePath, '.md');
  if (!updated) {
    const stat = fs.statSync(filePath);
    updated = stat.mtime.toISOString().slice(0, 10);
  }

  // 正文（去掉 frontmatter）
  const body = fmMatch ? raw.slice(fmMatch[0].length) : raw;

  // 链接 [[...]] 与反向链接
  const links = [];
  const linkRe = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g;
  let m;
  while ((m = linkRe.exec(body)) !== null) {
    const target = m[1].trim();
    if (target && !links.includes(target)) links.push(target);
  }

  // 摘要（取正文首个非空段落，去 MD 符号）
  const cleanBody = body.replace(/^---[\s\S]*?---/m, '').trim();
  const para = cleanBody.split(/\n+/).find(l => l.trim() && !l.trim().startsWith('#') && !l.trim().startsWith('>') && !l.trim().startsWith('|'));
  const desc = para
    ? para.replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g, '$1').replace(/[*_`#]/g, '').trim().slice(0, 90)
    : '';

  // 字数
  const wordCount = cleanBody.replace(/\s/g, '').length;

  return { path: rel, title, updated, links, desc, wordCount };
}

function parseDailyFiles() {
  if (!fs.existsSync(DAILY_DIR)) return [];
  return fs.readdirSync(DAILY_DIR, { withFileTypes: true })
    .filter(e => e.isFile() && e.name.endsWith('.md'))
    .map(e => path.join(DAILY_DIR, e.name))
    .sort()
    .reverse(); // 最新在前
}

function parseDaily(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const dateMatch = filePath.match(/(\d{4}-\d{2}-\d{2})/);
  const date = dateMatch ? dateMatch[1] : '';

  const items = [];
  // 解析 "### 2.x 标题" 块
  const secMatch = raw.match(/## 2\. 今天新增了什么([\s\S]*?)(?=\n## \d|$)/);
  const sec = secMatch ? secMatch[1] : '';
  const blockRe = /###\s+([^\n]+)\n([\s\S]*?)(?=\n###|\n## |$)/g;
  let m;
  while ((m = blockRe.exec(sec)) !== null) {
    const title = m[1].trim().replace(/^\d+\.\d+\s*/, '');
    const content = m[2].trim();
    // 提取关键事实/判断行
    const lines = content.split('\n')
      .filter(l => /关键事实|关键概念|关键判断|关键因果关系|新增内容/.test(l))
      .map(l => l.replace(/^[-*]\s*/, '').replace(/^[^：:]+[：:]\s*/, '').trim())
      .filter(Boolean);
    const summary = lines.length ? lines[0].slice(0, 80) : content.replace(/[-*#]/g, '').trim().slice(0, 80);
    items.push({ title, summary, date });
  }

  // 解析 "## 3. 今天最重要的 3 个判断"
  const judgeMatch = raw.match(/## 3\. 今天最重要的[^\n]*([\s\S]*?)(?=\n## \d|$)/);
  const judgments = judgeMatch
    ? judgeMatch[1].split('\n').map(l => l.replace(/^\d+\.\s*/, '').trim()).filter(Boolean).slice(0, 3)
    : [];

  return { date, items, judgments };
}

// ========== 主流程 ==========
function build() {
  const graph = {
    generatedAt: new Date().toISOString().slice(0, 10),
    generatedTime: new Date().toISOString().slice(0, 16).replace('T', ' '),
    topics: [],
    nodes: [],
  };

  const allNodes = [];
  TOPICS.forEach(t => {
    const dir = path.join(VAULT, t.dir);
    const files = readMDFiles(dir);
    const topicNodes = [];
    files.forEach(f => {
      if (EXCLUDE_PATTERNS.some(p => p.test(f))) return;
      const node = parseMD(f);
      node.topic = t.key;
      topicNodes.push(node);
      allNodes.push(node);
    });
    // 按更新时间排序
    topicNodes.sort((a, b) => (b.updated || '').localeCompare(a.updated || ''));
    graph.topics.push({
      name: t.name,
      key: t.key,
      icon: t.icon,
      count: topicNodes.length,
      files: topicNodes.map(n => ({ path: n.path, title: n.title, updated: n.updated, desc: n.desc, wordCount: n.wordCount })),
    });
  });

  // 计算反向链接（只统计两个专题内部）
  const nodeSet = {};
  allNodes.forEach(n => { nodeSet[n.path.replace(/\.md$/, '')] = n; });
  allNodes.forEach(n => {
    n.backlinks = [];
    allNodes.forEach(o => {
      if (o === n) return;
      const targetKey = n.path.replace(/\.md$/, '');
      if (o.links.some(l => l === targetKey || l === n.path)) n.backlinks.push(o.path);
    });
  });
  graph.nodes = allNodes.map(n => ({
    path: n.path, title: n.title, updated: n.updated,
    topic: n.topic, links: n.links, backlinks: n.backlinks, desc: n.desc, wordCount: n.wordCount,
  }));

  // 每日整理
  const dailies = parseDailyFiles().slice(0, 7).map(parseDaily);
  const today = dailies[0] || { date: '', items: [], judgments: [] };

  const data = {
    generatedAt: graph.generatedAt,
    generatedTime: graph.generatedTime,
    sourceIndex: '知识库索引.md',
    digest: today.date ? ('知识流水线/每日学习整理/' + today.date + '｜AI知识增量整理.md') : '知识流水线/每日学习整理',
    topics: graph.topics,
    nodes: graph.nodes,
    today: {
      date: today.date,
      items: today.items,
      judgments: today.judgments,
    },
    dailies,
  };

  // 写 data.js
  const js = 'window.OBSIDIAN_DATA = ' + JSON.stringify(data, null, 1) + ';';
  fs.writeFileSync(path.join(OUT_DIR, 'data.js'), js, 'utf-8');

  // 汇总统计
  const stats = {
    generatedAt: data.generatedAt,
    generatedTime: data.generatedTime,
    topics: graph.topics.map(t => `${t.name}: ${t.count} 篇`),
    todayItems: today.items.length,
    todayJudgments: today.judgments.length,
    dailyFiles: dailies.length,
    totalNodes: graph.nodes.length,
  };
  console.log('✅ 生成完成:', JSON.stringify(stats, null, 2));
}

build();
