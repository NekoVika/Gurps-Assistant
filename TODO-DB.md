# Local Rules Database (GURPS Basic Set) — TODO / Spec

Goal: build a **local, queryable source of truth** from *GURPS Basic Set* that reduces hallucinations by forcing the assistant to answer from retrieved, cited text instead of “memory”.

Constraints / decisions (locked for v1):
- Source: **PDF with selectable text** (no OCR for Basic Set v1).
- Scope: **GURPS Basic Set** as one logical “book” (even if PDFs are split by volume).
- Storage: local-only (not published).
- Retrieval: **offline embeddings** + exact search + citations.
- Content: store **verbatim entity text**, preferably the full text of each entity (advantages/disadvantages/skills/etc).

---

## 1) Success criteria (what “done” means)

- Answer rules Q&A with citations to Basic Set pages (and optionally stable block IDs).
- Lookup by name/alias for:
  - Advantages / Disadvantages
  - Skills
  - Combat-relevant rules (maneuvers, defenses, damage, ranged rules)
  - Equipment (at least basic tables; weapons/armor first)
- For any non-trivial claim: either provide citations or explicitly say “not found in indexed Basic Set text” and ask for clarification.

---

## 2) Artifacts to produce (local build outputs)

Recommended local artifacts (all gitignored):
- `rules_db/basic_set.sqlite` (canonical store)
- `rules_db/embeddings/` (vector index files)
- `rules_db/cache/` (extraction caches, intermediate JSON)
- `rules_db/logs/` (build logs, review reports)

Keep pipeline code in-repo; keep derived data out-of-repo.

---

## 3) Data model (minimum viable schema)

### 3.1 Books / provenance
- `books`
  - `id`, `title`, `edition`, `source_label` (“Basic Set”), `pdf_sha256`, `page_count`

### 3.2 Page-level text (rebuildable, auditable)
- `pages`
  - `(book_id, page_number)`
  - `text_raw` (as extracted)
  - `text_clean` (whitespace normalized, de-hyphenated, header/footer removed)
  - `extraction_meta` (JSON: extractor version, timings, stats)

### 3.3 Block-level text (for stable citations)
If the extractor can return block geometry/ordering, store it.
- `blocks`
  - `(book_id, page_number, block_id)`
  - `text_raw`, `text_clean`
  - `bbox` (JSON), `reading_order`

Block IDs should be **stable across rebuilds** given the same PDF + extractor version:
- Example: `block_id = sha1(page_number + bbox + normalized_text_raw)`

### 3.4 Entities (advantages, skills, equipment…)
- `entities`
  - `id`, `type` (`advantage|disadvantage|skill|equipment|rule|table`)
  - `name`, `aliases` (JSON array)
  - `book_id`, `start_page`, `end_page`
  - `confidence` (0–1), `needs_review` (bool), `review_reason` (text)

- `entity_text`
  - `entity_id`
  - `text_raw`, `text_clean`
  - `primary_citation` (JSON: page + optional block IDs)
  - `block_refs` (JSON array of `{page, block_id}`)

### 3.5 Chunks for retrieval (RAG)
- `chunks`
  - `id`, `book_id`, `start_page`, `end_page`
  - `text_clean`
  - `tags` (JSON array)
  - `entity_ids` (JSON array, optional)
  - `block_refs` (JSON array for citations)

### 3.6 Embeddings (offline)
- `embeddings`
  - `target_type` (`chunk|entity`), `target_id`
  - `model_id`, `vector` (BLOB), `dims`

Also maintain metadata indexes for filtering:
- `chunk_type`, `entity_type`, `page ranges`, etc.

---

## 4) Extraction pipeline (PDF → pages → blocks)

### 4.1 Diagnostics step (fast sanity check)
- For each page:
  - extracted text length
  - number of blocks (if supported)
  - detect repeated headers/footers (candidates)
- Output: report summary + list of “suspicious” pages (near-empty, garbled)

### 4.2 Text extraction
Target properties:
- preserve paragraph breaks as well as possible
- keep tables as readable as possible (may require special handling later)
- keep raw + cleaned variants

Cleaning (only for `text_clean`):
- normalize whitespace
- join hyphenated line breaks where safe
- remove repeating headers/footers (heuristics)

### 4.3 Stable citations
Prefer `block_refs` when possible.
Fallback: cite `(book, page)` only.

---

## 5) Chunking strategy (rules Q&A)

Create semantically coherent chunks for retrieval:
- use headings/subheadings if detectable
- keep chunk size roughly consistent (e.g., 200–600 tokens each)
- preserve list items and “exception rules” near the main rule text

Each chunk must store:
- `start_page/end_page`
- `block_refs` for precise citations
- tags (combat, ranged, melee, defenses, injury, etc.)

---

## 6) Entity extraction (advantages/disadvantages/skills/equipment)

### 6.1 Prioritize targets (v1 order)
1) Advantages
2) Disadvantages
3) Skills
4) Combat rules chunks (even if not “entities”)
5) Equipment (weapons/armor first; tables are tricky)

### 6.2 Candidate detection (non-LLM heuristics first)
Possible signals (choose based on what the PDF exposes):
- typography: heading font size/weight
- patterns:
  - advantages/disadvantages often have `Name` + `[points]` or point-cost patterns
  - skills often have `Name (Attribute/Difficulty)` and/or “Defaults:”
  - equipment tables: repeated columns, consistent separators

### 6.3 Entity span assembly
- identify start block
- include contiguous blocks until next peer entity start
- allow multi-page spans

### 6.4 Review queue
Mark entities `needs_review=1` when:
- span ambiguous (two headings too close, missing delimiters)
- extracted text looks table-garbled
- critical lines missing (cost/defaults/prereqs)

Provide a CLI/report that lists:
- entity name, pages, reason, text excerpt (short)

---

## 7) Optional structured parsing (useful, but never replaces verbatim)

Parse fields into separate columns/tables, sourced from `entity_text`:
- Advantages/Disadvantages:
  - base cost, per-level cost, typical modifiers, notes
- Skills:
  - attribute/difficulty, defaults, prerequisites, specializations
- Equipment:
  - TL, cost, weight, damage, acc, rof, bulk, rcl (as applicable)

Approach:
- start with rule-based extraction for obvious patterns
- add a build-time “LLM assist” only if needed later (still cite + keep verbatim)

---

## 8) Indexing & retrieval

### 8.1 Exact / lexical search
- `entities.name` + `aliases`
- SQLite FTS over:
  - `entity_text.text_clean`
  - `chunks.text_clean`

### 8.2 Offline embeddings
- embed `chunks` (minimum)
- optionally embed `entities` for name-less queries (“that advantage that…”)
- store vectors in SQLite or external index files (FAISS-like), but keep IDs stable

Metadata filters to support:
- entity type
- page range
- tags (combat/equipment/etc.)

---

## 9) Runtime answer policy (anti-hallucination guardrails)

Retrieval order:
1) exact entity match (name/alias)
2) FTS top hits
3) vector top hits (with type filters)

Answer rules:
- Every non-trivial claim must be backed by at least one citation:
  - minimum: `(Basic Set, p. X)`
  - best: `(Basic Set, p. X, block Y)`
- If retrieval doesn’t support the claim:
  - say “not found in indexed Basic Set text”
  - ask a clarifying question or request the relevant rulebook excerpt

Optionally include verbatim excerpts in answers:
- short excerpts in chat output, full entity text available via “show entity” tooling

---

## 10) QA plan (small but real test harness)

### 10.1 Golden questions set (v1)
Create ~30–50 test prompts covering:
- common combat questions (defense options, hit locations, rapid fire, etc.)
- 10+ advantage/disadvantage lookups by name
- 10+ skills with defaults/prereqs
- a few equipment queries (weapon stats, armor DR)

For each test:
- expected citations must exist
- answer must not assert unsupported details

### 10.2 Build validation checks
- no missing pages
- chunk coverage across the book
- entity overlap detection (two entities claiming same blocks)
- “empty or tiny entities” flagged

---

## 11) Implementation milestones (suggested)

M0 — Repo scaffolding (no extraction yet)
- Decide storage format (SQLite recommended).
- Add `rules_db/` folder layout + `.gitignore` entries (DB, embeddings, caches).

M1 — Extraction → `pages` (+ `blocks` if available)
- Extract all pages to DB with raw+clean text.
- Generate diagnostics report.

M2 — Chunking + search
- Build chunks table.
- Add FTS index + simple query CLI.

M3 — Offline embeddings
- [x] Embed chunks.
- [x] Add semantic search CLI (top-k with metadata filters).

M4 — Entity extraction (advantages/disadvantages/skills)
- Build entity detector for those sections.
- Store full verbatim entity text with citations.
- Create review queue report.

M5 — Runtime integration
- Add an answering function that:
  - retrieves sources
  - composes an answer
  - enforces “citation required” rule

M6 — Equipment & tables improvements
- Improve table extraction or add table-specific parsers.

---

## 12) Known hard parts / risks

- Tables (equipment) are the most extraction-sensitive.
- Headings may be inconsistent; entity boundaries can be ambiguous.
- Header/footer removal needs careful heuristics (avoid deleting real rule text).
- “Verbatim” vs “cleaned”: always keep raw; only clean for search.

---

## 13) Open questions (defer until coding)

- Which offline embedding model + runtime (CPU/GPU)?
- Where to store the PDFs locally and how to reference them (path config)?
- Do we need “Characters vs Campaigns” page mapping, or just treat as one book?
- Desired CLI commands (examples):
  - `rulesdb build`
  - `rulesdb search "Rapid Fire"`
  - `rulesdb entity "Combat Reflexes"`
  - `rulesdb qa "How does All-Out Defense work?"`

