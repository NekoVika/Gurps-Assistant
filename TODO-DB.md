# Local Rules DB Roadmap

Goal: maintain a local, queryable source of truth for GURPS Basic Set so the assistant answers from retrieved, cited text instead of memory.

## Current status

### Verified current baseline
- [x] `python scripts/rulesdb.py doctor` passes in the current workspace
- [x] `python scripts/test_rulesdb_qa.py` passes in the current workspace
- [x] `python -m unittest discover -s tests -v` passes in the current workspace
- [x] Local DB artifact exists at `rules_db/basic_set.sqlite`
- [x] Local DB is populated and queryable

Current local DB snapshot:
- `books`: 1
- `book_sources`: 1
- `pages`: 580
- `blocks`: 7395
- `chunks`: 578
- `entities`: 782
- entity types currently present:
  - `advantage`: 240
  - `disadvantage`: 182
  - `rule`: 40
  - `skill`: 240
  - `spell`: 71
  - `table`: 9

### Feature checklist
- [x] SQLite schema and local DB layout created under `rules_db/`
- [x] Deterministic PDF extraction into `pages` and `blocks`
- [x] Deterministic cleaning pipeline for extracted text
- [x] Deterministic chunking with SQLite FTS search
- [x] Chroma vector store integrated for semantic retrieval
- [x] `search`, `chunk-show`, `semantic-search`, and `agent-search` commands implemented
- [x] `qa` command implemented as the main question-oriented retrieval entrypoint
- [x] `RulesLawyer` wired to use `python scripts/rulesdb.py qa "the user's question"`
- [x] Exact entity lookup plus semantic fallback working in retrieval flow
- [x] Citations included in `qa` output
- [x] Structured extraction implemented for:
  - [x] advantages
  - [x] disadvantages
  - [x] skills
  - [x] maneuvers / combat rules
  - [x] spells
  - [~] equipment tables only
- [~] Search/QA command logic partially modularized into `scripts/rulesdb_lib/commands/search.py`
- [~] Entity extraction command partially modularized into `scripts/rulesdb_lib/commands/entities.py`
- [~] Extractor logic partially modularized into `scripts/rulesdb_lib/extractors/entities.py`
- [x] Root and DB READMEs updated to reflect current behavior

### What is working well enough today
- [x] Named trait/rule/skill lookup is generally reliable
- [x] Broad combat QA is working for the current regression set
- [x] Block/page citations are emitted in `qa`
- [x] Local offline retrieval works without network access once the DB is built

### Partial / caveated
- [~] Equipment support is table-oriented, not item-level structured extraction
- [~] Table extraction quality is mixed; some extracted table names are clearly noisy
- [~] Broad natural-language combat queries still depend on ranking heuristics
- [~] Some extracted entities are flagged `needs_review`
- [~] `scripts/rulesdb.py` is still a large mixed-responsibility CLI file

### Not done yet
- [ ] Item-level structured equipment extraction
- [ ] Structured field parsing on top of verbatim entity text
- [ ] DB-dependent integration tests for exact lookup + citation shape
- [ ] Smoke tests for every `entity-extract --kind ...` path
- [ ] Better low-confidence review/report tooling
- [ ] Safer unsupported-question handling / answer-quality checks

## Next development steps

### Next 3 tickets

#### Ticket 1: Stabilize equipment/table extraction
Priority: P1

Why this first:
- Equipment support is currently the weakest retrieval area.
- The current table extractor produces noisy names like `Notes` and over-wide spans.
- Better table capture is a prerequisite for reliable equipment/stat QA prompts.

Scope:
- tighten table start detection in `_extract_section_entities_equipment`
- improve continuation/boundary handling for multi-page armor/weapon tables
- reject obvious noise captures (`Notes`, prose fragments, index-like lines)
- add targeted regression checks for extracted table names

Acceptance criteria:
- rerunning `entity-extract --kind equipment --mode replace` yields no table entities named `Notes`
- rerunning extraction yields no obviously prose-fragment table names
- expected core tables are present:
  - `Melee Weapon Table`
  - `Muscle-Powered Ranged Weapon Table`
  - `Armor Table` or a clearly named armor-table equivalent
  - `Hit Location Table`
- at least one automated test covers noisy table-name rejection
- `python -m unittest discover -s tests -v` passes

#### Ticket 2: Add DB-dependent integration tests for lookup and citations
Priority: P1

Why this second:
- We already have a working DB and regression runner, but not enough assertions around exact lookup behavior and citation structure.
- This gives us safer refactoring room before deeper extractor changes.

Scope:
- add integration tests against the local populated DB
- verify exact entity lookup beats weaker fuzzy matches for representative prompts
- verify `qa` output includes `## Best Evidence`
- verify `qa` output includes a `Source:` citation
- verify representative prompts emit block/page refs when available

Acceptance criteria:
- at least 3 DB-backed integration tests are added
- tests cover:
  - exact named trait/rule lookup
  - broad combat-rule query
  - citation/refs presence
- tests fail meaningfully if the DB is missing or malformed
- `python -m unittest discover -s tests -v` passes

#### Ticket 3: Add item-level equipment/stat extraction
Priority: P2

Why this third:
- This is the largest value unlock after table capture is stabilized.
- It moves equipment support from table retrieval to structured lookup.

Scope:
- define first structured equipment extraction target:
  - melee weapons
  - ranged weapons
  - armor
- choose a normalized entity shape for extracted stats
- parse a minimal set of stable fields before trying to cover everything
- wire extracted equipment entities into lookup and QA ranking

Acceptance criteria:
- at least one equipment class is extracted at item level
- extracted items are stored as real entities, not only table blobs
- representative item lookups return the item itself, not just the surrounding table
- at least 5 DB-backed assertions cover equipment/stat retrieval
- README/TODO wording is updated to reflect the new support level

### High priority
- [ ] Continue expanding the golden-question regression set
  - more combat defenses and edge cases
  - more hit location and ranged combat prompts
  - more trait and skill phrasing variants
  - equipment/stat lookup prompts once table extraction and ranking are reliable enough
- [ ] Continue tuning `qa` ranking quality
  - reduce noisy supporting chunks
  - improve chunk fallback ordering
  - prefer stronger supporting chunks for broad combat questions

### Medium priority
- [ ] Improve equipment/table extraction quality
  - cleaner table boundary detection
  - fewer noisy table names like `Notes`
  - better handling of armor/weapon table continuations
- [ ] Add item-level equipment/stat extraction
  - weapon stats
  - armor DR
  - hit location tables
- [ ] Expand structured combat coverage where chunk fallback is still too common
  - more subrules
  - more aliases
  - better exact rule hits for user phrasing
- [ ] Add DB-dependent integration tests around exact entity lookup and citations
- [ ] Add smoke tests for `entity-extract --kind ...`
- [ ] Continue shrinking `scripts/rulesdb.py` into a thinner CLI entrypoint

### Nice to have
- [ ] Add structured field parsing on top of verbatim entity text
  - skill defaults and prerequisites
  - trait costs/per-level forms
  - weapon and armor fields
- [ ] Add better review/report tooling for low-confidence extracted entities
- [ ] Add answer-quality checks for unsupported claims and empty evidence cases

## Success criteria

The DB work is “good enough” when:
- the assistant answers rules questions from retrieved Basic Set evidence
- every non-trivial answer can cite page/block evidence
- named trait/rule/skill lookup is reliable
- broad combat questions usually retrieve the right rule first
- unsupported questions fail safely with “not found / unclear” instead of hallucination

## Known risks

- Equipment tables remain the most extraction-sensitive part
- Current "equipment support" is mostly table capture, not item-level normalization
- Broad natural-language combat questions are still harder than named lookups
- Header/footer and heading heuristics can still produce edge-case extraction errors
- Verbatim text must remain preserved even when cleaned text is optimized for search
