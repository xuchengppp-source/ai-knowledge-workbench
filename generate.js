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
  { key: 'infrastructure', name: 'AI产业链与数字基础设施', dir: 'AI产业链与数字基础设施', icon: '⚡', color: 'enterprise' },
];
const DAILY_DIR = path.join(VAULT, '知识流水线', '每日学习整理');
const OUT_DIR = process.argv.includes('--out')
  ? process.argv[process.argv.indexOf('--out') + 1]
  : '/Users/xucheng/Documents/知识库工作台-publish';

// 排除敏感/非精选文件（白名单策略：只发布学习向内容，跳过原始资料、备份、内部维护页）
const EXCLUDE_PATTERNS = [
  /原始资料/, /资料池/, /蒸馏笔记/, /研究问题/,
  /\.bak/, /\.tmp/, /nohup/, /日志/, /全局记忆/, /^\./,
];

// ========== 工具函数 ==========
function readMDFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(e => e.isFile() && e.name.endsWith('.md'))
    .filter(e => !EXCLUDE_PATTERNS.some(p => p.test(e.name)))
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

  // 完整正文（MD → HTML）
  const contentHtml = mdToHtml(body);

  // 字数
  const wordCount = cleanBody.replace(/\s/g, '').length;

  return { path: rel, title, updated, links, desc, wordCount, contentHtml };
}

/**
 * 轻量 MD → HTML 转换器
 * 支持：#/##/### 标题、- 列表、> 引用、``` 代码块、表格、**加粗**、[[wiki链接]]、水平线
 */
function mdToHtml(md) {
  if (!md) return '';
  let text = md.replace(/^---[\s\S]*?---/m, '').trim();
  // 移除 YAML 之后的空行前导
  let html = '';
  let inCode = false;
  let inList = false;
  let inTable = false;
  const lines = text.split('\n');
  const esc = (s) => s
    .replace(/\uFFFD+/g, '?') // 源文件损坏字符 → 占位
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // wiki 链接 → 纯文本
    .replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g, '$1')
    // 加粗
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/__([^_]+)__/g, '<b>$1</b>')
    // 行内代码
    .replace(/`([^`]+)`/g, '<code style="background:#EEF1F8;padding:1px 5px;border-radius:4px;font-size:0.9em;color:#2563EB;">$1</code>');

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const t = line.trim();

    // 代码块
    if (t.startsWith('```')) {
      if (!inCode) { html += '<pre style="background:#0F1B33;color:#D8E2F5;border-radius:12px;padding:14px;font-size:12.5px;line-height:1.7;overflow-x:auto;margin:14px 0;white-space:pre-wrap;word-break:break-word;">'; inCode = true; }
      else { html += '</pre>'; inCode = false; }
      continue;
    }
    if (inCode) { html += esc(line) + '\n'; continue; }

    // 表格行
    if (t.startsWith('|') && t.endsWith('|')) {
      if (!inTable) { html += '<div style="overflow-x:auto;margin:14px 0;"><table style="width:100%;border-collapse:collapse;font-size:12.5px;"><tbody>'; inTable = true; }
      // 分隔行 |---|---| 跳过
      if (/^\|[\s:|-]+\|$/.test(t) && t.includes('-')) continue;
      const cells = t.replace(/^\||\|$/g, '').split('|').map(c => esc(c.trim()));
      html += '<tr>' + cells.map(c => '<td style="border:1px solid #E3E8F0;padding:6px 10px;color:#47536B;line-height:1.6;">' + c + '</td>').join('') + '</tr>';
      continue;
    }
    if (inTable && !t.startsWith('|')) { html += '</tbody></table></div>'; inTable = false; }

    // 标题
    if (/^###\s/.test(t)) { html += '<h3 style="font-size:15px;font-weight:700;margin:20px 0 8px;color:#1E3A5F;">' + esc(t.replace(/^###\s+/, '')) + '</h3>'; continue; }
    if (/^##\s/.test(t)) { html += '<h2 style="font-size:16px;font-weight:700;margin:22px 0 10px;color:#1E3A5F;">' + esc(t.replace(/^##\s+/, '')) + '</h2>'; continue; }
    if (/^#\s/.test(t)) { html += '<h1 style="font-size:19px;font-weight:800;margin:18px 0 10px;color:#16233B;">' + esc(t.replace(/^#\s+/, '')) + '</h1>'; continue; }

    // 列表
    if (/^[-*]\s/.test(t) || /^\d+\.\s/.test(t)) {
      if (!inList) { html += '<ul style="margin:10px 0 14px;padding-left:20px;">'; inList = true; }
      html += '<li style="font-size:14px;line-height:1.85;color:#47536B;margin-bottom:6px;">' + esc(t.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, '')) + '</li>';
      continue;
    }
    if (inList && !/^[-*]\s/.test(t) && !/^\d+\.\s/.test(t)) { html += '</ul>'; inList = false; }

    // 引用
    if (t.startsWith('>')) {
      html += '<blockquote style="background:#EAF1FE;border-left:3px solid #2563EB;border-radius:0 10px 10px 0;padding:12px 14px;margin:14px 0;font-size:13.5px;line-height:1.8;color:#1E3A5F;">' + esc(t.replace(/^>\s*/, '')) + '</blockquote>';
      continue;
    }

    // 水平线
    if (/^(-{3,}|\*{3,})$/.test(t)) { html += '<hr style="border:none;border-top:1px solid #E3E8F0;margin:18px 0;">'; continue; }

    // 空行
    if (!t) continue;

    // 普通段落
    html += '<p style="font-size:14.5px;line-height:1.85;color:#47536B;margin-bottom:12px;">' + esc(t) + '</p>';
  }
  if (inCode) html += '</pre>';
  if (inList) html += '</ul>';
  if (inTable) html += '</tbody></table></div>';
  return html;
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
  // 兼容两种小节格式：### 2.1 标题（旧） / 1. 标题（新，有序列表）
  const secMatch = raw.match(/## 2\. 今天新增了什么([\s\S]*?)(?=\n## \d|$)/);
  const sec = secMatch ? secMatch[1] : '';
  // 分离出有序列表条目：标题行（含后续行直到下一个条目/空行）
  const itemBlocks = [];
  const lines = sec.split('\n');
  let cur = null;
  lines.forEach(line => {
    const tm = line.match(/^\s*(?:###\s+)?(\d+\.\d*)\s*(.*)$/);
    if (tm && tm[2] && tm[2].trim()) {
      if (cur) itemBlocks.push(cur);
      cur = { title: tm[2].trim(), body: [] };
    } else if (cur) {
      cur.body.push(line);
    }
  });
  if (cur) itemBlocks.push(cur);

  itemBlocks.forEach(b => {
    const content = b.body.join('\n').trim();
    // 提取关键事实/判断行
    const lines2 = content.split('\n')
      .filter(l => /关键事实|关键概念|关键判断|关键因果关系|新增内容|事实：|概念：|因果关系：/.test(l))
      .map(l => l.replace(/^[-*]\s*/, '').replace(/^[^：:]+[：:]\s*/, '').trim())
      .filter(Boolean);
    const summary = lines2.length ? lines2[0].slice(0, 90) : content.replace(/[-*#]/g, '').trim().slice(0, 90);
    // 完整要点列表（该小节所有 - 或 事实/概念/因果 开头的行）
    const points = content.split('\n')
      .filter(l => /^[-*]\s/.test(l.trim()) || /^(事实|概念|因果关系|关键判断)[：:]/.test(l.trim()))
      .map(l => l.trim().replace(/^[-*]\s*/, '').replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g, '$1').slice(0, 120))
      .filter(Boolean)
      .slice(0, 6);
    items.push({ title: b.title, summary, points, date });
  });

  // 解析 "## 3. 今天最重要的 3 个判断"
  const judgeMatch = raw.match(/## 3\. 今天最重要的[^\n]*([\s\S]*?)(?=\n## \d|$)/);
  const judgments = judgeMatch
    ? judgeMatch[1].split('\n').map(l => l.replace(/^\d+\.\s*/, '').replace(/\*\*/g, '').trim()).filter(Boolean).slice(0, 3)
    : [];

  return { date, items, judgments };
}

function nowInChina() {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai', hour12: false }).replace(' ', 'T');
}

// ========== 主流程 ==========
function build() {
  const nowChina = nowInChina();
  const graph = {
    generatedAt: nowChina.slice(0, 10),
    generatedTime: nowChina.slice(0, 16).replace('T', ' '),
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
    contentHtml: n.contentHtml,
  }));

  const recentCutoff = Date.parse(graph.generatedAt + 'T00:00:00+08:00') - 6 * 24 * 60 * 60 * 1000;
  const recentNodes = graph.nodes.filter(n => Date.parse(n.updated + 'T00:00:00+08:00') >= recentCutoff);
  const recentLinks = new Set();
  recentNodes.forEach(n => n.links.forEach(link => recentLinks.add(n.path + '→' + link)));

  // 每日整理
  const dailies = parseDailyFiles().slice(0, 7).map(parseDaily);
  const today = dailies[0] || { date: '', items: [], judgments: [] };

  const data = {
    generatedAt: graph.generatedAt,
    generatedTime: graph.generatedTime,
    rootTitle: '徐总的知识库',
    weeklyPages: recentNodes.length,
    weeklyChanges: recentLinks.size,
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

  // 拆分：data.js 只放元数据（不含正文，首屏秒开），docs.js 放正文（延迟加载）
  const dataLight = JSON.parse(JSON.stringify(data));
  dataLight.nodes = dataLight.nodes.map(n => {
    const { contentHtml, ...meta } = n;
    return meta;
  });
  dataLight.topics = dataLight.topics.map(t => {
    const { files, ...meta } = t;
    return { ...meta, count: files ? files.length : 0 };
  });

  // 正文映射：path -> contentHtml
  const docsMap = {};
  data.nodes.forEach(n => { docsMap[n.path] = n.contentHtml || ''; });

  // 写 data.js（轻数据）
  const js = 'window.OBSIDIAN_DATA = ' + JSON.stringify(dataLight, null, 1) + ';';
  fs.writeFileSync(path.join(OUT_DIR, 'data.js'), js, 'utf-8');

  // 写 docs.js（正文，延迟加载）
  const docsJs = 'window.OBSIDIAN_DOCS = ' + JSON.stringify(docsMap) + ';';
  fs.writeFileSync(path.join(OUT_DIR, 'docs.js'), docsJs, 'utf-8');

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
