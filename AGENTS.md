# AI 知识学习工作台 · 项目级 AGENTS.md

本项目按「文档与上下文驱动」（Codex 五级用法 L2）运作，任何会话进入本项目时：

1. 先读 `docs/README.md`（文档地图），再读 `docs/01-产品需求-PRD.md`、`docs/02-软件架构.md`、`docs/03-当前进度.md`，以及 `.project_context/STATE.md`。
2. 动手前先输出执行计划（改什么、为什么、影响哪些文件），确认后再开始。
3. 项目硬约束：
   - Obsidian 知识库（`/Users/xucheng/Documents/c 徐的知识库`）是唯一正式来源，只读，编译过程绝不修改。
   - 白名单外内容不发布（个人档案、健康、客户敏感数据、原始资料、日志等）。
   - 页面产物（`index.html` / `mobile.html` / `data.js` / `docs.js`）由 `node generate.js` 生成，不手工改动。
   - 需求变更先更新 `docs/01-产品需求-PRD.md`，再谈实现。
4. 版本与验收：git 已启用；文件生成不等于交付，改动后必须人工打开浏览器验收。
