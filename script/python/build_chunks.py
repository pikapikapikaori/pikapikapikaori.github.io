#!/usr/bin/env python3
"""
用于 bangumi-takeout-web 的本地 jsonlines 数据分片

把 bgm-data/subject.jsonlines 和 episode.jsonlines 切成多个分片 + 生成 manifest。

用法：
    python build_chunks.py --data-dir ./bgm-data
    python build_chunks.py --data-dir ./bgm-data --subject-chunk 1000 --episode-chunk 500

产出结构：
    bgm-data/
    ├── subjects/
    │   ├── manifest.json
    │   ├── 0000.jsonl
    │   ├── 0001.jsonl
    │   └── ...
    └── episodes/
        ├── manifest.json
        ├── 0000.jsonl
        └── ...

前置假设：
    - subject.jsonlines 按 id 升序排序
    - episode.jsonlines 按 subject_id 升序排序（同 subject 内按 type/sort 排序）

    如果输入文件未排序，请先用 `sort -t, -k...` 或 Python 外部排序预处理。
"""

import argparse
import json
import sys
from pathlib import Path


def build_subject_chunks(src_path, out_dir, chunk_size):
    out_dir.mkdir(parents=True, exist_ok=True)
    manifest = []
    chunk_index = 0
    current_lines = []
    current_min_id = None
    current_max_id = None

    def flush():
        nonlocal chunk_index, current_lines, current_min_id, current_max_id
        if not current_lines:
            return
        filename = f"{chunk_index:04d}.jsonl"
        with open(out_dir / filename, "w", encoding="utf-8") as f:
            for line in current_lines:
                f.write(line)
                f.write("\n")
        manifest.append({
            "file": filename,
            "min_id": current_min_id,
            "max_id": current_max_id,
            "count": len(current_lines),
        })
        chunk_index += 1
        current_lines = []
        current_min_id = None
        current_max_id = None

    with open(src_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue
            sid = obj.get("id")
            if sid is None:
                continue
            if current_min_id is None:
                current_min_id = sid
            current_max_id = sid
            current_lines.append(line)
            if len(current_lines) >= chunk_size:
                flush()
    flush()

    manifest_data = {
        "version": 1,
        "kind": "subject",
        "chunk_size": chunk_size,
        "total": sum(c["count"] for c in manifest),
        "chunks": manifest,
    }
    with open(out_dir / "manifest.json", "w", encoding="utf-8") as f:
        json.dump(manifest_data, f, ensure_ascii=False, indent=2)

    return manifest_data


def build_episode_chunks(src_path, out_dir, chunk_size):
    out_dir.mkdir(parents=True, exist_ok=True)
    manifest = []
    chunk_index = 0
    current_lines = []
    current_subjects = 0
    current_min_id = None
    current_max_id = None
    last_sid = None

    def flush():
        nonlocal chunk_index, current_lines, current_subjects
        nonlocal current_min_id, current_max_id, last_sid
        if not current_lines:
            return
        filename = f"{chunk_index:04d}.jsonl"
        with open(out_dir / filename, "w", encoding="utf-8") as f:
            for line in current_lines:
                f.write(line)
                f.write("\n")
        manifest.append({
            "file": filename,
            "min_subject_id": current_min_id,
            "max_subject_id": current_max_id,
            "count": len(current_lines),
            "subject_count": current_subjects,
        })
        chunk_index += 1
        current_lines = []
        current_subjects = 0
        current_min_id = None
        current_max_id = None
        last_sid = None

    with open(src_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue
            sid = obj.get("subject_id")
            if sid is None:
                continue
            if sid != last_sid:
                if current_subjects >= chunk_size:
                    flush()
                if current_min_id is None:
                    current_min_id = sid
                current_max_id = sid
                current_subjects += 1
                last_sid = sid
            current_lines.append(line)
    flush()

    manifest_data = {
        "version": 1,
        "kind": "episode",
        "chunk_size": chunk_size,
        "total": sum(c["count"] for c in manifest),
        "chunks": manifest,
    }
    with open(out_dir / "manifest.json", "w", encoding="utf-8") as f:
        json.dump(manifest_data, f, ensure_ascii=False, indent=2)

    return manifest_data


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", default="./docs/writings/_media/BangumiBackup-20260915/web", help="bgm-data 目录")
    parser.add_argument("--subject-chunk", type=int, default=1000,
                        help="每个 subject 分片包含的 subject 条数")
    parser.add_argument("--episode-chunk", type=int, default=500,
                        help="每个 episode 分片包含的 subject 数（一个 subject 的所有 episode 视为一组）")
    args = parser.parse_args()

    data_dir = Path(args.data_dir)
    subject_src = data_dir / "subject.jsonlines"
    episode_src = data_dir / "episode.jsonlines"

    if not subject_src.exists():
        print(f"missing {subject_src}", file=sys.stderr)
        sys.exit(1)
    if not episode_src.exists():
        print(f"missing {episode_src}", file=sys.stderr)
        sys.exit(1)

    print(f"building subject chunks (chunk_size={args.subject_chunk})...")
    sm = build_subject_chunks(subject_src, data_dir / "subjects", args.subject_chunk)
    print(f"  {len(sm['chunks'])} chunks, {sm['total']} subjects")

    print(f"building episode chunks (chunk_size={args.episode_chunk})...")
    em = build_episode_chunks(episode_src, data_dir / "episodes", args.episode_chunk)
    print(f"  {len(em['chunks'])} chunks, {em['total']} episodes")

    print("done.")


if __name__ == "__main__":
    main()
