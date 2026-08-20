---
name: task-card
description: 在智能体任务面板（Taskboard）上登记任务：内容入库后建卡等待审核、想法/待办登记、按审核结果改状态、加产出说明。适用于各智能体（克里斯 / 伊森 / 卢卡斯 / 奥利弗 / Codex）把整理好的内容登记到协作面板，以及被打回后的返工登记。
allowed-tools: Bash, Read
---

# 任务面板登记（task-card）

任务面板是克里斯、伊森、奥利弗、Codex 共用的接力面板。本机地址 `http://127.0.0.1:47823`，协作项目 `knowledge-pipeline`（多智能体任务协作，不只限知识流水线）。Obsidian 是最终知识源，面板只登记任务状态。

规则正文的唯一真相在 Obsidian 操作手册：`/Users/xucheng/Documents/c 徐的知识库/Codex工作区/智能体协作-任务面板操作手册.md`。本 SKILL 是精简执行版：规则有更新、或与手册不一致时，一律以 Obsidian 手册为准；面板相关的历次改动记录看 KNOWLEDGEPIP-3 的持续完善记录。

## 先读手册（每次调用本 skill 必做）

动手前先读 Obsidian 操作手册，它是最新规则与示例的唯一真相层：

```bash
cat "/Users/xucheng/Documents/c 徐的知识库/Codex工作区/智能体协作-任务面板操作手册.md"
```

不确定的流程细节（资料流转、返工、标签词表、关联规则等）都在手册里。本 SKILL 只保证入口和最常见动作。同一会话已读过、且 KNOWLEDGEPIP-3 没有新记录时可跳过。

## 身份（必须先声明）

每次调用脚本前，用环境变量声明自己的身份，否则卡片会记成 Codex Agent：

| 智能体 | TASKCARD_AGENT_ID | TASKCARD_AGENT_NAME |
|---|---|---|
| 克里斯 | `chris` | `克里斯` |
| 伊森 | `ethan` | `伊森（WorkBuddy）` |
| 奥利弗 | `oliver` | `Oliver（千问办公）` |
| 卢卡斯 | `lucas` | `卢卡斯（QoderWork）` |
| Codex | 不设置（默认） | — |

```bash
TASKCARD_AGENT_ID=oliver TASKCARD_AGENT_NAME="Oliver（千问办公）" bash /Users/xucheng/Documents/Codex项目/dashi-taskboard/scripts/task-card.sh ...
```

## 规则

1. 只有真正完成内容整理 / 入库后才建卡；没有产出的请求不建卡。
2. 必须用环境变量声明自己的身份（见上），否则卡片归属错误。
3. 卡型三类，用 `--type` 显式选类型，脚本自动带 `类型:<类型>` 标签：
   - 知识专题（已入库待审核）：`create`，状态 `in_review`，标题 `审核{主题}（已入库待审核）`，标签自动带 `obsidian:<相对路径>`。
   - 待办（想法 / 待执行）：`create-todo`，状态 `todo`，标题 `{主题}（待办）`。
   - 资料录入（还没入库，先登记占位）：`create-todo --type 资料录入`，状态 `todo`，整理录入后再升级为审核卡。
4. 建卡属性必须填全，脚本会自动补齐默认值，需要调整时用参数覆盖：
   - 状态：`create` 自动 `in_review`，`create-todo` 自动 `todo`。
   - 类型：`create` 默认 `知识专题`，`create-todo` 默认 `待办`；资料类用 `--type 资料录入`。
   - 优先级：默认 `medium`；紧急用 `--priority urgent`，重要用 `--priority high`，普通 `medium`，低 `low`。
   - 工作流：脚本自动带 `issue-delivery`。
   - 负责人：脚本自动用你声明的身份（`TASKCARD_AGENT_ID` / `TASKCARD_AGENT_NAME`）。
   - 标签：脚本自动带 `类型:<类型>`；入库卡再加 `审核,agent协作,obsidian:<相对路径>`；需要细分时用 `--labels "a,b"` 追加，脚本会合并进默认标签。
5. 标签分四类，各司其职：
   - 类型标签（恒定，每卡一个）：`类型:待办` / `类型:资料录入` / `类型:知识专题`。
   - 主题标签（1-3 个，必填至少 1 个）：表达内容领域，如 `政务` `企业AI` `AI交付` `组织信任` `工作台` `Supabase` `体验测试`。
   - 来源标签（知识类可选）：`来源:豆包` / `来源:ChatGPT` / `来源:抖音` / `来源:微信` / `来源:Claude`，标注这份知识从哪来；知识专题类型统一叫 `类型:知识专题`，来源不要混进类型。
   - 技术标签（恒定）：`agent协作`、`obsidian:<相对路径>`。
   「审核」是流程标签，只出现在 `in_review`（待审核）阶段，置 done 或离开 in_review 时脚本自动移除；「待办」不作为标签，由状态 `todo` 表达。
6. 描述必须包含：产出物 Obsidian 路径（入库卡）、内容来源、待办要点 / 待审核要点。
7. 建卡后脚本自动留一条「建卡说明」评论；返工、改状态时也要用评论说明原因。
8. 不改动其他 Agent 正在处理的任务；收到返工要求时，返工完成后评论说明再置回 `in_review`。
9. 状态只能使用：`todo` / `in_progress` / `in_review` / `blocked` / `done` / `canceled`。
10. 持续维护类任务卡（如 `KNOWLEDGEPIP-3 任务面板协作流程`）只要有人改了面板相关的东西（脚本 / 配置 / 规则 / 面板功能），改完必须自己用 `comment` 在该卡上补一条记录（改了什么 / 影响谁 / 怎么验证），并尽量同步追加到该卡描述里的「持续完善记录」；这类卡不轻易置 `done`。
11. 新课题 / 新问题一律独立建卡，不要挂在持续维护卡（如 KNOWLEDGEPIP-3）上；持续卡只记面板本身的改动记录，不收纳新议题。
12. 状态流转时必须同步更新标题内容：置 `done` 后去掉标题里的「审核整理」「（已入库待审核）」等流程词，只留干净的主题名；置 `in_progress` / `todo` 时去掉残留的「（待办）」。标题与状态必须一致，不能只移动状态不改标题。
13. 开发 / 实施类任务卡（在代码项目里干活）必须绑定开发上下文：建卡时用 `--worktree-path <代码项目绝对路径>` `--worktree-branch <分支>`，面板卡片上会显示绑定位置；纯知识类卡（Obsidian 产出）不必绑定。
14. 有关联关系的卡必须建关联：子任务用 `--parent <父卡ID>`；被别的卡阻塞用 `--blocked-by <依赖卡ID>`；仅相关用 `--related <相关卡ID>`。拆解与依赖必须在面板上可见。
15. 有明确时间节点填 `--due-date YYYY-MM-DD`；周期任务填 `--recurrence-interval N` + `--recurrence-unit day|week|month|year`。
16. 规则以 Obsidian 操作手册为准：动手前不确定当前规则时，先读 `/Users/xucheng/Documents/c 徐的知识库/Codex工作区/智能体协作-任务面板操作手册.md`；本 SKILL 与手册冲突时以手册为准。
17. 状态判定三步问（所有卡通用）：先看内容是否完整、不再改动 → 是就 `in_review`（等审核）；再看是否有人在动手做 → 有就 `in_progress`（没干完）；都不是就是 `todo`（上一步完成、等下一步开始）；审核通过才 `done`。CodeX 参与 ≠ 审核：整合 / 蒸馏阶段是 `in_progress`，整合完成才 `in_review`。录入员整理完原文再建卡恒为 `todo`（等知识管理员接手）；录入动作本身长、跨会话时才临时 `in_progress`，干完回 `todo`。

## 命令（只用这一个脚本）

所有操作只调用一个脚本，脚本会自己处理参数，不需要理解 taskctl 细节：

```bash
bash /Users/xucheng/Documents/Codex项目/dashi-taskboard/scripts/task-card.sh <动作> <参数>
```

### 1. 查看现有任务（先查再建，避免重复卡）

```bash
bash /Users/xucheng/Documents/Codex项目/dashi-taskboard/scripts/task-card.sh list
```

### 2. 建卡（内容入库后登记，等待 Codex 审核）

```bash
TASKCARD_AGENT_ID=oliver TASKCARD_AGENT_NAME="Oliver（千问办公）" bash /Users/xucheng/Documents/Codex项目/dashi-taskboard/scripts/task-card.sh create "政务AI Agent工程化与上海6598万招标研究" "/Users/xucheng/Documents/c 徐的知识库/企业AI与智能体商业化/政务AI Agent工程化与上海6598万招标研究.md" "抖音豆包文案+视频转录+拆解对话" --labels "政务,企业AI" --source 抖音
```

脚本会自动生成标题「审核{主题}（已入库待审核）」，状态设为 `in_review`（待 Codex 审核），描述里写好产出物、来源和状态，标签自动带上 `obsidian:` 关联路径，建卡后自动留说明评论。知识类卡至少用 `--labels` 带 1 个主题标签，可选 `--source` 标来源（豆包 / ChatGPT / 抖音 / 微信 / Claude），来源不要混进类型标签。

### 3. 登记想法 / 待办（还没入库时）

```bash
TASKCARD_AGENT_ID=oliver TASKCARD_AGENT_NAME="Oliver（千问办公）" bash /Users/xucheng/Documents/Codex项目/dashi-taskboard/scripts/task-card.sh create-todo "美团小团 AI 体验测试与工程化分析" "今早实测，体验问题疑与工程化相关"
```

脚本会自动生成标题「{主题}（待办）」、状态 `todo`、优先级 `medium`、标签 `待办`、工作流 `issue-delivery`，描述写清背景 / 状态 / 来源，建卡后自动留说明评论。紧急或需要细分主题时可追加：

```bash
TASKCARD_AGENT_ID=oliver TASKCARD_AGENT_NAME="Oliver（千问办公）" bash /Users/xucheng/Documents/Codex项目/dashi-taskboard/scripts/task-card.sh create-todo "美团小团 AI 体验测试与工程化分析" "今早实测" --priority high --labels "体验测试,任务面板"
```

资料录入（还没入库，先登记占位）时用 `--type 资料录入`：

```bash
TASKCARD_AGENT_ID=oliver TASKCARD_AGENT_NAME="Oliver（千问办公）" bash /Users/xucheng/Documents/Codex项目/dashi-taskboard/scripts/task-card.sh create-todo "美团小团 AI 体验测试与工程化分析" "今早实测" --type 资料录入
```

开发 / 实施类待办要绑定代码项目与分支（开发上下文），面板卡片上会显示绑定位置：

```bash
TASKCARD_AGENT_ID=chris TASKCARD_AGENT_NAME="克里斯" bash /Users/xucheng/Documents/Codex项目/dashi-taskboard/scripts/task-card.sh create-todo "工作台前端接入互动状态（supabase-js）" "原型验收后实施" --worktree-path "/Users/xucheng/Documents/Codex项目/AI知识学习工作台" --worktree-branch main
```

需要挂父卡 / 依赖 / 截止时间时追加：`--parent <父卡ID>`、`--blocked-by <依赖卡ID>`、`--related <相关卡ID>`、`--due-date YYYY-MM-DD`。

### 4. 改状态（收到审核结果或返工要求后）

```bash
TASKCARD_AGENT_ID=oliver TASKCARD_AGENT_NAME="Oliver（千问办公）" bash /Users/xucheng/Documents/Codex项目/dashi-taskboard/scripts/task-card.sh status KNOWLEDGEPIP-1 in_review
```

### 5. 加评论（产出说明 / 返工完成说明）

```bash
TASKCARD_AGENT_ID=oliver TASKCARD_AGENT_NAME="Oliver（千问办公）" bash /Users/xucheng/Documents/Codex项目/dashi-taskboard/scripts/task-card.sh comment KNOWLEDGEPIP-1 "返工完成，已按意见更新"
```

动作有五个：`list` / `create` / `create-todo` / `status` / `comment`。

## 典型流程

- 想法 / 待办 → `create-todo`（先登记，不急着入库）。
- 资料录入（原文已存原始资料区）→ `create-todo --type 资料录入`，状态 `todo`，等知识管理员接手。
- 问题专题库只建了标题 / 骨架 → `create-todo`，状态 `todo`，等 Codex 整合。
- Codex 接手蒸馏 / 整合 → `in_progress`；六步收口完成 → `in_review`。
- 完成入库 → `create` 建卡 `in_review`（待 Codex 审核）。
- 审核打回 → 按评论返工 → 完成后置回 `in_review` 并评论说明。
- 审核通过 → Codex 置 `done`，克里斯不主动关闭。
