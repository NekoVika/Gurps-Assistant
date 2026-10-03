"""Shared entity-name resolution for campaign links.

Single source of truth for deciding whether a referenced name (childLink,
relation entry, cast member) maps to an existing campaign file. Mirrored on
the frontend in web/src/lib/entityResolution.ts — keep the two in sync.
"""
from __future__ import annotations

import re

# Values that are never real entity references.
# "???" is the codebase's own unset marker -- CharacterData.pointTotal defaults
# to it -- and "unknown" means undecided, which is a loose end rather than a place.
PLACEHOLDER_VALUES = {"", "tbd", "tba", "none", "n/a", "?", "???", "unknown"}

_EXT_RE = re.compile(r"\.(json|md)$", re.IGNORECASE)
_ORDINAL_PREFIX_RE = re.compile(r"^\d+[.\s_-]+")
_WHITESPACE_RE = re.compile(r"\s+")


_TRAILING_PAREN = re.compile(r"\s*\([^)]*\)\s*$")
_MARKDOWN_LINK = re.compile(r"\[([^\]]*)\]\(([^)]*)\)")


def link_text(name: str) -> str:
    """A reference with its markdown link syntax flattened to the label.

    The MD2JSON migration left links in fields the UI renders as entity names,
    and rarely as the whole value -- "[The Shoals](../Locations/The_Shoals.md)
    (Surface)" is typical. Shown whole they leak a file path at the GM and
    resolve to nothing, so every link is replaced by its label wherever it sits.

    Prose is never passed through here: a link inside a paragraph is a link and
    renders as one.
    """
    text = (name or "").strip()
    if not text:
        return text

    def flatten(match: "re.Match[str]") -> str:
        label = match.group(1).strip()
        if label:
            return label
        # "[](path/to/The_Shoals.md)" -- fall back to the file it points at.
        target = match.group(2).split("#")[0].rstrip("/")
        return target.rsplit("/", 1)[-1].rsplit(".", 1)[0] if target else ""

    return _MARKDOWN_LINK.sub(flatten, text).strip()


def normalize(name: str) -> str:
    """Normalize an entity name for matching: case, underscores, extensions,
    leading ordinal prefixes ("2. Ambush" -> "ambush")."""
    text = link_text(name)
    text = _EXT_RE.sub("", text)
    text = text.replace("_", " ")
    text = _ORDINAL_PREFIX_RE.sub("", text)
    text = _WHITESPACE_RE.sub(" ", text)
    return text.strip().lower()


def is_placeholder(name: object) -> bool:
    if not isinstance(name, str):
        return True
    return normalize(name) in PLACEHOLDER_VALUES


def is_reference(name: object) -> bool:
    """True when the string plausibly names an entity.

    Legacy markdown-migrated arrays hold prose like
    "**Dominant Faction:** None (Natural Predators)." — flagging those as
    dangling references (and offering stubs for them) is pure noise.
    """
    if not isinstance(name, str) or is_placeholder(name):
        return False
    if "**" in name:
        return False
    if len(name.strip()) > 100:
        return False
    # Migrated prose sits in the same arrays as names: "None currently present."
    # Entity names do not end in sentence punctuation, so this separates a
    # sentence from a title without needing to understand either.
    if name.strip().endswith((".", "!", "?")) and not name.strip().endswith("..."):
        return False
    return True


def resolve_name(query: object, names: list[str]) -> str | None:
    """Match a name against candidates: exact, then normalised, then unique tail.

    The tail rule is what lets state.json's "HQ" reach a location actually named
    "Apex Infrastructure Group HQ". Every caller must use this, or two matching
    rules drift apart and the same link resolves in one place and not another.
    """
    if not isinstance(query, str) or is_placeholder(query):
        return None
    raw = query.strip()
    for candidate in names:
        if candidate == raw:
            return candidate
    wanted = normalize(raw)
    if not wanted:
        return None
    by_norm: dict[str, str] = {}
    for candidate_name in names:
        if not candidate_name:
            continue
        by_norm.setdefault(normalize(candidate_name), candidate_name)
        # "Povo Witiko (225 pts)" must also answer to "Povo_Witiko": PC files
        # carry their point total, story files reference the plain name.
        bare = _TRAILING_PAREN.sub("", candidate_name).strip()
        if bare and bare != candidate_name:
            by_norm.setdefault(normalize(bare), candidate_name)
    if wanted in by_norm:
        return by_norm[wanted]
    tails = [original for norm, original in by_norm.items() if norm.endswith(wanted)]
    if len(tails) == 1:
        return tails[0]

    # The alias above runs one way only -- a candidate's parenthetical is
    # stripped, a query's is not. So "Povo Witiko (225 pts)" could be found by
    # "Povo Witiko", but a story node pointing at "Rain World (Decaying
    # Megastructures)" found nothing, though the location is plainly "Rain
    # World". Thirty-three of this campaign's fifty primaryLocation values
    # failed this way. Last resort, after every exact rule, and still subject
    # to the uniqueness requirement below.
    bare_query = _TRAILING_PAREN.sub("", raw).strip()
    if bare_query and bare_query != raw:
        return resolve_name(bare_query, names)
    return None


class LinkResolver:
    """Resolves referenced names against the campaign registry.

    Match order: exact id/title -> normalized id/title -> unique tail match.
    A tail match that fits more than one entity is NOT a resolution.
    """

    def __init__(self, registry: list[dict]):
        self._exact: dict[str, dict] = {}
        self._normalized: dict[str, dict] = {}
        for item in registry:
            for key in (item.get("id"), item.get("title")):
                if not key:
                    continue
                self._exact.setdefault(key, item)
                norm = normalize(key)
                if norm:
                    self._normalized.setdefault(norm, item)
                # PC files carry their point total in the name -- "Jamie Hass
                # (225 pts)" -- while story files reference plain "Jamie_Hass".
                # Without this alias an existing PC reads as proposed, and
                # accepting the offer creates a duplicate.
                bare = _TRAILING_PAREN.sub("", key).strip()
                if bare and bare != key:
                    bare_norm = normalize(bare)
                    if bare_norm:
                        self._normalized.setdefault(bare_norm, item)
            # Story childLinks often reference the containing directory name
            # ("Chapter 01" -> Chapter_01/Chapter_Overview.json), so alias the
            # parent Episode_/Chapter_ directory of any file inside it. If the
            # same dir name exists in several episodes, first match wins —
            # good enough for existence checks.
            parts = (item.get("path") or "").split("/")
            if len(parts) >= 2:
                parent_dir = parts[-2]
                if parent_dir.startswith("Episode_") or parent_dir.startswith("Chapter_"):
                    norm = normalize(parent_dir)
                    if norm:
                        self._normalized.setdefault(norm, item)

    @classmethod
    def from_service(cls, service=None) -> "LinkResolver":
        from gurpsai.app.services.files import CampaignFileService

        service = service or CampaignFileService()
        return cls(service.get_registry())

    def resolve(self, name: object) -> dict | None:
        if not isinstance(name, str):
            return None
        raw = name.strip()
        if is_placeholder(raw):
            return None
        if raw in self._exact:
            return self._exact[raw]
        norm = normalize(raw)
        if norm in self._normalized:
            return self._normalized[norm]
        tail_paths: set[str] = set()
        tail_item: dict | None = None
        for key, item in self._normalized.items():
            if key.endswith(norm):
                tail_paths.add(item.get("path", ""))
                tail_item = item
        if len(tail_paths) == 1:
            return tail_item
        return None

    def exists(self, name: object) -> bool:
        return self.resolve(name) is not None
