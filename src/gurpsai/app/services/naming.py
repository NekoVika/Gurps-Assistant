"""Names that say nothing.

A bare category word plus a number -- "Chapter 01", "NPC 2" -- is not a name.
It says what kind of thing this is and nothing about which one, so it collides
with every other entity given the same non-name. The story tree needs child
names to be unique across the whole campaign, or one episode's chapter ends up
parented to another's and inherits the wrong fixtures. That already happened
once. A real title costs one phrase and never collides: "Chapter 01: Descent
into Filth" is fine; "Chapter 01" is not.

Checked at creation, where a bad name costs a retype, rather than surfaced
later as a structural fault.
"""
from __future__ import annotations

import re

from gurpsai.app.services.link_resolver import link_text

_CATEGORY = (
    r"(?:chapter|episode|encounter|scene|session|arc|npc|character|char|"
    r"location|place|faction|item|new|untitled|unnamed|test|temp|tmp|draft|stub)"
)
# Any run of category words, then only digits and separators. Must consume the
# whole string, so "Chapter 01: Descent into Filth" and "Test Episode Sewers"
# fall through -- they carry words that are not categories.
_GENERIC = re.compile(rf"^\s*(?:{_CATEGORY}[\s_.-]*)+[\d\s._-]*$", re.IGNORECASE)
_ONLY_NUMBER = re.compile(r"^[\d\s._-]+$")


def generic_name_problem(name: object) -> str | None:
    """A sentence saying why this cannot be a name, or None when it can."""
    raw = name.strip() if isinstance(name, str) else ""
    if not raw:
        return "Give it a name."
    # A migrated reference is a link, not a name. Unwrap before judging, so
    # "[The Shoals](../x.md)" is accepted as "The Shoals" rather than sanitised
    # into a filename made of its punctuation.
    text = link_text(raw)
    if not text:
        return "Give it a name."
    if _ONLY_NUMBER.match(text):
        return f"“{text}” is just a number. Say what it is — a name never collides, a number always does."
    # A path fragment reaching this far means an unwrap failed upstream.
    if "/" in text or "\\" in text or text.lower().endswith((".md", ".json")):
        return f"“{text[:60]}” looks like a file path, not a name."
    if _GENERIC.match(text):
        return (
            f"“{text}” is a category, not a name. Add what makes it this one — "
            f"“{text}: The Rat King's Lair”, not “{text}”."
        )
    return None


def is_generic_name(name: object) -> bool:
    return generic_name_problem(name) is not None
