# 知识库 AI 学习工作台（移动版）

将 Obsidian 知识库中 AI 相关专题、每日增量和双向链接，编译成移动端学习工作台，通过 GitHub Pages 部署，手机浏览器即可访问。

## 数据流

```
Obsidian 知识库（本地，唯一正式来源，只读）
   ↓ generate.js（Node 脚本，由每日 22:30 整理任务触发）
静态站点：index.html + data.js
   ↓ git push
GitHub Pages 自动部署
   ↓
手机浏览器访问
```

## 使用

```bash
# 重新生成数据（只读扫描 Obsidian → 编译 data.js/docs.js）
node generate.js --out /Users/xucheng/Documents/Codex项目/AI知识学习工作台

# 提交并发布
git add -A
git commit -m "update"
git push
```

## 说明

- 仅发布白名单内的 AI 学习内容，不含个人档案、健康记录、客户敏感数据等内容
- Obsidian 是正式知识来源，本仓库只是其编译产物，不做反向同步
- 每日 AI 知识增量整理完成后，由 Open Codex 自动化执行编译、检查变化并推送 GitHub
