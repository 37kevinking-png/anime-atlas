#!/usr/bin/env python3
"""Add episode-count and available runtime metadata to the TV catalog."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any

from audit_movie_formats import (
    first_positive_int,
    infobox_values,
    parse_infobox,
    runtime_minutes,
    scan_archive,
)


def main() -> int:
    parser = argparse.ArgumentParser(description="用番组计划归档补充 TV 动画话数与单话时长")
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--archive", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--summary", type=Path, required=True)
    args = parser.parse_args()

    records = json.loads(args.input.read_text(encoding="utf-8-sig"))
    ids: set[int] = set()
    for row in records:
        match = re.search(r"(\d+)$", str(row.get("id") or ""))
        if match:
            ids.add(int(match.group(1)))

    subjects = scan_archive(args.archive, ids)
    episode_count_present = 0
    runtime_present = 0
    for row in records:
        match = re.search(r"(\d+)$", str(row.get("id") or ""))
        subject = subjects.get(int(match.group(1))) if match else None
        if not subject:
            continue
        fields = parse_infobox(subject.get("infobox"))
        episode_count = first_positive_int("；".join(infobox_values(fields, "话数", "話数")))
        runtime_values = infobox_values(
            fields,
            "每话时长",
            "每話時長",
            "每集时长",
            "每集時長",
            "播放时长",
            "播放時長",
            "时长",
            "時長",
        )
        runtime_text = "；".join(runtime_values)
        minutes = runtime_minutes(runtime_text)
        row["episodeCount"] = episode_count
        row["runtimeText"] = runtime_text
        row["runtimeMinutes"] = minutes
        if episode_count:
            episode_count_present += 1
        if minutes:
            runtime_present += 1

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")
    summary: dict[str, Any] = {
        "records": len(records),
        "archive_subjects_found": len(subjects),
        "episode_count_present": episode_count_present,
        "episode_count_missing": len(records) - episode_count_present,
        "per_episode_runtime_present": runtime_present,
        "estimation_policy": "When runtime is absent, the website estimates TV viewing time at 24 minutes per episode and labels it as an estimate.",
    }
    args.summary.parent.mkdir(parents=True, exist_ok=True)
    args.summary.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
