"""Fill Location.parentLocation from the free-text `region` label.

`region` has been carrying containment informally ("Rain World (Lower Regions)")
alongside things that are not containment at all -- dates ("circa 1983") and
status ("Varies"). This moves the structural half into a real link and leaves
`region` in place as a display label, because deleting it would delete the
temporal information with it.

Dry run by default:

    python scripts/migrate_region_to_parent.py
    python scripts/migrate_region_to_parent.py --apply
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

from gurpsai.app.services.link_resolver import normalize  # noqa: E402
from gurpsai.app.services.location_tree import (  # noqa: E402
    find_cycles,
    resolve_parent,
    split_region,
)


def load_locations(campaign: Path) -> dict[Path, dict]:
    """Location files, identified by the field only Locations carry."""
    found: dict[Path, dict] = {}
    for path in campaign.rglob("*.json"):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (ValueError, OSError):
            continue
        if isinstance(data, dict) and "internalStructure" in data and data.get("name"):
            found[path] = data
    return found


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("campaign", nargs="?", default="AnomalyHuntersCampaign")
    parser.add_argument("--apply", action="store_true", help="write changes (default: dry run)")
    args = parser.parse_args()

    campaign = (ROOT / args.campaign).resolve()
    if not campaign.is_dir():
        print(f"No such campaign directory: {campaign}")
        return 1

    locations = load_locations(campaign)
    if not locations:
        print(f"No Location files found under {campaign}")
        return 1

    names = [d["name"] for d in locations.values()]
    planned: dict[Path, str] = {}
    parents: dict[str, str] = {}
    qualifiers: Counter[str] = Counter()
    roots: list[str] = []

    for path, data in sorted(locations.items()):
        if data.get("parentLocation"):
            continue  # already migrated; never overwrite a real answer
        base, qualifier = split_region(data.get("region", ""))
        parent = resolve_parent(base, data["name"], names)
        if qualifier:
            qualifiers[qualifier] += 1
        if parent:
            planned[path] = parent
            parents[normalize(data["name"])] = parent
        else:
            roots.append(data["name"])

    print(f"{len(locations)} locations · {len(planned)} gain a parent · {len(roots)} stay top level\n")
    for path, parent in sorted(planned.items()):
        data = locations[path]
        print(f"  {data['name']:26} region={data.get('region','')!r:44} -> parent={parent}")
    if roots:
        print("\n  top level (no parent found):")
        for name in sorted(roots):
            print(f"    {name}")

    cycles = find_cycles(parents)
    if cycles:
        print("\n  REFUSING: containment cycles detected")
        for loop in cycles:
            print(f"    {' -> '.join(loop)} -> ...")
        return 1

    if qualifiers:
        print("\n  qualifiers kept in `region`; promote to real Locations if they earn it:")
        for qualifier, count in qualifiers.most_common():
            mark = "  <-- referenced more than once" if count > 1 else ""
            print(f"    {count}x  {qualifier}{mark}")

    if not args.apply:
        print("\nDry run. Re-run with --apply to write.")
        return 0

    for path, parent in planned.items():
        data = locations[path]
        data["parentLocation"] = parent
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"\nWrote {len(planned)} files.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
