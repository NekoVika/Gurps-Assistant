from __future__ import annotations

import json
import logging
import re
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# Story node kinds that get the rich, linkage-aware scope descriptor.
_STORY_TYPES = {"episode", "chapter", "encounter"}

# Prose fields scanned when looking for textual overlap with global arcs.
_STORY_PROSE_FIELDS = (
    "premise",
    "gmBrief",
    "objectives",
    "stakesAndAntagonists",
    "mainOutline",
    "branchingPath",
    "outcomes",
)

# Common words ignored when computing arc/scene keyword overlap so that
# generic vocabulary ("party", "player", "which") does not create false ties.
_STOPWORDS = {
    "about", "after", "again", "along", "among", "another", "around", "because",
    "before", "being", "between", "could", "district", "during", "every", "first",
    "found", "front", "given", "great", "group", "gurps", "having", "himself",
    "least", "level", "might", "never", "night", "other", "party", "place",
    "player", "players", "point", "quest", "reach", "scene", "seems", "shall",
    "should", "since", "small", "still", "their", "there", "these", "thing",
    "those", "three", "through", "toward", "under", "until", "using", "where",
    "which", "while", "whole", "world", "would", "years",
}

_KEYWORD_RE = re.compile(r"[a-z0-9]{5,}")

# Canonical virtual path to the campaign state file (CampaignFileService resolves
# the "Campaign/" prefix to whatever folder is the active campaign root).
_STATE_PATH = "Campaign/state.json"


class ScopeService:
    """Compute a semantic 'current scope' descriptor for the in-app GM AI.

    The chat pipeline already injects a CURRENT SCOPE block into the system
    prompt (see ContextService.build_system_prompt), but historically the only
    signal passed was the raw file path the GM was viewing. This service turns
    that path into a meaningful descriptor: what kind of entity is in focus, how
    it sits in the Episode -> Chapter -> Encounter hierarchy, and whether it is
    connected to the campaign-wide arcs recorded in state.json. That lets the
    model decide when to weave in global plot threads and when to keep a scene
    self-contained.

    The service depends only on a file provider exposing ``read_file(path)`` and
    ``get_registry()`` (the shape of CampaignFileService). The provider is
    injectable so the descriptor logic can be unit-tested without touching disk
    or app config.
    """

    def __init__(self, file_service: Any | None = None) -> None:
        if file_service is None:
            # Imported lazily so this module has no import-time dependency on the
            # FastAPI/app stack — keeps the descriptor logic cheap to import and test.
            from gurpsai.app.services.files import CampaignFileService

            file_service = CampaignFileService()
        self._files = file_service

    # -- public API ---------------------------------------------------------

    def describe(self, scope_path: str | None) -> str | None:
        """Return a scope descriptor string for the focused file, or None.

        Returns None when there is no path, the file cannot be read, or it is
        not a JSON entity — callers should fall back to any raw scope hint they
        already have so behaviour never regresses.
        """
        if not scope_path or not scope_path.strip():
            return None

        data = self._read_json(scope_path)
        if data is None:
            return None

        name = data.get("title") or data.get("name") or Path(scope_path).stem
        etype = self._classify(scope_path, data)

        if etype in _STORY_TYPES:
            return self._describe_story(scope_path, name, etype, data)
        return self._describe_entity(name, etype, data)

    # -- descriptors --------------------------------------------------------

    def _describe_entity(self, name: str, etype: str, data: dict) -> str:
        """Simple descriptor for non-story entities (character/location/faction)."""
        label = etype.capitalize()
        extra = ""
        if etype == "character":
            detail = data.get("role") or data.get("significance") or data.get("concept")
            if detail:
                extra = f" — {detail}"
        elif etype == "location":
            detail = data.get("type") or data.get("region")
            if detail:
                extra = f" — {detail}"
        elif etype == "faction":
            detail = data.get("type")
            if detail:
                extra = f" — {detail}"

        return (
            f'FOCUS SCOPE: {label} "{name}"{extra}.\n'
            f"The GM is currently focused on this {etype}. Keep suggestions and edits "
            f"centered on it. Only pull in campaign-wide arcs from state.json if they are "
            f"directly relevant to this {etype}."
        )

    def _describe_story(self, scope_path: str, name: str, etype: str, data: dict) -> str:
        """Rich, linkage-aware descriptor for Episode/Chapter/Encounter nodes."""
        label = etype.capitalize()
        status = data.get("status") or "unspecified"

        children = self._as_name_list(data.get("childLinks"))
        registry_names = self._registry_names()
        unresolved_children = [c for c in children if c not in registry_names]

        parents = self._find_parents(name, scope_path)
        arcs = self._global_arcs()
        ties = self._possible_arc_ties(data, arcs)

        lines: list[str] = [f'FOCUS SCOPE: {label} "{name}" (status: {status}).']

        if parents:
            lines.append(f"Parent: {', '.join(parents)}.")
        else:
            lines.append(
                "Parent: none found — this appears to be a top-level or standalone node."
            )

        if children:
            child_line = f"Child links ({len(children)}): {', '.join(children)}"
            if unresolved_children:
                child_line += (
                    f" — NOT YET CREATED: {', '.join(unresolved_children)} "
                    "(treat these as proposed, not existing files)"
                )
            lines.append(child_line + ".")
        else:
            lines.append("Child links: none.")

        if arcs:
            lines.append("Global campaign arcs (state.json): " + "; ".join(arcs) + ".")
            if ties:
                lines.append(
                    "Possible ties to global arcs (keyword overlap — verify before relying on it): "
                    + "; ".join(ties)
                    + "."
                )
            else:
                lines.append(
                    "This node shows no textual overlap with the global arcs above — "
                    "treat it as LOCAL / standalone."
                )
        else:
            lines.append("No global arcs are recorded in state.json.")

        if ties:
            lines.append(
                f"GUIDANCE: This {etype} may connect to the arc(s) noted above. You may develop "
                "those threads where they fit, but stay anchored to this node's own premise, "
                "stakes, and objectives — do not import unrelated global lore."
            )
        else:
            lines.append(
                f"GUIDANCE: Treat this {etype} as self-contained. Do NOT weave the global arcs "
                "into it unless the GM explicitly asks; keep the focus on its own premise, "
                "stakes, and PC hooks."
            )

        return "\n".join(lines)

    # -- helpers ------------------------------------------------------------

    def _read_json(self, path: str) -> dict | None:
        try:
            file_content = self._files.read_file(path)
        except Exception:
            return None
        # Support both a FileContent-like object (.content) and a raw string.
        content = getattr(file_content, "content", file_content)
        try:
            obj = json.loads(content)
        except (json.JSONDecodeError, TypeError):
            return None
        return obj if isinstance(obj, dict) else None

    def _classify(self, path: str, data: dict) -> str:
        """Determine the entity kind from its declared 'type' and its path."""
        declared = str(data.get("type", "")).strip().lower()
        if declared in _STORY_TYPES:
            return declared

        p = path.lower()
        if "02_characters" in p or "bestiary" in p:
            return "character"
        if "location" in p:
            return "location"
        if "faction" in p:
            return "faction"
        if any(tok in p for tok in ("03_story", "episode", "chapter", "encounter", "session")):
            if "episode" in p:
                return "episode"
            if "encounter" in p:
                return "encounter"
            if "chapter" in p:
                return "chapter"
            return "chapter"

        return declared or "entity"

    def _as_name_list(self, value: Any) -> list[str]:
        """Normalize a childLinks-style field (list, or delimited string) to names."""
        if isinstance(value, list):
            return [str(x).strip() for x in value if str(x).strip()]
        if isinstance(value, str) and value.strip():
            return [p.strip() for p in value.replace("\n", ",").split(",") if p.strip()]
        return []

    def _registry(self) -> list[dict]:
        try:
            return self._files.get_registry() or []
        except Exception:
            return []

    def _registry_names(self) -> set[str]:
        names: set[str] = set()
        for item in self._registry():
            if item.get("title"):
                names.add(item["title"])
            if item.get("id"):
                names.add(item["id"])
        return names

    def _find_parents(self, name: str, self_path: str) -> list[str]:
        """Find entities whose childLinks reference this node (its parents)."""
        parents: list[str] = []
        for item in self._registry():
            rpath = item.get("path")
            if not rpath or rpath == self_path:
                continue
            data = self._read_json(rpath)
            if not data:
                continue
            if name in self._as_name_list(data.get("childLinks")):
                parents.append(item.get("title") or item.get("id") or rpath)
        return parents

    def _global_arcs(self) -> list[str]:
        data = self._read_json(_STATE_PATH)
        if not data:
            return []
        arcs: list[str] = []
        for key in ("activeQuests", "openThreads"):
            value = data.get(key)
            if isinstance(value, list):
                arcs.extend(str(x).strip() for x in value if str(x).strip())
            elif isinstance(value, str) and value.strip():
                arcs.append(value.strip())
        return arcs

    def _possible_arc_ties(self, data: dict, arcs: list[str]) -> list[str]:
        """Report arcs that share salient keywords with this node's prose."""
        if not arcs:
            return []
        blob = " ".join(str(data.get(field, "")) for field in _STORY_PROSE_FIELDS).lower()
        blob_words = set(_KEYWORD_RE.findall(blob))
        if not blob_words:
            return []

        ties: list[str] = []
        for arc in arcs:
            arc_words = {w for w in _KEYWORD_RE.findall(arc.lower()) if w not in _STOPWORDS}
            overlap = arc_words & blob_words
            if overlap:
                ties.append(f'"{arc}" (via {", ".join(sorted(overlap))})')
        return ties
