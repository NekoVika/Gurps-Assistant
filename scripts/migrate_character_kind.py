"""Seed Character.kind from the folder each file currently sits in.

`kind` is authoritative from here on -- folder placement is derived from it,
not the reverse -- but the existing layout already encodes the answer, so this
reads it once and writes it down.

It matters because types are exempt from placement warnings: a bestiary entry
is a template, and templates are not anywhere. Instances are.

    python scripts/migrate_character_kind.py
    python scripts/migrate_character_kind.py --apply
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

FOLDER_KIND = {"bestiary": "type", "pcs": "pc"}


def derive_kind(path: Path) -> str:
    for part in path.parts:
        hit = FOLDER_KIND.get(part.strip().lower())
        if hit:
            return hit
    return "individual"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("campaign", nargs="?", default="AnomalyHuntersCampaign")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    campaign = (ROOT / args.campaign).resolve()
    if not campaign.is_dir():
        print(f"No such campaign directory: {campaign}")
        return 1

    planned: list[tuple[Path, dict, str]] = []
    for path in sorted(campaign.rglob("*.json")):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (ValueError, OSError):
            continue
        # Characters are the files carrying a point total and attributes.
        if not isinstance(data, dict) or "attributes" not in data or "pointTotal" not in data:
            continue
        if data.get("kind"):
            continue
        planned.append((path, data, derive_kind(path)))

    tally = Counter(kind for _, _, kind in planned)
    print(f"{len(planned)} characters to seed: " + ", ".join(f"{v} {k}" for k, v in tally.most_common()) + "\n")
    for path, data, kind in planned:
        print(f"  {data.get('name','?'):30} {kind:11} <- {path.parent.name}")

    if not args.apply:
        print("\nDry run. Re-run with --apply to write.")
        return 0

    for path, data, kind in planned:
        data["kind"] = kind
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"\nWrote {len(planned)} files.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
