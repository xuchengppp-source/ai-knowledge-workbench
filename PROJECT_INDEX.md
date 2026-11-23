# AI知识学习工作台 Project Index

## Project entry

- Project rules: `AGENTS.md`
- Current state: `.project_context/STATE.md`
- Routing policy: `.project_context/agent-routing.toml` when present
- Current iteration: `.progress.md` when present

## Project purpose

知识工作台界面、编译、任务面板和知识反馈。

## TV workbench entry

- The published homepage now includes “AI 未来发展趋势” beside “我的洞察” and “知识发现”. TV access reuses the installed WebView wrapper and the TV-only 8788 redirect; no dedicated APK was rebuilt. Public HTML, TV-origin HTTP routes, and Ego Lite remote navigation were verified; physical remote selection on the TV remains unverified. Details: `.project_context/STATE.md`.

- The homepage exposes “我的洞察”, “知识发现”, and “AI 未来发展趋势” as parallel shortcuts.
- `generate.js --nav-only --out <project-dir>` regenerates the desktop/mobile navigation shell and TV D-pad focus support without rebuilding Obsidian data payloads.
- The existing TV WebView is reused without an APK update. TV-origin requests to the Mac 8788 root redirect to the public workbench home; the AI Trends link opens the local live dashboard. See `.project_context/STATE.md` and PRD §5.5.

## TV workbench portal

- Homepage now contains three shortcuts: My Insights, Knowledge Discovery, and AI Future Trends.
- `generate.js --nav-only --out <project-dir>` refreshes those generated navigation shells and injects `?tv=1` D-pad focus support without rebuilding the Obsidian data files.
- The Android TV keeps its existing WebView APK. TV-origin requests to the Mac status bridge root redirect to the published homepage; the AI Trends link opens the local 8788 dashboard. Detailed route and acceptance state: `.project_context/STATE.md`.

## Task-based reading order

```text
AGENTS.md
→ .project_context/STATE.md
→ .project_context/agent-routing.toml when present
→ PROJECT_INDEX.md
→ task-specific files and current outputs
```

## Boundary

- This index is navigation only; it does not replace project state or source documents.
- Read only the files required by the current task; do not scan unrelated projects.
- Treat documented capabilities as claims until verified against actual runtime output or deliverables.
- Preserve existing project baselines and historical backups unless the task explicitly authorizes a change.
- Record material progress in `.project_context/STATE.md` and keep implementation evidence separate from design assumptions.

