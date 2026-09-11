"""Replace migrated markdown links with the names they point at.

The MD2JSON migration left references like
"[The Shoals](../../01_World_Bible/Locations/The_Shoals.md)" in fields the UI
renders as entity links. Resolution now unwraps them at read time, so nothing
is broken -- but the stored value still leaks a path into anything that reads
it raw, and an editor that saves the field writes the path straight back.

Only fields that name a single entity are touched. Prose is left alone: a
markdown link inside a paragraph is a link, and should stay one.

    python scripts/migrate_unwrap_links.py
    python scripts/migrate_unwrap_links.py --apply
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

from gurpsai.app.services.link_resolver import link_text  # noqa: E402

# Single-entity reference fields. `location` and `region` were cleaned by
# earlier migrations but are listed so a re-import cannot reintroduce them.
SCALAR_FIELDS = ("primaryLocation", "location", "region", "parentLocation")
LIST_FIELDS = ("characters", "locations", "factions", "storyAppearances",
               "childLinks", "notableNpcs")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("campaign", nargs="?", default="AnomalyHuntersCampaign")
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    campaign = (ROOT / args.campaign).resolve()
    if not campaign.is_dir():
        print(f"No such campaign directory: {campaign}")
        return 1

    changes: list[tuple[Path, dict]] = []
    shown = 0

    for path in sorted(campaign.rglob("*.json")):
        if any(part.lower() in {".trash", ".planning"} for part in path.parts):
            continue
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (ValueError, OSError):
            continue
        if not isinstance(data, dict):
            continue

        touched = False
        for field in SCALAR_FIELDS:
            value = data.get(field)
            if isinstance(value, str) and link_text(value) != value.strip():
                if shown < 12:
                    print(f"  {path.name:34} {field:16} {value[:46]!r} -> {link_text(value)!r}")
                    shown += 1
                data[field] = link_text(value)
                touched = True

        for field in LIST_FIELDS:
            values = data.get(field)
            if not isinstance(values, list):
                continue
            unwrapped = [link_text(v) if isinstance(v, str) else v for v in values]
            if unwrapped != values:
                if shown < 12:
                    print(f"  {path.name:34} {field:16} (list) -> unwrapped")
                    shown += 1
                data[field] = unwrapped
                touched = True

        if touched:
            changes.append((path, data))

    print(f"\n{len(changes)} files would change.")
    if not args.apply:
        print("\nDry run. Re-run with --apply to write.")
        return 0

    for path, data in changes:
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"\nWrote {len(changes)} files.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
