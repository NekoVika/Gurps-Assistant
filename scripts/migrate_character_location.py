"""Turn each character's free-text `location` into a real link.

The field was never a link. It holds three kinds of thing:

- markdown leftovers from the MD2JSON migration --
  "[The_Leg](../../01_World_Bible/Locations/The_Leg.json)"
- a place plus a sub-area -- "Shaded Citadel (Dark zones)"
- a relationship rather than a place -- "Bound to Povo Witiko (Dagger Form)"

Only the first two are mechanical, and only those are rewritten. Anything that
does not resolve to a Location is left exactly as it is and printed, because
guessing here would put characters in the wrong rooms silently.

Exempt kinds are skipped entirely: a bestiary template's location is habitat
prose, and a PC is wherever the party is.

    python scripts/migrate_character_location.py
    python scripts/migrate_character_location.py --apply
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

from gurpsai.app.services.link_resolver import resolve_name  # noqa: E402
from gurpsai.app.services.location_tree import split_region  # noqa: E402

_MARKDOWN_LINK = re.compile(r"^\s*\[([^\]]+)\]\(([^)]*)\)\s*$")


def candidates(raw: str) -> list[str]:
    """Everything worth trying as a location name, best first."""
    text = (raw or "").strip()
    if not text:
        return []

    link = _MARKDOWN_LINK.match(text)
    if link:
        label, target = link.group(1), link.group(2)
        stem = Path(target.split("#")[0]).stem  # ".../The_Leg.json" -> "The_Leg"
        # The path is authoritative; the label may have been edited since.
        return [c for c in (stem, label) if c]

    base, _qualifier = split_region(text)
    return [c for c in (text, base) if c]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("campaign", nargs="?", default="AnomalyHuntersCampaign")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    campaign = (ROOT / args.campaign).resolve()
    if not campaign.is_dir():
        print(f"No such campaign directory: {campaign}")
        return 1

    characters: list[tuple[Path, dict]] = []
    location_names: list[str] = []
    for path in sorted(campaign.rglob("*.json")):
        parts = {p.lower() for p in path.parts}
        if ".trash" in parts or ".planning" in parts:
            continue
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (ValueError, OSError):
            continue
        if not isinstance(data, dict) or not data.get("name"):
            continue
        if "internalStructure" in data:
            location_names.append(data["name"])
        elif "attributes" in data and "pointTotal" in data:
            characters.append((path, data))

    planned: list[tuple[Path, dict, str, str]] = []
    skipped: list[tuple[str, str]] = []
    exempt = 0

    for path, data in characters:
        if data.get("kind") in {"type", "pc"}:
            exempt += 1
            continue
        raw = (data.get("location") or "").strip()
        if not raw:
            continue
        match = None
        for candidate in candidates(raw):
            match = resolve_name(candidate, location_names)
            if match:
                break
        if match and match != raw:
            planned.append((path, data, raw, match))
        elif not match:
            skipped.append((data["name"], raw))

    print(f"{len(characters)} characters · {exempt} exempt (types and PCs) · "
          f"{len(planned)} rewritable · {len(skipped)} need a decision\n")
    for _, data, before, after in planned:
        print(f"  {data['name']:24} {before[:52]!r:56} -> {after}")
    if skipped:
        print("\n  left alone — no Location matches these:")
        for name, raw in skipped:
            print(f"    {name:24} {raw[:70]!r}")

    if not args.apply:
        print("\nDry run. Re-run with --apply to write.")
        return 0

    for path, data, _, after in planned:
        data["location"] = after
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"\nWrote {len(planned)} files.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
