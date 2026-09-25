#!/bin/bash
# blog.sh - pikapikapi-blog 统一命令管理器
# 所有命令在执行前会先展示完整命令并请求确认

set -euo pipefail

# ---------- 颜色 ----------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ---------- 项目根目录 ----------
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# ---------- 激活 venv（如果存在）----------
if [[ -f "$ROOT_DIR/.venv/bin/activate" ]]; then
    source "$ROOT_DIR/.venv/bin/activate"
fi

# ---------- 外部脚本路径（按需修改）----------
SCRIPTS_DIR="$ROOT_DIR/script"
GIT_CLEAN="$SCRIPTS_DIR/shell/git-clean.sh"
BUILD_CHUNKS="$SCRIPTS_DIR/python/build_chunks.py"
UNICODE_GAP="$SCRIPTS_DIR/python/unicode_gap.py"
FONT_RANGE="$SCRIPTS_DIR/python/font_range.py"

# ---------- rclone 配置 ----------
RCLONE_SRC="docs/"
RCLONE_DST="r2:pikapikapi-blog/"
RCLONE_OPTS=(--exclude "**/.DS_Store" --exclude ".DS_Store" --exclude "**/node_modules/**" --exclude "**/hexo/package-lock.json" --exclude "**/hexo/db.json" --checksum)

# ---------- 核心：展示命令 -> 确认 -> 执行 ----------
confirm_run() {
    local desc="$1"; shift

    echo ""
    echo -e "${CYAN}${BOLD}▶ ${desc}${NC}"
    printf "${YELLOW}\$"
    printf ' %q' "$@"
    printf "${NC}\n\n"

    read -r -p "$(echo -e "${BOLD}确认执行? [Y/N] ${NC}")" ans
    if [[ "$ans" =~ ^[yY]([eE][sS])?$ ]]; then
        echo -e "${GREEN}--- 开始执行 ---${NC}"
        if "$@"; then
            echo -e "${GREEN}--- 执行结束 ---${NC}"
        else
            local rc=$?
            echo -e "${RED}命令失败 (exit=$rc)${NC}"
            return $rc
        fi
    else
        echo -e "${RED}已取消${NC}"
        return 0
    fi
}

# 检查外部脚本是否存在
require_file() {
    if [[ ! -f "$1" ]]; then
        echo -e "${RED}找不到脚本: $1${NC}" >&2
        exit 1
    fi
}

# ---------- 各命令实现 ----------
cmd_serve() {
    confirm_run "启动 docsify 本地服务" npm start
}

cmd_lint() {
    confirm_run "运行 ESLint 检查" npm run lint
}

cmd_lint_fix() {
    confirm_run "运行 ESLint 自动修复" npm run lint:fix
}

cmd_sync() {
    confirm_run "rclone 同步到 R2（试运行，不写远端）" \
        rclone sync "$RCLONE_SRC" "$RCLONE_DST" --dry-run "${RCLONE_OPTS[@]}"
}

cmd_sync_real() {
    confirm_run "rclone 同步到 R2（实际执行，请谨慎）" \
        rclone sync "$RCLONE_SRC" "$RCLONE_DST" "${RCLONE_OPTS[@]}"
}

cmd_clean_branches() {
    require_file "$GIT_CLEAN"

    # $1 形如 "clean-branches" 或 "clean-branches:real"
    local cmd="$1"; shift

    local dry_flag="-d"
    [[ "$cmd" == *":real" ]] && dry_flag=""

    # 解析位置参数 pattern[:prefix]
    local pattern=""
    local prefix_flag=""
    if [[ $# -gt 0 ]]; then
        pattern="$1"; shift
        if [[ "$pattern" == *":prefix" ]]; then
            prefix_flag="-p"
            pattern="${pattern%:prefix}"
        fi
    fi

    # 按原有顺序拼参数：-m <pattern> [-p] [-d]
    local args=()
    [[ -n "$pattern"     ]] && args+=(-m "$pattern")
    [[ -n "$prefix_flag" ]] && args+=("$prefix_flag")
    [[ -n "$dry_flag"   ]] && args+=("$dry_flag")

    confirm_run "清理已合并分支" bash "$GIT_CLEAN" "${args[@]}"
}

cmd_build_chunks() {
    require_file "$BUILD_CHUNKS"
    confirm_run "构建 JSONLines 分片" python3 "$BUILD_CHUNKS" "$@"
}

cmd_unicode_gap() {
    require_file "$UNICODE_GAP"
    confirm_run "查找 Unicode 码位空缺" python3 "$UNICODE_GAP" "$@"
}

cmd_font_range() {
    require_file "$FONT_RANGE"
    confirm_run "提取字体 unicode-range" python3 "$FONT_RANGE" "$@"
}

cmd_help() {
    cat <<EOF
用法: ./blog.sh <command> [args...]

所有命令在执行前会先展示完整命令并请求确认 (Y/N)。

命令:
    serve                       启动 docsify 本地服务 (npm start)

    lint[:fix]                  运行 ESLint 检查
                                可以使用 :fix 来运行 ESLint 自动修复

    sync[:real]                 同步 docs/ 到 R2（试运行 --dry-run）
                                可以使用 :real（实际执行，谨慎！）

    clean-branches[:real] [pattern[:prefix]] 
                                清理已合并的分支（试运行 -d）
                                可以使用 :real（实际执行，谨慎！）
                                pattern 后加 :prefix 则为前缀匹配（-p）
                                例: ./blog.sh clean-branches feat
                                    ./blog.sh clean-branches feat:prefix
                                    ./blog.sh clean-branches:real feat
                                    ./blog.sh clean-branches:real feat:prefix

    build-chunks  [...args]     构建 subject/episode 分片
                                例: ./blog.sh build-chunks --subject-chunk 1000

    unicode-gap   [...args]     查找 Unicode 码位空缺
                                例: ./blog.sh unicode-gap -i ./assets/list.txt -v

    font-range    [...args]     提取字体 unicode-range
                                例: ./blog.sh font-range ./fonts
                                    ./blog.sh font-range ./fonts -o all.md

    help                         显示此帮助
EOF
}

# ---------- 分发 ----------
case "${1:-help}" in
    serve)              shift; cmd_serve "$@" ;;
    lint)               shift; cmd_lint "$@" ;;
    lint:fix)           shift; cmd_lint_fix "$@" ;;
    sync)               shift; cmd_sync "$@" ;;
    sync:real)          shift; cmd_sync_real "$@" ;;
    clean-branches|clean-branches:real) cmd_clean_branches "$@" ;;
    build-chunks)       shift; cmd_build_chunks "$@" ;;
    unicode-gap)        shift; cmd_unicode_gap "$@" ;;
    font-range)         shift; cmd_font_range "$@" ;;
    help|-h|--help|"")  cmd_help ;;
    *)
        echo -e "${RED}未知命令: $1${NC}"
        echo ""
        cmd_help
        exit 1
        ;;
esac
