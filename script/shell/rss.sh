#!/bin/bash

# ============================================================
base_path="docs/"
feed="assets/resources/meta/pikapikapi-blog-rss.atom"
website_title="ピカピカピ"
website_link="https://pikapikapi.com"
description="Don't worry, be happy."
author_name="李亦楊"
# Path based on directory: docs/
git_pathspecs=(
    'docs/**/*.md'
    ':!:docs/**/_*.md'
    ':!:docs/**/README.md'
    ':!:docs/**/About.md'
    ':!:docs/**/Personal*.md'
    ':!:docs/**/BriefComments.md'
    ':!:docs/**/Beginning.md'
    ':!:docs/**/Sites.md'
    ':!:docs/pages/**/*.md'
    ':!:docs/assets/**/*.md'
)
# ============================================================

urlencode() {
    local length="${#1}"
    for ((i = 0; i < length; i++)); do
        local c="${1:i:1}"
        case $c in
        [a-zA-Z0-9.~_+-/]) printf "$c" ;;
        *) printf "$c" | xxd -p -c1 | while read x; do printf "%%%s" "$x"; done ;;
        esac
    done
}

newest_files=$(
    git ls-files -z ${git_pathspecs[@]} |
        xargs -0 -n1 -I{} -- git log -1 --format="%at {}" {} |
        sort -r |
        head -n10 |
        cut -d " " -f2-
)

echo "Constructing RSS seed content..."
echo "Listing articles to be included in the RSS seed:"
items=""
for file in ${newest_files[@]}; do
    echo $file
    title=$(grep "." $file | head -n1)
    relative="${file#$base_path}"
    encode=$(urlencode "${relative%.md}")
    link="$website_link/#/$encode"
    suffix="${file#docs/}"
    prefix="${suffix%/*}"
    html=$(pandoc -f markdown -t html $file | tr -d '\n')
    newhtml="${html//src=\"_media/src=\"$website_link/$prefix/_media}"
    date=$(git log -1 --format="%aI" -- $file)
    item="
  <entry>
    <title><![CDATA[${title:2}]]></title>
    <link href=\"$link\"/>
    <id>\"$link\"</id>
    <content type=\"html\"><![CDATA[$newhtml]]></content>
    <updated>$date</updated>
  </entry>
  "
    items="$items 
  $item"
done

feed_updated=$(date -u +"%Y-%m-%dT%H:%M:%SZ")  

rss_content="<feed xmlns=\"http://www.w3.org/2005/Atom\">
  <title>$website_title</title>
  <author><name>$author_name</name></author>
  <link href=\"$website_link\"/>
  <link href=\"$website_link/$feed\" rel=\"self\"/>
  <id>\"$website_link\"</id>
  <subtitle>$description</subtitle>
  <updated>$feed_updated</updated>
  $items
</feed>"

echo "Writing content to RSS seed..."
echo "$rss_content" >$base_path$feed
