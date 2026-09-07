"""What belongs to one story node, so the GM can look at an encounter alone.

The story hierarchy is expressed by `childLinks`: an episode lists its chapters,
a chapter lists its encounters. That gives parent edges, and containment rolls
upward exactly as it does for locations.

Scope, though, reads *downward* -- and only for fixtures. That asymmetry is the
whole point of `storyPlacement.mode`:

- an **appearance** at a node means the entity turns up there specifically. It
  says nothing about that node's children: being in an episode does not put you
  in every encounter of it.
- a **fixture** of a node means a standing presence throughout, so it is in
  scope for every descendant. The trader you see every day this chapter shows up
  in each of its encounters without being pinned to any.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

from gurpsai.app.services.link_resolver import is_reference, normalize
from gurpsai.app.services.tree import ancestors


def build_parents(
    nodes: dict[str, dict], paths: dict[str, str] | None = None
) -> dict[str, str]:
    """Parent edges for the story hierarchy, keyed by normalised child name.

    The hierarchy is expressed two ways and both are load-bearing: a parent
    lists its children in `childLinks`, *and* children live in folders beneath
    it. Real campaigns have nodes with one but not the other -- a chapter can
    sit inside its episode's folder without ever being listed -- so using only
    childLinks silently truncates the lineage and fixtures stop reaching down.

    childLinks wins where both exist, since it is the deliberate statement.
    A child claimed by two parents keeps the first; that is a structural fault
    for the loose-ends report to raise, not something to resolve here.
    """
    parents: dict[str, str] = {}
    for name, data in nodes.items():
        for child in data.get("childLinks") or []:
            if not isinstance(child, str) or not is_reference(child):
                continue
            key = normalize(child)
            if key and key not in parents:
                parents[key] = name

    if not paths:
        return parents

    # Fall back to folder nesting: the nearest enclosing directory that holds
    # another node's file is that node's child.
    dirs: dict[str, str] = {}
    for name, path in paths.items():
        if name in nodes:
            dirs.setdefault(str(Path(path).parent).replace("\\", "/"), name)

    for name, path in paths.items():
        key = normalize(name)
        if name not in nodes or key in parents:
            continue
        current = Path(path).parent
        for folder in current.parents:
            owner = dirs.get(str(folder).replace("\\", "/"))
            if owner and normalize(owner) != key:
                parents[key] = owner
                break
    return parents


@dataclass(frozen=True)
class ScopeMember:
    name: str
    #: "pinned" when placed at this node, "inherited" when a fixture above it.
    via: str
    #: The node the placement actually names.
    placed_at: str


@dataclass
class StoryScope:
    """Resolves which entities belong to a given story node."""

    nodes: dict[str, dict] = field(default_factory=dict)
    entities: dict[str, dict] = field(default_factory=dict)
    #: Node name -> file path, so folder nesting can supply missing edges.
    node_paths: dict[str, str] = field(default_factory=dict)

    def __post_init__(self) -> None:
        self._parents = build_parents(self.nodes, self.node_paths)

    def lineage(self, node: str) -> list[str]:
        """The node itself, then everything containing it."""
        return [node, *ancestors(node, self._parents)]

    def members(self, node: str) -> list[ScopeMember]:
        """Entities in scope for this node, pinned ones first.

        In scope means placed *at* this node in either mode, or declared a
        fixture of any node above it.
        """
        if not is_reference(node):
            return []

        line = self.lineage(node)
        here = normalize(node)
        above = {normalize(n) for n in line[1:]}

        found: list[ScopeMember] = []
        for name, data in sorted(self.entities.items()):
            placement = data.get("storyPlacement") or {}
            target = str(placement.get("node") or "").strip()
            if not is_reference(target):
                continue
            key = normalize(target)
            mode = placement.get("mode") or "appearance"

            if key == here:
                found.append(ScopeMember(name=name, via="pinned", placed_at=target))
            elif key in above and mode == "fixture":
                # Only fixtures reach downward; an appearance stays where it is.
                found.append(ScopeMember(name=name, via="inherited", placed_at=target))

        found.sort(key=lambda m: (m.via != "pinned", m.name))
        return found
