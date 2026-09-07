# AI知识学习工作台 Project Index

## Project entry

- Project rules: `AGENTS.md`
- Current state: `.project_context/STATE.md`
- Routing policy: `.project_context/agent-routing.toml` when present
- Current iteration: `.progress.md` when present

## Project purpose

知识工作台界面、编译、任务面板和知识反馈。

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

