#!/bin/bash

# ============================================================
default_base_url="https://pikapikapi.com"
placeholder="{{BLOG_BASE_URL}}"
# Path based on directory: docs/
file_patterns=(
    "**/*.md"
    "**/*.html"
    "./rss.sh"
    "./pages/hexo/_config.yml"
    "./pages/hexo/public/atom.xml"
    "./pages/hexo/public/**/*.html"
)
# ============================================================

base_url="${1:-$default_base_url}"
base_url="${base_url%/}"

echo "Replacing base url..."

count=0

echo "Finish replacing:"

while IFS= read -r file; do
    [ -f "$file" ] || continue
    grep -q "$placeholder" "$file" || continue

    sed -i.bak "s|$placeholder|$base_url|g" "$file"
    echo "$file"
    count=$((count + 1))
done < <(
    for pattern in "${file_patterns[@]}"; do
        if [[ "$pattern" == ./* ]]; then
            if [[ "$pattern" == */**/* ]]; then
                dir_part="${pattern%%/\*\*/*}"
                name_part="${pattern##*/}"
                find "$dir_part" -name "$name_part" -type f
            else
                find . -path "$pattern" -type f
            fi
        elif [[ "$pattern" == **/* ]]; then
            find . -name "${pattern#**/}" -type f
        else
            find . -name "$pattern" -type f
        fi
    done | sort -u
)

echo "Cleaning backup files..."
find . -name '*.bak' -delete
