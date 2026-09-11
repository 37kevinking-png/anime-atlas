#!/usr/bin/env python3
"""Build a readable Markdown report from the movie pipeline review CSV."""

from __future__ import annotations

import argparse
import csv
import json
from collections import Counter
from pathlib import Path


def clean(value: str) -> str:
    return (value or "").replace("|", "\\|").replace("\n", " ").strip()


def main() -> int:
    parser = argparse.ArgumentParser(description="生成人工确认电影清单")
    parser.add_argument("input", type=Path)
    parser.add_argument("--output", type=Path, default=Path("MOVIE_MANUAL_REVIEW.md"))
    parser.add_argument("--enriched", type=Path, help="确定匹配JSON，用于列出Movie/OVA分类冲突")
    args = parser.parse_args()

    with args.input.open("r", encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))

    status_counts = Counter(row["review_status"] for row in rows)
    likely = [row for row in rows if row["review_status"] == "likely_translation"]
    wikipedia_only = [row for row in rows if row["review_status"] == "wikipedia_only"]
    category_conflicts: list[dict[str, object]] = []
    if args.enriched:
        payload = json.loads(args.enriched.read_text(encoding="utf-8-sig"))
        category_conflicts = [
            row for row in payload
            if isinstance(row, dict) and row.get("category_agreement") == "needs_review"
        ]
        category_conflicts.sort(key=lambda row: (int(row["year"]), str(row["wikipedia_title_zh"])))
    likely.sort(key=lambda row: (int(row["year"]), -float(row["candidate_1_score"] or 0)))
    wikipedia_only.sort(key=lambda row: (int(row["year"]), row["wikipedia_title_zh"]))

    lines = [
        "# 动画电影人工确认清单",
        "",
        f"标题匹配阶段共有 **{len(rows)}** 条需要人工处理：疑似译名 **{status_counts['likely_translation']}** 条，维基独有 **{status_counts['wikipedia_only']}** 条。",
        f"另外，确定匹配中有 **{len(category_conflicts)}** 行存在“维基动画电影 / 番组计划OVA”分类冲突，对应 **{len({row.get('bangumi_id') for row in category_conflicts})}** 个唯一番组计划条目。",
        "",
        "`疑似译名`需要判断候选1是否就是同一作品；`维基独有`需要在番组计划中人工搜索，或确认该站确实没有条目。",
        "",
        "## 一、疑似译名或标题写法差异",
        "",
        "| 年份 | 维基名称 | 番组计划候选1 | 相似度 | 候选链接 |",
        "|---:|---|---|---:|---|",
    ]
    for row in likely:
        candidate_title = row["candidate_1_title_cn"] or row["candidate_1_title"]
        candidate_url = f"https://bgm.tv/subject/{row['candidate_1_id']}" if row["candidate_1_id"] else ""
        score = f"{float(row['candidate_1_score'] or 0):.4f}"
        lines.append(
            f"| {row['year']} | [{clean(row['wikipedia_title_zh'])}]({row['wikipedia_url']}) "
            f"<br><small>{clean(row['wikipedia_title_ja'])}</small> | {clean(candidate_title)} | {score} | "
            f"[打开番组计划]({candidate_url}) |"
        )

    lines.extend([
        "",
        "## 二、维基有记录但没有可靠番组计划候选",
        "",
        "| 年份 | 维基名称 | 原名 | 维基链接 |",
        "|---:|---|---|---|",
    ])
    for row in wikipedia_only:
        lines.append(
            f"| {row['year']} | {clean(row['wikipedia_title_zh'])} | {clean(row['wikipedia_title_ja'])} | "
            f"[打开维基]({row['wikipedia_url']}) |"
        )

    lines.extend([
        "",
        "## 三、名称已匹配但类型存在冲突",
        "",
        "这些条目在维基动画电影表中出现，但番组计划分类为OVA。需要决定网页最终放进“动画电影”“OVA”还是“剧场版”。",
        "",
        "| 年份 | 维基名称 | 番组计划名称 | 番组计划分类 | 条目链接 |",
        "|---:|---|---|---|---|",
    ])
    for row in category_conflicts:
        candidate_title = row.get("bangumi_title_cn") or row.get("bangumi_title") or ""
        bangumi_id = row.get("bangumi_id")
        lines.append(
            f"| {row.get('year')} | {clean(str(row.get('wikipedia_title_zh') or ''))} | "
            f"{clean(str(candidate_title))} | {clean(str(row.get('bangumi_category') or ''))} | "
            f"[打开番组计划](https://bgm.tv/subject/{bangumi_id}) |"
        )

    lines.extend([
        "",
        "## 填写方法",
        "",
        "最终决定仍应填写回原始 `manual_review.csv` 的三列：",
        "",
        "- `manual_decision`：建议使用 `confirmed`、`not_same`、`not_found` 或 `skip`。",
        "- `manual_bangumi_id`：确认相同作品时填写番组计划ID。",
        "- `manual_note`：记录判断理由或特殊分类。",
        "",
    ])
    args.output.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {len(rows)} review rows -> {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
