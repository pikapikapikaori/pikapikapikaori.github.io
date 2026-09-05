import re

def parse_unicode_list(text):
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

# 读取你的列表文件（请将内容保存为 list.txt）
with open('./assets/list.txt', 'r', encoding='utf-8') as f:
    text = f.read()

covered = parse_unicode_list(text)

# 自动确定范围：最小覆盖码位 到 最大覆盖码位
if not covered:
    print("未找到任何有效码位")
    exit()

min_code = covered[0][0]
max_code = covered[-1][1]
print(f"自动检测到范围: U+{min_code:04X} 至 U+{max_code:04X}")

gaps = find_gaps(covered, min_code, max_code)

# 生成符合要求的文本段落
parts = []
for lo, hi in gaps:
    if lo == hi:
        parts.append(f'U+{lo:04X}')
    else:
        parts.append(f'U+{lo:04X}-{hi:04X}')

output = ', '.join(parts)

with open('./assets/gap.txt', 'w', encoding='utf-8') as f:
    f.write(output)

print(f'已生成 ./assets/gap.txt，共找到 {len(gaps)} 个空缺区间。')
