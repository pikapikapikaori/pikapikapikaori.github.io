#!/bin/bash

docs_base=docs
version_global=4.8.0
projects=(root homepage indexpage grammar bangumi_takeout)
dir_root=''
dir_homepage=pages/homepage
dir_indexpage=pages/indexpage
dir_grammar=apps/grammar
dir_bangumi_takeout=apps/bangumi-takeout
version_grammar=1.0.0
version_bangumi_takeout=1.1.0

exclude_paths_builtin=(node_modules Thumbs.db desktop.ini sw.js assets/resources/meta/file-cache.json)

p1_exts=(html js mjs css md json woff woff2 ttf otf eot cmo3 moc3 can3)
p2_exts=(svg png jpg jpeg gif webp avif ico bmp apng tif tiff heic heif jxl mp4 webm ogv ogg mov m4v avi mkv mpg mpeg m2ts 3gp zip csv)

# 可选 exclude_paths_global、exclude_exts_global 及对应项目后缀数组缺省为空。
# 路径排除按完整路径片段匹配；项目规则相对该项目根目录。
# batch_paths_1、batch_paths_2、batch_paths_3 为相对 docs 的精确文件路径。

check_mode=0
case "${1:-}" in
    '') ;;
    --check) check_mode=1 ;;
    *) echo '用法：bash script/shell/file-cache.sh [--check]' >&2; exit 1 ;;
esac
if [ "$#" -gt 1 ]; then exit 1; fi

export LC_ALL=C
created_build_lib=0
if [ ! -d build-lib ]; then
    mkdir -p build-lib || exit 1
    created_build_lib=1
fi
cleanup() {
    if [ -n "${work_dir:-}" ]; then rm -rf "$work_dir"; fi
    if [ "$created_build_lib" -eq 1 ]; then rmdir build-lib 2>/dev/null || :; fi
}
trap cleanup EXIT
work_dir=$(mktemp -d build-lib/file-cache.XXXXXX) || exit 1
trap 'exit 1' HUP INT TERM
failed=0

json_escape() {
    local s="$1" ch code i
    for ((i=0; i<${#s}; i++)); do
        ch="${s:i:1}"
        case "$ch" in
            '\') printf '\\\\' ;;
            '"') printf '\\"' ;;
            *)
                printf -v code '%d' "'$ch"
                if [ "$code" -ge 0 ] && [ "$code" -lt 32 ]; then
                    printf '\\u%04x' "$code"
                else
                    printf '%s' "$ch"
                fi
                ;;
        esac
    done
}

is_fragment() {
    case "$1" in
        "$2"|"$2"/*|*/"$2"|*/"$2"/*) return 0 ;;
    esac
    return 1
}

is_ext_match() {
    local name="$1" ext item
    shift
    case "$name" in *.*) ext="${name##*.}" ;; *) return 1 ;; esac
    shopt -s nocasematch
    for item in "$@"; do
        if [[ "$ext" == "$item" ]]; then shopt -u nocasematch; return 0; fi
    done
    shopt -u nocasematch
    return 1
}

hash16() {
    local sum
    # 从 stdin 读取，避免特殊文件名改变 shasum 的输出格式。
    if command -v shasum >/dev/null 2>&1; then
        sum=$(shasum -a 256 < "$1") || return 1
    else
        sum=$(sha256sum < "$1") || return 1
    fi
    printf '%s' "${sum:0:16}"
}

load_project() {
    local project="$1"
    dir=''
    version="$version_global"
    exclude_paths=()
    exclude_exts=()
    eval 'dir=${dir_'"$project"'-}'
    eval 'version=${version_'"$project"'-"$version_global"}'
    eval 'exclude_paths=("${exclude_paths_'"$project"'[@]}")'
    eval 'exclude_exts=("${exclude_exts_'"$project"'[@]}")'
    base="$docs_base${dir:+/$dir}"
}

is_excluded() {
    local rel="$1" frag
    case "/$rel" in */.*) return 0 ;; esac
    for frag in "${exclude_paths_builtin[@]}" "${exclude_paths_global[@]}" "${exclude_paths[@]}"; do
        if [ -n "$frag" ] && is_fragment "$rel" "$frag"; then return 0; fi
    done
    is_ext_match "${rel##*/}" "${exclude_exts_global[@]}" "${exclude_exts[@]}"
}

for priority in 1 2 3; do
    eval 'rules=("${batch_paths_'"$priority"'[@]}")'
    for rule in "${rules[@]}"; do
        case "$rule" in
            ''|/*|./*|../*|*/../*|*/..|*/./*|*/.|*//*|*/) echo "无效批次路径 $rule" >&2; exit 1 ;;
        esac
        if [ ! -f "$docs_base/$rule" ]; then echo "批次路径不存在或非文件 $rule" >&2; exit 1; fi
        for other in 1 2 3; do
            if [ "$other" = "$priority" ]; then continue; fi
            eval 'others=("${batch_paths_'"$other"'[@]}")'
            for candidate in "${others[@]}"; do
                if [ "$candidate" = "$rule" ]; then echo "批次规则冲突 $rule" >&2; exit 1; fi
            done
        done
        for project in "${projects[@]}"; do
            load_project "$project"
            if [ -n "$dir" ]; then
                case "$rule" in "$dir"/*) rel="${rule#"$dir"/}" ;; *) continue ;; esac
            else
                rel="$rule"
            fi
            if is_excluded "$rel"; then echo "批次路径已排除 [$project] $rule" >&2; exit 1; fi
        done
    done
done

for project in "${projects[@]}"; do
    load_project "$project"
    if ! find "$base" -type f -print0 > "$work_dir/all"; then failed=1; break; fi
    : > "$work_dir/list"
    while IFS= read -r -d '' abs; do
        rel="${abs#"$base"/}"
        if ! is_excluded "$rel"; then printf '%s\0' "$rel" >> "$work_dir/list"; fi
    done < "$work_dir/all"
    if ! sort -z -u "$work_dir/list" -o "$work_dir/list"; then failed=1; break; fi
    for priority in 1 2 3; do : > "$work_dir/batch-$priority"; done
    count=0
    while IFS= read -r -d '' rel; do
        name="${rel##*/}"
        case "$name" in
            *.*)
                if is_ext_match "$name" "${p1_exts[@]}"; then priority=1
                elif is_ext_match "$name" "${p2_exts[@]}"; then priority=2
                else priority=3
                fi ;;
            *) priority=1 ;;
        esac
        docs_rel="${dir:+$dir/}$rel"
        for override in 1 2 3; do
            eval 'rules=("${batch_paths_'"$override"'[@]}")'
            for rule in "${rules[@]}"; do
                if [ "$rule" = "$docs_rel" ]; then priority="$override"; fi
            done
        done
        abs="$base/$rel"
        if ! h=$(hash16 "$abs") || ! size=$(wc -c < "$abs"); then failed=1; break; fi
        size="${size//[[:space:]]/}"
        if [ -s "$work_dir/batch-$priority" ]; then printf ',\n' >> "$work_dir/batch-$priority"; fi
        {
            printf '                {"path": "'
            json_escape "$rel"
            printf '", "hash": "%s", "size": %s}' "$h" "$size"
        } >> "$work_dir/batch-$priority"
        count=$((count + 1))
    done < "$work_dir/list"
    if [ "$failed" -ne 0 ]; then break; fi
    # 总 hash 取此确定 JSON 的字节，包含 schemaVersion、策略及排序后的文件项。
    {
        printf '{\n    "schemaVersion": 2,\n    "batches": [\n'
        for priority in 1 2 3; do
            case "$priority" in 1) mode=precache ;; 2) mode=on-demand ;; 3) mode=network-only ;; esac
            printf '        {\n            "priority": %s,\n            "mode": "%s",\n            "files": [\n' "$priority" "$mode"
            cat "$work_dir/batch-$priority"
            if [ -s "$work_dir/batch-$priority" ]; then printf '\n'; fi
            printf '            ]\n        }'
            if [ "$priority" -lt 3 ]; then printf ','; fi
            printf '\n'
        done
        printf '    ]\n}\n'
    } > "$work_dir/policy"
    if ! total=$(hash16 "$work_dir/policy"); then failed=1; break; fi
    {
        printf '{\n    "version": "'
        json_escape "$version"
        printf '",\n    "hash": "%s",\n' "$total"
        tail -n +2 "$work_dir/policy"
    } > "$work_dir/$project.json"
    echo "[$project] $count 个文件 hash $total"
done

if [ "$failed" -ne 0 ]; then echo '清单生成失败' >&2; exit 1; fi
for project in "${projects[@]}"; do
    load_project "$project"
    manifest_path="$base/assets/resources/meta/file-cache.json"
    if [ "$check_mode" -eq 1 ]; then
        if cmp -s "$work_dir/$project.json" "$manifest_path"; then
            echo "[$project] 已是最新"
        else
            echo "[$project] 需要更新"
            failed=1
        fi
    elif ! cp "$work_dir/$project.json" "$manifest_path"; then
        failed=1
    fi
done
exit "$failed"
