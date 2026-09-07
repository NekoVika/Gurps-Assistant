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

__all__ = ["split_region", "resolve_parent", "ancestors", "find_cycles"]

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
