"""Parse a book's own Trait Lists into a priced catalogue.

The Basic Set's index says, in as many words, that traits are deliberately not
listed there and points instead at the Trait Lists on pp.299-306. Those are
tables rather than prose: name, category, cost and page for every advantage,
disadvantage and modifier, and attribute, difficulty and defaults for every
skill. They are the book telling us what it contains and what it charges.

That makes them a far better catalogue source than the prose headings the
entity extractor reads. Heading extraction has to guess where a chapter starts
and what a cost looks like, and it misses whatever is priced as a range, a
table or "Variable" -- which is most of the traits a GM actually argues about.
The tables miss nothing, because the book wrote them to be complete.

Everything here is a pure function over lines of text, so it is tested without
a database. The command in `commands/traits.py` supplies the lines and stores
the result.
"""
from __future__ import annotations

import re

__all__ = [
    "RESET", "mend", "clean", "split_defaults", "classify_cost",
    "parse_traits", "parse_modifiers", "parse_skills", "suspect", "strip_specialisation",
]

#: Column 2 of the advantage and disadvantage tables: the attribute group.
CATEGORY = {"M", "P", "Soc", "M/P", "P/M", "M/Soc", "Soc/M", "P/Soc", "Soc/P", "M/P/Soc"}
#: An en dash in a column means "none of the above". Extraction loses the glyph.
DASH = {"-", "–", "—", "�", ""}
#: Column 3: exotic or supernatural, or a dash meaning mundane.
EXOTIC = {"X", "Sup", "X/Sup"} | DASH

ATTRIBUTE = {"DX", "IQ", "HT", "ST", "Will", "Per", "DX Varies", "IQ Varies", "Varies"}
DIFFICULTY = {"E", "A", "H", "VH", "Special"}

COST = re.compile(
    r"^(?:-?\d+(?:\.\d+)?(?:/level)?"      # 15, -15, 2/level
    r"|-?\d+ or -?\d+(?:/level)?"          # 5 or 10/level
    r"|-?\d+ to -?\d+"                     # -10 to -30
    r"|\*?Variable\*?)\*?$", re.I)
MODIFIER_VALUE = re.compile(r"^[+-]\d+%(?:/level)?$|^Variable$", re.I)
PAGE = re.compile(r"^\d{1,3}(?:\s*,\s*\d{1,3})*$")

HEADERS = {"Advantage", "Cost", "Page", "M/P/Soc X/Sup", "Skill",
           "Attr Diff", "Defaults", "Name", "Type", "Value"}

#: Running heads, and the paragraph of explanation above each table. Both used
#: to be swept into the first row's name: one advantage came out called
#: "M/P/Soc tells whether an advantage is mental, physical, or social. ... Detect".
FURNITURE = re.compile(
    r"^\d{0,3}\s*(TRAIT LISTS|ADVANTAGES|DISADVANTAGES|SKILLS|MODIFIERS)\s*\d{0,3}$", re.I)
PREAMBLE = re.compile(
    r"\b(tells whether|means it is|Difficulty is|do not always apply"
    r"|require specialization|is followed by)\b", re.I)

#: A default is a skill name carrying a penalty -- "Psychology-4", "(Cryptology)-5".
#: A trait name never contains one, so it marks where the name ended.
DEFAULT_START = re.compile(r"\s+(?=\(?[A-Z][\w'/ ()-]*?-\d)")
PENALTY = re.compile(r"[A-Za-z)]-\d")

#: Emitted in place of a line that must not join anything across it.
RESET = "\x00"

#: The book's two footnote markers, both carrying real meaning. A dagger on a
#: skill name means it requires specialisation; an asterisk on a disadvantage's
#: cost means the figure is for a self-control number of 12, and a sheet may
#: legitimately differ. Read as part of the name or the cost they would
#: mis-match 47 skills and wrongly flag 39 disadvantages.
DAGGER = "†"


def mend(text: str) -> str:
    """Repair what the PDF extraction lost from a name.

    A sentence ending inside a name means a preamble ran into it, so only what
    follows survives. A lost glyph after a digit was a degree sign; a trailing
    one was a footnote dagger. Anything else is left in place to be flagged.
    """
    text = re.split(r"(?<=[a-z0-9])\.\s+(?=[A-Z])", text)[-1]
    text = re.sub(r"(?<=\d)�", "°", text)
    return re.sub(r"�+\s*$", "", text).strip()


def clean(lines: list[str]) -> list[str]:
    """Drop running heads and table preambles, keeping any name they trail."""
    out: list[str] = []
    for line in lines:
        if FURNITURE.match(line):
            out.append(RESET)
        elif PREAMBLE.search(line):
            out.append(RESET)
            tail = line.rsplit(".", 1)[-1].strip()
            if tail and len(tail) < 40:
                out.append(tail)
        else:
            out.append(line)
    return out


def split_defaults(name: str) -> tuple[str, str]:
    """Separate a trait name from a defaults list that wrapped into it."""
    match = DEFAULT_START.search(name)
    if not match:
        return name, ""
    return name[:match.start()].strip(), name[match.end():].strip(" ,")


def strip_specialisation(name: str) -> tuple[str, bool]:
    """Take the dagger off a skill name and report that it was there.

    A sheet writes "Guns/TL8 (Pistol)", never "Guns/TL<dagger>", so leaving the
    marker in place would fail to match 47 skills. It is still worth keeping:
    a trait that requires specialisation but is written without one is a thing
    the checker can eventually mention.
    """
    cleaned = name.rstrip()
    if cleaned.endswith(DAGGER):
        return cleaned[:-1].strip(), True
    return name, False


def classify_cost(text: str) -> tuple[str, int | None]:
    """The shape of a printed cost, and its single value where it has one.

    Five shapes cover the Basic Set: a flat figure, a figure per level, a
    choice between figures, a range, and Variable. Variable is a value in its
    own right, not a parse failure -- an advisory checker has to be able to say
    "this one depends" instead of guessing.
    """
    raw = (text or "").strip().rstrip("*")
    if not raw:
        return "unknown", None
    if raw.lower() == "variable":
        return "variable", None
    if " to " in raw:
        return "range", None
    if " or " in raw:
        return "choice", None
    if "/level" in raw:
        head = raw.split("/level")[0].strip()
        return "per_level", int(head) if re.fullmatch(r"-?\d+", head) else None
    if re.fullmatch(r"-?\d+", raw):
        return "flat", int(raw)
    return "unknown", None


def parse_traits(lines: list[str], kind: str) -> list[dict]:
    """Advantages and disadvantages: name / category / exotic / cost / page."""
    rows: list[dict] = []
    pending: list[str] = []
    i = 0
    while i < len(lines):
        line = lines[i]
        complete = (
            line in CATEGORY
            and i + 3 < len(lines)
            and lines[i + 1] in EXOTIC
            and COST.match(lines[i + 2])
            and PAGE.match(lines[i + 3])
            and pending
        )
        if complete:
            cost_kind, cost_value = classify_cost(lines[i + 2])
            cost_text = lines[i + 2]
            rows.append({
                "name": mend(" ".join(pending)),
                "kind": kind,
                "category": line,
                "exotic": lines[i + 1] not in DASH,
                "self_control": cost_text.rstrip().endswith("*"),
                "cost_text": cost_text,
                "cost_kind": cost_kind,
                "cost_value": cost_value,
                "page": int(lines[i + 3].split(",")[0]),
            })
            pending, i = [], i + 4
            continue
        if line == RESET or PAGE.match(line):
            pending = []
        elif line not in HEADERS:
            pending.append(line)
        i += 1
    return rows


def parse_modifiers(lines: list[str]) -> list[dict]:
    """Enhancements and limitations: name / type / value / page."""
    rows: list[dict] = []
    pending: list[str] = []
    i = 0
    while i < len(lines):
        line = lines[i]
        complete = (
            line in ({"A", "B"} | DASH)
            and i + 2 < len(lines)
            and MODIFIER_VALUE.match(lines[i + 1])
            and PAGE.match(lines[i + 2])
            and pending
        )
        if complete:
            rows.append({
                "name": mend(" ".join(pending)),
                "kind": "modifier",
                "category": line if line not in DASH else "",
                "cost_text": lines[i + 1],
                "cost_kind": "percent",
                "cost_value": None,
                "page": int(lines[i + 2].split(",")[0]),
            })
            pending, i = [], i + 3
            continue
        if line == RESET or PAGE.match(line):
            pending = []
        elif line not in HEADERS:
            pending.append(line)
        i += 1
    return rows


def parse_skills(lines: list[str]) -> list[dict]:
    """Skills: name / attribute / difficulty / defaults / page.

    The column layout wraps in three different ways, and all three had to be
    handled before the names came out usable:

    * the page can be glued to the end of the defaults cell;
    * the attribute can be glued to the end of the name cell;
    * a name too long for its column continues on a line *after* that row's
      page, so "Computer / IQ / E / IQ-4 / 184 / Operation/TL" is one skill
      called "Computer Operation/TL".

    The last of those is why anything accumulating ahead of a row gets handed
    back to the row above -- unless it carries a penalty, in which case it is
    that row's defaults rather than the tail of its name.
    """
    rows: list[dict] = []
    pending: list[str] = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if line == RESET:
            pending, i = [], i + 1
            continue
        if line in HEADERS:
            i += 1
            continue

        attr, remainder = None, line
        if line in ATTRIBUTE:
            attr = line
        else:
            head, _, tail = line.rpartition(" ")
            if head and tail in ATTRIBUTE:
                attr, remainder = tail, head
        starts_row = (
            attr is not None and pending
            and i + 1 < len(lines) and lines[i + 1] in DIFFICULTY
        )
        if not starts_row:
            pending.append(line)
            i += 1
            continue
        if remainder is not line:
            pending.append(remainder)

        carried = " ".join(pending[:-1]) if len(pending) > 1 and rows else ""
        name = pending[-1]
        difficulty = lines[i + 1]

        j, defaults, page = i + 2, [], None
        while j < len(lines) and page is None:
            cell = lines[j]
            if cell == RESET:
                j += 1
                break
            if PAGE.match(cell):
                page = int(cell.split(",")[0])
                j += 1
                break
            trailing = re.search(r"\s(\d{2,3})$", cell)
            if trailing:
                defaults.append(cell[:trailing.start()].strip())
                page = int(trailing.group(1))
                j += 1
                break
            defaults.append(cell)
            j += 1
            if len(defaults) > 3:
                break
        if page is None:
            pending, i = [], j
            continue

        name, spilled = split_defaults(mend(name))
        name, specialised = strip_specialisation(name)
        if carried and rows:
            if PENALTY.search(carried):
                rows[-1]["defaults"] = (rows[-1].get("defaults", "") + " " + carried).strip(" ,")
            else:
                # The row above is only finished now, so its marker is only
                # readable now -- "Hazardous Materials" + "/TL<dagger>".
                joined, was_specialised = strip_specialisation(
                    mend(rows[-1]["name"] + " " + carried))
                rows[-1]["name"] = joined
                rows[-1]["specialised"] = rows[-1].get("specialised") or was_specialised
        rows.append({
            "name": name,
            "kind": "skill",
            "category": "",
            "specialised": specialised,
            "attr": attr,
            "difficulty": difficulty,
            "defaults": ", ".join([d for d in ([spilled] if spilled else []) + defaults if d]).strip(", "),
            "cost_text": "",
            "cost_kind": "formula",   # a skill's cost comes from difficulty and level
            "cost_value": None,
            "page": page,
        })
        pending, i = [], j
    return rows


#: A name that still looks like table wreckage. Reported rather than discarded,
#: because a row we are unsure of is worth a human eye and silence is worse.
DEFAULT_IN_NAME = re.compile(r"\b(?:DX|IQ|HT|ST|Will|Per)\s*-\s*\d|[A-Za-z)]-\d")


def suspect(row: dict) -> list[str]:
    """Why this row needs a human, or an empty list if it looks right."""
    reasons: list[str] = []
    name = row.get("name") or ""
    if len(name) < 2:
        reasons.append("empty name")
    if len(name) > 40:
        reasons.append("name unusually long")
    if DEFAULT_IN_NAME.search(name):
        reasons.append("a default leaked into the name")
    if re.search(r"\s\d{2,3}\b", name):
        reasons.append("a page number leaked into the name")
    if "�" in name:
        reasons.append("lost glyph")
    if re.search(r"TRAIT LISTS", name, re.I):
        reasons.append("page furniture in the name")
    if row.get("kind") in ("advantage", "disadvantage") and not row.get("cost_text"):
        reasons.append("no cost")
    return reasons
