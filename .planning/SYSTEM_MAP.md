# GurpsAI — AI System File Index

This document is the **index of the AI system itself** — all the files that define how AI agents should think, act, and route tasks in this project. Load the appropriate files based on the task type.

---

## Root System Files

| File | Purpose | Load When |
|------|---------|-----------|
| `AGENTS.md` | Universal entrypoint. Task routing, persona roster, startup order. | Always — this is the root |
| `SYSTEM.md` | GMing system instructions: state management, world dossier, ignored dirs | GMing tasks |
| `master_philosophy.md` | Project identity, dual mode concept, GMing prime directives, narrative hierarchy | GMing tasks, philosophy questions |
| `APP_SYSTEM.md` | App features, UI components, API endpoints, how the app works | Dev tasks, UI work, "how does the app do X?" questions |
| `APP_PHILOSOPHY.md` | App design philosophy: JSON-first, Passport pattern, local-first, trust/transparency UX | Architecture decisions, new feature design |

---

## Dev Persona Skills (`.agents/skills/`)

Dev personas are implemented as **Antigravity Skills**. Each skill folder contains a `SKILL.md` that the AI must read to activate the persona.

| Name | Skill Folder | Domain |
|------|-------------|--------|
| **Shinku** | `frontend_dev/` | React, Vite, TypeScript, UI components, design system, Passport patterns |
| **Suigintou** | `backend_dev/` | FastAPI, Python, Pydantic, API routing, services, provider abstraction |
| **Hinaichigo** | `qa_engineer/` | Testing, validation, debugging, campaign validator, error isolation |
| **Kanaria** | `ai_engineer/` | AI integration, system prompts, structured outputs, workflows |

### GMing Personas (Embedded in Backend)

GMing personas are **not** Antigravity skills. They are embedded in the application backend at `src/gurpsai/app/prompts/` and used at runtime by the app itself.

| Name | Runtime Role |
|------|--------------|
| **KingCrab** | Scene text, atmosphere, boxed text, NPC voices, sensory descriptions |
| **Marauder** | GURPS 4e mechanics, point math, rules arbitration, character builds |
| **Atlas** | Lore, factions, locations, world consistency, history |
| **Archer** | Session structure, encounter pacing, chapter flow, GM notes |

---

## Workflow Files (`.agents/workflows/`)

### GMing Workflows

| Trigger | File | Purpose |
|---------|------|---------|
| `/new_campaign` | `new_campaign.md` | Initialize a fresh campaign folder |
| `/catch_up` | `catch_up.md` | Import existing unstructured campaign notes |
| `/new_episode` | `new_episode.md` | Scaffold a new Episode arc |
| `/new_chapter` | `new_chapter.md` | Scaffold a new Chapter within an Episode |
| `/prep_session` | `prep_session.md` | Prepare the upcoming play session |
| `/start_session` | `start_session.md` | Activate live GM assistant mode |
| `/conclude_session` | `conclude_session.md` | Process session events, update state |
| `/create_npc` | `create_npc.md` | Generate a mechanically sound NPC |
| `/create_world_dossier` | `create_world_dossier.md` | Create or update the World Dossier |
| `/brainstorm` | `brainstorm.md` | Capture and categorize GM ideas |
| `/enrich_pcs` | `enrich_pcs.md` | Add AI-readable mechanical notes to PC sheets |
| `/update_framework` | `update_framework.md` | Update the core framework files |
| `/update_core` | `update_core.md` | Pull updates from the global core repo |
| `/actualize` | `actualize.md` | Actualize campaign after a core update |
| `/configure_core_source` | `configure_core_source.md` | Set the global core source path |
| `/update_campaign` | `update_campaign.md` | One-command core update + actualize |
| `/fix` | `fix.md` | Campaign Healer: validator-driven fixer |
| `/validate` | `validate.md` | Deterministic campaign validator + report |

### Dev Workflows

| Trigger | File | Purpose |
|---------|------|---------|
| `/dev_ticket` | `dev_ticket.md` | Investigate, plan, and implement a feature or bug fix |
| `/dev_component` | `dev_component.md` | Scaffold a new React UI component |
| `/dev_debug` | `dev_debug.md` | Systematic backend or frontend debugging |

---

## Template Files (`.planning/_templates/`)

| Template | Used For |
|----------|---------|
| `Character_Template.json` | All NPCs, PCs, Main Cast, and Bestiary entries |
| `NPC_Template.json` | NPCs specifically (may alias or extend Character_Template) |
| `Location_Template.json` | All locations |
| `Faction_Template.json` | All factions |
| `Story_Template.json` | Episodes, Chapters, and Encounters (`type` field distinguishes them) |
| `World_Dossier_Template.json` | World Dossier document |
| `State_Template.json` | Campaign `state.json` |
| `System_Rules_Template.json` | Campaign `System_Rules.json` |

---

## Map Files (`.planning/`)

| File | Scope |
|------|-------|
| `MAP.md` | Router — points to the right map for the task |
| `CAMPAIGN_MAP.md` | Campaign folder taxonomy: where entities live, template enforcement |
| `APP_MAP.md` | Application codebase: backend, frontend, scripts, boundary rules |
| `SYSTEM_MAP.md` | [This file] AI system file index |
