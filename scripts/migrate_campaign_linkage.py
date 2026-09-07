"""Link the campaign: real location links, story placements, room detail kept.

Three passes, all reversible and all dry-run by default:

1. `location` becomes a link to a Location. Sub-room detail is not dropped --
   it is moved into the parent Location's internalStructure, which is the field
   that exists for it and is currently empty.
2. `storyPlacement` is set from the GM's own answers, encoded below.
3. Travelling characters point at the person they travel with, not a place.

    python scripts/migrate_campaign_linkage.py
    python scripts/migrate_campaign_linkage.py --apply
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

# name -> (location link, story node, mode). "" means leave alone.
PLAN: dict[str, tuple[str, str, str]] = {
    # HQ staff: campaign-level fixtures, working out of headquarters.
    "Cassandra":         ("Apex Infrastructure Group HQ", "Anomaly Hunters", "fixture"),
    "Rachel":            ("Apex Infrastructure Group HQ", "Anomaly Hunters", "fixture"),
    "Malcolm":           ("Apex Infrastructure Group HQ", "Anomaly Hunters", "fixture"),
    "Arthur Vance":      ("Apex Infrastructure Group HQ", "Anomaly Hunters", "fixture"),
    "Abella":            ("Apex Infrastructure Group HQ", "Anomaly Hunters", "fixture"),
    # Witches sit in the meta layer. Their anchor is the Stage -- where the party
    # can expect to find them -- not wherever they might choose to manifest.
    # Lambdadelta's pursuit of Jamie is characterisation, already recorded in her
    # motivation, and is not a placement.
    "Bernkastel":        ("The Stage", "Anomaly Hunters", "fixture"),
    "Featherine":        ("The Stage", "Anomaly Hunters", "fixture"),
    "Lambdadelta":       ("The Stage", "Anomaly Hunters", "fixture"),
    # Rain World arc.
    "Looks-to-the-Moon": ("The Silent Tower", "Watcher of the Rain", "fixture"),
    "The Overseer":      ("Rain World", "Watcher of the Rain", "fixture"),
    "The Watcher":       ("Industrial Complex", "Watcher of the Rain", "fixture"),
    # A dagger carried by a PC: resolves through its owner, so it needs no
    # maintenance when the party travels.
    "Satan":             ("Povo Witiko (225 pts)", "Anomaly Hunters", "fixture"),
}

# Containment corrections the region parse could not have known.
PARENTS: dict[str, str] = {
    # The final battle happens here, inside the complex rather than loose in
    # Rain World. Placing anyone at the tower now implies the complex too.
    "Pump Tower - The Heart of Rot": "Industrial Complex",
}

# Secondary places an entity is associated with, kept in the plural field so the
# singular home stays unambiguous.
ALSO: dict[str, list[str]] = {
    "The Watcher": ["Pump Tower - The Heart of Rot"],
}

# Sub-room detail lifted out of character files into the parent's zones.
# character -> (parent location, zone title, item text)
ROOMS: dict[str, tuple[str, str, str]] = {
    "Cassandra":    ("Apex Infrastructure Group HQ", "Sub-Level 1: Management & Analysis",
                     "**Prediction Office:** Cassandra's post, where forecasts are drawn up."),
    "Rachel":       ("Apex Infrastructure Group HQ", "Sub-Level 1: Management & Analysis",
                     "**Main Office:** Rachel's office and the floor's administrative hub."),
    "Malcolm":      ("Apex Infrastructure Group HQ", "Sub-Level 1: Management & Analysis",
                     "**Briefing Room:** Where Malcolm runs mission briefings."),
    "Arthur Vance": ("Apex Infrastructure Group HQ", "Sub-Level 2: Operations & Logistics",
                     "**Logistics Hub / Armory:** Arthur Vance's domain."),
    "Abella":       ("Apex Infrastructure Group HQ", "Sub-Level 2: Operations & Logistics",
                     "**Maintenance Bay / Armory:** Abella's workshop."),
}


def load(campaign: Path):
    files: dict[str, tuple[Path, dict]] = {}
    for path in sorted(campaign.rglob("*.json")):
        parts = {p.lower() for p in path.parts}
        if ".trash" in parts or ".planning" in parts:
            continue
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (ValueError, OSError):
            continue
        name = data.get("name") if isinstance(data, dict) else None
        if name:
            files[name] = (path, data)
    return files


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("campaign", nargs="?", default="AnomalyHuntersCampaign")
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    campaign = (ROOT / args.campaign).resolve()
    files = load(campaign)
    touched: dict[Path, dict] = {}
    report: list[str] = []

    for name, (link, node, mode) in PLAN.items():
        entry = files.get(name)
        if entry is None:
            report.append(f"  MISSING  {name} — no file, skipped")
            continue
        path, data = entry
        before_loc = (data.get("location") or "")[:44]
        data["location"] = link
        data["storyPlacement"] = {"node": node, "mode": mode}
        touched[path] = data
        report.append(f"  {name:20} location {before_loc!r:48} -> {link}")
        report.append(f"  {'':20} story    -> {node} ({mode})")

    for name, parent in PARENTS.items():
        entry = files.get(name)
        if entry is None:
            report.append(f"  MISSING  {name} — no file, skipped")
            continue
        path, data = entry
        report.append(f"  {name:20} parent   {data.get('parentLocation','')!r:48} -> {parent}")
        data["parentLocation"] = parent
        touched[path] = data

    for name, extra in ALSO.items():
        entry = files.get(name)
        if entry is None:
            continue
        path, data = entry
        existing = [x for x in (data.get("locations") or []) if isinstance(x, str)]
        for place in extra:
            if place not in existing:
                existing.append(place)
        data["locations"] = existing
        touched[path] = data
        report.append(f"  {name:20} also at  -> {', '.join(extra)}")

    room_changes = 0
    for character, (parent, zone_title, item) in ROOMS.items():
        entry = files.get(parent)
        if entry is None:
            continue
        path, data = entry
        zones = data.setdefault("internalStructure", [])
        zone = next((z for z in zones if z.get("title") == zone_title), None)
        if zone is None:
            zone = {"title": zone_title, "items": []}
            zones.append(zone)
        items = zone.setdefault("items", [])
        if item not in items:
            items.append(item)
            room_changes += 1
        touched[path] = data

    print("\n".join(report))
    print(f"\n  {room_changes} room descriptions moved into {len(ROOMS) and 'HQ'}'s zones")
    print(f"\n{len(touched)} files would change.")

    if not args.apply:
        print("\nDry run. Re-run with --apply to write.")
        return 0

    for path, data in touched.items():
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"\nWrote {len(touched)} files.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
