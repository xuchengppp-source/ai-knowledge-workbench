#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
候选未上屏 · 飞书提醒

背景（徐总 2026-11-26）："如果仅仅是把它放为候选未上屏，我就有可能读不到。"
每 2 小时的采集任务只推 P1/P2 上屏卡，判为候选但没进 Feed 的文章没人提醒。
本脚本独立于模型判断，直接读 collected.js 里的候选清单，按 C 编号推送。

规则：
- 只推 decision=candidate、未上屏、未入库的条目
- 仅推最近 LOOKBACK_HOURS 小时内采集的；首次运行（无记录文件）同样受此限制，避免一次性刷屏
- 每轮最多 MAX_ITEMS 条，超出只报总数
- 推过的 C 编号写入 notified-cids.json，不重复推

用法：
  python3 notify-candidates.py            # 正常推送
  python3 notify-candidates.py --dry-run  # 只打印，不发送、不写记录
"""

import json
import os
import re
import subprocess
import sys
from datetime import datetime, timedelta, timezone

PROJECT = "/Users/xucheng/Documents/Codex项目/AI知识学习工作台"
COLLECTED = os.path.join(PROJECT, "collected.js")
STATE_DIR = "/Users/xucheng/Documents/Codex项目/AI 电视工作台/data"
STATE_FILE = os.path.join(STATE_DIR, "notified-cids.json")

CHAT_ID = "oc_bd050da8e199f5bbe6a13eb301c6c1fb"
LARK = "/opt/homebrew/bin/lark-cli"
SITE = "https://xuchengppp-source.github.io/ai-knowledge-workbench/"

LOOKBACK_HOURS = 26
MAX_ITEMS = 5

# 关注方向关键词加权（只影响排序，不做过滤，避免误杀）
UP_WORDS = ["FDE", "交付", "合规", "治理", "权限", "审计", "企业", "变现", "商业模式",
            "ARR", "A2A", "智能体", "Agent", "私有化", "落地", "验收", "个人助理", "Personal"]
DOWN_WORDS = ["融资", "估值", "财报", "净利", "亏损", "股价", "IPO", "涨停", "市值", "轮融资"]


def score(x):
    text = (x.get("title") or "") + " " + (x.get("reason") or "")
    s = 0
    for w in UP_WORDS:
        if w in text:
            s += 3
            break
    for w in DOWN_WORDS:
        if w in text:
            s -= 3
            break
    return s
TZ = timezone(timedelta(hours=8))


def rebuild_collected():
    """先重建 collected.js，保证新采集的条目已分配到 C 编号"""
    try:
        r = subprocess.run(["/opt/homebrew/bin/node", "build-collected.js"],
                           cwd=PROJECT, capture_output=True, text=True, timeout=120)
        if r.returncode != 0:
            print("重建 collected.js 失败，沿用上一版:", r.stderr[:200], file=sys.stderr)
        else:
            print((r.stdout or "").strip()[:200])
    except Exception as e:
        print("重建异常，沿用上一版:", e, file=sys.stderr)


def load_collected():
    with open(COLLECTED, encoding="utf-8") as f:
        raw = f.read()
    raw = raw.replace("window.OBSIDIAN_COLLECTED = ", "").rstrip().rstrip(";")
    return json.loads(raw)


def round_time(run_id):
    """workbuddy-20261126-0451 -> datetime"""
    m = re.search(r"(\d{8})-(\d{4})", run_id or "")
    if not m:
        return None
    try:
        return datetime.strptime(m.group(1) + m.group(2), "%Y%m%d%H%M").replace(tzinfo=TZ)
    except ValueError:
        return None


def load_state():
    if not os.path.exists(STATE_FILE):
        return {"cids": [], "lastRun": ""}
    try:
        with open(STATE_FILE, encoding="utf-8") as f:
            d = json.load(f)
        if isinstance(d, list):
            return {"cids": d, "lastRun": ""}
        return d
    except Exception:
        return {"cids": [], "lastRun": ""}


def save_state(state):
    os.makedirs(STATE_DIR, exist_ok=True)
    tmp = STATE_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=1)
    os.replace(tmp, STATE_FILE)


def build_message(items, total_pending, now):
    lines = [f"【候选未上屏 · {len(items)} 条】{now.strftime('%m-%d %H:%M')}", ""]
    for x in items:
        lines.append(f"{x['cid']} {x['title']}")
        meta = "｜".join([p for p in [x.get("publisher", ""), x.get("date", "")] if p])
        if meta:
            lines.append(meta)
        if x.get("reason"):
            lines.append(f"未上屏理由：{x['reason']}")
        if x.get("url"):
            lines.append(x["url"])
        lines.append("")
    if total_pending > len(items):
        lines.append(f"另有 {total_pending - len(items)} 条候选，见工作台左侧「采集发现」。")
    lines.append("要入库直接回编号，如「录入 " + items[0]["cid"] + "」。")
    lines.append(SITE)
    return "\n".join(lines)


def send(text):
    cmd = [LARK, "im", "+messages-send", "--chat-id", CHAT_ID, "--text", text, "--as", "bot"]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    if r.returncode != 0:
        print("发送失败:", r.returncode, r.stderr[:400], file=sys.stderr)
        return False
    print("已发送:", r.stdout.strip()[:200])
    return True


def main():
    dry = "--dry-run" in sys.argv
    rebuild_collected()
    d = load_collected()
    items = d.get("items", [])
    state = load_state()
    done = set(state.get("cids", []))
    now = datetime.now(TZ)
    cutoff = now - timedelta(hours=LOOKBACK_HOURS)

    pool = []
    for x in items:
        if x.get("displayId") or x.get("archived"):
            continue
        if x.get("decision") != "candidate":
            continue
        cid = x.get("cid")
        if not cid or cid in done:
            continue
        rt = round_time(x.get("round"))
        if rt is None or rt < cutoff:
            # 过期未推的直接记账，避免以后补推旧闻
            if not dry:
                done.add(cid)
            continue
        x["_score"] = score(x)
        pool.append(x)

    pool.sort(key=lambda x: (x["_score"], x.get("date") or "", x.get("cid") or ""), reverse=True)
    picked = pool[:MAX_ITEMS]

    if not picked:
        print("本轮无新候选，跳过发送")
        if not dry and len(done) != len(state.get("cids", [])):
            state["cids"] = sorted(done)
            state["lastRun"] = now.isoformat(timespec="seconds")
            save_state(state)
        return 0

    msg = build_message(picked, len(pool), now)
    print(msg)
    if dry:
        print("\n[dry-run] 未发送、未写记录")
        return 0
    if not send(msg):
        return 1
    for x in picked:
        done.add(x["cid"])
    # 首次运行：窗口内其余候选记入已告知，避免随后几轮连续刷屏；总数已在消息里报出
    if not state.get("cids"):
        for x in pool[MAX_ITEMS:]:
            done.add(x["cid"])
    state["cids"] = sorted(done)
    state["lastRun"] = now.isoformat(timespec="seconds")
    save_state(state)
    print("已记录", len(picked), "个 C 编号")
    return 0


if __name__ == "__main__":
    sys.exit(main())
