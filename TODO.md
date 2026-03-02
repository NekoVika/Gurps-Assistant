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

