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

from gurpsai.app.services.link_resolver import is_reference, normalize
from gurpsai.app.services.location_tree import find_cycles
from gurpsai.app.services.placement import PlacementIndex

#: Ordered by how much they block understanding the campaign.
ISSUE_LABELS = {
    "contested_child": "Claimed as a child by more than one story node",
    "containment_cycle": "Locations contain each other in a loop",
    "placement_cycle": "Characters are placed through each other in a loop",
    "unresolved_location": "Placed somewhere that has no file",
    "unresolved_story_node": "Placed in a story node that is not in the story",
    "unplaced_spatial": "Not anywhere yet",
    "unplaced_story": "Not part of any story node yet",
    "one_sided_relation": "Relation recorded on one side only",
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


def _related_names(data: dict) -> list[tuple[str, str]]:
    """(target name, relation text) pairs from a character's relation list."""
    pairs: list[tuple[str, str]] = []
    for entry in data.get("characterRelations") or []:
        if isinstance(entry, dict) and isinstance(entry.get("name"), str):
            pairs.append((entry["name"], str(entry.get("relation") or "")))
        elif isinstance(entry, str):
            pairs.append((entry, ""))
    return pairs


def collect(
    characters: dict[str, dict],
    locations: dict[str, dict],
    *,
    party_location: str = "",
    paths: dict[str, str] | None = None,
    story_nodes: dict[str, dict] | None = None,
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
    known_nodes = {normalize(n) for n in (story_nodes or {})}

    # A child name claimed by two parents cannot be resolved to one lineage, so
    # whichever parent is picked, some fixtures reach the wrong scenes. Bare
    # names like "Chapter 01" are not unique across a campaign with several
    # episodes -- the fix is to make the name say which episode it belongs to.
    claims: dict[str, list[str]] = {}
    for node_name, data in (story_nodes or {}).items():
        for child in data.get("childLinks") or []:
            if isinstance(child, str) and is_reference(child):
                claims.setdefault(normalize(child), []).append(node_name)
    for child_key, claimants in sorted(claims.items()):
        unique = sorted(set(claimants))
        if len(unique) > 1:
            found.append(LooseEnd(
                name=child_key,
                source_path="",
                issue="contested_child",
                detail="listed as a child by " + " and ".join(unique),
            ))

    # Structural problems first -- a cycle makes everything downstream unreliable.
    parents = {
        normalize(name): data.get("parentLocation", "")
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
            elif story_nodes is not None and normalize(node) not in known_nodes:
                # A placement naming something outside the story tree looks
                # settled and is invisible to scope -- worse than being unplaced,
                # because nothing reports it.
                found.append(LooseEnd(
                    name=name,
                    source_path=paths.get(name, ""),
                    issue="unresolved_story_node",
                    detail=f"placed in “{node}”, which is not a story node",
                ))

    # Relation sync writes both sides on save, so a half-recorded relation means
    # a file was edited outside the app or a save did not finish. Reported from
    # one side only, or every pair would appear twice.
    by_norm = {normalize(n): (n, d) for n, d in characters.items()}
    seen_pairs: set[frozenset[str]] = set()
    for name, data in sorted(characters.items()):
        for target_name, relation in _related_names(data):
            if not is_reference(target_name):
                continue
            key = normalize(target_name)
            match = by_norm.get(key)
            if match is None:
                continue  # no file for it -- already a dangling reference
            other_name, other = match
            pair = frozenset({name, other_name})
            if pair in seen_pairs or other_name == name:
                continue
            back = {normalize(t) for t, _ in _related_names(other)}
            if normalize(name) in back:
                continue
            seen_pairs.add(pair)
            described = f" as “{relation}”" if relation else ""
            found.append(LooseEnd(
                name=name,
                source_path=paths.get(name, ""),
                issue="one_sided_relation",
                detail=f"lists {other_name}{described}, but {other_name} does not list them back",
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
