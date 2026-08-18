---
name: task-card
description: 在智能体任务面板（Taskboard）上登记任务：内容入库后建卡等待审核、想法/待办登记、按审核结果改状态、加产出说明。适用于各智能体（克里斯 / 伊森 / 卢卡斯 / 奥利弗 / Codex）把整理好的内容登记到协作面板，以及被打回后的返工登记。
allowed-tools: Bash, Read
---

# 任务面板登记（task-card）

任务面板是克里斯、伊森、奥利弗、Codex 共用的接力面板。本机地址 `http://127.0.0.1:47823`，协作项目 `knowledge-pipeline`（多智能体任务协作，不只限知识流水线）。Obsidian 是最终知识源，面板只登记任务状态。

规则正文的唯一真相在 Obsidian 操作手册：`/Users/xucheng/Documents/c 徐的知识库/任务面板与知识库/智能体协作-任务面板操作手册.md`。本 SKILL 是精简执行版：规则有更新、或与手册不一致时，一律以 Obsidian 手册为准；面板相关的历次改动记录看 KNOWLEDGEPIP-3 的持续完善记录。

## 先读手册（每次调用本 skill 必做）

动手前先读 Obsidian 操作手册，它是最新规则与示例的唯一真相层：

```bash
cat "/Users/xucheng/Documents/c 徐的知识库/任务面板与知识库/智能体协作-任务面板操作手册.md"
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

**用 taskctl 直连时**（脚本未覆盖的操作），用 `CODEX_TASKBOARD_AGENT_ID/NAME` 声明身份（2026-08-12 起支持），否则同样记成 Codex：

```bash
CODEX_TASKBOARD_URL=http://127.0.0.1:47823 \
CODEX_TASKBOARD_AGENT_ID=oliver CODEX_TASKBOARD_AGENT_NAME="Oliver（千问办公）" \
node /Users/xucheng/Documents/Codex项目/dashi-taskboard/cli/taskctl.mjs issue update <ID> ...
```

**产出归属规则（2026-08-12 徐总确认）**：谁产出谁负责——卡片 assignee 必须是内容产出者，不是代建人。代他人建卡时（如主控代 Agent 建卡），assignee 要设为产出者；若建卡人 ≠ 产出者，建卡后立即用 `assigneeTarget: current-user`（以产出者身份 PATCH）或让产出者认领，确保卡面负责人正确。

## 规则

1. 只有真正完成内容整理 / 入库后才建卡；没有产出的请求不建卡。
2. 必须用环境变量声明自己的身份（见上），否则卡片归属错误。
3. 卡型三类，用 `--type` 显式选类型，脚本自动带 `类型:<类型>` 标签：
   - 知识专题（已入库）：`create`，状态 `in_review`，标题只写主题名（不带「审核/待审核」字样），审核信息由状态 `in_review` + 标签「审核」表达，标签自动带 `obsidian:<相对路径>`。
   - 待办（想法 / 待执行）：`create-todo`，状态 `todo`，标题 `{主题}（待办）`。
   - 资料录入（还没入库，先登记占位）：`create-todo --type 资料录入`，状态 `todo`，整理录入后再升级为审核卡。
4. 建卡属性必须填全，脚本会自动补齐默认值，需要调整时用参数覆盖：
   - 状态：`create` 自动 `in_review`，`create-todo` 自动 `todo`。
   - 类型：`create` 默认 `知识专题`，`create-todo` 默认 `待办`；资料类用 `--type 资料录入`。
   - 优先级：默认 `medium`；紧急用 `--priority urgent`，重要用 `--priority high`，普通 `medium`，低 `low`。
   - 工作流：脚本自动带 `issue-delivery`。
   - 负责人：脚本自动用你声明的身份（`TASKCARD_AGENT_ID` / `TASKCARD_AGENT_NAME`）。
   - 标签：脚本自动带 `类型:<类型>`；入库卡再加 `审核,agent协作,obsidian:<相对路径>`；需要细分时用 `--labels "a,b"` 追加，脚本会合并进默认标签。
   - 时间：**开始时间必填**（2026-08-11 徐总硬性要求）——`create`/`create-todo` 脚本已自动填建卡当天，无需手动传；**截止时间只在有明确时间节点时才用 `--due-date YYYY-MM-DD` 填，没有截止时间就不填**。
5. 标签分四类，各司其职：
   - 类型标签（每卡一个）：`类型:待办` 是状态型，只属于 `todo`（离开 todo 自动移除、置回 todo 自动加回）；`类型:资料录入` / `类型:知识专题` / `类型:个人事项` 是内容型，不随状态变。
   - 主题标签（1-3 个，必填至少 1 个）：表达内容领域，如 `政务` `企业AI` `AI交付` `组织信任` `工作台` `Supabase` `体验测试` `美签`。
   - 来源标签（知识类可选）：`来源:豆包` / `来源:ChatGPT` / `来源:抖音` / `来源:微信` / `来源:Claude`，标注这份知识从哪来；知识专题类型统一叫 `类型:知识专题`，来源不要混进类型。
   - 技术标签（恒定）：`agent协作`、`obsidian:<相对路径>`。
   「审核」只属于 `in_review`，置 done 或离开 in_review 时脚本自动移除；「待办」不再作为独立标签，由状态 `todo` + 类型 `类型:待办` 表达（完成 / 积压 / 卡住 / 进行中的卡不会挂着「待办」）。
6. 描述必须包含：产出物 Obsidian 路径（入库卡）、内容来源、待办要点 / 待审核要点。
7. 建卡后脚本自动留一条「建卡说明」评论；返工、改状态时也要用评论说明原因。**评论与描述只写状态 + Obsidian 相对路径指针（.md），绝不复制正文、不贴 `obsidian://open?...` URI——正文唯一真相在 Obsidian（内容层），评论只是状态层指针。**
8. 不改动其他 Agent 正在处理的任务；收到返工要求时，返工完成后评论说明再置回 `in_review`。
9. 状态只能使用：`todo` / `in_progress` / `in_review` / `blocked` / `done` / `canceled`。
10. 持续维护类任务卡（如 `KNOWLEDGEPIP-3 任务面板协作流程`）只要有人改了面板相关的东西（脚本 / 配置 / 规则 / 面板功能），改完必须自己用 `comment` 在该卡上补一条记录（改了什么 / 影响谁 / 怎么验证），并尽量同步追加到该卡描述里的「持续完善记录」；这类卡不轻易置 `done`。
11. 新课题 / 新问题一律独立建卡，不要挂在持续维护卡（如 KNOWLEDGEPIP-3）上；持续卡只记面板本身的改动记录，不收纳新议题。
12. 状态流转时必须同步更新标题内容：建卡即纯主题名（不带流程词）；对历史遗留卡，置 `done` 后去掉标题里的「审核整理」「（已入库待审核）」等流程词，只留干净的主题名；置 `in_progress` / `todo` 时去掉残留的「（待办）」；离开 `in_review`（含置 `done`）时脚本自动移除「审核」标签。标题与状态必须一致，不能只移动状态不改标题。**改状态必须走 `task-card.sh status`（2026-08-10 强制）**：它是唯一自动同步「标题流程词 + 状态型标签」的路径（「审核」只属于 `in_review`、「类型:待办」只属于 `todo`）；禁止用 `taskctl issue update/move` 或面板 UI 直接改状态，否则标签不会同步，会产生 done 卡残留「审核」「类型:待办」的脏数据。
13. 开发 / 实施类任务卡（在代码项目里干活）必须绑定开发上下文：建卡时用 `--worktree-path <代码项目绝对路径>` `--worktree-branch <分支>`，面板卡片上会显示绑定位置；纯知识类卡（Obsidian 产出）不必绑定。
14. 有关联关系的卡必须建关联，拆解与依赖必须在面板上可见：
    - **仅相关 → 副议题（related）**：建卡后执行 `taskctl issue relation add <本卡ID> --type related --issue <已有卡ID>`，不另建独立卡（2026-08-11 徐总强调：能关联到已有卡就关联，不要新建）。
    - **是子任务 → 才用 parent（子议题）**：需用户明确要求拆子卡才用，不要滥用。
    - **被别的卡阻塞** → `blocked_by`。
15. **开始时间必填（2026-08-11 徐总硬性要求）**：建卡必须带开始时间，脚本 `create`/`create-todo` 已自动填建卡当天，无需手动传；**有明确截止时间才用 `--due-date YYYY-MM-DD` 填，没有截止时间就不填**。周期任务填 `--recurrence-interval N` + `--recurrence-unit day|week|month|year`。
16. 规则以 Obsidian 操作手册为准：动手前不确定当前规则时，先读 `/Users/xucheng/Documents/c 徐的知识库/任务面板与知识库/智能体协作-任务面板操作手册.md`；本 SKILL 与手册冲突时以手册为准。
17. 状态判定三步问（所有卡通用）：先看内容是否完整、不再改动 → 是就 `in_review`（等审核）；再看是否有人在动手做 → 有就 `in_progress`（没干完）；都不是就是 `todo`（上一步完成、等下一步开始）；审核通过才 `done`。CodeX 参与 ≠ 审核：整合 / 蒸馏阶段是 `in_progress`，整合完成才 `in_review`。录入员整理完原文再建卡恒为 `todo`（等知识管理员接手）；录入动作本身长、跨会话时才临时 `in_progress`，干完回 `todo`。
18. **先查再建（强制）**：建卡前**必须**先执行 `task-card.sh list` 查看面板已有任务，确认没有主题相近的卡才能新建。如果发现已有相关卡，应把新信息通过 `comment` 补充到已有卡上、或建 related 关联到已有卡（副议题），**而不是另建独立卡**。违反此规则会导致面板出现重复卡，增加协作混乱（2026-08-11 实例：工作台 generate.js bug 应关联 KNOWLEDGEPIP-83，误建了独立卡被徐总纠正）。
19. **主动关联面板（强制）**：当对话内容涉及任务面板上已有任务的主题时（如 OpenClaw 配置、瘦身、上下文优化等），**必须主动**执行 `task-card.sh list` 查看是否有相关卡，并更新状态或添加评论。不要等用户提醒才去面板查看。记忆中有相关信息时，更要主动关联到面板任务。
20. 待办闲置回收：`todo` 卡 7 天无实质进展（无新评论 / 状态变化 / 描述更新）就移回 `backlog`（积压），移回时评论注明原因；恢复处理时再移回 `todo` / `in_progress`。积压 = 想做但暂不排期，待办 = 近期要开始做。

## Task-Obsidian 协同规则（四个外部 Agent 统一执行）

**按任务类型分层的 Obsidian 绑定策略（徐总 2026-08-08 确认）**：

| 任务类型 | Obsidian 处理 | 绑定时机 |
|---|---|---|
| **知识录入 / 专题** | **不预建专题文件**。录入 → 审核 → Codex 蒸馏时**才决定落位**：融入既有专题或新建专题；落位后把「落入哪个专题 + 笔记路径」写回任务卡评论作为归属记录 | 蒸馏落位后回写评论，不在录入时预建 |
| **执行型**（修配置/跑测试/一次性操作） | **不绑定**。任务面板就是全程档案；结束时**有值得沉淀的结论才回写** Obsidian，没有就 done 完事 | 结束时有结论才回写 |
| **方案 / 研究型** | 建一个 **Obsidian 主文件**（frontmatter 含 `type: task-knowledge`、`task_id: <主任务ID>`、`status: working`，正文含 Task link / Working notes / Task binding），子任务**共用主文件**（章节/锚点区分），不为每个子任务单独建文件 | 开始就建主文件，边做边记 |

21. **接到新任务**：先 `list` 确认任务卡及其父任务，再按上表判断类型决定 Obsidian 处理——知识录入类不预建、执行类不绑定、方案研究类建/查主文件。**操作旧任务**：先看该任务类型，按对应策略处理（知识类查落位记录、方案类读主文件、执行类直接看面板）。
22. **任务评论写简短状态并附笔记路径**：评论只写简短状态（做了什么 / 进展到哪 / 下一步等谁）。知识类在蒸馏落位后附落位专题笔记相对路径（如 `企业AI与智能体商业化/xxx.md`）；方案类附主文件相对路径；不贴 `obsidian://open?...` URI、不复制正文。详细过程不塞进评论——评论是状态层，不是内容层。
23. **详细过程写入 Markdown**：方案/研究型的详细过程写在 Obsidian 主文件 Working notes 区（按任务 ID 分节）；知识类的详细内容在蒸馏落位时写入对应专题页；执行型的过程不强制写 Obsidian，面板评论记录即可。
24. **重要结论回写 Obsidian**：任务完成后，重要结论按知识库规则回写（知识类落位到专题页、方案类更新主文件章节、执行类有沉淀价值的结论才蒸馏回写），面板评论只留状态指针和笔记路径。Obsidian 是最终知识源，面板只登记任务状态。
25. **Obsidian 读写优先走 obsidian-cli**（2026-08-08 全局工作规则）：读/搜/建/追加/改 Obsidian 知识库一律优先用 `obsidian-cli`（明确指定目标 Vault 与路径），写入后读回或搜索验证；**不把直接改 Vault 内 .md 文件（Write/Edit）作为默认写入方式**。外部智能体调不了 CLI 时返回主控、由主控经 CLI 写入；本地项目代码/配置/普通项目文档不属于知识库，仍按项目规则直接维护。

## 命令（只用这一个脚本）

常规操作只调用一个脚本，脚本会自己处理参数，不需要理解 taskctl 细节；脚本未覆盖的操作（改标题 / 归档 / 恢复 / 指派负责人）见下方「高级操作」直连 taskctl。**每次调用都必须带上自己的身份变量**（`TASKCARD_AGENT_ID` + `TASKCARD_AGENT_NAME`，见上「身份」），否则卡片会记成 Codex Agent：

```bash
TASKCARD_AGENT_ID=<自己的ID> TASKCARD_AGENT_NAME="<自己的名字>" bash /Users/xucheng/Documents/Codex项目/dashi-taskboard/scripts/task-card.sh <动作> <参数>
```

### 1. 查看现有任务（先查再建，避免重复卡）

```bash
bash /Users/xucheng/Documents/Codex项目/dashi-taskboard/scripts/task-card.sh list
```

### 2. 建卡（内容入库后登记，等待 Codex 审核）

```bash
TASKCARD_AGENT_ID=oliver TASKCARD_AGENT_NAME="Oliver（千问办公）" bash /Users/xucheng/Documents/Codex项目/dashi-taskboard/scripts/task-card.sh create "政务AI Agent工程化与上海6598万招标研究" "企业AI与智能体商业化/政务AI Agent工程化与上海6598万招标研究.md" "抖音豆包文案+视频转录+拆解对话" --labels "政务,企业AI" --source 抖音
```

脚本自动建卡，标题只写主题名（不带「审核/待审核」字样），状态设为 `in_review`（待 Codex 审核），审核信息由状态 + 标签「审核」表达，描述里写好产出物、来源和状态，标签自动带上 `obsidian:` 关联路径，建卡后自动留说明评论。知识类卡至少用 `--labels` 带 1 个主题标签，可选 `--source` 标来源（豆包 / ChatGPT / 抖音 / 微信 / Claude），来源不要混进类型标签。

> 标题规范（徐总多次强调）：标题只写主题名，不写「审核/待审核」字样，审核信息一律由状态 `in_review` + 标签「审核」表达。建卡后检查标题：若脚本仍未同步此规范而生成「审核{主题}（已入库待审核）」旧格式，用 `status <任务ID> in_review "<纯主题名>"` 改回（带上自己的身份变量），改完再确认标题是纯主题名。

### 3. 登记想法 / 待办（还没入库时）

```bash
TASKCARD_AGENT_ID=oliver TASKCARD_AGENT_NAME="Oliver（千问办公）" bash /Users/xucheng/Documents/Codex项目/dashi-taskboard/scripts/task-card.sh create-todo "美团小团 AI 体验测试与工程化分析" "今早实测，体验问题疑与工程化相关"
```

脚本会自动生成标题「{主题}（待办）」、状态 `todo`、优先级 `medium`、标签 `类型:待办`、工作流 `issue-delivery`，描述写清背景 / 状态 / 来源，建卡后自动留说明评论。紧急或需要细分主题时可追加：

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

有明确截止时间时追加 `--due-date YYYY-MM-DD`（没有截止时间就不填）；开始时间脚本自动填建卡当天，无需传参。

需要与已有卡建立关联时（先 `list` 找到已有卡 identifier），建卡后执行 relation add：

```bash
# 仅相关 → 副议题 related；是子任务才用 parent（用户明确要求拆子卡）
cd /Users/xucheng/Documents/Codex项目/dashi-taskboard && \
CODEX_TASKBOARD_URL=http://127.0.0.1:47823 \
CODEX_TASKBOARD_AGENT_ID=<自己的ID> CODEX_TASKBOARD_AGENT_NAME="<自己的名字>" \
node cli/taskctl.mjs issue relation add <本卡ID> --type related --issue <已有卡ID> --thread-id "agent:card:YYYY-MM-DD" --json
```

### 4. 改状态（收到审核结果或返工要求后）

```bash
TASKCARD_AGENT_ID=oliver TASKCARD_AGENT_NAME="Oliver（千问办公）" bash /Users/xucheng/Documents/Codex项目/dashi-taskboard/scripts/task-card.sh status KNOWLEDGEPIP-1 in_review
```

> **强制（2026-08-10）**：改状态一律走本命令。`task-card.sh status` 会自动同步标题流程词 + 状态型标签（「审核」只留 `in_review`、「类型:待办」只留 `todo`）；taskctl / 面板 UI 直连改状态不会同步标签，会产生 done 卡残留「审核」「类型:待办」的脏数据。

### 5. 加评论（产出说明 / 返工完成说明）

```bash
TASKCARD_AGENT_ID=oliver TASKCARD_AGENT_NAME="Oliver（千问办公）" bash /Users/xucheng/Documents/Codex项目/dashi-taskboard/scripts/task-card.sh comment KNOWLEDGEPIP-1 "返工完成，已按意见更新"
```

task-card.sh 动作：`list` / `create` / `create-todo` / `status` / `comment`。脚本未覆盖的操作（改标题 / 归档 / 恢复 / 指派负责人）走下方「高级操作」直连 taskctl / API；**改状态除外——必须走 `task-card.sh status`，不得用 taskctl issue update/move 或面板 UI 改状态（2026-08-10 强制，否则标签不同步）**。

### 6. 高级操作（脚本未封装时，直连 taskctl / API）

优先用 task-card.sh；只有脚本未覆盖的操作才直连 taskctl。直连与脚本同源：同一 `CODEX_TASKBOARD_URL=http://127.0.0.1:47823`、同一身份环境变量；不设身份变量时操作会记成 Codex Agent：

```bash
cd /Users/xucheng/Documents/Codex项目/dashi-taskboard && \
CODEX_TASKBOARD_URL=http://127.0.0.1:47823 \
CODEX_TASKBOARD_AGENT_ID=oliver CODEX_TASKBOARD_AGENT_NAME="Oliver（千问办公）" \
node cli/taskctl.mjs <子命令> <参数>
```

**改标题**（标题与状态不一致时，如清理历史卡残留的「审核整理」「（已入库待审核）」等流程词，改成纯主题名）：

```bash
cd /Users/xucheng/Documents/Codex项目/dashi-taskboard && CODEX_TASKBOARD_AGENT_ID=oliver CODEX_TASKBOARD_AGENT_NAME="Oliver（千问办公）" node cli/taskctl.mjs issue update KNOWLEDGEPIP-1 --title "纯主题名" --thread-id "agent:card:2026-08-07" --json
```

**归档 / 恢复**（不删除，归档后从活跃列表隐去；恢复同理）：

```bash
cd /Users/xucheng/Documents/Codex项目/dashi-taskboard && CODEX_TASKBOARD_AGENT_ID=oliver CODEX_TASKBOARD_AGENT_NAME="Oliver（千问办公）" node cli/taskctl.mjs issue archive KNOWLEDGEPIP-1 --thread-id "agent:card:2026-08-07" --json
cd /Users/xucheng/Documents/Codex项目/dashi-taskboard && CODEX_TASKBOARD_AGENT_ID=oliver CODEX_TASKBOARD_AGENT_NAME="Oliver（千问办公）" node cli/taskctl.mjs issue restore KNOWLEDGEPIP-1 --thread-id "agent:card:2026-08-07" --json
```

**指派负责人**（PATCH `/api/tasks/{id}` 传 `assigneeTarget`，taskctl 未封装，用 curl 直连）：`codex-agent` 派给 Codex Agent，`current-user` 收回给当前用户。先 `issue get <ID>` 取当前 `version`（并发控制），再 PATCH：

```bash
cd /Users/xucheng/Documents/Codex项目/dashi-taskboard && node cli/taskctl.mjs issue get KNOWLEDGEPIP-1 --json   # 记下返回的 version
curl -s -X PATCH "http://127.0.0.1:47823/api/tasks/KNOWLEDGEPIP-1" \
  -H "Content-Type: application/json" -H "x-taskboard-client: taskctl" \
  -H "x-taskboard-agent-id: oliver" -H "x-taskboard-agent-name: Oliver（千问办公）" \
  -d '{"version":"<上一步取到的version>","assigneeTarget":"codex-agent"}'
```

其他常用直连子命令：`issue get <ID>`（看详情 / version）、`issue relation add <ID> --type parent|blocks|blocked_by|related --issue <关联卡ID>`、`comment list <ID>`（看评论）。

## 典型流程

**所有建卡操作的第一步都是 `list`**——先看面板有没有相关卡，有就 `comment` 补充，没有才新建。

**拿不准建卡 / 绑定形态 → 看 Obsidian 专题「任务面板与知识库/」**（主位置，总入口 `任务面板与知识库/00_总入口.md`；操作手册即 `任务面板与知识库/智能体协作-任务面板操作手册.md`「〇点五、建卡决策树」）：① 用户明确指示建/不建以用户为准；② 用户未指示时三问自判（结论值得沉淀 / 跨会话跟进 / 内容会演进，任一为是即建 Obsidian 主文件，不限于"方案研究型"）；③ 已完成的知识库录入不反向建卡。

**判断完"该建主文件/绑定" → 用 task-obsidian-sync 工具执行**（入口 `pnpm task-obsidian-sync`，在 dashi-taskboard 项目内运行）：
- 建卡同时建主文件绑定：`create-binding --title <主题> --obsidian-path <vault相对路径>`
- 已有卡补绑定：`bind-existing --task <ID> --obsidian-path <vault相对路径>`
- 进展评论：`comment --task <ID> --body <进展>`（自动附相对路径）
- 结论回写：`promote --task <ID> --summary <结论>`
- 校验同步：`check --task <ID>`（描述有绑定 + 评论含路径 = sync-ready；只对建了主文件的卡校验）
工具详情见 `dashi-taskboard/docs/task-obsidian-sync.md`。

- 想法 / 待办 → `create-todo`（先登记，不急着入库）。
- 资料录入（原文已存原始资料区）→ `create-todo --type 资料录入`，状态 `todo`，等知识管理员接手。
- 问题专题库只建了标题 / 骨架 → `create-todo`，状态 `todo`，等 Codex 整合。
- Codex 接手蒸馏 / 整合 → `in_progress`；六步收口完成 → `in_review`。
- 完成入库 → `create` 建卡 `in_review`（待 Codex 审核）。
- 审核打回 → 按评论返工 → 完成后置回 `in_review` 并评论说明。
- 审核通过 → Codex 置 `done`，克里斯不主动关闭。
