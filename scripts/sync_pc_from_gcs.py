from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Iterator


@dataclass(frozen=True)
class GcsAttributeLine:
    label: str
    value: str
    points: str | None


@dataclass(frozen=True)
class GcsTrait:
    name: str
    points: int | None
    notes: str | None = None
    trait_type: str | None = None


@dataclass(frozen=True)
class GcsSkill:
    name: str
    level: int | None
    relative: str | None
    points: int | None
    attr: str | None = None
    difficulty: str | None = None


@dataclass(frozen=True)
class GcsEquipmentItem:
    name: str
    weight: str | None
    cost: str | None
    count: str | None = None


NOTE_BEGIN_RE = re.compile(
    r"^\s*<!--\s*GURPSAI:BEGIN NOTE:(ADV|DIS|SKILL):([A-Za-z0-9_\-]+)\s*-->\s*$"
)
NOTE_END_RE = re.compile(
    r"^\s*<!--\s*GURPSAI:END NOTE:(ADV|DIS|SKILL):([A-Za-z0-9_\-]+)\s*-->\s*$"
)


def _is_scalar(x: Any) -> bool:
    return x is None or isinstance(x, (str, int, float, bool))


def _walk(obj: Any) -> Iterator[Any]:
    yield obj
    if isinstance(obj, dict):
        for v in obj.values():
            yield from _walk(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from _walk(v)


def _walk_dicts(obj: Any) -> Iterator[dict[str, Any]]:
    for node in _walk(obj):
        if isinstance(node, dict):
            yield node


def _walk_keyed_lists(obj: Any, keys: tuple[str, ...]) -> Iterator[list[Any]]:
    for d in _walk_dicts(obj):
        for k in keys:
            v = d.get(k)
            if isinstance(v, list) and v:
                yield v


def _get_int_like(value: Any) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float) and value.is_integer():
        return int(value)
    if isinstance(value, str):
        m = re.fullmatch(r"\s*([+-]?\d+)\s*", value)
        if m:
            try:
                return int(m.group(1))
            except ValueError:
                return None
    return None


def _get_number_like(value: Any) -> float | int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return value
    if isinstance(value, str):
        s = value.strip()
        if not s:
            return None
        try:
            if "." in s:
                return float(s)
            return int(s)
        except ValueError:
            return None
    return None


def _first_str(d: dict[str, Any], keys: Iterable[str]) -> str | None:
    for k in keys:
        v = d.get(k)
        if isinstance(v, str) and v.strip():
            return v.strip()
    return None


def _first_number(d: dict[str, Any], keys: Iterable[str]) -> float | int | None:
    for k in keys:
        v = _get_number_like(d.get(k))
        if v is not None:
            return v
    return None


def _flatten_entries(obj: Any) -> Iterator[dict[str, Any]]:
    """
    Heuristic flattener: yields dicts that look like leaf entries (traits, skills, equipment).
    Supports common container keys used by various JSON exports.
    """
    stack = [obj]
    seen: set[int] = set()
    child_keys = ("children", "items", "entries", "list", "rows", "components")

    while stack:
        node = stack.pop()
        if id(node) in seen:
            continue
        seen.add(id(node))

        if isinstance(node, dict):
            for k in child_keys:
                v = node.get(k)
                if isinstance(v, list):
                    stack.extend(reversed(v))
            yield node
        elif isinstance(node, list):
            stack.extend(reversed(node))


def _score_list_for_entries(lst: list[Any], required_keys: tuple[str, ...]) -> int:
    score = 0
    for item in lst:
        if isinstance(item, dict) and all(k in item for k in required_keys):
            score += 1
    return score


def _pick_best_list(obj: Any, keys: tuple[str, ...], required_keys: tuple[str, ...]) -> list[Any] | None:
    best: list[Any] | None = None
    best_score = 0
    for lst in _walk_keyed_lists(obj, keys):
        score = _score_list_for_entries(lst, required_keys)
        if score > best_score:
            best, best_score = lst, score
    return best


def _extract_name(gcs: dict[str, Any]) -> str | None:
    profile = gcs.get("profile")
    if isinstance(profile, dict):
        name = _first_str(profile, ("name", "character_name", "full_name"))
        if name:
            return name
    for k in ("name", "character_name", "full_name"):
        v = gcs.get(k)
        if isinstance(v, str) and v.strip():
            return v.strip()
    return None


def _extract_point_total(gcs: dict[str, Any]) -> int | None:
    candidates: list[int] = []
    direct_keys = (
        "total_points",
        "points_total",
        "point_total",
        "character_points",
        "totalPoints",
        "points",
    )
    for k in direct_keys:
        v = _get_int_like(gcs.get(k))
        if v is not None:
            candidates.append(v)

    profile = gcs.get("profile")
    if isinstance(profile, dict):
        for k in ("total_points", "points_total", "point_total", "points"):
            v = _get_int_like(profile.get(k))
            if v is not None:
                candidates.append(v)

    # Heuristic: prefer a plausible total (>= 0) and the max (often totals are larger than sub-costs).
    candidates = [c for c in candidates if c >= 0]
    if candidates:
        return max(candidates)
    return None


def _canonical_attr_key(raw: str) -> str | None:
    s = raw.strip().lower().replace(" ", "_")
    mapping = {
        "st": "ST",
        "strength": "ST",
        "dx": "DX",
        "dexterity": "DX",
        "iq": "IQ",
        "intelligence": "IQ",
        "ht": "HT",
        "health": "HT",
        "hp": "HP",
        "hit_points": "HP",
        "will": "Will",
        "per": "Per",
        "perception": "Per",
        "fp": "FP",
        "fatigue_points": "FP",
        "basic_speed": "Basic Speed",
        "speed": "Basic Speed",
        "basic_move": "Basic Move",
        "move": "Basic Move",
    }
    return mapping.get(s)


def _extract_attributes(gcs: dict[str, Any]) -> dict[str, GcsAttributeLine]:
    """
    Best-effort extraction of attributes with optional point costs.
    Returns canonical labels like ST, DX, IQ, HT, Will, Per, HP, FP, Basic Speed, Basic Move.
    """
    out: dict[str, GcsAttributeLine] = {}

    attr_container: Any = None
    for key in ("attributes", "stats"):
        v = gcs.get(key)
        if isinstance(v, (dict, list)):
            attr_container = v
            break

    candidates: list[dict[str, Any]] = []
    # GCS v5 commonly stores attributes as a list of {attr_id, calc:{value,points}}.
    if isinstance(attr_container, list):
        for item in attr_container:
            if isinstance(item, dict):
                # Handle v5 structure early.
                attr_id = item.get("attr_id")
                calc = item.get("calc")
                if isinstance(attr_id, str) and isinstance(calc, dict):
                    canon = _canonical_attr_key(attr_id)
                    if canon and canon not in out:
                        value = _get_number_like(calc.get("value"))
                        points = _get_number_like(calc.get("points"))
                        if value is not None:
                            points_str = None
                            if points is not None:
                                points_str = str(int(points) if float(points).is_integer() else points)
                            out[canon] = GcsAttributeLine(label=canon, value=str(value), points=points_str)
                            continue
                candidates.append(item)
    elif isinstance(attr_container, dict):
        candidates.append(attr_container)

    # Also consider any dict in the tree with obvious attribute keys.
    for d in _walk_dicts(gcs):
        keys = {k.strip().lower() for k in d.keys() if isinstance(k, str)}
        if {"st", "dx", "iq", "ht"} <= keys:
            candidates.append(d)

    def read_attr_from_dict(d: dict[str, Any], raw_key: str) -> GcsAttributeLine | None:
        label = _canonical_attr_key(raw_key)
        if not label:
            return None
        v = d.get(raw_key)
        if isinstance(v, (int, float, str)):
            num = _get_number_like(v)
            if num is None:
                return None
            return GcsAttributeLine(label=label, value=str(num), points=None)
        if isinstance(v, dict):
            value = _first_number(v, ("value", "score", "current", "level", "final", "adj", "total", "base"))
            if value is None:
                return None
            points = _first_number(v, ("points", "cost", "spent", "point_cost"))
            points_str = None if points is None else str(int(points) if float(points).is_integer() else points)
            return GcsAttributeLine(label=label, value=str(value), points=points_str)
        return None

    # First pass: look for direct keys in candidate dicts.
    for d in candidates:
        for raw_key in list(d.keys()):
            if not isinstance(raw_key, str):
                continue
            canon = _canonical_attr_key(raw_key)
            if not canon or canon in out:
                continue
            line = read_attr_from_dict(d, raw_key)
            if line:
                out[canon] = line

    # Second pass: list-based entries like {"name":"ST","value":11,"points":10}
    for d in candidates:
        name = _first_str(d, ("name", "abbr", "attribute", "stat"))
        canon = _canonical_attr_key(name) if name else None
        if canon and canon not in out:
            value = _first_number(d, ("value", "score", "level", "current"))
            if value is not None:
                points = _first_number(d, ("points", "cost", "spent", "point_cost"))
                points_str = None if points is None else str(int(points) if float(points).is_integer() else points)
                out[canon] = GcsAttributeLine(label=canon, value=str(value), points=points_str)

    return out


def _is_traitish(d: dict[str, Any]) -> bool:
    name = d.get("name")
    if not isinstance(name, str) or not name.strip():
        return False
    for k in ("points", "cost", "point_cost", "value"):
        if k in d and _get_number_like(d.get(k)) is not None:
            return True
    calc = d.get("calc")
    if isinstance(calc, dict) and _get_number_like(calc.get("points")) is not None:
        return True
    # Container entries (like ADV/DISADV) still count as traitish to reach children.
    children = d.get("children")
    if isinstance(children, list) and any(isinstance(c, dict) and isinstance(c.get("name"), str) for c in children):
        return True
    # Some exports store points elsewhere; still accept if has explicit type
    t = d.get("type")
    return isinstance(t, str) and t.strip().lower() in {"advantage", "disadvantage", "perk", "quirk", "trait"}


def _extract_traits(gcs: dict[str, Any]) -> list[GcsTrait]:
    # Prefer obvious lists if present.
    lst = _pick_best_list(gcs, keys=("traits", "advantages", "disadvantages"), required_keys=("name",))
    candidates: list[dict[str, Any]] = []

    if lst is not None:
        for item in _flatten_entries(lst):
            if _is_traitish(item):
                candidates.append(item)
    else:
        for d in _flatten_entries(gcs):
            if _is_traitish(d):
                candidates.append(d)

    traits: list[GcsTrait] = []
    seen = set()
    for d in candidates:
        name = str(d.get("name", "")).strip()
        if not name or name in seen:
            continue
        if "@" in name:
            continue

        # Skip common container rows used by GCS v5 exports.
        if name in {"ADV", "DISADV"} and isinstance(d.get("children"), list):
            continue

        seen.add(name)

        points = None
        for k in ("points", "cost", "point_cost", "value"):
            v = _get_int_like(d.get(k))
            if v is not None:
                points = v
                break
        if points is None and isinstance(d.get("calc"), dict):
            points = _get_int_like(d["calc"].get("points"))

        notes = _first_str(d, ("notes", "note", "local_notes", "description", "text"))
        trait_type = _first_str(d, ("type", "kind", "trait_type", "category"))
        traits.append(GcsTrait(name=name, points=points, notes=notes, trait_type=trait_type))

    return traits


def _is_skillish(d: dict[str, Any]) -> bool:
    name = d.get("name")
    if not isinstance(name, str) or not name.strip():
        return False
    if any(k in d for k in ("level", "relative_level", "points", "difficulty")):
        return True
    calc = d.get("calc")
    if isinstance(calc, dict) and any(k in calc for k in ("level", "rsl")):
        return True
    t = d.get("type")
    return isinstance(t, str) and t.strip().lower() == "skill"


def _extract_skills(gcs: dict[str, Any]) -> list[GcsSkill]:
    lst = _pick_best_list(gcs, keys=("skills", "skill_list"), required_keys=("name",))
    candidates: list[dict[str, Any]] = []

    if lst is not None:
        for item in _flatten_entries(lst):
            if _is_skillish(item):
                candidates.append(item)
    else:
        for d in _flatten_entries(gcs):
            if _is_skillish(d):
                candidates.append(d)

    skills: list[GcsSkill] = []
    seen = set()
    for d in candidates:
        name = str(d.get("name", "")).strip()
        if not name or name in seen:
            continue
        if "@" in name:
            continue
        seen.add(name)

        level = _get_int_like(d.get("level"))
        relative = _first_str(d, ("relative_level", "relative", "rsl", "rel"))
        if (level is None or relative is None) and isinstance(d.get("calc"), dict):
            calc = d["calc"]
            if level is None:
                level = _get_int_like(calc.get("level"))
            if relative is None:
                relative = _first_str(calc, ("rsl", "relative_level", "relative"))
        points = None
        for k in ("points", "spent", "point_cost", "cost"):
            v = _get_int_like(d.get(k))
            if v is not None:
                points = v
                break

        attr = _first_str(d, ("attribute", "attr", "based_on"))
        difficulty = _first_str(d, ("difficulty", "diff"))
        # GCS v5 uses "iq/a" style; infer attribute/difficulty if explicit attr not present.
        if difficulty and not attr:
            m = re.fullmatch(r"\s*([a-z]{2,3})\s*/\s*([a-z])\s*", difficulty.strip().lower())
            if m:
                attr = m.group(1).upper()
                difficulty = m.group(2).upper()
        specialization = _first_str(d, ("specialization", "spec"))
        if specialization and specialization not in name:
            name = f"{name} ({specialization})"
        skills.append(
            GcsSkill(
                name=name,
                level=level,
                relative=relative,
                points=points,
                attr=attr,
                difficulty=difficulty,
            )
        )

    return skills


def _is_equipmentish(d: dict[str, Any]) -> bool:
    name = d.get("name")
    desc = d.get("description")
    if not ((isinstance(name, str) and name.strip()) or (isinstance(desc, str) and desc.strip())):
        return False
    if any(k in d for k in ("weight", "cost", "value", "count", "qty", "quantity", "base_weight", "base_value")):
        return True
    calc = d.get("calc")
    if isinstance(calc, dict) and any(k in calc for k in ("weight", "extended_weight", "value")):
        return True
    t = d.get("type")
    return isinstance(t, str) and t.strip().lower() in {"equipment", "item", "gear"}


def _extract_equipment(gcs: dict[str, Any]) -> list[GcsEquipmentItem]:
    lst = _pick_best_list(gcs, keys=("equipment", "gear", "inventory", "items"), required_keys=("name",))
    if lst is None:
        lst = _pick_best_list(gcs, keys=("equipment", "gear", "inventory", "items"), required_keys=("description",))
    candidates: list[dict[str, Any]] = []

    if lst is not None:
        for item in _flatten_entries(lst):
            if _is_equipmentish(item):
                candidates.append(item)
    else:
        for d in _flatten_entries(gcs):
            if _is_equipmentish(d):
                candidates.append(d)

    equipment: list[GcsEquipmentItem] = []
    seen = set()
    for d in candidates:
        raw_name = _first_str(d, ("name", "description", "title"))
        name = (raw_name or "").strip()
        if not name or name in seen:
            continue
        if "@" in name:
            continue
        seen.add(name)

        weight = _first_str(d, ("weight", "wt", "base_weight"))
        cost = _first_str(d, ("cost", "value", "price", "base_value"))
        count: str | None = None
        for k in ("count", "qty", "quantity"):
            v = d.get(k)
            if isinstance(v, str) and v.strip():
                count = v.strip()
                break
            n = _get_int_like(v)
            if n is not None:
                count = str(n)
                break
        count_n = _get_int_like(count) if count is not None else None

        if isinstance(d.get("calc"), dict):
            calc = d["calc"]
            weight = weight or _first_str(calc, ("weight", "extended_weight"))
            val = calc.get("value")
            ext_val = calc.get("extended_value")
            ext_wt = calc.get("extended_weight")
            if count_n is not None and count_n > 1:
                if isinstance(ext_val, (int, float)):
                    cost = f"${int(ext_val) if float(ext_val).is_integer() else ext_val}"
                if isinstance(ext_wt, str) and ext_wt.strip():
                    weight = ext_wt.strip()
            if cost is None:
                if isinstance(val, (int, float)):
                    cost = f"${int(val) if float(val).is_integer() else val}"
                elif isinstance(val, str) and val.strip():
                    cost = val.strip()

        # Normalize numeric base_value into $NN.
        if cost is not None:
            n = _get_number_like(cost)
            if n is not None and not str(cost).strip().startswith("$"):
                cost = f"${int(n) if float(n).is_integer() else n}"

        equipment.append(GcsEquipmentItem(name=name, weight=weight, cost=cost, count=count))

    return equipment


def _slugify_filename(name: str) -> str:
    s = name.strip()
    s = re.sub(r"\s+", "_", s)
    s = re.sub(r"[^A-Za-z0-9_\-]", "", s)
    return s or "PC"


def _note_id_for(name: str) -> str:
    return _slugify_filename(name)


def _extract_generated_block_span(lines: list[str], block_id: str) -> tuple[int, int] | None:
    begin = f"<!-- GURPSAI:BEGIN GCS:{block_id} -->"
    end = f"<!-- GURPSAI:END GCS:{block_id} -->"
    begin_idx = None
    for i, line in enumerate(lines):
        if line.strip() == begin:
            begin_idx = i
            break
    if begin_idx is None:
        return None
    for j in range(begin_idx + 1, len(lines)):
        if lines[j].strip() == end:
            return begin_idx, j
    return None


def _extract_item_continuations_from_block(
    lines: list[str],
    *,
    begin_idx: int,
    end_idx: int,
    kind: str,
) -> dict[str, list[str]]:
    """
    Extracts per-item nested note lines under list items inside a generated block.

    Notes are any lines that follow an item bullet and are indented by 4 spaces.
    Legacy NOTE comment blocks are also supported and will be converted into the
    same nested lines (with the comment markers removed).
    """
    item_re = re.compile(r"^\*\s{3}\*\*(?P<name>.+?)\*\*")
    continuations: dict[str, list[str]] = {}

    current_item: str | None = None
    in_legacy_note = False
    legacy_note_id: str | None = None

    i = begin_idx + 1
    while i < end_idx:
        line = lines[i]

        m_item = item_re.match(line)
        if m_item:
            current_item = m_item.group("name").strip()
            continuations.setdefault(current_item, [])
            in_legacy_note = False
            legacy_note_id = None
            i += 1
            continue

        if current_item is None:
            i += 1
            continue

        # Legacy NOTE blocks (noisy HTML comments) -> preserve content only.
        m_begin = NOTE_BEGIN_RE.match(line)
        if m_begin:
            note_kind, note_id = m_begin.group(1), m_begin.group(2)
            if note_kind == kind and note_id == _note_id_for(current_item):
                in_legacy_note = True
                legacy_note_id = note_id
            i += 1
            continue

        m_end = NOTE_END_RE.match(line)
        if m_end:
            note_kind, note_id = m_end.group(1), m_end.group(2)
            if in_legacy_note and note_kind == kind and note_id == legacy_note_id:
                in_legacy_note = False
                legacy_note_id = None
            i += 1
            continue

        # Preserve nested note lines (preferred format) or legacy note content.
        if line.startswith("    "):
            continuations.setdefault(current_item, []).append(line)
            i += 1
            continue

        # Blank lines immediately under an item are OK; keep if already nested.
        if line.strip() == "":
            i += 1
            continue

        i += 1

    # Normalize: drop empty continuation arrays.
    return {k: v for k, v in continuations.items() if v}


def _fmt_attr_line(attr: GcsAttributeLine) -> str:
    if attr.points is None:
        return f"{attr.label} {attr.value}"
    return f"{attr.label} {attr.value} [{attr.points}]"


def _generate_attributes_block(attrs: dict[str, GcsAttributeLine]) -> list[str]:
    primary = ["ST", "DX", "IQ", "HT"]
    second = ["Will", "Per", "HP", "FP"]
    derived = ["Basic Speed", "Basic Move"]

    lines: list[str] = []

    prim_parts = [_fmt_attr_line(attrs[k]) for k in primary if k in attrs]
    if prim_parts:
        lines.append(f"*   {'; '.join(prim_parts)}")

    sec_parts = [_fmt_attr_line(attrs[k]) for k in second if k in attrs]
    if sec_parts:
        lines.append(f"*   {'; '.join(sec_parts)}")

    der_parts = [_fmt_attr_line(attrs[k]) for k in derived if k in attrs]
    if der_parts:
        lines.append(f"*   {'; '.join(der_parts)}")

    if not lines:
        lines.append("*   [TBD - unable to parse attributes from .gcs]")
    return lines


def _split_traits(traits: list[GcsTrait]) -> tuple[list[GcsTrait], list[GcsTrait]]:
    advantages: list[GcsTrait] = []
    disadvantages: list[GcsTrait] = []

    for t in traits:
        if t.points is None:
            # Unknown: treat as advantage-ish unless marked.
            tt = (t.trait_type or "").lower()
            if "disadv" in tt or "quirk" in tt:
                disadvantages.append(t)
            else:
                advantages.append(t)
            continue
        if t.points < 0:
            disadvantages.append(t)
        else:
            advantages.append(t)

    return advantages, disadvantages


def _generate_traits_block(
    traits: list[GcsTrait],
    placeholder: str,
    *,
    continuations_by_name: dict[str, list[str]],
) -> list[str]:
    if not traits:
        return [f"*   {placeholder}"]
    lines: list[str] = []
    for t in traits:
        pts = "" if t.points is None else f" [{t.points}]"
        lines.append(f"*   **{t.name}**{pts}")
        if t.name in continuations_by_name:
            # Preserve any nested notes under this item (AI or GM).
            lines.extend(continuations_by_name[t.name])
    return lines


def _generate_skills_block(
    skills: list[GcsSkill],
    *,
    continuations_by_name: dict[str, list[str]],
) -> list[str]:
    if not skills:
        return ["*   [TBD - unable to parse skills from .gcs]"]
    lines: list[str] = []
    for s in skills:
        parts: list[str] = []
        if s.attr and s.difficulty:
            parts.append(f"({s.attr}/{s.difficulty})")
        if s.level is not None:
            parts.append(f"-{s.level}")
        rel = ""
        if s.relative:
            rel = f" ({s.relative})"
        pts = "" if s.points is None else f" [{s.points}]"
        if parts:
            lines.append(f"*   **{s.name}** {' '.join(parts)}{rel}{pts}".rstrip())
        else:
            lvl = "" if s.level is None else f" {s.level}"
            lines.append(f"*   **{s.name}**{lvl}{rel}{pts}".rstrip())
        if s.name in continuations_by_name:
            lines.extend(continuations_by_name[s.name])
    return lines


def _generate_gear_block(items: list[GcsEquipmentItem]) -> list[str]:
    if not items:
        return ["*   [TBD - unable to parse equipment from .gcs]"]
    lines: list[str] = []
    for it in items:
        bits: list[str] = []
        if it.count:
            n = _get_int_like(it.count)
            if n is None or n != 1:
                bits.append(f"x{it.count}")
        if it.weight:
            bits.append(f"{it.weight}")
        if it.cost:
            bits.append(f"{it.cost}")
        suffix = "" if not bits else f" ({', '.join(bits)})"
        lines.append(f"*   **{it.name}**{suffix}")
    return lines


def _replace_or_insert_block_after_anchor(
    lines: list[str],
    anchor_re: re.Pattern[str],
    block_id: str,
    new_block_lines: list[str],
    *,
    within_start: int = 0,
    within_end: int | None = None,
) -> tuple[list[str], bool]:
    """
    Replaces a generated block delimited by markers if present, else replaces the
    legacy bullet-list block directly after the anchor (best-effort).
    """
    if within_end is None:
        within_end = len(lines)

    begin = f"<!-- GURPSAI:BEGIN GCS:{block_id} -->"
    end = f"<!-- GURPSAI:END GCS:{block_id} -->"

    # 1) Marker-based replacement.
    for i in range(within_start, within_end):
        if lines[i].strip() == begin:
            for j in range(i + 1, within_end):
                if lines[j].strip() == end:
                    return (
                        lines[: i + 1]
                        + new_block_lines
                        + lines[j:],
                        True,
                    )

    # 2) Anchor-based insertion/replacement.
    anchor_idx = None
    for i in range(within_start, within_end):
        if anchor_re.match(lines[i]):
            anchor_idx = i
            break
    if anchor_idx is None:
        return lines, False

    # Determine legacy block extent: contiguous bullet/blank lines immediately after anchor.
    start = anchor_idx + 1
    end_idx = start
    while end_idx < within_end:
        s = lines[end_idx]
        if s.strip() == "":
            end_idx += 1
            continue
        # Only treat Markdown list bullets as replaceable legacy content.
        # Do NOT match bold label lines like "**Skills:**".
        if re.match(r"^\s*\*\s+", s):
            end_idx += 1
            continue
        break

    replacement = [begin] + new_block_lines + [end]
    new_lines = lines[:start] + replacement + lines[end_idx:]
    return new_lines, True


def _find_section_bounds(lines: list[str], heading: str) -> tuple[int, int] | None:
    """
    Returns (start_idx, end_idx_exclusive) for a level-2 heading section.
    """
    heading_re = re.compile(rf"^##\s+{re.escape(heading)}\s*$")
    start = None
    for i, line in enumerate(lines):
        if heading_re.match(line):
            start = i
            break
    if start is None:
        return None
    end = len(lines)
    for j in range(start + 1, len(lines)):
        if re.match(r"^##\s+\S", lines[j]):
            end = j
            break
    return start, end


def _ensure_meta_lines(lines: list[str]) -> list[str]:
    required = {
        "Role": "**Role:** PC",
        "Location": "**Location:** [TBD]",
        "Status": "**Status:** Alive",
    }
    present = {k: False for k in required}
    for line in lines:
        for k in required:
            if re.match(rf"^\*\*{re.escape(k)}:\*\*", line):
                present[k] = True
    insert_at = 0
    for i, line in enumerate(lines):
        if line.startswith("# "):
            insert_at = i + 1
            break
    # Try to keep image line directly after title if present.
    if insert_at < len(lines) and re.match(r"^!\[.*\]\(.*\)\s*$", lines[insert_at].strip()):
        insert_at += 1
    to_add = [required[k] for k, ok in present.items() if not ok]
    if not to_add:
        return lines
    # Ensure a blank line separation.
    new_lines = lines[:insert_at]
    if new_lines and new_lines[-1].strip() != "":
        new_lines.append("")
    new_lines.extend(to_add)
    new_lines.append("")
    new_lines.extend(lines[insert_at:])
    return new_lines


def _ensure_headings(lines: list[str]) -> list[str]:
    needed = [
        "## Narrative & Roleplay",
        "## GURPS 4e Statistics",
        "## Gear & Weapons",
        "## Tactics & Combat Style",
        "## PC Hooks",
        "## GM Summary (Raw Archive)",
        "## Assumptions & Open Questions",
    ]
    present = {h: False for h in needed}
    for line in lines:
        if line.strip() in present:
            present[line.strip()] = True
    if all(present.values()):
        return lines

    # Append missing headings at end with placeholders.
    out = list(lines)
    if out and out[-1].strip() != "":
        out.append("")
    for h in needed:
        if present[h]:
            continue
        out.append(h)
        if h == "## Narrative & Roleplay":
            out.extend(
                [
                    "*   **Appearance:** [TBD]",
                    "*   **Backstory:** [TBD]",
                    "*   **Personality & Quirks:** [TBD]",
                    "",
                ]
            )
        elif h == "## GURPS 4e Statistics":
            out.extend(
                [
                    "",
                    "**Attributes:**",
                    "*   [TBD]",
                    "",
                    "**Advantages & Perks:**",
                    "*   [TBD]",
                    "",
                    "**Disadvantages & Quirks:**",
                    "*   [TBD]",
                    "",
                    "**Skills:**",
                    "*   [TBD]",
                    "",
                ]
            )
        elif h == "## GM Summary (Raw Archive)":
            out.extend(
                [
                    "",
                    "*Paste GM-provided notes/interview answers verbatim. Do not edit or \"clean up\" this section; it is the raw source of truth.*",
                    "",
                ]
            )
        elif h == "## Assumptions & Open Questions":
            out.extend(
                [
                    "",
                    "*   **Assumptions:** [TBD]",
                    "*   **Open Questions:** [TBD]",
                    "",
                ]
            )
        else:
            out.extend(["", "*   [TBD]", ""])
    return out


def _ensure_stats_sublabels(lines: list[str], section_bounds: tuple[int, int]) -> list[str]:
    """
    Ensures the canonical sublabels exist inside the statistics section, without
    aggressively reformatting existing GM notes.
    """
    start, end = section_bounds
    block = lines[start:end]
    required_labels = [
        "**Attributes:**",
        "**Advantages & Perks:**",
        "**Disadvantages & Quirks:**",
        "**Skills:**",
    ]
    present = {lbl: False for lbl in required_labels}
    for line in block:
        t = line.strip()
        if t in present:
            present[t] = True

    missing = [lbl for lbl, ok in present.items() if not ok]
    if not missing:
        return lines

    # Insert missing labels at the end of the stats section to avoid breaking
    # any existing hand-authored structure.
    insert_at = end
    insertion: list[str] = []
    if insert_at > 0 and lines[insert_at - 1].strip() != "":
        insertion.append("")
    for lbl in missing:
        insertion.append(lbl)
        insertion.append("")
        insertion.append("*   [TBD]")
        insertion.append("")

    return lines[:insert_at] + insertion + lines[insert_at:]


def _ensure_title_and_image(
    lines: list[str],
    *,
    name: str,
    point_total: int | None,
    image_slug: str,
) -> list[str]:
    slug = image_slug.strip() or _slugify_filename(name)

    title_idx = None
    for i, line in enumerate(lines):
        if line.startswith("# "):
            title_idx = i
            break
    if title_idx is None:
        title = f"# {name}" if point_total is None else f"# {name} ({point_total} pts)"
        lines = [title, f"![{slug}](./{slug}.png)", ""] + lines
    else:
        existing = lines[title_idx][2:].strip()
        # Preserve any concept suffix after " - " if present.
        concept = None
        if " - " in existing:
            concept = existing.split(" - ", 1)[1].strip()
        base = f"{name}" if point_total is None else f"{name} ({point_total} pts)"
        new_title = f"# {base}" if not concept else f"# {base} - {concept}"
        lines[title_idx] = new_title

        # Ensure an image line exists near top.
        has_img = any(re.match(r"^!\[.*\]\(.*\)\s*$", l.strip()) for l in lines[: min(len(lines), 25)])
        if not has_img:
            insert_at = title_idx + 1
            lines = lines[:insert_at] + [f"![{slug}](./{slug}.png)", ""] + lines[insert_at:]
    return lines


def sync_pc_markdown(
    *,
    gcs_path: Path,
    md_path: Path,
    sort_lists: bool,
) -> str:
    raw = gcs_path.read_bytes()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError as e:
        raise SystemExit(f"Unable to decode .gcs as UTF-8: {gcs_path.as_posix()} ({e})")

    try:
        gcs = json.loads(text)
    except json.JSONDecodeError as e:
        raise SystemExit(f"Unable to parse .gcs as JSON: {gcs_path.as_posix()} ({e})")

    if not isinstance(gcs, dict):
        raise SystemExit(f"Unsupported .gcs structure: expected JSON object at root: {gcs_path}")

    name = _extract_name(gcs) or gcs_path.stem
    point_total = _extract_point_total(gcs)
    attrs = _extract_attributes(gcs)
    traits = _extract_traits(gcs)
    skills = _extract_skills(gcs)
    gear = _extract_equipment(gcs)

    if sort_lists:
        traits = sorted(traits, key=lambda t: t.name.casefold())
        skills = sorted(skills, key=lambda s: s.name.casefold())
        gear = sorted(gear, key=lambda it: it.name.casefold())

    adv, dis = _split_traits(traits)

    if md_path.exists():
        try:
            text = md_path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            text = md_path.read_text(encoding="utf-8-sig")
        lines = text.splitlines()
    else:
        lines = []

    adv_cont: dict[str, list[str]] = {}
    dis_cont: dict[str, list[str]] = {}
    skill_cont: dict[str, list[str]] = {}

    adv_span = _extract_generated_block_span(lines, "ADVANTAGES")
    if adv_span:
        adv_cont = _extract_item_continuations_from_block(
            lines,
            begin_idx=adv_span[0],
            end_idx=adv_span[1],
            kind="ADV",
        )

    dis_span = _extract_generated_block_span(lines, "DISADVANTAGES")
    if dis_span:
        dis_cont = _extract_item_continuations_from_block(
            lines,
            begin_idx=dis_span[0],
            end_idx=dis_span[1],
            kind="DIS",
        )

    skills_span = _extract_generated_block_span(lines, "SKILLS")
    if skills_span:
        skill_cont = _extract_item_continuations_from_block(
            lines,
            begin_idx=skills_span[0],
            end_idx=skills_span[1],
            kind="SKILL",
        )

    attr_block = _generate_attributes_block(attrs)
    adv_block = _generate_traits_block(
        adv,
        placeholder="[TBD]",
        continuations_by_name=adv_cont,
    )
    dis_block = _generate_traits_block(
        dis,
        placeholder="[TBD]",
        continuations_by_name=dis_cont,
    )
    skills_block = _generate_skills_block(skills, continuations_by_name=skill_cont)
    gear_block = _generate_gear_block(gear)

    lines = _ensure_title_and_image(
        lines,
        name=name,
        point_total=point_total,
        image_slug=_slugify_filename(md_path.stem),
    )
    lines = _ensure_meta_lines(lines)
    lines = _ensure_headings(lines)

    label_to_block = [
        ("Attributes", "ATTRIBUTES", attr_block),
        ("Advantages & Perks", "ADVANTAGES", adv_block),
        ("Disadvantages & Quirks", "DISADVANTAGES", dis_block),
        ("Skills", "SKILLS", skills_block),
    ]

    # Replace blocks inside stats section (repeat a few times to converge if the
    # target file is missing some sublabels).
    for _pass in range(3):
        stats_bounds = _find_section_bounds(lines, "GURPS 4e Statistics")
        if stats_bounds is None:
            raise SystemExit(f"Missing required section after normalization: {md_path}")
        lines = _ensure_stats_sublabels(lines, stats_bounds)
        stats_bounds = _find_section_bounds(lines, "GURPS 4e Statistics")
        assert stats_bounds is not None

        s_start, s_end = stats_bounds
        within_start = s_start + 1
        within_end = s_end
        for label, block_id, new_block in label_to_block:
            anchor_re = re.compile(rf"^\*\*{re.escape(label)}:\*\*\s*$")
            lines, _ = _replace_or_insert_block_after_anchor(
                lines,
                anchor_re=anchor_re,
                block_id=block_id,
                new_block_lines=new_block,
                within_start=within_start,
                within_end=within_end,
            )
            stats_bounds = _find_section_bounds(lines, "GURPS 4e Statistics")
            assert stats_bounds is not None
            s_start, s_end = stats_bounds
            within_start, within_end = s_start + 1, s_end

        # Check if all labels exist now; if so, stop early.
        stats_bounds = _find_section_bounds(lines, "GURPS 4e Statistics")
        assert stats_bounds is not None
        s_start, s_end = stats_bounds
        stats_block = "\n".join(lines[s_start:s_end])
        if all(re.search(rf"(?m)^\*\*{re.escape(lbl)}:\*\*\s*$", stats_block) for (lbl, _, _) in label_to_block):
            break

    # Replace gear section body (preserve any non-list notes after list).
    gear_bounds = _find_section_bounds(lines, "Gear & Weapons")
    if gear_bounds is not None:
        g_start, g_end = gear_bounds
        begin = "<!-- GURPSAI:BEGIN GCS:GEAR -->"
        end = "<!-- GURPSAI:END GCS:GEAR -->"

        # If marker exists, replace within.
        replaced = False
        for i in range(g_start + 1, g_end):
            if lines[i].strip() == begin:
                for j in range(i + 1, g_end):
                    if lines[j].strip() == end:
                        lines = lines[: i + 1] + gear_block + lines[j:]
                        replaced = True
                        break
            if replaced:
                break

        if not replaced:
            # Replace leading bullet-list content after heading.
            insert_at = g_start + 1
            # Skip initial blank lines.
            while insert_at < g_end and lines[insert_at].strip() == "":
                insert_at += 1

            # Consume existing bullets (and blank lines) to preserve any notes after.
            end_idx = insert_at
            while end_idx < g_end:
                if lines[end_idx].strip() == "":
                    end_idx += 1
                    continue
                if re.match(r"^\s*\*\s+", lines[end_idx]):
                    end_idx += 1
                    continue
                break

            replacement = [begin] + gear_block + [end, ""]
            lines = lines[:insert_at] + replacement + lines[end_idx:]

    # Normalize trailing newline.
    out_text = "\n".join(lines).rstrip("\n") + "\n"
    md_path.parent.mkdir(parents=True, exist_ok=True)
    md_path.write_text(out_text, encoding="utf-8")

    summary = (
        f"Wrote {md_path.as_posix()} from {gcs_path.as_posix()} "
        f"(name={name!r}, points={point_total if point_total is not None else 'unknown'})"
    )
    return summary


def main(argv: list[str] | None = None) -> int:
    source_dir_name = "_source"
    pc_dir = Path("Campaign/02_Characters/PCs")
    parser = argparse.ArgumentParser(
        description="Deterministically sync a PC Markdown sheet from a GCS .gcs file.",
    )
    parser.add_argument(
        "gcs",
        nargs="?",
        help="Path to a .gcs file (must be inside Campaign/02_Characters/PCs/_source). If omitted, scans that folder for *.gcs.",
    )
    parser.add_argument(
        "--md",
        help="Output PC .md path. Defaults to Campaign/02_Characters/PCs/<slugified_gcs_filename>.md for each .gcs.",
    )
    parser.add_argument(
        "--sort",
        action="store_true",
        help="Sort advantages/disadvantages/skills/gear by name for stable diffs.",
    )

    args = parser.parse_args(argv)

    source_dir = pc_dir / source_dir_name
    if args.gcs:
        gcs_paths = [Path(args.gcs)]
    else:
        if not source_dir.exists():
            raise SystemExit(
                f"Missing expected source directory: {source_dir.as_posix()} "
                f"(place .gcs files as {source_dir.as_posix()}/<name>.gcs)"
            )
        gcs_paths = sorted(source_dir.glob("*.gcs"))
        if not gcs_paths:
            raise SystemExit(f"No .gcs files found in {source_dir.as_posix()}")

    pc_dir_resolved = pc_dir.resolve()
    source_dir_resolved = source_dir.resolve()
    for gcs_path in gcs_paths:
        if not gcs_path.exists():
            raise SystemExit(f"Missing .gcs file: {gcs_path.as_posix()}")
        gcs_resolved = gcs_path.resolve()
        if gcs_resolved.parent != source_dir_resolved:
            raise SystemExit(
                "Structure rule violation: .gcs must live directly under "
                f"{source_dir.as_posix()} (got: {gcs_path.as_posix()})"
            )
        if args.md and len(gcs_paths) == 1:
            md_path = Path(args.md)
        else:
            md_name = _slugify_filename(gcs_path.stem) + ".md"
            md_path = pc_dir / md_name

        md_resolved = md_path.resolve()
        if md_resolved.parent != pc_dir_resolved:
            raise SystemExit(
                "Structure rule violation: output .md must be directly under "
                f"{pc_dir.as_posix()} (got: {md_path.as_posix()})"
            )

        print(sync_pc_markdown(gcs_path=gcs_path, md_path=md_path, sort_lists=args.sort))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
