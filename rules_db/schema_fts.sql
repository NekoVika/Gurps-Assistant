-- Optional FTS5 virtual tables (rebuildable).
-- Apply only if FTS5 is available in the local SQLite build.

CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
  text_clean,
  chunk_id UNINDEXED
);

CREATE VIRTUAL TABLE IF NOT EXISTS entity_text_fts USING fts5(
  text_clean,
  entity_id UNINDEXED
);

