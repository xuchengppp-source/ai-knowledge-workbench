#!/bin/bash
# AI 知识学习工作台自动部署脚本
# 每 2 小时检测一次知识库变化，有变化则自动编译部署

set -e

# 配置
VAULT_DIR="/Users/xucheng/Documents/c 徐的知识库"
PROJECT_DIR="/Users/xucheng/Documents/Codex项目/AI知识学习工作台"
PUBLISH_DIR="/Users/xucheng/Documents/知识库工作台-publish"
FP_FILE="/Users/xucheng/.workbuddy/workbench_deploy_fp.txt"
LOG_FILE="/Users/xucheng/.workbuddy/workbench_autodeploy.log"
NODE_BIN="/opt/homebrew/bin/node"

# 确保日志目录存在
mkdir -p "$(dirname "$LOG_FILE")"
mkdir -p "$(dirname "$FP_FILE")"

# 日志函数
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

log "========== 自动部署检测开始 =========="

# 计算当前知识库指纹（只统计 md 文件的内容哈希）
CURRENT_FP=$(find "$VAULT_DIR" -name "*.md" -type f -exec cat {} \; | md5 | awk '{print $1}')
log "当前知识库指纹: $CURRENT_FP"

# 读取上一次部署指纹
if [ -f "$FP_FILE" ]; then
    LAST_FP=$(cat "$FP_FILE")
    log "上一次部署指纹: $LAST_FP"
else
    LAST_FP=""
    log "上一次部署指纹: 无（首次运行）"
fi

# 对比指纹
if [ "$CURRENT_FP" = "$LAST_FP" ]; then
    log "知识库无变化，跳过部署"
    log "========== 自动部署检测结束 =========="
    exit 0
fi

log "检测到知识库变化，开始部署..."

# 1. 运行 generate.js 编译
log "运行 generate.js 编译..."
cd "$PROJECT_DIR"
$NODE_BIN generate.js >> "$LOG_FILE" 2>&1
log "✅ 编译完成"

# 2. 同步编译产物到发布目录
log "同步编译产物到发布目录..."
cp "$PROJECT_DIR/index.html" "$PUBLISH_DIR/index.html"
cp "$PROJECT_DIR/mobile.html" "$PUBLISH_DIR/mobile.html"
log "✅ 同步完成"

# 3. 提交并 push 到 GitHub Pages
log "提交并 push 到 GitHub Pages..."
cd "$PUBLISH_DIR"
git add -A >> "$LOG_FILE" 2>&1
git commit -m "自动部署：知识库更新 $(date '+%Y-%m-%d %H:%M')" >> "$LOG_FILE" 2>&1
git push origin main >> "$LOG_FILE" 2>&1
log "✅ 部署完成"

# 4. 更新指纹文件
echo "$CURRENT_FP" > "$FP_FILE"
log "✅ 指纹已更新: $CURRENT_FP"

log "========== 自动部署检测结束 =========="
