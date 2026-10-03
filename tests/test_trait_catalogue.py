"""Serving the priced catalogue, including when there is nothing to serve.

The rules database is built from the GM's own PDFs and is deliberately not in
version control, so "it isn't there" is a normal state rather than a failure.
An app without one has to work exactly as it did before — it simply cannot
check a cost — so every absence here is tested as carefully as the happy path.
"""
import sqlite3

import pytest

from gurpsai.app.services.trait_catalogue import TraitCatalogueService


def build(path, *, with_traits=True, rows=()):
    conn = sqlite3.connect(path)
    conn.executescript("""
        CREATE TABLE books (id INTEGER PRIMARY KEY, title TEXT, source_label TEXT);
        INSERT INTO books VALUES (1, 'GURPS Basic Set', 'Basic Set');
    """)
    if with_traits:
        conn.executescript("""
            CREATE TABLE traits (
              id INTEGER PRIMARY KEY, book_id INTEGER, kind TEXT, name TEXT,
              category TEXT, exotic INTEGER DEFAULT 0, specialised INTEGER DEFAULT 0,
              self_control INTEGER DEFAULT 0, cost_text TEXT, cost_kind TEXT,
              cost_value INTEGER, attr TEXT, difficulty TEXT, defaults TEXT,
              page INTEGER, needs_review INTEGER DEFAULT 0, review_reason TEXT,
              created_at TEXT
            );
        """)
        for row in rows:
            conn.execute(
                "INSERT INTO traits (book_id, kind, name, cost_text, cost_kind,"
                " cost_value, specialised, self_control, page, created_at)"
                " VALUES (1,?,?,?,?,?,?,?,?,'now')", row)
    conn.commit()
    conn.close()


ROWS = [
    ("advantage", "Combat Reflexes", "15", "flat", 15, 0, 0, 43),
    ("disadvantage", "Bad Temper", "-10*", "flat", -10, 0, 1, 124),
    ("skill", "Guns/TL", "", "formula", None, 1, 0, 198),
]


class TestWhenThereIsACatalogue:
    @pytest.fixture
    def catalogue(self, tmp_path):
        db = tmp_path / "rules.sqlite"
        build(db, rows=ROWS)
        return TraitCatalogueService(db).load()

    def test_it_is_available(self, catalogue):
        assert catalogue.available is True
        assert catalogue.reason == ""
        assert len(catalogue.traits) == 3

    def test_it_says_which_books_contributed(self, catalogue):
        assert catalogue.books == [{"id": 1, "title": "GURPS Basic Set", "label": "Basic Set"}]

    def test_costs_come_through_structured(self, catalogue):
        reflexes = next(t for t in catalogue.traits if t["name"] == "Combat Reflexes")
        assert (reflexes["cost_kind"], reflexes["cost_value"]) == ("flat", 15)

    def test_the_two_footnote_flags_survive_as_booleans(self, catalogue):
        # Without these the checker reports false gaps on 39 disadvantages and
        # fails to match 47 skills.
        temper = next(t for t in catalogue.traits if t["name"] == "Bad Temper")
        guns = next(t for t in catalogue.traits if t["name"] == "Guns/TL")
        assert temper["self_control"] is True
        assert guns["specialised"] is True
        assert temper["specialised"] is False


class TestWhenThereIsNot:
    def test_a_missing_database_is_not_an_error(self, tmp_path):
        catalogue = TraitCatalogueService(tmp_path / "absent.sqlite").load()
        assert catalogue.available is False
        assert catalogue.traits == []
        assert "No rules database" in catalogue.reason

    def test_a_database_without_a_catalogue_says_how_to_build_one(self, tmp_path):
        db = tmp_path / "rules.sqlite"
        build(db, with_traits=False)
        catalogue = TraitCatalogueService(db).load()
        assert catalogue.available is False
        assert "trait-list" in catalogue.reason

    def test_an_empty_catalogue_says_so_rather_than_looking_complete(self, tmp_path):
        db = tmp_path / "rules.sqlite"
        build(db, rows=[])
        catalogue = TraitCatalogueService(db).load()
        assert catalogue.available is False
        assert "empty" in catalogue.reason

    def test_an_unreadable_file_is_reported_not_raised(self, tmp_path):
        db = tmp_path / "rules.sqlite"
        db.write_text("this is not a database", encoding="utf-8")
        catalogue = TraitCatalogueService(db).load()
        assert catalogue.available is False
        assert catalogue.reason
