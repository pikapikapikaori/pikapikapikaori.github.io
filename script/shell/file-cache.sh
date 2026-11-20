#!/bin/bash

# 生成并校验各项目 assets/resources/meta/file-cache.json。
# 用法：bash script/shell/file-cache.sh [--check]

docs_base=docs
check_mode=0
if [ "${1:-}" = '--check' ]; then
    check_mode=1
fi
failed=0

allowed_exts=(html js mjs css md json svg png jpg jpeg gif webp avif ico woff woff2 ttf otf eot mp4 zip cmo3 moc3 can3)

# 匹配规则对每个项目都生效 整段相等 或以 / 分隔的前缀 后缀 或出现在中间都算命中
exclude_paths_global=(
    node_modules
    package-lock.json
    db.json
    sw.js
    assets/resources/meta/file-cache.json
)

projects=(root homepage indexpage light grammar bangumi_takeout)

id_root=root
version_root=4.7.5
dir_root=''
include_root=(index.html 404 About.md Beginning.md Photograph.md Sites.md _coverpage.md _footer.md _navbar.md _sidebar.md README.md assets apps pages writings archive jp en-us _media)
exclude_paths_root=(writings/_media/PersonalRecordsBackup archive/ITtech/_media/SoftwareInsights-20230428/virtualPetHospital-backend-master.zip archive/ITtech/_media/SoftwareInsights-20230428/virtualPetHospital-frontend-main.zip)
exclude_exts_root=()

id_homepage=homepage
version_homepage=4.7.5
dir_homepage=pages/homepage
include_homepage=(index.html assets)
exclude_paths_homepage=()
exclude_exts_homepage=()

id_indexpage=indexpage
version_indexpage=4.7.5
dir_indexpage=pages/indexpage
include_indexpage=(index.html assets data)
exclude_paths_indexpage=()
exclude_exts_indexpage=()

id_light=light
version_light=1.1.1
dir_light=pages/light
include_light=(index.html assets helpers ../../404 ../../assets ../../writings ../../archive ../../jp ../../en-us ../../_media)
exclude_paths_light=(writings/_media/PersonalRecordsBackup ../../archive/ITtech/_media/SoftwareInsights-20230428/virtualPetHospital-backend-master.zip ../../archive/ITtech/_media/SoftwareInsights-20230428/virtualPetHospital-frontend-main.zip)
exclude_exts_light=(jpg jpeg png gif webp avif mp4 zip)

id_grammar=grammar
version_grammar=1.0.0
dir_grammar=apps/grammar
include_grammar=(index.html assets data)
exclude_paths_grammar=()
exclude_exts_grammar=()

id_bangumi_takeout=bangumi-takeout
version_bangumi_takeout=1.1.0
dir_bangumi_takeout=apps/bangumi-takeout
include_bangumi_takeout=(index.html assets data)
exclude_paths_bangumi_takeout=()
exclude_exts_bangumi_takeout=()

tmp_all="$(mktemp)"
tmp_list="$(mktemp)"
tmp_body="$(mktemp)"
tmp_manifest="$(mktemp)"
tmp_combined="$(mktemp)"
trap 'rm -f "$tmp_all" "$tmp_list" "$tmp_body" "$tmp_manifest" "$tmp_combined"' EXIT

normalize() {
    local p="$1"
    while [ "${p%/}" != "$p" ]; do p="${p%/}"; done
    while [ "${p#./}" != "$p" ]; do p="${p#./}"; done
    printf '%s' "$p"
}

json_escape() {
    local s="$1"
    s="${s//\\/\\\\}"
    s="${s//\"/\\\"}"
    printf '%s' "$s"
}

is_fragment() {
    local rel="$1"
    local frag="$2"
    if [ "$rel" = "$frag" ]; then
        return 0
    fi
    case "$rel" in
        "$frag"/*|*/"$frag"|*/"$frag"/*) return 0 ;;
    esac
    return 1
}

is_ext_match() {
    local name="$1"
    shift
    if [ "$#" -eq 0 ]; then
        return 1
    fi
    case "$name" in
        *.*) ;;
        *) return 1 ;;
    esac
    local ext="${name##*.}"
    local item
    shopt -s nocasematch
    for item in "$@"; do
        if [[ "$ext" == "$item" ]]; then
            shopt -u nocasematch
            return 0
        fi
    done
    shopt -u nocasematch
    return 1
}

is_allowed_name() {
    local name="$1"
    case "$name" in
        .*) return 1 ;;
        *.*) ;;
        *) return 0 ;;
    esac
    is_ext_match "$name" "${allowed_exts[@]}"
}

hash16() {
    local sum
    if ! sum="$(shasum -a 256 "$1")"; then
        return 1
    fi
    sum="${sum%% *}"
    if [ -z "$sum" ]; then
        return 1
    fi
    printf '%s' "${sum:0:16}"
}

for id in "${projects[@]}"; do
    id_var="id_$id"
    version_var="version_$id"
    dir_var="dir_$id"
    include_var="include_$id"
    paths_var="exclude_paths_$id"
    exts_var="exclude_exts_$id"

    id_name="${!id_var}"
    version="${!version_var}"
    dir="${!dir_var}"
    include=()
    exclude_paths=()
    exclude_exts=()
    include_src="${include_var}[@]"
    paths_src="${paths_var}[@]"
    exts_src="${exts_var}[@]"
    for item in "${!include_src}"; do include+=("$item"); done
    for item in "${!paths_src}"; do exclude_paths+=("$item"); done
    for item in "${!exts_src}"; do exclude_exts+=("$item"); done

    if [ -n "$dir" ]; then
        base="$docs_base/$dir"
    else
        base="$docs_base"
    fi
    manifest_path="$base/assets/resources/meta/file-cache.json"

    : > "$tmp_all"
    missing=0
    for inc in "${include[@]}"; do
        p="$(normalize "$inc")"
        abs="$base/$p"
        if [ ! -e "$abs" ]; then
            echo "[$id_name] 缺少 $p"
            missing=1
            break
        fi
        if [ -d "$abs" ]; then
            if ! find "$abs" -type f -print0 >> "$tmp_all"; then
                echo "[$id_name] 遍历失败 $abs"
                missing=1
                break
            fi
        else
            printf '%s\0' "$abs" >> "$tmp_all"
        fi
    done
    if [ "$missing" -ne 0 ]; then
        failed=1
        continue
    fi

    : > "$tmp_list"
    while IFS= read -r -d '' abs; do
        rel="${abs#"$base"/}"
        name="${rel##*/}"
        if ! is_allowed_name "$name"; then
            continue
        fi
        skip=0
        for frag in "${exclude_paths_global[@]}"; do
            if is_fragment "$rel" "$frag"; then
                skip=1
                break
            fi
        done
        if [ "$skip" -ne 0 ]; then
            continue
        fi
        for frag in "${exclude_paths[@]}"; do
            if is_fragment "$rel" "$frag"; then
                skip=1
                break
            fi
        done
        if [ "$skip" -ne 0 ]; then
            continue
        fi
        if is_ext_match "$name" "${exclude_exts[@]}"; then
            continue
        fi
        printf '%s\0' "$rel" >> "$tmp_list"
    done < "$tmp_all"

    LC_ALL=C sort -z -u "$tmp_list" -o "$tmp_list"

    : > "$tmp_body"
    : > "$tmp_combined"
    count=0
    first=1
    hash_failed=0
    while IFS= read -r -d '' rel; do
        abs="$base/$rel"
        if ! h="$(hash16 "$abs")"; then
            echo "[$id_name] 读取失败 $abs"
            hash_failed=1
            break
        fi
        if [ "$first" -eq 1 ]; then
            first=0
        else
            printf ',\n' >> "$tmp_body"
        fi
        esc="$(json_escape "$rel")"
        printf '        {\n' >> "$tmp_body"
        printf '            "path": "%s",\n' "$esc" >> "$tmp_body"
        printf '            "hash": "%s"\n' "$h" >> "$tmp_body"
        printf '        }' >> "$tmp_body"
        printf '%s:%s' "$rel" "$h" >> "$tmp_combined"
        count=$((count + 1))
    done < "$tmp_list"

    if [ "$hash_failed" -ne 0 ]; then
        failed=1
        continue
    fi

    if ! total="$(shasum -a 256 "$tmp_combined" | cut -c1-16)" || [ -z "$total" ]; then
        echo "[$id_name] 计算总 hash 失败"
        failed=1
        continue
    fi

    {
        printf '{\n'
        printf '    "version": "%s",\n' "$version"
        printf '    "hash": "%s",\n' "$total"
        printf '    "files": [\n'
        cat "$tmp_body"
        if [ "$count" -gt 0 ]; then
            printf '\n'
        fi
        printf '    ]\n}\n'
    } > "$tmp_manifest"

    if [ "$count" -eq 0 ]; then
        echo "[$id_name] 清单为空 已跳过"
        failed=1
        continue
    fi

    if [ "$check_mode" -eq 1 ]; then
        if [ -f "$manifest_path" ] && cmp -s "$tmp_manifest" "$manifest_path"; then
            echo "[$id_name] 已是最新"
        else
            echo "[$id_name] 需要更新"
            failed=1
        fi
    else
        if ! cp "$tmp_manifest" "$manifest_path"; then
            echo "[$id_name] 写入失败 $manifest_path"
            failed=1
            continue
        fi
        echo "[$id_name] $count 个文件 hash $total"
    fi
done

if [ "$failed" -ne 0 ]; then
    exit 1
fi
exit 0
