from __future__ import annotations

import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from rulesdb_lib.qa_regression import CASES, run_case  # noqa: E402


class RulesDbRegressionTests(unittest.TestCase):
    def test_qa_cases(self) -> None:
        failures: list[str] = []
        for case in CASES:
            ok, output = run_case(case)
            if not ok:
                failures.append(f"{case.query}\n{output[:2000]}")
        if failures:
            self.fail("\n\n".join(failures))


if __name__ == "__main__":
    unittest.main()
