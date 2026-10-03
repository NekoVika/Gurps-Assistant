"""Spatial containment for Locations.

Locations nest inside Locations. Containment rolls *upward* only -- being in a
room implies being in the building, never the reverse -- so every query here
walks toward the root and never distributes downward.

Parent links are stored as names rather than paths, matching how every other
link in the campaign works, and are compared through the shared resolver so
``The_Watch`` and "the watch" are the same place.
"""
from __future__ import annotations

import re

from gurpsai.app.services.link_resolver import normalize
# Re-exported: the walk is identical on both axes, so it lives in tree.py.
from gurpsai.app.services.tree import ancestors, find_cycles

__all__ = ["split_region", "resolve_parent", "ancestors", "find_cycles", "zone_owners"]


def zone_owners(locations: dict[str, dict]) -> dict[str, str]:
    """Internal zone title -> the location that contains it.

    "Sector C: Scavenger Territory" names a part of the Shaded Citadel, not a
    place of its own, so a reference to it is placed at the Citadel —
    containment rolls upward, as everywhere else.

    This exists because of our own migration. 0.4 lifted rooms out of character
    files into ``internalStructure``, and every reference already pointing at
    one of those rooms stopped resolving the moment it moved. Fourteen of this
    campaign's story nodes named a zone that had just become invisible.
    """
    owners: dict[str, str] = {}
    for key, data in locations.items():
        location_name = (data.get("name") or key or "").strip()
        if not location_name:
            continue
        for zone in data.get("internalStructure") or []:
            title = (zone.get("title") if isinstance(zone, dict) else zone) or ""
            title = str(title).strip()
            # First writer wins: two locations may both have a "Main Floor",
            # and guessing between them is worse than leaving it unresolved.
            if title and title not in owners:
                owners[title] = location_name
    return owners

# "Rain World (Lower Regions)" / "Rain World - Drowned Zone" -- a parent with a
# sub-area stapled on. The qualifier is not always spatial ("circa 1983"), so it
# is handed back rather than interpreted.
_PARENTHETICAL = re.compile(r"^(.*?)\s*\(([^)]*)\)\s*$")
_DASHED = re.compile(r"\s+[-–—]\s+")

# Shorter prefixes match too loosely to be worth guessing from.
_MIN_PREFIX = 5


def split_region(region: str) -> tuple[str, str]:
    """Split a free-text region label into (candidate parent, qualifier)."""
    text = (region or "").strip()
    if not text:
        return "", ""

    match = _PARENTHETICAL.match(text)
    if match:
        return match.group(1).strip(), match.group(2).strip()

    parts = _DASHED.split(text, maxsplit=1)
    if len(parts) == 2:
        return parts[0].strip(), parts[1].strip()

    return text, ""


def resolve_parent(candidate: str, self_name: str, known_names: list[str]) -> str | None:
    """Match a candidate parent against known Location names.

    Returns the canonical name, or None when nothing matches or the only match
    is the location itself -- a place cannot contain itself, and the campaign
    really does have one such row.
    """
    if not candidate:
        return None

    wanted = normalize(candidate)
    if not wanted:
        return None

    by_norm = {normalize(n): n for n in known_names if n}
    me = normalize(self_name)

    exact = by_norm.get(wanted)
    if exact is not None:
        return None if normalize(exact) == me else exact

    # "Five Pebbles Outer Shell" -> Five Pebbles. Longest wins, so a nested
    # candidate never loses to its own ancestor.
    best: str | None = None
    for norm, original in by_norm.items():
        if norm == me or len(norm) < _MIN_PREFIX:
            continue
        if wanted.startswith(norm) and (best is None or len(norm) > len(normalize(best))):
            best = original
    return best
