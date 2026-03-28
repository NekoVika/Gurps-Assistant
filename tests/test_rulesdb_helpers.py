from __future__ import annotations

import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from rulesdb_lib.qa_helpers import (  # noqa: E402
    entity_name_relevance,
    pages_label,
    qa_candidate_terms,
)


class RulesDbHelperTests(unittest.TestCase):
    def test_pages_label_formats_ranges(self) -> None:
        self.assertEqual(pages_label(45, 45), "p. 45")
        self.assertEqual(pages_label(45, 46), "p. 45-46")
        self.assertEqual(pages_label(None, 46), "p. ?")

    def test_candidate_terms_prefers_rule_words(self) -> None:
        terms = qa_candidate_terms("How does a Deceptive Attack work?")
        self.assertIn("Deceptive", terms)
        self.assertIn("Attack", terms)
        self.assertIn("Deceptive Attack", terms)
        self.assertNotIn("How", terms)

    def test_entity_name_relevance_scores_exact_higher(self) -> None:
        terms = ["Deceptive", "Attack", "Deceptive Attack"]
        self.assertGreaterEqual(
            entity_name_relevance("Deceptive Attack", terms, "How does a Deceptive Attack work?"),
            90,
        )
        self.assertGreaterEqual(
            entity_name_relevance("Attack", terms, "How does a Deceptive Attack work?"),
            70,
        )


if __name__ == "__main__":
    unittest.main()
