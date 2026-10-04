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
PYTHON_DIR="$SCRIPTS_DIR/python"
GIT_CLEAN="$SCRIPTS_DIR/shell/git-clean.sh"
GET_CDN="$PYTHON_DIR/get_cdn.py"
BUILD_CHUNKS="$PYTHON_DIR/build_chunks.py"
UNICODE_GAP="$PYTHON_DIR/unicode_gap.py"
FONT_RANGE="$PYTHON_DIR/font_range.py"
PY_REQUIREMENTS="$PYTHON_DIR/requirements.txt"

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

# ---------- Python 虚拟环境相关辅助 ----------

find_python_venv() {
    local candidates=(
        "$PYTHON_DIR/.venv"
        "$ROOT_DIR/.venv"
    )
    local v
    for v in "${candidates[@]}"; do
        if [[ -x "$v/bin/python" ]]; then
            echo "$v"
            return 0
        fi
    done
    return 1
}

is_uv_venv() {
    local venv="$1"
    [[ -f "$venv/pyvenv.cfg" ]] && grep -qE '^[[:space:]]*uv[[:space:]]*=' "$venv/pyvenv.cfg" 2>/dev/null
}

pick_uv() {
    local venv="$1"
    if [[ -x "$venv/bin/uv" ]]; then
        echo "$venv/bin/uv"
        return 0
    fi
    if command -v uv >/dev/null 2>&1; then
        echo "uv"
        return 0
    fi
    return 1
}

_freeze_to_file() {
    local pip_bin="$1"
    local out_file="$2"
    "$pip_bin" freeze > "$out_file"
}

_uv_freeze_to_file() {
    local uv_bin="$1"
    local py_bin="$2"
    local out_file="$3"
    "$uv_bin" pip freeze --python "$py_bin" > "$out_file"
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

    local cmd="$1"; shift

    local dry_flag="-d"
    [[ "$cmd" == *":real" ]] && dry_flag=""

    local pattern=""
    local prefix_flag=""
    if [[ $# -gt 0 ]]; then
        pattern="$1"; shift
        if [[ "$pattern" == *":prefix" ]]; then
            prefix_flag="-p"
            pattern="${pattern%:prefix}"
        fi
    fi

    local args=()
    [[ -n "$pattern"     ]] && args+=(-m "$pattern")
    [[ -n "$prefix_flag" ]] && args+=("$prefix_flag")
    [[ -n "$dry_flag"   ]] && args+=("$dry_flag")

    confirm_run "清理已合并分支" bash "$GIT_CLEAN" "${args[@]}"
}

cmd_get_cdn() {
    require_file "$GET_CDN"
    confirm_run "从 jsDelivr CDN 下载整个文件夹" python3 "$GET_CDN" "$@"
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

# ---------- Python 依赖管理 ----------

cmd_py_freeze() {
    local venv
    if ! venv="$(find_python_venv)"; then
        echo -e "${RED}找不到可用的虚拟环境${NC}" >&2
        echo "请先在以下位置之一创建 .venv：" >&2
        echo "  $PYTHON_DIR/.venv" >&2
        echo "  $ROOT_DIR/.venv" >&2
        return 1
    fi

    local py="$venv/bin/python"
    echo -e "${CYAN}使用虚拟环境: $venv${NC}"

    if is_uv_venv "$venv"; then
        local uv_bin
        if uv_bin="$(pick_uv "$venv")"; then
            confirm_run "生成 requirements.txt (uv pip freeze → $PY_REQUIREMENTS)" \
                _uv_freeze_to_file "$uv_bin" "$py" "$PY_REQUIREMENTS"
            return
        fi
        echo -e "${YELLOW}警告: 该 venv 由 uv 创建，但找不到 uv，将回退到 pip${NC}"
    fi

    if [[ ! -x "$venv/bin/pip" ]]; then
        echo -e "${RED}该 venv 中找不到 pip（uv 创建的 venv 默认不包含 pip）${NC}" >&2
        return 1
    fi

    confirm_run "生成 requirements.txt (pip freeze > $PY_REQUIREMENTS)" \
        _freeze_to_file "$venv/bin/pip" "$PY_REQUIREMENTS"
}

cmd_py_install() {
    local venv
    if ! venv="$(find_python_venv)"; then
        echo -e "${RED}找不到可用的虚拟环境，跳过安装${NC}" >&2
        echo "请先在以下位置之一创建 .venv：" >&2
        echo "  $PYTHON_DIR/.venv" >&2
        echo "  $ROOT_DIR/.venv" >&2
        return 1
    fi

    if [[ ! -f "$PY_REQUIREMENTS" ]]; then
        echo -e "${RED}找不到依赖文件: $PY_REQUIREMENTS${NC}" >&2
        echo "可先运行: ./blog.sh py-freeze" >&2
        return 1
    fi

    local py="$venv/bin/python"
    echo -e "${CYAN}使用虚拟环境: $venv${NC}"

    if is_uv_venv "$venv"; then
        local uv_bin
        if uv_bin="$(pick_uv "$venv")"; then
            confirm_run "安装依赖 (uv pip install -r $PY_REQUIREMENTS)" \
                "$uv_bin" pip install --python "$py" -r "$PY_REQUIREMENTS"
            return
        fi
        echo -e "${YELLOW}警告: 该 venv 由 uv 创建，但找不到 uv，将回退到 pip${NC}"
    fi

    if [[ ! -x "$venv/bin/pip" ]]; then
        echo -e "${RED}该 venv 中找不到 pip，无法安装依赖${NC}" >&2
        echo "如需 uv 管理的 venv，请确保 uv 位于 PATH 或 venv 的 bin 目录中" >&2
        return 1
    fi

    confirm_run "安装依赖 (pip install -r $PY_REQUIREMENTS)" \
        "$venv/bin/pip" install -r "$PY_REQUIREMENTS"
}

cmd_release() {
    local ver="${1:-}"

    if [[ -z "$ver" ]]; then
        echo -e "${RED}错误: 缺少版本号参数${NC}" >&2
        echo "用法: ./blog.sh release <version|major|minor|patch> [commit-message]" >&2
        return 1
    fi

    case "$ver" in
        major|minor|patch) ;;
        *)
            if [[ ! "$ver" =~ ^[0-9]+\.[0-9]+\.[0-9]+([-+][0-9A-Za-z.-]+)?$ ]]; then
                echo -e "${RED}错误: 无效的版本号 '$ver'${NC}" >&2
                echo "      应为 major / minor / patch，或 semver 格式（如 1.2.3）" >&2
                return 1
            fi
            ;;
    esac

    local current new_ver
    current=$(node -p "require('./package.json').version")
    case "$ver" in
        major) new_ver=$(awk -F. '{printf "%d.0.0", $1+1}' <<<"$current") ;;
        minor) new_ver=$(awk -F. '{printf "%d.%d.0", $1, $2+1}' <<<"$current") ;;
        patch) new_ver=$(awk -F. '{printf "%d.%d.%d", $1, $2, $3+1}' <<<"$current") ;;
        *)     new_ver="$ver" ;;
    esac

    local msg="${2:-version: bump to %s}"

    confirm_run "发布新版本（输入: ${ver} → 实际: ${new_ver}, 当前: ${current}）" \
        npm version "$ver" -m "$msg"
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

    clean-branches[:real] <pattern>[:prefix]
                                清理已合并的分支（试运行 -d）
                                可以使用 :real（实际执行，谨慎！）
                                pattern 后加 :prefix 则为前缀匹配（-p）
                                例: ./blog.sh clean-branches feat
                                    ./blog.sh clean-branches feat:prefix
                                    ./blog.sh clean-branches:real feat
                                    ./blog.sh clean-branches:real feat:prefix

    get-cdn <url> [...args]     从 jsDelivr CDN 下载整个文件夹
                                例: ./blog.sh get-cdn https://cdn.jsdelivr.net/npm/pkg/
                                    ./blog.sh get-cdn https://cdn.jsdelivr.net/npm/pkg/ -o ./out -j 8

    build-chunks  [...args]     构建 subject/episode 分片
                                例: ./blog.sh build-chunks --subject-chunk 1000

    unicode-gap   [...args]     查找 Unicode 码位空缺
                                例: ./blog.sh unicode-gap -i ./assets/list.txt -v

    font-range    [...args]     提取字体 unicode-range
                                例: ./blog.sh font-range ./fonts
                                    ./blog.sh font-range ./fonts -o all.md

    py-freeze                   从虚拟环境生成 script/python/requirements.txt
                                venv 查找优先级：script/python/.venv → 根目录 .venv
                                自动识别 uv / pip

    py-install                  依据 script/python/requirements.txt 安装依赖
                                venv 查找优先级：script/python/.venv → 根目录 .venv
                                自动识别 uv / pip；找不到 venv 则不安装

    release <version> [msg]     发布新版本（更新 package.json + git commit + tag）
                                version 为 major / minor / patch，或 semver（如 1.2.3）
                                msg 缺省为 "version: bump to <新版本号>"
                                例: ./blog.sh release patch
                                    ./blog.sh release minor "feat: 新增 xxx"
                                    ./blog.sh release 1.2.0 "chore: 固定版本"

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
    get-cdn)            shift; cmd_get_cdn "$@" ;;
    build-chunks)       shift; cmd_build_chunks "$@" ;;
    unicode-gap)        shift; cmd_unicode_gap "$@" ;;
    font-range)         shift; cmd_font_range "$@" ;;
    py-freeze)          cmd_py_freeze ;;
    py-install)         cmd_py_install ;;
    release)            shift; cmd_release "$@" ;;
    help|-h|--help|"")  cmd_help ;;
    *)
        echo -e "${RED}未知命令: $1${NC}"
        echo ""
        cmd_help
        exit 1
        ;;
esac
