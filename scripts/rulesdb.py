from __future__ import annotations

import argparse
import hashlib
import json
import re
import sqlite3
import sys
import time
import tomllib
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, cast


ROOT = Path(__file__).resolve().parent.parent
RULES_DB_DIR = ROOT / "rules_db"

DEFAULT_DB_PATH = RULES_DB_DIR / "basic_set.sqlite"
DEFAULT_CONFIG_PATH = RULES_DB_DIR / "config.toml"
SCHEMA_PATH = RULES_DB_DIR / "schema.sql"
FTS_SCHEMA_PATH = RULES_DB_DIR / "schema_fts.sql"


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _exec_sql_file(conn: sqlite3.Connection, path: Path) -> None:
    conn.executescript(_read_text(path))


def _fts5_available(conn: sqlite3.Connection) -> bool:
    try:
        conn.execute("CREATE VIRTUAL TABLE temp._fts5_probe USING fts5(x)")
        conn.execute("DROP TABLE temp._fts5_probe")
        return True
    except sqlite3.OperationalError:
        return False


def _set_meta(conn: sqlite3.Connection, key: str, value: str) -> None:
    conn.execute(
        """
        INSERT INTO meta(key, value) VALUES(?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
        """,
        (key, value),
    )


def _ensure_dirs() -> None:
    (RULES_DB_DIR / "cache").mkdir(parents=True, exist_ok=True)
    (RULES_DB_DIR / "logs").mkdir(parents=True, exist_ok=True)
    (RULES_DB_DIR / "embeddings").mkdir(parents=True, exist_ok=True)


def _connect(db_path: Path) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


def _table_exists(conn: sqlite3.Connection, table_name: str) -> bool:
    row = conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type IN ('table','view') AND name = ?",
        (table_name,),
    ).fetchone()
    return row is not None


def _load_config_or_none(config_path: Path) -> RulesDbConfig | None:
    try:
        return _load_config(config_path)
    except SystemExit:
        return None


def _pick_book_cfg(config: RulesDbConfig | None, book_key: str | None) -> BookConfig | None:
    if config is None:
        return None
    if book_key:
        for b in config.books:
            if b.key == book_key:
                return b
        raise SystemExit(f"Unknown book key '{book_key}' in config")
    if len(config.books) == 1:
        return config.books[0]
    return None


def _pick_book_id(conn: sqlite3.Connection, book_cfg: BookConfig | None) -> int:
    if book_cfg is None:
        rows = conn.execute(
            "SELECT id, title, source_label FROM books ORDER BY id"
        ).fetchall()
        if not rows:
            raise SystemExit("No books found in DB. Run: python scripts/rulesdb.py extract")
        if len(rows) > 1:
            raise SystemExit("Multiple books present; specify --book with a config file.")
        return int(rows[0]["id"])

    row = conn.execute(
        "SELECT id FROM books WHERE title = ? AND source_label = ? ORDER BY id",
        (book_cfg.title, book_cfg.source_label),
    ).fetchone()
    if not row:
        raise SystemExit(
            f"Book not found in DB: title='{book_cfg.title}' source_label='{book_cfg.source_label}'. "
            "Run extract first."
        )
    return int(row["id"])


def cmd_init(args: argparse.Namespace) -> int:
    if not SCHEMA_PATH.exists():
        raise SystemExit(f"Missing schema file: {SCHEMA_PATH}")

    _ensure_dirs()
    db_path = Path(args.db).resolve() if args.db else DEFAULT_DB_PATH

    with _connect(db_path) as conn:
        _exec_sql_file(conn, SCHEMA_PATH)

        fts_ok = _fts5_available(conn)
        if fts_ok and FTS_SCHEMA_PATH.exists():
            _exec_sql_file(conn, FTS_SCHEMA_PATH)

        _set_meta(conn, "schema_version", "1")
        _set_meta(conn, "schema_applied_at_utc", _utc_now_iso())
        _set_meta(conn, "fts5_enabled", "1" if fts_ok else "0")
        conn.commit()

    print(f"Initialized DB: {db_path}")
    return 0


def _sha256_file(path: Path, *, chunk_size: int = 1024 * 1024) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        while True:
            chunk = f.read(chunk_size)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def _norm_ws_for_id(text: str) -> str:
    return " ".join(text.split()).strip()


def _stable_block_id(
    *,
    book_id: int,
    logical_page_number: int,
    bbox: tuple[float, float, float, float],
    text_raw: str,
) -> str:
    x0, y0, x1, y1 = bbox
    bbox_s = f"{x0:.2f},{y0:.2f},{x1:.2f},{y1:.2f}"
    norm_text = _norm_ws_for_id(text_raw)
    src = f"{book_id}:{logical_page_number}:{bbox_s}:{norm_text}"
    return hashlib.sha1(src.encode("utf-8")).hexdigest()


@dataclass(frozen=True)
class BookSourceConfig:
    source_label: str
    pdf_relpath: str
    pdf_page_1_logical_page: int


@dataclass(frozen=True)
class BookConfig:
    key: str
    title: str
    edition: str | None
    source_label: str
    sources: list[BookSourceConfig]


@dataclass(frozen=True)
class RulesDbConfig:
    db_path: str | None
    rulebooks_dir: str | None
    books: list[BookConfig]


def _load_config(config_path: Path) -> RulesDbConfig:
    if not config_path.exists():
        raise SystemExit(
            f"Missing config: {config_path} (copy from rules_db/config.example.toml)"
        )

    data = tomllib.loads(config_path.read_text(encoding="utf-8"))
    db_path = cast(str | None, data.get("db_path"))
    rulebooks_dir = cast(str | None, data.get("rulebooks_dir"))

    books_section = data.get("books")
    if not isinstance(books_section, dict) or not books_section:
        raise SystemExit(f"Config missing [books.*] sections: {config_path}")

    books: list[BookConfig] = []
    for key, raw in books_section.items():
        if not isinstance(raw, dict):
            raise SystemExit(f"Config [books.{key}] must be a table: {config_path}")

        title = raw.get("title")
        edition = raw.get("edition")
        source_label = raw.get("source_label")
        sources_raw = raw.get("sources", [])

        if not isinstance(title, str) or not title.strip():
            raise SystemExit(f"Config [books.{key}].title is required: {config_path}")
        if edition is not None and not isinstance(edition, str):
            raise SystemExit(f"Config [books.{key}].edition must be string: {config_path}")
        if not isinstance(source_label, str) or not source_label.strip():
            raise SystemExit(
                f"Config [books.{key}].source_label is required: {config_path}"
            )
        if not isinstance(sources_raw, list) or not sources_raw:
            raise SystemExit(
                f"Config requires [[books.{key}.sources]] entries: {config_path}"
            )

        sources: list[BookSourceConfig] = []
        for idx, s in enumerate(sources_raw, start=1):
            if not isinstance(s, dict):
                raise SystemExit(
                    f"Config [[books.{key}.sources]] #{idx} must be a table: {config_path}"
                )
            sl = s.get("source_label")
            pr = s.get("pdf_relpath")
            off = s.get("pdf_page_1_logical_page")
            if not isinstance(sl, str) or not sl.strip():
                raise SystemExit(
                    f"Config [[books.{key}.sources]].source_label is required: {config_path}"
                )
            if not isinstance(pr, str) or not pr.strip():
                raise SystemExit(
                    f"Config [[books.{key}.sources]].pdf_relpath is required: {config_path}"
                )
            if not isinstance(off, int) or off < 1:
                raise SystemExit(
                    f"Config [[books.{key}.sources]].pdf_page_1_logical_page must be int >= 1: {config_path}"
                )
            sources.append(
                BookSourceConfig(source_label=sl, pdf_relpath=pr, pdf_page_1_logical_page=off)
            )

        books.append(
            BookConfig(
                key=str(key),
                title=title,
                edition=cast(str | None, edition),
                source_label=source_label,
                sources=sources,
            )
        )

    return RulesDbConfig(db_path=db_path, rulebooks_dir=rulebooks_dir, books=books)


def _resolve_pdf_path(config: RulesDbConfig, pdf_relpath: str) -> Path:
    p = Path(pdf_relpath)
    if p.is_absolute():
        return p
    # By convention PDFs live under `.rule-books/`, but config may specify an explicit path.
    base = Path(config.rulebooks_dir) if config.rulebooks_dir else ROOT
    # If pdf_relpath already includes `.rule-books/...` we keep it relative to repo root.
    p_posix = p.as_posix()
    if p_posix == ".rule-books" or p_posix.startswith(".rule-books/"):
        return (ROOT / p).resolve()
    return (ROOT / base / p).resolve()


def _ensure_book(conn: sqlite3.Connection, cfg: BookConfig) -> int:
    row = conn.execute(
        "SELECT id FROM books WHERE source_label = ? AND title = ?",
        (cfg.source_label, cfg.title),
    ).fetchone()
    now = _utc_now_iso()
    if row:
        book_id = int(row["id"])
        conn.execute(
            "UPDATE books SET edition = ?, updated_at = ? WHERE id = ?",
            (cfg.edition, now, book_id),
        )
        return book_id

    cur = conn.execute(
        """
        INSERT INTO books(title, edition, source_label, logical_page_count, notes, created_at, updated_at)
        VALUES(?, ?, ?, NULL, NULL, ?, ?)
        """,
        (cfg.title, cfg.edition, cfg.source_label, now, now),
    )
    return int(cur.lastrowid)


def _upsert_book_source(
    conn: sqlite3.Connection,
    *,
    book_id: int,
    src: BookSourceConfig,
    pdf_path: Path,
    pdf_sha256: str,
) -> int:
    now = _utc_now_iso()

    row = conn.execute(
        "SELECT id FROM book_sources WHERE book_id = ? AND source_label = ?",
        (book_id, src.source_label),
    ).fetchone()

    if row:
        source_id = int(row["id"])
        conn.execute(
            """
            UPDATE book_sources
            SET pdf_relpath = ?, pdf_sha256 = ?, pdf_page_1_logical_page = ?
            WHERE id = ?
            """,
            (src.pdf_relpath, pdf_sha256, src.pdf_page_1_logical_page, source_id),
        )
        return source_id

    cur = conn.execute(
        """
        INSERT INTO book_sources(
          book_id, source_label, pdf_relpath, pdf_sha256, pdf_page_count, pdf_page_1_logical_page, created_at
        )
        VALUES(?, ?, ?, ?, NULL, ?, ?)
        """,
        (
            book_id,
            src.source_label,
            src.pdf_relpath,
            pdf_sha256,
            src.pdf_page_1_logical_page,
            now,
        ),
    )
    return int(cur.lastrowid)


@dataclass(frozen=True)
class DoctorCheck:
    name: str
    ok: bool
    detail: str
    severity: str = "error"  # "error" | "warn"


def _doctor_checks(db_path: Path) -> list[DoctorCheck]:
    checks: list[DoctorCheck] = []

    checks.append(
        DoctorCheck(
            name="schema.sql",
            ok=SCHEMA_PATH.exists(),
            detail=str(SCHEMA_PATH),
        )
    )

    checks.append(
        DoctorCheck(
            name="config.toml",
            ok=DEFAULT_CONFIG_PATH.exists(),
            detail=str(DEFAULT_CONFIG_PATH),
            severity="warn",
        )
    )

    checks.append(DoctorCheck(name="db exists", ok=db_path.exists(), detail=str(db_path)))

    if db_path.exists():
        try:
            with _connect(db_path) as conn:
                fts_ok = _fts5_available(conn)
                checks.append(
                    DoctorCheck(
                        name="sqlite fts5",
                        ok=fts_ok,
                        detail="available" if fts_ok else "not available",
                    )
                )
                # Basic sanity: required tables exist.
                required_tables = {
                    "books",
                    "book_sources",
                    "pages",
                    "blocks",
                    "entities",
                    "entity_text",
                    "chunks",
                    "embeddings",
                    "meta",
                }
                rows = conn.execute(
                    "SELECT name FROM sqlite_master WHERE type='table'"
                ).fetchall()
                existing = {r["name"] for r in rows}
                missing = sorted(required_tables - existing)
                checks.append(
                    DoctorCheck(
                        name="tables",
                        ok=not missing,
                        detail="ok" if not missing else f"missing: {', '.join(missing)}",
                    )
                )
        except sqlite3.Error as e:
            checks.append(DoctorCheck(name="db open", ok=False, detail=str(e)))

    return checks


def cmd_doctor(args: argparse.Namespace) -> int:
    db_path = Path(args.db).resolve() if args.db else DEFAULT_DB_PATH
    checks = _doctor_checks(db_path)

    width = max(len(c.name) for c in checks) if checks else 10
    any_fail = False
    for c in checks:
        if c.ok:
            status = "OK"
        else:
            status = "WARN" if c.severity == "warn" else "FAIL"
            any_fail = any_fail or (c.severity != "warn")
        print(f"{c.name.ljust(width)} : {status}  ({c.detail})")

    if any_fail:
        print("\nNext:")
        print("- If DB is missing, run: python scripts/rulesdb.py init")
        print("- If PDFs are missing, place them under `.rule-books/` and configure `rules_db/config.toml`.")
        return 2
    return 0


def _iter_pdf_sources(config: RulesDbConfig, book: BookConfig) -> Iterable[tuple[BookSourceConfig, Path]]:
    for s in book.sources:
        pdf_path = _resolve_pdf_path(config, s.pdf_relpath)
        yield s, pdf_path


def _sorted_blocks_for_page(
    *,
    blocks: list[tuple[float, float, float, float, str, int, int]],
    page_width: float,
) -> list[tuple[float, float, float, float, str]]:
    """
    Input is PyMuPDF `get_text("blocks")` tuples:
      (x0, y0, x1, y1, text, block_no, block_type)
    """

    def is_full_width(x0: float, x1: float) -> bool:
        return (x1 - x0) >= (page_width * 0.80)

    valid_blocks = []
    x_centers = []

    for b in blocks:
        x0, y0, x1, y1, text, _, block_type = b
        if block_type != 0:
            continue
        t = text.strip()
        if not t:
            continue
        valid_blocks.append((x0, y0, x1, y1, t))
        if not is_full_width(x0, x1):
            x_centers.append((x0 + x1) / 2.0)

    x_centers.sort()
    columns = []
    if x_centers:
        current_cluster = [x_centers[0]]
        for xc in x_centers[1:]:
            # Group centers within ~72 points (1 inch) of each other
            if xc - current_cluster[-1] < 72.0:
                current_cluster.append(xc)
            else:
                columns.append(sum(current_cluster) / len(current_cluster))
                current_cluster = [xc]
        columns.append(sum(current_cluster) / len(current_cluster))

    items: list[tuple[tuple[int, int, float, float, float], tuple[float, float, float, float, str]]] = []
    for x0, y0, x1, y1, t in valid_blocks:
        full = is_full_width(x0, x1)
        if full:
            group = 0
            col = 0
        else:
            group = 1
            xc = (x0 + x1) / 2.0
            if columns:
                col = min(range(len(columns)), key=lambda i: abs(columns[i] - xc))
            else:
                col = 0

        sort_key = (group, col, y0, x0, y1)
        items.append((sort_key, (x0, y0, x1, y1, t)))

    items.sort(key=lambda it: it[0])
    return [it[1] for it in items]


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


def _norm_hf_signature(text_raw: str) -> str:
    """
    Normalize header/footer candidate text for repeat detection.

    Many PDFs include changing page numbers in headers/footers. We strip standalone numeric lines
    and trailing numeric tokens so that e.g. "ADVANTAGES\\n33" and "ADVANTAGES\\n35" share a signature.
    """
    t = text_raw.replace("\r\n", "\n").replace("\r", "\n")
    lines: list[str] = []
    for ln in t.splitlines():
        s = " ".join(ln.split()).strip()
        if not s:
            continue
        if re.fullmatch(r"\d{1,3}", s):
            continue
        lines.append(s)
    joined = " ".join(lines).strip()
    if not joined:
        return ""
    parts = joined.split()
    while len(parts) >= 2 and re.fullmatch(r"\d{1,3}", parts[-1]):
        parts.pop()
    return " ".join(parts).strip()


def _detect_repeating_header_footer_texts(
    conn: sqlite3.Connection,
    *,
    book_id: int,
    freq_ratio: float = 0.60,
    max_text_len: int = 140,
) -> tuple[set[str], set[str], dict[str, object]]:
    """
    Returns sets of normalized texts to treat as header/footer candidates, plus report stats.
    """
    pages = conn.execute(
        "SELECT logical_page_number, extraction_meta FROM pages WHERE book_id = ? ORDER BY logical_page_number",
        (book_id,),
    ).fetchall()
    total_pages = len(pages)
    if total_pages == 0:
        return set(), set(), {"total_pages": 0}

    threshold = max(1, int(total_pages * freq_ratio))
    top_counts: dict[str, int] = {}
    bottom_counts: dict[str, int] = {}

    for p in pages:
        logical_page = int(p["logical_page_number"])
        meta = _json_load(cast(str | None, p["extraction_meta"])) or {}
        page_height = float(meta.get("page_height") or 0.0)
        top_y = page_height * 0.08 if page_height > 0 else None
        bot_y = page_height * 0.92 if page_height > 0 else None

        blocks = conn.execute(
            "SELECT text_raw, bbox FROM blocks WHERE book_id = ? AND logical_page_number = ?",
            (book_id, logical_page),
        ).fetchall()
        for b in blocks:
            t_raw = cast(str, b["text_raw"])
            t_norm = _norm_hf_signature(t_raw)
            if not t_norm or len(t_norm) > max_text_len:
                continue

            bbox = _json_load(cast(str | None, b["bbox"])) or {}
            y0 = float(bbox.get("y0") or 0.0)
            y1 = float(bbox.get("y1") or 0.0)

            if top_y is not None and y0 <= top_y:
                top_counts[t_norm] = top_counts.get(t_norm, 0) + 1
            if bot_y is not None and y1 >= bot_y:
                bottom_counts[t_norm] = bottom_counts.get(t_norm, 0) + 1

    header_texts = {t for t, c in top_counts.items() if c >= threshold}
    footer_texts = {t for t, c in bottom_counts.items() if c >= threshold}

    def _top_items(d: dict[str, int]) -> list[dict[str, object]]:
        items = [{"text": k, "count": v} for k, v in d.items() if v >= threshold]
        items.sort(key=lambda x: int(cast(int, x["count"])), reverse=True)
        return items[:50]

    report = {
        "total_pages": total_pages,
        "threshold_pages": threshold,
        "header_candidates": _top_items(top_counts),
        "footer_candidates": _top_items(bottom_counts),
    }
    return header_texts, footer_texts, report


def cmd_clean(args: argparse.Namespace) -> int:
    config_path = Path(args.config).resolve() if args.config else DEFAULT_CONFIG_PATH
    config = _load_config_or_none(config_path)
    db_path = (
        Path(args.db).resolve()
        if args.db
        else Path(config.db_path).resolve()
        if config and config.db_path
        else DEFAULT_DB_PATH
    )

    with _connect(db_path) as conn:
        book_cfg = _pick_book_cfg(config, args.book)
        book_id = _pick_book_id(conn, book_cfg)

        header_texts, footer_texts, hf_report = _detect_repeating_header_footer_texts(
            conn,
            book_id=book_id,
            freq_ratio=float(args.hf_ratio),
        )

        updated_blocks = 0
        updated_pages = 0
        started = time.time()

        pages = conn.execute(
            "SELECT logical_page_number FROM pages WHERE book_id = ? ORDER BY logical_page_number",
            (book_id,),
        ).fetchall()

        for p in pages:
            logical_page = int(p["logical_page_number"])
            blocks = conn.execute(
                """
                SELECT block_id, text_raw, bbox, reading_order, block_meta
                FROM blocks
                WHERE book_id = ? AND logical_page_number = ?
                ORDER BY reading_order
                """,
                (book_id, logical_page),
            ).fetchall()

            clean_parts: list[str] = []
            for b in blocks:
                block_id = cast(str, b["block_id"])
                text_raw = cast(str, b["text_raw"])
                norm = _norm_hf_signature(text_raw)

                block_meta = _json_load(cast(str | None, b["block_meta"])) or {}
                hf_kind: str | None = None
                if norm and norm in header_texts:
                    hf_kind = "header"
                elif norm and norm in footer_texts:
                    hf_kind = "footer"

                if hf_kind:
                    if block_meta.get("hf") != hf_kind:
                        block_meta["hf"] = hf_kind
                        conn.execute(
                            "UPDATE blocks SET block_meta = ? WHERE book_id = ? AND logical_page_number = ? AND block_id = ?",
                            (
                                json.dumps(block_meta, ensure_ascii=False),
                                book_id,
                                logical_page,
                                block_id,
                            ),
                        )
                        updated_blocks += 1
                    continue

                cleaned = _clean_block_text(text_raw)
                clean_parts.append(cleaned)

                # Update blocks.text_clean even if unchanged (idempotent); text_clean is used later for chunking/search.
                conn.execute(
                    "UPDATE blocks SET text_clean = ? WHERE book_id = ? AND logical_page_number = ? AND block_id = ?",
                    (cleaned, book_id, logical_page, block_id),
                )
                updated_blocks += 1

            page_clean = "\n\n".join(p for p in clean_parts if p).strip()
            conn.execute(
                "UPDATE pages SET text_clean = ?, updated_at = ? WHERE book_id = ? AND logical_page_number = ?",
                (page_clean, _utc_now_iso(), book_id, logical_page),
            )
            updated_pages += 1

        conn.commit()

    elapsed = round(time.time() - started, 3)
    report = {
        "book_id": book_id,
        "db_path": str(db_path),
        "config_path": str(config_path),
        "elapsed_seconds": elapsed,
        "updated_blocks": updated_blocks,
        "updated_pages": updated_pages,
        "header_footer": hf_report,
    }

    out_path = RULES_DB_DIR / "logs" / f"clean_book{book_id}_{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}.json"
    out_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Cleaned book_id={book_id} in {db_path}. Report: {out_path}")
    return 0


def _iter_clean_blocks_for_book(
    conn: sqlite3.Connection, *, book_id: int
) -> Iterable[tuple[int, str, str]]:
    """
    Yields (logical_page_number, block_id, text_clean) for non-header/footer blocks.
    """
    rows = conn.execute(
        """
        SELECT logical_page_number, block_id, text_clean, block_meta
        FROM blocks
        WHERE book_id = ?
        ORDER BY logical_page_number, reading_order
        """,
        (book_id,),
    ).fetchall()
    for r in rows:
        meta = _json_load(cast(str | None, r["block_meta"])) or {}
        if meta.get("hf") in ("header", "footer"):
            continue
        yield (
            int(r["logical_page_number"]),
            cast(str, r["block_id"]),
            cast(str, r["text_clean"] or ""),
        )


def cmd_chunk(args: argparse.Namespace) -> int:
    config_path = Path(args.config).resolve() if args.config else DEFAULT_CONFIG_PATH
    config = _load_config_or_none(config_path)
    db_path = (
        Path(args.db).resolve()
        if args.db
        else Path(config.db_path).resolve()
        if config and config.db_path
        else DEFAULT_DB_PATH
    )

    target_chars = int(args.target_chars)
    overlap_chars = int(args.overlap_chars)
    if target_chars < 400:
        raise SystemExit("--target-chars too small (min 400)")
    if overlap_chars < 0 or overlap_chars >= target_chars:
        raise SystemExit("--overlap-chars must be >=0 and < target-chars")

    started = time.time()
    out_dir = RULES_DB_DIR / "logs"
    out_dir.mkdir(parents=True, exist_ok=True)

    with _connect(db_path) as conn:
        book_cfg = _pick_book_cfg(config, args.book)
        book_id = _pick_book_id(conn, book_cfg)
        fts_enabled = _table_exists(conn, "chunks_fts")

        if args.mode == "replace":
            conn.execute("DELETE FROM chunks WHERE book_id = ?", (book_id,))
            if fts_enabled:
                # Contentless table: easiest is to delete all and rebuild.
                conn.execute("DELETE FROM chunks_fts")
            conn.commit()

        # Build chunks from blocks.
        current_blocks: list[tuple[int, str, str]] = []  # (page, block_id, text)
        current_len = 0
        created = 0

        def flush_chunk() -> None:
            nonlocal created, current_blocks, current_len
            if not current_blocks:
                return

            text_parts = [t for _, _, t in current_blocks if t]
            text = "\n\n".join(text_parts).strip()
            if not text:
                current_blocks = []
                current_len = 0
                return

            pages = [p for p, _, _ in current_blocks]
            start_page = min(pages)
            end_page = max(pages)
            block_refs = [{"page": p, "block_id": bid} for p, bid, _ in current_blocks]
            now = _utc_now_iso()
            cur = conn.execute(
                """
                INSERT INTO chunks(book_id, start_page, end_page, text_clean, tags, entity_ids, block_refs, created_at)
                VALUES(?, ?, ?, ?, '[]', NULL, ?, ?)
                """,
                (book_id, start_page, end_page, text, json.dumps(block_refs, ensure_ascii=False), now),
            )
            chunk_id = int(cur.lastrowid)

            if fts_enabled:
                conn.execute(
                    "INSERT INTO chunks_fts(text_clean, chunk_id) VALUES(?, ?)",
                    (text, chunk_id),
                )

            created += 1

            # Apply overlap by trimming from the front.
            if overlap_chars == 0:
                current_blocks = []
                current_len = 0
                return

            while current_blocks and current_len > overlap_chars:
                _, _, t0 = current_blocks.pop(0)
                current_len -= len(t0)

        for page, block_id, text in _iter_clean_blocks_for_book(conn, book_id=book_id):
            t = text.strip()
            if not t:
                continue
            current_blocks.append((page, block_id, t))
            current_len += len(t)
            if current_len >= target_chars:
                flush_chunk()

            if args.max_chunks is not None and created >= int(args.max_chunks):
                break

        flush_chunk()
        conn.commit()

    elapsed = round(time.time() - started, 3)
    report = {
        "book_id": book_id,
        "db_path": str(db_path),
        "config_path": str(config_path),
        "target_chars": target_chars,
        "overlap_chars": overlap_chars,
        "mode": args.mode,
        "created_chunks": created,
        "elapsed_seconds": elapsed,
        "fts_enabled": fts_enabled,
    }
    out_path = out_dir / f"chunk_book{book_id}_{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}.json"
    out_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Chunked book_id={book_id} in {db_path}: {created} chunks. Report: {out_path}")
    return 0


def cmd_search(args: argparse.Namespace) -> int:
    config_path = Path(args.config).resolve() if args.config else DEFAULT_CONFIG_PATH
    config = _load_config_or_none(config_path)
    db_path = (
        Path(args.db).resolve()
        if args.db
        else Path(config.db_path).resolve()
        if config and config.db_path
        else DEFAULT_DB_PATH
    )

    query_in = (args.query or "").strip()
    query = query_in
    if not query:
        raise SystemExit("Query must be non-empty.")

    with _connect(db_path) as conn:
        book_cfg = _pick_book_cfg(config, args.book)
        book_id = _pick_book_id(conn, book_cfg)

        limit = int(args.limit)
        if limit < 1 or limit > 50:
            raise SystemExit("--limit must be 1..50")

        use_fts = _table_exists(conn, "chunks_fts")
        raw_fts = bool(getattr(args, "fts", False))

        if use_fts:
            # Default behavior is "plain text" search, not raw FTS syntax.
            # This avoids FTS query parser surprises for queries like "All-Out Defense".
            if not raw_fts:
                tokens = re.findall(r"[A-Za-z0-9']+", query)
                tokens = [t for t in tokens if t.strip()]
                if not tokens:
                    # Fallback: treat as a phrase (escape quotes for FTS).
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

        # Fallback: LIKE scan over chunks table.
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


def cmd_chunk_show(args: argparse.Namespace) -> int:
    config_path = Path(args.config).resolve() if args.config else DEFAULT_CONFIG_PATH
    config = _load_config_or_none(config_path)
    db_path = (
        Path(args.db).resolve()
        if args.db
        else Path(config.db_path).resolve()
        if config and config.db_path
        else DEFAULT_DB_PATH
    )

    chunk_id = int(args.chunk_id)
    if chunk_id < 1:
        raise SystemExit("chunk_id must be >= 1")

    with _connect(db_path) as conn:
        book_cfg = _pick_book_cfg(config, args.book)
        book_id = _pick_book_id(conn, book_cfg)

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

        start_page = row["start_page"]
        end_page = row["end_page"]
        pages_label = (
            f"p. {int(start_page)}-{int(end_page)}"
            if start_page is not None and end_page is not None
            else "p. ?"
        )

        print(f"Chunk {chunk_id} ({pages_label})")

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


def _is_hf_block(block_meta_json: str | None) -> bool:
    meta = _json_load(block_meta_json) or {}
    return meta.get("hf") in ("header", "footer")


def _norm_heading_key(s: str) -> str:
    s2 = s.strip().lower()
    s2 = s2.replace("—", "-").replace("–", "-")
    s2 = re.sub(r"[^a-z0-9]+", " ", s2)
    return " ".join(s2.split()).strip()


def _maneuver_name_map() -> dict[str, str]:
    # Canonical maneuver names (Basic Set combat maneuvers).
    names = [
        "Aim",
        "All-Out Attack",
        "All-Out Defense",
        "Attack",
        "Change Posture",
        "Concentrate",
        "Do Nothing",
        "Evaluate",
        "Feint",
        "Move",
        "Move and Attack",
        "Ready",
        "Wait",
    ]
    return {_norm_heading_key(n): n for n in names}


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


def _looks_like_redirect_stub(text_clean: str) -> int | None:
    """
    If text looks like a cross-reference stub ("see p. 21"), return the printed page number.
    Otherwise return None.
    """
    t = " ".join(text_clean.split()).strip()
    if not t:
        return None
    m = re.fullmatch(r"(?i)see\s+p\.\s*(?P<p>\d{1,3})\.?", t)
    if m:
        return int(m.group("p"))
    m2 = re.fullmatch(r"(?i)p\.\s*(?P<p>\d{1,3})\.?", t)
    if m2:
        return int(m2.group("p"))
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


def _build_printed_to_logical_page_map(conn: sqlite3.Connection, *, book_id: int) -> dict[int, int]:
    """
    Best-effort mapping from printed page numbers to logical (PDF) page numbers.

    Many "see p. X" references are to printed page numbers, which can differ from PDF page indices
    due to front matter. We infer mapping by scanning small top/bottom blocks for standalone numeric lines.
    """
    pages = conn.execute(
        "SELECT logical_page_number, extraction_meta FROM pages WHERE book_id = ? ORDER BY logical_page_number",
        (book_id,),
    ).fetchall()

    printed_to_logical: dict[int, int] = {}
    offsets: list[int] = []

    def pick_candidate(cands: list[int], logical_page: int) -> int | None:
        if not cands:
            return None
        if offsets:
            offsets_sorted = sorted(offsets)
            median = offsets_sorted[len(offsets_sorted) // 2]
            return min(cands, key=lambda p: abs((logical_page - p) - median))
        return max(cands)

    for p in pages:
        logical_page = int(p["logical_page_number"])
        meta = _json_load(cast(str | None, p["extraction_meta"])) or {}
        page_height = float(meta.get("page_height") or 0.0)
        if page_height <= 0:
            continue
        top_y = page_height * 0.08
        bot_y = page_height * 0.92

        blocks = conn.execute(
            "SELECT text_raw, bbox FROM blocks WHERE book_id = ? AND logical_page_number = ?",
            (book_id, logical_page),
        ).fetchall()

        candidates: list[int] = []
        for b in blocks:
            bbox = _json_load(cast(str | None, b["bbox"])) or {}
            y0 = float(bbox.get("y0") or 0.0)
            y1 = float(bbox.get("y1") or 0.0)
            if not (y0 <= top_y or y1 >= bot_y):
                continue
            t_raw = cast(str, b["text_raw"] or "")
            if not t_raw or len(t_raw) > 160:
                continue
            for ln in t_raw.replace("\r\n", "\n").replace("\r", "\n").splitlines():
                s = ln.strip()
                if re.fullmatch(r"\d{1,3}", s):
                    n = int(s)
                    if 1 <= n <= 999:
                        candidates.append(n)

        picked = pick_candidate(candidates, logical_page)
        if picked is None:
            continue
        if picked not in printed_to_logical:
            printed_to_logical[picked] = logical_page
            offsets.append(logical_page - picked)

    return printed_to_logical


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


def cmd_entity_extract(args: argparse.Namespace) -> int:
    config_path = Path(args.config).resolve() if args.config else DEFAULT_CONFIG_PATH
    config = _load_config_or_none(config_path)
    db_path = (
        Path(args.db).resolve()
        if args.db
        else Path(config.db_path).resolve()
        if config and config.db_path
        else DEFAULT_DB_PATH
    )

    kind = str(args.kind)

    with _connect(db_path) as conn:
        book_cfg = _pick_book_cfg(config, args.book)
        book_id = _pick_book_id(conn, book_cfg)

        # --- Spells ---
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

            report_dir = RULES_DB_DIR / "logs"
            report_dir.mkdir(parents=True, exist_ok=True)
            report = {
                "book_id": book_id,
                "db_path": str(db_path),
                "config_path": str(config_path),
                "kind": kind,
                "mode": args.mode,
                "created_entities": created,
                "needs_review": review_count,
                "meta": meta,
            }
            out_path = report_dir / f"entity_extract_{kind}_book{book_id}_{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}.json"
            out_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"Extracted entities ({kind}) for book_id={book_id}: {created} created. Report: {out_path}")
            return 0

        # --- Equipment ---
        if kind == "equipment":
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

            report_dir = RULES_DB_DIR / "logs"
            report_dir.mkdir(parents=True, exist_ok=True)
            report = {
                "book_id": book_id,
                "db_path": str(db_path),
                "config_path": str(config_path),
                "kind": kind,
                "mode": args.mode,
                "created_entities": created,
                "needs_review": review_count,
                "meta": meta,
            }
            out_path = report_dir / f"entity_extract_{kind}_book{book_id}_{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}.json"
            out_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"Extracted entities ({kind}) for book_id={book_id}: {created} created. Report: {out_path}")
            return 0
            
        # --- Advantages ---
        if kind == "advantages":
            start_p = _find_heading_page_after(conn, book_id=book_id, headings=["ADVANTAGES"], min_page=1)
            if start_p is None:
                raise SystemExit("Could not find ADVANTAGES heading.")
            end_p = _find_heading_page_after(
                conn, book_id=book_id, headings=["DISADVANTAGES"], min_page=start_p + 1
            )
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

            report_dir = RULES_DB_DIR / "logs"
            report_dir.mkdir(parents=True, exist_ok=True)
            report = {
                "book_id": book_id,
                "db_path": str(db_path),
                "config_path": str(config_path),
                "kind": kind,
                "mode": args.mode,
                "created_entities": created,
                "needs_review": review_count,
                "meta": meta,
            }
            out_path = report_dir / f"entity_extract_{kind}_book{book_id}_{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}.json"
            out_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"Extracted entities ({kind}) for book_id={book_id}: {created} created. Report: {out_path}")
            return 0

        # --- Disadvantages ---
        if kind == "disadvantages":
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

            report_dir = RULES_DB_DIR / "logs"
            report_dir.mkdir(parents=True, exist_ok=True)
            report = {
                "book_id": book_id,
                "db_path": str(db_path),
                "config_path": str(config_path),
                "kind": kind,
                "mode": args.mode,
                "created_entities": created,
                "needs_review": review_count,
                "meta": meta,
            }
            out_path = report_dir / f"entity_extract_{kind}_book{book_id}_{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}.json"
            out_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"Extracted entities ({kind}) for book_id={book_id}: {created} created. Report: {out_path}")
            return 0

        # --- Skills ---
        if kind == "skills":
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

            report_dir = RULES_DB_DIR / "logs"
            report_dir.mkdir(parents=True, exist_ok=True)
            report = {
                "book_id": book_id,
                "db_path": str(db_path),
                "config_path": str(config_path),
                "kind": kind,
                "mode": args.mode,
                "created_entities": created,
                "needs_review": review_count,
                "meta": meta,
            }
            out_path = report_dir / f"entity_extract_{kind}_book{book_id}_{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}.json"
            out_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"Extracted entities ({kind}) for book_id={book_id}: {created} created. Report: {out_path}")
            return 0

        # --- Maneuvers ---
        heading_map = _maneuver_name_map()
        maneuver_names = sorted(set(heading_map.values()))

        if args.mode == "replace":
            placeholders = ",".join("?" for _ in maneuver_names)
            # Delete prior extracted maneuvers (rule entities with these exact names).
            # This keeps the operation scoped without requiring schema changes for subtype tagging.
            entity_ids = [
                int(r["id"])
                for r in conn.execute(
                    f"""
                    SELECT id FROM entities
                    WHERE book_id = ? AND type = 'rule' AND name IN ({placeholders})
                    """,
                    [book_id, *maneuver_names],
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

        # Build a linear sequence of non-header/footer blocks.
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

        starts: list[tuple[int, str]] = []  # (index, canonical_name)
        for idx, b in enumerate(seq):
            t = cast(str, b["text_clean"])
            match = _block_heading_match(t, heading_map)
            if match:
                starts.append((idx, match))

        if not starts:
            raise SystemExit(
                "No maneuver headings detected in blocks. "
                "Run clean first and ensure blocks.text_clean is populated."
            )

        starts.sort(key=lambda x: x[0])
        min_chars = int(args.min_chars)
        max_span_pages = int(args.max_span_pages)
        cluster_gap_pages = int(args.cluster_gap_pages)
        cluster_choice = str(args.cluster)
        cluster_tail_pages = int(args.cluster_tail_pages)

        # Compute start pages for clustering.
        starts_with_page: list[tuple[int, str, int]] = []
        for idx, name in starts:
            starts_with_page.append((idx, name, cast(int, seq[idx]["page"])))
        starts_with_page.sort(key=lambda x: (x[2], x[0]))

        # Cluster by page gaps.
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
            # Higher uniq/count better; smaller span better; earlier start as final tie-break.
            return (uniq, count, -span, -start_p)

        if not clusters:
            raise SystemExit("No clusters found (unexpected).")

        clusters_sorted = sorted(clusters, key=cluster_score, reverse=True)
        chosen_cluster: list[tuple[int, str, int]]
        if cluster_choice == "auto":
            chosen_cluster = clusters_sorted[0]
        elif cluster_choice == "earliest":
            chosen_cluster = min(clusters, key=lambda c: min(h[2] for h in c))
        elif cluster_choice == "latest":
            chosen_cluster = max(clusters, key=lambda c: max(h[2] for h in c))
        else:
            raise SystemExit("Invalid --cluster choice.")

        # Use only hits from chosen cluster, ordered by sequence index.
        chosen_hits = sorted(chosen_cluster, key=lambda x: x[0])
        chosen_names = [h[1] for h in chosen_hits]
        duplicates_in_cluster = {n: chosen_names.count(n) for n in set(chosen_names) if chosen_names.count(n) > 1}

        # Optional: within a cluster, keep first occurrence of each heading.
        seen: set[str] = set()
        filtered_hits: list[tuple[int, str, int]] = []
        for idx, name, page in chosen_hits:
            if name in seen:
                continue
            seen.add(name)
            filtered_hits.append((idx, name, page))

        now = _utc_now_iso()
        created = 0
        review_count = 0

        cluster_max_page = max(h[2] for h in chosen_cluster)
        cluster_page_limit = cluster_max_page + cluster_tail_pages
        # Last index in seq that is still within the cluster page boundary.
        cluster_end_idx = len(seq) - 1
        while cluster_end_idx > 0 and cast(int, seq[cluster_end_idx]["page"]) > cluster_page_limit:
            cluster_end_idx -= 1

        for pos, (start_idx, name, start_page) in enumerate(filtered_hits):
            next_idx = filtered_hits[pos + 1][0] if pos + 1 < len(filtered_hits) else None

            # Cap span by pages to prevent runaway captures.
            max_page_allowed = start_page + max_span_pages
            end_idx = len(seq) - 1
            if next_idx is not None:
                end_idx = min(end_idx, next_idx - 1)
            end_idx = min(end_idx, cluster_end_idx)
            # Also cap by page.
            while end_idx > start_idx and cast(int, seq[end_idx]["page"]) > max_page_allowed:
                end_idx -= 1
            # Stop at a new major section heading if it appears before the next maneuver.
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
                    json.dumps([name], ensure_ascii=False),
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

    # Report
    report_dir = RULES_DB_DIR / "logs"
    report_dir.mkdir(parents=True, exist_ok=True)
    clusters_report = []
    for c in clusters_sorted[:10]:
        pages = [h[2] for h in c]
        clusters_report.append(
            {
                "start_page": min(pages),
                "end_page": max(pages),
                "span_pages": max(pages) - min(pages),
                "hits": len(c),
                "unique_names": len(set(h[1] for h in c)),
                "names": sorted(set(h[1] for h in c)),
            }
        )
    report = {
        "book_id": book_id,
        "db_path": str(db_path),
        "config_path": str(config_path),
        "kind": kind,
        "mode": args.mode,
        "cluster_gap_pages": cluster_gap_pages,
        "cluster_choice": cluster_choice,
        "cluster_tail_pages": cluster_tail_pages,
        "max_span_pages": max_span_pages,
        "created_entities": created,
        "needs_review": review_count,
        "detected_headings_total": len(starts),
        "detected_unique_headings": len(set(n for _, n in starts)),
        "chosen_cluster": {
            "start_page": min(h[2] for h in chosen_cluster),
            "end_page": max(h[2] for h in chosen_cluster),
            "unique_names": len(set(h[1] for h in chosen_cluster)),
            "duplicates_in_cluster": duplicates_in_cluster,
        },
        "clusters_top": clusters_report,
    }
    out_path = report_dir / f"entity_extract_{kind}_book{book_id}_{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}.json"
    out_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Extracted entities ({kind}) for book_id={book_id}: {created} created. Report: {out_path}")
    return 0


def cmd_entity_show(args: argparse.Namespace) -> int:
    config_path = Path(args.config).resolve() if args.config else DEFAULT_CONFIG_PATH
    config = _load_config_or_none(config_path)
    db_path = (
        Path(args.db).resolve()
        if args.db
        else Path(config.db_path).resolve()
        if config and config.db_path
        else DEFAULT_DB_PATH
    )

    with _connect(db_path) as conn:
        book_cfg = _pick_book_cfg(config, args.book)
        book_id = _pick_book_id(conn, book_cfg)

        if args.id is not None:
            row = conn.execute(
                """
                SELECT e.id, e.type, e.name, e.start_page, e.end_page, e.needs_review, e.review_reason,
                       t.text_raw, t.primary_citation, t.block_refs
                FROM entities e
                JOIN entity_text t ON t.entity_id = e.id
                WHERE e.id = ?
                """,
                (int(args.id),),
            ).fetchone()
        else:
            name = (args.name or "").strip()
            if not name:
                raise SystemExit("Provide --id or a name.")
            row = conn.execute(
                """
                SELECT e.id, e.type, e.name, e.start_page, e.end_page, e.needs_review, e.review_reason,
                       t.text_raw, t.primary_citation, t.block_refs
                FROM entities e
                JOIN entity_text t ON t.entity_id = e.id
                WHERE e.book_id = ? AND e.name = ?
                ORDER BY e.id
                LIMIT 1
                """,
                (book_id, name),
            ).fetchone()
            if not row:
                # Fallback: resolve by alias.
                alias_token = json.dumps(name, ensure_ascii=False)
                row = conn.execute(
                    """
                    SELECT e.id, e.type, e.name, e.start_page, e.end_page, e.needs_review, e.review_reason,
                           t.text_raw, t.primary_citation, t.block_refs
                    FROM entities e
                    JOIN entity_text t ON t.entity_id = e.id
                    WHERE e.book_id = ? AND e.aliases LIKE ?
                    ORDER BY e.name, e.id
                    LIMIT 1
                    """,
                    (book_id, f"%{alias_token}%"),
                ).fetchone()

        if not row:
            raise SystemExit("Entity not found.")

        pages = (
            f"p. {int(row['start_page'])}-{int(row['end_page'])}"
            if row["start_page"] is not None and row["end_page"] is not None
            else "p. ?"
        )
        review = ""
        if int(row["needs_review"]) == 1:
            review = f" [needs_review: {row['review_reason']}]"
        print(f"Entity {int(row['id'])}: {cast(str, row['type'])} — {cast(str, row['name'])} ({pages}){review}")

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
        print(cast(str, row["text_raw"] or ""))
        return 0


def cmd_entity_search(args: argparse.Namespace) -> int:
    config_path = Path(args.config).resolve() if args.config else DEFAULT_CONFIG_PATH
    config = _load_config_or_none(config_path)
    db_path = (
        Path(args.db).resolve()
        if args.db
        else Path(config.db_path).resolve()
        if config and config.db_path
        else DEFAULT_DB_PATH
    )

    q = (args.query or "").strip()
    if not q:
        raise SystemExit("Query must be non-empty.")

    with _connect(db_path) as conn:
        book_cfg = _pick_book_cfg(config, args.book)
        book_id = _pick_book_id(conn, book_cfg)

        limit = int(args.limit)
        if limit < 1 or limit > 50:
            raise SystemExit("--limit must be 1..50")

        rows = conn.execute(
            """
            SELECT id, type, name, start_page, end_page, needs_review
            FROM entities
            WHERE book_id = ? AND (name LIKE ? OR aliases LIKE ?)
            ORDER BY name, id
            LIMIT ?
            """,
            (book_id, f"%{q}%", f"%{q}%", limit),
        ).fetchall()

        if not rows:
            print("No results.")
            return 0

        for r in rows:
            pages = (
                f"p. {int(r['start_page'])}-{int(r['end_page'])}"
                if r["start_page"] is not None and r["end_page"] is not None
                else "p. ?"
            )
            flag = " *review" if int(r["needs_review"]) == 1 else ""
            print(f"- {int(r['id'])}: {cast(str, r['type'])} {cast(str, r['name'])} ({pages}){flag}")
        return 0


def cmd_extract(args: argparse.Namespace) -> int:
    try:
        import fitz  # PyMuPDF
    except Exception as e:  # pragma: no cover
        raise SystemExit(f"PyMuPDF not available (import fitz failed): {e}") from e

    config_path = Path(args.config).resolve() if args.config else DEFAULT_CONFIG_PATH
    config = _load_config(config_path)

    _ensure_dirs()
    db_path = Path(args.db).resolve() if args.db else Path(config.db_path).resolve() if config.db_path else DEFAULT_DB_PATH
    report_dir = RULES_DB_DIR / "logs"
    report_dir.mkdir(parents=True, exist_ok=True)

    with _connect(db_path) as conn:
        # Ensure schema exists.
        if not SCHEMA_PATH.exists():
            raise SystemExit(f"Missing schema file: {SCHEMA_PATH}")
        _exec_sql_file(conn, SCHEMA_PATH)

        selected_books = config.books
        if args.book:
            selected_books = [b for b in selected_books if b.key == args.book]
            if not selected_books:
                raise SystemExit(f"Unknown book key '{args.book}' in {config_path}")

        for book_cfg in selected_books:
            book_id = _ensure_book(conn, book_cfg)
            started = time.time()

            report: dict[str, object] = {
                "book_key": book_cfg.key,
                "book_id": book_id,
                "title": book_cfg.title,
                "source_label": book_cfg.source_label,
                "extraction": {
                    "started_at_utc": _utc_now_iso(),
                    "tool": f"pymupdf {getattr(fitz, '__version__', 'unknown')}",
                    "db_path": str(db_path),
                    "config_path": str(config_path),
                },
                "sources": [],
                "suspicious_pages": [],
                "header_footer_candidates": {"top": [], "bottom": []},
                "stats": {},
            }

            top_counts: dict[str, int] = {}
            bottom_counts: dict[str, int] = {}
            page_records: list[dict[str, object]] = []
            total_pages_processed = 0

            for source_cfg, pdf_path in _iter_pdf_sources(config, book_cfg):
                if not pdf_path.exists():
                    raise SystemExit(
                        f"Missing PDF for '{book_cfg.key}:{source_cfg.source_label}': {pdf_path}"
                    )

                pdf_sha256 = _sha256_file(pdf_path)
                source_id = _upsert_book_source(
                    conn,
                    book_id=book_id,
                    src=source_cfg,
                    pdf_path=pdf_path,
                    pdf_sha256=pdf_sha256,
                )

                with fitz.open(pdf_path) as doc:
                    pdf_page_count = int(doc.page_count)
                    conn.execute(
                        "UPDATE book_sources SET pdf_page_count = ? WHERE id = ?",
                        (pdf_page_count, source_id),
                    )

                    src_report: dict[str, object] = {
                        "source_label": source_cfg.source_label,
                        "pdf_path": str(pdf_path),
                        "pdf_sha256": pdf_sha256,
                        "pdf_page_count": pdf_page_count,
                        "pdf_page_1_logical_page": source_cfg.pdf_page_1_logical_page,
                        "pages": [],
                    }

                    max_pages = args.max_pages if args.max_pages is not None else pdf_page_count
                    for pdf_page_number in range(1, min(pdf_page_count, max_pages) + 1):
                        logical_page_number = (
                            pdf_page_number + source_cfg.pdf_page_1_logical_page - 1
                        )

                        page = doc.load_page(pdf_page_number - 1)
                        page_rect = page.rect
                        page_width = float(page_rect.width)
                        page_height = float(page_rect.height)

                        raw_blocks = cast(
                            list[tuple[float, float, float, float, str, int, int]],
                            page.get_text("blocks"),
                        )
                        ordered_blocks = _sorted_blocks_for_page(
                            blocks=raw_blocks, page_width=page_width
                        )

                        blocks_for_storage: list[dict[str, object]] = []
                        for idx, (x0, y0, x1, y1, text) in enumerate(ordered_blocks, start=1):
                            bbox = (float(x0), float(y0), float(x1), float(y1))
                            block_id = _stable_block_id(
                                book_id=book_id,
                                logical_page_number=logical_page_number,
                                bbox=bbox,
                                text_raw=text,
                            )
                            blocks_for_storage.append(
                                {
                                    "block_id": block_id,
                                    "bbox": bbox,
                                    "reading_order": idx,
                                    "text_raw": text,
                                }
                            )

                        page_text_raw = "\n\n".join(b["text_raw"] for b in blocks_for_storage)
                        page_text_clean = page_text_raw.replace("\r\n", "\n").replace("\r", "\n")

                        extraction_meta = {
                            "pdf_page_number": pdf_page_number,
                            "logical_page_number": logical_page_number,
                            "page_width": page_width,
                            "page_height": page_height,
                            "block_count": len(blocks_for_storage),
                            "char_count_raw": len(page_text_raw),
                            "tool": f"pymupdf {getattr(fitz, '__version__', 'unknown')}",
                        }

                        now = _utc_now_iso()
                        skip_page = False
                        try:
                            conn.execute(
                                """
                                INSERT INTO pages(
                                  book_id, logical_page_number, source_id, pdf_page_number,
                                  text_raw, text_clean, extraction_meta, created_at, updated_at
                                )
                                VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)
                                """,
                                (
                                    book_id,
                                    logical_page_number,
                                    source_id,
                                    pdf_page_number,
                                    page_text_raw,
                                    page_text_clean,
                                    json.dumps(extraction_meta, ensure_ascii=False),
                                    now,
                                    now,
                                ),
                            )
                        except sqlite3.IntegrityError:
                            if args.mode == "skip":
                                skip_page = True
                            elif args.mode not in ("upsert", "replace"):
                                raise

                            if skip_page:
                                continue

                            # Conflict on logical page suggests overlapping source mapping; fail fast.
                            existing = conn.execute(
                                """
                                SELECT source_id, pdf_page_number
                                FROM pages
                                WHERE book_id = ? AND logical_page_number = ?
                                """,
                                (book_id, logical_page_number),
                            ).fetchone()
                            if existing and int(existing["source_id"]) != source_id:
                                raise SystemExit(
                                    "Logical page collision detected. "
                                    f"book_id={book_id} logical_page={logical_page_number} "
                                    f"already mapped to source_id={existing['source_id']} pdf_page={existing['pdf_page_number']}; "
                                    f"new source_id={source_id} pdf_page={pdf_page_number}. "
                                    "Fix `pdf_page_1_logical_page` offsets in rules_db/config.toml."
                                )

                            conn.execute(
                                """
                                UPDATE pages
                                SET source_id = ?, pdf_page_number = ?, text_raw = ?, text_clean = ?,
                                    extraction_meta = ?, updated_at = ?
                                WHERE book_id = ? AND logical_page_number = ?
                                """,
                                (
                                    source_id,
                                    pdf_page_number,
                                    page_text_raw,
                                    page_text_clean,
                                    json.dumps(extraction_meta, ensure_ascii=False),
                                    now,
                                    book_id,
                                    logical_page_number,
                                ),
                            )

                        if args.mode in ("upsert", "replace"):
                            conn.execute(
                                "DELETE FROM blocks WHERE book_id = ? AND logical_page_number = ?",
                                (book_id, logical_page_number),
                            )
                            for b in blocks_for_storage:
                                x0, y0, x1, y1 = cast(
                                    tuple[float, float, float, float], b["bbox"]
                                )
                                conn.execute(
                                    """
                                    INSERT INTO blocks(
                                      book_id, logical_page_number, block_id,
                                      text_raw, text_clean, bbox, reading_order, block_meta, created_at
                                    )
                                    VALUES(?, ?, ?, ?, ?, ?, ?, NULL, ?)
                                    """,
                                    (
                                        book_id,
                                        logical_page_number,
                                        cast(str, b["block_id"]),
                                        cast(str, b["text_raw"]),
                                        cast(str, b["text_raw"]),
                                        json.dumps(
                                            {
                                                "x0": round(x0, 2),
                                                "y0": round(y0, 2),
                                                "x1": round(x1, 2),
                                                "y1": round(y1, 2),
                                            },
                                            ensure_ascii=False,
                                        ),
                                        cast(int, b["reading_order"]),
                                        now,
                                    ),
                                )

                        total_pages_processed += 1
                        page_len = len(page_text_raw)
                        if page_len < 60 or len(blocks_for_storage) < 3:
                            cast(list[object], report["suspicious_pages"]).append(
                                {
                                    "source_label": source_cfg.source_label,
                                    "pdf_page_number": pdf_page_number,
                                    "logical_page_number": logical_page_number,
                                    "block_count": len(blocks_for_storage),
                                    "char_count_raw": page_len,
                                }
                            )

                        top_y = page_height * 0.08
                        bot_y = page_height * 0.92
                        for b in blocks_for_storage:
                            x0, y0, x1, y1 = cast(
                                tuple[float, float, float, float], b["bbox"]
                            )
                            t = _norm_ws_for_id(cast(str, b["text_raw"]))
                            if not t or len(t) > 140:
                                continue
                            if y0 <= top_y:
                                top_counts[t] = top_counts.get(t, 0) + 1
                            if y1 >= bot_y:
                                bottom_counts[t] = bottom_counts.get(t, 0) + 1

                        page_records.append(
                            {
                                "source_label": source_cfg.source_label,
                                "pdf_page_number": pdf_page_number,
                                "logical_page_number": logical_page_number,
                                "block_count": len(blocks_for_storage),
                                "char_count_raw": page_len,
                            }
                        )
                        cast(list[object], src_report["pages"]).append(page_records[-1])

                cast(list[object], report["sources"]).append(src_report)

            # Header/footer candidates: anything that repeats across many pages.
            page_count_for_freq = max(1, total_pages_processed)
            threshold = int(page_count_for_freq * 0.60)

            def _top_k_repeating(d: dict[str, int]) -> list[dict[str, object]]:
                items = [{"text": k, "count": v} for k, v in d.items() if v >= threshold]
                items.sort(key=lambda x: int(cast(int, x["count"])), reverse=True)
                return items[:30]

            report["header_footer_candidates"] = {
                "top": _top_k_repeating(top_counts),
                "bottom": _top_k_repeating(bottom_counts),
                "threshold_pages": threshold,
                "total_pages_processed": total_pages_processed,
            }
            elapsed_s = round(time.time() - started, 3)
            report["stats"] = {
                "total_pages_processed": total_pages_processed,
                "elapsed_seconds": elapsed_s,
                "avg_pages_per_second": round(total_pages_processed / elapsed_s, 3) if elapsed_s > 0 else None,
            }

            max_page_row = conn.execute(
                "SELECT MAX(logical_page_number) AS m FROM pages WHERE book_id = ?",
                (book_id,),
            ).fetchone()
            max_logical_page = int(max_page_row["m"]) if max_page_row and max_page_row["m"] else None
            if max_logical_page is not None:
                conn.execute(
                    "UPDATE books SET logical_page_count = ?, updated_at = ? WHERE id = ?",
                    (max_logical_page, _utc_now_iso(), book_id),
                )
                report["stats"] = {
                    **cast(dict[str, object], report["stats"]),
                    "logical_page_count": max_logical_page,
                }

            stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
            report_path = report_dir / f"extract_{book_cfg.key}_{stamp}.json"
            report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
            conn.commit()

            print(
                f"Extracted book '{book_cfg.key}' to {db_path} ({total_pages_processed} pages). "
                f"Report: {report_path}"
            )

    return 0


def cmd_embed(args: argparse.Namespace) -> int:
    try:
        import chromadb
    except ImportError:
        raise SystemExit("chromadb is not installed. Please Run `pip install chromadb` first.")
    
    config_path = Path(args.config).resolve() if args.config else DEFAULT_CONFIG_PATH
    config = _load_config_or_none(config_path)
    db_path = (Path(args.db).resolve() if args.db else Path(config.db_path).resolve()
               if config and config.db_path else DEFAULT_DB_PATH)
    conn = _connect(db_path)
    
    chroma_dir = RULES_DB_DIR / "chroma"
    chroma_dir.parent.mkdir(parents=True, exist_ok=True)
    
    print(f"Initializing ChromaDB in {chroma_dir}...")
    client = chromadb.PersistentClient(path=str(chroma_dir))
    collection = client.get_or_create_collection(name="gurps_rules")
    
    print("Loading chunks from SQLite...")
    chunks = conn.execute("SELECT id, book_id, text_clean FROM chunks").fetchall()
    
    print("Loading entities from SQLite...")
    entities = conn.execute("SELECT id, name, type, book_id FROM entities").fetchall()
    
    documents = []
    metadatas = []
    ids = []
    
    for c in chunks:
        doc_id = f"chunk_{c['id']}"
        text = str(c["text_clean"])
        if not text.strip(): continue
        documents.append(text)
        metadatas.append({"type": "chunk", "book_id": c["book_id"]})
        ids.append(doc_id)
        
    for e in entities:
        doc_id = f"entity_{e['id']}"
        rows = conn.execute("SELECT text_clean FROM entity_text WHERE entity_id=?", (e["id"],)).fetchall()
        text = "\n\n".join([str(r["text_clean"]) for r in rows if r["text_clean"]])
        if not text.strip(): continue
        
        full_text = f"[{str(e['type']).upper()}]: {e['name']}\n{text}"
        documents.append(full_text)
        metadatas.append({"type": f"entity_{e['type']}", "name": str(e["name"]), "book_id": e["book_id"]})
        ids.append(doc_id)
        
    if not documents:
        print("No documents found to embed.")
        return 0
        
    print(f"Embedding {len(documents)} documents (this may take a few minutes the first time it downloads the model)...")
    
    batch_size = 500
    for i in range(0, len(documents), batch_size):
        end = min(i + batch_size, len(documents))
        collection.upsert(
            documents=documents[i:end],
            metadatas=metadatas[i:end],
            ids=ids[i:end]
        )
        print(f"Upserted {end}/{len(documents)}...")
        
    print("Embedding complete!")
    return 0


def cmd_semantic_search(args: argparse.Namespace) -> int:
    try:
        import chromadb
    except ImportError:
        raise SystemExit("chromadb is not installed. Please Run `pip install chromadb` first.")
        
    query = args.query.strip()
    if not query:
        raise SystemExit("Empty query.")
        
    chroma_dir = RULES_DB_DIR / "chroma"
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
    
    print(f"\\nSemantic Search Results for: '{query}'")
    print("=" * 60)
    for doc, meta, doc_id, dist in zip(docs, metas, ids, distances):
        meta_dict = meta if isinstance(meta, dict) else {}
        type_str = str(meta_dict.get("type", "unknown"))
        name_str = meta_dict.get("name")
        label = f"[{type_str.upper()}] {name_str}" if name_str else f"[{type_str.upper()}] {doc_id}"
        
        print(f"--- {label} (Distance: {dist:.3f}) ---")
        preview = doc[:800] + "..." if len(doc) > 800 else doc
        print(preview)
        print("-" * 40 + "\\n")
        
    return 0


def cmd_agent_search(args: argparse.Namespace) -> int:
    try:
        import chromadb
    except ImportError:
        raise SystemExit("chromadb is not installed.")
        
    query = args.query.strip()
    if not query:
        raise SystemExit("Empty query.")
        
    chroma_dir = RULES_DB_DIR / "chroma"
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
    
    print(f"# DATABASE SEARCH RESULTS: {query}\\n")
    for doc, meta, doc_id, dist in zip(docs, metas, ids, distances):
        meta_dict = meta if isinstance(meta, dict) else {}
        type_str = str(meta_dict.get("type", "unknown"))
        name_str = meta_dict.get("name")
        label = f"[{type_str.upper()}] {name_str}" if name_str else f"[{type_str.upper()}] {doc_id}"
        
        # Truncate extremely long documents to save LLM context window limits
        preview = doc[:4500]
        if len(doc) > 4500:
            preview += "\\n... (truncated)"
            
        print(f"## {label} (Distance: {dist:.3f})")
        print("```text")
        print(preview)
        print("```\\n")
        
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="rulesdb", description="Local Rules DB utilities")
    sub = p.add_subparsers(dest="cmd", required=True)

    p_init = sub.add_parser("init", help="Create folders and initialize SQLite DB schema")
    p_init.add_argument("--db", default=None, help="Path to sqlite db (default: rules_db/basic_set.sqlite)")
    p_init.set_defaults(func=cmd_init)

    p_doc = sub.add_parser("doctor", help="Sanity-check rules DB setup")
    p_doc.add_argument("--db", default=None, help="Path to sqlite db (default: rules_db/basic_set.sqlite)")
    p_doc.set_defaults(func=cmd_doctor)

    p_clean = sub.add_parser("clean", help="Deterministically clean extracted text (headers/footers, hyphenation)")
    p_clean.add_argument("--config", default=None, help="Config path (default: rules_db/config.toml)")
    p_clean.add_argument("--db", default=None, help="Path to sqlite db (overrides config db_path)")
    p_clean.add_argument("--book", default=None, help="Book key to clean (e.g. basic_set)")
    p_clean.add_argument(
        "--hf-ratio",
        type=float,
        default=0.60,
        help="Header/footer repetition ratio threshold (default: 0.60)",
    )
    p_clean.set_defaults(func=cmd_clean)

    p_chunk = sub.add_parser("chunk", help="Build retrieval chunks (deterministic) and optional FTS index")
    p_chunk.add_argument("--config", default=None, help="Config path (default: rules_db/config.toml)")
    p_chunk.add_argument("--db", default=None, help="Path to sqlite db (overrides config db_path)")
    p_chunk.add_argument("--book", default=None, help="Book key to chunk (e.g. basic_set)")
    p_chunk.add_argument(
        "--mode",
        default="replace",
        choices=["replace", "append"],
        help="replace deletes existing chunks for this book (default: replace)",
    )
    p_chunk.add_argument("--target-chars", type=int, default=4500, help="Target chunk size (default: 4500)")
    p_chunk.add_argument("--overlap-chars", type=int, default=900, help="Chunk overlap (default: 900)")
    p_chunk.add_argument("--max-chunks", type=int, default=None, help="Limit number of chunks (for testing)")
    p_chunk.set_defaults(func=cmd_chunk)

    p_search = sub.add_parser("search", help="Search chunks (FTS if available, otherwise LIKE)")
    p_search.add_argument("query", help="Search query (plain text by default; use --fts for raw FTS syntax)")
    p_search.add_argument("--config", default=None, help="Config path (default: rules_db/config.toml)")
    p_search.add_argument("--db", default=None, help="Path to sqlite db (overrides config db_path)")
    p_search.add_argument("--book", default=None, help="Book key to search (e.g. basic_set)")
    p_search.add_argument("--limit", type=int, default=8, help="Max results (default: 8)")
    p_search.add_argument(
        "--fts",
        action="store_true",
        help="Treat query as raw FTS syntax (default is plain-text token search)",
    )
    p_search.set_defaults(func=cmd_search)

    p_show = sub.add_parser("chunk-show", help="Print a chunk's text (and optionally citation block IDs)")
    p_show.add_argument("chunk_id", type=int, help="Chunk ID")
    p_show.add_argument("--config", default=None, help="Config path (default: rules_db/config.toml)")
    p_show.add_argument("--db", default=None, help="Path to sqlite db (overrides config db_path)")
    p_show.add_argument("--book", default=None, help="Book key (e.g. basic_set)")
    p_show.add_argument("--refs", action="store_true", help="Print block-level citation refs")
    p_show.set_defaults(func=cmd_chunk_show)

    p_ent = sub.add_parser(
        "entity-extract", help="Deterministically extract entities (v1: maneuvers, advantages, disadvantages, skills, spells, equipment)"
    )
    p_ent.add_argument(
        "--kind",
        default="maneuvers",
        choices=["maneuvers", "advantages", "disadvantages", "skills", "spells", "equipment"],
        help="Entity kind to extract",
    )
    p_ent.add_argument("--mode", default="replace", choices=["replace", "append"], help="Default: replace")
    p_ent.add_argument("--min-chars", type=int, default=200, help="Flag spans shorter than this (default: 200)")
    p_ent.add_argument(
        "--max-span-pages",
        type=int,
        default=6,
        help="Maximum pages to include after a heading (default: 6)",
    )
    p_ent.add_argument(
        "--max-entities",
        type=int,
        default=None,
        help="Limit number of created entities (for testing)",
    )
    p_ent.add_argument(
        "--cluster-gap-pages",
        type=int,
        default=12,
        help="Page gap that splits heading clusters (default: 12)",
    )
    p_ent.add_argument(
        "--cluster",
        default="auto",
        choices=["auto", "earliest", "latest"],
        help="Which heading cluster to use (default: auto)",
    )
    p_ent.add_argument(
        "--cluster-tail-pages",
        type=int,
        default=2,
        help="How many pages past the last heading to include (default: 2)",
    )
    p_ent.add_argument("--config", default=None, help="Config path (default: rules_db/config.toml)")
    p_ent.add_argument("--db", default=None, help="Path to sqlite db (overrides config db_path)")
    p_ent.add_argument("--book", default=None, help="Book key (e.g. basic_set)")
    p_ent.set_defaults(func=cmd_entity_extract)

    p_ent_show = sub.add_parser("entity-show", help="Show an extracted entity by name or id")
    p_ent_show.add_argument("name", nargs="?", default=None, help="Exact entity name")
    p_ent_show.add_argument("--id", type=int, default=None, help="Entity id")
    p_ent_show.add_argument("--refs", action="store_true", help="Print block-level citation refs")
    p_ent_show.add_argument("--config", default=None, help="Config path (default: rules_db/config.toml)")
    p_ent_show.add_argument("--db", default=None, help="Path to sqlite db (overrides config db_path)")
    p_ent_show.add_argument("--book", default=None, help="Book key (e.g. basic_set)")
    p_ent_show.set_defaults(func=cmd_entity_show)

    p_ent_search = sub.add_parser("entity-search", help="Search extracted entities by name/alias (LIKE)")
    p_ent_search.add_argument("query", help="Substring to search for")
    p_ent_search.add_argument("--limit", type=int, default=15, help="Max results (default: 15)")
    p_ent_search.add_argument("--config", default=None, help="Config path (default: rules_db/config.toml)")
    p_ent_search.add_argument("--db", default=None, help="Path to sqlite db (overrides config db_path)")
    p_ent_search.add_argument("--book", default=None, help="Book key (e.g. basic_set)")
    p_ent_search.set_defaults(func=cmd_entity_search)

    p_ext = sub.add_parser("extract", help="Extract PDFs deterministically into pages/blocks")
    p_ext.add_argument("--config", default=None, help="Config path (default: rules_db/config.toml)")
    p_ext.add_argument("--db", default=None, help="Path to sqlite db (overrides config db_path)")
    p_ext.add_argument("--book", default=None, help="Book key to extract (e.g. basic_set)")
    p_ext.add_argument(
        "--mode",
        default="upsert",
        choices=["skip", "upsert", "replace"],
        help="How to handle existing pages (default: upsert)",
    )
    p_ext.add_argument("--max-pages", type=int, default=None, help="Limit pages per PDF (for testing)")
    p_ext.set_defaults(func=cmd_extract)

    p_embed = sub.add_parser("embed", help="Generate vector embeddings for semantic search using ChromaDB")
    p_embed.add_argument("--config", default=None, help="Config path (default: rules_db/config.toml)")
    p_embed.add_argument("--db", default=None, help="Path to sqlite db (overrides config db_path)")
    p_embed.set_defaults(func=cmd_embed)
    
    p_semantic = sub.add_parser("semantic-search", help="Semantic search via ChromaDB embeddings")
    p_semantic.add_argument("query", help="Query text to embed and search")
    p_semantic.add_argument("--limit", type=int, default=5, help="Number of results to return (default: 5)")
    p_semantic.add_argument("--config", default=None, help="Config path (default: rules_db/config.toml)")
    p_semantic.add_argument("--db", default=None, help="Path to sqlite db (overrides config db_path)")
    p_semantic.set_defaults(func=cmd_semantic_search)

    p_agent = sub.add_parser("agent-search", help="Semantic search optimized for reading by an LLM")
    p_agent.add_argument("query", help="Query text to embed and search")
    p_agent.add_argument("--limit", type=int, default=5, help="Number of results to return (default: 5)")
    p_agent.add_argument("--config", default=None, help="Config path (default: rules_db/config.toml)")
    p_agent.add_argument("--db", default=None, help="Path to sqlite db (overrides config db_path)")
    p_agent.set_defaults(func=cmd_agent_search)

    return p

def main(argv: list[str]) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        return int(args.func(args))
    except BrokenPipeError:
        return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
