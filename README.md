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

Note for Codex:
- Codex may not show a slash-command menu from `.agents/workflows`.
- Use natural language workflow requests or run the terminal router:
  `gurpsai gm help`
- List available workflow commands:
  `gurpsai gm workflows`
- Print runnable prompt for one workflow:
  `gurpsai gm workflow create_npc`

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

## Install As CLI App
After cloning the core repo, install the Python package and global launcher:

1. From repo root run:
   `python -m pip install -e .`
2. (Optional global launcher/config bootstrap) run:
   `gurpsai install`
3. Open a new terminal.
4. Run:
   `gurpsai help`

Runtime note:
- Core command logic runs from Python package entry (`src/gurpsai/cli.py`).
- Legacy script path `scripts/python/gurpsai.py` remains as a compatibility shim.
- Python is required; no legacy PowerShell fallback is used for framework operations.

Global app home (default):
- `%USERPROFILE%\.gurps-assistant\`
- Override with `GURPSAI_HOME`

## Application Mode (Global Campaign Manager)
Instead of copy/paste for every new campaign, use the app command layer:

1. Initialize global state:
   `gurpsai init`
2. Create a new campaign:
   `gurpsai new -Name "MyCampaign"`
3. Register existing campaign:
   `gurpsai register -Name "Legacy" -Path "D:\RPG\LegacyCampaign"`
4. Load campaign:
   `gurpsai load -Name "MyCampaign"`
5. Update active campaign from configured global source:
   `gurpsai update -DryRun`
   `gurpsai update`

Global state file:
- `%USERPROFILE%\.gurps-assistant\state.json` (fallback: `<core>/.app-global/state.json`)
Global core source config:
- `%USERPROFILE%\.gurps-assistant\core-source.json`
Global core cache:
- `%USERPROFILE%\.gurps-assistant\cache\`

## Terminal AI Providers (No IDE Required)
Use provider routing from terminal:

1. Show providers:
   `gurpsai ai providers`
2. Configure ChatGPT/OpenAI:
   `gurpsai ai configure -Provider chatgpt -ApiKeyEnv OPENAI_API_KEY -Model gpt-5 -SetDefault`
3. Configure Gemini:
   `gurpsai ai configure -Provider gemini -ApiKeyEnv GEMINI_API_KEY -Model gemini-2.5-pro`
4. Configure DeepSeek:
   `gurpsai ai configure -Provider deepseek -ApiKeyEnv DEEPSEEK_API_KEY -Model deepseek-chat`
5. Note:
   `chat` / `workflow` / `agent` runtime execution is not yet ported to Python-only mode.

Global AI provider config:
- `%USERPROFILE%\.gurps-assistant\ai-config.json`

Security model:
- API keys are not stored in project files.
- Config stores only environment variable names (`OPENAI_API_KEY`, `GEMINI_API_KEY`, `DEEPSEEK_API_KEY`).
- Optional `.env` support:
  - Global file: `%USERPROFILE%\.gurps-assistant\.env`
  - Local file (also loaded): `<current_working_directory>\.env`
  - Existing process environment variables take priority.
  - Local `.env` fills missing vars; it does not overwrite already-set values.

## Global Repo + Releases Model
For global operation across many campaigns:

1. Maintain this core in a dedicated Git repo.
2. Publish changes as tags/releases (for example `v1.2.0`).
3. Default source is preconfigured in `%USERPROFILE%\.gurps-assistant\core-source.json`:
   - Repo: `https://github.com/NekoVika/Gurps-Assistant.git`
   - Ref: `main`
   - Mode: latest tag
4. On each update cycle, dry run:
   `gurpsai update-campaign -DryRun`
5. Apply:
   `gurpsai update-campaign`
6. If conflicts must be overwritten:
   `gurpsai update-campaign -Force`
7. Optional override for a custom source:
   `gurpsai set-core-source -RepoUrl "<CORE_REPO_URL>" -DefaultRef "main" -UseLatestTag`

This gives you two explicit phases:
- `Update Core` = technical/framework sync
- `Actualize` = campaign integrity check and remediation guidance

## CLI Shortcuts
- Python runtime entrypoint:
  `python -m gurpsai`
  `gurpsai`
- Legacy compatibility script:
  `scripts/python/gurpsai.py`
- Unified command router:
  `gurpsai gm`
  - Workflow list: `gurpsai gm workflows`
  - Workflow prompt: `gurpsai gm workflow <name>`
- Configure default Git source once:
  `gurpsai set-core-source`
- Update only technical core:
  `gurpsai update-core`
- Full pipeline (core + actualization):
  `gurpsai update-campaign`
