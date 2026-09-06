#!/usr/bin/env python3
import os
import sys
import argparse
from fontTools.ttLib import TTFont

# ========== 核心功能 ==========
def get_unicode_ranges(cmap):
    """从 cmap 提取并合并连续的 Unicode 区间"""
    codepoints = sorted(cmap.keys())
    if not codepoints:
        return []
    ranges = []
    start = codepoints[0]
    end = codepoints[0]
    for cp in codepoints[1:]:
        if cp == end + 1:
            end = cp
        else:
            ranges.append((start, end))
            start = end = cp
    ranges.append((start, end))
    return ranges

def format_css_range(ranges):
    """格式化区间为 CSS unicode-range 字符串"""
    parts = []
    for start, end in ranges:
        if start == end:
            parts.append(f"U+{start:04X}")
        else:
            parts.append(f"U+{start:04X}-{end:04X}")
    return ", ".join(parts)

def analyze_font(font_path):
    """分析单个字体，返回 (字体名, unicode_range_string) 或 None"""
    try:
        font = TTFont(font_path)
        cmap = font.getBestCmap()
        if not cmap:
            return None
        ranges = get_unicode_ranges(cmap)
        if not ranges:
            return None
        range_str = format_css_range(ranges)
        return (os.path.basename(font_path), range_str)
    except Exception as e:
        print(f"⚠️  跳过 {font_path}: {e}")
        return None

# ========== 单文件处理 ==========
def process_single_file(font_path, output_dir="out"):
    """处理单个字体文件，在 output_dir 下生成同名 .md 文件"""
    result = analyze_font(font_path)
    if not result:
        print(f"❌ 无法分析 {font_path}")
        return
    name, range_str = result
    os.makedirs(output_dir, exist_ok=True)
    md_filename = os.path.splitext(name)[0] + ".md"
    md_path = os.path.join(output_dir, md_filename)
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(f"# 字体文件: {name}\n\n")
        f.write(f"```css\n")
        f.write(f"/* 自动生成的 unicode-range */\n")
        f.write(f"unicode-range: {range_str};\n")
        f.write(f"```\n")
    print(f"✅ 单文件导出: {md_path}")

# ========== 文件夹批量处理（汇总到一个 MD） ==========
def process_folder(folder_path, output_file=None):
    """遍历文件夹，汇总所有字体的 unicode-range 到一个 Markdown 文件"""
    if not output_file:
        output_file = os.path.join(folder_path, "summary.md")
    os.makedirs(os.path.dirname(os.path.abspath(output_file)), exist_ok=True)

    font_exts = ('.ttf', '.otf', '.woff', '.woff2')
    font_files = [f for f in os.listdir(folder_path) if f.lower().endswith(font_exts)]
    if not font_files:
        print(f"❌ 在 {folder_path} 中未找到任何字体文件")
        return

    results = []
    for filename in sorted(font_files):
        full_path = os.path.join(folder_path, filename)
        print(f"🔍 分析: {filename}")
        res = analyze_font(full_path)
        if res:
            results.append(res)
        else:
            print(f"   ⚠️  无有效字符映射，已跳过")

    if not results:
        print("❌ 没有可用的字体范围")
        return

    with open(output_file, "w", encoding="utf-8") as f:
        f.write("# 字体 Unicode 范围汇总（自动生成）\n\n")
        f.write(f"**源文件夹**: `{folder_path}`\n\n")
        f.write("可直接复制各 `unicode-range` 到你的 `@font-face` 中。\n\n")
        f.write("---\n\n")
        for idx, (name, range_str) in enumerate(results):
            f.write(f"## {idx+1}. 字体: `{name}`\n\n")
            f.write(f"```css\n")
            f.write(f"unicode-range: {range_str};\n")
            f.write(f"```\n\n")
            if idx != len(results) - 1:
                f.write("---\n\n")
    print(f"✅ 汇总导出: {output_file}")

# ========== 主程序（带 argparse） ==========
def main():
    parser = argparse.ArgumentParser(
        description='分析字体文件（TTF/OTF/WOFF/WOFF2）并提取其 Unicode 覆盖范围，生成 CSS unicode-range 的 Markdown 文件。',
        epilog='示例:\n'
               '  %(prog)s 字体.ttf                      # 输出到 out/字体.md\n'
               '  %(prog)s 字体.ttf -o ./css            # 输出到 ./css/字体.md\n'
               '  %(prog)s ./fonts                      # 生成 ./fonts/summary.md\n'
               '  %(prog)s ./fonts -o all.md           # 生成 ./all.md\n'
               '  %(prog)s -h                          # 显示此帮助',
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        'input',
        help='要处理的字体文件路径或包含字体文件的文件夹路径'
    )
    parser.add_argument(
        '-o', '--output',
        help='输出位置：单文件模式指定输出目录（默认 "out"），文件夹模式指定输出文件路径（默认 "<文件夹>/summary.md"）',
        default=None
    )
    parser.add_argument(
        '-v', '--verbose',
        action='store_true',
        help='显示详细处理信息（目前仅用于调试）'
    )
    args = parser.parse_args()

    input_path = args.input
    output_path = args.output

    if not os.path.exists(input_path):
        print(f"❌ 错误：'{input_path}' 不存在")
        sys.exit(1)

    if os.path.isdir(input_path):
        # 文件夹模式
        process_folder(input_path, output_path)
    elif os.path.isfile(input_path):
        # 单文件模式：output_path 视为输出目录（若未指定则默认为 out）
        output_dir = output_path if output_path else "out"
        process_single_file(input_path, output_dir)
    else:
        print(f"❌ 错误：'{input_path}' 不是有效的文件或文件夹")
        sys.exit(1)

if __name__ == "__main__":
    main()
