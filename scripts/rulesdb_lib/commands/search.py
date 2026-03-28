from __future__ import annotations

import argparse
import json
import re
import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, cast

from rulesdb_lib.qa_helpers import (
    citation_label_for_chunk,
    citation_label_for_entity,
    citation_preview_from_block_refs,
    entity_name_relevance,
    normalize_query_text,
    pages_label,
    qa_candidate_terms,
)


@dataclass(frozen=True)
class SearchCommandDeps:
    default_config_path: Path
    default_db_path: Path
    rules_db_dir: Path
    connect: Callable[[Path], sqlite3.Connection]
    load_config_or_none: Callable[[Path], Any]
    pick_book_cfg: Callable[[Any, str | None], Any]
    pick_book_id: Callable[[sqlite3.Connection, Any], int]
    table_exists: Callable[[sqlite3.Connection, str], bool]
    fetch_entity_rows_by_ids: Callable[[sqlite3.Connection], list[sqlite3.Row]] | Callable[..., list[sqlite3.Row]]
    fetch_chunk_rows_by_ids: Callable[[sqlite3.Connection], list[sqlite3.Row]] | Callable[..., list[sqlite3.Row]]


def _resolve_db_and_config(args: argparse.Namespace, deps: SearchCommandDeps) -> tuple[Path, Any]:
    config_path = Path(args.config).resolve() if args.config else deps.default_config_path
    config = deps.load_config_or_none(config_path)
    db_path = (
        Path(args.db).resolve()
        if args.db
        else Path(config.db_path).resolve()
        if config and config.db_path
        else deps.default_db_path
    )
    return db_path, config


def cmd_search(args: argparse.Namespace, deps: SearchCommandDeps) -> int:
    db_path, config = _resolve_db_and_config(args, deps)

    query_in = (args.query or "").strip()
    query = query_in
    if not query:
        raise SystemExit("Query must be non-empty.")

    with deps.connect(db_path) as conn:
        book_cfg = deps.pick_book_cfg(config, args.book)
        book_id = deps.pick_book_id(conn, book_cfg)

        limit = int(args.limit)
        if limit < 1 or limit > 50:
            raise SystemExit("--limit must be 1..50")

        use_fts = deps.table_exists(conn, "chunks_fts")
        raw_fts = bool(getattr(args, "fts", False))

        if use_fts:
            if not raw_fts:
                tokens = re.findall(r"[A-Za-z0-9']+", query)
                tokens = [t for t in tokens if t.strip()]
                if not tokens:
                    q = query.replace('"', '""')
                    query = f"\"{q}\""
                else:
                    safe_terms = []
                    for t in tokens:
                        t2 = t.replace('"', '""')
                        safe_terms.append(f"\"{t2}\"")
                    query = " AND ".join(safe_terms)

            try:
                rows = conn.execute(
                    """
                    SELECT chunks_fts.chunk_id AS chunk_id,
                           snippet(chunks_fts, 0, '[', ']', '…', 24) AS snip
                    FROM chunks_fts
                    WHERE chunks_fts MATCH ?
                    ORDER BY bm25(chunks_fts)
                    LIMIT ?
                    """,
                    (query, limit),
                ).fetchall()
            except sqlite3.OperationalError as e:
                raise SystemExit(
                    f"FTS query failed: {e}\n"
                    "Tip: re-run with --fts and a simpler query, or remove punctuation."
                ) from e

            chunk_ids = [int(r["chunk_id"]) for r in rows]
            if not chunk_ids:
                print("No results.")
                return 0

            chunks = conn.execute(
                f"""
                SELECT id, start_page, end_page
                FROM chunks
                WHERE book_id = ? AND id IN ({",".join("?" for _ in chunk_ids)})
                """,
                [book_id, *chunk_ids],
            ).fetchall()
            chunk_by_id = {int(c["id"]): c for c in chunks}

            for r in rows:
                cid = int(r["chunk_id"])
                c = chunk_by_id.get(cid)
                pages = (
                    f"p. {int(c['start_page'])}-{int(c['end_page'])}"
                    if c and c["start_page"] and c["end_page"]
                    else "p. ?"
                )
                print(f"- chunk {cid} ({pages}) {cast(str, r['snip'])}")
            return 0

        rows = conn.execute(
            """
            SELECT id, start_page, end_page, substr(text_clean, 1, 220) AS snip
            FROM chunks
            WHERE book_id = ? AND text_clean LIKE ?
            ORDER BY id
            LIMIT ?
            """,
            (book_id, f"%{query}%", limit),
        ).fetchall()
        if not rows:
            print("No results.")
            return 0
        for r in rows:
            pages = (
                f"p. {int(r['start_page'])}-{int(r['end_page'])}"
                if r["start_page"] and r["end_page"]
                else "p. ?"
            )
            print(f"- chunk {int(r['id'])} ({pages}) {cast(str, r['snip']).replace('\\n', ' ')}…")
        return 0


def cmd_chunk_show(args: argparse.Namespace, deps: SearchCommandDeps) -> int:
    db_path, config = _resolve_db_and_config(args, deps)

    chunk_id = int(args.chunk_id)
    if chunk_id < 1:
        raise SystemExit("chunk_id must be >= 1")

    with deps.connect(db_path) as conn:
        book_cfg = deps.pick_book_cfg(config, args.book)
        book_id = deps.pick_book_id(conn, book_cfg)

        row = conn.execute(
            """
            SELECT id, book_id, start_page, end_page, text_clean, block_refs
            FROM chunks
            WHERE id = ?
            """,
            (chunk_id,),
        ).fetchone()
        if not row:
            raise SystemExit(f"Chunk not found: {chunk_id}")

        chunk_book_id = int(row["book_id"])
        if chunk_book_id != book_id:
            raise SystemExit(
                f"Chunk {chunk_id} belongs to book_id={chunk_book_id}, not requested book_id={book_id}."
            )

        print(f"Chunk {chunk_id} ({pages_label(row['start_page'], row['end_page'])})")

        if args.refs:
            refs = json.loads(cast(str, row["block_refs"] or "[]"))
            by_page: dict[int, list[str]] = {}
            if isinstance(refs, list):
                for r in refs:
                    if not isinstance(r, dict):
                        continue
                    p = r.get("page")
                    bid = r.get("block_id")
                    if isinstance(p, int) and isinstance(bid, str):
                        by_page.setdefault(p, []).append(bid)

            if by_page:
                print("Citations:")
                for p in sorted(by_page.keys()):
                    bids = by_page[p]
                    preview = ", ".join(bids[:6])
                    more = "" if len(bids) <= 6 else f" (+{len(bids) - 6} more)"
                    print(f"- (Basic Set, p. {p}) blocks: {preview}{more}")
            else:
                print("Citations: (none)")

        print()
        print(cast(str, row["text_clean"] or ""))

    return 0


def cmd_semantic_search(args: argparse.Namespace, deps: SearchCommandDeps) -> int:
    try:
        import chromadb
    except ImportError:
        raise SystemExit("chromadb is not installed. Please Run `pip install chromadb` first.")

    query = args.query.strip()
    if not query:
        raise SystemExit("Empty query.")

    chroma_dir = deps.rules_db_dir / "chroma"
    if not chroma_dir.exists():
        raise SystemExit("Chroma DB not found. Run 'rulesdb embed' first.")

    client = chromadb.PersistentClient(path=str(chroma_dir))

    try:
        collection = client.get_collection(name="gurps_rules")
    except Exception:
        raise SystemExit("Collection 'gurps_rules' not found. Run 'rulesdb embed' first.")

    results = collection.query(
        query_texts=[query],
        n_results=args.limit
    )

    docs = results.get("documents", [[]])[0] if results.get("documents") else []
    metas = results.get("metadatas", [[]])[0] if results.get("metadatas") else []
    ids = results.get("ids", [[]])[0] if results.get("ids") else []
    distances = results.get("distances", [[]])[0] if results.get("distances") else []

    print(f"\nSemantic Search Results for: '{query}'")
    print("=" * 60)
    for doc, meta, doc_id, dist in zip(docs, metas, ids, distances):
        meta_dict = meta if isinstance(meta, dict) else {}
        type_str = str(meta_dict.get("type", "unknown"))
        name_str = meta_dict.get("name")
        label = f"[{type_str.upper()}] {name_str}" if name_str else f"[{type_str.upper()}] {doc_id}"

        print(f"--- {label} (Distance: {dist:.3f}) ---")
        preview = doc[:800] + "..." if len(doc) > 800 else doc
        print(preview)
        print("-" * 40 + "\n")

    return 0


def cmd_agent_search(args: argparse.Namespace, deps: SearchCommandDeps) -> int:
    try:
        import chromadb
    except ImportError:
        raise SystemExit("chromadb is not installed.")

    query = args.query.strip()
    if not query:
        raise SystemExit("Empty query.")

    db_path, config = _resolve_db_and_config(args, deps)

    exact_rows: list[sqlite3.Row] = []
    with deps.connect(db_path) as conn:
        exact_rows = conn.execute(
            """
            SELECT e.id, e.type, e.name, e.start_page, e.end_page, et.text_clean
            FROM entities e
            JOIN entity_text et ON et.entity_id = e.id
            WHERE lower(e.name) = lower(?)
               OR lower(e.aliases) LIKE ?
            ORDER BY
              CASE e.type
                WHEN 'advantage' THEN 1
                WHEN 'disadvantage' THEN 2
                WHEN 'skill' THEN 3
                WHEN 'rule' THEN 4
                ELSE 9
              END,
              e.name
            LIMIT ?
            """,
            (query, f'%"{query.lower()}"%', int(args.limit)),
        ).fetchall()

    chroma_dir = deps.rules_db_dir / "chroma"
    if not chroma_dir.exists():
        raise SystemExit("Chroma DB not found. Run 'rulesdb embed' first.")

    client = chromadb.PersistentClient(path=str(chroma_dir))

    try:
        collection = client.get_collection(name="gurps_rules")
    except Exception:
        raise SystemExit("Collection 'gurps_rules' not found.")

    results = collection.query(
        query_texts=[query],
        n_results=args.limit
    )

    docs = results.get("documents", [[]])[0] if results.get("documents") else []
    metas = results.get("metadatas", [[]])[0] if results.get("metadatas") else []
    ids = results.get("ids", [[]])[0] if results.get("ids") else []
    distances = results.get("distances", [[]])[0] if results.get("distances") else []

    print(f"# DATABASE SEARCH RESULTS: {query}\n")
    emitted_ids: set[str] = set()

    for row in exact_rows:
        entity_id = int(row["id"])
        emitted_ids.add(f"entity_{entity_id}")
        label = f"[ENTITY_{str(row['type']).upper()}] {row['name']}"
        page_start = row["start_page"]
        page_end = row["end_page"]
        page_text = f"p. {page_start}" if page_start == page_end else f"p. {page_start}-{page_end}"
        preview = str(row["text_clean"])[:4500]
        if len(str(row["text_clean"])) > 4500:
            preview += "\n... (truncated)"
        print(f"## {label} (Exact Match, {page_text})")
        print("```text")
        print(preview)
        print("```\n")

    remaining = max(0, int(args.limit) - len(exact_rows))
    if remaining <= 0:
        return 0

    for doc, meta, doc_id, dist in zip(docs, metas, ids, distances):
        if str(doc_id) in emitted_ids:
            continue
        meta_dict = meta if isinstance(meta, dict) else {}
        type_str = str(meta_dict.get("type", "unknown"))
        name_str = meta_dict.get("name")
        label = f"[{type_str.upper()}] {name_str}" if name_str else f"[{type_str.upper()}] {doc_id}"

        preview = doc[:4500]
        if len(doc) > 4500:
            preview += "\n... (truncated)"

        print(f"## {label} (Distance: {dist:.3f})")
        print("```text")
        print(preview)
        print("```\n")
        remaining -= 1
        if remaining <= 0:
            break

    return 0


def cmd_qa(args: argparse.Namespace, deps: SearchCommandDeps) -> int:
    query = (args.query or "").strip()
    if not query:
        raise SystemExit("Empty query.")

    db_path, config = _resolve_db_and_config(args, deps)

    limit = int(args.limit)
    if limit < 1 or limit > 10:
        raise SystemExit("--limit must be 1..10")

    semantic_limit = max(limit * 3, 6)
    candidate_terms = qa_candidate_terms(query)
    normalized_query = normalize_query_text(query)

    try:
        import chromadb
    except ImportError:
        chromadb = None

    with deps.connect(db_path) as conn:
        book_cfg = deps.pick_book_cfg(config, getattr(args, "book", None))
        book_id = deps.pick_book_id(conn, book_cfg)

        exact_entities = conn.execute(
            """
            SELECT e.id, e.type, e.name, e.start_page, e.end_page, e.needs_review, e.review_reason,
                   t.text_clean, t.primary_citation, t.block_refs
            FROM entities e
            JOIN entity_text t ON t.entity_id = e.id
            WHERE e.book_id = ? AND (
                lower(e.name) = lower(?)
                OR lower(e.aliases) LIKE ?
            )
            ORDER BY
              CASE e.type
                WHEN 'advantage' THEN 1
                WHEN 'disadvantage' THEN 2
                WHEN 'skill' THEN 3
                WHEN 'rule' THEN 4
                ELSE 9
              END,
              e.name, e.id
            LIMIT ?
            """,
            (book_id, query, f'%"{normalized_query}"%', limit),
        ).fetchall()

        supporting_entities: list[sqlite3.Row] = []
        seen_entity_ids = {int(r["id"]) for r in exact_entities}
        for term in candidate_terms:
            if len(supporting_entities) >= limit:
                break
            rows = conn.execute(
                """
                SELECT e.id, e.type, e.name, e.start_page, e.end_page, e.needs_review, e.review_reason,
                       t.text_clean, t.primary_citation, t.block_refs
                FROM entities e
                JOIN entity_text t ON t.entity_id = e.id
                WHERE e.book_id = ? AND (
                    e.name LIKE ?
                    OR e.aliases LIKE ?
                )
                ORDER BY
                  CASE
                    WHEN lower(e.name) = lower(?) THEN 0
                    WHEN lower(e.name) LIKE lower(?) THEN 1
                    ELSE 2
                  END,
                  CASE e.type
                    WHEN 'advantage' THEN 1
                    WHEN 'disadvantage' THEN 2
                    WHEN 'skill' THEN 3
                    WHEN 'rule' THEN 4
                    ELSE 9
                  END,
                  e.name, e.id
                LIMIT 4
                """,
                (book_id, f"%{term}%", f"%{term}%", term, f"{term}%"),
            ).fetchall()
            for row in rows:
                entity_id = int(row["id"])
                if entity_id in seen_entity_ids:
                    continue
                if entity_name_relevance(cast(str, row["name"]), candidate_terms, query) < 50:
                    continue
                supporting_entities.append(row)
                seen_entity_ids.add(entity_id)
                if len(supporting_entities) >= limit:
                    break

        semantic_entities: list[sqlite3.Row] = []
        semantic_chunks: list[sqlite3.Row] = []
        if chromadb is not None:
            chroma_dir = deps.rules_db_dir / "chroma"
            if chroma_dir.exists():
                client = chromadb.PersistentClient(path=str(chroma_dir))
                try:
                    collection = client.get_collection(name="gurps_rules")
                except Exception:
                    collection = None
                if collection is not None:
                    results = collection.query(query_texts=[query], n_results=semantic_limit)
                    ids = results.get("ids", [[]])[0] if results.get("ids") else []
                    entity_ids: list[int] = []
                    chunk_ids: list[int] = []
                    for doc_id in ids:
                        doc_id_s = str(doc_id)
                        if doc_id_s.startswith("entity_"):
                            try:
                                entity_id = int(doc_id_s.split("_", 1)[1])
                            except ValueError:
                                continue
                            if entity_id not in seen_entity_ids:
                                entity_ids.append(entity_id)
                                seen_entity_ids.add(entity_id)
                        elif doc_id_s.startswith("chunk_"):
                            try:
                                chunk_id = int(doc_id_s.split("_", 1)[1])
                            except ValueError:
                                continue
                            chunk_ids.append(chunk_id)

                    semantic_entities = deps.fetch_entity_rows_by_ids(
                        conn, book_id=book_id, entity_ids=entity_ids[:limit]
                    )
                    semantic_chunks = deps.fetch_chunk_rows_by_ids(
                        conn, book_id=book_id, chunk_ids=chunk_ids[:limit]
                    )

        chunk_rows: list[sqlite3.Row] = []
        seen_chunk_ids: set[int] = set()
        for row in semantic_chunks:
            cid = int(row["id"])
            if cid not in seen_chunk_ids:
                chunk_rows.append(row)
                seen_chunk_ids.add(cid)

        if not chunk_rows:
            use_fts = deps.table_exists(conn, "chunks_fts")
            search_terms = [query, *candidate_terms[:5]]
            for term in search_terms:
                if len(chunk_rows) >= limit:
                    break
                if use_fts:
                    tokens = [t for t in re.findall(r"[A-Za-z0-9']+", term) if t.strip()]
                    if tokens:
                        fts_q = " AND ".join(f'"{t.replace(chr(34), chr(34) * 2)}"' for t in tokens)
                    else:
                        q = term.replace('"', '""')
                        fts_q = f"\"{q}\""
                    try:
                        rows = conn.execute(
                            """
                            SELECT c.id, c.start_page, c.end_page, c.text_clean, c.block_refs
                            FROM chunks_fts f
                            JOIN chunks c ON c.id = f.chunk_id
                            WHERE f MATCH ? AND c.book_id = ?
                            ORDER BY bm25(f)
                            LIMIT 3
                            """,
                            (fts_q, book_id),
                        ).fetchall()
                    except sqlite3.OperationalError:
                        rows = []
                else:
                    rows = conn.execute(
                        """
                        SELECT id, start_page, end_page, text_clean, block_refs
                        FROM chunks
                        WHERE book_id = ? AND text_clean LIKE ?
                        ORDER BY id
                        LIMIT 3
                        """,
                        (book_id, f"%{term}%"),
                    ).fetchall()
                for row in rows:
                    cid = int(row["id"])
                    if cid in seen_chunk_ids:
                        continue
                    chunk_rows.append(row)
                    seen_chunk_ids.add(cid)
                    if len(chunk_rows) >= limit:
                        break

    print(f"# RULES QA EVIDENCE: {query}\n")
    if candidate_terms:
        print("Candidate terms:", ", ".join(candidate_terms[:8]))
        print()

    if exact_entities:
        print("## Exact Entities")
        for row in exact_entities[:limit]:
            review = f" [needs_review: {row['review_reason']}]" if int(row["needs_review"]) == 1 else ""
            print(
                f"- {row['type']}: {row['name']} ({pages_label(row['start_page'], row['end_page'])}) {citation_label_for_entity(row)}{review}"
            )
            block_preview = citation_preview_from_block_refs(row["block_refs"])
            if block_preview:
                print(f"  refs: {block_preview}")
        print()

    if supporting_entities or semantic_entities:
        print("## Supporting Entities")
        merged_entities: list[sqlite3.Row] = []
        seen_out_ids: set[int] = set()
        for row in [*supporting_entities, *semantic_entities]:
            eid = int(row["id"])
            if eid in seen_out_ids:
                continue
            merged_entities.append(row)
            seen_out_ids.add(eid)
            if len(merged_entities) >= limit:
                break
        for row in merged_entities:
            preview = cast(str, row["text_clean"] or "").replace("\n", " ").strip()
            preview = preview[:220] + ("..." if len(preview) > 220 else "")
            print(
                f"- {row['type']}: {row['name']} ({pages_label(row['start_page'], row['end_page'])}) {citation_label_for_entity(row)}"
            )
            print(f"  {preview}")
            block_preview = citation_preview_from_block_refs(row["block_refs"])
            if block_preview:
                print(f"  refs: {block_preview}")
        print()

    if chunk_rows:
        print("## Supporting Chunks")
        for row in chunk_rows[:limit]:
            preview = cast(str, row["text_clean"] or "").replace("\n", " ").strip()
            preview = preview[:260] + ("..." if len(preview) > 260 else "")
            print(f"- chunk {int(row['id'])} ({pages_label(row['start_page'], row['end_page'])}) {citation_label_for_chunk(row)}")
            print(f"  {preview}")
            block_preview = citation_preview_from_block_refs(row["block_refs"])
            if block_preview:
                print(f"  refs: {block_preview}")
        print()

    top_entity = exact_entities[0] if exact_entities else None
    if top_entity is None and supporting_entities:
        strongest = supporting_entities[0]
        if entity_name_relevance(cast(str, strongest["name"]), candidate_terms, query) >= 70:
            top_entity = strongest
    if top_entity is None and semantic_entities:
        strongest_sem = semantic_entities[0]
        if entity_name_relevance(cast(str, strongest_sem["name"]), candidate_terms, query) >= 70:
            top_entity = strongest_sem
    if top_entity is not None:
        print("## Best Evidence")
        print(f"{top_entity['type']}: {top_entity['name']} ({pages_label(top_entity['start_page'], top_entity['end_page'])})")
        print(f"Source: {citation_label_for_entity(top_entity)}")
        block_preview = citation_preview_from_block_refs(top_entity["block_refs"], max_blocks=4)
        if block_preview:
            print(f"Refs: {block_preview}")
        print("```text")
        preview = cast(str, top_entity["text_clean"] or "")
        print(preview[:2200] + ("\n... (truncated)" if len(preview) > 2200 else ""))
        print("```")
        return 0

    if chunk_rows:
        row = chunk_rows[0]
        print("## Best Evidence")
        print(f"chunk {int(row['id'])} ({pages_label(row['start_page'], row['end_page'])})")
        print(f"Source: {citation_label_for_chunk(row)}")
        block_preview = citation_preview_from_block_refs(row["block_refs"], max_blocks=4)
        if block_preview:
            print(f"Refs: {block_preview}")
        print("```text")
        preview = cast(str, row["text_clean"] or "")
        print(preview[:2200] + ("\n... (truncated)" if len(preview) > 2200 else ""))
        print("```")
        return 0

    print("No evidence found.")
    return 0
