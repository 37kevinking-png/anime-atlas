#!/usr/bin/env python3
"""Reclassify the catalog using Bangumi subject relations and score vote counts.

The public-facing taxonomy is intentionally small:
TV / WEB / animation movie / theatrical franchise film / other.
OVA, compilation works, disc bonuses, and venue-exclusive shorts are all
collapsed into ``other`` without exposing further subcategories in the UI.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any


STRONG_ANIME_RELATIONS = {1, 2, 3, 6, 8, 9, 10, 11, 12}
FULL_OR_SUMMARY_RELATIONS = {4, 5}
SUMMARY_PATTERN = re.compile(
    r"总集|總集|総集|合集|ダイジェスト|再編集|再構成|編集版|\brecap\b",
    re.I,
)
VENUE_PATTERN = re.compile(
    r"プラネタリウム|planetarium|天文馆|天文館|全天周|ドームシアター|"
    r"科学館|科学馆|施設限定|アトラクション|テーマパーク|"
    r"ユニバーサル[・\s]?スタジオ|\bUSJ\b",
    re.I,
)
DISC_BONUS_PATTERN = re.compile(
    r"BD特典|Blu[- ]?ray特典|DVD特典|映像特典|光[碟盤]特典|"
    r"同梱(?:版|特典)|コミックス.*同梱|\bbonus\b",
    re.I,
)
FRANCHISE_MARKER_PATTERN = re.compile(r"剧场版|劇場版|映画|THE MOVIE", re.I)
DISPLAY_TAG_EXCLUSIONS = {"日本", "web"}
FOREIGN_PRODUCTION_TAGS = {
    "中国", "中國", "中国动画", "中國動畫", "国产", "國產", "国产动画", "國產動畫",
    "国漫", "大陆", "大陸", "中国大陆", "中國大陸", "香港", "台湾", "台灣", "中日合作",
    "美国", "美國", "美国动画", "美國動畫", "英国", "英國", "法国", "法國", "韩国", "韓國",
    "苏联", "蘇聯", "俄罗斯", "俄羅斯", "加拿大",
    "德国", "德國", "意大利", "西班牙", "澳大利亚", "澳大利亞", "朝鲜", "朝鮮", "印度",
    "泰国", "泰國", "越南", "新加坡", "马来西亚", "馬來西亞", "印度尼西亚", "印度尼西亞",
    "菲律宾", "菲律賓", "巴西", "阿根廷", "墨西哥", "捷克", "波兰", "波蘭", "匈牙利",
    "南斯拉夫",
}
STRONG_FOREIGN_PRODUCTION_TAGS = {
    "中国动画", "中國動畫", "国产动画", "國產動畫", "国漫", "中日合作", "日中合作",
    "中日合拍", "中日合拍动画", "中日合拍動畫", "美国动画", "美國動畫", "韩国动画", "韓國動畫",
}
WEAK_DOMESTIC_TAGS = {"国产", "國產"}
JAPAN_META_TAGS = {"日本", "日本动画", "日本動畫", "日本アニメ"}
CO_PRODUCTION_PATTERN = re.compile(
    r"(?:中日|日中|美日|日美|韩日|韓日|日韩|日韓|日法|法日|加日|日加).*(?:合作|合拍)",
    re.I,
)
TV_TAGS = {"tv", "tv动画", "テレビアニメ"}
WEB_TAGS = {"web", "web动画", "网络动画", "網絡動畫"}
OVA_TAGS = {"ova", "oad"}
MOVIE_TAGS = {"动画电影", "動畫電影", "アニメ映画"}
GENERIC_FILM_TAGS = {"电影", "電影", "映画"}
THEATRICAL_TAGS = {"剧场版", "劇場版"}
ORIGINAL_TAGS = {"原创", "原創", "オリジナル"}
# These locked Bangumi subjects are absent from the downloadable Archive, but
# their current public pages still expose the ordinary ``总集篇`` user tag.
# Keeping the IDs here prevents the missing archive row from silently falling
# through to a theatrical-franchise classification.
KNOWN_COMPILATION_SUBJECT_IDS = {410499, 469668}
STAGED_SCREENING_SUFFIX = re.compile(
    r"(?:第\s*[一二三四五六七八九十百\d]+\s*(?:幕|章))\s*$",
    re.I,
)


class DisjointSet:
    def __init__(self) -> None:
        self.parent: dict[int, int] = {}
        self.rank: dict[int, int] = {}

    def find(self, value: int) -> int:
        self.parent.setdefault(value, value)
        if self.parent[value] != value:
            self.parent[value] = self.find(self.parent[value])
        return self.parent[value]

    def union(self, left: int, right: int) -> None:
        root_left = self.find(left)
        root_right = self.find(right)
        if root_left == root_right:
            return
        rank_left = self.rank.get(root_left, 0)
        rank_right = self.rank.get(root_right, 0)
        if rank_left < rank_right:
            root_left, root_right = root_right, root_left
        self.parent[root_right] = root_left
        if rank_left == rank_right:
            self.rank[root_left] = rank_left + 1


def read_records(path: Path) -> list[dict[str, Any]]:
    payload = json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(payload, list):
        raise ValueError(f"{path} does not contain an array")
    return [row for row in payload if isinstance(row, dict)]


def record_subject_id(row: dict[str, Any]) -> int:
    if row.get("bangumi_id"):
        return int(row["bangumi_id"])
    match = re.search(r"(\d+)$", str(row.get("id") or ""))
    return int(match.group(1)) if match else 0


def score_vote_count(subject: dict[str, Any] | None) -> int:
    if not subject:
        return 0
    return sum(int(value or 0) for value in (subject.get("score_details") or {}).values())


def normalize_tag(value: Any) -> str:
    return unicodedata.normalize("NFKC", str(value or "")).strip().lower()


def normalize_title(value: Any) -> str:
    return re.sub(r"[\s\W_]+", "", normalize_tag(value), flags=re.UNICODE)


def staged_screening_root(value: Any) -> str:
    title = unicodedata.normalize("NFKC", str(value or "")).strip()
    stripped = STAGED_SCREENING_SUFFIX.sub("", title).strip()
    return normalize_title(stripped) if stripped != title else ""


def display_tags(subject: dict[str, Any] | None) -> list[dict[str, Any]]:
    if not subject:
        return []
    tag_counts = {
        normalize_tag(tag.get("name")): int(tag.get("count") or 0)
        for tag in subject.get("tags") or []
        if tag.get("name")
    }
    result: list[dict[str, Any]] = []
    seen: set[str] = set()
    # ``meta_tags`` is the archive equivalent of the blue-outlined public
    # tags shown on a Bangumi subject page. Ordinary ``tags`` also contains
    # staff names, years and personal labels and must not be exposed as if
    # they were public classification tags.
    for raw_name in subject.get("meta_tags") or []:
        name = str(raw_name or "").strip()
        key = normalize_tag(name)
        if not name or key in DISPLAY_TAG_EXCLUSIONS or key in seen:
            continue
        result.append({"name": name, "count": tag_counts.get(key)})
        seen.add(key)
    return result


def first_ordinary_tag(subject: dict[str, Any] | None) -> dict[str, Any] | None:
    """Return the first useful non-public tag without inflating the static bundle."""
    if not subject:
        return None
    public_names = {normalize_tag(name) for name in subject.get("meta_tags") or [] if name}
    format_names = {
        *TV_TAGS, *OVA_TAGS, *MOVIE_TAGS, *GENERIC_FILM_TAGS, *THEATRICAL_TAGS,
        "web", "其他", "日本", "日本动画", "日本動畫", "中国", "中國", "国产", "國產",
    }
    excluded = {normalize_tag(name) for name in format_names}
    for tag in subject.get("tags") or []:
        name = str(tag.get("name") or "").strip()
        key = normalize_tag(name)
        if not name or key in public_names or key in excluded:
            continue
        return {"name": name, "count": max(0, int(tag.get("count") or 0))}
    return None


def classification_tag_names(subject: dict[str, Any] | None) -> set[str]:
    """Return every user tag used for format classification.

    Bangumi's unhighlighted tags still contain useful format evidence such as
    ``总集篇`` and ``动画电影``. They participate in classification even though
    only ``meta_tags`` is displayed on the website.
    """
    if not subject:
        return set()
    return {
        normalize_tag(tag.get("name"))
        for tag in subject.get("tags") or []
        if tag.get("name")
    }


def all_tag_count_total(subject: dict[str, Any] | None) -> int:
    if not subject:
        return 0
    return sum(max(0, int(tag.get("count") or 0)) for tag in subject.get("tags") or [])


def foreign_production_tags(subject: dict[str, Any] | None) -> list[str]:
    """Return explicit non-Japanese country/region production tags."""
    if not subject:
        return []
    ordinary = [str(tag.get("name") or "").strip() for tag in subject.get("tags") or [] if tag.get("name")]
    meta = [str(tag or "").strip() for tag in subject.get("meta_tags") or [] if tag]
    country_meta = {normalize_tag(name) for name in FOREIGN_PRODUCTION_TAGS}
    strong = {normalize_tag(name) for name in STRONG_FOREIGN_PRODUCTION_TAGS}
    japan_meta = {normalize_tag(name) for name in JAPAN_META_TAGS}
    hits = {name for name in meta if normalize_tag(name) in country_meta}
    hits.update(
        name for name in ordinary
        if normalize_tag(name) in strong or CO_PRODUCTION_PATTERN.search(normalize_tag(name))
    )
    if not {normalize_tag(name) for name in meta}.intersection(japan_meta):
        weak = {normalize_tag(name) for name in WEAK_DOMESTIC_TAGS}
        hits.update(name for name in ordinary if normalize_tag(name) in weak)
    return sorted(hits)


def scan_subjects(
    path: Path,
    current_ids: set[int],
) -> tuple[dict[int, int], dict[int, dict[str, Any]]]:
    anime_platform: dict[int, int] = {}
    current_subjects: dict[int, dict[str, Any]] = {}
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            subject = json.loads(line)
            if int(subject.get("type") or 0) != 2:
                continue
            subject_id = int(subject.get("id") or 0)
            anime_platform[subject_id] = int(subject.get("platform") or 0)
            if subject_id in current_ids:
                current_subjects[subject_id] = subject
    return anime_platform, current_subjects


def build_relation_graph(
    path: Path,
    anime_platform: dict[int, int],
    current_ids: set[int],
) -> tuple[DisjointSet, dict[int, set[int]]]:
    graph = DisjointSet()
    current_relation_types: dict[int, set[int]] = defaultdict(set)
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            relation = json.loads(line)
            subject_id = int(relation.get("subject_id") or 0)
            related_id = int(relation.get("related_subject_id") or 0)
            relation_type = int(relation.get("relation_type") or 0)
            if subject_id in current_ids:
                current_relation_types[subject_id].add(relation_type)
            if (
                relation_type in STRONG_ANIME_RELATIONS
                and subject_id in anime_platform
                and related_id in anime_platform
            ):
                graph.union(subject_id, related_id)
    return graph, current_relation_types


def subject_text(subject: dict[str, Any] | None, row: dict[str, Any]) -> tuple[str, str]:
    title_text = " ".join(
        str(value or "")
        for value in (
            row.get("title"),
            row.get("originalTitle"),
            row.get("bangumi_title_cn"),
            row.get("bangumi_title"),
            subject.get("name_cn") if subject else "",
            subject.get("name") if subject else "",
        )
    )
    detail_text = " ".join(
        str(value or "")
        for value in (
            title_text,
            subject.get("summary") if subject else "",
            subject.get("infobox") if subject else "",
            " ".join(str(tag.get("name") or "") for tag in (subject.get("tags") or [])) if subject else "",
        )
    )
    return title_text, detail_text


def classify_record(
    row: dict[str, Any],
    subject: dict[str, Any] | None,
    platform: int,
    relation_types: set[int],
    tv_roots: set[int],
    graph: DisjointSet,
    has_title_tv_basis: bool = False,
) -> tuple[str, str, str, bool]:
    title_text, _ = subject_text(subject, row)
    tag_names = classification_tag_names(subject)
    venue_text = " ".join(
        str(value or "")
        for value in (
            title_text,
            subject.get("infobox") if subject else "",
            " ".join(str(tag.get("name") or "") for tag in (subject.get("tags") or [])) if subject else "",
        )
    )
    is_summary = (
        record_subject_id(row) in KNOWN_COMPILATION_SUBJECT_IDS
        or
        bool(SUMMARY_PATTERN.search(title_text))
        or any(SUMMARY_PATTERN.search(tag_name) for tag_name in tag_names)
    )
    # Do not inspect plot summaries here: ordinary theatrical films often happen
    # inside theme parks or science museums. Venue markers must be metadata.
    is_venue_special = bool(VENUE_PATTERN.search(venue_text))
    is_disc_bonus = bool(DISC_BONUS_PATTERN.search(title_text))
    has_tv_relation = bool(record_subject_id(row)) and graph.find(record_subject_id(row)) in tv_roots
    has_direct_tv_story_relation = bool(relation_types.intersection(FULL_OR_SUMMARY_RELATIONS))
    has_franchise_basis = has_tv_relation or has_direct_tv_story_relation or has_title_tv_basis

    if is_summary:
        reason = (
            "番组计划当前普通标签含总集篇（归档缺失条目的已确认回退），按统一规则归入其他"
            if record_subject_id(row) in KNOWN_COMPILATION_SUBJECT_IDS and not subject
            else "标题或番组计划普通标签标记为总集篇，按统一规则归入其他"
        )
        return "other", reason, "summary", has_tv_relation
    if is_disc_bonus:
        return "other", "光碟或影像特典，按统一规则归入其他", "disc_bonus", has_tv_relation
    if is_venue_special:
        return "other", "天文馆、科学馆或主题设施专属作品，按统一规则归入其他", "venue_special", has_tv_relation
    # The archive platform is stronger evidence than conflicting community tags.
    if platform == 5 or str(row.get("type") or "").lower() == "web":
        return "web", "番组计划平台标注为 WEB", "web", has_tv_relation
    # TV wins conflicting community tags such as “TV + OVA” on old TV specials.
    if platform == 1 or str(row.get("type") or "").lower() == "tv" or tag_names.intersection(TV_TAGS):
        if tag_names.intersection(TV_TAGS):
            return "tv", "番组计划用户标签标注为 TV", "tag_tv", has_tv_relation
        return "tv", "番组计划平台为 TV", "tv", has_tv_relation
    if platform == 2 or str(row.get("type") or "").lower() == "ova" or tag_names.intersection(OVA_TAGS):
        return "other", "番组计划平台或用户标签标注为 OVA，按统一规则归入其他", "ova", has_tv_relation
    if tag_names.intersection(WEB_TAGS):
        return "web", "番组计划用户标签标注为 WEB", "web", has_tv_relation
    has_movie_tag = bool(tag_names.intersection(MOVIE_TAGS | GENERIC_FILM_TAGS))
    has_theatrical_tag = bool(tag_names.intersection(THEATRICAL_TAGS))
    has_original_tag = bool(tag_names.intersection(ORIGINAL_TAGS))
    if has_theatrical_tag:
        if has_original_tag and (has_movie_tag or not has_franchise_basis):
            return "movie", "同时含剧场版与原创标签，并有电影证据或无 TV 系列关系，归入动画电影", "tag_original_movie", has_tv_relation
        if has_movie_tag and has_franchise_basis:
            return "theatrical", "同时含剧场版与电影标签，且与 TV 系列存在关联，归入剧场版", "tag_franchise_theatrical", True
        if has_movie_tag:
            return "movie", "同时含剧场版与电影标签但无 TV 系列关系，归入动画电影", "tag_movie", has_tv_relation
        return "theatrical", "番组计划用户标签标注为剧场版，且无总集篇标签", "tag_theatrical", has_franchise_basis
    if has_movie_tag:
        return "movie", "番组计划用户标签标注为电影或动画电影", "tag_movie", has_tv_relation
    if has_title_tv_basis:
        return "theatrical", "分幕/分章先行上映作品与同名 TV 动画匹配，归入剧场版", "tv_title_basis", True
    if has_franchise_basis:
        return "theatrical", "与既有 TV 动画处于同一强关联作品链，归入剧场版", "tv_franchise", True
    return "movie", "未发现与 TV 动画的强关联，归入动画电影", "standalone_movie", False


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fields = list(dict.fromkeys(key for row in rows for key in row)) or ["bangumi_id"]
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def read_manual_decisions(path: Path | None) -> dict[int, dict[str, str]]:
    if not path or not path.exists():
        return {}
    decisions: dict[int, dict[str, str]] = {}
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            try:
                subject_id = int(row.get("bangumi_id") or 0)
            except ValueError:
                continue
            final_type = str(row.get("final_type") or "").strip().lower()
            status = str(row.get("review_status") or "").strip().lower()
            if subject_id and final_type in {"tv", "web", "movie", "theatrical", "other"} and status == "confirmed":
                decisions[subject_id] = {
                    "final_type": final_type,
                    "note": str(row.get("review_note") or "").strip(),
                }
    return decisions


def main() -> int:
    parser = argparse.ArgumentParser(description="按 TV / WEB / 动画电影 / 剧场版 / 其他重新分类")
    parser.add_argument("--movies", type=Path, required=True)
    parser.add_argument("--tv", type=Path, required=True)
    parser.add_argument("--early", type=Path, help="可选的1917—1959年日本动画资料")
    parser.add_argument("--subjects", type=Path, required=True)
    parser.add_argument("--relations", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--score-votes", type=int, default=30)
    parser.add_argument("--ranking-votes", type=int, default=100)
    parser.add_argument(
        "--manual-review-name",
        default="manual-classification-review.csv",
        help="人工复核候选文件名；可在重跑时改名以免覆盖正在填写的旧清单",
    )
    parser.add_argument("--decisions", type=Path, help="已确认的人工分类覆盖 CSV")
    args = parser.parse_args()

    movie_rows = read_records(args.movies)
    tv_rows = read_records(args.tv)
    early_rows = read_records(args.early) if args.early else []
    manual_decisions = read_manual_decisions(args.decisions)
    input_record_count = len(movie_rows) + len(tv_rows) + len(early_rows)
    movie_subject_ids = {record_subject_id(row) for row in movie_rows}
    early_subject_ids = {record_subject_id(row) for row in early_rows}
    all_rows = movie_rows + tv_rows + early_rows
    tv_title_roots = {
        normalize_title(value)
        for row in tv_rows
        for value in (
            row.get("title"), row.get("originalTitle"), row.get("bangumi_title_cn"), row.get("bangumi_title")
        )
        if value
    }
    current_ids = {record_subject_id(row) for row in all_rows}
    current_ids.discard(0)

    print(f"Scanning subjects for {len(current_ids)} catalog entries...", flush=True)
    anime_platform, current_subjects = scan_subjects(args.subjects, current_ids)
    print(f"Anime subjects: {len(anime_platform)}; catalog subjects found: {len(current_subjects)}", flush=True)
    explicit_foreign_rows: list[dict[str, Any]] = []
    admitted_rows: list[dict[str, Any]] = []
    for row in all_rows:
        subject_id = record_subject_id(row)
        matched_tags = foreign_production_tags(current_subjects.get(subject_id))
        if matched_tags:
            explicit_foreign_rows.append({
                "bangumi_id": subject_id,
                "year": row.get("year"),
                "title": row.get("title") or row.get("bangumi_title_cn"),
                "original_title": row.get("originalTitle") or row.get("bangumi_title"),
                "matched_tags": " / ".join(matched_tags),
                "reason": "番组计划标签明确标注为其他国家或地区产出",
                "bangumi_url": f"https://bgm.tv/subject/{subject_id}" if subject_id else "",
            })
        else:
            admitted_rows.append(row)
    all_rows = admitted_rows
    print(f"Excluded by explicit foreign production tags: {len(explicit_foreign_rows)}", flush=True)
    graph, relation_types = build_relation_graph(args.relations, anime_platform, current_ids)
    tv_roots = {
        graph.find(subject_id)
        for subject_id, platform in anime_platform.items()
        if platform == 1
    }

    classified_movies: list[dict[str, Any]] = []
    classified_tv: list[dict[str, Any]] = []
    audit_rows: list[dict[str, Any]] = []
    manual_rows: list[dict[str, Any]] = []
    automatic_fallback_rows: list[dict[str, Any]] = []
    reason_counts: Counter[str] = Counter()
    type_counts: Counter[str] = Counter()

    for source_row in all_rows:
        row = dict(source_row)
        subject_id = record_subject_id(row)
        subject = current_subjects.get(subject_id)
        platform = int(subject.get("platform") or 0) if subject else int(row.get("bangumiPlatform") or 0)
        item_type, reason, internal_reason, has_tv_relation = classify_record(
            row,
            subject,
            platform,
            relation_types.get(subject_id, set()),
            tv_roots,
            graph,
            any(
                staged_screening_root(value) in tv_title_roots
                for value in (
                    row.get("title"), row.get("originalTitle"), row.get("bangumi_title_cn"), row.get("bangumi_title")
                )
                if staged_screening_root(value)
            ),
        )
        if subject_id in manual_decisions:
            decision = manual_decisions[subject_id]
            item_type = decision["final_type"]
            reason = "人工审核确认" + (f"：{decision['note']}" if decision["note"] else "")
            internal_reason = "manual_override"
        votes = score_vote_count(subject)
        raw_score = subject.get("score") if subject else row.get("score") or row.get("bangumi_score")
        raw_rank = subject.get("rank") if subject else row.get("rank") or row.get("bangumi_rank")
        row.update(
            {
                "type": item_type,
                "season": row.get("season") if item_type == "tv" else None,
                "bangumiPlatform": platform or None,
                "classificationReason": reason,
                "classificationKind": internal_reason,
                "isCompilation": internal_reason == "summary",
                "classificationNeedsReview": False,
                "voteCount": votes,
                "scoreRaw": raw_score,
                "score": float(raw_score) if raw_score and votes >= args.score_votes else None,
                "rank": int(raw_rank) if raw_rank and votes >= args.ranking_votes else None,
                "rankingEligible": votes >= args.ranking_votes,
                "bangumiTags": display_tags(subject),
                "bangumiOrdinaryTag": first_ordinary_tag(subject),
                "bangumiTagTotal": all_tag_count_total(subject),
            }
        )
        type_counts[item_type] += 1
        reason_counts[internal_reason] += 1

        title_text, _ = subject_text(subject, row)
        used_automatic_fallback = (
            subject_id not in manual_decisions
            and (
            not subject
            or (
                item_type == "movie"
                and bool(FRANCHISE_MARKER_PATTERN.search(title_text))
                and not has_tv_relation
            )
            )
        )
        if used_automatic_fallback:
            automatic_fallback_rows.append(
                {
                    "bangumi_id": subject_id,
                    "year": row.get("year"),
                    "title": row.get("title") or row.get("bangumi_title_cn"),
                    "original_title": row.get("originalTitle") or row.get("bangumi_title"),
                    "assigned_type": item_type,
                    "reason": "archive_subject_missing_used_platform_and_relations"
                    if not subject
                    else "format_tag_missing_used_platform_and_relations",
                    "classification_reason": reason,
                    "bangumi_url": f"https://bgm.tv/subject/{subject_id}" if subject_id else "",
                }
            )

        audit_rows.append(
            {
                "bangumi_id": subject_id,
                "year": row.get("year"),
                "title": row.get("title") or row.get("bangumi_title_cn"),
                "old_type": source_row.get("type") or source_row.get("bangumi_category"),
                "new_type": item_type,
                "bangumi_platform": platform,
                "has_tv_relation": "yes" if has_tv_relation else "no",
                "classification_reason": reason,
                "bangumi_tags": " / ".join(tag["name"] for tag in row.get("bangumiTags") or []),
                "vote_count": votes,
                "score_visible": "yes" if row.get("score") is not None else "no",
            }
        )
        if subject_id in movie_subject_ids or subject_id in early_subject_ids and item_type != "tv":
            classified_movies.append(row)
        else:
            classified_tv.append(row)

    output_dir: Path = args.output_dir
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "classified-movies.json").write_text(
        json.dumps(classified_movies, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (output_dir / "classified-tv.json").write_text(
        json.dumps(classified_tv, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    write_csv(output_dir / "classification-audit.csv", audit_rows)
    write_csv(output_dir / args.manual_review_name, manual_rows)
    write_csv(output_dir / "automatic-classification-fallbacks.csv", automatic_fallback_rows)
    write_csv(output_dir / "explicit-foreign-country-exclusions.csv", explicit_foreign_rows)
    summary = {
        "input_records": input_record_count,
        "records": len(all_rows),
        "type_counts": dict(sorted(type_counts.items())),
        "classification_reason_counts": dict(sorted(reason_counts.items())),
        "score_vote_threshold": args.score_votes,
        "ranking_vote_threshold": args.ranking_votes,
        "scores_visible": sum(row["score_visible"] == "yes" for row in audit_rows),
        "scores_hidden_for_small_sample": sum(row["score_visible"] == "no" for row in audit_rows),
        "manual_classification_review": len(manual_rows),
        "automatic_classification_fallbacks": len(automatic_fallback_rows),
        "explicit_foreign_country_exclusions": len(explicit_foreign_rows),
    }
    (output_dir / "summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
