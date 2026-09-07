"""What is still unfinished about the campaign's linkage.

Distinct from schema faults, which mean a file is broken, and from dangling
references, which mean a name points at nothing. A loose end means the campaign
is *incomplete*: something exists but has not been put anywhere yet.

The report is meant to reach zero. That only works if every entry has exactly
one honest way to close, so nothing is listed that cannot be finished:

- Types are exempt. A bestiary entry is a template, and a template is not
  anywhere -- its instances are.
- PCs are exempt from spatial placement. They are wherever the party is, and
  the party's position lives in campaign state, not in their files.

There is deliberately no dismissal mechanism for individuals. An NPC with no
location is not a secret the GM is keeping from himself; it is a decision he
has not made yet.
"""
from __future__ import annotations

from dataclasses import dataclass

from gurpsai.app.services.link_resolver import is_reference
from gurpsai.app.services.location_tree import find_cycles
from gurpsai.app.services.placement import PlacementIndex

#: Ordered by how much they block understanding the campaign.
ISSUE_LABELS = {
    "containment_cycle": "Locations contain each other in a loop",
    "placement_cycle": "Characters are placed through each other in a loop",
    "unresolved_location": "Placed somewhere that has no file",
    "unplaced_spatial": "Not anywhere yet",
    "unplaced_story": "Not part of any story node yet",
}


@dataclass(frozen=True)
class LooseEnd:
    name: str
    source_path: str
    issue: str
    detail: str

    @property
    def label(self) -> str:
        return ISSUE_LABELS.get(self.issue, self.issue)


def _exempt_from_spatial(data: dict) -> bool:
    kind = data.get("kind", "individual")
    return kind in {"type", "pc"}


def _exempt_from_story(data: dict) -> bool:
    # A PC belongs to the whole campaign by definition; a type belongs nowhere.
    return data.get("kind", "individual") in {"type", "pc"}


def collect(
    characters: dict[str, dict],
    locations: dict[str, dict],
    *,
    party_location: str = "",
    paths: dict[str, str] | None = None,
) -> list[LooseEnd]:
    """Every unfinished piece of linkage, most structural first.

    `characters` and `locations` map name -> document; `paths` maps name -> the
    file it came from, purely so the UI can offer to open it.
    """
    paths = paths or {}
    index = PlacementIndex(
        locations=locations, characters=characters, party_location=party_location
    )
    found: list[LooseEnd] = []

    # Structural problems first -- a cycle makes everything downstream unreliable.
    parents = {
        name.lower(): data.get("parentLocation", "")
        for name, data in locations.items()
        if (data.get("parentLocation") or "").strip()
    }
    for loop in find_cycles(parents):
        head = loop[0]
        found.append(LooseEnd(
            name=head,
            source_path=paths.get(head, ""),
            issue="containment_cycle",
            detail=" → ".join(loop) + " → …",
        ))

    for name, data in sorted(characters.items()):
        # Exempt entities are not placed at all, so whatever their `location`
        # says is habitat or flavour rather than a link. Validating it would
        # produce warnings with no honest way to close.
        if not _exempt_from_spatial(data):
            placement = index.resolve(name)
            if placement.status == "cycle":
                found.append(LooseEnd(
                    name=name,
                    source_path=paths.get(name, ""),
                    issue="placement_cycle",
                    detail=" → ".join(placement.chain) + " → …",
                ))
            elif placement.status == "unresolved":
                found.append(LooseEnd(
                    name=name,
                    source_path=paths.get(name, ""),
                    issue="unresolved_location",
                    detail=f"points at “{placement.unresolved_target}”, which has no file",
                ))
            elif placement.status == "unplaced":
                found.append(LooseEnd(
                    name=name,
                    source_path=paths.get(name, ""),
                    issue="unplaced_spatial",
                    detail="has no location — give it one, or point it at someone it travels with",
                ))

        if not _exempt_from_story(data):
            node = ((data.get("storyPlacement") or {}).get("node") or "").strip()
            if not is_reference(node):
                found.append(LooseEnd(
                    name=name,
                    source_path=paths.get(name, ""),
                    issue="unplaced_story",
                    detail="belongs to no episode, chapter or encounter yet",
                ))

    order = list(ISSUE_LABELS)
    found.sort(key=lambda e: (order.index(e.issue) if e.issue in order else 99, e.name))
    return found


def summarise(ends: list[LooseEnd]) -> dict[str, int]:
    """Counts per issue, for a report header that says whether zero is close."""
    counts: dict[str, int] = {}
    for end in ends:
        counts[end.issue] = counts.get(end.issue, 0) + 1
    return counts
