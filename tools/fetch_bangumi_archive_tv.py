#!/usr/bin/env python3
"""Download only subject.jsonlines from Bangumi's official Archive ZIP and build TV data."""

from __future__ import annotations

import argparse
import binascii
import json
import re
import struct
import sys
import time
import zlib
from collections import Counter
from pathlib import Path
from typing import Any, BinaryIO
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


LATEST_META_URL = "https://raw.githubusercontent.com/bangumi/Archive/master/aux/latest.json"
USER_AGENT = "AnimeAtlas/0.1 (personal anime archive; https://github.com/bangumi/Archive)"
EOCD_SIGNATURE = b"PK\x05\x06"
CENTRAL_SIGNATURE = b"PK\x01\x02"
LOCAL_SIGNATURE = b"PK\x03\x04"
COUNTRY_TAGS = {
    "日本", "中国", "美国", "英国", "法国", "韩国", "欧美", "苏联", "俄罗斯",
    "加拿大", "德国", "意大利", "西班牙", "澳大利亚", "朝鲜", "印度",
}


def parse_years(value: str) -> tuple[int, int]:
    match = re.fullmatch(r"\s*(\d{4})\s*-\s*(\d{4})\s*", value)
    if not match:
        raise argparse.ArgumentTypeError("年份范围格式应为1960-2030")
    start, end = map(int, match.groups())
    if start > end:
        start, end = end, start
    if start < 1917 or end > 2030:
        raise argparse.ArgumentTypeError("年份必须位于1917—2030")
    return start, end


def fetch_json(url: str) -> dict[str, Any]:
    last_error: Exception | None = None
    for attempt in range(6):
        request = Request(url, headers={"Accept": "application/json", "User-Agent": USER_AGENT})
        try:
            with urlopen(request, timeout=45) as response:
                return json.loads(response.read().decode("utf-8"))
        except (HTTPError, URLError, TimeoutError, OSError) as error:
            last_error = error
            if attempt == 5:
                break
            wait = min(30, 2 ** attempt * 2)
            print(f"  读取归档信息失败，{wait}秒后重试 {attempt + 2}/6...", file=sys.stderr)
            time.sleep(wait)
    raise RuntimeError(f"无法读取番组计划官方归档信息：{last_error}") from last_error


class RemoteZip:
    def __init__(self, asset_url: str, size: int, retries: int = 6) -> None:
        self.asset_url = asset_url
        self.size = size
        self.retries = retries

    def read_range(self, start: int, end: int) -> bytes:
        if start < 0 or end < start or end >= self.size:
            raise ValueError(f"invalid byte range {start}-{end} for {self.size}")
        last_error: Exception | None = None
        for attempt in range(self.retries):
            request = Request(
                self.asset_url,
                headers={
                    "Accept": "application/octet-stream",
                    "Range": f"bytes={start}-{end}",
                    "User-Agent": USER_AGENT,
                },
            )
            try:
                with urlopen(request, timeout=90) as response:
                    data = response.read()
                expected = end - start + 1
                if len(data) != expected:
                    raise IOError(f"range returned {len(data)} bytes, expected {expected}")
                return data
            except (HTTPError, URLError, TimeoutError, OSError) as error:
                last_error = error
                if attempt + 1 >= self.retries:
                    break
                wait = min(60, 2 ** attempt * 2)
                print(f"  分段下载失败，{wait}秒后重试 {attempt + 2}/{self.retries}...", file=sys.stderr)
                time.sleep(wait)
        raise RuntimeError(f"无法读取官方归档字节范围 {start}-{end}: {last_error}") from last_error

    def members(self) -> list[dict[str, Any]]:
        tail_size = min(self.size, 131072)
        tail_start = self.size - tail_size
        tail = self.read_range(tail_start, self.size - 1)
        eocd_index = tail.rfind(EOCD_SIGNATURE)
        if eocd_index < 0:
            raise RuntimeError("找不到ZIP中央目录结束标记")
        eocd = tail[eocd_index:eocd_index + 22]
        if len(eocd) < 22:
            raise RuntimeError("ZIP中央目录结束记录不完整")
        _, _, _, _, total_entries, central_size, central_offset, _ = struct.unpack("<4s4H2LH", eocd)
        central = self.read_range(central_offset, central_offset + central_size - 1)

        members: list[dict[str, Any]] = []
        cursor = 0
        while cursor < len(central) and len(members) < total_entries:
            header = central[cursor:cursor + 46]
            if len(header) < 46 or header[:4] != CENTRAL_SIGNATURE:
                raise RuntimeError(f"ZIP中央目录在偏移{cursor}处损坏")
            values = struct.unpack("<4s6H3I5H2I", header)
            flags, method = values[3], values[4]
            crc32, compressed_size, uncompressed_size = values[7], values[8], values[9]
            filename_length, extra_length, comment_length = values[10], values[11], values[12]
            local_offset = values[16]
            name_bytes = central[cursor + 46:cursor + 46 + filename_length]
            encoding = "utf-8" if flags & 0x800 else "cp437"
            name = name_bytes.decode(encoding, errors="replace")
            members.append({
                "name": name,
                "flags": flags,
                "method": method,
                "crc32": crc32,
                "compressed_size": compressed_size,
                "uncompressed_size": uncompressed_size,
                "local_offset": local_offset,
            })
            cursor += 46 + filename_length + extra_length + comment_length
        return members

    def extract_member(self, member: dict[str, Any], output: Path, chunk_size: int = 8 * 1024 * 1024) -> None:
        local_offset = int(member["local_offset"])
        local_header = self.read_range(local_offset, local_offset + 29)
        if local_header[:4] != LOCAL_SIGNATURE:
            raise RuntimeError("ZIP本地文件头损坏")
        values = struct.unpack("<4s5H3I2H", local_header)
        filename_length, extra_length = values[9], values[10]
        data_start = local_offset + 30 + filename_length + extra_length
        compressed_size = int(member["compressed_size"])
        method = int(member["method"])
        if method not in {0, 8}:
            raise RuntimeError(f"暂不支持ZIP压缩方法 {method}")

        output.parent.mkdir(parents=True, exist_ok=True)
        temporary = output.with_suffix(output.suffix + ".part")
        decompressor = zlib.decompressobj(-15) if method == 8 else None
        crc = 0
        written = 0
        downloaded = 0
        with temporary.open("wb") as handle:
            while downloaded < compressed_size:
                length = min(chunk_size, compressed_size - downloaded)
                block = self.read_range(data_start + downloaded, data_start + downloaded + length - 1)
                downloaded += len(block)
                plain = decompressor.decompress(block) if decompressor else block
                if plain:
                    handle.write(plain)
                    written += len(plain)
                    crc = binascii.crc32(plain, crc)
                percent = downloaded / compressed_size * 100
                print(
                    f"\r  下载 subject.jsonlines：{downloaded / 1024 / 1024:.1f}/"
                    f"{compressed_size / 1024 / 1024:.1f} MiB ({percent:.0f}%)",
                    end="",
                    flush=True,
                )
            if decompressor:
                plain = decompressor.flush()
                handle.write(plain)
                written += len(plain)
                crc = binascii.crc32(plain, crc)
        print()
        if written != int(member["uncompressed_size"]):
            temporary.unlink(missing_ok=True)
            raise RuntimeError(f"解压大小校验失败：{written} != {member['uncompressed_size']}")
        if crc & 0xFFFFFFFF != int(member["crc32"]):
            temporary.unlink(missing_ok=True)
            raise RuntimeError("subject.jsonlines CRC32校验失败")
        temporary.replace(output)


def season_for_date(date_value: str) -> str | None:
    match = re.match(r"^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?", date_value or "")
    if not match:
        return None
    month = int(match.group(2))
    if month <= 3:
        return "1"
    if month <= 6:
        return "4"
    if month <= 9:
        return "7"
    if month <= 12:
        return "10"
    return None


def studio_from_infobox(value: str) -> str:
    for line in (value or "").splitlines():
        match = re.match(r"\s*\|?\s*(?:动画制作|動畫製作|制作公司|製作公司)\s*=\s*(.+?)\s*$", line)
        if match:
            return re.sub(r"\{\{.*?\}\}|\[\[|\]\]", "", match.group(1)).strip()[:120]
    return ""


def convert_subject(subject: dict[str, Any]) -> dict[str, Any]:
    subject_id = int(subject["id"])
    date_value = str(subject.get("date") or "").strip()
    score = subject.get("score")
    rank = subject.get("rank")
    platform = str(subject.get("platform") or "").strip().upper()
    is_web = platform in {"WEB", "5"}
    alias_match = re.search(r"\|别名=\{(.*?)\n\}", str(subject.get("infobox") or ""), re.S)
    aliases = re.findall(r"\[([^\[\]\r\n]+)\]", alias_match.group(1)) if alias_match else []
    return {
        "id": f"bgm-{subject_id}",
        "title": str(subject.get("name_cn") or subject.get("name") or "未命名作品").strip(),
        "originalTitle": str(subject.get("name") or "").strip(),
        "year": int(date_value[:4]),
        "type": "web" if is_web else "tv",
        "season": None if is_web else season_for_date(date_value),
        "aliases": aliases,
        "poster": f"https://api.bgm.tv/v0/subjects/{subject_id}/image?type=large",
        "releaseDate": date_value,
        "studio": studio_from_infobox(str(subject.get("infobox") or "")),
        "note": "",
        "score": float(score) if score else None,
        "rank": int(rank) if rank else None,
        "source": [{"name": "番组计划", "url": f"https://bgm.tv/subject/{subject_id}"}],
    }


def build_tv_data(subject_path: Path, output_dir: Path, years: tuple[int, int], include_nsfw: bool) -> dict[str, Any]:
    start_year, end_year = years
    confirmed: list[dict[str, Any]] = []
    review: list[dict[str, Any]] = []
    platform_counts: Counter[str] = Counter()
    scanned = 0
    non_japanese_excluded = 0
    country_unknown_admitted = 0
    with subject_path.open("r", encoding="utf-8") as handle:
        for line in handle:
            if not line.strip():
                continue
            subject = json.loads(line)
            if subject.get("type") != 2:
                continue
            platform = str(subject.get("platform") or "").strip()
            platform_counts[platform] += 1
            # Archive currently stores the common platform enum as its numeric ID;
            # Bangumi's public API uses 1=TV, 2=OVA, 3=Movie and 5=WEB.
            if platform.upper() not in {"TV", "1", "WEB", "5"}:
                continue
            if subject.get("nsfw") and not include_nsfw:
                continue
            meta_tags = {str(tag) for tag in (subject.get("meta_tags") or [])}
            if "日本" not in meta_tags:
                if meta_tags.intersection(COUNTRY_TAGS):
                    non_japanese_excluded += 1
                    continue
                # “没有国家标签”不是“明确为其他国家”。先纳入候选，后续再用
                # 普通标签中的强产地证据复核，避免把未标注“日本”的日番全部漏掉。
                country_unknown_admitted += 1
            date_value = str(subject.get("date") or "")
            if not re.match(r"^\d{4}", date_value):
                review.append({
                    "id": f"bgm-{subject['id']}",
                    "title": subject.get("name_cn") or subject.get("name") or "未命名作品",
                    "originalTitle": subject.get("name") or "",
                    "releaseDate": date_value,
                    "reason": "missing_year_or_date",
                    "source": f"https://bgm.tv/subject/{subject['id']}",
                })
                continue
            year = int(date_value[:4])
            if year < start_year or year > end_year:
                continue
            scanned += 1
            record = convert_subject(subject)
            if record["type"] == "web" or record["season"]:
                confirmed.append(record)
            else:
                review.append({**record, "reason": "missing_month"})

    confirmed.sort(key=lambda item: (item["year"], item["releaseDate"], item["title"]))
    review.sort(key=lambda item: (str(item.get("releaseDate") or ""), item["title"]))
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "bangumi-tv.json").write_text(json.dumps(confirmed, ensure_ascii=False, indent=2), encoding="utf-8")
    (output_dir / "manual-review-missing-date.json").write_text(json.dumps(review, ensure_ascii=False, indent=2), encoding="utf-8")
    season_counts = Counter(item["season"] for item in confirmed if item["season"])
    year_counts = Counter(str(item["year"]) for item in confirmed)
    review_reason_counts = Counter(str(item.get("reason") or "unknown") for item in review)
    summary = {
        "year_range": [start_year, end_year],
        "tv_in_range": scanned,
        "quarter_ready": len(confirmed),
        "manual_review": len(review),
        "manual_review_reason_counts": dict(sorted(review_reason_counts.items())),
        "non_japanese_excluded": non_japanese_excluded,
        "country_unknown_admitted": country_unknown_admitted,
        "season_counts": dict(sorted(season_counts.items())),
        "year_counts": dict(sorted(year_counts.items())),
        "top_platform_counts": dict(platform_counts.most_common(12)),
        "nsfw_included": include_nsfw,
    }
    (output_dir / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    return summary


def main() -> int:
    parser = argparse.ArgumentParser(description="从番组计划官方Archive提取日本电视与网络动画资料")
    parser.add_argument("--years", type=parse_years, default=parse_years("1960-2030"))
    parser.add_argument("--cache-dir", type=Path, default=Path(".cache") / "bangumi-archive")
    parser.add_argument("--output-dir", type=Path, default=Path("data") / "bangumi-tv")
    parser.add_argument("--include-nsfw", action="store_true")
    parser.add_argument("--subject-file", type=Path, help="已有subject.jsonlines时直接使用，不下载")
    parser.add_argument("--relations-file", type=Path, help="已有subject-relations.jsonlines时直接使用")
    parser.add_argument("--extract-relations", action="store_true", help="同时从官方归档提取关系数据")
    args = parser.parse_args()

    if args.subject_file:
        subject_path = args.subject_file
        relations_path = args.relations_file
        archive_meta = {
            "name": subject_path.name,
            "created_at": None,
            "source": "https://github.com/bangumi/Archive" if subject_path.name.startswith("dump-") else "local",
        }
    else:
        latest = fetch_json(LATEST_META_URL)
        archive_meta = {
            "name": latest["name"],
            "created_at": latest.get("created_at"),
            "source": "https://github.com/bangumi/Archive",
        }
        args.cache_dir.mkdir(parents=True, exist_ok=True)
        archive_stem = Path(latest["name"]).stem
        subject_path = args.cache_dir / f"{archive_stem}.subject.jsonlines"
        relations_path = args.cache_dir / f"{archive_stem}.subject-relations.jsonlines"
        needs_remote = not subject_path.exists() or (args.extract_relations and not relations_path.exists())
        remote = RemoteZip(str(latest["url"]), int(latest["size"])) if needs_remote else None
        members = remote.members() if remote else []
        if subject_path.exists():
            print(f"使用已缓存的 {subject_path}")
        else:
            print(f"读取番组计划官方归档：{latest['name']}（远程只提取subject.jsonlines）")
            subject_member = next(
                (member for member in members if Path(member["name"]).name == "subject.jsonlines"),
                None,
            )
            if not subject_member:
                names = ", ".join(member["name"] for member in members)
                raise RuntimeError(f"归档中找不到subject.jsonlines。现有文件：{names}")
            print(
                f"归档总大小 {latest['size'] / 1024 / 1024:.1f} MiB；"
                f"仅需下载条目数据 {subject_member['compressed_size'] / 1024 / 1024:.1f} MiB。"
            )
            remote.extract_member(subject_member, subject_path)
        if args.extract_relations:
            if relations_path.exists():
                print(f"使用已缓存的 {relations_path}")
            else:
                relation_member = next(
                    (member for member in members if Path(member["name"]).name == "subject-relations.jsonlines"),
                    None,
                )
                if not relation_member:
                    raise RuntimeError("归档中找不到subject-relations.jsonlines")
                print(
                    f"同时下载关系数据 {relation_member['compressed_size'] / 1024 / 1024:.1f} MiB。"
                )
                remote.extract_member(relation_member, relations_path)

    if args.extract_relations and (not relations_path or not relations_path.exists()):
        raise RuntimeError("启用 --extract-relations 时必须提供可用的关系数据")
    archive_meta["subject_file"] = str(subject_path)
    archive_meta["relations_file"] = str(relations_path) if relations_path else None

    summary = build_tv_data(subject_path, args.output_dir, args.years, args.include_nsfw)
    summary["archive"] = archive_meta
    (args.output_dir / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
