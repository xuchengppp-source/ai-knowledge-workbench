# 知识库 AI 学习工作台（移动版）

将 Obsidian 知识库中「AI Agent 工程知识」与「企业 AI 与智能体商业化」两大专题的每日增量，编译成移动端学习工作台，通过 GitHub Pages 部署，手机浏览器即可访问。

## 数据流

```
Obsidian 知识库（本地，唯一正式来源，只读）
   ↓ generate.js（Node 脚本，手动或定时执行）
静态站点：index.html + data.js
   ↓ git push
GitHub Pages 自动部署
   ↓
手机浏览器访问
```

## 使用

```bash
# 重新生成数据（扫描 Obsidian 每日增量 → 编译 data.js）
node generate.js

# 提交并发布
git add -A
git commit -m "update"
git push
```

## 说明

- 仅发布两个专题的精选学习内容，不含甘食记经营数据、个人档案等敏感内容
- Obsidian 是正式知识来源，本仓库只是其编译产物，不做反向同步
