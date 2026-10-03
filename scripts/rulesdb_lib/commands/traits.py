"""Build the priced trait catalogue from a book's own Trait Lists.

Separate from `entities` on purpose. That table is prose extraction -- it finds
a chapter, reads headings, and supplies description text. This one is the
catalogue: what the book contains and what it charges, taken from the summary
tables the book publishes for exactly that purpose. Membership and cost come
from here; descriptions are joined on afterwards by page.

Keeping them apart also means a re-ingest can rebuild either without touching
the other, and that homebrew -- which lives in the campaign, not in a book --
never has anywhere to collide with.
"""
from __future__ import annotations

import argparse
import json
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from rulesdb_lib.extractors.trait_lists import (
    clean, parse_modifiers, parse_skills, parse_traits, suspect,
)

SCHEMA = """
CREATE TABLE IF NOT EXISTS traits (
  id INTEGER PRIMARY KEY,
  book_id INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('advantage','disadvantage','skill','modifier')),
  name TEXT NOT NULL,
  category TEXT,
  exotic INTEGER NOT NULL DEFAULT 0,
  specialised INTEGER NOT NULL DEFAULT 0,
  self_control INTEGER NOT NULL DEFAULT 0,
  cost_text TEXT,
  cost_kind TEXT,
  cost_value INTEGER,
  attr TEXT,
  difficulty TEXT,
  defaults TEXT,
  page INTEGER,
  needs_review INTEGER NOT NULL DEFAULT 0,
  review_reason TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (book_id, kind, name),
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS traits_name_idx ON traits (name);
CREATE INDEX IF NOT EXISTS traits_kind_idx ON traits (book_id, kind);
"""

#: Which parser reads which section. The page ranges come from config, because
#: they are the one thing that differs for every book.
SECTIONS: dict[str, Any] = {
    "advantages": lambda lines: parse_traits(lines, "advantage"),
    "disadvantages": lambda lines: parse_traits(lines, "disadvantage"),
    "modifiers": parse_modifiers,
    "skills": parse_skills,
}


@dataclass(frozen=True)
class TraitListCommandDeps:
    default_config_path: Path
    default_db_path: Path
    rules_db_dir: Path
    connect: Callable[[Path], sqlite3.Connection]
    load_config_or_none: Callable[[Path], Any]
    pick_book_cfg: Callable[[Any, str | None], Any]
    pick_book_id: Callable[[sqlite3.Connection, Any], int]


#: Columns added after the table first shipped. `CREATE TABLE IF NOT EXISTS`
#: silently leaves an existing table alone, so a schema change needs saying
#: out loud or the next run fails on a column that looks present in the source.
LATER_COLUMNS = {
    "specialised": "INTEGER NOT NULL DEFAULT 0",
    "self_control": "INTEGER NOT NULL DEFAULT 0",
}


def _ensure_columns(conn: sqlite3.Connection) -> None:
    present = {row[1] for row in conn.execute("PRAGMA table_info(traits)")}
    for column, decl in LATER_COLUMNS.items():
        if column not in present:
            conn.execute(f"ALTER TABLE traits ADD COLUMN {column} {decl}")


def _lines_for(conn: sqlite3.Connection, book_id: int, pages: list[int]) -> list[str]:
    out: list[str] = []
    for page in pages:
        rows = conn.execute(
            "SELECT text_clean FROM blocks WHERE book_id = ? AND logical_page_number = ?"
            " ORDER BY reading_order",
            (book_id, page),
        ).fetchall()
        for (text,) in rows:
            out += [line.strip() for line in (text or "").split("\n")]
    return clean([line for line in out if line])


def _pages(spec: Any) -> list[int]:
    """Accept 304, [304, 305] or "304-306" -- all three read naturally in config."""
    if isinstance(spec, int):
        return [spec]
    if isinstance(spec, str):
        if "-" in spec:
            lo, hi = spec.split("-", 1)
            return list(range(int(lo), int(hi) + 1))
        return [int(spec)]
    if isinstance(spec, list):
        out: list[int] = []
        for item in spec:
            out += _pages(item)
        return out
    raise SystemExit(f"Cannot read a page range from {spec!r}")


def cmd_trait_list(args: argparse.Namespace, deps: TraitListCommandDeps) -> int:
    config_path = Path(args.config).resolve() if args.config else deps.default_config_path
    config = deps.load_config_or_none(config_path)
    book_cfg = deps.pick_book_cfg(config, getattr(args, "book", None))

    ranges: dict[str, Any] = dict(getattr(book_cfg, "trait_lists", None) or {})
    for name in SECTIONS:
        supplied = getattr(args, name, None)
        if supplied:
            ranges[name] = supplied
    if not ranges:
        raise SystemExit(
            "No trait-list pages given. Add [books.<key>.trait_lists] to the config, "
            "or pass --advantages 299-300 --disadvantages 301-302 "
            "--modifiers 303 --skills 304-306."
        )

    db_path = Path(args.db).resolve() if args.db else (
        Path(config.db_path).resolve() if config and config.db_path else deps.default_db_path
    )
    conn = deps.connect(db_path)
    try:
        conn.executescript(SCHEMA)
        _ensure_columns(conn)
        book_id = deps.pick_book_id(conn, book_cfg)

        parsed: list[dict] = []
        used: dict[str, list[int]] = {}
        for section, pages_spec in ranges.items():
            if section not in SECTIONS:
                raise SystemExit(f"Unknown trait-list section '{section}' in config")
            pages = _pages(pages_spec)
            used[section] = pages
            parsed += SECTIONS[section](_lines_for(conn, book_id, pages))

        now = datetime.now(timezone.utc).isoformat()
        if args.replace:
            conn.execute("DELETE FROM traits WHERE book_id = ?", (book_id,))

        # A trait can be printed in two places -- Sense-Based is listed as both
        # an enhancement and a limitation. One row survives the unique key, so
        # say where the other was rather than lose it without a word.
        elsewhere: dict[tuple[str, str], list[int]] = {}
        for row in parsed:
            elsewhere.setdefault((row["kind"], row["name"]), []).append(row.get("page"))
        duplicated = {key: pages for key, pages in elsewhere.items() if len(pages) > 1}
        duplicate_names = set(duplicated)

        written = 0
        for row in parsed:
            reasons = suspect(row)
            pages = duplicated.get((row["kind"], row["name"]))
            if pages:
                reasons.append("also printed on " + ", ".join(f"p{p}" for p in pages if p))
            conn.execute(
                """
                INSERT INTO traits (book_id, kind, name, category, exotic, specialised,
                                    self_control, cost_text, cost_kind, cost_value, attr,
                                    difficulty, defaults, page, needs_review, review_reason,
                                    created_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                ON CONFLICT (book_id, kind, name) DO UPDATE SET
                    category=excluded.category, exotic=excluded.exotic,
                    specialised=excluded.specialised, self_control=excluded.self_control,
                    cost_text=excluded.cost_text, cost_kind=excluded.cost_kind,
                    cost_value=excluded.cost_value, attr=excluded.attr,
                    difficulty=excluded.difficulty, defaults=excluded.defaults,
                    page=excluded.page, needs_review=excluded.needs_review,
                    review_reason=excluded.review_reason
                """,
                (book_id, row["kind"], row["name"], row.get("category"),
                 1 if row.get("exotic") else 0, 1 if row.get("specialised") else 0,
                 1 if row.get("self_control") else 0, row.get("cost_text"), row.get("cost_kind"),
                 row.get("cost_value"), row.get("attr"), row.get("difficulty"),
                 row.get("defaults"), row.get("page"), 1 if reasons else 0,
                 "; ".join(reasons) or None, now),
            )
            written += 1
        conn.commit()

        counts = {
            kind: conn.execute(
                "SELECT COUNT(*) FROM traits WHERE book_id = ? AND kind = ?", (book_id, kind)
            ).fetchone()[0]
            for kind in ("advantage", "disadvantage", "skill", "modifier")
        }
        flagged = conn.execute(
            "SELECT COUNT(*) FROM traits WHERE book_id = ? AND needs_review = 1", (book_id,)
        ).fetchone()[0]
    finally:
        conn.close()

    report_dir = deps.rules_db_dir / "logs"
    report_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    report_path = report_dir / f"trait_list_book{book_id}_{stamp}.json"
    report_path.write_text(json.dumps({
        "book_id": book_id, "db_path": str(db_path), "config_path": str(config_path),
        "pages": used, "parsed": len(parsed), "written": written,
        "counts": counts, "needs_review": flagged,
    }, indent=2), encoding="utf-8")

    print(f"parsed {len(parsed)} rows from {', '.join(f'{k} pp.{min(v)}-{max(v)}' for k, v in used.items())}")
    for kind, n in counts.items():
        print(f"  {kind:<14}{n:>5}")
    print(f"  {'stored':<14}{sum(counts.values()):>5}")
    print(f"  {'needs review':<14}{flagged:>5}")
    if duplicate_names:
        print(f"  {'printed twice':<14}{len(duplicate_names):>5}   "
              + ", ".join(sorted(n for _, n in duplicate_names)))
    print(f"report: {report_path}")
    return 0
