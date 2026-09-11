#!/usr/bin/env python3
"""Rebuild the public static catalog from the latest downloaded Bangumi archive."""

from __future__ import annotations

import argparse
from datetime import datetime
import json
from pathlib import Path
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[1]


def run(*arguments: str) -> None:
    subprocess.run([sys.executable, *arguments], cwd=ROOT, check=True)


def main() -> int:
    parser = argparse.ArgumentParser(description="刷新番迹的日番与国产静态资料包")
    parser.add_argument("--max-year", type=int, default=datetime.now().year)
    args = parser.parse_args()

    summary_path = ROOT / "data" / "bangumi-tv" / "summary.json"
    if not summary_path.exists():
        raise FileNotFoundError("请先运行 fetch_bangumi_archive_tv.py --extract-relations")
    archive = json.loads(summary_path.read_text(encoding="utf-8"))["archive"]
    subject_file = Path(archive["subject_file"])
    relations_file = Path(archive["relations_file"])
    if not subject_file.is_absolute():
        subject_file = ROOT / subject_file
    if not relations_file.is_absolute():
        relations_file = ROOT / relations_file
    if not subject_file.exists() or not relations_file.exists():
        raise FileNotFoundError("番组计划条目或关系归档不存在，请重新下载")

    run(
        "tools/extract_bangumi_chinese_anime.py",
        "--subjects", str(subject_file),
        "--max-year", str(args.max_year),
    )

    classification_dir = ROOT / "data" / "classification"
    command = [
        "tools/reclassify_catalog.py",
        "--movies", str(classification_dir / "classified-movies.json"),
        "--tv", str(ROOT / "data" / "bangumi-tv" / "bangumi-tv.json"),
        "--subjects", str(subject_file),
        "--relations", str(relations_file),
        "--output-dir", str(classification_dir),
    ]
    decisions = classification_dir / "manual-classification-decisions.csv"
    if decisions.exists():
        command.extend(("--decisions", str(decisions)))
    run(*command)

    run(
        "tools/import_pipeline_data.py",
        str(classification_dir / "classified-movies.json"),
        str(classification_dir / "classified-tv.json"),
        "--max-year", str(args.max_year),
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
