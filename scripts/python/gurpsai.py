#!/usr/bin/env python3
"""Compatibility shim for legacy script path.

PowerShell wrappers call this file directly. It forwards execution to the
packaged CLI module from src/gurpsai.
"""

from __future__ import annotations

import importlib.util
import pathlib

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
CLI_PATH = REPO_ROOT / "src" / "gurpsai" / "cli.py"

if not CLI_PATH.is_file():
    raise SystemExit(f"Missing CLI module: {CLI_PATH}")

_spec = importlib.util.spec_from_file_location("gurpsai_cli", CLI_PATH)
if _spec is None or _spec.loader is None:
    raise SystemExit(f"Could not load CLI module spec from: {CLI_PATH}")
_module = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_module)
console_main = _module.console_main


if __name__ == "__main__":
    raise SystemExit(console_main())
