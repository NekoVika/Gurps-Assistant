# Rules DB

Local, offline rules retrieval for the GURPS Basic Set.

## What lives here

Tracked in git:
- `rules_db/schema.sql` - SQLite schema
- `rules_db/schema_fts.sql` - SQLite FTS5 schema
- `rules_db/config.example.toml` - example local config
- `rules_db/README.md` - this file

Local-only outputs:
- `rules_db/*.sqlite*` - generated databases such as `rules_db/basic_set.sqlite`
- `rules_db/cache/` - extraction caches and intermediate JSON
- `rules_db/logs/` - reports and review logs
- `rules_db/chroma/` - local Chroma vector store
- `rules_db/config.toml` - your local configuration

## Current shape

The pipeline is built around `python scripts/rulesdb.py ...`.

Main retrieval entrypoint:
- `python scripts/rulesdb.py qa "your question"`

Supporting retrieval commands:
- `python scripts/rulesdb.py search "Alcoholism" --book basic_set`
- `python scripts/rulesdb.py entity-show "Combat Reflexes" --book basic_set --refs`
- `python scripts/rulesdb.py chunk-show 330 --book basic_set --refs`
- `python scripts/rulesdb.py semantic-search "rapid fire"`
- `python scripts/rulesdb.py agent-search "Combat Reflexes"`

Structured extraction currently covers:
- advantages
- disadvantages
- skills
- maneuvers
- combat rules
- spells
- equipment

`qa` uses:
- exact entity lookup first
- semantic retrieval from Chroma
- chunk fallback when no strong entity hit exists

The `RulesLawyer` persona is wired to use `qa` before answering rules questions.

## Page model

Basic Set is treated as one logical book, even if source text comes from multiple PDFs.

All citations should use logical book pages:
- `(Basic Set, p. X)`

To support that, config stores a per-PDF mapping such as `pdf_page_1_logical_page`.

## Setup

1. Place PDFs under `.rule-books/`.
2. Copy `rules_db/config.example.toml` to `rules_db/config.toml`.
3. Update paths and page offsets in the config.
4. Initialize the DB:
   - `python scripts/rulesdb.py init`
   - `python scripts/rulesdb.py doctor`
5. Extract source text:
   - `python scripts/rulesdb.py extract --book basic_set --mode replace`
6. Clean and chunk text:
   - `python scripts/rulesdb.py clean --book basic_set`
   - `python scripts/rulesdb.py chunk --book basic_set --mode replace`
7. Extract structured entities:
   - `python scripts/rulesdb.py entity-extract --kind advantages --book basic_set --mode replace`
   - `python scripts/rulesdb.py entity-extract --kind disadvantages --book basic_set --mode replace`
   - `python scripts/rulesdb.py entity-extract --kind skills --book basic_set --mode replace`
   - `python scripts/rulesdb.py entity-extract --kind maneuvers --book basic_set --mode replace`
   - `python scripts/rulesdb.py entity-extract --kind combat_rules --book basic_set --mode replace`
8. Build vector retrieval:
   - `python scripts/rulesdb.py embed`

## Recommended usage

For the assistant:
- `python scripts/rulesdb.py qa "Can I dodge bullets?"`
- answer from `## Best Evidence`
- use `entity-show` or `chunk-show` only when deeper inspection is needed

For manual inspection:
- `python scripts/rulesdb.py search "All-Out Defense" --book basic_set`
- `python scripts/rulesdb.py entity-search "Suppression Fire" --book basic_set`
- `python scripts/rulesdb.py entity-show "Deceptive Attack" --book basic_set --refs`

## Tests

Regression runner:
- `python scripts/test_rulesdb_qa.py`

Automated tests:
- `python -m unittest discover -s tests -v`

Current tests cover:
- QA helper functions
- QA regression questions against the local DB

## Code organization

The CLI entrypoint is:
- `scripts/rulesdb.py`

Current helper modules:
- `scripts/rulesdb_lib/commands/search.py`
- `scripts/rulesdb_lib/qa_helpers.py`
- `scripts/rulesdb_lib/rule_maps.py`
- `scripts/rulesdb_lib/qa_regression.py`

The file is only partially modularized so far. Search and QA logic has been extracted; more extractor refactoring is still planned.
