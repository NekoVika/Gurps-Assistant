# GURPS GM Assistant System

This is a structured AI-assisted environment for running GURPS 4th Edition campaigns with reusable personas, workflows, and a consistent folder architecture.

Status: Active development on develop focuses on AI GM personas/workflows and campaign framework. CLI/app work is paused on develop and continues on the feature/cli branch.

## Project Purpose
The system is a co-pilot for GMs. It offloads rules crunching, tracking, and organization so the GM can focus on pacing, improvisation, and player-facing narrative.

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
|   `-- python/
|       `-- gurpsai.py      # Legacy shim; depends on CLI (not functional on develop)
|-- AGENTS.md               # Codex-compatible instructions
|-- SYSTEM.md               # Assistant-neutral canonical instructions
|-- master_philosophy.md    # Core principles
|-- README.md               # This file
|-- TODO.md                 # Roadmap; App section on hold
|-- gemini.md               # Gemini compatibility shim
|-- .gitignore
`-- (no src/ CLI on develop)
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
- RulesLawyer: Mechanical rulings, point math, adjudication.
- WorldBuilder: Locations, factions, lore depth.
- SessionPlanner: Session/chapter structure and encounter flow.

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
- Terminal CLI commands are not available on develop. See “CLI Availability” below for the feature branch that contains the CLI.

## Getting Started
1. Read `state.md`.
2. Follow startup docs: `AGENTS.md` (Codex) and `SYSTEM.md` (universal).
3. Use templates from `.planning/_templates/` for new campaign files.

## Compatibility Contract (Legacy Copy Mode)
The original workflow remains a supported path:
- Copy core files/folders (`.agents`, `.planning`, root docs) into a campaign folder.
- Run directly in Antigravity/Codex UI using workflow prompts (for example `run prep_session workflow`).
- Do not require global app state to use core personas/workflows/templates.

To verify this contract after framework changes:
- `gurpsai actualize-campaign`
- The report now validates required personas, templates, workflow files, workflow index coverage, and AGENTS invocation patterns.

## CLI Availability
The Python CLI is not present on develop to keep AI GM work front-and-center.

- Active CLI development lives on branch: `feature/cli`.
- On that branch you can install and use the CLI:
  - `python -m pip install -e .`
  - `gurpsai help`
- The legacy script `scripts/python/gurpsai.py` is a shim that depends on the CLI sources; it is non-functional on develop.

## Application Mode (Paused on develop)
The global app/manager commands are paused on develop. When working on CLI/app features, switch to `feature/cli`.

## Terminal AI Providers
Provider routing via CLI is part of the paused app surface on develop. Use personas/workflows within your IDE or chat. Provider adapter work continues as part of Core AI development; CLI surfaces will return when merged from `feature/cli`.

## Updates Distribution
- End users pull updates via Git. No packaged app releases are provided on develop.
- When CLI/app surfaces resume, instructions will be reintroduced from `feature/cli` and merged accordingly.
