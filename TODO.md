# Project TODO Roadmap

This roadmap is divided into two sections: App Development and Core AI Development. Each milestone includes goals, scope, deliverables, acceptance criteria, and suggested KPIs to keep progress measurable.

## App Development

### M1 — Foundation Hardening
- Goals: Implement .env loading; add logging with levels; expand CLI help.
- Scope: 
  - Load both global `%USERPROFILE%\.gurps-assistant\.env` and local `.env` without overriding existing env vars. 
  - Introduce logging with INFO/DEBUG/ERROR and consistent formatting. 
  - Extend help text with examples for `app`, `gm`, and `ai`.
- Deliverables: .env loader module; logging setup; richer `help` output.
- Acceptance: Precedence verified in tests; logs show INFO by default and DEBUG when enabled; help includes usage examples.
- KPIs: Startup configuration errors↓; setup time↓; support requests about configuration↓.

### M2 — Quality Gates
- Goals: Add linting, formatting, types, tests, and CI.
- Scope: Configure `ruff`, `black`, `mypy` in `pyproject.toml`; add `pytest` scaffold; create GitHub Actions workflow to run lint/type/test.
- Deliverables: Tool configs; minimal test suite for sync and actualize; CI status checks.
- Acceptance: CI passes on main; style and type checks enforced; tests run locally and in CI.
- KPIs: Early failure detection↑; style violations trend↓; PR turnaround time↓.

### M3 — Modularize CLI
- Goals: Split `cli.py` into cohesive modules without altering public behavior.
- Scope: Extract `fs_sync.py`, `git_ops.py`, `app.py`, `actualize.py`, `ai_config.py`, `install.py`, `utils.py`; preserve entrypoint.
- Deliverables: New module layout; import map updated; release notes documenting refactor.
- Acceptance: All commands behave identically; tests and CI remain green.
- KPIs: Average function size↓; unit testability↑; change risk↓.

### M4 — UX & Validation
- Goals: Add `--verbose/--quiet`, basic progress indicators, and input validation.
- Scope: Validate `repo_url` and `ref`; improve error messages with actionable remediation; optional progress output for long syncs.
- Deliverables: CLI flags; validation utilities; enhanced error texts.
- Acceptance: Flags documented; bad inputs yield clear guidance; progress togglable.
- KPIs: Usage-related support tickets↓; user-reported confusion↓.

### M5 — Packaging Modernization
- Goals: Adopt PEP 621 metadata; reduce reliance on `setup.py`.
- Scope: Move metadata to `pyproject.toml`; ensure build/publish still functional.
- Deliverables: Updated packaging files; brief release steps.
- Acceptance: Build installs and console entrypoint works on supported platforms.
- KPIs: Release friction↓; packaging warnings/elisions↓.

### M6 — Performance Polish
- Goals: Improve large-core performance without sacrificing correctness.
- Scope: Optional parallel hashing; tuned chunk sizes; timing and progress reporting.
- Deliverables: Opt-in parallel flag; benchmarks; timing output.
- Acceptance: 90th percentile sync time↓ on large test corpus; correctness verified by state hashes.
- KPIs: Sync duration↓; user perceived wait↓.

## Core AI Development

### M1 — Provider Config UX
- Goals: Smooth provider configuration and status reporting with .env integration.
- Scope: Reflect enabled/default flags; detect missing API keys; clear next steps.
- Deliverables: Polished `ai providers` and `ai configure`; docs/help updates.
- Acceptance: Accurate status output; onboarding tested with each provider.
- KPIs: Configuration failure rate↓; time-to-first-success↓.

### M2 — Startup Docs Loader
- Goals: Deterministic startup prompt assembly from `state.md`, `SYSTEM.md`, `master_philosophy.md`, `.planning/MAP.md`, `00_System_Rules.md`.
- Scope: Ordered loader; `--SkipStartupDocs` and prompt printing parity.
- Deliverables: Loader utilities; `--PrintPromptOnly` pathway verified.
- Acceptance: Prompts assemble identically across runs; print-only reflects exact content.
- KPIs: Prompt assembly bugs↓; reproducibility↑.

### M3 — Runtime Adapters (Minimal)
- Goals: Normalize payload construction for OpenAI Responses, Gemini GenerateContent, and OpenAI Chat.
- Scope: Mapping layer with DryRun preview; no secret storage; robust validation.
- Deliverables: Adapter module; `ai run --DryRun` payload preview.
- Acceptance: Payloads match provider specs; DryRun outputs are human-inspectable.
- KPIs: Adapter defect rate↓; integration friction↓.

### M4 — Workflow Runner (Preview)
- Goals: Parse workflow `.md` files and emit step guidance (no execution).
- Scope: Convert headings to step list with IDs; support variable capture stubs; approval checkpoints.
- Deliverables: `gm workflow <name>` step printer with IDs.
- Acceptance: Steps render clearly with consistent IDs and order.
- KPIs: User comprehension↑; planning time↓.

### M5 — Persona Harness
- Goals: Load persona `.md` context and merge into system prompt builder.
- Scope: Role selection; consistent merge rules with startup docs; conflict resolution.
- Deliverables: Persona merge utilities; prompt preview including persona.
- Acceptance: `--PrintPromptOnly` shows persona+docs merged deterministically.
- KPIs: Persona usage accuracy↑; user corrections↓.

### M6 — Safety & Telemetry
- Goals: Improve safety and observability without exposing secrets.
- Scope: Redact keys in logs; request/response truncation; opt-in anonymized metrics.
- Deliverables: Log filters; truncation logic; telemetry toggle in config.
- Acceptance: Logs safe by default; opt-in recorded; size caps enforced.
- KPIs: Zero secret leaks; actionable performance insights↑.

### M7 — Rules Index & Citation Validator
- Goals: Establish a minimal, offline citation discipline to back answers with verifiable book/page references and enforce Allowed Books from `00_System_Rules.md`.
- Scope:
  - Define metadata-only schemas (no rules text) for a book code map and a rules index.
  - Specify accepted citation grammar (short/long forms, ranges) and normalization rules.
  - Define PASS/WARN/FAIL outcomes, hit-rate thresholds, and campaign policy integration.
  - Outline non-invasive CLI surfaces for compile/validate (future), without implementation.
- Deliverables:
  - Book code map schema: code, title, aliases, page_min, page_max.
  - Rules index schema: id, name, book code, pages (list or ranges), aliases, tags.
  - Compiled runtime shape: a single `index.json` bundling books, rules, and `page_to_rules` for fast lookup.
  - Regex set for citation extraction and normalization rules (dash/space variants, alias resolution).
  - Validator decision matrix and report format (machine-readable JSON + human summary).
- Acceptance:
  - No copyrighted rules text is stored; only names and page numbers.
  - Allowed books are honored via parsing of `Allowed Books / Supplements` in `00_System_Rules.md` or explicit override.
  - Status policy: FAIL on invalid/disallowed books or out-of-range pages; WARN when citations exist but known-page hit-rate < 0.6; PASS otherwise with ≥1 citation in mechanics-heavy outputs.
  - Citation grammar accepted: `B369`, `B 369`, `B368-370`, `Basic Set p. 369`, `Martial Arts pp. 100–101`.
  - Thresholds and behavior are deterministic and offline-only.
\- KPIs: Valid-citation rate↑; known-page hit-rate↑; disallowed/invalid citations↓; average time to add a new section entry↓.
  
Spec (concise):
- Files (conventions, not implemented):
  - `.framework/rules/books.yml` → metadata for book codes and alias mapping.
  - `.framework/rules/index.yml` → named sections with page coverage.
  - `.framework/rules/index.json` → compiled bundle for runtime checks.
- Citation parsing:
  - Short: `\b([A-Z]{1,3})\s?(\d{1,4})(?:\s*[-–]\s*(\d{1,4}))?\b`
  - Long: `\b([A-Za-z][A-Za-z ]{2,40})\s+p+\.?\s*(\d{1,4})(?:\s*[-–]\s*(\d{1,4}))?`
  - Normalize: map aliases/title→code; expand ranges; enforce page_min/max per book.
- Decision policy:
  - Metrics: total, valid, known, unknown, invalid_books, disallowed_books, out_of_range, rule_hit_rate.
  - PASS: citations present, no hard errors, hit-rate ≥ 0.6.
  - WARN: citations present, no hard errors, hit-rate < 0.6 or zero citations for non-mechanical outputs.
  - FAIL: any invalid/disallowed/out-of-range or zero citations when mechanics heuristics trigger.
- Mechanics heuristics (toggleable): if text contains maneuver names or numeric rules patterns (e.g., “-2 per…”, “1d per…”, “Fright Check”), require ≥1 valid citation.
- Mode strictness:
  - `start_session`: strict (require at least one known page).
  - `prep/lore`: lenient (citations optional; WARN only if mechanics-heavy).
- Future CLI (outline only):
  - `gurpsai rules compile` → compile YAML to JSON; validate schema and ranges.
  - `gurpsai ai validate-citations --from00|--allow B,MA --text <file>|--stdin` → produce PASS/WARN/FAIL and JSON findings.

## Timeline & Dependencies

- Phase 1 (Weeks 1–2): App M1, Core M1, Core M2, App M2.
- Phase 2 (Weeks 3–4): App M3, App M4, Core M3.
- Phase 3 (Weeks 5–6): Core M4, Core M5, App M5.
- Phase 4 (Weeks 7–8): App M6, Core M6.

Dependencies:
- App M1 precedes App M2 and M3.
- Core M1 precedes Core M2 and M3.
- Core M4 depends partially on App M3 structure.

Risks & Mitigations:
- Modularization regressions → mitigate with tests from M2 and incremental refactors.
- Parallel hashing nondeterminism → keep opt-in and add correctness checks.
- Provider API drift → pin spec versions where possible and cover adapters with tests.

