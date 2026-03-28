from __future__ import annotations

import json
import re
from typing import Mapping


def _row_value(row: Mapping[str, object] | object, key: str) -> object:
    if isinstance(row, Mapping):
        return row.get(key)
    try:
        return row[key]  # type: ignore[index]
    except Exception:
        return None


def pages_label(start_page: int | None, end_page: int | None) -> str:
    if start_page is None or end_page is None:
        return "p. ?"
    if int(start_page) == int(end_page):
        return f"p. {int(start_page)}"
    return f"p. {int(start_page)}-{int(end_page)}"


def normalize_query_text(query: str) -> str:
    return " ".join(query.lower().split()).strip()


def qa_candidate_terms(query: str) -> list[str]:
    stop = {
        "a", "an", "and", "are", "as", "at", "be", "can", "do", "does", "for",
        "from", "get", "how", "i", "if", "in", "into", "is", "it", "make", "me", "my",
        "of", "on", "or", "several", "should", "the", "to", "use", "what",
        "when", "with", "you", "your",
        "better", "fighter",
    }
    tokens = re.findall(r"[A-Za-z0-9][A-Za-z0-9'\-+]*", query)
    cleaned = [t.strip() for t in tokens if t.strip()]
    terms: list[str] = []
    seen: set[str] = set()

    def add(term: str) -> None:
        t = " ".join(term.split()).strip()
        key = t.lower()
        if len(t) < 3 or key in seen:
            return
        seen.add(key)
        terms.append(t)

    quoted = re.findall(r'"([^"]+)"', query)
    for q in quoted:
        add(q)

    for t in cleaned:
        if t.lower() not in stop and any(ch.isalpha() for ch in t):
            add(t)

    for i in range(len(cleaned) - 1):
        a, b = cleaned[i], cleaned[i + 1]
        if a.lower() in stop or b.lower() in stop:
            continue
        add(f"{a} {b}")

    for i in range(len(cleaned) - 2):
        a, b, c = cleaned[i], cleaned[i + 1], cleaned[i + 2]
        if a.lower() in stop or b.lower() in stop or c.lower() in stop:
            continue
        add(f"{a} {b} {c}")

    return terms[:12]


def entity_name_relevance(name: str, candidate_terms: list[str], query: str) -> int:
    n = normalize_query_text(name)
    q = normalize_query_text(query)
    if n == q:
        return 100
    score = 0
    for term in candidate_terms:
        t = normalize_query_text(term)
        if not t:
            continue
        if n == t:
            score = max(score, 90)
        elif n.startswith(t):
            score = max(score, 70)
        elif t in n:
            score = max(score, 50)
    return score


def query_looks_combat_rules(query: str, candidate_terms: list[str]) -> bool:
    q = normalize_query_text(query)
    combat_terms = {
        "attack",
        "defense",
        "defence",
        "dodge",
        "parry",
        "block",
        "retreat",
        "slam",
        "suppression",
        "rapid fire",
        "hit location",
        "all-out",
        "maneuver",
        "combat",
        "fire",
        "shoot",
        "bullets",
        "unarmed",
    }
    if any(term in q for term in combat_terms):
        return True
    return any(normalize_query_text(term) in combat_terms for term in candidate_terms)


def entity_type_priority(entity_type: str, query: str, candidate_terms: list[str]) -> int:
    q = normalize_query_text(query)
    combatish = query_looks_combat_rules(query, candidate_terms)
    if q.startswith("how does ") or q.startswith("how do "):
        if combatish:
            priorities = {
                "rule": 0,
                "skill": 1,
                "advantage": 2,
                "disadvantage": 3,
                "table": 4,
                "spell": 5,
            }
            return priorities.get(entity_type, 9)
    priorities = {
        "advantage": 0,
        "disadvantage": 1,
        "skill": 2,
        "rule": 3,
        "table": 4,
        "spell": 5,
    }
    return priorities.get(entity_type, 9)


def entity_rank_score(row: Mapping[str, object], candidate_terms: list[str], query: str) -> tuple[int, int, int, str]:
    name = str(_row_value(row, "name") or "")
    entity_type = str(_row_value(row, "type") or "")
    relevance = entity_name_relevance(name, candidate_terms, query)
    specificity = 0
    n = normalize_query_text(name)
    for term in candidate_terms:
        t = normalize_query_text(term)
        if not t:
            continue
        if n == t:
            specificity = max(specificity, len(t.split()))
        elif n.startswith(t) or t in n:
            specificity = max(specificity, len(t.split()))
    type_priority = entity_type_priority(entity_type, query, candidate_terms)
    page_start = _row_value(row, "start_page")
    page_num = int(page_start) if isinstance(page_start, int) else 9999
    return (-relevance, -specificity, type_priority, page_num, name.lower())


def parse_json_object(raw: object) -> dict[str, object]:
    if raw is None:
        return {}
    if isinstance(raw, dict):
        return dict(raw)
    if isinstance(raw, str):
        try:
            value = json.loads(raw)
        except Exception:
            return {}
        if isinstance(value, dict):
            return value
    return {}


def parse_json_list(raw: object) -> list[dict[str, object]]:
    if raw is None:
        return []
    if isinstance(raw, list):
        return [v for v in raw if isinstance(v, dict)]
    if isinstance(raw, str):
        try:
            value = json.loads(raw)
        except Exception:
            return []
        if isinstance(value, list):
            return [v for v in value if isinstance(v, dict)]
    return []


def citation_preview_from_block_refs(block_refs_raw: object, *, max_blocks: int = 3) -> str:
    refs = parse_json_list(block_refs_raw)
    if not refs:
        return ""
    by_page: dict[int, list[str]] = {}
    for ref in refs:
        page = ref.get("page")
        block_id = ref.get("block_id")
        if isinstance(page, int) and isinstance(block_id, str):
            by_page.setdefault(page, []).append(block_id)
    if not by_page:
        return ""
    parts: list[str] = []
    for page in sorted(by_page.keys())[:2]:
        blocks = by_page[page]
        preview = ", ".join(blocks[:max_blocks])
        more = f" (+{len(blocks) - max_blocks})" if len(blocks) > max_blocks else ""
        parts.append(f"p. {page} blocks: {preview}{more}")
    return "; ".join(parts)


def citation_label_for_entity(row: Mapping[str, object]) -> str:
    primary = parse_json_object(_row_value(row, "primary_citation"))
    page = primary.get("page")
    if isinstance(page, int):
        block_id = primary.get("block_id")
        if isinstance(block_id, str) and block_id:
            return f"(Basic Set, p. {page}, block {block_id})"
        return f"(Basic Set, p. {page})"
    start_page = _row_value(row, "start_page")
    end_page = _row_value(row, "end_page")
    return f"(Basic Set, {pages_label(start_page, end_page)})"


def citation_label_for_chunk(row: Mapping[str, object]) -> str:
    refs = parse_json_list(_row_value(row, "block_refs"))
    if refs:
        first = refs[0]
        page = first.get("page")
        block_id = first.get("block_id")
        if isinstance(page, int) and isinstance(block_id, str):
            return f"(Basic Set, p. {page}, block {block_id})"
    start_page = _row_value(row, "start_page")
    end_page = _row_value(row, "end_page")
    return f"(Basic Set, {pages_label(start_page, end_page)})"
