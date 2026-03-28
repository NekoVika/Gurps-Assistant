# Local Rules DB Roadmap

Goal: maintain a local, queryable source of truth for GURPS Basic Set so the assistant answers from retrieved, cited text instead of memory.

## Current status

### Done
- [x] SQLite schema and local DB layout created under `rules_db/`
- [x] Deterministic PDF extraction into `pages` and `blocks`
- [x] Deterministic cleaning pipeline for extracted text
- [x] Deterministic chunking with SQLite FTS search
- [x] Chroma vector store integrated for semantic retrieval
- [x] `search`, `chunk-show`, `semantic-search`, and `agent-search` commands implemented
- [x] `qa` command implemented as the main question-oriented retrieval entrypoint
- [x] `RulesLawyer` wired to use `python scripts/rulesdb.py qa "the user's question"`
- [x] Structured entity extraction for:
  - [x] advantages
  - [x] disadvantages
  - [x] skills
  - [x] maneuvers
  - [x] combat rules
  - [x] spells
  - [x] equipment tables
- [x] Exact entity lookup plus semantic fallback working in retrieval flow
- [x] Citations included in `qa` output
- [x] QA regression runner added: `python scripts/test_rulesdb_qa.py`
- [x] Basic automated tests added: `python -m unittest discover -s tests -v`
- [x] Extractor-focused automated tests added
- [x] Golden-question regression set expanded beyond the initial smoke cases
- [x] `qa` ranking improved for broad combat-rule phrasing
- [x] Search/QA command logic modularized into `scripts/rulesdb_lib/commands/search.py`
- [x] Entity extraction command modularized into `scripts/rulesdb_lib/commands/entities.py`
- [x] Extractor logic modularized into `scripts/rulesdb_lib/extractors/entities.py`
- [x] Root and DB READMEs updated to reflect current behavior

### Working baseline
- `python scripts/rulesdb.py doctor`
- `python scripts/rulesdb.py qa "How does a Deceptive Attack work?"`
- `python scripts/test_rulesdb_qa.py`
- `python -m unittest discover -s tests -v`
- Current regression set covers 12 QA prompts

## Next development steps

### High priority
- [ ] Continue expanding the golden-question regression set
  - more combat defenses and edge cases
  - more hit location and ranged combat prompts
  - more trait and skill phrasing variants
  - equipment/stat lookup prompts once retrieval is reliable enough
- [ ] Continue tuning `qa` ranking quality
  - reduce noisy supporting chunks
  - improve chunk fallback ordering
  - prefer stronger supporting chunks for broad combat questions

### Medium priority
- [ ] Improve equipment/table extraction quality
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
- Broad natural-language combat questions are still harder than named lookups
- Header/footer and heading heuristics can still produce edge-case extraction errors
- Verbatim text must remain preserved even when cleaned text is optimized for search
