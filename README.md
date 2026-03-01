# GURPS GM Assistant System

This is a structured AI-assisted environment for running GURPS 4th Edition campaigns with reusable personas, workflows, and a consistent folder architecture.

## Project Purpose
The system is a co-pilot for GMs. It offloads rules crunching, tracking, and organization so the GM can focus on pacing, improvisation, and player-facing narrative.

## Core Philosophy
- System Supremacy (GURPS 4e): Use official 4e rules and avoid fabricated mechanics.
- Mechanical Transparency: Explain how advantages/traits work at the table.
- Character-Centric Design: Pull hooks from PC sheets into scenes and encounters.
- Contextual Awareness: Respect Tech Level, Mana Level, and house rules in `00_System_Rules.md`.

For full design principles, see `master_philosophy.md`.

## Directory Structure
```text
/Campaign_Root/
|-- .agents/                 # Personas and workflows
|-- .planning/               # Folder map and templates
|-- 00_System_Rules.md       # Tech Level, Mana, house rules
|-- 01_World_Bible/          # Lore, factions, locations
|-- 02_Characters/           # PCs, NPCs, bestiary
|-- 03_Story/                # Episodes, chapters, encounters
|-- AGENTS.md                # Codex-compatible instructions
|-- SYSTEM.md                # Assistant-neutral canonical instructions
|-- gemini.md                # Gemini compatibility shim
|-- master_philosophy.md     # Core principles
`-- state.md                 # Current campaign state
```

Detailed taxonomy: `.planning/MAP.md`.

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
- `brainstorm`
- `update_framework`
- `update_core`
- `actualize`
- `configure_core_source`
- `update_campaign`

## Universal Invocation
You can invoke workflows in either form:
- Slash style: `/create_npc`
- Plain style: `run create_npc workflow`

You can invoke personas directly:
- `RulesLawyer, build a 100-point city guard`
- `Narrator, describe this ruined shrine`

## Getting Started
1. Read `state.md`.
2. Follow startup docs: `AGENTS.md` (Codex) and `SYSTEM.md` (universal).
3. Use templates from `.planning/_templates/` for new campaign files.

## Core Update Workflow
This project is designed to be copied into new campaign folders. To propagate core improvements later, use the manifest-driven updater:

1. Dry run:
   `powershell -ExecutionPolicy Bypass -File .\scripts\framework-sync.ps1 -CorePath "<PATH_TO_UPDATED_CORE>" -DryRun`
2. Apply:
   `powershell -ExecutionPolicy Bypass -File .\scripts\framework-sync.ps1 -CorePath "<PATH_TO_UPDATED_CORE>"`
3. Force overwrite conflicts (optional):
   `powershell -ExecutionPolicy Bypass -File .\scripts\framework-sync.ps1 -CorePath "<PATH_TO_UPDATED_CORE>" -Force`

What is updated:
- Managed roots: `.agents/`, `.planning/`, `scripts/`
- Managed files: `AGENTS.md`, `SYSTEM.md`, `gemini.md`, `master_philosophy.md`, `README.md`, `.framework/framework.manifest.json`

What is protected:
- `00_System_Rules.md`, `state.md`, `01_World_Bible/`, `02_Characters/`, `03_Story/`

The updater stores sync state at `.framework/install-state.json` and, when forced, writes backups to `.framework/backups/<timestamp>/`.

## Global Repo + Releases Model
For global operation across many campaigns:

1. Maintain this core in a dedicated Git repo.
2. Publish changes as tags/releases (for example `v1.2.0`).
3. In each running campaign, set source once:
   `powershell -ExecutionPolicy Bypass -File .\scripts\set-core-source.ps1 -RepoUrl "<CORE_REPO_URL>" -DefaultRef "main" -UseLatestTag`
4. On each update cycle, dry run:
   `powershell -ExecutionPolicy Bypass -File .\scripts\update-campaign.ps1 -DryRun`
5. Apply:
   `powershell -ExecutionPolicy Bypass -File .\scripts\update-campaign.ps1`
6. If conflicts must be overwritten:
   `powershell -ExecutionPolicy Bypass -File .\scripts\update-campaign.ps1 -Force`

This gives you two explicit phases:
- `Update Core` = technical/framework sync
- `Actualize` = campaign integrity check and remediation guidance

## Script Shortcuts
- Configure default Git source once:
  `scripts/set-core-source.ps1`
- Update only technical core:
  `scripts/update-core.ps1`
- Full pipeline (core + actualization):
  `scripts/update-campaign.ps1`
