"""Generic containment walkers, shared by the spatial and story hierarchies.

Both axes obey the same rule -- containment rolls upward and never downward --
so the traversal is identical and only the edges differ. Keeping one
implementation means a cycle cannot be safe on one axis and hang on the other.
"""
from __future__ import annotations

from gurpsai.app.services.link_resolver import normalize


def ancestors(name: str, parents: dict[str, str]) -> list[str]:
    """Every containing node, nearest first.

    Stops on a cycle rather than looping, so a malformed tree degrades to a
    partial answer instead of hanging the caller.
    """
    chain: list[str] = []
    seen = {normalize(name)}
    current = parents.get(normalize(name))

    while current:
        key = normalize(current)
        if key in seen:
            break
        seen.add(key)
        chain.append(current)
        current = parents.get(key)

    return chain


def find_cycles(parents: dict[str, str]) -> list[list[str]]:
    """Every containment cycle, each reported once from its lowest member."""
    cycles: list[list[str]] = []
    reported: set[frozenset[str]] = set()

    for start in parents:
        seen: list[str] = []
        current: str | None = start
        while current:
            key = normalize(current)
            if key in seen:
                loop = seen[seen.index(key):]
                fingerprint = frozenset(loop)
                if fingerprint not in reported:
                    reported.add(fingerprint)
                    cycles.append(loop)
                break
            seen.append(key)
            current = parents.get(key)

    return cycles
