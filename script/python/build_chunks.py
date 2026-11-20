#!/usr/bin/env python3
"""
用于 bangumi-takeout-web 的本地 jsonlines 数据分片

把 bgm-data/subject.jsonlines 和 episode.jsonlines 切成多个分片 + 生成 manifest。

用法：
    python build_chunks.py --data-dir ./bgm-data
    python build_chunks.py --data-dir ./bgm-data --out-dir /tmp/chunks --episode-chunk 3000

产出结构：
    bgm-data/
    ├── subjects/
    │   ├── manifest.json
    │   ├── 0000.zip
    │   └── ...
    └── episodes/
        ├── manifest.json
        ├── 0000.zip
        └── ...

前置假设：
    - subject.jsonlines 按 id 升序排序
    - episode.jsonlines 按 episode id 排序，同一 subject 的剧集可能分散在文件各处

    episode 分片按 subject_id 分组：先扫描一遍记录每个 subject 的行位置，
    再按 subject_id 升序回读。组内保持原始行顺序。

    每种类型先在临时目录里完整构建并回读校验，再整目录切换：旧目录先改名备份，
    新目录就位后才删备份。同一种类型的清单与分片一起生效；两种类型分别提交，
    前一种提交后另一种失败时，前一种保持新版本。

    结构性问题（UTF-8 解码失败、末行截断、非对象行）一律失败；--allow-skip 只
    处理缺少 id 或 id 类型不对的单行数据。
"""

import argparse
import json
import os
import shutil
import struct
import sys
import tempfile
import zipfile
import zlib
from array import array
from pathlib import Path


ZIP_DOS_DATE = 33
ZIP_UTF8_FLAG = 0x0800
ZIP_VERSION = 20
ZIP_METHOD_DEFLATE = 8
MAX_CHUNK_BYTES = 60 * 1024 * 1024
# 客户端按 128 MB 限制单个分片解压后的体积，这里留 8 MB 余量
MAX_CHUNK_OUTPUT_BYTES = 120 * 1024 * 1024


class BuildError(Exception):
    """可预期的输入或校验错误，由 main 统一报告"""


def fail(message):
    raise BuildError(message)


def open_source(path):
    try:
        return open(path, "rb")
    except OSError as exc:
        fail(f"无法读取 {path}：{exc}")


def write_zip(path, entry_name, raw):
    """写单条目 zip，固定时间戳与参数，使相同输入得到相同字节"""
    # 压缩字节随 zlib 版本变化，核对应以解压内容与清单为准
    if len(raw) > MAX_CHUNK_OUTPUT_BYTES:
        fail(f"{path.name} 解压后为 {len(raw)} 字节，超过 "
             f"{MAX_CHUNK_OUTPUT_BYTES // (1024 * 1024)} MB 上限")
    name = entry_name.encode("utf-8")
    compressor = zlib.compressobj(9, zlib.DEFLATED, -15)
    payload = compressor.compress(raw) + compressor.flush()
    crc = zlib.crc32(raw) & 0xFFFFFFFF

    local = struct.pack(
        "<IHHHHHIIIHH",
        0x04034B50, ZIP_VERSION, ZIP_UTF8_FLAG, ZIP_METHOD_DEFLATE,
        0, ZIP_DOS_DATE, crc, len(payload), len(raw), len(name), 0,
    ) + name + payload
    central = struct.pack(
        "<IHHHHHHIIIHHHHHII",
        0x02014B50, ZIP_VERSION, ZIP_VERSION, ZIP_UTF8_FLAG, ZIP_METHOD_DEFLATE,
        0, ZIP_DOS_DATE, crc, len(payload), len(raw), len(name), 0, 0, 0, 0, 0, 0,
    ) + name
    eocd = struct.pack(
        "<IHHHHIIH",
        0x06054B50, 0, 0, 1, 1, len(central), len(local), 0,
    )
    data = local + central + eocd
    if len(data) > MAX_CHUNK_BYTES:
        fail(f"{path.name} 压缩后为 {len(data)} 字节，超过 "
             f"{MAX_CHUNK_BYTES // (1024 * 1024)} MB 上限")
    try:
        path.write_bytes(data)
    except OSError as exc:
        fail(f"写入 {path.name} 失败：{exc}")


def write_manifest(path, manifest_data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(manifest_data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def check_chunk_ranges(chunks, total, min_key, max_key):
    written = 0
    previous = None
    for chunk in chunks:
        low = chunk[min_key]
        high = chunk[max_key]
        if low is None or high is None:
            fail(f"{chunk['file']} 缺少 {min_key} 或 {max_key}")
        if low > high:
            fail(f"{chunk['file']} 的 {min_key}={low} 大于 {max_key}={high}")
        if previous is not None and low <= previous[max_key]:
            fail(f"{chunk['file']} 的区间与前一处分片重叠或未严格递增")
        written += chunk["count"]
        previous = chunk
    if written != total:
        fail(f"各分片 count 之和为 {written}，输入行数为 {total}")


def classify_record(raw, id_key, where):
    """返回 (记录, 跳过原因)；记录为 None 表示该行只有 id 数据问题

    结构性问题直接失败，不因 --allow-skip 放过，否则分片会静默少内容。
    """
    try:
        obj = json.loads(raw)
    except UnicodeDecodeError:
        fail(f"{where}不是合法的 UTF-8")
    except json.JSONDecodeError:
        fail(f"{where}不是完整的 JSON")
    if not isinstance(obj, dict):
        fail(f"{where}不是 JSON 对象")
    if id_key not in obj:
        return None, f"缺少 {id_key}"
    if type(obj[id_key]) is not int:
        return None, f"{id_key} 类型不是 int"
    return obj, None


def report_skips(src_name, skipped, reasons):
    if not skipped:
        return
    detail = "，".join(f"{reason} {count} 行" for reason, count in reasons.items())
    print(f"{src_name} 跳过 {skipped} 行：{detail}", file=sys.stderr)


def count_physical_lines(src_path):
    """独立按原始字节统计换行数，不用解析结果推导物理行数"""
    lines = 0
    tail = b"\n"
    with open_source(src_path) as f:
        while True:
            block = f.read(1 << 20)
            if not block:
                break
            lines += block.count(b"\n")
            tail = block[-1:]
    if tail != b"\n":
        fail(f"{src_path.name} 最后一行未以换行结束，文件可能被截断")
    return lines


def resolve_chunk_size(value, manifest_path, flag):
    """清单优先，命令行参数其次；返回生效值与来源"""
    if value is not None and value <= 0:
        fail(f"{flag} 必须为正整数")
    manifest_size = None
    if manifest_path.is_file():
        try:
            manifest_data = json.loads(manifest_path.read_text(encoding="utf-8"))
        except OSError as exc:
            fail(f"无法读取 {manifest_path}：{exc}")
        except json.JSONDecodeError:
            manifest_data = {}
        candidate = manifest_data.get("chunk_size") if isinstance(manifest_data, dict) else None
        if type(candidate) is int and candidate > 0:
            manifest_size = candidate
    if manifest_size is not None:
        if value is not None and value != manifest_size:
            print(f"{flag}={value} 被忽略，采用 {manifest_path} 的 chunk_size={manifest_size}",
                  file=sys.stderr)
        return manifest_size, f"清单 {manifest_path}"
    if value is not None:
        return value, f"参数 {flag}"
    fail(f"缺少 {flag}，且 {manifest_path} 中没有可用的 chunk_size")


def make_manifest(kind, chunk_size, total, skipped, reasons, chunks):
    manifest_data = {
        "version": 1,
        "kind": kind,
        "chunk_size": chunk_size,
        "total": total,
    }
    # 无跳过时不写 skipped，既有清单的字节保持不变
    if skipped:
        manifest_data["skipped"] = skipped
        manifest_data["skipped_reasons"] = dict(reasons)
    manifest_data["chunks"] = chunks
    return manifest_data


def validate_chunks(stage_dir, manifest_data, physical, id_key, min_key, max_key,
                    subject_total=None):
    """回读暂存分片与清单，以独立统计的物理行数为基准核对条数、区间与文件集合"""
    chunks = manifest_data["chunks"]
    total = manifest_data["total"]
    skipped = manifest_data.get("skipped", 0)
    if skipped != sum(manifest_data.get("skipped_reasons", {}).values()):
        fail("清单的 skipped 与跳过原因合计不一致")
    if total + skipped != physical:
        fail(f"写入 {total} 行加跳过 {skipped} 行不等于物理行数 {physical}")
    if not chunks:
        fail("没有生成任何分片")
    expected_files = {chunk["file"] for chunk in chunks} | {"manifest.json"}
    staged = {path.name for path in stage_dir.iterdir()}
    if staged != expected_files:
        extra = sorted(staged - expected_files)
        missing = sorted(expected_files - staged)
        fail(f"暂存目录多出 {extra}，缺少 {missing}")
    seen = 0
    seen_subjects = 0
    for chunk in chunks:
        expected_name = chunk["file"][:-4] + ".jsonl"
        try:
            with zipfile.ZipFile(stage_dir / chunk["file"]) as archive:
                names = archive.namelist()
                if names != [expected_name]:
                    fail(f"{chunk['file']} 的条目为 {names}，期望 {expected_name}")
                data = archive.read(expected_name)
        except (zipfile.BadZipFile, zlib.error) as exc:
            fail(f"{chunk['file']} 无法作为 zip 读取：{exc}")
        except OSError as exc:
            fail(f"读取 {chunk['file']} 失败：{exc}")
        if not data:
            fail(f"{chunk['file']} 内容为空")
        if not data.endswith(b"\n"):
            fail(f"{chunk['file']} 最后一行未以换行结束")
        lines = data[:-1].split(b"\n")
        if len(lines) != chunk["count"]:
            fail(f"{chunk['file']} 回读 {len(lines)} 行，清单记为 {chunk['count']}")
        ids = []
        for number, line in enumerate(lines, 1):
            obj, reason = classify_record(line, id_key, f"{chunk['file']} 第 {number} 行")
            if obj is None:
                fail(f"{chunk['file']} 第 {number} 行{reason}")
            ids.append(obj[id_key])
        if ids[0] != chunk[min_key]:
            fail(f"{chunk['file']} 首行 {id_key}={ids[0]} 与清单 {min_key}={chunk[min_key]} 不符")
        if ids[-1] != chunk[max_key]:
            fail(f"{chunk['file']} 末行 {id_key}={ids[-1]} 与清单 {max_key}={chunk[max_key]} 不符")
        if "subject_count" in chunk:
            distinct = len(set(ids))
            if distinct != chunk["subject_count"]:
                fail(f"{chunk['file']} 含 {distinct} 个 subject，清单记为 {chunk['subject_count']}")
            seen_subjects += distinct
        seen += len(lines)
    if seen != total:
        fail(f"回读合计 {seen} 行，写入总数为 {total}")
    if subject_total is not None and seen_subjects != subject_total:
        fail(f"回读 subject 数为 {seen_subjects}，输入为 {subject_total}")
    check_chunk_ranges(chunks, total, min_key, max_key)


def build_subject_chunks(src_path, stage_dir, chunk_size, allow_skip):
    physical = count_physical_lines(src_path)
    stage_dir.mkdir(parents=True, exist_ok=True)
    chunks = []
    current_lines = []
    current_min_id = None
    current_max_id = None
    total = 0
    reasons = {}

    def flush():
        nonlocal current_lines, current_min_id, current_max_id
        if not current_lines:
            return
        filename = f"{len(chunks):04d}.zip"
        write_zip(stage_dir / filename, filename[:-4] + ".jsonl", b"".join(current_lines))
        chunks.append({
            "file": filename,
            "min_id": current_min_id,
            "max_id": current_max_id,
            "count": len(current_lines),
            "compressed": True,
        })
        current_lines = []
        current_min_id = None
        current_max_id = None

    with open_source(src_path) as f:
        for number, raw in enumerate(f, 1):
            obj, reason = classify_record(raw, "id", f"{src_path.name} 第 {number} 行")
            if obj is None:
                reasons[reason] = reasons.get(reason, 0) + 1
                continue
            sid = obj["id"]
            if current_min_id is None or sid < current_min_id:
                current_min_id = sid
            if current_max_id is None or sid > current_max_id:
                current_max_id = sid
            # 按原始字节复制，保留行内空白与行尾
            current_lines.append(raw if raw.endswith(b"\n") else raw + b"\n")
            total += 1
            if len(current_lines) >= chunk_size:
                flush()
    flush()

    skipped = sum(reasons.values())
    report_skips(src_path.name, skipped, reasons)
    if total == 0 or not chunks:
        fail(f"{src_path.name} 没有可写入的记录（物理行 {physical}，跳过 {skipped}）")
    if skipped and not allow_skip:
        fail(f"{src_path.name} 跳过 {skipped} 行；确认跳过请加 --allow-skip")

    manifest_data = make_manifest("subject", chunk_size, total, skipped, reasons, chunks)
    write_manifest(stage_dir / "manifest.json", manifest_data)
    validate_chunks(stage_dir, manifest_data, physical, "id", "min_id", "max_id")
    return manifest_data


def index_episode_rows(src_path):
    """记录每个 subject 的行位置，返回 subject_id -> [起点, 长度, ...]"""
    positions = {}
    total = 0
    reasons = {}
    number = 0
    with open_source(src_path) as f:
        while True:
            start = f.tell()
            line = f.readline()
            if not line:
                break
            number += 1
            obj, reason = classify_record(line, "subject_id", f"{src_path.name} 第 {number} 行")
            if obj is None:
                reasons[reason] = reasons.get(reason, 0) + 1
                continue
            sid = obj["subject_id"]
            spans = positions.get(sid)
            if spans is None:
                spans = positions[sid] = array("Q")
            spans.append(start)
            spans.append(len(line))
            total += 1
    return positions, total, reasons


def build_episode_chunks(src_path, stage_dir, chunk_size, allow_skip):
    physical = count_physical_lines(src_path)
    positions, total, reasons = index_episode_rows(src_path)
    skipped = sum(reasons.values())
    report_skips(src_path.name, skipped, reasons)
    if total == 0 or not positions:
        fail(f"{src_path.name} 没有可写入的记录（物理行 {physical}，跳过 {skipped}）")
    if skipped and not allow_skip:
        fail(f"{src_path.name} 跳过 {skipped} 行；确认跳过请加 --allow-skip")

    stage_dir.mkdir(parents=True, exist_ok=True)
    subject_ids = sorted(positions)
    chunks = []
    buffer = bytearray()
    current_subjects = 0
    current_min_id = None
    current_max_id = None
    current_count = 0

    def flush():
        nonlocal buffer, current_subjects, current_min_id, current_max_id, current_count
        if not buffer:
            return
        filename = f"{len(chunks):04d}.zip"
        write_zip(stage_dir / filename, filename[:-4] + ".jsonl", bytes(buffer))
        chunks.append({
            "file": filename,
            "min_subject_id": current_min_id,
            "max_subject_id": current_max_id,
            "count": current_count,
            "subject_count": current_subjects,
            "compressed": True,
        })
        buffer = bytearray()
        current_subjects = 0
        current_min_id = None
        current_max_id = None
        current_count = 0

    with open_source(src_path) as f:
        for sid in subject_ids:
            if current_subjects >= chunk_size:
                flush()
            if current_min_id is None or sid < current_min_id:
                current_min_id = sid
            if current_max_id is None or sid > current_max_id:
                current_max_id = sid
            current_subjects += 1
            spans = positions[sid]
            for offset in range(0, len(spans), 2):
                f.seek(spans[offset])
                row = f.read(spans[offset + 1])
                if len(row) != spans[offset + 1]:
                    fail(f"回读第 {spans[offset]} 字节处失败，文件可能已变化")
                if not row.endswith(b"\n"):
                    row += b"\n"
                buffer.extend(row)
                current_count += 1
    flush()

    manifest_data = make_manifest("episode", chunk_size, total, skipped, reasons, chunks)
    write_manifest(stage_dir / "manifest.json", manifest_data)
    validate_chunks(stage_dir, manifest_data, physical, "subject_id",
                    "min_subject_id", "max_subject_id", subject_total=len(subject_ids))
    return manifest_data


def existing_ancestor(path):
    current = path.resolve()
    while not current.exists():
        if current.parent == current:
            break
        current = current.parent
    return current


def remove_empty_dirs(path, stop):
    current = path.resolve()
    stop = stop.resolve()
    while current != stop and current.is_dir():
        try:
            current.rmdir()
        except OSError:
            break
        current = current.parent


def remove_tree(path):
    """删除目录及其内容；只用于本脚本自己写出的临时目录"""
    for entry in sorted(path.rglob("*"), key=lambda item: len(item.parts), reverse=True):
        if entry.is_dir() and not entry.is_symlink():
            entry.rmdir()
        else:
            entry.unlink()
    path.rmdir()


def read_stale_names(target_dir):
    """读旧清单列出的文件名；读不到时返回 None，调用方据此保留整个备份"""
    path = target_dir / "manifest.json"
    if not path.is_file():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, UnicodeDecodeError):
        return None
    chunks = data.get("chunks") if isinstance(data, dict) else None
    if not isinstance(chunks, list):
        return None
    names = []
    for chunk in chunks:
        name = chunk.get("file") if isinstance(chunk, dict) else None
        # 只认目录内的简单文件名，避免清单把删除指到目录之外
        if isinstance(name, str) and name and Path(name).name == name:
            names.append(name)
    return names


def remove_stale_chunks(backup_dir, names):
    """只删旧清单列出的普通文件；符号链接与目录一律不动"""
    for name in names:
        path = backup_dir / name
        try:
            if path.is_symlink() or (path.exists() and not path.is_file()):
                print(f"不删除 {path}：不是普通文件", file=sys.stderr)
                continue
            if path.is_file():
                path.unlink()
        except OSError as exc:
            print(f"删除 {path} 失败：{exc}", file=sys.stderr)


def drop_backup(backup_dir, target_dir, stale_names):
    """删掉旧目录里的清单与旧分片；其余条目移回新目录，避免丢失无关文件"""
    remove_stale_chunks(backup_dir, stale_names)
    old_manifest = backup_dir / "manifest.json"
    try:
        if old_manifest.is_file() and not old_manifest.is_symlink():
            old_manifest.unlink()
    except OSError as exc:
        print(f"删除 {old_manifest} 失败：{exc}", file=sys.stderr)
    try:
        entries = sorted(backup_dir.iterdir())
    except OSError as exc:
        print(f"读取 {backup_dir} 失败：{exc}", file=sys.stderr)
        return
    leftovers = []
    for path in entries:
        # 该删而没删掉的不往回搬，留在备份里等人工处理
        if path.name in stale_names:
            leftovers.append(path)
            continue
        dest = target_dir / path.name
        try:
            if dest.exists() or dest.is_symlink():
                leftovers.append(path)
                continue
            os.rename(path, dest)
        except OSError as exc:
            print(f"移回 {path} 失败：{exc}", file=sys.stderr)
            leftovers.append(path)
    if leftovers:
        print(f"旧目录还有 {len(leftovers)} 项未处理，备份保留在 {backup_dir}", file=sys.stderr)
        return
    try:
        backup_dir.rmdir()
    except OSError as exc:
        print(f"删除备份目录 {backup_dir} 失败：{exc}", file=sys.stderr)


def commit_kind(stage_dir, target_dir):
    """整目录切换，使同一类型的清单与分片同时生效

    两次改名之间新目录短暂不存在，这是不用系统特定接口时能做到的最短窗口。
    第二次改名失败则把备份改回原名，输出目录恢复原状；若连回退改名也失败，
    旧目录只会留在备份路径下，错误信息会写出该路径，需要手工改回原名。
    """
    try:
        target_dir.parent.mkdir(parents=True, exist_ok=True)
    except OSError as exc:
        fail(f"创建 {target_dir.parent} 失败：{exc}")
    if not target_dir.exists():
        try:
            os.rename(stage_dir, target_dir)
        except OSError as exc:
            fail(f"切换到 {target_dir} 失败：{exc}")
        return

    stale_names = read_stale_names(target_dir)
    backup_dir = target_dir.with_name(f".{target_dir.name}.backup-{os.getpid()}")
    index = 0
    while backup_dir.exists() or backup_dir.is_symlink():
        index += 1
        backup_dir = target_dir.with_name(f".{target_dir.name}.backup-{os.getpid()}-{index}")
    try:
        os.rename(target_dir, backup_dir)
    except OSError as exc:
        fail(f"备份 {target_dir} 失败：{exc}")
    try:
        os.rename(stage_dir, target_dir)
    except OSError as exc:
        try:
            os.rename(backup_dir, target_dir)
        except OSError as rollback_exc:
            fail(f"切换到 {target_dir} 失败：{exc}；回退也失败：{rollback_exc}；旧数据保留在 {backup_dir}，可手工改回 {target_dir.name}")
        fail(f"切换到 {target_dir} 失败：{exc}")

    if stale_names is None:
        # An empty directory, or one without a manifest, carries no data the
        #  client could use, so keeping a backup of it only leaks space.
        if not (backup_dir / "manifest.json").is_file():
            try:
                remove_tree(backup_dir)
            except OSError as exc:
                print(f"清理备份 {backup_dir} 失败：{exc}", file=sys.stderr)
            return
        print(f"旧清单不可读，已保留 {backup_dir}，确认后可删除", file=sys.stderr)
        return
    drop_backup(backup_dir, target_dir, set(stale_names))


def build_outputs(args):
    data_dir = Path(args.data_dir)
    out_dir = Path(args.out_dir) if args.out_dir else data_dir
    subject_src = data_dir / "subject.jsonlines"
    episode_src = data_dir / "episode.jsonlines"

    if not subject_src.exists():
        fail(f"missing {subject_src}")
    if not episode_src.exists():
        fail(f"missing {episode_src}")

    episode_manifest = out_dir / "episodes" / "manifest.json"
    if not episode_manifest.is_file():
        episode_manifest = data_dir / "episodes" / "manifest.json"
    episode_chunk, episode_source = resolve_chunk_size(
        args.episode_chunk, episode_manifest, "--episode-chunk",
    )

    subject_manifest = out_dir / "subjects" / "manifest.json"
    if not subject_manifest.is_file():
        subject_manifest = data_dir / "subjects" / "manifest.json"
    subject_chunk, subject_source = resolve_chunk_size(
        args.subject_chunk, subject_manifest, "--subject-chunk",
    )

    print(f"building subject chunks (chunk_size={subject_chunk}, source: {subject_source})...")
    print(f"building episode chunks (chunk_size={episode_chunk}, source: {episode_source})...")

    out_existed = out_dir.exists()
    base = existing_ancestor(out_dir.resolve().parent)
    stage_root = Path(tempfile.mkdtemp(prefix=".build-chunks-", dir=str(base)))
    try:
        sm = build_subject_chunks(subject_src, stage_root / "subjects", subject_chunk, args.allow_skip)
        print(f"  {len(sm['chunks'])} chunks, {sm['total']} subjects")
        em = build_episode_chunks(episode_src, stage_root / "episodes", episode_chunk, args.allow_skip)
        print(f"  {len(em['chunks'])} chunks, {em['total']} episodes")

        # 两种类型各自整目录切换，同类型的清单与分片一起生效；
        # 不做跨类型事务，前一种提交后另一种失败时前一种保持新版本
        commit_kind(stage_root / "subjects", out_dir / "subjects")
        commit_kind(stage_root / "episodes", out_dir / "episodes")
    finally:
        shutil.rmtree(stage_root, ignore_errors=True)
        if not out_existed:
            remove_empty_dirs(out_dir, base)

    print(f"output: {out_dir}")


def run(args):
    """把读写的系统错误统一变成构建错误，避免输出原生 traceback"""
    try:
        build_outputs(args)
    except OSError as exc:
        fail(f"读写失败：{exc}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", default="./docs/writings/_media/BangumiBackup-20260915/web",
                        help="bgm-data 目录（读取 subject.jsonlines 与 episode.jsonlines）")
    parser.add_argument("--out-dir", default=None,
                        help="只把分片与清单写入此目录，不覆盖 --data-dir")
    parser.add_argument("--subject-chunk", type=int, default=None,
                        help="每个 subject 分片包含的 subject 条数；清单有 chunk_size 时优先用清单")
    parser.add_argument("--episode-chunk", type=int, default=None,
                        help="每个 episode 分片包含的 subject 数；清单有 chunk_size 时优先用清单")
    parser.add_argument("--allow-skip", action="store_true",
                        help="允许跳过缺少 id 或 id 类型不是 int 的行；结构性问题始终失败")
    args = parser.parse_args()

    try:
        run(args)
    except BuildError as exc:
        print(f"分片构建失败：{exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
