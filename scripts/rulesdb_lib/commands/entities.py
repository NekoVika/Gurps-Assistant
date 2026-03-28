from __future__ import annotations

import argparse
import json
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from rulesdb_lib.extractors.entities import (
    _extract_named_rule_entities,
    _extract_section_entities_equipment,
    _extract_section_entities_name_cost,
    _extract_section_entities_skills,
    _extract_section_entities_spells,
    _find_heading_page_after,
)


@dataclass(frozen=True)
class EntityExtractCommandDeps:
    default_config_path: Path
    default_db_path: Path
    rules_db_dir: Path
    connect: Callable[[Path], sqlite3.Connection]
    load_config_or_none: Callable[[Path], Any]
    pick_book_cfg: Callable[[Any, str | None], Any]
    pick_book_id: Callable[[sqlite3.Connection, Any], int]
    maneuver_name_map: Callable[[], dict[str, str]]
    combat_rule_name_map: Callable[[], tuple[dict[str, str], dict[str, list[str]]]]


def _write_extract_report(
    *,
    deps: EntityExtractCommandDeps,
    book_id: int,
    db_path: Path,
    config_path: Path,
    kind: str,
    mode: str,
    created: int,
    review_count: int,
    meta: dict[str, object],
) -> Path:
    report_dir = deps.rules_db_dir / "logs"
    report_dir.mkdir(parents=True, exist_ok=True)
    report = {
        "book_id": book_id,
        "db_path": str(db_path),
        "config_path": str(config_path),
        "kind": kind,
        "mode": mode,
        "created_entities": created,
        "needs_review": review_count,
        "meta": meta,
    }
    out_path = report_dir / (
        f"entity_extract_{kind}_book{book_id}_{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}.json"
    )
    out_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    return out_path


def cmd_entity_extract(args: argparse.Namespace, deps: EntityExtractCommandDeps) -> int:
    config_path = Path(args.config).resolve() if args.config else deps.default_config_path
    config = deps.load_config_or_none(config_path)
    db_path = (
        Path(args.db).resolve()
        if args.db
        else Path(config.db_path).resolve()
        if config and config.db_path
        else deps.default_db_path
    )
    kind = str(args.kind)

    with deps.connect(db_path) as conn:
        book_cfg = deps.pick_book_cfg(config, args.book)
        book_id = deps.pick_book_id(conn, book_cfg)

        if kind == "spells":
            start_p = _find_heading_page_after(conn, book_id=book_id, headings=["MAGIC"], min_page=1)
            if start_p is None:
                raise SystemExit("Could not find MAGIC heading.")
            end_p = _find_heading_page_after(conn, book_id=book_id, headings=["PSIONICS"], min_page=start_p + 1)
            if end_p is None:
                raise SystemExit("Could not find PSIONICS heading (end boundary).")
            created, review_count, meta = _extract_section_entities_spells(
                conn,
                book_id=book_id,
                start_page=start_p,
                end_page_exclusive=end_p,
                max_span_pages=int(args.max_span_pages),
                min_chars=int(args.min_chars),
                max_entities=int(args.max_entities) if args.max_entities is not None else None,
                mode=str(args.mode),
            )
        elif kind == "equipment":
            start_p = _find_heading_page_after(conn, book_id=book_id, headings=["EQUIPMENT"], min_page=1)
            if start_p is None:
                raise SystemExit("Could not find EQUIPMENT heading.")
            end_p = _find_heading_page_after(conn, book_id=book_id, headings=["COMBAT"], min_page=start_p + 1)
            if end_p is None:
                raise SystemExit("Could not find COMBAT heading (end boundary).")
            created, review_count, meta = _extract_section_entities_equipment(
                conn,
                book_id=book_id,
                start_page=start_p,
                end_page_exclusive=end_p,
                max_span_pages=int(args.max_span_pages),
                min_chars=int(args.min_chars),
                max_entities=int(args.max_entities) if args.max_entities is not None else None,
                mode=str(args.mode),
            )
        elif kind == "advantages":
            start_p = _find_heading_page_after(conn, book_id=book_id, headings=["ADVANTAGES"], min_page=1)
            if start_p is None:
                raise SystemExit("Could not find ADVANTAGES heading.")
            end_p = _find_heading_page_after(conn, book_id=book_id, headings=["DISADVANTAGES"], min_page=start_p + 1)
            if end_p is None:
                raise SystemExit("Could not find DISADVANTAGES heading (end boundary).")
            created, review_count, meta = _extract_section_entities_name_cost(
                conn,
                book_id=book_id,
                entity_type="advantage",
                start_page=start_p,
                end_page_exclusive=end_p,
                max_span_pages=int(args.max_span_pages),
                min_chars=int(args.min_chars),
                max_entities=int(args.max_entities) if args.max_entities is not None else None,
                mode=str(args.mode),
            )
        elif kind == "disadvantages":
            start_p = _find_heading_page_after(conn, book_id=book_id, headings=["DISADVANTAGES"], min_page=1)
            if start_p is None:
                raise SystemExit("Could not find DISADVANTAGES heading.")
            end_p = _find_heading_page_after(conn, book_id=book_id, headings=["SKILLS"], min_page=start_p + 1)
            if end_p is None:
                raise SystemExit("Could not find SKILLS heading (end boundary).")
            created, review_count, meta = _extract_section_entities_name_cost(
                conn,
                book_id=book_id,
                entity_type="disadvantage",
                start_page=start_p,
                end_page_exclusive=end_p,
                max_span_pages=int(args.max_span_pages),
                min_chars=int(args.min_chars),
                max_entities=int(args.max_entities) if args.max_entities is not None else None,
                mode=str(args.mode),
            )
        elif kind == "skills":
            start_p = _find_heading_page_after(conn, book_id=book_id, headings=["SKILLS"], min_page=1)
            if start_p is None:
                raise SystemExit("Could not find SKILLS heading.")
            end_p = _find_heading_page_after(conn, book_id=book_id, headings=["TECHNIQUES"], min_page=start_p + 1)
            if end_p is None:
                raise SystemExit("Could not find TECHNIQUES heading (end boundary).")
            created, review_count, meta = _extract_section_entities_skills(
                conn,
                book_id=book_id,
                start_page=start_p,
                end_page_exclusive=end_p,
                max_span_pages=int(args.max_span_pages),
                min_chars=int(args.min_chars),
                max_entities=int(args.max_entities) if args.max_entities is not None else None,
                mode=str(args.mode),
            )
        elif kind == "combat_rules":
            heading_map, aliases_by_name = deps.combat_rule_name_map()
            created, review_count, meta = _extract_named_rule_entities(
                conn,
                book_id=book_id,
                heading_map=heading_map,
                aliases_by_name=aliases_by_name,
                max_span_pages=int(args.max_span_pages),
                min_chars=int(args.min_chars),
                cluster_gap_pages=int(args.cluster_gap_pages),
                cluster_choice="all" if str(args.cluster) == "auto" else str(args.cluster),
                cluster_tail_pages=int(args.cluster_tail_pages),
                mode=str(args.mode),
            )
        else:
            heading_map = deps.maneuver_name_map()
            aliases_by_name = {name: [name] for name in set(heading_map.values())}
            created, review_count, meta = _extract_named_rule_entities(
                conn,
                book_id=book_id,
                heading_map=heading_map,
                aliases_by_name=aliases_by_name,
                max_span_pages=int(args.max_span_pages),
                min_chars=int(args.min_chars),
                cluster_gap_pages=int(args.cluster_gap_pages),
                cluster_choice=str(args.cluster),
                cluster_tail_pages=int(args.cluster_tail_pages),
                mode=str(args.mode),
            )

    out_path = _write_extract_report(
        deps=deps,
        book_id=book_id,
        db_path=db_path,
        config_path=config_path,
        kind=kind,
        mode=str(args.mode),
        created=created,
        review_count=review_count,
        meta=meta,
    )
    print(f"Extracted entities ({kind}) for book_id={book_id}: {created} created. Report: {out_path}")
    return 0
