PRAGMA foreign_keys = ON;

-- Minimal canonical schema for `TODO-DB.md` M0.
-- Derived tables (FTS/embeddings) can be rebuilt; verbatim text is always preserved.

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS books (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  edition TEXT,
  source_label TEXT NOT NULL,
  logical_page_count INTEGER,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- A "book" may be backed by multiple PDFs while still using one logical page space.
CREATE TABLE IF NOT EXISTS book_sources (
  id INTEGER PRIMARY KEY,
  book_id INTEGER NOT NULL,
  source_label TEXT NOT NULL,
  pdf_relpath TEXT NOT NULL,
  pdf_sha256 TEXT,
  pdf_page_count INTEGER,
  -- If set, logical_page = pdf_page_number + pdf_page_1_logical_page - 1
  pdf_page_1_logical_page INTEGER,
  created_at TEXT NOT NULL,
  UNIQUE(book_id, source_label),
  UNIQUE(book_id, pdf_relpath),
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

-- Page text is stored at *logical* page numbers (per book).
CREATE TABLE IF NOT EXISTS pages (
  book_id INTEGER NOT NULL,
  logical_page_number INTEGER NOT NULL,
  source_id INTEGER NOT NULL,
  pdf_page_number INTEGER NOT NULL,
  text_raw TEXT,
  text_clean TEXT,
  extraction_meta TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (book_id, logical_page_number),
  UNIQUE (source_id, pdf_page_number),
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  FOREIGN KEY (source_id) REFERENCES book_sources(id) ON DELETE CASCADE
);

-- Block-level text for stable citations when geometry is available.
CREATE TABLE IF NOT EXISTS blocks (
  book_id INTEGER NOT NULL,
  logical_page_number INTEGER NOT NULL,
  block_id TEXT NOT NULL,
  text_raw TEXT,
  text_clean TEXT,
  bbox TEXT,
  reading_order INTEGER,
  block_meta TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (book_id, logical_page_number, block_id),
  FOREIGN KEY (book_id, logical_page_number) REFERENCES pages(book_id, logical_page_number) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS entities (
  id INTEGER PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('advantage','disadvantage','skill','equipment','spell','rule','table')),
  name TEXT NOT NULL,
  aliases TEXT,
  book_id INTEGER NOT NULL,
  start_page INTEGER,
  end_page INTEGER,
  confidence REAL NOT NULL DEFAULT 0.0,
  needs_review INTEGER NOT NULL DEFAULT 0,
  review_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS entity_text (
  entity_id INTEGER PRIMARY KEY,
  text_raw TEXT NOT NULL,
  text_clean TEXT,
  primary_citation TEXT,
  block_refs TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chunks (
  id INTEGER PRIMARY KEY,
  book_id INTEGER NOT NULL,
  start_page INTEGER,
  end_page INTEGER,
  text_clean TEXT NOT NULL,
  tags TEXT,
  entity_ids TEXT,
  block_refs TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

-- Embeddings can live in SQLite for v1; external vector DBs can be added later.
CREATE TABLE IF NOT EXISTS embeddings (
  target_type TEXT NOT NULL CHECK (target_type IN ('chunk','entity')),
  target_id INTEGER NOT NULL,
  model_id TEXT NOT NULL,
  dims INTEGER NOT NULL,
  vector BLOB NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (target_type, target_id, model_id)
);
