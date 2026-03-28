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
    QaCase(
        query="What does Alcoholism do?",
        expected_substrings=(
            "# RULES QA EVIDENCE: What does Alcoholism do?",
            "Alcoholism",
            "## Best Evidence",
            "Source: (Basic Set, p. 124",
        ),
    ),
    QaCase(
        query="What is Karate?",
        expected_substrings=(
            "# RULES QA EVIDENCE: What is Karate?",
            "Karate",
            "## Best Evidence",
            "Source: (Basic Set, p. 205",
        ),
    ),
    QaCase(
        query="How do hit locations work?",
        expected_substrings=(
            "# RULES QA EVIDENCE: How do hit locations work?",
            "Hit Location",
            "## Best Evidence",
            "Source: (Basic Set, p. 338",
        ),
    ),
    QaCase(
        query="How does Retreat work?",
        expected_substrings=(
            "# RULES QA EVIDENCE: How does Retreat work?",
            "Retreat",
            "## Best Evidence",
            "Source: (Basic Set, p. 395",
        ),
    ),
    QaCase(
        query="How does All-Out Defense work?",
        expected_substrings=(
            "# RULES QA EVIDENCE: How does All-Out Defense work?",
            "All-Out Defense",
            "## Best Evidence",
            "Source: (Basic Set, p. 326",
        ),
    ),
    QaCase(
        query="How does Rapid Fire work?",
        expected_substrings=(
            "# RULES QA EVIDENCE: How does Rapid Fire work?",
            "Rapid Fire",
            "## Best Evidence",
            "Source: (Basic Set, p. 377",
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
