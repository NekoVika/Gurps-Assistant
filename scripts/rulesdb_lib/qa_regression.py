from __future__ import annotations

import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
RULESDB = ROOT / "scripts" / "rulesdb.py"


@dataclass(frozen=True)
class QaCase:
    query: str
    expected_substrings: tuple[str, ...]


CASES: tuple[QaCase, ...] = (
    QaCase(
        query="What does Combat Reflexes do?",
        expected_substrings=(
            "# RULES QA EVIDENCE: What does Combat Reflexes do?",
            "Combat Reflexes",
            "## Best Evidence",
            "Source: (Basic Set, p. 45",
        ),
    ),
    QaCase(
        query="Can I dodge bullets?",
        expected_substrings=(
            "# RULES QA EVIDENCE: Can I dodge bullets?",
            "## Supporting Chunks",
            "## Best Evidence",
            "Source: (Basic Set, p.",
        ),
    ),
    QaCase(
        query="How do I make an unarmed fighter better at kicks?",
        expected_substrings=(
            "# RULES QA EVIDENCE: How do I make an unarmed fighter better at kicks?",
            "Brawling",
            "kicking ability",
            "## Best Evidence",
        ),
    ),
    QaCase(
        query="How does suppression fire work?",
        expected_substrings=(
            "# RULES QA EVIDENCE: How does suppression fire work?",
            "Suppression Fire",
            "## Best Evidence",
            "Source: (Basic Set, p. 413",
        ),
    ),
    QaCase(
        query="How does a Deceptive Attack work?",
        expected_substrings=(
            "# RULES QA EVIDENCE: How does a Deceptive Attack work?",
            "Deceptive Attack",
            "## Best Evidence",
            "Source: (Basic Set, p. 373",
        ),
    ),
    QaCase(
        query="How does slam damage work?",
        expected_substrings=(
            "# RULES QA EVIDENCE: How does slam damage work?",
            "Slam",
            "## Best Evidence",
            "Source: (Basic Set, p. 375",
        ),
    ),
)


def run_case(case: QaCase) -> tuple[bool, str]:
    proc = subprocess.run(
        [sys.executable, str(RULESDB), "qa", case.query, "--limit", "3"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    stdout = proc.stdout or ""
    stderr = proc.stderr or ""
    output = stdout + ("\n" + stderr if stderr else "")
    ok = proc.returncode == 0 and all(s in output for s in case.expected_substrings)
    return ok, output


def main() -> int:
    failures = 0
    for case in CASES:
        ok, output = run_case(case)
        status = "PASS" if ok else "FAIL"
        print(f"[{status}] {case.query}")
        if not ok:
            failures += 1
            print(output[:4000])
            print("-" * 60)
    if failures:
        print(f"{failures} case(s) failed.")
        return 1
    print(f"All {len(CASES)} case(s) passed.")
    return 0
