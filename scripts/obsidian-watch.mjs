#!/usr/bin/env node
/**
 * obsidian-watch: observe Obsidian vault changes and sync them to Taskboard.
 *
 * Watches a whitelist of knowledge-base folders, then:
 *   R1  If a changed note is linked from a task card (obsidian: label or an
 *       Obsidian path found in the card description), comment on that card and
 *       move done -> in_review so the changed content gets re-reviewed.
 *   R2  With --report-card, summarize today's knowledge changes into a daily
 *       report card in the knowledge-pipeline project.
 *
 * Usage:
 *   node scripts/obsidian-watch.mjs [--window 24] [--apply] [--report-card] [--quiet]
 *
 * Default is dry-run: nothing is written, only planned actions are printed.
 */

import { readdirSync, statSync } from "node:fs";
import path from "node:path";

const VAULT = "/Users/xucheng/Documents/c 徐的知识库";
const API = process.env.CODEX_TASKBOARD_URL || "http://127.0.0.1:47823";
const PROJECT = "knowledge-pipeline";
const THREAD = "codex:obsidian-watch";
const MD = ".md";
const MARK_PREFIX = "obsidian-watch";

const WATCH_DIRS = [
  "AI Agent工程知识",
  "企业AI与智能体商业化",
  "AI产业链与数字基础设施",
  "知识流水线",
  "Codex工作区",
];

const IGNORE_DIRS = new Set([
  ".git",
  ".obsidian",
  ".trash",
  ".DS_Store",
  ".maintenance-backups",
  ".claude",
  ".claudian",
  ".workbuddy",
  "个人档案",
  "个人健康",
  "OpenClaw克里斯记忆库",
]);

function parseArgs(argv) {
  const opts = { window: 24, apply: false, reportCard: false, quiet: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--window") opts.window = Number(argv[++i]) || 24;
    else if (a === "--apply") opts.apply = true;
    else if (a === "--report-card") opts.reportCard = true;
    else if (a === "--quiet") opts.quiet = true;
    else if (a === "--help") {
      console.log(`Usage:
  node scripts/obsidian-watch.mjs [--window 24] [--apply] [--report-card] [--quiet]

--window N     scan changes from the last N hours (default 24)
--apply        write to Taskboard (default is dry-run)
--report-card  create/update a daily knowledge-change report card (needs --apply)
--quiet        only print actions`);
      process.exit(0);
    }
  }
  return opts;
}

function walkChanged(sinceMs, out = []) {
  for (const dir of WATCH_DIRS) {
    walkDir(path.join(VAULT, dir), dir, sinceMs, out);
  }
  return out.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

function walkDir(abs, rel, sinceMs, out) {
  let entries;
  try {
    entries = readdirSync(abs, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const absPath = path.join(abs, entry.name);
    const relPath = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      walkDir(absPath, relPath, sinceMs, out);
    } else if (entry.isFile() && entry.name.endsWith(MD)) {
      try {
        const st = statSync(absPath);
        if (st.mtimeMs >= sinceMs) {
          out.push({
            rel: relPath,
            mtimeMs: st.mtimeMs,
            mtime: st.mtime,
            size: st.size,
          });
        }
      } catch {
        // unreadable file, skip
      }
    }
  }
}

async function api(method, pathname, body) {
  const res = await fetch(`${API}${pathname}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${pathname} -> ${res.status}: ${text.slice(0, 300)}`);
  }
  if (res.status === 204) return {};
  return res.json();
}

function extractLinkedNotes(task) {
  const links = new Set();
  for (const label of task.labels || []) {
    const m = String(label).match(/^obsidian:(.+)$/);
    if (m) links.add(m[1].endsWith(MD) ? m[1] : `${m[1]}${MD}`);
  }
  const pathRe = /([\p{L}\p{N}_\-/ ()（）【】]+\.md)/gu;
  for (const match of (task.description || "").matchAll(pathRe)) {
    links.add(match[1]);
  }
  return links;
}

function mark(rel, mtimeMs) {
  return `${MARK_PREFIX}:${rel}:${mtimeMs}`;
}

function timeStr(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const sinceMs = Date.now() - opts.window * 3600 * 1000;
  const changed = walkChanged(sinceMs);
  const changedRels = new Set(changed.map((c) => c.rel));
  const tasks = (await api("GET", `/api/tasks?projectId=${encodeURIComponent(PROJECT)}`)).tasks;

  const actions = [];
  for (const task of tasks) {
    const linked = [...extractLinkedNotes(task)].filter((rel) => changedRels.has(rel));
    if (linked.length === 0) continue;
    const comments = (await api("GET", `/api/tasks/${encodeURIComponent(task.id)}/comments`)).comments || [];
    const existingMarks = new Set(
      comments.flatMap((c) => [...(c.body || "").matchAll(/obsidian-watch:[^\]]+/g)].map((x) => x[0])),
    );
    for (const rel of linked) {
      const note = changed.find((c) => c.rel === rel);
      if (!note) continue;
      const markId = mark(rel, Math.round(note.mtimeMs));
      if (existingMarks.has(markId)) continue;
      actions.push({ kind: "comment", task, rel, note });
      if (task.status === "done") {
        actions.push({ kind: "reopen", task, rel, note });
      }
    }
  }

  if (!opts.quiet) {
    console.log(`[obsidian-watch] window=${opts.window}h changed=${changed.length} tasks=${tasks.length}`);
  }

  for (const action of actions) {
    const id = action.task.identifier || action.task.id;
    if (action.kind === "comment") {
      const body =
        `[${mark(action.rel, Math.round(action.note.mtimeMs))}] ` +
        `Obsidian 笔记已更新（${timeStr(new Date(action.note.mtimeMs))}）：${action.rel}\n` +
        `内容发生变动，建议复核本卡产出物是否仍成立。`;
      if (opts.apply) {
        await api("POST", `/api/tasks/${encodeURIComponent(action.task.id)}/comments`, { body, threadId: THREAD });
        console.log(`[OK] comment ${id}: 笔记已更新 ${action.rel}`);
      } else {
        console.log(`[DRY] comment ${id}: 笔记已更新 ${action.rel}`);
      }
    } else if (action.kind === "reopen") {
      if (opts.apply) {
        await api("POST", `/api/tasks/${encodeURIComponent(action.task.id)}/move`, {
          status: "in_review",
          threadId: THREAD,
          version: action.task.version,
        });
        console.log(`[OK] reopen ${id}: done -> in_review（${action.rel} 有更新）`);
      } else {
        console.log(`[DRY] reopen ${id}: done -> in_review（${action.rel} 有更新）`);
      }
    }
  }

  if (opts.reportCard && changed.length > 0) {
    const now = new Date();
    const p = (n) => String(n).padStart(2, "0");
    const date = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
    const title = `[感知] 知识变动日报 ${date}`;
    const lines = [`知识底座最近 ${opts.window} 小时新增/修改笔记 ${changed.length} 篇：`, ""];
    for (const note of changed) {
      lines.push(`- ${note.rel}（${timeStr(new Date(note.mtimeMs))}，${note.size}B）`);
    }
    const description = lines.join("\n");
    const existing = tasks.find((t) => t.title === title);
    if (opts.apply) {
      if (existing) {
        await api("PATCH", `/api/tasks/${encodeURIComponent(existing.id)}`, {
          description,
          threadId: THREAD,
          version: existing.version,
        });
        console.log(`[OK] report-card updated: ${title}`);
      } else {
        await api("POST", "/api/tasks", {
          projectId: PROJECT,
          title,
          description,
          status: "backlog",
          priority: "low",
          labels: ["感知", "日报"],
          threadId: THREAD,
        });
        console.log(`[OK] report-card created: ${title}`);
      }
    } else {
      console.log(`[DRY] report-card: ${title}（${changed.length} 篇）`);
    }
  }

  if (!opts.quiet && actions.length === 0) {
    console.log("[obsidian-watch] no linked changes in window");
  }
}

main().catch((err) => {
  console.error(`[obsidian-watch] failed: ${err.message}`);
  process.exit(1);
});
