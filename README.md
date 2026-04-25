# GURPS GM Assistant System

This is a structured AI-assisted environment for running GURPS 4th Edition campaigns with reusable personas, workflows, and a consistent folder architecture.

Status: Active development on `develop` focuses on AI GM personas/workflows, local rules retrieval, and the first steps toward a standalone local app. The broad app-style CLI remains incomplete, but the local `rulesdb` tooling is active and used by the rules persona.

## Project Purpose
The system is a co-pilot for GMs. It offloads rules crunching, tracking, and organization so the GM can focus on pacing, improvisation, and player-facing narrative.

## Current app direction
The next major product direction is a local-first standalone GM app:
- Python backend
- local web UI
- pluggable model providers
- first-class local LLM support via Ollama

Current stack decision:
- backend: `FastAPI` + `Uvicorn` + `Pydantic`
- frontend: `React` + `Vite` + `TypeScript`
- local model adapter target: `Ollama`
- optional desktop packaging later: `Tauri`

Planned repo layout:
- `src/gurpsai/` for backend/app code
- `web/` for the frontend

The goal is to preserve the existing campaign/workflow/rules-db architecture while making the assistant usable without depending on Antigravity as the primary interface.

## Local app configuration
The standalone app reads local provider settings from a repo-root `.env` file.

Recommended setup:
- copy `.env.example` to `.env`
- put API keys there instead of setting shell environment variables manually
- keep `.env` local only; it is gitignored

Current keys/settings used by the app:
- `GEMINI_API_KEY`
- optional `GEMINI_BASE_URL`
- optional `GEMINI_TIMEOUT_SECONDS`

## Core Philosophy
- System Supremacy (GURPS 4e): Use official 4e rules and avoid fabricated mechanics.
- Mechanical Transparency: Explain how advantages/traits work at the table.
- Character-Centric Design: Pull hooks from PC sheets into scenes and encounters.
- Contextual Awareness: Respect Tech Level, Mana Level, and house rules in `00_System_Rules.md`.

For full design principles, see `master_philosophy.md`.

## Directory Structure

Repo layout (develop):
```text
/GurpsAI/
|-- .agents/                # Personas and workflows (authoritative source)
|-- .planning/              # Folder map and templates (authoritative source)
|-- .framework/             # Core metadata/state (non-sensitive)
|-- scripts/
|   |-- rulesdb.py          # Local rules DB CLI
|   |-- rulesdb_lib/        # Rules DB helper/command modules
|   |-- test_rulesdb_qa.py  # Rules DB regression runner
|   `-- python/
|       `-- gurpsai.py      # Legacy shim for broader CLI/app work
|-- rules_db/               # Local DB schema, config example, docs
|-- tests/                  # Automated tests
|-- AGENTS.md               # Codex-compatible instructions
|-- SYSTEM.md               # Assistant-neutral canonical instructions
|-- master_philosophy.md    # Core principles
|-- README.md               # This file
|-- TODO.md                 # Roadmap; App section on hold
|-- gemini.md               # Gemini compatibility shim
|-- .gitignore
`-- Campaign/              # Active campaign workspace
```
```text
/Campaign_Root/
|-- .agents/                 # Personas and workflows
|-- .planning/               # Folder map and templates
|-- 00_System_Rules.md       # Tech Level, Mana, house rules
|-- 01_World_Bible/          # Lore, factions, locations
|-- 02_Characters/           # PCs, NPCs, bestiary
|-- 03_Story/                # Episodes, chapters, encounters
|-- Legacy/                  # Raw, messy notes; ignored by agents except Catch-Up
|-- AGENTS.md                # Codex-compatible instructions
|-- SYSTEM.md                # Assistant-neutral canonical instructions
|-- gemini.md                # Gemini compatibility shim
|-- master_philosophy.md     # Core principles
`-- state.md                 # Current campaign state
```

Detailed taxonomy: `.planning/MAP.md`.

Notes:
- Legacy/ must live inside the campaign root path.
- Agents and workflows ignore Legacy/ entirely, except when explicitly running the Catch-Up workflow.

## Personas
- Narrator: Scene text, dialogue, atmosphere.
- RulesLawyer: Mechanical rulings, point math, adjudication. For rules questions it is wired to use `python scripts/rulesdb.py qa "the user's question"` before answering.
- WorldBuilder: Locations, factions, lore depth.
- SessionPlanner: Session/chapter structure and encounter flow.

## Rules Retrieval
The repo includes a local, offline rules database pipeline for the GURPS Basic Set.

Main command:
- `python scripts/rulesdb.py qa "How does a Deceptive Attack work?"`

Useful commands:
- `python scripts/rulesdb.py doctor`
- `python scripts/rulesdb.py search "Alcoholism" --book basic_set`
- `python scripts/rulesdb.py entity-show "Combat Reflexes" --book basic_set --refs`
- `python scripts/rulesdb.py qa "Can I dodge bullets?"`

Current capabilities:
- deterministic PDF extraction into SQLite
- lexical chunk search
- structured entity extraction for advantages, disadvantages, skills, maneuvers, and combat rules
- semantic retrieval via Chroma
- question-oriented retrieval that returns a compact evidence bundle with citations

See [rules_db/README.md](/c:/Users/VikA/Documents/RPG/AnomalyHunter_v2/rules_db/README.md) for setup and DB-specific usage.

## Workflows
Available workflows in `.agents/workflows/`:
- `new_campaign`
- `catch_up`
- `new_episode`
- `new_chapter`
- `prep_session`
- `start_session`
- `conclude_session`
- `create_npc`
- `enrich_pcs`
- `brainstorm`
- `update_framework`
- `update_core`
- `actualize`
- `configure_core_source`

## Validator (No AI)
A deterministic structural validator is available for the `Campaign/` folder. It checks Markdown files against versioned contracts in `.planning/contracts/` and writes reports to `Campaign/_reports/`.

- Run: `python scripts/validate.py`
- JSON output is intended to drive the `/fix` workflow (step-by-step, GM-confirmed).
- `update_campaign`

## PC Sheets (GCS Sync)
If you keep player character sheets in **GCS** (`.gcs`) and want a single AI-friendly Markdown file per PC, use the deterministic sync script:

- Structure rule: store sources as `Campaign/02_Characters/PCs/_source/<PC>.gcs`
- Single file: `python scripts/sync_pc_from_gcs.py Campaign/02_Characters/PCs/_source/PC.gcs --md Campaign/02_Characters/PCs/PC_Name.md`
- Batch (scan all PCs): `python scripts/sync_pc_from_gcs.py`
- PowerShell wrapper: `powershell -ExecutionPolicy Bypass -File scripts/sync_pc_from_gcs.ps1 -Gcs Campaign/02_Characters/PCs/_source/PC.gcs -Md Campaign/02_Characters/PCs/PC_Name.md -Sort`

The sync updates only marked/generated blocks (Attributes, Advantages, Disadvantages, Skills, Gear) and preserves hand-authored notes and callouts.

## Universal Invocation
You can invoke workflows in either form:
- Slash style: `/create_npc`
- Plain style: `run create_npc workflow`

If your chat client removed slash-command support, use the repo-scoped router skill:
- `use repo skill: anomalyhunter` (then: `run prep_session workflow`)

You can invoke personas directly:
- `RulesLawyer, build a 100-point city guard`
- `Narrator, describe this ruined shrine`

Note:
- Codex may not show a slash-command menu from `.agents/workflows`. Natural language invocation is always supported.
- The broader app/manager CLI is still in flux, but `python scripts/rulesdb.py ...` is available on `develop`.

## Getting Started
1. Read `state.md`.
2. Follow startup docs: `AGENTS.md` (Codex) and `SYSTEM.md` (universal).
3. Use templates from `.planning/_templates/` for new campaign files.
4. For any rules DB work, use `python scripts/rulesdb.py --help` and the setup notes in `rules_db/README.md`.

## Compatibility Contract (Legacy Copy Mode)
The original workflow remains a supported path:
- Copy core files/folders (`.agents`, `.planning`, root docs) into a campaign folder.
- Run directly in Antigravity/Codex UI using workflow prompts (for example `run prep_session workflow`).
- Do not require global app state to use core personas/workflows/templates.

To verify this contract after framework changes:
- `gurpsai actualize-campaign`
- The report now validates required personas, templates, workflow files, workflow index coverage, and AGENTS invocation patterns.

## CLI Availability
There are currently two different command surfaces:

- `python scripts/rulesdb.py ...`
  - available on `develop`
  - used for local rules extraction and retrieval
  - actively maintained
- broader `gurpsai` app/manager CLI
  - still tied to unfinished CLI/app work
  - legacy shim remains in `scripts/python/gurpsai.py`
  - if you are working on that surface specifically, `feature/cli` is still the relevant branch

## Application Mode
The global app/manager command surface is still incomplete on `develop`. Core persona/workflow usage and the local rules DB tooling are the supported paths in this branch.

## Terminal AI Providers
Provider routing via the unfinished app CLI is still not the primary path on `develop`. Use personas/workflows in chat, and use `rulesdb.py` directly for deterministic rules retrieval.

## Updates Distribution
- End users pull updates via Git. No packaged app releases are provided on develop.
- When CLI/app surfaces resume, instructions will be reintroduced from `feature/cli` and merged accordingly.
