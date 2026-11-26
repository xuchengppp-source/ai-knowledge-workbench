#!/bin/bash
# AI 知识学习工作台自动部署脚本
# 每 2 小时检测一次知识库变化，有变化则自动编译部署

set -e

# 配置
VAULT_DIR="/Users/xucheng/Documents/c 徐的知识库"
PROJECT_DIR="/Users/xucheng/Documents/Codex项目/AI知识学习工作台"
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

# 采集发现数据：独立于知识库指纹，每次都重算，保证「采集发现」页跟随每 2 小时采集轮次
log "重建采集发现数据（build-collected.js）..."
cd "$PROJECT_DIR"
$NODE_BIN build-collected.js >> "$LOG_FILE" 2>&1 && log "✅ 采集数据已重建" || log "⚠️ 采集数据重建失败，沿用上一版"

# 对比指纹
if [ "$CURRENT_FP" = "$LAST_FP" ]; then
    # 知识库没变化，但采集数据可能有更新，仍需提交 collected.js
    git add -- collected.js >> "$LOG_FILE" 2>&1
    if git diff --cached --quiet; then
        log "知识库与采集数据均无变化，跳过部署"
        log "========== 自动部署检测结束 =========="
        exit 0
    fi
    git commit -m "自动部署：采集发现数据 $(date '+%Y-%m-%d %H:%M')" >> "$LOG_FILE" 2>&1
    git push origin main >> "$LOG_FILE" 2>&1
    log "✅ 采集数据已部署"
    log "========== 自动部署检测结束 =========="
    exit 0
fi

log "检测到知识库变化，开始部署..."

# 1. 运行 generate.js 编译
log "运行 generate.js 编译..."
cd "$PROJECT_DIR"
$NODE_BIN generate.js --out "$PROJECT_DIR" >> "$LOG_FILE" 2>&1
log "✅ 编译完成"

# 2. Publish from the source checkout to avoid a stale, diverged publisher clone.
log "准备从源仓库发布生成文件..."
cd "$PROJECT_DIR"
if ! git diff --cached --quiet; then
    log "检测到预先暂存的变更，停止自动发布以避免合并无关提交"
    exit 1
fi
git add -- index.html mobile.html my-insights.html knowledge-discovery.html data.js docs.js docs-*.js collected.js >> "$LOG_FILE" 2>&1
if git diff --cached --quiet; then
    log "没有生成文件变化，跳过 commit/push"
    echo "$CURRENT_FP" > "$FP_FILE"
    log "✅ 指纹已更新: $CURRENT_FP"
    log "========== 自动部署检测结束 =========="
    exit 0
fi
git commit -m "自动部署：知识库更新 $(date '+%Y-%m-%d %H:%M')" >> "$LOG_FILE" 2>&1
git push origin main >> "$LOG_FILE" 2>&1
log "✅ 部署完成"

# 4. 更新指纹文件
echo "$CURRENT_FP" > "$FP_FILE"
log "✅ 指纹已更新: $CURRENT_FP"

log "========== 自动部署检测结束 =========="
