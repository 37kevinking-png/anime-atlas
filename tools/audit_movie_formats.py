#!/usr/bin/env python3
"""Audit movie/OVA records with Bangumi Archive metadata.

The script performs two jobs without making network requests:

1. A conservative second-pass match for Wikipedia rows that were not matched by
   the original pipeline. Japanese titles, Bangumi aliases, release dates and a
   uniqueness margin are used before a row is accepted automatically.
2. Enrichment of confirmed rows with runtime, home-video dates and theatrical
   release evidence from the Bangumi public archive.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import unicodedata
from collections import Counter
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any, Iterable


PLATFORM_LABELS = {2: "OVA", 3: "Movie"}
COUNTRY_TAGS = {
    "日本", "中国", "美国", "英国", "法国", "韩国", "欧美", "苏联", "俄罗斯",
    "加拿大", "德国", "意大利", "西班牙", "澳大利亚", "印度", "泰国", "朝鲜",
}
JAPANESE_RE = re.compile(r"[\u3040-\u30ff\u3400-\u9fff]")
KANA_RE = re.compile(r"[\u3040-\u30ff]")
FIELD_RE = re.compile(r"^\s*\|\s*([^=]+?)\s*=\s*(.*)$")
THEATRICAL_TITLE_RE = re.compile(r"剧场版|劇場版|映画|the\s*movie", re.IGNORECASE)
FORMAT_WORD_RE = re.compile(
    r"劇場版|剧场版|映画|themovie|movie|cinema|アニメーション|アニメ|まんが",
    re.IGNORECASE,
)


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def write_csv(path: Path, rows: list[dict[str, Any]], fieldnames: Iterable[str] | None = None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not rows and not fieldnames:
        path.write_text("", encoding="utf-8-sig")
        return
    names = list(fieldnames or dict.fromkeys(key for row in rows for key in row))
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=names, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def normalize_title(value: Any) -> str:
    text = unicodedata.normalize("NFKC", str(value or "")).casefold()
    converted: list[str] = []
    for character in text:
        codepoint = ord(character)
        # Treat katakana/hiragana spelling variations as equivalent.
        if 0x30A1 <= codepoint <= 0x30F6:
            character = chr(codepoint - 0x60)
        if not unicodedata.category(character).startswith(("P", "Z", "S")):
            converted.append(character)
    return "".join(converted)


def canonical_title(value: Any) -> str:
    return FORMAT_WORD_RE.sub("", normalize_title(value))


def parse_infobox(text: Any) -> dict[str, str]:
    fields: dict[str, str] = {}
    current_key = ""
    chunks: list[str] = []

    def save() -> None:
        if not current_key:
            return
        value = "\n".join(part for part in chunks if part.strip()).strip()
        if value:
            fields[current_key] = value

    for line in str(text or "").replace("\r", "").split("\n"):
        match = FIELD_RE.match(line)
        if match:
            save()
            current_key = match.group(1).strip()
            chunks = [match.group(2).strip()]
        elif current_key and line.strip() not in {"}", "}}"}:
            chunks.append(line.strip())
    save()
    return fields


def value_parts(value: Any) -> list[str]:
    parts: list[str] = []
    for line in str(value or "").replace("\r", "").split("\n"):
        cleaned = line.strip().strip("{},")
        if cleaned.startswith("[") and cleaned.endswith("]"):
            cleaned = cleaned[1:-1]
        cleaned = cleaned.strip()
        if cleaned:
            parts.append(cleaned)
    return parts


def infobox_values(fields: dict[str, str], *keys: str) -> list[str]:
    values: list[str] = []
    for key in keys:
        values.extend(value_parts(fields.get(key, "")))
    return list(dict.fromkeys(values))


def runtime_minutes(runtime_text: str) -> int | None:
    text = unicodedata.normalize("NFKC", runtime_text or "")
    hour = re.search(r"(\d+(?:\.\d+)?)\s*(?:小时|小時|時間|hours?|hrs?)", text, re.I)
    minute = re.search(r"(\d+(?:\.\d+)?)\s*(?:分钟|分鐘|分|minutes?|mins?)", text, re.I)
    if hour:
        return round(float(hour.group(1)) * 60 + (float(minute.group(1)) if minute else 0))
    if minute:
        return round(float(minute.group(1)))
    plain = re.fullmatch(r"\s*(\d{1,3})\s*", text)
    return int(plain.group(1)) if plain else None


def first_positive_int(value: Any) -> int | None:
    match = re.search(r"\d+", unicodedata.normalize("NFKC", str(value or "")))
    number = int(match.group()) if match else 0
    return number if number > 0 else None


def archive_aliases(subject: dict[str, Any], fields: dict[str, str]) -> list[str]:
    aliases = [str(subject.get("name") or ""), str(subject.get("name_cn") or "")]
    aliases.extend(infobox_values(fields, "别名", "別名", "日文名", "原名"))
    return [alias for alias in dict.fromkeys(aliases) if alias]


def scan_archive(path: Path, wanted_ids: set[int]) -> dict[int, dict[str, Any]]:
    subjects: dict[int, dict[str, Any]] = {}
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            subject_id = int(row.get("id") or 0)
            if subject_id in wanted_ids:
                subjects[subject_id] = row
                if len(subjects) == len(wanted_ids):
                    break
    return subjects


def month_day(value: Any) -> tuple[int, int] | None:
    text = unicodedata.normalize("NFKC", str(value or ""))
    iso = re.search(r"\d{4}[-/.](\d{1,2})[-/.](\d{1,2})", text)
    if iso:
        return int(iso.group(1)), int(iso.group(2))
    east_asian = re.search(r"(\d{1,2})\s*月\s*(\d{1,2})\s*日", text)
    if east_asian:
        return int(east_asian.group(1)), int(east_asian.group(2))
    return None


def candidate_similarity(wiki_title: str, aliases: list[str]) -> tuple[float, float, str]:
    wiki_normal = normalize_title(wiki_title)
    wiki_canonical = canonical_title(wiki_title)
    best_normal = 0.0
    best_canonical = 0.0
    best_alias = ""
    for alias in aliases:
        alias_normal = normalize_title(alias)
        alias_canonical = canonical_title(alias)
        normal_score = SequenceMatcher(None, wiki_normal, alias_normal).ratio() if alias_normal else 0.0
        canonical_score = (
            SequenceMatcher(None, wiki_canonical, alias_canonical).ratio()
            if wiki_canonical and alias_canonical
            else 0.0
        )
        if max(normal_score, canonical_score) > max(best_normal, best_canonical):
            best_normal = normal_score
            best_canonical = canonical_score
            best_alias = alias
    return best_normal, best_canonical, best_alias


def resolve_manual_rows(
    rows: list[dict[str, str]],
    subjects: dict[int, dict[str, Any]],
    bangumi_by_id: dict[int, dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    resolved: list[dict[str, Any]] = []
    unresolved: list[dict[str, Any]] = []

    for row in rows:
        wiki_title = row.get("wikipedia_title_ja", "").strip()
        scored: list[dict[str, Any]] = []
        for index in (1, 2, 3):
            candidate_id = int(row.get(f"candidate_{index}_id") or 0)
            subject = subjects.get(candidate_id)
            if not subject:
                continue
            fields = parse_infobox(subject.get("infobox"))
            aliases = archive_aliases(subject, fields)
            normal, canonical, alias = candidate_similarity(wiki_title, aliases)
            same_date = month_day(row.get("wikipedia_release_date")) == month_day(subject.get("date"))
            scored.append(
                {
                    "id": candidate_id,
                    "subject": subject,
                    "normal": normal,
                    "canonical": canonical,
                    "alias": alias,
                    "same_date": same_date,
                    "combined": max(normal, canonical) + (0.025 if same_date else 0.0),
                }
            )

        scored.sort(key=lambda item: item["combined"], reverse=True)
        best = scored[0] if scored else None
        runner_score = scored[1]["combined"] if len(scored) > 1 else 0.0
        reason = ""
        if best and JAPANESE_RE.search(wiki_title):
            margin = best["combined"] - runner_score
            wiki_normal = normalize_title(wiki_title)
            alias_normal = normalize_title(best["alias"])
            wiki_canonical = canonical_title(wiki_title)
            alias_canonical = canonical_title(best["alias"])
            if wiki_normal and wiki_normal == alias_normal:
                reason = "日文标题规范化后完全相同"
            elif len(wiki_canonical) >= 4 and wiki_canonical == alias_canonical and (best["same_date"] or margin >= 0.05):
                reason = "去除剧场版/电影等格式词后日文标题相同"
            elif best["normal"] >= 0.94 and margin >= 0.08:
                reason = "日文标题高度相似且候选唯一"
            elif best["normal"] >= 0.88 and best["same_date"] and margin >= 0.06:
                reason = "日文标题高度相似且上映月日一致"
            elif best["canonical"] >= 0.92 and best["same_date"] and margin >= 0.08:
                reason = "日文核心标题高度相似且上映月日一致"

        enriched_review = dict(row)
        if best:
            enriched_review.update(
                {
                    "best_japanese_candidate_id": best["id"],
                    "best_japanese_candidate_title": best["alias"],
                    "japanese_similarity": round(best["normal"], 4),
                    "core_title_similarity": round(best["canonical"], 4),
                    "release_month_day_same": "yes" if best["same_date"] else "no",
                    "uniqueness_margin": round(best["combined"] - runner_score, 4),
                }
            )

        if not reason or not best:
            enriched_review["automatic_review_note"] = "未达到保守的自动确认阈值"
            unresolved.append(enriched_review)
            continue

        subject = best["subject"]
        bgm = bangumi_by_id.get(best["id"], {})
        platform = int(subject.get("platform") or bgm.get("category") or 0)
        resolved.append(
            {
                "status": "confirmed_japanese_title_second_pass",
                "year": int(row.get("year") or str(subject.get("date") or "2000")[:4]),
                "period": f"{row.get('year')}年",
                "match_basis": reason,
                "wikipedia_title_zh": row.get("wikipedia_title_zh", ""),
                "wikipedia_title_ja": wiki_title,
                "wikipedia_release_date": row.get("wikipedia_release_date", ""),
                "wikipedia_studio": "",
                "wikipedia_note": "",
                "wikipedia_url": row.get("wikipedia_url", ""),
                "bangumi_id": best["id"],
                "bangumi_category": PLATFORM_LABELS.get(platform, str(platform)),
                "category_agreement": "movie" if platform == 3 else "needs_review",
                "bangumi_title_cn": subject.get("name_cn") or bgm.get("title_cn") or "",
                "bangumi_title": subject.get("name") or bgm.get("title") or "",
                "bangumi_air_date": subject.get("date") or bgm.get("air_date") or "",
                "bangumi_poster": bgm.get("poster") or "",
                "bangumi_score": subject.get("score") or bgm.get("score") or 0,
                "bangumi_rank": subject.get("rank") or bgm.get("rank") or 0,
                "bangumi_url": f"https://bgm.tv/subject/{best['id']}",
                "japanese_match_score": round(max(best["normal"], best["canonical"]), 4),
            }
        )
    return resolved, unresolved


def audit_record(row: dict[str, Any], subject: dict[str, Any] | None) -> dict[str, Any]:
    result = dict(row)
    if not subject:
        category = str(row.get("bangumi_category") or "").strip().lower()
        platform = 2 if category == "ova" else 3 if category == "movie" else 0
        title_text = " ".join(
            str(row.get(key) or "")
            for key in ("bangumi_title", "bangumi_title_cn", "wikipedia_title_ja", "wikipedia_title_zh")
        )
        item_type = "ova" if platform == 2 else (
            "theatrical" if platform == 3 and THEATRICAL_TITLE_RE.search(title_text) else "movie"
        )
        wiki_release = str(row.get("wikipedia_release_date") or "").strip()
        wiki_theatrical_dates = [f"{row.get('year')}年{wiki_release}（维基百科）"] if wiki_release else []
        result.update(
            {
                "type": item_type,
                "bangumiPlatform": platform or None,
                "bangumiPlatformLabel": PLATFORM_LABELS.get(platform, "未知"),
                "runtimeText": "",
                "runtimeMinutes": None,
                "theatricalStatus": "confirmed" if wiki_theatrical_dates else "unknown",
                "theatricalReleaseDates": wiki_theatrical_dates,
                "otherTheatricalReleaseDates": [],
                "homeVideoReleaseDates": [],
                "hasInternationalRelease": False,
                "classificationReason": (
                    f"归档中未找到详情；沿用原抓取的番组计划 {PLATFORM_LABELS[platform]} 分类"
                    if platform
                    else "归档中未找到对应番组计划条目"
                ),
                "classificationNeedsReview": not platform,
                "metadataNeedsReview": True,
            }
        )
        return result

    fields = parse_infobox(subject.get("infobox"))
    platform = int(subject.get("platform") or 0)
    theatrical_dates = infobox_values(fields, "上映年度")
    other_theatrical_dates = infobox_values(fields, "其他上映年度", "其它上映年度")
    home_video_dates = infobox_values(fields, "发售日", "發售日")
    runtime_values = infobox_values(fields, "片长", "片長", "时长", "時長")
    runtime_text = "；".join(runtime_values)
    minutes = runtime_minutes(runtime_text)
    episode_count = first_positive_int("；".join(infobox_values(fields, "话数", "話数")))
    title_text = " ".join(
        str(value or "")
        for value in (
            subject.get("name"),
            subject.get("name_cn"),
            row.get("wikipedia_title_ja"),
            row.get("wikipedia_title_zh"),
        )
    )

    if platform == 2:
        item_type = "ova"
        if theatrical_dates or other_theatrical_dates:
            reason = "番组计划平台为 OVA，同时记录了院线上映日期"
        elif home_video_dates and minutes is not None and minutes <= 60:
            reason = "番组计划平台为 OVA；仅见发售记录，单次时长不超过 60 分钟"
        elif home_video_dates:
            reason = "番组计划平台为 OVA，且有光碟/影像制品发售记录"
        else:
            reason = "番组计划平台为 OVA"
    elif platform == 3 and THEATRICAL_TITLE_RE.search(title_text):
        item_type = "theatrical"
        reason = "番组计划平台为 Movie，标题明确含剧场版/映画标记"
    else:
        item_type = "movie"
        reason = "番组计划平台为 Movie，标题未标为剧场版"

    if theatrical_dates or other_theatrical_dates:
        theatrical_status = "confirmed"
    elif platform == 3:
        theatrical_status = "probable"
    else:
        theatrical_status = "not_listed"

    result.update(
        {
            "type": item_type,
            "bangumiPlatform": platform or None,
            "bangumiPlatformLabel": PLATFORM_LABELS.get(platform, "未知"),
            "runtimeText": runtime_text,
            "runtimeMinutes": minutes,
            "episodeCount": episode_count,
            "theatricalStatus": theatrical_status,
            "theatricalReleaseDates": theatrical_dates,
            "otherTheatricalReleaseDates": other_theatrical_dates,
            "homeVideoReleaseDates": home_video_dates,
            "hasInternationalRelease": bool(other_theatrical_dates),
            "classificationReason": reason,
            "classificationNeedsReview": platform not in PLATFORM_LABELS,
            "metadataNeedsReview": not runtime_text or theatrical_status in {"unknown", "probable"},
        }
    )
    return result


def merge_same_subject(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[int, list[dict[str, Any]]] = {}
    for row in rows:
        grouped.setdefault(int(row.get("bangumi_id") or 0), []).append(row)

    merged: list[dict[str, Any]] = []
    for subject_id, appearances in grouped.items():
        base = dict(appearances[0])
        base["wikipedia_appearances"] = [
            {
                "title_zh": item.get("wikipedia_title_zh", ""),
                "title_ja": item.get("wikipedia_title_ja", ""),
                "release_date": item.get("wikipedia_release_date", ""),
                "url": item.get("wikipedia_url", ""),
            }
            for item in appearances
            if item.get("wikipedia_url") or item.get("wikipedia_title_zh") or item.get("wikipedia_title_ja")
        ]
        if subject_id:
            base["bangumi_id"] = subject_id
        merged.append(base)
    return merged


def bangumi_catalog_row(bgm: dict[str, Any], subject: dict[str, Any]) -> dict[str, Any]:
    subject_id = int(subject.get("id") or bgm.get("subject_id") or 0)
    date_value = str(subject.get("date") or bgm.get("air_date") or "")
    year_match = re.match(r"^(19\d{2}|20\d{2})", date_value)
    year = int(year_match.group(1)) if year_match else int(bgm.get("year") or 2000)
    platform = int(subject.get("platform") or bgm.get("category") or 0)
    return {
        "status": "bangumi_archive_catalog",
        "year": year,
        "period": f"{year // 10 * 10}年代" if year < 2000 else f"{year}年",
        "match_basis": "番组计划日本动画目录",
        "wikipedia_title_zh": "",
        "wikipedia_title_ja": "",
        "wikipedia_release_date": "",
        "wikipedia_studio": "",
        "wikipedia_note": "",
        "wikipedia_url": "",
        "bangumi_id": subject_id,
        "bangumi_category": PLATFORM_LABELS.get(platform, str(platform)),
        "category_agreement": "movie" if platform == 3 else "ova" if platform == 2 else "needs_review",
        "bangumi_title_cn": subject.get("name_cn") or bgm.get("title_cn") or "",
        "bangumi_title": subject.get("name") or bgm.get("title") or "",
        "bangumi_air_date": date_value,
        "bangumi_poster": bgm.get("poster") or "",
        "bangumi_score": subject.get("score") or bgm.get("score") or 0,
        "bangumi_rank": subject.get("rank") or bgm.get("rank") or 0,
        "bangumi_url": f"https://bgm.tv/subject/{subject_id}",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="审查电影、OVA、剧场版并缩减人工译名核对清单")
    parser.add_argument("--movies", type=Path, required=True)
    parser.add_argument("--manual-review", type=Path, required=True)
    parser.add_argument("--bangumi-movies", type=Path, required=True)
    parser.add_argument("--archive", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()

    confirmed = [row for row in read_json(args.movies) if isinstance(row, dict)]
    manual_rows = read_csv(args.manual_review)
    bangumi_rows = [row for row in read_json(args.bangumi_movies) if isinstance(row, dict)]
    bangumi_by_id = {int(row.get("subject_id") or 0): row for row in bangumi_rows}

    wanted_ids = {int(row.get("bangumi_id") or 0) for row in confirmed}
    wanted_ids.update(int(row.get("subject_id") or 0) for row in bangumi_rows)
    for row in manual_rows:
        for index in (1, 2, 3):
            candidate_id = int(row.get(f"candidate_{index}_id") or 0)
            if candidate_id:
                wanted_ids.add(candidate_id)
    wanted_ids.discard(0)

    print(f"Scanning Bangumi Archive for {len(wanted_ids)} relevant subjects...", flush=True)
    subjects = scan_archive(args.archive, wanted_ids)
    print(f"Archive subjects found: {len(subjects)}", flush=True)

    resolved, unresolved = resolve_manual_rows(manual_rows, subjects, bangumi_by_id)

    japanese_catalog: list[dict[str, Any]] = []
    country_review: list[dict[str, Any]] = []
    excluded_other_country = 0
    inferred_japanese_by_kana = 0
    for bgm in bangumi_rows:
        subject_id = int(bgm.get("subject_id") or 0)
        subject = subjects.get(subject_id)
        if not subject:
            country_review.append(
                {
                    "year": bgm.get("year"),
                    "bangumi_id": subject_id,
                    "title_cn": bgm.get("title_cn") or "",
                    "title": bgm.get("title") or "",
                    "platform": bgm.get("category_label") or "",
                    "reason": "archive_subject_missing",
                    "bangumi_url": bgm.get("source_url") or f"https://bgm.tv/subject/{subject_id}",
                }
            )
            continue
        meta_tags = {str(tag) for tag in subject.get("meta_tags") or []}
        if "日本" not in meta_tags:
            if meta_tags.intersection(COUNTRY_TAGS):
                excluded_other_country += 1
            elif KANA_RE.search(str(subject.get("name") or "")):
                inferred_japanese_by_kana += 1
                japanese_catalog.append(bangumi_catalog_row(bgm, subject))
            else:
                country_review.append(
                    {
                        "year": bgm.get("year"),
                        "bangumi_id": subject_id,
                        "title_cn": subject.get("name_cn") or bgm.get("title_cn") or "",
                        "title": subject.get("name") or bgm.get("title") or "",
                        "platform": PLATFORM_LABELS.get(int(subject.get("platform") or 0), "未知"),
                        "reason": "country_unknown",
                        "bangumi_url": f"https://bgm.tv/subject/{subject_id}",
                    }
                )
            continue
        japanese_catalog.append(bangumi_catalog_row(bgm, subject))

    combined = merge_same_subject(confirmed + resolved + japanese_catalog)
    audited = [audit_record(row, subjects.get(int(row.get("bangumi_id") or 0))) for row in combined]
    audited.sort(key=lambda row: (int(row.get("year") or 0), str(row.get("bangumi_air_date") or ""), str(row.get("bangumi_title_cn") or "")))

    output_dir: Path = args.output_dir
    write_json(output_dir / "audited-movies.json", audited)
    write_json(output_dir / "auto-confirmed-japanese-matches.json", resolved)
    write_csv(output_dir / "manual-title-review.csv", unresolved)
    write_csv(output_dir / "manual-country-review.csv", country_review)

    audit_rows = [
        {
            "year": row.get("year"),
            "bangumi_id": row.get("bangumi_id"),
            "title": row.get("bangumi_title_cn") or row.get("wikipedia_title_zh"),
            "type": row.get("type"),
            "bangumi_platform": row.get("bangumiPlatformLabel"),
            "theatrical_status": row.get("theatricalStatus"),
            "theatrical_release_dates": "；".join(row.get("theatricalReleaseDates") or []),
            "other_country_release_dates": "；".join(row.get("otherTheatricalReleaseDates") or []),
            "home_video_release_dates": "；".join(row.get("homeVideoReleaseDates") or []),
            "runtime": row.get("runtimeText"),
            "runtime_minutes": row.get("runtimeMinutes"),
            "classification_reason": row.get("classificationReason"),
            "metadata_needs_review": "yes" if row.get("metadataNeedsReview") else "no",
        }
        for row in audited
    ]
    write_csv(output_dir / "movie-format-audit.csv", audit_rows)
    write_csv(
        output_dir / "manual-format-review.csv",
        [row for row in audit_rows if row["bangumi_platform"] == "未知"],
        audit_rows[0].keys() if audit_rows else None,
    )

    type_counts = Counter(str(row.get("type")) for row in audited)
    theatrical_counts = Counter(str(row.get("theatricalStatus")) for row in audited)
    summary = {
        "input_confirmed_rows": len(confirmed),
        "input_confirmed_unique_subjects": len({int(row.get("bangumi_id") or 0) for row in confirmed}),
        "input_manual_title_review": len(manual_rows),
        "auto_confirmed_by_japanese_title": len(resolved),
        "remaining_manual_title_review": len(unresolved),
        "japanese_bangumi_catalog": len(japanese_catalog),
        "japanese_inferred_by_kana_title": inferred_japanese_by_kana,
        "excluded_known_non_japanese": excluded_other_country,
        "remaining_manual_country_review": len(country_review),
        "audited_unique_subjects": len(audited),
        "type_counts": dict(sorted(type_counts.items())),
        "theatrical_status_counts": dict(sorted(theatrical_counts.items())),
        "runtime_present": sum(bool(row.get("runtimeText")) for row in audited),
        "runtime_missing": sum(not row.get("runtimeText") for row in audited),
        "other_country_or_region_release_record": sum(bool(row.get("hasInternationalRelease")) for row in audited),
        "ova_with_theatrical_record": sum(
            row.get("type") == "ova" and row.get("theatricalStatus") == "confirmed" for row in audited
        ),
        "ova_release_only_and_up_to_60_minutes": sum(
            row.get("type") == "ova"
            and row.get("theatricalStatus") == "not_listed"
            and bool(row.get("homeVideoReleaseDates"))
            and row.get("runtimeMinutes") is not None
            and row.get("runtimeMinutes") <= 60
            for row in audited
        ),
        "manual_format_review": sum(row.get("classificationNeedsReview") for row in audited),
        "policy": {
            "ova": "Bangumi platform OVA; <=60 minutes + release date + no theatrical date is strong supporting evidence.",
            "theatrical_evidence": "上映年度 or 其他上映年度 in Bangumi infobox.",
            "japanese_title_auto_match": "Conservative title similarity plus uniqueness/release-date checks.",
        },
    }
    write_json(output_dir / "summary.json", summary)
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
