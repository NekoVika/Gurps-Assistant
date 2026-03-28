from __future__ import annotations

import json
import re
import sqlite3
from datetime import datetime, timezone
from typing import cast

def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()

def _table_exists(conn: sqlite3.Connection, table_name: str) -> bool:
    row = conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type IN ('table','view') AND name = ?",
        (table_name,),
    ).fetchone()
    return row is not None

def _clean_block_text(text: str) -> str:
    """
    Deterministic, conservative cleanup for searchability while preserving meaning.
    """
    t = text.replace("\r\n", "\n").replace("\r", "\n")
    # Join hyphenated line breaks (very conservative).
    # Example: "inter-\nrupt" -> "interrupt"
    t = re.sub(r"(?<=[a-z])-\n(?=[a-z])", "", t)
    # Normalize internal whitespace (keep newlines).
    t = "\n".join(" ".join(line.split()) for line in t.splitlines())
    t = re.sub(r"\n{3,}", "\n\n", t).strip()
    return t

def _json_load(s: str | None) -> dict[str, object] | None:
    if not s:
        return None
    try:
        v = json.loads(s)
    except json.JSONDecodeError:
        return None
    return v if isinstance(v, dict) else None

def _is_hf_block(block_meta_json: str | None) -> bool:
    meta = _json_load(block_meta_json) or {}
    return meta.get("hf") in ("header", "footer")

def _norm_heading_key(s: str) -> str:
    s2 = s.strip().lower()
    s2 = s2.replace("—", "-").replace("–", "-")
    s2 = re.sub(r"[^a-z0-9]+", " ", s2)
    return " ".join(s2.split()).strip()

def _block_heading_match(block_text: str, heading_map: dict[str, str]) -> str | None:
    """
    Returns canonical heading if the block starts with a maneuver heading.
    Handles cases where the heading is split across multiple lines (e.g., ALL-OUT / DEFENSE).
    """
    lines = [ln.strip() for ln in block_text.splitlines() if ln.strip()]
    if not lines:
        return None

    # Try 1..3 leading lines combined.
    for n in (1, 2, 3):
        if len(lines) < n:
            continue
        candidate = " ".join(lines[:n])
        key = _norm_heading_key(candidate)
        if key in heading_map:
            return heading_map[key]

    # Also try "first line only" when block begins "All-Out Defense (Double Defense) ...".
    key1 = _norm_heading_key(lines[0])
    if key1 in heading_map:
        return heading_map[key1]

    return None

def _looks_like_section_break(block_text: str, *, heading_map: dict[str, str]) -> bool:
    """
    Heuristic for major headings like "RANGED ATTACKS" that should terminate maneuver spans.
    """
    lines = [ln.strip() for ln in block_text.splitlines() if ln.strip()]
    if not lines:
        return False
    first = lines[0]
    if len(first) < 5 or len(first) > 60:
        return False

    # Must be mostly uppercase letters/spaces/hyphen.
    if not re.fullmatch(r"[A-Z0-9][A-Z0-9 \-']*[A-Z0-9]?", first):
        return False
    if first.upper() != first:
        return False
    if len(first.split()) < 2:
        return False

    # Don't treat maneuver headings (often ALL-OUT ATTACK, etc.) as breaks.
    if _norm_heading_key(first) in heading_map:
        return False

    return True

def _extract_named_rule_entities(
    conn: sqlite3.Connection,
    *,
    book_id: int,
    heading_map: dict[str, str],
    aliases_by_name: dict[str, list[str]] | None,
    max_span_pages: int,
    min_chars: int,
    cluster_gap_pages: int,
    cluster_choice: str,
    cluster_tail_pages: int,
    mode: str,
) -> tuple[int, int, dict[str, object]]:
    rule_names = sorted(set(heading_map.values()))

    if mode == "replace":
        placeholders = ",".join("?" for _ in rule_names)
        entity_ids = [
            int(r["id"])
            for r in conn.execute(
                f"""
                SELECT id FROM entities
                WHERE book_id = ? AND type = 'rule' AND name IN ({placeholders})
                """,
                [book_id, *rule_names],
            ).fetchall()
        ]
        if entity_ids:
            if _table_exists(conn, "entity_text_fts"):
                conn.execute(
                    f"DELETE FROM entity_text_fts WHERE entity_id IN ({','.join('?' for _ in entity_ids)})",
                    entity_ids,
                )
            conn.execute(
                f"DELETE FROM entity_text WHERE entity_id IN ({','.join('?' for _ in entity_ids)})",
                entity_ids,
            )
            conn.execute(
                f"DELETE FROM entities WHERE id IN ({','.join('?' for _ in entity_ids)})",
                entity_ids,
            )
            conn.commit()

    blocks = conn.execute(
        """
        SELECT logical_page_number, block_id, text_raw, text_clean, block_meta
        FROM blocks
        WHERE book_id = ?
        ORDER BY logical_page_number, reading_order
        """,
        (book_id,),
    ).fetchall()

    seq: list[dict[str, object]] = []
    for b in blocks:
        if _is_hf_block(cast(str | None, b["block_meta"])):
            continue
        seq.append(
            {
                "page": int(b["logical_page_number"]),
                "block_id": cast(str, b["block_id"]),
                "text_raw": cast(str, b["text_raw"] or ""),
                "text_clean": cast(str, b["text_clean"] or b["text_raw"] or ""),
            }
        )

    starts: list[tuple[int, str]] = []
    for idx, b in enumerate(seq):
        t = cast(str, b["text_clean"])
        match = _block_heading_match(t, heading_map)
        if match:
            starts.append((idx, match))

    if not starts:
        raise SystemExit(
            "No named rule headings detected in blocks. "
            "Run clean first and ensure blocks.text_clean is populated."
        )

    starts_with_page: list[tuple[int, str, int]] = []
    for idx, name in starts:
        starts_with_page.append((idx, name, cast(int, seq[idx]["page"])))
    starts_with_page.sort(key=lambda x: (x[2], x[0]))

    clusters: list[list[tuple[int, str, int]]] = []
    current: list[tuple[int, str, int]] = []
    last_page: int | None = None
    for hit in starts_with_page:
        page = hit[2]
        if last_page is None or (page - last_page) <= cluster_gap_pages:
            current.append(hit)
        else:
            clusters.append(current)
            current = [hit]
        last_page = page
    if current:
        clusters.append(current)

    def cluster_score(c: list[tuple[int, str, int]]) -> tuple[int, int, int, int]:
        pages = [h[2] for h in c]
        span = max(pages) - min(pages)
        uniq = len(set(h[1] for h in c))
        count = len(c)
        start_p = min(pages)
        return (uniq, count, -span, -start_p)

    if not clusters:
        raise SystemExit("No clusters found (unexpected).")

    clusters_sorted = sorted(clusters, key=cluster_score, reverse=True)
    if cluster_choice == "auto":
        chosen_cluster = clusters_sorted[0]
    elif cluster_choice == "earliest":
        chosen_cluster = min(clusters, key=lambda c: min(h[2] for h in c))
    elif cluster_choice == "latest":
        chosen_cluster = max(clusters, key=lambda c: max(h[2] for h in c))
    elif cluster_choice == "all":
        chosen_cluster = [hit for cluster in clusters for hit in cluster]
    else:
        raise SystemExit("Invalid --cluster choice.")

    chosen_hits = sorted(chosen_cluster, key=lambda x: x[0])
    seen: set[str] = set()
    filtered_hits: list[tuple[int, str, int]] = []
    duplicates_in_cluster = 0
    for idx, name, page in chosen_hits:
        if name in seen:
            duplicates_in_cluster += 1
            continue
        seen.add(name)
        filtered_hits.append((idx, name, page))

    now = _utc_now_iso()
    created = 0
    review_count = 0

    cluster_max_page = max(h[2] for h in chosen_cluster)
    cluster_page_limit = cluster_max_page + cluster_tail_pages
    cluster_end_idx = len(seq) - 1
    while cluster_end_idx > 0 and cast(int, seq[cluster_end_idx]["page"]) > cluster_page_limit:
        cluster_end_idx -= 1

    for pos, (start_idx, name, start_page) in enumerate(filtered_hits):
        next_idx = filtered_hits[pos + 1][0] if pos + 1 < len(filtered_hits) else None

        max_page_allowed = start_page + max_span_pages
        end_idx = len(seq) - 1
        if next_idx is not None:
            end_idx = min(end_idx, next_idx - 1)
        end_idx = min(end_idx, cluster_end_idx)
        while end_idx > start_idx and cast(int, seq[end_idx]["page"]) > max_page_allowed:
            end_idx -= 1
        for j in range(start_idx + 1, end_idx + 1):
            if _looks_like_section_break(cast(str, seq[j]["text_clean"]), heading_map=heading_map):
                end_idx = j - 1
                break

        span = seq[start_idx : end_idx + 1]
        if not span:
            continue

        pages = [cast(int, s["page"]) for s in span]
        end_page = max(pages)
        text_raw = "\n\n".join(cast(str, s["text_raw"]) for s in span).strip()
        text_clean = "\n\n".join(_clean_block_text(cast(str, s["text_clean"])) for s in span).strip()
        block_refs = [{"page": cast(int, s["page"]), "block_id": cast(str, s["block_id"])} for s in span]
        primary = block_refs[0] if block_refs else {"page": start_page}

        needs_review = 0
        review_reason = None
        conf = 0.9
        if len(text_raw) < min_chars:
            needs_review = 1
            review_reason = f"short_span<{min_chars}"
            conf = 0.5
            review_count += 1

        aliases = [name]
        if aliases_by_name:
            for alias in aliases_by_name.get(name, []):
                if alias not in aliases:
                    aliases.append(alias)

        cur = conn.execute(
            """
            INSERT INTO entities(
              type, name, aliases, book_id, start_page, end_page,
              confidence, needs_review, review_reason, created_at, updated_at
            )
            VALUES('rule', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                name,
                json.dumps(aliases, ensure_ascii=False),
                book_id,
                start_page,
                end_page,
                conf,
                needs_review,
                review_reason,
                now,
                now,
            ),
        )
        entity_id = int(cur.lastrowid)

        conn.execute(
            """
            INSERT INTO entity_text(
              entity_id, text_raw, text_clean, primary_citation, block_refs, created_at, updated_at
            )
            VALUES(?, ?, ?, ?, ?, ?, ?)
            """,
            (
                entity_id,
                text_raw,
                text_clean,
                json.dumps(primary, ensure_ascii=False),
                json.dumps(block_refs, ensure_ascii=False),
                now,
                now,
            ),
        )
        if _table_exists(conn, "entity_text_fts"):
            conn.execute(
                "INSERT INTO entity_text_fts(text_clean, entity_id) VALUES(?, ?)",
                (text_clean, entity_id),
            )
        created += 1

    conn.commit()

    meta = {
        "detected_starts": len(starts),
        "chosen_cluster_hits": len(filtered_hits),
        "duplicates_in_cluster": duplicates_in_cluster,
        "cluster_count": len(clusters),
        "rule_names": rule_names,
    }
    return created, review_count, meta

def _first_nonempty_line(text: str) -> str | None:
    for ln in text.splitlines():
        s = ln.strip()
        if s:
            return s
    return None

def _first_nonempty_lines(text: str, *, max_lines: int = 6) -> list[str]:
    out: list[str] = []
    for ln in text.splitlines():
        s = ln.strip()
        if not s:
            continue
        out.append(s)
        if len(out) >= max_lines:
            break
    return out

def _find_heading_page_after(
    conn: sqlite3.Connection,
    *,
    book_id: int,
    headings: list[str],
    min_page: int,
) -> int | None:
    wanted = {_norm_heading_key(h): h for h in headings}
    rows = conn.execute(
        """
        SELECT logical_page_number, text_clean, text_raw, block_meta
        FROM blocks
        WHERE book_id = ? AND logical_page_number >= ?
        ORDER BY logical_page_number, reading_order
        """,
        (book_id, min_page),
    ).fetchall()
    for r in rows:
        if _is_hf_block(cast(str | None, r["block_meta"])):
            continue
        text = cast(str, r["text_clean"] or r["text_raw"] or "")
        lines = _first_nonempty_lines(text, max_lines=6)
        if not lines:
            continue
        has_page_number_line = any(re.fullmatch(r"\d{1,3}", ln) for ln in lines)
        non_digit_lines = [ln for ln in lines if not re.fullmatch(r"\d{1,3}", ln)]
        for ln in non_digit_lines:
            if _norm_heading_key(ln) not in wanted:
                continue
            # Skip running headers/footers that are just the section name + page number.
            if has_page_number_line and len(non_digit_lines) == 1:
                continue
            return int(r["logical_page_number"])
    return None

def _parse_name_cost_from_heading_lines(lines: list[str]) -> tuple[str, str] | None:
    """
    Recognize an entity heading like:
      Combat Reflexes [15]
      Combat Reflexes
      [15]
    Returns (name, cost_text).
    """
    if not lines:
        return None

    l1 = lines[0].strip()
    if not l1:
        return None

    # 1-line form: Name [cost]
    m = re.match(r"^(?P<name>.+?)\s*\[(?P<cost>[^\]]+)\]\s*$", l1)
    if m:
        name = m.group("name").strip()
        cost = m.group("cost").strip()
        if 2 <= len(name) <= 80 and re.search(r"[a-z]", name):
            return name, cost

    # 2-line form: Name / [cost]
    if len(lines) >= 2:
        l2 = lines[1].strip()
        m2 = re.match(r"^\[(?P<cost>[^\]]+)\]\s*$", l2)
        if m2:
            name = l1.strip()
            cost = m2.group("cost").strip()
            if 2 <= len(name) <= 80 and re.search(r"[a-z]", name):
                return name, cost

    return None

def _parse_points_cost_line(line: str) -> str | None:
    """
    Recognize a cost line like:
      5 points
      10 points/level
      Varies
    Returns normalized cost text (without the word "points") or None.
    """
    s = line.strip()
    if not s:
        return None
    # Some trait costs include footnote markers like "*" (self-control) at the end.
    s = re.sub(r"[\*\u2020\u2021]+$", "", s).strip()
    if re.fullmatch(r"(?i)var(?:ies|iable)", s) or re.fullmatch(r"(?i)var(?:ies|iable)\\s+points?", s):
        return "variable"

    # "5 or 15 points" / "5 or 10 points/level" / "1 or 2 points/culture"
    m_or = re.match(
        r"^(?P<a>-?\d+)\s+or\s+(?P<b>-?\d+)\s+points?(?:\s*/\s*(?P<unit>[A-Za-z][A-Za-z0-9_-]*))?\s*$",
        s,
        flags=re.IGNORECASE,
    )
    if m_or:
        unit = m_or.group("unit")
        if unit:
            return f"{m_or.group('a')}|{m_or.group('b')}/{unit.lower()}"
        return f"{m_or.group('a')}|{m_or.group('b')}"

    # "1-3 points" (rare but possible)
    m_range = re.match(
        r"^(?P<a>-?\d+)\s*-\s*(?P<b>-?\d+)\s+points?\s*$",
        s,
        flags=re.IGNORECASE,
    )
    if m_range:
        return f"{m_range.group('a')}-{m_range.group('b')}"

    m = re.match(
        r"^(?P<sign>-)?(?P<n>\d+)\s+points?(?:\s*/\s*(?P<unit>[A-Za-z][A-Za-z0-9_-]*))?(?:\s+(?:above|per|each|for)\b.*)?\s*$",
        s,
        flags=re.IGNORECASE,
    )
    if m:
        sign = "-" if m.group("sign") else ""
        n = m.group("n")
        unit = m.group("unit")
        if unit:
            return f"{sign}{n}/{unit.lower()}"
        return f"{sign}{n}"
    return None

def _strip_trailing_origin_code(name: str) -> str:
    """
    Some PDFs include a trailing origin code digit in the heading line (e.g., "Clerical Investment 4").
    Strip a single trailing integer token when it looks like a code, not part of the name.
    """
    s = name.strip()
    parts = s.split()
    # Keep names like "3D Spatial Sense" (digits at start), but strip trailing codes at the end.
    stripped = list(parts)
    removed = 0
    while len(stripped) >= 2 and removed < 3 and re.fullmatch(r"\d{1,2}", stripped[-1]):
        stripped.pop()
        removed += 1
    if removed:
        return " ".join(stripped).strip()
    return s

def _parse_advdisadv_heading(lines: list[str]) -> tuple[str, str] | None:
    """
    Advantage/Disadvantage headings often look like:
      Name [15]
    or:
      Name <origin_code?>
      15 points
    """
    # Bracketed form can appear with names that wrap lines.
    for i in range(0, min(len(lines), 4)):
        candidate = " ".join(lines[: i + 1]).strip()
        m = re.match(r"^(?P<name>.+?)\s*\[(?P<cost>[^\]]+)\]\s*$", candidate)
        if m:
            name = _strip_trailing_origin_code(m.group("name").strip())
            cost = m.group("cost").strip()
            if 2 <= len(name) <= 80 and re.search(r"[a-z]", name):
                return name, cost

    # "X points" form: cost line can be line2..line4, name is prior lines.
    for i in range(1, min(len(lines), 4)):
        cost = _parse_points_cost_line(lines[i])
        if cost is None:
            continue
        name = _strip_trailing_origin_code(" ".join(lines[:i]).strip())
        if 2 <= len(name) <= 80 and re.search(r"[a-z]", name):
            return name, cost

    # Redirect stub form (common in trait lists): "Name" / "see p. 21"
    # Treat as a valid heading so we can resolve it deterministically later.
    for i in range(1, min(len(lines), 4)):
        parsed = _parse_redirect_reference_text(lines[i])
        if not parsed:
            continue
        p, target = parsed
        name = _strip_trailing_origin_code(" ".join(lines[:i]).strip())
        if not (2 <= len(name) <= 80):
            continue
        # Avoid turning prose into headings.
        if any(ch in name for ch in ".?!:;"):
            continue
        if not re.search(r"[A-Za-z]", name):
            continue
        if target:
            return name, f"see_ref:{p}|{target}"
        return name, f"see_p:{p}"

    return None

def _parse_skill_heading(lines: list[str]) -> tuple[str, str] | None:
    """
    Skills often have headings like:
      Acrobatics (DX/H)
      Savoir-Faire (High Society) (IQ/E)
      Driving (Automobile) (DX/A)

    Return (name, attr_diff) where attr_diff is like "DX/H".
    """
    if not lines:
        return None

    def norm_name(n: str) -> str:
        n = n.strip()
        n = re.sub(r"[\*\u2020\u2021]+$", "", n).strip()
        return n

    l1 = lines[0].strip()
    if not l1 or len(l1) > 140:
        return None
    if l1.lower().startswith("example:"):
        return None

    diff_map = {
        "e": "E",
        "easy": "E",
        "a": "A",
        "average": "A",
        "h": "H",
        "hard": "H",
        "vh": "VH",
        "very hard": "VH",
        "veryhard": "VH",
    }

    # Style 1: Name / Attr/Difficulty on next line(s)
    if len(lines) >= 2:
        l2 = lines[1].strip()
        m2 = re.match(
            r"^(?P<attr>IQ|DX|HT|ST|Will|Per)\s*/\s*(?P<diff>VH|H|A|E|Easy|Average|Hard|Very\s*Hard|VeryHard)\s*$",
            l2,
            flags=re.IGNORECASE,
        )
        if m2:
            name = norm_name(l1)
            diff_key = " ".join(m2.group("diff").split()).strip().lower()
            diff = diff_map.get(diff_key)
            if diff and 2 <= len(name) <= 90 and re.search(r"[A-Za-z]", name):
                return name, f"{m2.group('attr').upper()}/{diff}"

    # Style 2: Parenthetical heading like "Driving (Automobile) (DX/Average): ..."
    candidates = [l1]
    if len(lines) >= 2:
        candidates.append(f"{l1} {lines[1].strip()}".strip())
    for cand in candidates:
        if not cand or len(cand) > 240:
            continue
        m = re.match(
            r"^(?P<name>.+)\(\s*(?P<attr>IQ|DX|HT|ST|Will|Per)\s*/\s*(?P<diff>VH|H|A|E|Easy|Average|Hard|Very\s*Hard|VeryHard)\s*\)",
            cand,
            flags=re.IGNORECASE,
        )
        if not m:
            continue
        name = norm_name(m.group("name").strip().rstrip(":").strip())
        diff_key = " ".join(m.group("diff").split()).strip().lower()
        diff = diff_map.get(diff_key)
        if not diff:
            continue
        if 2 <= len(name) <= 90 and re.search(r"[A-Za-z]", name):
            # Avoid major chapter headings etc.
            if name.upper() == name and len(name.split()) >= 2:
                continue
            return name, f"{m.group('attr').upper()}/{diff}"

    return None

def _parse_redirect_reference_text(text_clean: str) -> tuple[int, str | None] | None:
    """
    Parse cross-references like:
      - "see p. 21"
      - "see Talent, p. 89"
      - "see Talent (p. 89)"
      - "see Rank, p. 29"
    Returns (printed_page, target_name_or_none) or None.
    """
    t = " ".join(text_clean.split()).strip()
    if not t:
        return None

    # "see p. 21"
    m = re.fullmatch(r"(?i)see\s+p\.\s*(?P<p>\d{1,3})\.?", t)
    if m:
        return int(m.group("p")), None

    # "see Talent, p. 89" (target is everything before ", p.")
    m2 = re.fullmatch(r"(?i)see\s+(?P<target>.+?)\s*,\s*p\.\s*(?P<p>\d{1,3})\.?", t)
    if m2:
        target = " ".join(m2.group("target").split()).strip()
        return int(m2.group("p")), target or None

    # "see Talent (p. 89)"
    m3 = re.fullmatch(r"(?i)see\s+(?P<target>.+?)\s*\(\s*p\.\s*(?P<p>\d{1,3})\s*\)\s*\.?", t)
    if m3:
        target = " ".join(m3.group("target").split()).strip()
        return int(m3.group("p")), target or None

    # Bare "p. 21"
    m4 = re.fullmatch(r"(?i)p\.\s*(?P<p>\d{1,3})\.?", t)
    if m4:
        return int(m4.group("p")), None

    return None

def _strip_stray_block_headers(text: str) -> str:
    """
    Remove stray chapter headers (e.g. 'SKILLS') and page numbers (e.g. '197')
    that seeped past the global header/footer filter because they are chapter-specific.
    This prevents them from attaching to the top of the first trait block on a page.
    """
    lines = text.splitlines()
    while lines:
        s = lines[0].strip()
        # Strip exact standalone page numbers
        if re.fullmatch(r"\d{1,3}", s):
            lines.pop(0)
            continue
        # Strip ALL-CAPS chapter headers (few words, letters only)
        if 2 <= len(s) <= 40 and s.upper() == s and re.search(r"[A-Z]", s):
            # Only letters, spaces, and maybe hyphens/slashes
            if re.fullmatch(r"[A-Z \-/&]+", s):
                lines.pop(0)
                continue
        break
    return "\n".join(lines).strip()

def _extract_section_entities_name_cost(
    conn: sqlite3.Connection,
    *,
    book_id: int,
    entity_type: str,
    start_page: int,
    end_page_exclusive: int,
    max_span_pages: int,
    min_chars: int,
    max_entities: int | None,
    mode: str,
) -> tuple[int, int, dict[str, object]]:
    """
    Generic section extractor for entities with (Name + [cost]) headings.
    """
    if mode == "replace":
        ids = [
            int(r["id"])
            for r in conn.execute(
                "SELECT id FROM entities WHERE book_id = ? AND type = ?",
                (book_id, entity_type),
            ).fetchall()
        ]
        if ids:
            if _table_exists(conn, "entity_text_fts"):
                conn.execute(
                    f"DELETE FROM entity_text_fts WHERE entity_id IN ({','.join('?' for _ in ids)})",
                    ids,
                )
            conn.execute(
                f"DELETE FROM entities WHERE id IN ({','.join('?' for _ in ids)})",
                ids,
            )
            conn.commit()

    blocks = conn.execute(
        """
        SELECT logical_page_number, block_id, text_raw, text_clean, block_meta
        FROM blocks
        WHERE book_id = ? AND logical_page_number >= ? AND logical_page_number < ?
        ORDER BY logical_page_number, reading_order
        """,
        (book_id, start_page, end_page_exclusive),
    ).fetchall()

    seq: list[dict[str, object]] = []
    for b in blocks:
        if _is_hf_block(cast(str | None, b["block_meta"])):
            continue
        t_clean = cast(str, b["text_clean"] or b["text_raw"] or "")
        # Drop the "skill entry format" explainer blocks entirely so they don't bleed into nearby skills.
        labels = ["Name:", "Type:", "Defaults:", "Prerequisites:", "Description:", "Modifiers:"]
        hit_count = sum(1 for lab in labels if lab in t_clean)
        if "Name:" in t_clean and "Type:" in t_clean and hit_count >= 3:
            continue
            
        # Strip stray chapter headers and page numbers
        t_clean = _strip_stray_block_headers(t_clean)
        t_raw = _strip_stray_block_headers(cast(str, b["text_raw"] or ""))
        
        if not t_clean:
            continue

        seq.append(
            {
                "page": int(b["logical_page_number"]),
                "block_id": cast(str, b["block_id"]),
                "text_raw": t_raw,
                "text_clean": t_clean,
            }
        )

    starts: list[tuple[int, str, str]] = []  # (idx, name, cost_token)
    for idx, b in enumerate(seq):
        t = cast(str, b["text_clean"])
        lines = [ln.strip() for ln in t.splitlines() if ln.strip()][:4]
        if entity_type in ("advantage", "disadvantage"):
            parsed = _parse_advdisadv_heading(lines)
        else:
            parsed = _parse_name_cost_from_heading_lines(lines)
        if not parsed:
            continue
        name, _cost = parsed
        starts.append((idx, name, _cost))

    starts.sort(key=lambda x: x[0])
    now = _utc_now_iso()
    created = 0
    review_count = 0
    skipped = 0
    duplicates_skipped = 0

    fts_enabled = _table_exists(conn, "entity_text_fts")

    printed_map: dict[int, int] | None = None
    alias_redirects: list[tuple[str, str, int]] = []  # (alias_name, target_name, printed_page)
    alias_redirects_added = 0

    def _norm_name(n: str) -> str:
        return " ".join(n.lower().split()).strip()

    def _try_resolve_redirect(*, name: str, printed_page: int) -> dict[str, object] | None:
        nonlocal printed_map
        if printed_map is None:
            printed_map = _build_printed_to_logical_page_map(conn, book_id=book_id)
        target_logical = printed_map.get(int(printed_page))
        if target_logical is None:
            return None

        window_start = max(1, int(target_logical) - 2)
        window_end_excl = int(target_logical) + max_span_pages + 4
        wblocks = conn.execute(
            """
            SELECT logical_page_number, block_id, text_raw, text_clean, bbox, block_meta
            FROM blocks
            WHERE book_id = ? AND logical_page_number >= ? AND logical_page_number < ?
            ORDER BY logical_page_number, reading_order
            """,
            (book_id, window_start, window_end_excl),
        ).fetchall()
        wseq: list[dict[str, object]] = []
        for wb in wblocks:
            if _is_hf_block(cast(str | None, wb["block_meta"])):
                continue
            wseq.append(
                {
                    "page": int(wb["logical_page_number"]),
                    "block_id": cast(str, wb["block_id"]),
                    "text_raw": cast(str, wb["text_raw"] or ""),
                    "text_clean": cast(str, wb["text_clean"] or wb["text_raw"] or ""),
                    "bbox": _json_load(cast(str | None, wb["bbox"])) or {},
                }
            )

        def is_caps_heading(s: str) -> bool:
            if not s:
                return False
            t = s.strip()
            if len(t) < 4 or len(t) > 60:
                return False
            if t.upper() != t:
                return False
            # At least a few letters; avoid pure numbers.
            if len(re.findall(r"[A-Z]", t)) < 3:
                return False
            if not re.fullmatch(r"[A-Z0-9][A-Z0-9 \-']*[A-Z0-9]?", t):
                return False
            return True

        caps_starts: list[tuple[int, int, str]] = []  # (idx, page, first_line)
        for widx, w in enumerate(wseq):
            first = _first_nonempty_line(cast(str, w["text_clean"])) or ""
            if is_caps_heading(first):
                caps_starts.append((widx, cast(int, w["page"]), first))

        wstarts_all: list[tuple[int, str]] = []  # (idx, parsed_name)
        wstarts_match: list[tuple[int, int]] = []  # (idx, page)
        for widx, w in enumerate(wseq):
            wt = cast(str, w["text_clean"])
            wlines = [ln.strip() for ln in wt.splitlines() if ln.strip()][:4]
            wparsed = _parse_advdisadv_heading(wlines)
            if not wparsed:
                continue
            wname, _ = wparsed
            wstarts_all.append((widx, wname))
            if _norm_name(wname) == _norm_name(name):
                wstarts_match.append((widx, cast(int, w["page"])))

        using_caps_boundary = False
        if not wstarts_match:
            # Fallback: the referenced page exists but the heading parser didn't match the name.
            # Try to find a block that *starts* with the exact name and contains a points cost line.
            candidates: list[tuple[int, int]] = []  # (idx, page)
            for widx, w in enumerate(wseq):
                wt = cast(str, w["text_clean"])
                wlines = [ln.strip() for ln in wt.splitlines() if ln.strip()][:6]
                if not wlines:
                    continue
                if wlines[0].lower() != name.lower():
                    continue
                if any(_parse_points_cost_line(ln) is not None for ln in wlines[1:4]):
                    candidates.append((widx, cast(int, w["page"])))
            if not candidates:
                # Last-resort: section heading in all-caps (e.g., "REPUTATION") without a cost line.
                caps_matches = [
                    (idx, page) for idx, page, first in caps_starts if first == name.strip().upper()
                ]
                if not caps_matches:
                    return None
                caps_matches.sort(key=lambda it: (abs(it[1] - int(target_logical)), it[0]))
                w_start_idx, _ = caps_matches[0]
                using_caps_boundary = True
            else:
                candidates.sort(key=lambda it: (abs(it[1] - int(target_logical)), it[0]))
                w_start_idx, _ = candidates[0]
        else:
            # pick closest match to referenced page (tie -> earliest idx)
            wstarts_match.sort(key=lambda it: (abs(it[1] - int(target_logical)), it[0]))
            w_start_idx, _ = wstarts_match[0]

        next_idx: int | None = None
        next_candidates: list[int] = []
        for widx, _nm in sorted(wstarts_all, key=lambda it: it[0]):
            if widx > w_start_idx:
                next_candidates.append(widx)
                break
        if using_caps_boundary:
            for widx, _page, first in caps_starts:
                if widx > w_start_idx and first != name.strip().upper():
                    next_candidates.append(widx)
                    break
        if next_candidates:
            next_idx = min(next_candidates)

        start_page_n = cast(int, wseq[w_start_idx]["page"])
        max_page_allowed = start_page_n + max_span_pages

        end_idx = len(wseq) - 1
        if next_idx is not None:
            end_idx = min(end_idx, next_idx - 1)
        while end_idx > w_start_idx and cast(int, wseq[end_idx]["page"]) > max_page_allowed:
            end_idx -= 1

        # Also stop at the next all-caps section heading (these often separate redirect targets).
        for cap_idx, cap_page, cap_first in caps_starts:
            if cap_idx <= w_start_idx:
                continue
            if cap_first == name.strip().upper():
                continue
            if int(cap_page) > int(max_page_allowed):
                break
            end_idx = min(end_idx, cap_idx - 1)
            break

        # Be conservative when resolving redirects: stop if we "jump columns" on the same page.
        # Cross-reference targets are often short sidebars; this reduces accidental bleed into nearby text.
        start_bbox = cast(dict[str, object], wseq[w_start_idx].get("bbox") or {})
        start_x0 = float(start_bbox.get("x0") or 0.0)
        start_page = cast(int, wseq[w_start_idx]["page"])
        wspan: list[dict[str, object]] = []
        for i in range(w_start_idx, end_idx + 1):
            cur = wseq[i]
            cur_page = cast(int, cur["page"])
            if i != w_start_idx and cur_page == start_page and start_x0 > 0:
                bbox = cast(dict[str, object], cur.get("bbox") or {})
                x0 = float(bbox.get("x0") or 0.0)
                if x0 > 0 and abs(x0 - start_x0) > 120.0:
                    break
            wspan.append(cur)
        if not wspan:
            return None

        pages = [cast(int, s["page"]) for s in wspan]
        end_page_n = max(pages)
        text_raw = "\n\n".join(cast(str, s["text_raw"]) for s in wspan).strip()
        text_clean = "\n\n".join(_clean_block_text(cast(str, s["text_clean"])) for s in wspan).strip()
        block_refs = [{"page": cast(int, s["page"]), "block_id": cast(str, s["block_id"])} for s in wspan]
        primary = block_refs[0] if block_refs else {"page": start_page_n}

        return {
            "start_page": int(start_page_n),
            "end_page": int(end_page_n),
            "text_raw": text_raw,
            "text_clean": text_clean,
            "block_refs": block_refs,
            "primary": primary,
        }

    candidates: list[dict[str, object]] = []

    for pos, (start_idx, name, cost_token) in enumerate(starts):
        if max_entities is not None and len(candidates) >= max_entities:
            skipped += 1
            continue

        next_idx = starts[pos + 1][0] if pos + 1 < len(starts) else None
        start_page_n = cast(int, seq[start_idx]["page"])
        max_page_allowed = start_page_n + max_span_pages

        end_idx = len(seq) - 1
        if next_idx is not None:
            end_idx = min(end_idx, next_idx - 1)
        while end_idx > start_idx and cast(int, seq[end_idx]["page"]) > max_page_allowed:
            end_idx -= 1

        span = seq[start_idx : end_idx + 1]
        if not span:
            continue

        pages = [cast(int, s["page"]) for s in span]
        end_page_n = max(pages)
        text_raw = "\n\n".join(cast(str, s["text_raw"]) for s in span).strip()
        text_clean = "\n\n".join(_clean_block_text(cast(str, s["text_clean"])) for s in span).strip()
        block_refs = [{"page": cast(int, s["page"]), "block_id": cast(str, s["block_id"])} for s in span]
        primary = block_refs[0] if block_refs else {"page": start_page_n}

        resolved_from_redirect = False
        printed_p: int | None = None
        redirect_target: str | None = None

        if entity_type in ("advantage", "disadvantage") and isinstance(cost_token, str):
            if cost_token.startswith("see_p:"):
                try:
                    printed_p = int(cost_token.split(":", 1)[1])
                except ValueError:
                    printed_p = None
            elif cost_token.startswith("see_ref:"):
                try:
                    rest = cost_token.split(":", 1)[1]
                    printed_s, target = rest.split("|", 1)
                    printed_p = int(printed_s)
                    redirect_target = target.strip() or None
                except Exception:
                    printed_p = None
                    redirect_target = None

            if printed_p is None:
                # Some stubs aren't parsed as headings; detect from the tiny body.
                body_lines = [ln.strip() for ln in text_clean.splitlines() if ln.strip()]
                if body_lines and body_lines[0].lower() == name.lower():
                    body = "\n".join(body_lines[1:]).strip()
                else:
                    body = "\n".join(body_lines).strip()
                parsed_ref = _parse_redirect_reference_text(body)
                if parsed_ref:
                    printed_p, redirect_target = parsed_ref

            if printed_p is not None:
                if redirect_target and _norm_name(redirect_target) != _norm_name(name):
                    alias_redirects.append((name, redirect_target, int(printed_p)))
                    continue
                resolved = _try_resolve_redirect(name=name, printed_page=printed_p)
                if resolved:
                    start_page_n = cast(int, resolved["start_page"])
                    end_page_n = cast(int, resolved["end_page"])
                    text_raw = cast(str, resolved["text_raw"])
                    text_clean = cast(str, resolved["text_clean"])
                    block_refs = cast(list[dict[str, object]], resolved["block_refs"])
                    primary = cast(dict[str, object], resolved["primary"])
                    resolved_from_redirect = True

        needs_review = 0
        review_reason = None
        conf = 0.9
        if len(text_raw) < min_chars:
            needs_review = 1
            review_reason = f"short_span<{min_chars}"
            conf = 0.5
            review_count += 1

        if entity_type in ("advantage", "disadvantage") and printed_p is not None and not resolved_from_redirect:
            needs_review = 1
            review_reason = f"redirect_stub_unresolved: see p. {printed_p}"
            conf = min(conf, 0.4)
            review_count += 1

        candidates.append(
            {
                "name": name,
                "start_page": int(start_page_n),
                "end_page": int(end_page_n),
                "text_raw": text_raw,
                "text_clean": text_clean,
                "primary": primary,
                "block_refs": block_refs,
                "confidence": conf,
                "needs_review": needs_review,
                "review_reason": review_reason,
                "resolved_from_redirect": resolved_from_redirect,
            }
        )

    # Dedupe by name: keep the best candidate per name.
    best_by_name: dict[str, dict[str, object]] = {}

    def _score(c: dict[str, object]) -> int:
        txt = cast(str, c.get("text_clean") or "")
        s = len(txt)
        if c.get("resolved_from_redirect"):
            s += 5000
        if int(c.get("needs_review") or 0) == 1:
            s -= 1000
        if re.search(r"(?i)\\bpoints\\b", txt[:240]):
            s += 250
        return s

    for c in candidates:
        key = _norm_name(cast(str, c["name"]))
        if key not in best_by_name or _score(c) > _score(best_by_name[key]):
            best_by_name[key] = c
        else:
            duplicates_skipped += 1

    for c in best_by_name.values():
        name = cast(str, c["name"])
        start_page_n = cast(int, c["start_page"])
        end_page_n = cast(int, c["end_page"])
        text_raw = cast(str, c["text_raw"])
        text_clean = cast(str, c["text_clean"])
        primary = cast(dict[str, object], c["primary"])
        block_refs = cast(list[dict[str, object]], c["block_refs"])
        conf = cast(float, c["confidence"])
        needs_review = cast(int, c["needs_review"])
        review_reason = cast(str | None, c["review_reason"])

        cur = conn.execute(
            """
            INSERT INTO entities(
              type, name, aliases, book_id, start_page, end_page,
              confidence, needs_review, review_reason, created_at, updated_at
            )
            VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                entity_type,
                name,
                json.dumps([name], ensure_ascii=False),
                book_id,
                start_page_n,
                end_page_n,
                conf,
                needs_review,
                review_reason,
                now,
                now,
            ),
        )
        entity_id = int(cur.lastrowid)
        conn.execute(
            """
            INSERT INTO entity_text(entity_id, text_raw, text_clean, primary_citation, block_refs, created_at, updated_at)
            VALUES(?, ?, ?, ?, ?, ?, ?)
            """,
            (
                entity_id,
                text_raw,
                text_clean,
                json.dumps(primary, ensure_ascii=False),
                json.dumps(block_refs, ensure_ascii=False),
                now,
                now,
            ),
        )
        if fts_enabled:
            conn.execute(
                "INSERT INTO entity_text_fts(text_clean, entity_id) VALUES(?, ?)",
                (text_clean, entity_id),
            )
        created += 1

    # Apply alias redirects like "Gifted Artist -> Talent".
    for alias_name, target_name, printed_page in alias_redirects:
        row = conn.execute(
            """
            SELECT id, aliases FROM entities
            WHERE book_id = ? AND type = ? AND lower(name) = lower(?)
            ORDER BY id
            LIMIT 1
            """,
            (book_id, entity_type, target_name),
        ).fetchone()
        if not row:
            # Couldn't find the target entity in this pass; keep the redirect as a review item by creating a stub.
            stub_text = f"{alias_name}\nsee {target_name}, p. {printed_page}"
            cur = conn.execute(
                """
                INSERT INTO entities(
                  type, name, aliases, book_id, start_page, end_page,
                  confidence, needs_review, review_reason, created_at, updated_at
                )
                VALUES(?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
                """,
                (
                    entity_type,
                    alias_name,
                    json.dumps([alias_name], ensure_ascii=False),
                    book_id,
                    None,
                    None,
                    0.3,
                    f"redirect_alias_target_missing: {target_name} p. {printed_page}",
                    now,
                    now,
                ),
            )
            entity_id = int(cur.lastrowid)
            conn.execute(
                """
                INSERT INTO entity_text(entity_id, text_raw, text_clean, primary_citation, block_refs, created_at, updated_at)
                VALUES(?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    entity_id,
                    stub_text,
                    _clean_block_text(stub_text),
                    json.dumps({"page": None}, ensure_ascii=False),
                    json.dumps([], ensure_ascii=False),
                    now,
                    now,
                ),
            )
            if fts_enabled:
                conn.execute(
                    "INSERT INTO entity_text_fts(text_clean, entity_id) VALUES(?, ?)",
                    (_clean_block_text(stub_text), entity_id),
                )
            created += 1
            review_count += 1
            continue

        entity_id = int(row["id"])
        try:
            aliases = json.loads(cast(str, row["aliases"] or "[]"))
        except Exception:
            aliases = []
        if not isinstance(aliases, list):
            aliases = []
        if alias_name not in aliases:
            aliases.append(alias_name)
            conn.execute(
                "UPDATE entities SET aliases = ?, updated_at = ? WHERE id = ?",
                (json.dumps(aliases, ensure_ascii=False), now, entity_id),
            )
            alias_redirects_added += 1

    conn.commit()

    meta = {
        "entity_type": entity_type,
        "start_page": start_page,
        "end_page_exclusive": end_page_exclusive,
        "detected_starts": len(starts),
        "created": created,
        "skipped_due_to_max_entities": skipped,
        "duplicates_skipped": duplicates_skipped,
        "alias_redirects_detected": len(alias_redirects),
        "alias_redirects_added": alias_redirects_added,
    }
    return created, review_count, meta

def _extract_section_entities_skills(
    conn: sqlite3.Connection,
    *,
    book_id: int,
    start_page: int,
    end_page_exclusive: int,
    max_span_pages: int,
    min_chars: int,
    max_entities: int | None,
    mode: str,
) -> tuple[int, int, dict[str, object]]:
    if mode == "replace":
        ids = [
            int(r["id"])
            for r in conn.execute(
                "SELECT id FROM entities WHERE book_id = ? AND type = 'skill'",
                (book_id,),
            ).fetchall()
        ]
        if ids:
            if _table_exists(conn, "entity_text_fts"):
                conn.execute(
                    f"DELETE FROM entity_text_fts WHERE entity_id IN ({','.join('?' for _ in ids)})",
                    ids,
                )
            conn.execute(
                f"DELETE FROM entities WHERE id IN ({','.join('?' for _ in ids)})",
                ids,
            )
            conn.commit()

    blocks = conn.execute(
        """
        SELECT logical_page_number, block_id, text_raw, text_clean, block_meta
        FROM blocks
        WHERE book_id = ? AND logical_page_number >= ? AND logical_page_number < ?
        ORDER BY logical_page_number, reading_order
        """,
        (book_id, start_page, end_page_exclusive),
    ).fetchall()

    seq: list[dict[str, object]] = []
    for b in blocks:
        if _is_hf_block(cast(str | None, b["block_meta"])):
            continue
        t_clean = cast(str, b["text_clean"] or b["text_raw"] or "")
        labels = ["Name:", "Type:", "Defaults:", "Prerequisites:", "Description:", "Modifiers:"]
        hit_count = sum(1 for lab in labels if lab in t_clean)
        if "Name:" in t_clean and "Type:" in t_clean and hit_count >= 3:
            continue
            
        # Strip stray chapter headers and page numbers
        t_clean = _strip_stray_block_headers(t_clean)
        t_raw = _strip_stray_block_headers(cast(str, b["text_raw"] or ""))
        
        if not t_clean:
            continue
            
        seq.append(
            {
                "page": int(b["logical_page_number"]),
                "block_id": cast(str, b["block_id"]),
                "text_raw": t_raw,
                "text_clean": t_clean,
            }
        )

    starts: list[tuple[int, str, str]] = []  # (idx, name, attr_diff)
    for idx, b in enumerate(seq):
        t = cast(str, b["text_clean"])
        lines = [ln.strip() for ln in t.splitlines() if ln.strip()][:4]
        parsed = _parse_skill_heading(lines)
        if not parsed:
            continue
        name, attr_diff = parsed
        starts.append((idx, name, attr_diff))

    starts.sort(key=lambda x: x[0])
    now = _utc_now_iso()
    created = 0
    review_count = 0
    skipped = 0
    duplicates_skipped = 0

    fts_enabled = _table_exists(conn, "entity_text_fts")

    def norm_name(n: str) -> str:
        return " ".join(n.lower().split()).strip()

    candidates: list[dict[str, object]] = []
    for pos, (start_idx, name, attr_diff) in enumerate(starts):
        if max_entities is not None and len(candidates) >= max_entities:
            skipped += 1
            continue

        next_idx = starts[pos + 1][0] if pos + 1 < len(starts) else None
        start_page_n = cast(int, seq[start_idx]["page"])
        max_page_allowed = start_page_n + max_span_pages

        end_idx = len(seq) - 1
        if next_idx is not None:
            end_idx = min(end_idx, next_idx - 1)
        while end_idx > start_idx and cast(int, seq[end_idx]["page"]) > max_page_allowed:
            end_idx -= 1

        span = seq[start_idx : end_idx + 1]
        if not span:
            continue

        pages = [cast(int, s["page"]) for s in span]
        end_page_n = max(pages)
        text_raw = "\n\n".join(cast(str, s["text_raw"]) for s in span).strip()
        text_clean = "\n\n".join(_clean_block_text(cast(str, s["text_clean"])) for s in span).strip()
        block_refs = [{"page": cast(int, s["page"]), "block_id": cast(str, s["block_id"])} for s in span]
        primary = block_refs[0] if block_refs else {"page": start_page_n}

        needs_review = 0
        review_reason = None
        conf = 0.9
        if len(text_raw) < min_chars:
            needs_review = 1
            review_reason = f"short_span<{min_chars}"
            conf = 0.5
            review_count += 1

        candidates.append(
            {
                "name": name,
                "attr_diff": attr_diff,
                "start_page": int(start_page_n),
                "end_page": int(end_page_n),
                "text_raw": text_raw,
                "text_clean": text_clean,
                "primary": primary,
                "block_refs": block_refs,
                "confidence": conf,
                "needs_review": needs_review,
                "review_reason": review_reason,
            }
        )

    # Dedupe by name (tables/lists can create duplicates).
    best_by_name: dict[str, dict[str, object]] = {}

    def score(c: dict[str, object]) -> int:
        txt = cast(str, c.get("text_clean") or "")
        s = len(txt)
        if int(c.get("needs_review") or 0) == 1:
            s -= 1000
        if re.search(r"(?i)\bdefaults?\b", txt):
            s += 200
        return s

    for c in candidates:
        k = norm_name(cast(str, c["name"]))
        if k not in best_by_name or score(c) > score(best_by_name[k]):
            best_by_name[k] = c
        else:
            duplicates_skipped += 1

    for c in best_by_name.values():
        name = cast(str, c["name"])
        start_page_n = cast(int, c["start_page"])
        end_page_n = cast(int, c["end_page"])
        text_raw = cast(str, c["text_raw"])
        text_clean = cast(str, c["text_clean"])
        primary = cast(dict[str, object], c["primary"])
        block_refs = cast(list[dict[str, object]], c["block_refs"])
        conf = cast(float, c["confidence"])
        needs_review = cast(int, c["needs_review"])
        review_reason = cast(str | None, c["review_reason"])

        cur = conn.execute(
            """
            INSERT INTO entities(
              type, name, aliases, book_id, start_page, end_page,
              confidence, needs_review, review_reason, created_at, updated_at
            )
            VALUES('skill', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                name,
                json.dumps([name], ensure_ascii=False),
                book_id,
                start_page_n,
                end_page_n,
                conf,
                needs_review,
                review_reason,
                now,
                now,
            ),
        )
        entity_id = int(cur.lastrowid)
        conn.execute(
            """
            INSERT INTO entity_text(entity_id, text_raw, text_clean, primary_citation, block_refs, created_at, updated_at)
            VALUES(?, ?, ?, ?, ?, ?, ?)
            """,
            (
                entity_id,
                text_raw,
                text_clean,
                json.dumps(primary, ensure_ascii=False),
                json.dumps(block_refs, ensure_ascii=False),
                now,
                now,
            ),
        )
        if fts_enabled:
            conn.execute(
                "INSERT INTO entity_text_fts(text_clean, entity_id) VALUES(?, ?)",
                (text_clean, entity_id),
            )
        created += 1

    conn.commit()

    meta = {
        "entity_type": "skill",
        "start_page": start_page,
        "end_page_exclusive": end_page_exclusive,
        "detected_starts": len(starts),
        "created": created,
        "skipped_due_to_max_entities": skipped,
        "duplicates_skipped": duplicates_skipped,
    }
    return created, review_count, meta

def _extract_section_entities_spells(
    conn: sqlite3.Connection,
    book_id: int,
    start_page: int,
    end_page_exclusive: int,
    max_span_pages: int,
    min_chars: int,
    max_entities: int | None = None,
    mode: str = "replace",
) -> tuple[int, int, dict[str, object]]:
    """
    Spells in the Basic Set start with a name on line 1, and their class on line 2.
    E.g.
    Purify Air
    Area
    """
    if mode == "replace":
        entity_ids = [
            int(r["id"])
            for r in conn.execute(
                f"SELECT id FROM entities WHERE book_id = ? AND type = 'spell'", [book_id]
            ).fetchall()
        ]
        if entity_ids:
            if _table_exists(conn, "entity_text_fts"):
                conn.execute(
                    f"DELETE FROM entity_text_fts WHERE entity_id IN ({','.join('?' for _ in entity_ids)})",
                    entity_ids,
                )
            conn.execute(
                f"DELETE FROM entity_text WHERE entity_id IN ({','.join('?' for _ in entity_ids)})",
                entity_ids,
            )
            conn.execute(
                f"DELETE FROM entities WHERE id IN ({','.join('?' for _ in entity_ids)})",
                entity_ids,
            )
            conn.commit()

    raw_blocks = conn.execute(
        """
        SELECT logical_page_number, block_id, text_raw, text_clean, block_meta
        FROM blocks
        WHERE book_id = ? AND logical_page_number >= ? AND logical_page_number < ?
        ORDER BY logical_page_number, reading_order
        """,
        (book_id, start_page, end_page_exclusive),
    ).fetchall()
    
    blocks: list[dict[str, object]] = []
    for b in raw_blocks:
        if _is_hf_block(cast(str | None, b["block_meta"])):
            continue
        blocks.append({
            "logical_page_number": int(b["logical_page_number"]),
            "block_id": str(b["block_id"]),
            "text_clean": str(b["text_clean"] or ""),
            "text_raw": str(b["text_raw"] or "")
        })

    # Valid spell classes commonly seen in Basic Set
    SPELL_CLASSES = {
        "Area", "Regular", "Information", "Enchantment", 
        "Blocking", "Melee", "Missile", "Special", "Resisted"
    }

    starts: list[int] = []
    for i, b in enumerate(blocks):
        text = str(b["text_clean"])
        lines = text.split("\n")
        
        # Heuristic: First line is short (the name), second line is a known spell class.
        if len(lines) >= 2:
            first_line = lines[0].strip()
            second_line = lines[1].strip()
            
            # Remove symbols sometimes attached to classes or (VH) tags on the name
            clean_class = second_line.split(" ")[0].strip(",.")
            if clean_class in SPELL_CLASSES and len(first_line) < 40 and first_line[0].isupper():
                starts.append(i)

    # 2) Gather spans
    spans: list[tuple[int, int]] = []
    for i in range(len(starts)):
        s_idx = starts[i]
        e_idx = starts[i + 1] if i + 1 < len(starts) else len(blocks)
        
        # Enforce max span constraint based on pages
        start_p = int(blocks[s_idx]["logical_page_number"])
        cap_p = start_p + max_span_pages
        while e_idx > s_idx:
            if int(blocks[e_idx - 1]["logical_page_number"]) <= cap_p:
                break
            e_idx -= 1
        
        if e_idx > s_idx:
            spans.append((s_idx, e_idx))

    # 3) Yield and insert
    fts_enabled = _table_exists(conn, "entity_text_fts")
    now = datetime.now(timezone.utc).isoformat()
    created = 0
    review_count = 0
    skipped = 0
    duplicates_skipped = 0
    
    seen_names: set[str] = set()
    if mode == "append":
        for row in conn.execute("SELECT name FROM entities WHERE book_id=? AND type='spell'", (book_id,)):
            seen_names.add(row[0])

    for s_idx, e_idx in spans:
        if max_entities is not None and created >= max_entities:
            skipped += 1
            break
            
        span_blocks = blocks[s_idx:e_idx]
        text_clean = "\n\n".join(str(b["text_clean"]) for b in span_blocks if b["text_clean"])
        text_raw = "\n\n".join(str(b["text_raw"]) for b in span_blocks if b["text_raw"])
        
        lines = text_clean.split("\n")
        name = lines[0].strip()
        # Remove (VH) notation from name if present
        if "(VH)" in name:
            name = name.replace("(VH)", "").strip()
            
        if not name or len(name) > 60:
            continue
            
        if mode == "append" and name in seen_names:
            duplicates_skipped += 1
            continue
            
        seen_names.add(name)

        start_page_n = int(span_blocks[0]["logical_page_number"])
        end_page_n = int(span_blocks[-1]["logical_page_number"])
        
        needs_review = 0
        review_reason = None
        if len(text_clean) < min_chars:
            needs_review = 1
            review_reason = "Too short"
            review_count += 1
        elif "Duration:" not in text_clean and "Cost:" not in text_clean and "Base Cost:" not in text_clean:
             needs_review = 1
             review_reason = "Missing Cost/Duration fields"
             review_count += 1

        conf = 0.9 if not needs_review else 0.5
        primary = {
            "logical_page_number": start_page_n,
            "block_id": span_blocks[0]["block_id"],
        }
        block_refs = [
            {"logical_page_number": b["logical_page_number"], "block_id": b["block_id"]}
            for b in span_blocks
        ]

        cur = conn.execute(
            """
            INSERT INTO entities(name, aliases, book_id, type, start_page, end_page, confidence, needs_review, review_reason, created_at, updated_at)
            VALUES(?, ?, ?, 'spell', ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                name,
                json.dumps([name], ensure_ascii=False),
                book_id,
                start_page_n,
                end_page_n,
                conf,
                needs_review,
                review_reason,
                now,
                now,
            ),
        )
        entity_id = int(cur.lastrowid)
        conn.execute(
            """
            INSERT INTO entity_text(entity_id, text_raw, text_clean, primary_citation, block_refs, created_at, updated_at)
            VALUES(?, ?, ?, ?, ?, ?, ?)
            """,
            (
                entity_id,
                text_raw,
                text_clean,
                json.dumps(primary, ensure_ascii=False),
                json.dumps(block_refs, ensure_ascii=False),
                now,
                now,
            ),
        )
        if fts_enabled:
            conn.execute(
                "INSERT INTO entity_text_fts(text_clean, entity_id) VALUES(?, ?)",
                (text_clean, entity_id),
            )
        created += 1

    conn.commit()

    meta = {
        "entity_type": "spell",
        "start_page": start_page,
        "end_page_exclusive": end_page_exclusive,
        "detected_starts": len(starts),
        "created": created,
        "skipped_due_to_max_entities": skipped,
        "duplicates_skipped": duplicates_skipped,
    }
    return created, review_count, meta

def _extract_section_entities_equipment(
    conn: sqlite3.Connection,
    book_id: int,
    start_page: int,
    end_page_exclusive: int,
    max_span_pages: int,
    min_chars: int,
    max_entities: int | None = None,
    mode: str = "replace",
) -> tuple[int, int, dict[str, object]]:
    """
    Extracts contiguous blocks representing tables like "Melee Weapon Table".
    """
    if mode == "replace":
        entity_ids = [
            int(r["id"])
            for r in conn.execute(
                f"SELECT id FROM entities WHERE book_id = ? AND type = 'table'", [book_id]
            ).fetchall()
        ]
        if entity_ids:
            if _table_exists(conn, "entity_text_fts"):
                conn.execute(
                    f"DELETE FROM entity_text_fts WHERE entity_id IN ({','.join('?' for _ in entity_ids)})",
                    entity_ids,
                )
            conn.execute(
                f"DELETE FROM entity_text WHERE entity_id IN ({','.join('?' for _ in entity_ids)})",
                entity_ids,
            )
            conn.execute(
                f"DELETE FROM entities WHERE id IN ({','.join('?' for _ in entity_ids)})",
                entity_ids,
            )
            conn.commit()

    raw_blocks = conn.execute(
        """
        SELECT logical_page_number, block_id, text_raw, text_clean, block_meta
        FROM blocks
        WHERE book_id = ? AND logical_page_number >= ? AND logical_page_number < ?
        ORDER BY logical_page_number, reading_order
        """,
        (book_id, start_page, end_page_exclusive),
    ).fetchall()
    
    blocks: list[dict[str, object]] = []
    for b in raw_blocks:
        if _is_hf_block(cast(str | None, b["block_meta"])):
            continue
        blocks.append({
            "logical_page_number": int(b["logical_page_number"]),
            "block_id": str(b["block_id"]),
            "text_clean": str(b["text_clean"] or ""),
            "text_raw": str(b["text_raw"] or "")
        })

    # Known table headers in the Equipment / Combat chapters
    TABLE_REGEXES = [
        re.compile(r"Melee Weapon Table", re.IGNORECASE),
        re.compile(r"Ranged Weapon Table", re.IGNORECASE),
        re.compile(r"Muscle-Powered Ranged Weapon Table", re.IGNORECASE),
        re.compile(r"Firearms Table", re.IGNORECASE),
        re.compile(r"Heavy Weapons Table", re.IGNORECASE),
        re.compile(r"Armor Table", re.IGNORECASE),
        re.compile(r"Shields \(.*\)", re.IGNORECASE),
        re.compile(r"Hit Location Table", re.IGNORECASE),
        re.compile(r"Size and Speed/Range Table", re.IGNORECASE),
    ]

    starts: list[int] = []
    for i, b in enumerate(blocks):
        text_clean = str(b["text_clean"]).strip()
        
        is_trigger = False
        for t_re in TABLE_REGEXES:
            if t_re.search(text_clean):
                # Ensure it's not simply an index entry mentioning the page number
                if "Table," not in text_clean and "Tables," not in text_clean:
                    is_trigger = True
                    break
                
        if is_trigger:
            starts.append(i)

    # 2) Gather spans: Tables are usually 1 massive block, plus maybe continuation blocks loosely associated
    # We will grab all text up to the next table, or up to max_span_pages, whichever comes first
    spans: list[tuple[int, int]] = []
    for i in range(len(starts)):
        s_idx = starts[i]
        e_idx = starts[i + 1] if i + 1 < len(starts) else len(blocks)
        
        start_p = int(blocks[s_idx]["logical_page_number"])
        cap_p = start_p + max_span_pages
        while e_idx > s_idx:
            if int(blocks[e_idx - 1]["logical_page_number"]) <= cap_p:
                break
            e_idx -= 1
        
        if e_idx > s_idx:
            spans.append((s_idx, e_idx))

    # 3) Yield and insert
    fts_enabled = _table_exists(conn, "entity_text_fts")
    now = datetime.now(timezone.utc).isoformat()
    created = 0
    review_count = 0
    skipped = 0
    duplicates_skipped = 0
    
    seen_names: set[str] = set()
    if mode == "append":
        for row in conn.execute("SELECT name FROM entities WHERE book_id=? AND type='table'", (book_id,)):
            seen_names.add(row[0])

    for s_idx, e_idx in spans:
        if max_entities is not None and created >= max_entities:
            skipped += 1
            break
            
        span_blocks = blocks[s_idx:e_idx]
        text_clean = "\n\n".join(str(b["text_clean"]) for b in span_blocks if b["text_clean"])
        text_raw = "\n\n".join(str(b["text_raw"]) for b in span_blocks if b["text_raw"])
        
        lines = text_clean.split("\n")
        name = lines[0].strip()
            
        if not name or len(name) > 60:
            continue
            
        if mode == "append" and name in seen_names:
            duplicates_skipped += 1
            continue
            
        seen_names.add(name)

        start_page_n = int(span_blocks[0]["logical_page_number"])
        end_page_n = int(span_blocks[-1]["logical_page_number"])
        
        needs_review = 0
        review_reason = None
        if len(text_clean) < min_chars:
            needs_review = 1
            review_reason = "Too short"
            review_count += 1

        conf = 0.9 if not needs_review else 0.5
        primary = {
            "logical_page_number": start_page_n,
            "block_id": span_blocks[0]["block_id"],
        }
        block_refs = [
            {"logical_page_number": b["logical_page_number"], "block_id": b["block_id"]}
            for b in span_blocks
        ]

        cur = conn.execute(
            """
            INSERT INTO entities(name, aliases, book_id, type, start_page, end_page, confidence, needs_review, review_reason, created_at, updated_at)
            VALUES(?, ?, ?, 'table', ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                name,
                json.dumps([name], ensure_ascii=False),
                book_id,
                start_page_n,
                end_page_n,
                conf,
                needs_review,
                review_reason,
                now,
                now,
            ),
        )
        entity_id = int(cur.lastrowid)
        conn.execute(
            """
            INSERT INTO entity_text(entity_id, text_raw, text_clean, primary_citation, block_refs, created_at, updated_at)
            VALUES(?, ?, ?, ?, ?, ?, ?)
            """,
            (
                entity_id,
                text_raw,
                text_clean,
                json.dumps(primary, ensure_ascii=False),
                json.dumps(block_refs, ensure_ascii=False),
                now,
                now,
            ),
        )
        if fts_enabled:
            conn.execute(
                "INSERT INTO entity_text_fts(text_clean, entity_id) VALUES(?, ?)",
                (text_clean, entity_id),
            )
        created += 1

    conn.commit()

    meta = {
        "entity_type": "table",
        "start_page": start_page,
        "end_page_exclusive": end_page_exclusive,
        "detected_starts": len(starts),
        "created": created,
        "skipped_due_to_max_entities": skipped,
        "duplicates_skipped": duplicates_skipped,
    }
    return created, review_count, meta
