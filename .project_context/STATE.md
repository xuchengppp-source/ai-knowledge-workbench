# AI 知识学习工作台状态

## 当前状态

工作台已拆分为桌面网页版 `index.html` 和移动学习版 `mobile.html`，两端共用 Obsidian 编译数据，并接入三大 AI 知识主线、每日增量、每周架构复盘和“徐总问题专题库”。

> L2 文档驱动：进入本项目先读 `AGENTS.md` 和 `docs/`（01-PRD / 02-架构 / 03-进度），动手前先出执行计划。

## 已完成

- [x] 扫描 `AI Agent工程知识`、`企业AI与智能体商业化`、`AI产业链与数字基础设施`
- [x] 生成 `data.js` 轻量索引和 `docs.js` 延迟正文
- [x] 桌面端首页改为横向知识工作台
- [x] 拆分 `index.html` 桌面版与 `mobile.html` 移动版，内容同步但界面分开维护
- [x] 接入搜索、问知识库、节点详情和返回链路
- [x] 接入 `徐总问题专题库`，展示问题专题、关联正式笔记、原始资料、待蒸馏项和下一步追问
- [x] 2026-08-03 16:08 已按 OpenClaw 新版专题 MD 刷新 `算力工厂与算力出海`，问题专题正文现在包含微信原文版、结构化提炼版和可复用框架
- [x] 2026-08-04 建立 L2 文档驱动体系：项目级 `AGENTS.md` + `docs/01-产品需求-PRD.md` + `docs/02-软件架构.md` + `docs/03-当前进度.md`，PRD 第 7 节含待徐总确认的开放需求
- [x] 2026-08-04 需求概念闭环：底座 / 议题 / 专题模型、双端信息架构、互动环节、养料管线角色分工、状态层字段，PRD 定稿 v2.0
- [x] 2026-08-05 制作可点击 HTML 原型 `docs/prototype/workbench-prototype.html`，完成桌面/移动双端浏览器实测
- [x] 2026-08-05 按徐总反馈简化：去掉星标收藏、去掉"随口一提→已沉淀"成熟度台阶，方向只保留活跃度热力点 + 最近更新时间（静置方向橙色警示）
- [x] 2026-08-05 原型补上知识基座真实浏览页：三大主线卡片 + 最近更新笔记流 + 主线筛选 + 阅读器弹层（桌面/移动都有），专题理解页与学习节奏页同步加入
- [x] 2026-08-05 调研多智能体通信困境，产出 `docs/04-智能体协作状态层.md`：复用 `dashi-taskboard`（本地 SQLite + taskctl CLI + 乐观锁 + 状态机 + 云模式）作为任务面板，各智能体极简 skill 接入，任务产出关联 Obsidian；已实测 Taskboard 本机可正常启动（127.0.0.1:47823 + 局域网地址）
- [x] 2026-08-05 PRD 同步：第 5.4 状态可视化改为「活跃度 + 最近更新（无完成态）」，第 8 节新增智能体协作任务层小节
- [x] 2026-08-05 Taskboard 试跑：服务已后台启动（127.0.0.1:47823），建 `knowledge-pipeline` 项目，录入真实任务 KNOWLEDGEPIP-1「审核政务招标研究」status=in_review（指派 agent:codex），附产出物评论，网页看板验证通过（审核中 1），截图 docs/prototype/screenshots/taskboard-board.png
- [x] 2026-08-05 多智能体接入：封装极简脚本 `dashi-taskboard/scripts/task-card.sh`（list/create/status/comment 四个动作），SKILL 已装到 `~/.openclaw/skills/task-card/`（克里斯）与 `~/.workbuddy/skills/task-card/`（伊森），脚本实测可查任务
- [x] 2026-08-05 操作手册改为通用版（适用所有智能体）：项目 `docs/skills/task-card/给智能体的操作手册.md` + Obsidian `Codex工作区/智能体协作-任务面板操作手册.md`；SKILL.md description 同步通用化并重新装到 OpenClaw / WorkBuddy
- [x] 2026-08-05 Obsidian 感知层落地：`scripts/obsidian-watch.mjs`（扫描知识底座 mtime → 匹配任务卡关联笔记 → 自动评论 + done 打回 in_review，幂等实测通过）。实测 KNOWLEDGEPIP-1 自动收到「Obsidian 笔记已更新」评论；`docs/04-智能体协作状态层.md` 新增感知层章节 + 完整接力流程表（L0/L1/L2 通知档位），操作手册同步
- [x] 2026-08-05 task-card skill 装齐全部智能体：OpenClaw（克里斯）/ WorkBuddy（伊森）/ QwenWorkCN 千问办公（Oliver）/ QoderWorkCN（卢卡斯）/ 旧版 QoderWork，五处 SKILL.md 与 WorkBuddy 版完全一致；此前误装 QoderWork 的错误文件已移入废纸篓
- [x] 2026-08-05 Taskboard 常驻确认：`~/Library/LaunchAgents/com.dashi.taskboard.plist`（RunAtLoad + KeepAlive + WorkingDirectory + 日志），服务由 launchd 管理；实测 kill 进程后自动重启（PID 21264→53215，API 200）
- [x] 2026-08-05 工作台最新设计建成任务卡 KNOWLEDGEPIP-13~18（labels 含「工作台」）：设计确认（徐总）/ Supabase 数据层 / 前端互动接入 / 感知层定时化+L1 通知 / 问题专题优化 / 每日自动编译部署，描述含文档路径
- [x] 2026-08-05 卡片类型标签体系落地：`类型:待办 / 类型:资料录入 / 类型:知识专题`；全部可见卡已打标；task-card.sh `create`/`create-todo` 支持 `--type`（默认知识专题/待办，资料类用 `--type 资料录入`）；SKILL.md 六处一致 + 操作手册补充「建卡必须选类型」
- [x] 2026-08-05 审核通过并置 done：KNOWLEDGEPIP-10（组织信任与闭环执行）、KNOWLEDGEPIP-11（AI交付行业观察走访7团队），均已评论审核结论；测试卡 4~8 已被智能体归档，主视图无噪音
- [x] 2026-08-05 审核闭环首跑：Codex 认领 KNOWLEDGEPIP-1（in_review）→ 通读政务专题笔记按验收标准审核 → 评论结论 → 置 done（乐观锁 v3→v4）；任务改名「政务AI Agent工程化与上海6598万招标研究（已入库，审核通过）」
- [x] 2026-08-05 任务面板身份机制修复：服务端 `actorFromRequest` 支持 `x-taskboard-agent-*` 身份头 + AGENT_REGISTRY（codex/oliver/chris/ethan/lucas），`taskctl` 读 `CODEX_TASKBOARD_AGENT_ID/NAME` 附加请求头，`task-card.sh` 支持 `TASKCARD_AGENT_ID/NAME` 透传并新增 `create-todo`（待办卡，自动标签+建卡说明评论）；`create` 自动带 `obsidian:<相对路径>` 标签
- [x] 2026-08-05 Oliver 两张测试卡（KNOWLEDGEPIP-2/3）创建人/指派人修正为 Oliver（千问办公）；SKILL 与操作手册更新（身份必填 + 待办/审核双卡型模板 + 五个动作），同步到 OpenClaw/WorkBuddy/QoderWork/QoderWorkCN/QwenWorkCN 全部 skill 目录
- [x] 2026-08-05 智能体品牌头像落地：从 /Applications 提取各应用真实图标到 `web/public/logos/`（openclaw/workbuddy/qwenworkcn/qoderworkcn），AGENT_REGISTRY 配置各 agent 头像，ActorAvatar 优先显示 agent 头像，三张活动卡头像字段已更新（API + 静态 200 验证）
- [x] 2026-08-05 建卡属性必填规则固化：KNOWLEDGEPIP-2/3 补齐标签（待办,体验测试/任务面板,agent协作）与工作流 issue-delivery；`taskctl issue create/update` 新增 `--workflow`；`task-card.sh` 建卡自动带工作流 issue-delivery + 默认标签，支持 `--priority` / `--labels` 覆盖；属性必填规则写入 5 个智能体 skill 的 SKILL.md 与 manage-taskboard SKILL.md（测试卡 KNOWLEDGEPIP-6 端到端验证后已归档）
- [x] 2026-08-05 KNOWLEDGEPIP-3 升级为长期维护卡：改名「任务面板协作流程：持续完善与回归（长期维护）」并置 `in_progress`，描述新增「持续完善记录」小节（已记入本轮全部改动），加本轮改动评论；操作手册本地副本与 Obsidian 版补齐「属性必填」与「持续任务卡改完自补」两节并同步一致；5 个智能体 skill 新增第 10 条「持续维护卡改完自己 comment 补记录」
- [x] 2026-08-05 协作项目改名为「多智能体任务协作」（knowledge-pipeline id 不变）；新规则「新议题独立建卡、不挂持续维护卡」写入 5 个 skill + 操作手册；KNOWLEDGEPIP-9 方案 A 实施：memory-live-sync 插件（~/.openclaw/code/plugins/，已注册加载，openclaw.json 已备份）——共享 MEMORY.md 变化时对侧 session 下一条消息注入新内容提示，三步逻辑验证通过，真实验收待双端
- [x] 2026-08-05 工作台 6 张实施卡（KNOWLEDGEPIP-13~18）归拢到父任务 KNOWLEDGEPIP-19「AI知识学习工作台实施（总览）」（6 张独立子卡，各自不同模块）；完成卡标题清理（10/11 去「审核整理/待审核」、12 去「待办」残留）；新规则「状态流转必须同步改标题」写入 5 个 skill + 操作手册，task-card.sh status 支持第 3 参数新标题（端到端验证通过）
- [x] 2026-08-05 面板三件事收尾：① KNOWLEDGEPIP-19 总览卡从待办置 backlog（积压），6 张子卡 KNOWLEDGEPIP-13~18 保持独立待办，parent 关系不变；② 三张 done 卡（KNOWLEDGEPIP-1/10/11）删掉「审核」标签，只留主题标签 + agent协作 + obsidian 路径 + 类型标签；③ 卡片新增评论数与相对更新时间——服务端 taskFromRow 加 commentCount、listTasks/getTask SQL 加评论计数子查询、createComment 写评论时刷新任务 updated_at，前端 TaskCard 显示 comment-count-chip 与 updated-at-chip（hover 显示完整时间），时间帮助函数抽到 web/src/time.ts 与 TaskDetail 共用；typecheck + 构建 + API + 浏览器渲染均验证通过，改动已记入 KNOWLEDGEPIP-3 持续完善记录并加评论
- [x] 2026-08-05 子议题属性补全：KNOWLEDGEPIP-13~18 六张工作台实施卡全部补上工作流 `issue-delivery` + 开发上下文（绑定 `/Users/xucheng/Documents/Codex项目/AI知识学习工作台` 的 `main` 分支）；task-card.sh `create-todo` 新增 `--worktree-path` / `--worktree-branch` 参数（建卡端到端验证后测试卡归档）；新规则「开发/实施类卡必须绑定开发上下文，纯知识类卡不必」同步到 5 份智能体 SKILL + 项目 SKILL（补齐第 12 条）+ manage-taskboard SKILL + 两份操作手册（本地与 Obsidian），均 diff 一致；已记入 KNOWLEDGEPIP-3 并加评论
- [x] 2026-08-05 建卡属性全规则落地：11 项「建卡属性 Checklist」（状态/优先级/类型标签/主题标签/工作流/负责人/开发上下文/描述/截止日期/重复周期/关联）写入两份操作手册；关联规则（`--parent` 子任务挂父卡、`--blocked-by` 依赖、`--related` 相关）；task-card.sh create/create-todo 统一支持 worktree/due-date/recurrence/parent/blocked-by/related，建卡后自动建关联，重构为参数数组兼容 bash 3.2；SKILL 规则扩到 15 条（新增 14 关联、15 时间/周期），5 份智能体 SKILL + 项目 SKILL + manage-taskboard SKILL + 两份操作手册全部 diff 一致；完整属性建卡端到端验证通过（测试卡 KNOWLEDGEPIP-22 已归档）
- [x] 2026-08-05 标签体系分层：类型标签（`类型:待办/资料录入/知识专题` 恒定）、主题标签（≥1 个）、来源标签（`来源:豆包/ChatGPT/抖音/微信/Claude` 知识类可选）、技术标签（`agent协作`/`obsidian:`）；`类型:知识专题` 统一不分来源；流程标签自动清理（`审核` 只留 in_review，置 done/离开 in_review 自动移除；`待办` 不再当标签）；task-card.sh create 支持 `--source`、未带主题标签自动提醒、status 自动清流程标签；存量清理（done 卡 25/26 去审核补主题、19/12/3/9 去待办裸标签、19/28 补类型）；SKILL 规则 5 更新，6 份 SKILL + 2 份手册一致
- [x] 2026-08-05 规则真相层落位：6 份智能体 SKILL 补上「规则以 Obsidian 操作手册为准」指引（规则 16 + 开头说明，含 Obsidian 手册路径），SKILL 定位为精简执行版、冲突时以手册为准，历次改动看 KNOWLEDGEPIP-3 持续完善记录；SKILL 6 份 diff 一致
- [x] 2026-08-05 SKILL 调用即读手册：6 份 SKILL 新增「## 先读手册（每次调用本 skill 必做）」小节——动手前先 `cat` Obsidian 操作手册全文，流程细节以手册为准，同一会话已读且 KNOWLEDGEPIP-3 无新记录时可跳过；与手册铁律 3 呼应，SKILL 6 份 diff 一致
- [x] 2026-08-05 多智能体即时通信立项：把「各智能体即时通信形态」作为项目立项登记 KNOWLEDGEPIP-32「多智能体即时通信机制（待办）」（todo / high / 标签：任务面板,即时通信,智能体协作 / 工作流 issue-delivery / 开发上下文绑定 dashi-taskboard main）；描述含背景、现状实测（各智能体+面板同机常驻、OpenClaw gateway 支持 webhook）、目标（面板作消息总线+本机事件推送+兜底轮询+各智能体自监听+CodeX automation 唤醒）、待确认（CodeX 唤醒形态 / WorkBuddy、QwenWork 监听方式 / 优先链路）、可拆子议题；已登记待确认后拆子议题开工，不实施；KNOWLEDGEPIP-3 持续完善记录与评论、STATE.md 已同步
- [x] 2026-08-05 状态判定规则统一：定下「状态判定三步问」——状态不看任务类型、只看"这一步活现在停在谁手里"（内容完整不再改动 → `in_review`；有人在动手做 → `in_progress`；登记好等下一步 → `todo`；审核通过 → `done`）；资料录入/问题专题库骨架建卡恒为 `todo` 等 CodeX 整合，CodeX 整合中 `in_progress`，收口完成 `in_review`；关键澄清 CodeX 参与 ≠ 审核、todo 不是没人管、录入动作跨会话才临时 in_progress；写入两份操作手册（第三节新增小节 + 八点五指针，diff 一致）+ 6 份 SKILL（规则 17 + 典型流程，md5 一致），已记入 KNOWLEDGEPIP-3
 
## 待办

- [ ] 徐总确认原型 v0.2（截图在 `docs/prototype/screenshots/`：desktop-direction / desktop-base / mobile / mobile-base）
- [ ] 徐总确认 PRD 第 11 节剩余问题（Q7 成功标准 / Q11 推送 / Q12 待整理队列）
- [ ] 确认同步密钥方案（service_role 本机 .env vs anon+RLS 写入）
- [ ] 实施阶段：Supabase 建表（directions/topics/feeds/interaction_logs）+ RLS + Realtime publication；`generate.js` 增补 Supabase upsert；前端接入 supabase-js（需先征询新三方依赖）
- [ ] 智能体协作层落地：Codex 实际执行审核闭环（认领→审核→done/打回）+ 手机端展示
- [ ] 感知层触发方式拍板：手动跑（现状）/ cron 定时（推荐，每 15~30 分钟）/ LaunchAgent；是否开 `--report-card` 日报卡
- [ ] L1 飞书通知：状态变化 → 飞书群通知 @伊森/克里斯（需飞书 webhook，全局配置需确认）
- [ ] 优化问题专题摘要，避免首页摘要过长
- [ ] 增加问题专题按分类筛选
- [ ] 让每日 22:30 知识增量整理后自动触发工作台重新编译和部署

## 设计决策 / 关键上下文

- Obsidian 是只读来源，工作台编译过程不修改 Obsidian 笔记。
- GitHub Pages 仍是静态托管，适合展示和浏览；考试、记录、跨设备同步需要额外数据层。
- “问题专题库”不是原文镜像，而是把用户真实提问转成可复用的知识入口。
- 问题专题编译优先读取新版结构：`我的回答（微信原文版）`、`我的回答（结构化提炼版）`、`可复用框架 / 下一步验证`；旧版结构仍作为 fallback。
- Obsidian 感知层：Obsidian 无 git，变动检测靠 mtime 扫描；任务卡与笔记的关联靠 `obsidian:` 标签（新约定）或描述里的 `.md` 路径（兼容存量卡）；幂等靠评论里的 `obsidian-watch:<路径>:<mtime>` 标记。
- 桌面线上地址为 `https://xuchengppp-source.github.io/ai-knowledge-workbench/`。
- 移动线上地址为 `https://xuchengppp-source.github.io/ai-knowledge-workbench/mobile.html`。
- 手机宽度访问桌面入口会自动跳转到移动版；`?desktop=1` 可强制查看桌面版。
- 建卡属性必填（2026-08-05 起生效）：每张卡必须有状态、优先级（默认 medium）、工作流（knowledge-pipeline 用 issue-delivery）、负责人（自动按身份）、≥1 个标签；标签词表：审核 / 待办 / 政务 / 体验测试 / 任务面板 / agent协作 / obsidian:<路径>，脚本自动合并默认标签。
- 智能体头像映射：codex=Codex 应用图标，oliver=千问办公，chris=OpenClaw，ethan=WorkBuddy，lucas=QoderWork；面板负责人列先显 logo，点进去看具体人。

## 遇到的问题

- 项目原来没有 `.project_context/STATE.md`，本轮已补齐。
- `index.html` 不能用 `node --check` 直接检查，需要通过浏览器加载验证。
