import json
import tempfile
import unittest
from pathlib import Path

from tools import fetch_bangumi_archive_tv as archive_fetch
from tools import reclassify_catalog as classifier
from tools import extract_bangumi_chinese_anime as chinese_extractor


class ReclassificationTests(unittest.TestCase):
    def setUp(self):
        self.graph = classifier.DisjointSet()

    def subject(self, *, summary="一部独立制作的动画电影。", meta_tags=None):
        return {
            "id": 75855,
            "name": "エースをねらえ!",
            "name_cn": "网球甜心 剧场版",
            "platform": 3,
            "summary": summary,
            "infobox": "{{Infobox animanga/Movie|片长=88分钟}}",
            "meta_tags": meta_tags or ["剧场版", "日本", "漫画改"],
            "tags": [
                {"name": "剧场版", "count": 184},
                {"name": "日本", "count": 10},
                {"name": "漫画改", "count": 43},
                {"name": "出崎统", "count": 140},
            ],
        }

    def test_blue_public_tags_only_and_japan_is_excluded(self):
        self.assertEqual(
            classifier.display_tags(self.subject()),
            [{"name": "剧场版", "count": 184}, {"name": "漫画改", "count": 43}],
        )

    def test_missing_archive_tag_count_is_unknown_instead_of_fake_zero(self):
        subject = self.subject(meta_tags=["剧场版", "漫画改", "冒险"])
        self.assertEqual(classifier.display_tags(subject)[-1], {"name": "冒险", "count": None})

    def test_first_ordinary_tag_skips_public_and_format_tags(self):
        subject = self.subject(meta_tags=["日本", "OVA", "原创"])
        subject["tags"] = [
            {"name": "OVA", "count": 159},
            {"name": "原创", "count": 108},
            {"name": "运动", "count": 94},
            {"name": "BONES", "count": 90},
        ]
        self.assertEqual(classifier.first_ordinary_tag(subject), {"name": "运动", "count": 94})

    def test_chinese_web_record_fields_replace_full_runtime_tag_layer(self):
        tags = [
            {"name": "中国", "count": 30, "public": True},
            {"name": "WEB", "count": 18, "public": True},
            {"name": "武侠", "count": 12, "public": False},
        ]
        self.assertEqual(chinese_extractor.chinese_category_key(tags), "cn-web")
        self.assertEqual(chinese_extractor.first_useful_ordinary_tag(tags), {"name": "武侠", "count": 12})

    def test_archive_range_accepts_early_animation_years(self):
        self.assertEqual(archive_fetch.parse_years("1917-2026"), (1917, 2026))

    def test_archive_admits_unknown_country_but_rejects_explicit_foreign_country(self):
        subjects = [
            {
                "id": 1,
                "type": 2,
                "platform": 5,
                "name": "Unmarked Japanese Web Anime",
                "date": "2022-01-01",
                "meta_tags": ["WEB"],
            },
            {
                "id": 2,
                "type": 2,
                "platform": 1,
                "name": "Explicit Chinese Animation",
                "date": "2022-01-01",
                "meta_tags": ["中国", "TV"],
            },
        ]
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            subject_path = root / "subjects.jsonlines"
            subject_path.write_text("\n".join(json.dumps(row, ensure_ascii=False) for row in subjects), encoding="utf-8")
            summary = archive_fetch.build_tv_data(subject_path, root / "output", (1917, 2026), False)
            records = json.loads((root / "output" / "bangumi-tv.json").read_text(encoding="utf-8"))
        self.assertEqual([record["id"] for record in records], ["bgm-1"])
        self.assertEqual(records[0]["type"], "web")
        self.assertEqual(summary["country_unknown_admitted"], 1)
        self.assertEqual(summary["non_japanese_excluded"], 1)

    def test_japanese_web_anime_gets_its_own_category(self):
        subject = {
            "id": 309311,
            "name": "Cyberpunk: Edgerunners",
            "name_cn": "赛博浪客",
            "date": "2022-09-13",
            "platform": 5,
            "infobox": "|别名={\n[赛博朋克：边缘行者]\n[サイバーパンク エッジランナーズ]\n}\n|动画制作= TRIGGER",
            "score": 8.3,
            "rank": 98,
        }
        converted = archive_fetch.convert_subject(subject)
        self.assertEqual(converted["type"], "web")
        self.assertIsNone(converted["season"])
        self.assertIn("赛博朋克：边缘行者", converted["aliases"])
        classified = classifier.classify_record(converted, {**subject, "meta_tags": ["日本", "WEB"], "tags": []}, 5, set(), set(), self.graph)
        self.assertEqual(classified[0], "web")
        self.assertEqual(classified[2], "web")

    def test_web_tag_is_not_exposed_as_a_card_tag(self):
        subject = self.subject(meta_tags=["日本", "WEB", "原创"])
        subject["tags"].append({"name": "WEB", "count": 99})
        self.assertEqual(classifier.display_tags(subject), [{"name": "原创", "count": None}])

    def test_full_story_relation_alone_does_not_make_a_recap(self):
        result = classifier.classify_record(
            {"id": "bgm-75855", "title": "网球甜心 剧场版", "type": "theatrical"},
            self.subject(),
            3,
            {5},
            set(),
            self.graph,
        )
        self.assertEqual(result[0], "theatrical")

    def test_explicit_recap_wording_still_enters_other(self):
        subject = self.subject(summary="テレビシリーズを再編集した総集編。")
        subject["tags"].append({"name": "总集篇", "count": 8})
        result = classifier.classify_record(
            {"id": "bgm-75855", "title": "某动画 特别篇", "type": "theatrical"},
            subject,
            3,
            {5},
            set(),
            self.graph,
        )
        self.assertEqual(result[0], "other")

    def test_unhighlighted_animation_movie_tag_wins_over_theatrical(self):
        subject = {**self.subject(), "id": 269235, "name_cn": "天气之子", "name": "天気の子"}
        subject["tags"] = [*subject["tags"], {"name": "动画电影", "count": 1347}]
        result = classifier.classify_record(
            {"id": "bgm-269235", "title": "天气之子", "type": "movie"},
            subject,
            3,
            set(),
            set(),
            self.graph,
        )
        self.assertEqual(result[0], "movie")

    def test_tv_franchise_film_wins_over_low_count_animation_movie_tag(self):
        subject = self.subject()
        subject["tags"].append({"name": "アニメ映画", "count": 2})
        self.graph.union(75855, 999)
        result = classifier.classify_record(
            {"id": "bgm-75855", "title": "阿拉蕾 剧场版", "type": "movie"},
            subject,
            3,
            set(),
            {self.graph.find(999)},
            self.graph,
        )
        self.assertEqual(result[0], "theatrical")
        self.assertEqual(result[2], "tag_franchise_theatrical")

    def test_original_standalone_theatrical_tag_is_animation_movie(self):
        subject = self.subject(meta_tags=["剧场版", "日本", "原创"])
        subject["tags"].append({"name": "原创", "count": 655})
        result = classifier.classify_record(
            {"id": "bgm-307", "title": "红猪", "type": "movie"},
            subject,
            3,
            set(),
            set(),
            self.graph,
        )
        self.assertEqual(result[0], "movie")
        self.assertEqual(result[2], "tag_original_movie")

    def test_staged_screening_with_matching_tv_title_is_theatrical(self):
        result = classifier.classify_record(
            {"id": "bgm-448491", "title": "偶像大师 百万现场! 第1幕", "type": "movie"},
            None,
            3,
            set(),
            set(),
            self.graph,
            has_title_tv_basis=True,
        )
        self.assertEqual(result[0], "theatrical")
        self.assertEqual(result[2], "tv_title_basis")

    def test_staged_screening_root_ignores_punctuation(self):
        self.assertEqual(
            classifier.staged_screening_root("偶像大师 百万现场! 第1幕"),
            classifier.normalize_title("偶像大师 百万现场！"),
        )

    def test_locked_archive_missing_compilation_uses_confirmed_tag_fallback(self):
        result = classifier.classify_record(
            {"id": "bgm-410499", "title": "鬼灭之刃 上弦集结、前往锻刀村", "type": "movie"},
            None,
            3,
            {5},
            set(),
            self.graph,
        )
        self.assertEqual(result[0], "other")
        self.assertEqual(result[2], "summary")

    def test_explicit_foreign_country_tag_is_an_admission_exclusion(self):
        subject = self.subject(meta_tags=["剧场版", "历史", "中国"])
        subject["tags"].extend([
            {"name": "国产动画", "count": 2},
            {"name": "中国动画", "count": 1},
        ])
        self.assertEqual(
            classifier.foreign_production_tags(subject),
            ["中国", "中国动画", "国产动画"],
        )

    def test_story_country_tag_is_not_treated_as_production(self):
        subject = self.subject(meta_tags=["剧场版", "漫画改"])
        subject["tags"].append({"name": "印度", "count": 12})
        self.assertEqual(classifier.foreign_production_tags(subject), [])

    def test_weak_domestic_tag_does_not_override_japan_meta(self):
        subject = self.subject(meta_tags=["剧场版", "日本"])
        subject["tags"].append({"name": "国产", "count": 1})
        self.assertEqual(classifier.foreign_production_tags(subject), [])


if __name__ == "__main__":
    unittest.main()
