# GurpsAI — Core AI Instructions (Campaign GMing System)

> [!IMPORTANT]
> **PROJECT IDENTITY:** This is the AI instruction layer for **GurpsAI**, a local-first full-stack application (FastAPI backend + React frontend) that helps GMs run GURPS 4th Edition campaigns. The GMing system described in this file is **built into the app** — it is one of the products, not the tool of development. When helping with app development, switch to a dev persona (Shinku, Suigintou, or Hinaichigo). When helping with GMing, use the GMing personas (KingCrab, Marauder, Atlas, Archer).

## 1. Project Structure

```
GurpsAI/
├── src/gurpsai/        ← Python FastAPI backend (the app engine)
├── web/                ← React/Vite/TypeScript frontend (the GM workspace UI)
├── scripts/            ← CLI tools, rulesdb pipeline, migration utilities
├── rules_db/           ← Local GURPS Basic Set SQLite database
├── .agents/            ← AI personas and workflow definitions
├── .planning/          ← Maps, templates, and architectural truth
├── AnomalyHuntersCampaign/  ← Dev example: actual Anomaly Hunters campaign data
└── Campaign/           ← Legacy dev reference (not the primary example)
```

**Campaign data is external.** In production, a GM selects any folder on their machine as their campaign. `AnomalyHuntersCampaign/` and `Campaign/` exist in this repo only for development and testing purposes.

## 2. Mandatory Reading Before Complex GMing Tasks

When assisting with GMing (not app development), read:
- `AnomalyHuntersCampaign/state.json` — current campaign state
- `master_philosophy.md` — GMing principles and GURPS adherence
- `.planning/CAMPAIGN_MAP.md` — campaign folder taxonomy (where everything lives)
- `AnomalyHuntersCampaign/System_Rules.json` — campaign-specific rules

## 3. Ignored Directories

- The `Legacy/` subdirectory inside any campaign folder contains unformatted ongoing notes. **ALL agents and workflows MUST completely ignore `Legacy/`**, EXCEPT when explicitly executing the `catch_up` workflow.

## 4. State Management

Update `state.json` *only* when:
- **Campaign Init**: `new_campaign` completes.
- **Session Progress**: `prep_session`, `start_session`, or `conclude_session` explicitly advance the clock or scene.
- **Explicit Signal**: The GM provides information that clearly shifts the state (e.g., "This NPC died," "We are moving to the next chapter").
- **GM Confirmation**: A workflow asks "Make this the current active [X]?" and the GM agrees.

**CRITICAL:** Pure content creation (creating a new Chapter, Episode, Location, or NPC) does **NOT** automatically update `state.json`. Content can be prepped in advance without disrupting the active play state.

## 5. World Dossier Management (Setting Canon)

- When confirming world logic, lore, or cosmology, consult `01_World_Bible/World_Dossier.json` first.
- When the GM provides a setting-wide change (new travel rules, major retcon, recurring cosmic rule, major faction reframe), update `World_Dossier.json` and add an entry to its **Change Log**.
- Do **not** update `state.json` for purely setting-canon edits unless the change also alters the current situation/clock/objectives.

## 6. Workflows and Personas

- **Workflow invocation**: Load the matching file in `.agents/workflows/` and execute it step-by-step.
- **Persona invocation**: Dev personas are Antigravity skills in `.agents/skills/`. To activate one, the AI must **read the SKILL.md file** using `view_file` — skill descriptions in the system prompt are for discovery only; the persona only activates after reading the full file. Route by task:
  - Frontend → `frontend_dev/SKILL.md` (Shinku)
  - Backend → `backend_dev/SKILL.md` (Suigintou)
  - QA/Debug → `qa_engineer/SKILL.md` (Hinaichigo)
  - AI features → `ai_engineer/SKILL.md` (Kanaria)
- See `.planning/SYSTEM_MAP.md` for a full index of all personas and workflows.

## 7. Project Integrity & Post-Task Verification

After completing any task, workflow, or file creation, perform a self-audit:
1. **File Taxonomy**: Cross-reference `.planning/CAMPAIGN_MAP.md`. Verify new campaign files are in the correct directories.
2. **Template Adherence**: Ensure all new campaign files strictly follow their templates in `.planning/_templates/`.
3. **Link Integrity**: Verify all internal links are **relative** and point to files that actually exist.
4. **State Sync**: Confirm `state.json` has been updated only if the task involved actual narrative progress.
5. **Detail Preservation**: Verify no narrative or mechanical details from the GM's prompt were lost.
6. **Batch Processing Integrity**: If a workflow extracts multiple components at once, each MUST follow its full template. Speed never overrides structural fidelity.
