#!/bin/bash
# 清理已合并到 origin/master 且满足分支名匹配条件的本地和远程分支（安全删除）
# 匹配方式：默认包含（子串），可通过 -p 改为前缀匹配
# 用法: ./git_clean.sh -m <字符串> [--dry-run] [--prefix] [--help]

set -euo pipefail

# ---------- 默认配置 ----------
REMOTE="origin"
PROTECTED=("master" "main" "develop")
DRY_RUN=false
MATCH_STRING=""          # 匹配字符串
MATCH_TYPE="contains"    # 可选 "contains" 或 "prefix"

# 计数器（仅在 dry-run 模式下使用）
COUNT_LOCAL=0
COUNT_REMOTE=0

# ---------- 解析命令行参数 ----------
show_help() {
    cat <<EOF
用法: $0 -m <字符串> [选项]

选项:
    -m, --match <字符串>   指定用于匹配分支名的字符串（必填）
    -p, --prefix           使用前缀匹配（默认是包含匹配，即子串）
    -d, --dry-run          试运行，只列出会被删除的分支，不执行实际删除
    -h, --help             显示此帮助信息

说明:
    - 删除条件：① 分支已完全合并到 origin/master
                ② 分支名匹配指定的字符串（默认包含，若加 -p 则前缀）
    - 同时清理本地分支和远程（$REMOTE）分支
    - 保护分支 (${PROTECTED[@]}) 不会被删除
    - 脚本会自动切换到保护分支，避免删除当前所在分支
    - 本地分支使用 git branch -d（安全删除，仅当已合并时成功）
    - 远程分支使用 git push --delete
    - dry-run 模式下会统计将删除的分支数量
EOF
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        -m|--match)
            if [[ -z "${2:-}" ]]; then
                echo "错误: -m/--match 需要指定一个字符串参数"
                exit 1
            fi
            MATCH_STRING="$2"
            shift 2
            ;;
        -p|--prefix)
            MATCH_TYPE="prefix"
            shift
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            echo "未知参数: $1"
            show_help
            exit 1
            ;;
    esac
done

# 检查是否指定了匹配字符串
if [[ -z "$MATCH_STRING" ]]; then
    echo "错误: 必须使用 -m/--match 指定匹配字符串"
    show_help
    exit 1
fi

# ---------- 工具函数 ----------
is_protected() {
    local branch="$1"
    for p in "${PROTECTED[@]}"; do
        if [[ "$branch" == "$p" ]]; then
            return 0
        fi
    done
    return 1
}

# 检查分支是否已合并到 origin/master
is_merged_to_master() {
    local branch="$1"
    local ahead_count
    ahead_count=$(git rev-list --count "origin/master..$branch" 2>/dev/null || echo "1")
    [[ "$ahead_count" -eq 0 ]]
}

# 检查分支名是否匹配（根据匹配类型）
matches_filter() {
    local branch="$1"
    if [[ "$MATCH_TYPE" == "prefix" ]]; then
        [[ "$branch" == "$MATCH_STRING"* ]]
    else  # contains
        [[ "$branch" == *"$MATCH_STRING"* ]]
    fi
}

# ---------- 开始执行 ----------
echo "=== 清理已合并到 origin/master 的分支 ==="
echo "远程仓库: $REMOTE"
echo "匹配字符串: $MATCH_STRING"
echo "匹配方式: $([ "$MATCH_TYPE" == "prefix" ] && echo "前缀" || echo "包含（子串）")"
echo "模式: $([ "$DRY_RUN" = true ] && echo "试运行 (仅预览)" || echo "实际删除")"
echo "----------------------"

# 更新远程信息
git fetch --prune

# 切换到一个保护分支
git checkout master 2>/dev/null || git checkout main 2>/dev/null || true

# ---------- 清理本地分支 ----------
echo ">>> 处理本地分支..."
for branch in $(git branch --format='%(refname:short)'); do
    if is_protected "$branch"; then
        echo "  [跳过] $branch (保护分支)"
        continue
    fi
    if ! matches_filter "$branch"; then
        echo "  [跳过] $branch (不匹配)"
        continue
    fi
    if ! is_merged_to_master "$branch"; then
        echo "  [跳过] $branch (未合并到 origin/master)"
        continue
    fi
    if [[ "$DRY_RUN" == true ]]; then
        echo "  [将删除] $branch"
        ((COUNT_LOCAL++))
    else
        echo "  [删除] $branch"
        if ! git branch -d "$branch" 2>/dev/null; then
            echo "  [警告] 无法安全删除 $branch (可能未完全合并)，跳过"
        fi
    fi
done

# ---------- 清理远程分支 ----------
echo ""
echo ">>> 处理远程分支..."
for branch in $(git branch -r --merged "origin/master" | grep -v "HEAD" | sed 's/.*\///'); do
    if is_protected "$branch"; then
        echo "  [跳过] $branch (保护分支)"
        continue
    fi
    if ! matches_filter "$branch"; then
        echo "  [跳过] $branch (不匹配)"
        continue
    fi
    remote_branch="$REMOTE/$branch"
    if [[ "$DRY_RUN" == true ]]; then
        echo "  [将删除] $remote_branch"
        ((COUNT_REMOTE++))
    else
        echo "  [删除] $remote_branch"
        git push "$REMOTE" --delete "$branch"
    fi
done

# ---------- 输出统计信息 ----------
echo "----------------------"
if [[ "$DRY_RUN" == true ]]; then
    echo "试运行总结: 将删除 $COUNT_LOCAL 个本地分支，$COUNT_REMOTE 个远程分支"
fi
echo "完成！"
