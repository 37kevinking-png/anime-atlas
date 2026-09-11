#!/usr/bin/env python3
"""Extract Japanese animation records from 1917-1959 in a Bangumi Archive dump.

The archive does not consistently attach a country meta tag to very early
subjects, so provenance is accepted when either user tags explicitly identify
Japan or the subject description identifies the work as Japanese/domestic.
Ambiguous country records are kept out of the public catalog and listed in a
small review file instead of being guessed into the dataset.
"""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from pathlib import Path
from typing import Any


START_YEAR = 1917
END_YEAR = 1959
JAPAN_TAGS = {
    "日本", "日本动画", "日本動畫", "日本アニメ", "日本製", "日本制作",
    "日本製作", "日本产", "日本產", "国産アニメ", "国産动画",
}
FOREIGN_COUNTRY_TAGS = {
    "中国", "美国", "英國", "英国", "法国", "法國", "韩国", "韓國",
    "苏联", "蘇聯", "俄罗斯", "俄羅斯", "加拿大", "德国", "德國", "意大利",
    "西班牙", "澳大利亚", "澳大利亞", "朝鲜", "朝鮮", "印度", "阿根廷",
    "巴西", "墨西哥", "捷克", "波兰", "波蘭", "匈牙利", "南斯拉夫",
    "中国动画", "中國動畫", "国产", "國產", "国产动画", "國產動畫", "国漫",
    "大陆", "大陸", "中国大陆", "中國大陸", "香港", "台湾", "台灣", "中日合作",
}
STRONG_FOREIGN_PRODUCTION_TAGS = {
    "中国动画", "中國動畫", "国产动画", "國產動畫", "国漫", "中日合作", "日中合作",
    "中日合拍", "中日合拍动画", "中日合拍動畫", "美国动画", "美國動畫", "韩国动画", "韓國動畫",
}
WEAK_DOMESTIC_TAGS = {"国产", "國產"}
CO_PRODUCTION_PATTERN = re.compile(r"(?:中日|日中|美日|日美|韩日|韓日|日韩|日韓|日法|法日|加日|日加).*(?:合作|合拍)")
JAPANESE_PROVENANCE = re.compile(
    r"(?:初|最初|初期)?(?:の)?国産(?:の)?(?:短篇|短編)?(?:アニメ|動画|漫画映画)"
    r"|日本(?:国産|国内)?(?:初|最初|初期)?(?:の|で制作(?:された)?|で製作(?:された)?)"
    r"(?:短篇|短編)?(?:アニメ(?:ーション)?|動画|漫画映画)"
    r"|(?:日本|本邦)(?:初|最初|初期|国産).{0,20}(?:アニメ|動画|漫画映画)"
    r"|日本(?:の|で公開された)(?:短篇|短編)?アニメ(?:ーション)?映画",
    re.I,
)


def tag_names(subject: dict[str, Any]) -> set[str]:
    return {
        str(tag.get("name") or "").strip()
        for tag in subject.get("tags") or []
        if tag.get("name")
    } | {
        str(tag or "").strip()
        for tag in subject.get("meta_tags") or []
        if tag
    }


def foreign_production_tags(subject: dict[str, Any]) -> set[str]:
    ordinary = {
        str(tag.get("name") or "").strip()
        for tag in subject.get("tags") or []
        if tag.get("name")
    }
    meta = {str(tag or "").strip() for tag in subject.get("meta_tags") or [] if tag}
    hits = meta.intersection(FOREIGN_COUNTRY_TAGS)
    hits.update(name for name in ordinary if name in STRONG_FOREIGN_PRODUCTION_TAGS or CO_PRODUCTION_PATTERN.search(name))
    if not meta.intersection(JAPAN_TAGS):
        hits.update(ordinary.intersection(WEAK_DOMESTIC_TAGS))
    return hits


def infobox_value(infobox: str, *labels: str) -> str:
    names = "|".join(re.escape(label) for label in labels)
    match = re.search(rf"(?m)^\s*\|?\s*(?:{names})\s*=\s*([^\r\n]*)", infobox or "")
    return match.group(1).strip() if match else ""


def subject_date(subject: dict[str, Any]) -> str:
    date_value = str(subject.get("date") or "").strip()
    if re.match(r"^\d{4}", date_value):
        return date_value
    infobox = str(subject.get("infobox") or "")
    value = infobox_value(infobox, "上映年度", "开始", "發售日", "发售日")
    match = re.search(r"(19\d{2})年(?:\s*(\d{1,2})月)?(?:\s*(\d{1,2})日)?", value)
    if not match:
        return ""
    year, month, day = match.groups()
    if not month:
        return year
    return f"{year}-{int(month):02d}" + (f"-{int(day):02d}" if day else "")


def runtime_from_infobox(infobox: str) -> tuple[str, float | None]:
    value = infobox_value(infobox, "片长", "片長", "播放时长", "播放時長")
    if not value:
        return "", None
    hour_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:小时|小時|時間|h(?:ours?)?)", value, re.I)
    minute_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:分钟|分鐘|分|min(?:utes?)?)", value, re.I)
    seconds_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:秒|sec(?:onds?)?)", value, re.I)
    minutes = 0.0
    if hour_match:
        minutes += float(hour_match.group(1)) * 60
    if minute_match:
        minutes += float(minute_match.group(1))
    if seconds_match:
        minutes += float(seconds_match.group(1)) / 60
    return value, round(minutes, 2) if minutes else None


def episode_count(infobox: str) -> int | None:
    value = infobox_value(infobox, "话数", "話数")
    match = re.search(r"\d+", value)
    return int(match.group()) if match and int(match.group()) > 0 else None


def studio_from_infobox(infobox: str) -> str:
    value = infobox_value(infobox, "动画制作", "動畫製作", "制作公司", "製作公司")
    return re.sub(r"\{\{.*?\}\}|\[\[|\]\]", "", value).strip()[:120]


def is_japanese(subject: dict[str, Any]) -> tuple[bool, str]:
    tags = tag_names(subject)
    if foreign_production_tags(subject):
        return False, "foreign_country_tag"
    if tags.intersection(JAPAN_TAGS):
        return True, "japan_tag"
    text = " ".join((str(subject.get("summary") or ""), str(subject.get("infobox") or "")))
    if JAPANESE_PROVENANCE.search(text):
        return True, "description_provenance"
    return False, "country_unknown"


def preliminary_type(platform: int) -> str:
    return {1: "tv", 2: "other", 3: "movie"}.get(platform, "other")


def season_for_date(date_value: str) -> str | None:
    match = re.match(r"^\d{4}-(\d{1,2})", date_value or "")
    if not match:
        return None
    month = int(match.group(1))
    return "1" if month <= 3 else "4" if month <= 6 else "7" if month <= 9 else "10"


def convert_subject(subject: dict[str, Any], date_value: str) -> dict[str, Any]:
    subject_id = int(subject["id"])
    infobox = str(subject.get("infobox") or "")
    runtime_text, runtime_minutes = runtime_from_infobox(infobox)
    platform = int(subject.get("platform") or 0)
    item_type = preliminary_type(platform)
    year = int(date_value[:4])
    return {
        "id": f"bgm-{subject_id}",
        "bangumi_id": subject_id,
        "title": str(subject.get("name_cn") or subject.get("name") or "未命名作品").strip(),
        "originalTitle": str(subject.get("name") or "").strip(),
        "year": year,
        "type": item_type,
        "season": season_for_date(date_value) if item_type == "tv" else None,
        "poster": f"https://api.bgm.tv/v0/subjects/{subject_id}/image?type=large",
        "releaseDate": date_value,
        "studio": studio_from_infobox(infobox),
        "note": "",
        "runtimeText": runtime_text,
        "runtimeMinutes": runtime_minutes,
        "episodeCount": episode_count(infobox),
        "bangumiPlatform": platform or None,
        "source": [{"name": "番组计划", "url": f"https://bgm.tv/subject/{subject_id}"}],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="提取1917—1959年的日本动画资料")
    parser.add_argument("--subjects", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, default=Path("data") / "bangumi-early")
    parser.add_argument("--include-nsfw", action="store_true")
    args = parser.parse_args()

    records: list[dict[str, Any]] = []
    review: list[dict[str, Any]] = []
    foreign_exclusions: list[dict[str, Any]] = []
    evidence_counts: Counter[str] = Counter()
    with args.subjects.open("r", encoding="utf-8") as handle:
        for line in handle:
            if not line.strip():
                continue
            subject = json.loads(line)
            if int(subject.get("type") or 0) != 2 or (subject.get("nsfw") and not args.include_nsfw):
                continue
            date_value = subject_date(subject)
            if not re.match(r"^19\d{2}", date_value):
                continue
            year = int(date_value[:4])
            if year < START_YEAR or year > END_YEAR:
                continue
            accepted, reason = is_japanese(subject)
            evidence_counts[reason] += 1
            if accepted:
                records.append(convert_subject(subject, date_value))
            else:
                candidate = {
                    "bangumi_id": int(subject.get("id") or 0),
                    "year": year,
                    "title": subject.get("name_cn") or subject.get("name") or "未命名作品",
                    "originalTitle": subject.get("name") or "",
                    "bangumi_url": f"https://bgm.tv/subject/{subject.get('id')}",
                }
                if reason == "country_unknown":
                    review.append(candidate)
                elif reason == "foreign_country_tag":
                    candidate["matchedTags"] = sorted(foreign_production_tags(subject))
                    foreign_exclusions.append(candidate)

    records.sort(key=lambda item: (item["year"], item.get("releaseDate") or "", item["title"]))
    review.sort(key=lambda item: (item["year"], item["title"]))
    foreign_exclusions.sort(key=lambda item: (item["year"], item["title"]))
    args.output_dir.mkdir(parents=True, exist_ok=True)
    (args.output_dir / "bangumi-early.json").write_text(
        json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (args.output_dir / "country-unknown-review.json").write_text(
        json.dumps(review, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (args.output_dir / "explicit-foreign-exclusions.json").write_text(
        json.dumps(foreign_exclusions, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    decade_counts = Counter(f"{item['year'] // 10 * 10}s" for item in records)
    platform_counts = Counter(str(item.get("bangumiPlatform") or 0) for item in records)
    summary = {
        "year_range": [START_YEAR, END_YEAR],
        "records": len(records),
        "earliest_release": records[0]["releaseDate"] if records else None,
        "decade_counts": dict(sorted(decade_counts.items())),
        "platform_counts": dict(sorted(platform_counts.items())),
        "evidence_counts": dict(sorted(evidence_counts.items())),
        "country_unknown_review": len(review),
        "explicit_foreign_exclusions": len(foreign_exclusions),
    }
    (args.output_dir / "summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
