#!/usr/bin/env python3
"""把 resource/fonts/ 下的字体转换成 woff2，输出到 docs/assets/resources/fonts/ 的同名路径。

用法:
    python3 script/python/fonts_to_woff2.py [--jobs N] [--check] [清单文件]

清单文件每行一个路径，相对 resource/fonts/。
默认读取 script/python/assets/fonts_woff2.txt。
"""

import argparse
import shutil
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
ORIGIN = ROOT / 'resource/fonts'
OFFICIAL = ROOT / 'docs/assets/resources/fonts'
MANIFEST = HERE / 'assets' / 'fonts_woff2.txt'


def convert(rel, check):
    src = ORIGIN / rel
    dst = (OFFICIAL / rel).with_suffix('.woff2')

    if not src.exists():
        return rel, 'missing source'
    if check:
        return rel, 'ok' if dst.exists() else 'not built'

    dst.parent.mkdir(parents=True, exist_ok=True)
    if src.suffix.lower() in ('.woff2', '.woff'):
        shutil.copy2(src, dst)
        return rel, 'copied'

    from fontTools.ttLib.woff2 import compress
    compress(str(src), str(dst))
    return rel, 'converted'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('manifest', nargs='?', default=str(MANIFEST))
    parser.add_argument('--jobs', type=int, default=4)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()

    rels = [x.strip() for x in Path(args.manifest).read_text(encoding='utf-8').splitlines() if x.strip()]

    failures = 0
    with ProcessPoolExecutor(max_workers=args.jobs) as pool:
        futures = [pool.submit(convert, rel, args.check) for rel in rels]
        for rel, status in (f.result() for f in futures):
            print(f'{status:12} {rel}')
            if status not in ('ok', 'converted', 'copied'):
                failures += 1

    print(f'\n{len(rels)} entries, {failures} failure(s)')
    return 1 if failures else 0


if __name__ == '__main__':
    sys.exit(main())
