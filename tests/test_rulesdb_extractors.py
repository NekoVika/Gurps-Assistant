from __future__ import annotations

import sqlite3
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from rulesdb_lib.extractors.entities import (  # noqa: E402
    _block_heading_match,
    _extract_named_rule_entities,
    _looks_like_section_break,
    _parse_advdisadv_heading,
    _parse_redirect_reference_text,
    _parse_skill_heading,
)


class RulesDbExtractorHelperTests(unittest.TestCase):
    def test_parse_advdisadv_heading_bracket_form(self) -> None:
        parsed = _parse_advdisadv_heading(["Combat Reflexes [15]"])
        self.assertEqual(parsed, ("Combat Reflexes", "15"))

    def test_parse_advdisadv_heading_points_form(self) -> None:
        parsed = _parse_advdisadv_heading(["Clerical Investment 4", "5 points"])
        self.assertEqual(parsed, ("Clerical Investment", "5"))

    def test_parse_advdisadv_heading_redirect_form(self) -> None:
        parsed = _parse_advdisadv_heading(["Gifted Artist", "see Talent, p. 89"])
        self.assertEqual(parsed, ("Gifted Artist", "see_ref:89|Talent"))

    def test_parse_skill_heading_multiline_and_inline_forms(self) -> None:
        parsed_multiline = _parse_skill_heading(["Acrobatics", "DX/H"])
        parsed_inline = _parse_skill_heading(["Driving (Automobile) (DX/Average):"])
        self.assertEqual(parsed_multiline, ("Acrobatics", "DX/H"))
        self.assertEqual(parsed_inline, ("Driving (Automobile)", "DX/A"))

    def test_parse_redirect_reference_text_variants(self) -> None:
        self.assertEqual(_parse_redirect_reference_text("see p. 21"), (21, None))
        self.assertEqual(_parse_redirect_reference_text("see Talent, p. 89"), (89, "Talent"))
        self.assertEqual(_parse_redirect_reference_text("see Talent (p. 89)"), (89, "Talent"))

    def test_rule_heading_match_and_section_break(self) -> None:
        heading_map = {
            "all out defense": "All-Out Defense",
            "all out attack": "All-Out Attack",
        }
        self.assertEqual(
            _block_heading_match("ALL-OUT\nDEFENSE", heading_map),
            "All-Out Defense",
        )
        self.assertTrue(_looks_like_section_break("RANGED ATTACKS", heading_map=heading_map))
        self.assertFalse(_looks_like_section_break("ALL-OUT ATTACK", heading_map=heading_map))


class RulesDbExtractorIntegrationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.conn = sqlite3.connect(":memory:")
        self.conn.row_factory = sqlite3.Row
        self.conn.executescript(
            """
            CREATE TABLE blocks(
              book_id INTEGER,
              logical_page_number INTEGER,
              block_id TEXT,
              text_raw TEXT,
              text_clean TEXT,
              block_meta TEXT,
              reading_order INTEGER
            );
            CREATE TABLE entities(
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              type TEXT,
              name TEXT,
              aliases TEXT,
              book_id INTEGER,
              start_page INTEGER,
              end_page INTEGER,
              confidence REAL,
              needs_review INTEGER,
              review_reason TEXT,
              created_at TEXT,
              updated_at TEXT
            );
            CREATE TABLE entity_text(
              entity_id INTEGER UNIQUE,
              text_raw TEXT,
              text_clean TEXT,
              primary_citation TEXT,
              block_refs TEXT,
              created_at TEXT,
              updated_at TEXT
            );
            """
        )

    def tearDown(self) -> None:
        self.conn.close()

    def test_extract_named_rule_entities_splits_at_next_heading(self) -> None:
        self.conn.executemany(
            """
            INSERT INTO blocks(book_id, logical_page_number, block_id, text_raw, text_clean, block_meta, reading_order)
            VALUES(?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (1, 365, "b1", "ALL-OUT\nDEFENSE", "ALL-OUT\nDEFENSE", None, 1),
                (1, 365, "b2", "You defend better.", "You defend better.", None, 2),
                (1, 366, "b3", "ATTACK", "ATTACK", None, 1),
                (1, 366, "b4", "Make an attack.", "Make an attack.", None, 2),
            ],
        )

        created, review_count, meta = _extract_named_rule_entities(
            self.conn,
            book_id=1,
            heading_map={
                "all out defense": "All-Out Defense",
                "attack": "Attack",
            },
            aliases_by_name={
                "All-Out Defense": ["All-Out Defense"],
                "Attack": ["Attack"],
            },
            max_span_pages=2,
            min_chars=5,
            cluster_gap_pages=2,
            cluster_choice="all",
            cluster_tail_pages=1,
            mode="replace",
        )

        self.assertEqual(created, 2)
        self.assertEqual(review_count, 0)
        self.assertEqual(meta["chosen_cluster_hits"], 2)

        rows = self.conn.execute(
            """
            SELECT e.name, t.text_clean
            FROM entities e
            JOIN entity_text t ON t.entity_id = e.id
            ORDER BY e.id
            """
        ).fetchall()
        self.assertEqual(rows[0]["name"], "All-Out Defense")
        self.assertIn("You defend better.", rows[0]["text_clean"])
        self.assertNotIn("Make an attack.", rows[0]["text_clean"])
        self.assertEqual(rows[1]["name"], "Attack")
        self.assertIn("Make an attack.", rows[1]["text_clean"])


if __name__ == "__main__":
    unittest.main()
