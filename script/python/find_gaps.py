import re
import argparse
import sys

def parse_unicode_list(text):
    """从文本中解析 Unicode 码位范围，支持 U+XXXX 或 U+XXXX-XXXX 格式"""
    pattern = r'U\+([0-9A-Fa-f]+)(?:-([0-9A-Fa-f]+))?'
    ranges = []
    for match in re.finditer(pattern, text):
        start = int(match.group(1), 16)
        end = int(match.group(2), 16) if match.group(2) else start
        ranges.append((start, end))
    ranges.sort()
    merged = []
    for lo, hi in ranges:
        if not merged or lo > merged[-1][1] + 1:
            merged.append([lo, hi])
        else:
            if hi > merged[-1][1]:
                merged[-1][1] = hi
    return merged

def find_gaps(covered, start, end):
    """在覆盖区间列表 covered 中找出 [start, end] 范围内的空缺区间"""
    gaps = []
    cur = start
    for lo, hi in covered:
        if lo > cur:
            gaps.append((cur, lo - 1))
        cur = max(cur, hi + 1)
        if cur > end:
            break
    if cur <= end:
        gaps.append((cur, end))
    return gaps

def main():
    parser = argparse.ArgumentParser(
        description='从 Unicode 码位列表中找出覆盖范围内的空缺区间。',
        epilog='示例： python script.py -i list.txt -o gap.txt'
    )
    parser.add_argument(
        '-i', '--input',
        default='./assets/list.txt',
        help='输入文件路径，包含 U+XXXX 或 U+XXXX-XXXX 格式的码位列表（默认：./assets/list.txt）'
    )
    parser.add_argument(
        '-o', '--output',
        default='./assets/gap.txt',
        help='输出文件路径，用于保存空缺区间（默认：./assets/gap.txt）'
    )
    parser.add_argument(
        '--range-start', type=lambda x: int(x, 16), default=None,
        help='手动指定起始码位（十六进制，如 4E00），默认自动取最小覆盖码位'
    )
    parser.add_argument(
        '--range-end', type=lambda x: int(x, 16), default=None,
        help='手动指定结束码位（十六进制，如 9FFF），默认自动取最大覆盖码位'
    )
    parser.add_argument(
        '-v', '--verbose', action='store_true',
        help='显示详细处理信息'
    )
    args = parser.parse_args()

    try:
        with open(args.input, 'r', encoding='utf-8') as f:
            text = f.read()
    except FileNotFoundError:
        print(f"错误：输入文件 '{args.input}' 不存在", file=sys.stderr)
        sys.exit(1)

    covered = parse_unicode_list(text)
    if not covered:
        print("未找到任何有效码位", file=sys.stderr)
        sys.exit(1)

    # 确定范围
    if args.range_start is None:
        min_code = covered[0][0]
    else:
        min_code = args.range_start
    if args.range_end is None:
        max_code = covered[-1][1]
    else:
        max_code = args.range_end

    if min_code > max_code:
        print("错误：起始码位大于结束码位", file=sys.stderr)
        sys.exit(1)

    if args.verbose:
        print(f"覆盖范围: U+{covered[0][0]:04X} 至 U+{covered[-1][1]:04X}")
        print(f"查询范围: U+{min_code:04X} 至 U+{max_code:04X}")

    gaps = find_gaps(covered, min_code, max_code)

    # 生成输出文本
    parts = []
    for lo, hi in gaps:
        if lo == hi:
            parts.append(f'U+{lo:04X}')
        else:
            parts.append(f'U+{lo:04X}-{hi:04X}')

    output = ', '.join(parts)

    with open(args.output, 'w', encoding='utf-8') as f:
        f.write(output)

    if args.verbose:
        print(f"找到 {len(gaps)} 个空缺区间")
    print(f"已生成 {args.output}")

if __name__ == '__main__':
    main()
