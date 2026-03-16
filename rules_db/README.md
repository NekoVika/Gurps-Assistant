# Rules DB (Local, Offline)

This folder contains **in-repo** scaffolding for building a local, queryable rules database from PDF sources (starting with *GURPS Basic Set*), per `TODO-DB.md`.

## What lives here

Tracked in git:
- `rules_db/schema.sql` — SQLite schema (canonical store).
- `rules_db/schema_fts.sql` — optional SQLite FTS5 tables (rebuildable).
- `rules_db/config.example.toml` — example local config.
- `rules_db/README.md` — this file.

Ignored (local-only build outputs):
- `rules_db/*.sqlite*` — generated databases (e.g. `rules_db/basic_set.sqlite`).
- `rules_db/cache/` — extraction caches/intermediate JSON.
- `rules_db/logs/` — build logs and review reports.
- `rules_db/embeddings/` — optional external vector index files.
- `rules_db/config.toml` — your local configuration.

## Page model (important)

We treat **Basic Set as one logical book**, even if you supply multiple PDFs (e.g., Characters/Campaigns).

All citations should be in terms of **logical book pages** (`(Basic Set, p. X)`).
To make that work, we store a per-PDF mapping (`pdf_page_1_logical_page`) so each extracted PDF page can be mapped to a single logical page number.

## Next steps

1. Create `.rule-books/` and place PDFs there (folder is already gitignored).
2. Copy `rules_db/config.example.toml` to `rules_db/config.toml` and update paths/offsets.
3. Run bootstrap:
   - `python scripts/rulesdb.py init`
   - `python scripts/rulesdb.py doctor`
4. Extract PDFs into the database:
   - `python scripts/rulesdb.py extract --book basic_set --mode replace`
5. Search and inspect chunks:
   - `python scripts/rulesdb.py search "All-Out Defense" --book basic_set`
   - `python scripts/rulesdb.py chunk-show 330 --book basic_set --refs`
6. Extract and inspect maneuver entities (deterministic):
   - `python scripts/rulesdb.py entity-extract --kind maneuvers --book basic_set --mode replace`
   - `python scripts/rulesdb.py entity-show "All-Out Defense" --book basic_set --refs`
