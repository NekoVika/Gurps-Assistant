"""Shared entity-name resolution for campaign links.

Single source of truth for deciding whether a referenced name (childLink,
relation entry, cast member) maps to an existing campaign file. Mirrored on
the frontend in web/src/lib/entityResolution.ts — keep the two in sync.
"""
from __future__ import annotations

import re

# Values that are never real entity references.
PLACEHOLDER_VALUES = {"", "tbd", "none", "n/a", "?"}

_EXT_RE = re.compile(r"\.(json|md)$", re.IGNORECASE)
_ORDINAL_PREFIX_RE = re.compile(r"^\d+[.\s_-]+")
_WHITESPACE_RE = re.compile(r"\s+")


def normalize(name: str) -> str:
    """Normalize an entity name for matching: case, underscores, extensions,
    leading ordinal prefixes ("2. Ambush" -> "ambush")."""
    text = (name or "").strip()
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
    return True


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
