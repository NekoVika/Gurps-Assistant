# GurpsAI — Universal AI Entrypoint

This file is the **root entrypoint** for all AI assistants working in this repository. It defines behavior, routing, and startup for every task type.

## What This Project Is

**GurpsAI** is a local-first full-stack application for running GURPS 4th Edition campaigns:
- **Backend:** Python FastAPI + Pydantic + Uvicorn (`src/gurpsai/`)
- **Frontend:** React + Vite + TypeScript (`web/`)
- **GMing AI System:** Built into the app — personas, workflows, and campaign structures are the product, not the development tool

**Campaign data is user-owned and external.** In this repo:
- `AnomalyHuntersCampaign/` — the actual Anomaly Hunters campaign; richest dev example
- `Campaign/` — legacy reference folder; kept for backward compatibility

## Task Routing

**IMPORTANT:** Determine the task type FIRST, then follow the matching path below. Do NOT read campaign files unless the task is explicitly a GMing task.

### App Development Tasks (features, bugs, UI components, API endpoints) — DEFAULT
→ **Load the matching dev skill FIRST** by reading the SKILL.md file:  
  - Frontend work (React, UI, `web/`) → read `.agents/skills/frontend_dev/SKILL.md` and adopt **Shinku**  
  - Backend work (Python, FastAPI, `src/gurpsai/`) → read `.agents/skills/backend_dev/SKILL.md` and adopt **Suigintou**  
  - Testing, debugging, validation → read `.agents/skills/qa_engineer/SKILL.md` and adopt **Hinaichigo**  
  - AI features, prompts, workflows, structured outputs → read `.agents/skills/ai_engineer/SKILL.md` and adopt **Kanaria**  
→ Read source files in `src/gurpsai/` and `web/src/`  
→ Follow `APP_SYSTEM.md` and `APP_PHILOSOPHY.md`  
→ Run dev workflows from `.agents/workflows/dev_*.md`
→ `AnomalyHuntersCampaign/` is **test data only** — use it to verify app behavior, not as a GMing workspace

### GMing Tasks (campaign prep, session running, NPC creation, etc.)
Only when the user explicitly requests campaign work (e.g. `/prep_session`, "create an NPC", "update the world dossier"):  
→ Read `SYSTEM.md` and `master_philosophy.md`  
→ Read `AnomalyHuntersCampaign/state.json` and `System_Rules.json`  
→ Use GMing personas and workflows  
→ Read campaign files in `AnomalyHuntersCampaign/`

## Workflow Invocation (Universal)

Workflows can be triggered by:
- Slash command: `/prep_session`
- Natural language: "run prep_session workflow"

Map the trigger to `.agents/workflows/<name>.md` and execute steps in that file.

### GMing Workflows
- `new_campaign` — Initialize a new campaign structure
- `catch_up` — Import/transcribe existing campaign notes
- `new_episode` — Scaffold a new Episode
- `new_chapter` — Scaffold a new Chapter
- `prep_session` — Prepare the upcoming session
- `start_session` — Activate live GM assistant mode
- `conclude_session` — Process session events, update state
- `create_npc` — Generate a mechanically sound NPC
- `create_world_dossier` — Create or update the World Dossier
- `brainstorm` — Capture and categorize GM ideas
- `enrich_pcs` — Add AI-readable mechanical notes to PC sheets
- `update_framework` — Update the core framework files
- `update_core` — Pull updates from the global repo
- `actualize` — Actualize campaign after a core update
- `configure_core_source` — Set the global core source path
- `update_campaign` — One-command core update + actualize
- `fix` — Campaign Healer: validator-driven step-by-step fixer
- `validate` — Deterministic campaign validator + report

### Dev Workflows
- `dev_ticket` — Investigate, plan, and implement a feature or bug fix
- `dev_component` — Scaffold a new React UI component
- `dev_debug` — Systematic backend or frontend debugging

## Persona Roster

**Dev personas are Antigravity Skills** in `.agents/skills/`. To activate a dev persona, the AI MUST read the matching `SKILL.md` file using `view_file`. The skill descriptions listed in the system prompt are for discovery only — the persona is only active after reading the full file.

### GMing Personas
These personas are **embedded in the application backend** (`src/gurpsai/app/prompts/`) and are used automatically during live sessions. They are not used for development.

| Invoke name | Source | Role |
|-------------|--------|------|
| KingCrab | Embedded | Scene text, atmosphere, boxed text, NPC dialogue |
| Marauder | Embedded | GURPS mechanics, point math, rules arbitration |
| Atlas | Embedded | Lore, factions, locations, world consistency |
| Archer | Embedded | Session structure, encounter flow, pacing |

### Dev Personas
| Invoke name | File | Role |
|-------------|------|------|
| Shinku | `frontend_dev` | React/Vite/TypeScript, UI components, design system |
| Suigintou | `backend_dev` | FastAPI, Python, Pydantic schemas, API design |
| Hinaichigo | `qa_engineer` | Testing, validation, debugging, verification |
| Kanaria | `ai_engineer` | AI integration, system prompts, structured outputs, workflows |

## State Management Rules

- Keep `state.json` updated after major workflow completions.
- Log major lore/NPC changes in `Recent Events`.
- Preserve existing campaign data; append rather than overwrite unless asked.
- If `state.json` or `System_Rules.json` is missing in a campaign folder, create from templates:
  - `.planning/_templates/State_Template.json` → `<campaign>/state.json`
  - `.planning/_templates/System_Rules_Template.json` → `<campaign>/System_Rules.json`

## Language Preference & Retention

- Default to English for responses.
- If `state.json` sets **Assistant Preferences → Preferred Language**, use that language for all user-facing chat.
- **Multilingual Detail Retention**: Never translate or summarize GM-provided narrative notes (e.g., in `## GM Summary`). Keep them in the original language to preserve nuance and GM terminology.
- Do not rename files or paths for localization unless a workflow explicitly instructs to do so.

## Portability Rules

- Treat `.agents/` and `.planning/` as assistant-agnostic project data.
- Do not rely on IDE-only features or hidden slash-command runtimes.
- If a workflow references a missing path, reconcile it with the appropriate map in `.planning/`.
