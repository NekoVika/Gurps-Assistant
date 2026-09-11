"""Where an entity actually is, resolved rather than stored.

A spatial link expresses a relationship, not a coordinate. Most of the time it
points straight at a Location, but it may point at another character -- "travels
with" -- and the answer is then wherever *they* are. Player characters resolve
to the party's position, which lives in the campaign's own state rather than in
any character file.

Storing a current position instead would mean updating every travelling NPC
whenever the party moves, and would overwrite the planning answer ("where does
Rick belong") with a transient one. Resolving means only anchors move.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

from gurpsai.app.services.link_resolver import is_reference, normalize, resolve_name
from gurpsai.app.services.location_tree import ancestors

Status = Literal["placed", "unplaced", "unresolved", "cycle"]


@dataclass(frozen=True)
class Placement:
    """The outcome of walking one entity's spatial links."""

    status: Status
    location: str | None = None
    #: Names walked through to get there, in order. ("Jamie Hass", "HQ")
    chain: tuple[str, ...] = ()
    #: Containing Locations of the final answer, nearest first.
    ancestors: tuple[str, ...] = ()
    #: The link that could not be followed, when status is "unresolved".
    unresolved_target: str | None = None

    @property
    def is_settled(self) -> bool:
        """True when this entity needs nothing further from the GM."""
        return self.status == "placed"


@dataclass
class PlacementIndex:
    """Resolves spatial links across a campaign's characters and locations.

    Both maps are keyed by entity name; lookups fold case and underscores
    through the shared resolver, so "the_watch" and "The Watch" agree.
    """

    locations: dict[str, dict] = field(default_factory=dict)
    characters: dict[str, dict] = field(default_factory=dict)
    #: The party's current position, from the campaign state file.
    party_location: str = ""

    def __post_init__(self) -> None:
        self._loc = {normalize(n): d for n, d in self.locations.items() if normalize(n)}
        self._chr = {normalize(n): d for n, d in self.characters.items() if normalize(n)}
        self._parents = {
            normalize(name): data.get("parentLocation", "")
            for name, data in self.locations.items()
            if (data.get("parentLocation") or "").strip()
        }

    # -- internals ---------------------------------------------------------

    def _location_named(self, target: str) -> str | None:
        # Same rule the rest of the app resolves links by, so "HQ" reaches a
        # location named "Apex Infrastructure Group HQ" here too.
        matched = resolve_name(target, [d.get("name", n) for n, d in self.locations.items()])
        return matched

    def _placed_at(self, location: str, chain: list[str]) -> Placement:
        return Placement(
            status="placed",
            location=location,
            chain=tuple(chain),
            ancestors=tuple(ancestors(location, self._parents)),
        )

    # -- public ------------------------------------------------------------

    def resolve(self, name: str) -> Placement:
        """Follow an entity's spatial links until they reach a fixed Location."""
        start = self._chr.get(normalize(name)) or self._loc.get(normalize(name))
        if start is None:
            return Placement(status="unresolved", unresolved_target=name)

        # A Location is already somewhere: itself.
        if normalize(name) in self._loc:
            settled = start.get("name", name)
            return self._placed_at(settled, [])

        # A PC is wherever the party is, whatever their file happens to say --
        # the loose-ends report exempts them for the same reason, and the two
        # must agree or the passport contradicts the report.
        if start.get("kind") == "pc":
            settled = self._location_named(self.party_location)
            if not settled:
                return Placement(
                    status="unresolved",
                    unresolved_target=self.party_location or "(party location unset)",
                )
            return self._placed_at(settled, [settled])

        chain: list[str] = []
        seen = {normalize(name)}
        current = start

        while True:
            target = (current.get("location") or "").strip()
            if not is_reference(target):
                return Placement(status="unplaced", chain=tuple(chain))

            settled = self._location_named(target)
            if settled:
                chain.append(settled)
                return self._placed_at(settled, chain)

    # Same matching rule as everywhere else, so a companion pointed at
            # "Povo_Witiko" reaches "Povo Witiko (225 pts)".
            matched_name = resolve_name(target, [d.get("name", n) for n, d in self.characters.items()])
            nxt = self._chr.get(normalize(matched_name)) if matched_name else None
            if nxt is None:
                return Placement(
                    status="unresolved", chain=tuple(chain), unresolved_target=target
                )

            nxt_name = nxt.get("name", target)
            if normalize(nxt_name) in seen:
                return Placement(status="cycle", chain=tuple(chain + [nxt_name]))
            seen.add(normalize(nxt_name))
            chain.append(nxt_name)

            # PCs move with the party, and the party's position is campaign state.
            if nxt.get("kind") == "pc":
                settled = self._location_named(self.party_location)
                if not settled:
                    return Placement(
                        status="unresolved",
                        chain=tuple(chain),
                        unresolved_target=self.party_location or "(party location unset)",
                    )
                chain.append(settled)
                return self._placed_at(settled, chain)

            current = nxt

    def describe(self, name: str) -> str:
        """One line a GM can read, showing the answer and how it was reached."""
        placement = self.resolve(name)
        if placement.status == "placed":
            if len(placement.chain) > 1:
                via = " → ".join(placement.chain[:-1])
                return f"{placement.location} (via {via})"
            return placement.location or ""
        if placement.status == "unplaced":
            return "nowhere yet"
        if placement.status == "cycle":
            return "circular placement: " + " → ".join(placement.chain)
        return f"unresolved: {placement.unresolved_target}"
