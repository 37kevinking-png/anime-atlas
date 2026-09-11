#!/usr/bin/env python3
"""Fetch Bangumi TV anime by year and convert them to Anime Atlas records."""

from __future__ import annotations

import argparse
import hashlib
import json
import random
import sys
import time
from collections import Counter
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen


API_URL = "https://api.bgm.tv/v0/subjects"
DEFAULT_USER_AGENT = "AnimeAtlas/0.1 (personal anime archive; https://github.com/bangumi/api)"


def parse_years(value: str) -> list[int]:
    years: set[int] = set()
    for part in value.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            start_text, end_text = part.split("-", 1)
            start, end = int(start_text), int(end_text)
            if start > end:
                start, end = end, start
            years.update(range(start, end + 1))
        else:
            years.add(int(part))
    invalid = [year for year in years if year < 1960 or year > 2030]
    if invalid:
        raise argparse.ArgumentTypeError("年份必须位于1960—2030")
    return sorted(years)


def retry_after_seconds(error: HTTPError) -> float | None:
    value = error.headers.get("Retry-After") if error.headers else None
    if not value:
        return None
    try:
        return max(0.0, float(value))
    except ValueError:
        try:
            retry_at = parsedate_to_datetime(value)
            if retry_at.tzinfo is None:
                retry_at = retry_at.replace(tzinfo=timezone.utc)
            return max(0.0, (retry_at - datetime.now(timezone.utc)).total_seconds())
        except (TypeError, ValueError, OverflowError):
            return None


class CachedClient:
    def __init__(
        self,
        cache_dir: Path,
        delay: float,
        retries: int,
        max_backoff: float,
        refresh: bool,
        user_agent: str,
    ) -> None:
        self.cache_dir = cache_dir
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.delay = max(0.0, delay)
        self.retries = max(1, retries)
        self.max_backoff = max(1.0, max_backoff)
        self.refresh = refresh
        self.user_agent = user_agent
        self.last_request_at: dict[str, float] = {}

    def cache_path(self, key: str, url: str) -> Path:
        digest = hashlib.sha256(url.encode("utf-8")).hexdigest()[:16]
        return self.cache_dir / f"{key}_{digest}.json"

    def pace(self, host: str) -> None:
        elapsed = time.monotonic() - self.last_request_at.get(host, 0.0)
        if elapsed < self.delay:
            time.sleep(self.delay - elapsed)

    def get_json(self, params: dict[str, Any], key: str) -> dict[str, Any]:
        full_url = f"{API_URL}?{urlencode(params)}"
        cache_path = self.cache_path(key, full_url)
        if cache_path.exists() and not self.refresh:
            return json.loads(cache_path.read_text(encoding="utf-8"))

        host = urlsplit(full_url).netloc
        last_error: Exception | None = None
        for attempt in range(self.retries):
            self.pace(host)
            request = Request(
                full_url,
                headers={
                    "Accept": "application/json",
                    "User-Agent": self.user_agent,
                },
            )
            try:
                with urlopen(request, timeout=45) as response:
                    payload = json.loads(response.read().decode("utf-8"))
                self.last_request_at[host] = time.monotonic()
                cache_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
                return payload
            except HTTPError as error:
                self.last_request_at[host] = time.monotonic()
                last_error = error
                if error.code not in {429, 500, 502, 503, 504} or attempt + 1 >= self.retries:
                    break
                wait = retry_after_seconds(error)
                if wait is None:
                    wait = min(self.max_backoff, (2 ** attempt) * 3 + random.random() * 2)
            except (URLError, TimeoutError) as error:
                self.last_request_at[host] = time.monotonic()
                last_error = error
                if attempt + 1 >= self.retries:
                    break
                wait = min(self.max_backoff, (2 ** attempt) * 3 + random.random() * 2)
            print(
                f"  网络暂时不可用，{wait:.0f}秒后重试 {attempt + 2}/{self.retries}...",
                file=sys.stderr,
                flush=True,
            )
            time.sleep(wait)

        detail = f"HTTP {last_error.code}" if isinstance(last_error, HTTPError) else str(last_error)
        raise RuntimeError(
            f"请求失败：{detail}\n{full_url}\n"
            "缓存会保留。网络恢复后重复原命令即可续跑，请不要添加 --refresh。"
        ) from last_error


def season_for_date(date_value: str) -> str | None:
    try:
        month = int(date_value.split("-", 2)[1])
    except (IndexError, TypeError, ValueError):
        return None
    if month <= 3:
        return "1"
    if month <= 6:
        return "4"
    if month <= 9:
        return "7"
    if month <= 12:
        return "10"
    return None


def convert_item(item: dict[str, Any], query_year: int) -> dict[str, Any]:
    images = item.get("images") or {}
    rating = item.get("rating") or {}
    date_value = str(item.get("date") or "").strip()
    try:
        year = int(date_value[:4]) if len(date_value) >= 4 else query_year
    except ValueError:
        year = query_year
    subject_id = int(item["id"])
    return {
        "id": f"bgm-{subject_id}",
        "title": str(item.get("name_cn") or item.get("name") or "未命名作品").strip(),
        "originalTitle": str(item.get("name") or "").strip(),
        "year": year,
        "type": "tv",
        "season": season_for_date(date_value),
        "poster": images.get("large") or images.get("common") or images.get("medium") or "",
        "releaseDate": date_value,
        "studio": "",
        "note": "",
        "score": float(rating.get("score") or item.get("score") or 0) or None,
        "rank": int(rating.get("rank") or item.get("rank") or 0) or None,
        "source": [{"name": "番组计划", "url": f"https://bgm.tv/subject/{subject_id}"}],
    }


def fetch_year(client: CachedClient, year: int) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    limit = 50
    offset = 0
    while True:
        payload = client.get_json(
            {
                "type": 2,
                "cat": 1,
                "year": year,
                "sort": "date",
                "limit": limit,
                "offset": offset,
            },
            f"bangumi_tv_{year}_{offset}",
        )
        items = payload.get("data") or []
        records.extend(convert_item(item, year) for item in items)
        total = int(payload.get("total") or offset + len(items))
        offset += len(items)
        print(f"  {year}: {min(offset, total)}/{total}", flush=True)
        if not items or offset >= total:
            break
    return records


def main() -> int:
    parser = argparse.ArgumentParser(description="抓取番组计划电视动画并按季度整理")
    parser.add_argument("--years", type=parse_years, default=parse_years("1960-2030"))
    parser.add_argument("--output-dir", type=Path, default=Path("data") / "bangumi-tv")
    parser.add_argument("--cache-dir", type=Path, default=Path(".cache") / "bangumi-tv")
    parser.add_argument("--delay", type=float, default=0.8, help="相邻请求最小间隔秒数")
    parser.add_argument("--max-retries", type=int, default=8)
    parser.add_argument("--max-backoff", type=float, default=180.0)
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument("--user-agent", default=DEFAULT_USER_AGENT)
    args = parser.parse_args()

    args.output_dir.mkdir(parents=True, exist_ok=True)
    client = CachedClient(
        args.cache_dir,
        args.delay,
        args.max_retries,
        args.max_backoff,
        args.refresh,
        args.user_agent,
    )

    by_id: dict[str, dict[str, Any]] = {}
    for position, year in enumerate(args.years, start=1):
        print(f"[{position}/{len(args.years)}] 抓取 {year} 年TV动画...", flush=True)
        for record in fetch_year(client, year):
            by_id[record["id"]] = record

    all_records = sorted(by_id.values(), key=lambda item: (item["year"], item["releaseDate"], item["title"]))
    confirmed = [record for record in all_records if record["season"]]
    review = [record for record in all_records if not record["season"]]
    season_counts = Counter(record["season"] for record in confirmed)
    year_counts = Counter(str(record["year"]) for record in confirmed)
    summary = {
        "years": args.years,
        "fetched": len(all_records),
        "quarter_ready": len(confirmed),
        "manual_review_missing_date": len(review),
        "season_counts": dict(sorted(season_counts.items())),
        "year_counts": dict(sorted(year_counts.items())),
    }

    (args.output_dir / "bangumi-tv.json").write_text(
        json.dumps(confirmed, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (args.output_dir / "manual-review-missing-date.json").write_text(
        json.dumps(review, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (args.output_dir / "summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
