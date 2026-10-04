#!/usr/bin/env python3
import os
import sys
import argparse
from urllib.parse import urljoin, urlparse, unquote
import requests
from bs4 import BeautifulSoup
from concurrent.futures import ThreadPoolExecutor, as_completed

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
                  'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
}


def get_links(url):
    """获取目录页面中的所有链接，同时返回重定向后的最终 URL"""
    resp = requests.get(url, headers=HEADERS, timeout=30)
    resp.raise_for_status()

    final_url = resp.url  # 关键：重定向后的真实 URL
    if final_url != url:
        print(f"  [debug] URL 被重定向: {url} -> {final_url}")

    soup = BeautifulSoup(resp.text, 'html.parser')
    links = []
    for a in soup.find_all('a', href=True):
        href = a['href']
        if href.startswith(('?', '#', '../')):
            continue
        full_url = urljoin(final_url, href)  # 用 final_url 作为基准拼接
        if urlparse(full_url).netloc != urlparse(final_url).netloc:
            continue
        links.append((href, full_url))
    return links, final_url


def download_file(url, local_path):
    local_path = os.path.abspath(local_path)
    os.makedirs(os.path.dirname(local_path), exist_ok=True)
    try:
        with requests.get(url, headers=HEADERS, stream=True, timeout=60) as r:
            r.raise_for_status()
            total = 0
            with open(local_path, 'wb') as f:
                for chunk in r.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
                        total += len(chunk)
        print(f"✓ {local_path} ({total} bytes)")
        return True, total
    except Exception as e:
        print(f"✗ 下载失败 {url}: {e}", file=sys.stderr)
        return False, 0


def download_folder(base_url, local_dir, max_workers=5):
    print(f"\n扫描目录: {base_url}")
    try:
        links, final_url = get_links(base_url)
    except Exception as e:
        print(f"无法访问 {base_url}: {e}", file=sys.stderr)
        return

    # 用重定向后的 URL 计算基准路径
    base_path = urlparse(final_url).path
    if not base_path.endswith('/'):
        base_path += '/'
    print(f"  [debug] base_path = {base_path!r}")
    print(f"  [debug] 过滤后得到 {len(links)} 个有效链接")

    files_to_download = []
    dirs_to_scan = []

    for href, full_url in links:
        full_path = urlparse(full_url).path
        if not full_path.startswith(base_path):
            print(f"  [debug] 跳过 (路径不匹配): {href!r}")
            continue
        rel_path = unquote(full_path[len(base_path):])
        if not rel_path:
            continue

        if rel_path.endswith('/'):
            # 避免把自身再次加入
            if full_url.rstrip('/') == final_url.rstrip('/'):
                continue
            dir_local = os.path.join(local_dir, rel_path.rstrip('/'))
            dirs_to_scan.append((full_url, dir_local))
            print(f"  [debug] 子目录: {rel_path}")
        else:
            local_path = os.path.join(local_dir, rel_path)
            files_to_download.append((full_url, local_path))
            print(f"  [debug] 文件: {rel_path}")

    if files_to_download:
        print(f"发现 {len(files_to_download)} 个文件，开始下载...")
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = {executor.submit(download_file, u, p): (u, p)
                       for u, p in files_to_download}
            for future in as_completed(futures):
                future.result()
    else:
        print("  [debug] 当前目录没有文件可下载")

    for dir_url, dir_local in dirs_to_scan:
        download_folder(dir_url, dir_local, max_workers)


def main():
    parser = argparse.ArgumentParser(description='从 jsDelivr CDN 下载整个文件夹')
    parser.add_argument('url', help='起始目录 URL')
    parser.add_argument('-o', '--output', default='./download', help='本地保存目录')
    parser.add_argument('-j', '--jobs', type=int, default=5, help='并发数')
    args = parser.parse_args()

    url = args.url if args.url.endswith('/') else args.url + '/'
    output = os.path.abspath(args.output)
    os.makedirs(output, exist_ok=True)
    print(f"保存到: {output}")

    download_folder(url, output, max_workers=args.jobs)
    print("\n全部完成！")


if __name__ == '__main__':
    main()
