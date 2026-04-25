from __future__ import annotations

import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[4]
RULESDB_SCRIPT = ROOT / "scripts" / "rulesdb.py"


class RulesQaService:
    """Thin service wrapper around the existing rulesdb QA command."""

    def __init__(self, script_path: Path | None = None) -> None:
        self._script_path = script_path or RULESDB_SCRIPT

    def ask(self, query: str, *, limit: int = 3) -> str:
        normalized = query.strip()
        if not normalized:
            raise ValueError("Rules query must be non-empty.")
        if not self._script_path.exists():
            raise RuntimeError(f"Missing rules DB CLI script: {self._script_path}")

        proc = subprocess.run(
            [sys.executable, str(self._script_path), "qa", normalized, "--limit", str(limit)],
            cwd=ROOT,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )

        stdout = proc.stdout.strip()
        stderr = proc.stderr.strip()
        if proc.returncode != 0:
            detail = stderr or stdout or "Unknown rules DB error."
            raise RuntimeError(detail)
        return stdout
