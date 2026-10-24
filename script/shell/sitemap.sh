#!/bin/bash

# ============================================================
base_path="docs/"
sitemap="assets/resources/meta/sitemap.xml"
website_link="https://pikapikapi.com"
homepage_link="https://pikapikapi.com/"
readme_file="README.md"
# Path based on directory: docs/
git_pathspecs=(
    'docs/*.md'
    'docs/**/*.md'
    ':!:docs/_*.md'
    ':!:docs/**/_*.md'
    ':!:docs/pages/**/*.md'
    ':!:docs/assets/**/*.md'
)
# ============================================================

urlencode() {
    local length="${#1}"
    for ((i = 0; i < length; i++)); do
        local c="${1:i:1}"
        case $c in
        [a-zA-Z0-9.~_+-/]) printf '%s' "$c" ;;
        *) printf '%s' "$c" | xxd -p -c1 | while read -r x; do printf "%%%s" "$x"; done ;;
        esac
    done
}

all_files=()
while IFS= read -r -d '' line; do
    all_files+=("$line")
done < <(git ls-files -z "${git_pathspecs[@]}")

echo "Constructing sitemap content..."
echo "Listing articles to be included in the sitemap:"

# 首页写死
home_lastmod=$(TZ='Asia/Shanghai' date +"%Y-%m-%dT%H:%M:%S+08:00")
entries="
  <url>
    <loc>$homepage_link</loc>
    <lastmod>$home_lastmod</lastmod>
  </url>"

for file in "${all_files[@]}"; do
    echo "$file"
    relative="${file#$base_path}"
    filename=$(basename "$relative")

    if [ "$filename" = "$readme_file" ]; then
        dir=$(dirname "$relative")
        if [ "$dir" = "." ]; then
            encode=""
        else
            encode="$(urlencode "$dir")/"
        fi
        link="$website_link/#/$encode"
    else
        encode=$(urlencode "${relative%.md}")
        link="$website_link/#/$encode"
    fi

    lastmod=$(TZ='Asia/Shanghai' git log -1 \
        --format="%cd" \
        --date=format-local:'%Y-%m-%dT%H:%M:%S+08:00' \
        -- "$file")

    entry="
  <url>
    <loc>$link</loc>
    <lastmod>$lastmod</lastmod>
  </url>"

    entries="$entries$entry"
done

sitemap_content="<?xml version=\"1.0\" encoding=\"UTF-8\"?>
<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">$entries
</urlset>"

echo "Writing sitemap..."
printf '%s\n' "$sitemap_content" > "$base_path$sitemap"
