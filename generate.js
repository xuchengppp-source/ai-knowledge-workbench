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
const WEEKLY_DIR = path.join(VAULT, '知识流水线', '每周知识复盘');
const QUESTION_DIR = path.join(VAULT, '徐总问题专题库');
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

function readMDFilesRecursive(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...readMDFilesRecursive(full));
    else if (e.isFile() && e.name.endsWith('.md') && !EXCLUDE_PATTERNS.some(p => p.test(full))) out.push(full);
  });
  return out;
}

function frontmatterValue(raw, key) {
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return '';
  const match = fmMatch[1].match(new RegExp('^' + key + ':\\s*(.+)$', 'm'));
  return match ? match[1].trim().replace(/^["']|["']$/g, '') : '';
}

function sectionText(raw, heading) {
  const lines = raw.split('\n');
  let start = -1;
  let level = 0;
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(#+)\s+(.+)$/);
    if (match && match[2].includes(heading)) {
      start = i + 1;
      level = match[1].length;
      break;
    }
  }
  if (start < 0) return '';
  const out = [];
  for (let i = start; i < lines.length; i++) {
    const match = lines[i].match(/^(#+)\s+(.+)$/);
    if (match && match[1].length <= level) break;
    out.push(lines[i]);
  }
  return out.join('\n').trim();
}

function stripMd(text, maxLen) {
  const clean = (text || '')
    .replace(/^---[\s\S]*?---/m, '')
    .replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g, '$1')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[>*_`#|-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return maxLen ? clean.slice(0, maxLen) : clean;
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

function parseWeeklyReview() {
  if (!fs.existsSync(WEEKLY_DIR)) return null;
  const files = fs.readdirSync(WEEKLY_DIR, { withFileTypes: true })
    .filter(e => e.isFile() && e.name.endsWith('.md'))
    .map(e => path.join(WEEKLY_DIR, e.name))
    .sort()
    .reverse();
  if (!files.length) return null;
  const filePath = files[0];
  const raw = fs.readFileSync(filePath, 'utf-8');
  const titleMatch = raw.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : path.basename(filePath, '.md');
  const section = (heading) => {
    const match = raw.match(new RegExp('##\\s+\\d+\\.\\s*' + heading + '[\\s\\S]*?(?=\\n##\\s+\\d+\\.|$)'));
    return match ? match[0].replace(/^##[^\n]*\n?/, '').replace(/\s+/g, ' ').trim() : '';
  };
  const overview = section('本周知识增量总览');
  const change = section('本周知识主线发生了什么');
  const dateMatch = raw.match(/^date:\s*(\d{4}-\d{2}-\d{2})/m);
  return {
    title,
    date: dateMatch ? dateMatch[1] : '',
    path: path.relative(VAULT, filePath).replace(/\\/g, '/'),
    overview: overview.slice(0, 220),
    change: change.slice(0, 260),
  };
}

function parseQuestionTopic(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const base = parseMD(filePath);
  const rel = path.relative(VAULT, filePath).replace(/\\/g, '/');
  const originalQuestion = sectionText(raw, '原始提问') || sectionText(raw, '原始提问（逐字保留）');
  const direction = sectionText(raw, '提问方向') || sectionText(raw, '提问方向（徐总真正在问什么）');
  const formalNotes = sectionText(raw, '关联的正式笔记')
    .match(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g) || [];
  const rawMaterials = sectionText(raw, '关联的原始资料')
    .match(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g) || [];
  const distillItems = sectionText(raw, '待蒸馏项').split('\n')
    .map(l => l.trim())
    .filter(l => /^-\s+\[[ xX]\]/.test(l))
    .map(l => l.replace(/^-\s+\[[ xX]\]\s*/, '').replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g, '$1'))
    .slice(0, 8);
  const nextQuestions = (sectionText(raw, '下次可追问的方向') || sectionText(raw, '下一步可追问')).split('\n')
    .map(l => l.trim().replace(/^\d+\.\s*/, '').replace(/^-\s*/, ''))
    .filter(Boolean)
    .slice(0, 8);
  const categoryFromPath = rel.split('/')[1] || frontmatterValue(raw, '所属分类') || '未分类';
  const status = frontmatterValue(raw, '状态') || '已回答';
  const questionType = frontmatterValue(raw, '问题类型') || '';
  const answer = sectionText(raw, '我的回答（核心结构）') || sectionText(raw, '我的回答') || sectionText(raw, '回答摘要');
  const summary = stripMd(answer || direction || originalQuestion || base.desc, 180);
  const directionHtml = mdToHtml(direction);
  const answerHtml = mdToHtml(answer);

  return {
    path: base.path,
    title: base.title.replace(/^\d{4}-\d{2}-\d{2}｜/, ''),
    date: frontmatterValue(raw, 'date') || base.updated,
    updated: base.updated,
    category: categoryFromPath.replace(/^\d+_/, '').replace(/_/g, ' '),
    status,
    questionType,
    originalQuestion: stripMd(originalQuestion, 260),
    direction: stripMd(direction, 260),
    directionHtml,
    summary,
    answerHtml,
    formalNotes: formalNotes.map(x => x.replace(/^\[\[|\]\]$/g, '')).slice(0, 10),
    rawMaterials: rawMaterials.map(x => x.replace(/^\[\[|\]\]$/g, '')).slice(0, 10),
    distillItems,
    nextQuestions,
    links: base.links,
    wordCount: base.wordCount,
    contentHtml: base.contentHtml,
  };
}

function parseQuestionTopics() {
  const files = readMDFilesRecursive(QUESTION_DIR)
    .filter(f => !/00_问题专题库总览\.md$/.test(f))
    .sort()
    .reverse();
  return files.map(parseQuestionTopic);
}

function buildArchitectureLayers(nodes) {
  const layers = [
    ['能源与算力', /能源|算力|GPU|NPU|智算|数据中心|Token工厂/i],
    ['模型与推理', /模型|推理|训练|微调|Token/i],
    ['数据与知识资产', /数据|知识资产|RAG|数据库|知识库/i],
    ['Agent Runtime', /Runtime|Workflow|Agent工程|执行链|状态机/i],
    ['工具与协议', /MCP|Tool|工具调用|Function Calling|API/i],
    ['记忆与上下文', /记忆|Memory|Context|上下文/i],
    ['安全、权限与治理', /权限|安全|治理|审计|合规|人审/i],
    ['评测与可观测性', /评测|观测|Trace|监控|SLA|日志/i],
    ['业务交付与 FDE', /FDE|业务流程|Ontology|企业AI|交付|MVP/i],
    ['商业化与组织能力', /商业化|ROI|组织|经营|结果服务|RaaS/i],
  ];
  return layers.map(([name, pattern]) => {
    const matched = nodes.filter(n => pattern.test(n.title + ' ' + n.desc)).length;
    const status = matched >= 5 ? '已形成' : (matched >= 1 ? '正在形成' : '待补齐');
    return { name, matched, status };
  });
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
  const weeklyReview = parseWeeklyReview();
  const architectureLayers = buildArchitectureLayers(graph.nodes);
  const questionTopics = parseQuestionTopics();

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
    weeklyReview,
    architectureLayers,
    questionTopics,
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
  dataLight.questionTopics = dataLight.questionTopics.map(q => {
    const { contentHtml, ...meta } = q;
    return meta;
  });

  // 正文映射：path -> contentHtml
  const docsMap = {};
  data.nodes.forEach(n => { docsMap[n.path] = n.contentHtml || ''; });
  data.questionTopics.forEach(q => { docsMap[q.path] = q.contentHtml || ''; });

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
    questionTopics: questionTopics.length,
  };
  console.log('✅ 生成完成:', JSON.stringify(stats, null, 2));
}

build();
