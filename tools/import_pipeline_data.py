#!/usr/bin/env python3
"""Convert pipeline JSON files into the static website data bundle."""

from __future__ import annotations

import argparse
from datetime import datetime
import json
import re
from pathlib import Path
from typing import Any


THEATRICAL_PATTERN = re.compile(r"剧场版|劇場版|theatrical", re.IGNORECASE)
BROWSER_AUDIT_FIELDS = {
    "rankingEligible",
    "theatricalStatus",
    "theatricalReleaseDates",
    "otherTheatricalReleaseDates",
    "homeVideoReleaseDates",
    "hasInternationalRelease",
    "bangumiPlatform",
    "classificationReason",
    "classificationKind",
}


def as_number(value: Any) -> int | float | None:
    if value in (None, ""):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return int(number) if number.is_integer() else number


def infer_type(row: dict[str, Any]) -> str:
    explicit = str(row.get("type") or "").strip().lower()
    if explicit == "ova":
        return "other"
    if explicit in {"tv", "web", "movie", "theatrical", "other"}:
        return explicit

    category = str(row.get("bangumi_category") or row.get("category") or "").strip().lower()
    combined = " ".join(
        str(row.get(key) or "")
        for key in (
            "wikipedia_title_zh",
            "wikipedia_title_ja",
            "bangumi_title_cn",
            "bangumi_title",
            "wikipedia_note",
        )
    )
    if THEATRICAL_PATTERN.search(combined):
        return "theatrical"
    if category == "ova":
        return "other"
    if category == "tv":
        return "tv"
    return "movie"


def infer_season(date_value: str) -> str | None:
    match = re.match(r"^\d{4}-(\d{1,2})", date_value or "")
    if not match:
        return None
    month = int(match.group(1))
    if month <= 3:
        return "1"
    if month <= 6:
        return "4"
    if month <= 9:
        return "7"
    return "10"


def source_links(row: dict[str, Any]) -> list[dict[str, str]]:
    links: list[dict[str, str]] = (
        [item for item in row["source"] if isinstance(item, dict)]
        if isinstance(row.get("source"), list)
        else []
    )
    if row.get("bangumi_url"):
        links.append({"name": "番组计划", "url": str(row["bangumi_url"])})
    if row.get("wikipedia_url"):
        links.append({"name": "维基百科", "url": str(row["wikipedia_url"])})
    for appearance in row.get("wikipedia_appearances") or []:
        if isinstance(appearance, dict) and appearance.get("url"):
            links.append({"name": "维基百科", "url": str(appearance["url"])})
    unique: list[dict[str, str]] = []
    seen_urls: set[str] = set()
    for link in links:
        url = str(link.get("url") or "")
        if url and url not in seen_urls:
            unique.append(link)
            seen_urls.add(url)
    return unique


def convert_row(row: dict[str, Any], index: int) -> dict[str, Any]:
    bangumi_id = row.get("bangumi_id")
    year = int(row.get("year") or str(row.get("bangumi_air_date") or "2000")[:4])
    title = (
        row.get("title")
        or row.get("bangumi_title_cn")
        or row.get("wikipedia_title_zh")
        or row.get("bangumi_title")
        or row.get("wikipedia_title_ja")
        or "未命名作品"
    )
    original_title = (
        row.get("originalTitle")
        or row.get("bangumi_title")
        or row.get("wikipedia_title_ja")
        or ""
    )
    release_date = str(
        row.get("releaseDate")
        or row.get("bangumi_air_date")
        or ""
    )
    item_type = infer_type(row)
    item_id = str(row.get("id") or (f"bgm-{bangumi_id}" if bangumi_id else f"imported-{year}-{index}"))

    return {
        "id": item_id,
        "title": str(title).strip(),
        "originalTitle": str(original_title).strip(),
        "aliases": [str(value).strip() for value in (row.get("aliases") or []) if str(value).strip()],
        "year": year,
        "type": item_type,
        "season": (str(row.get("season")) if row.get("season") else infer_season(release_date))
        if item_type == "tv"
        else None,
        "poster": str(row.get("poster") or row.get("bangumi_poster") or "").strip(),
        "releaseDate": release_date,
        "studio": str(row.get("studio") or row.get("wikipedia_studio") or "").strip(),
        "note": str(row.get("note") or row.get("wikipedia_note") or "").strip(),
        "score": as_number(row.get("score") if "score" in row else row.get("bangumi_score")),
        "rank": as_number(row.get("rank") if "rank" in row else row.get("bangumi_rank")),
        "voteCount": as_number(row.get("voteCount")),
        "rankingEligible": bool(row.get("rankingEligible")),
        "source": source_links(row),
        "runtimeText": str(row.get("runtimeText") or "").strip(),
        "runtimeMinutes": as_number(row.get("runtimeMinutes")),
        "episodeCount": as_number(row.get("episodeCount")),
        "theatricalStatus": str(row.get("theatricalStatus") or "").strip(),
        "theatricalReleaseDates": row.get("theatricalReleaseDates") or [],
        "otherTheatricalReleaseDates": row.get("otherTheatricalReleaseDates") or [],
        "homeVideoReleaseDates": row.get("homeVideoReleaseDates") or [],
        "hasInternationalRelease": bool(row.get("hasInternationalRelease")),
        "bangumiPlatform": as_number(row.get("bangumiPlatform")),
        "classificationReason": str(row.get("classificationReason") or "").strip(),
        "classificationKind": str(row.get("classificationKind") or "").strip(),
        "isCompilation": bool(row.get("isCompilation")) or str(row.get("classificationKind") or "") == "summary",
        "bangumiTags": row.get("bangumiTags") if isinstance(row.get("bangumiTags"), list) else [],
        "bangumiOrdinaryTag": row.get("bangumiOrdinaryTag") if isinstance(row.get("bangumiOrdinaryTag"), dict) else None,
        "bangumiTagTotal": as_number(row.get("bangumiTagTotal")) or 0,
    }


def load_rows(path: Path) -> list[dict[str, Any]]:
    payload = json.loads(path.read_text(encoding="utf-8-sig"))
    if isinstance(payload, list):
        return [row for row in payload if isinstance(row, dict)]
    if isinstance(payload, dict):
        for key in ("records", "items", "data"):
            if isinstance(payload.get(key), list):
                return [row for row in payload[key] if isinstance(row, dict)]
    raise ValueError(f"{path} 中没有可识别的动画数组")


def compact_browser_record(record: dict[str, Any]) -> dict[str, Any]:
    """Keep runtime fields while leaving audit-only metadata in source JSON/CSV."""
    compact: dict[str, Any] = {}
    for key, value in record.items():
        if key in BROWSER_AUDIT_FIELDS:
            continue
        if value is None or value == "" or value is False or value == [] or value == {}:
            continue
        compact[key] = value
    return compact


def main() -> int:
    parser = argparse.ArgumentParser(description="把数据整理流程输出转换成番剧网页资料包")
    parser.add_argument("inputs", nargs="+", type=Path, help="一个或多个 JSON 数据文件")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "data" / "anime-data.js",
        help="网页资料包输出位置",
    )
    parser.add_argument("--max-year", type=int, default=datetime.now().year, help="仅导入不晚于该年份的作品")
    args = parser.parse_args()

    converted: dict[str, dict[str, Any]] = {}
    source_names: list[str] = []
    for input_path in args.inputs:
        resolved = input_path.resolve()
        source_names.append(resolved.name)
        for index, row in enumerate(load_rows(resolved)):
            item = convert_row(row, index)
            if item["year"] > args.max_year:
                continue
            converted[item["id"]] = item

    records = sorted(
        converted.values(),
        key=lambda item: (item["year"], item.get("releaseDate") or "", item["title"]),
    )
    meta = {
        "format": "anime-atlas-catalog",
        "version": 1,
        "count": len(records),
        "sources": source_names,
        "maxYear": args.max_year,
    }
    browser_records = [compact_browser_record(record) for record in records]
    content = (
        "/* Generated by tools/import_pipeline_data.py. */\n"
        f"window.ANIME_DATA_META = {json.dumps(meta, ensure_ascii=False, separators=(',', ':'))};\n"
        f"window.ANIME_DATA = {json.dumps(browser_records, ensure_ascii=False, separators=(',', ':'))};\n"
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(content, encoding="utf-8")
    print(f"Imported {len(records)} anime record(s) -> {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
