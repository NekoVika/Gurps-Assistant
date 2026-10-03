"""Serve the priced trait catalogue the rulesdb builds.

The catalogue lives in the rules database, which is a local file: it is built
from the GM's own PDFs and is deliberately not in version control, so it may
simply not be there. Everything here treats that as normal rather than as an
error -- an app with no rules database works exactly as it did before, it just
cannot check a cost.

This reads the table directly instead of shelling out to the CLI, as the QA
service does. A SELECT does not need a subprocess, and the UI asks for this on
every character.
"""
from __future__ import annotations

import sqlite3
import tomllib
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
RULES_DB_DIR = ROOT / "rules_db"
DEFAULT_DB = RULES_DB_DIR / "basic_set.sqlite"
CONFIG = RULES_DB_DIR / "config.toml"

COLUMNS = (
    "kind", "name", "category", "exotic", "specialised", "self_control",
    "cost_text", "cost_kind", "cost_value", "attr", "difficulty", "defaults",
    "page", "needs_review", "review_reason",
)


@dataclass(frozen=True)
class Catalogue:
    #: Every priced entry, newest book last. Empty when there is no database.
    traits: list[dict] = field(default_factory=list)
    #: Which books contributed, so the UI can say where a cost came from.
    books: list[dict] = field(default_factory=list)
    #: False when there is no rules database, or it holds no catalogue yet.
    available: bool = False
    #: Why it is unavailable, for the UI to show instead of an empty list.
    reason: str = ""


def _db_path() -> Path:
    """The configured database, or the default beside it."""
    try:
        data = tomllib.loads(CONFIG.read_text(encoding="utf-8"))
        configured = data.get("db_path")
        if isinstance(configured, str) and configured.strip():
            path = Path(configured)
            return path if path.is_absolute() else (ROOT / path)
    except (OSError, tomllib.TOMLDecodeError):
        pass
    return DEFAULT_DB


class TraitCatalogueService:
    def __init__(self, db_path: Path | None = None) -> None:
        self._db_path = db_path or _db_path()

    def load(self) -> Catalogue:
        if not self._db_path.exists():
            return Catalogue(
                reason="No rules database yet. Build one with scripts/rulesdb.py.")
        try:
            conn = sqlite3.connect(f"file:{self._db_path}?mode=ro", uri=True)
        except sqlite3.Error as exc:
            return Catalogue(reason=f"Could not open the rules database: {exc}")
        try:
            tables = {row[0] for row in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table'")}
            if "traits" not in tables:
                return Catalogue(
                    reason="The rules database has no catalogue yet. "
                           "Run: python scripts/rulesdb.py trait-list")

            books = [
                {"id": row[0], "title": row[1], "label": row[2]}
                for row in conn.execute(
                    "SELECT id, title, source_label FROM books ORDER BY id")
            ] if "books" in tables else []

            rows = conn.execute(
                f"SELECT book_id, {', '.join(COLUMNS)} FROM traits ORDER BY kind, name"
            ).fetchall()
        except sqlite3.Error as exc:
            return Catalogue(books=[], reason=f"Could not read the catalogue: {exc}")
        finally:
            conn.close()

        traits = []
        for row in rows:
            entry = {"book_id": row[0]}
            for index, column in enumerate(COLUMNS, start=1):
                entry[column] = row[index]
            entry["exotic"] = bool(entry.get("exotic"))
            entry["specialised"] = bool(entry.get("specialised"))
            entry["self_control"] = bool(entry.get("self_control"))
            entry["needs_review"] = bool(entry.get("needs_review"))
            traits.append(entry)

        if not traits:
            return Catalogue(books=books,
                             reason="The catalogue is empty. "
                                    "Run: python scripts/rulesdb.py trait-list")
        return Catalogue(traits=traits, books=books, available=True)
