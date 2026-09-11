#!/usr/bin/env python3
"""Extract Bangumi anime subjects carrying the exact user tag ``中国``.

The JSON archive preserves every ordinary/public tag for later classification.
The browser bundle keeps only the fields required at runtime so mobile visitors
do not need to parse thousands of unused tags.
"""

from __future__ import annotations

import argparse
from datetime import datetime
import json
import re
import unicodedata
from collections import Counter
from pathlib import Path
from typing import Any


DATE_FIELDS = (
    "开始", "首播", "放送开始", "放送開始", "上映年度", "上映日",
    "发行日期", "發行日期", "发售日", "發售日", "播放开始", "播放開始",
)
RUNTIME_FIELDS = ("片长", "片長", "时长", "時長", "播放时长", "播放時長")
STUDIO_FIELDS = (
    "动画制作", "動畫製作", "制作", "製作", "制作公司", "製作公司",
    "出品公司", "联合摄制", "聯合攝製",
)
PLATFORM_NAMES = {0: "未标注", 1: "TV", 2: "OVA", 3: "Movie", 5: "Web", 2006: "动态漫画"}
PLATFORM_KEYS = {1: "tv", 2: "ova", 3: "movie", 5: "web", 2006: "motion_comic"}
CHINESE_BROWSER_FIELDS = {
    "id", "title", "originalTitle", "year", "type", "origin", "poster", "releaseDate",
    "studio", "score", "rank", "voteCount", "runtimeText", "runtimeMinutes",
    "episodeCount", "bangumiTags", "bangumiOrdinaryTag", "bangumiTagTotal",
    "chineseCategoryKey", "preliminaryTypeLabel", "source",
}


def infobox_value(infobox: str, labels: tuple[str, ...]) -> str:
    names = "|".join(re.escape(label) for label in labels)
    match = re.search(rf"(?m)^\s*\|?\s*(?:{names})\s*=\s*([^\r\n]*)", infobox or "")
    return match.group(1).strip() if match else ""


def clean_wiki_text(value: str) -> str:
    value = re.sub(r"\{\{.*?\}\}|\[\[|\]\]", "", value or "")
    return re.sub(r"\s+", " ", value).strip(" ,，、")[:160]


def subject_date(subject: dict[str, Any]) -> tuple[str, int | None]:
    direct = str(subject.get("date") or "").strip()
    candidate = direct if re.search(r"(?:19|20)\d{2}", direct) else infobox_value(
        str(subject.get("infobox") or ""), DATE_FIELDS
    )
    match = re.search(r"(?<!\d)((?:19|20)\d{2})(?!\d)", candidate)
    if not match:
        return "", None
    year = int(match.group(1))
    suffix = candidate[match.end():]
    month_match = re.search(r"(?:[-/.年]\s*)(\d{1,2})(?:\s*月)?", suffix)
    day_match = re.search(r"(?:[-/.月]\s*)(\d{1,2})(?:\s*日)?", suffix[month_match.end():] if month_match else "")
    if not month_match:
        return str(year), year
    month = max(1, min(12, int(month_match.group(1))))
    if not day_match:
        return f"{year:04d}-{month:02d}", year
    day = max(1, min(31, int(day_match.group(1))))
    return f"{year:04d}-{month:02d}-{day:02d}", year


def runtime_from_infobox(infobox: str) -> tuple[str, float | None]:
    value = infobox_value(infobox, RUNTIME_FIELDS)
    if not value:
        return "", None
    hours = re.search(r"(\d+(?:\.\d+)?)\s*(?:小时|小時|時間|h(?:ours?)?)", value, re.I)
    minutes = re.search(r"(\d+(?:\.\d+)?)\s*(?:分钟|分鐘|分|min(?:utes?)?)", value, re.I)
    clock = re.search(r"(?<!\d)(\d{1,2}):(\d{2})(?::(\d{2}))?", value)
    total = 0.0
    if hours:
        total += float(hours.group(1)) * 60
    if minutes:
        total += float(minutes.group(1))
    if not total and clock:
        first, second, third = clock.groups()
        total = int(first) * 60 + int(second) + int(third or 0) / 60 if third else int(first) + int(second) / 60
    return clean_wiki_text(value), round(total, 2) if total else None


def episode_count(infobox: str) -> int | None:
    value = infobox_value(infobox, ("话数", "話数"))
    match = re.search(r"\d+", value)
    return int(match.group()) if match and int(match.group()) > 0 else None


def all_tags(subject: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    meta_names = {str(name or "").strip() for name in subject.get("meta_tags") or [] if name}
    ordinary: list[dict[str, Any]] = []
    seen: set[str] = set()
    for raw in subject.get("tags") or []:
        name = str(raw.get("name") or "").strip()
        if not name or name in seen:
            continue
        seen.add(name)
        count = raw.get("count")
        ordinary.append({
            "name": name,
            "count": max(0, int(count)) if isinstance(count, (int, float)) else None,
            "public": name in meta_names,
        })
    for name in sorted(meta_names - seen):
        ordinary.append({"name": name, "count": None, "public": True})
    public = [{"name": tag["name"], "count": tag["count"]} for tag in ordinary if tag["public"]]
    return ordinary, public


def normalized_tag_names(tags: list[dict[str, Any]]) -> set[str]:
    return {unicodedata.normalize("NFKC", str(tag.get("name") or "")).strip().lower() for tag in tags}


def chinese_category_key(tags: list[dict[str, Any]]) -> str:
    names = normalized_tag_names(tags)
    if names.intersection({"动画电影", "動畫電影", "电影", "電影", "电影版", "電影版", "剧场版", "劇場版", "movie"}):
        return "cn-movie"
    if names.intersection({"tv", "tva", "tv动画", "電視動畫", "电视动画"}):
        return "cn-tv"
    if names.intersection({"web", "web动画", "网络动画", "網絡動畫", "网播"}):
        return "cn-web"
    return "cn-other"


def first_useful_ordinary_tag(tags: list[dict[str, Any]]) -> dict[str, Any] | None:
    excluded = {
        "tv", "tva", "tv动画", "電視動畫", "电视动画", "web", "web动画", "网络动画", "網絡動畫", "网播",
        "ova", "oad", "剧场版", "劇場版", "动画电影", "動畫電影", "电影", "電影", "电影版", "電影版", "movie",
        "中国", "中國", "国产", "國產", "其他",
    }
    normalized_excluded = {unicodedata.normalize("NFKC", name).strip().lower() for name in excluded}
    for tag in tags:
        name = unicodedata.normalize("NFKC", str(tag.get("name") or "")).strip().lower()
        if not tag.get("public") and name and name not in normalized_excluded:
            return {"name": tag["name"], "count": tag.get("count")}
    return None


def convert_subject(subject: dict[str, Any]) -> dict[str, Any]:
    subject_id = int(subject["id"])
    infobox = str(subject.get("infobox") or "")
    release_date, year = subject_date(subject)
    runtime_text, runtime_minutes = runtime_from_infobox(infobox)
    platform = int(subject.get("platform") or 0)
    tags, public_tags = all_tags(subject)
    score_details = subject.get("score_details") or {}
    vote_count = sum(int(value or 0) for value in score_details.values())
    raw_score = subject.get("score")
    score = float(raw_score) if vote_count >= 30 and isinstance(raw_score, (int, float)) else None
    return {
        "id": f"bgm-cn-{subject_id}",
        "bangumi_id": subject_id,
        "title": str(subject.get("name_cn") or subject.get("name") or "未命名作品").strip(),
        "originalTitle": str(subject.get("name") or "").strip(),
        "year": year,
        "type": "other",
        "season": None,
        "origin": "cn",
        "originLabel": "国产候选",
        "classificationPending": True,
        "preliminaryType": PLATFORM_KEYS.get(platform, "unknown"),
        "preliminaryTypeLabel": PLATFORM_NAMES.get(platform, f"平台 {platform}"),
        "poster": f"https://api.bgm.tv/v0/subjects/{subject_id}/image?type=large",
        "releaseDate": release_date,
        "dateUnknown": year is None,
        "studio": clean_wiki_text(infobox_value(infobox, STUDIO_FIELDS)),
        "note": "",
        "score": score,
        "rawScore": float(raw_score) if isinstance(raw_score, (int, float)) else None,
        "rank": int(subject["rank"]) if isinstance(subject.get("rank"), int) and subject["rank"] > 0 else None,
        "voteCount": vote_count,
        "rankingEligible": vote_count >= 100,
        "runtimeText": runtime_text,
        "runtimeMinutes": runtime_minutes,
        "episodeCount": episode_count(infobox),
        "bangumiPlatform": platform or None,
        "bangumiTags": public_tags,
        "bangumiAllTags": tags,
        "bangumiOrdinaryTag": first_useful_ordinary_tag(tags),
        "bangumiTagTotal": sum(tag["count"] or 0 for tag in tags),
        "chineseCategoryKey": chinese_category_key(tags),
        "countryEvidenceTags": ["中国"],
        "classificationReason": "番组计划用户标签包含“中国”；具体格式分类待定",
        "classificationKind": "cn_pending",
        "source": [{"name": "番组计划", "url": f"https://bgm.tv/subject/{subject_id}"}],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="从番组计划归档提取带中国标签的动画")
    parser.add_argument("--subjects", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, default=Path("data") / "bangumi-cn")
    parser.add_argument("--web-output", type=Path, default=Path("data") / "anime-cn-data.js")
    parser.add_argument("--include-nsfw", action="store_true")
    parser.add_argument("--max-year", type=int, default=datetime.now().year, help="仅输出不晚于该年份的作品")
    args = parser.parse_args()

    records: list[dict[str, Any]] = []
    excluded_nsfw = 0
    with args.subjects.open("r", encoding="utf-8") as handle:
        for line in handle:
            if not line.strip():
                continue
            subject = json.loads(line)
            if int(subject.get("type") or 0) != 2:
                continue
            names = {str(tag.get("name") or "").strip() for tag in subject.get("tags") or []}
            names.update(str(tag or "").strip() for tag in subject.get("meta_tags") or [])
            if "中国" not in names:
                continue
            if subject.get("nsfw") and not args.include_nsfw:
                excluded_nsfw += 1
                continue
            record = convert_subject(subject)
            if record["year"] is not None and record["year"] > args.max_year:
                continue
            records.append(record)

    records.sort(key=lambda item: (item["year"] is None, item["year"] or 9999, item["releaseDate"], item["title"]))
    platform_counts = Counter(item["preliminaryTypeLabel"] for item in records)
    public_tag_counts = Counter(tag["name"] for item in records for tag in item["bangumiTags"])
    summary = {
        "source": args.subjects.name,
        "records": len(records),
        "dated": sum(item["year"] is not None for item in records),
        "undated": sum(item["year"] is None for item in records),
        "excluded_nsfw": excluded_nsfw,
        "platform_counts": dict(platform_counts.most_common()),
        "top_public_tags": dict(public_tag_counts.most_common(30)),
        "all_tags_preserved": True,
        "max_year": args.max_year,
    }
    args.output_dir.mkdir(parents=True, exist_ok=True)
    (args.output_dir / "bangumi-cn.json").write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")
    (args.output_dir / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    args.web_output.parent.mkdir(parents=True, exist_ok=True)
    web_records = [
        {
            key: value
            for key, value in record.items()
            if key in CHINESE_BROWSER_FIELDS
            and value is not None and value != "" and value is not False and value != [] and value != {}
        }
        for record in records
    ]
    script = (
        "/* Generated by tools/extract_bangumi_chinese_anime.py. */\n"
        f"window.ANIME_CN_DATA_META = {json.dumps(summary, ensure_ascii=False, separators=(',', ':'))};\n"
        f"window.ANIME_CN_DATA = {json.dumps(web_records, ensure_ascii=False, separators=(',', ':'))};\n"
    )
    args.web_output.write_text(script, encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
