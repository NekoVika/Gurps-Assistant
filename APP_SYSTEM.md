# GurpsAI — App System Instructions

This document describes the **GurpsAI application's features, UI structure, and API** for AI assistants. Load this when helping users *use* the app for GMing, or when developing new app features.

> [!NOTE]
> For GMing instructions (how to run campaigns), see `SYSTEM.md`. For app architecture decisions, see `APP_PHILOSOPHY.md`.

---

## Application Overview

GurpsAI is a **local-first GM workspace** running as a web app in the browser:
- Backend at `http://localhost:8000` (FastAPI, `gurpsai serve --reload`)
- Frontend at `http://localhost:5173` (Vite dev server, `npm run dev`)

The app loads a **campaign folder** (configurable path) and provides a rich interface for browsing, editing, generating, and validating campaign data.

---

## The GM Workspace (Frontend)

### Main Panels

| Panel | Component | Purpose |
|-------|-----------|---------|
| **Campaign Registry** | `CampaignRegistry.tsx` | File browser tree. Shows all campaign folders and files. Click to open. Supports search, quick-open for key files, soft-delete (trashbin). |
| **Main Workspace** | `MainWorkspace.tsx` | Central content area. Displays the selected file as the appropriate Passport or editor. Routes file types to the correct view. |
| **Activity Panel** | `ActivityPanel.tsx` | Session log showing all AI actions, files changed, workflow events. Clickable history. |
| **Rules Panel** | `RulesPanel.tsx` | GURPS rules QA. GM types a question; the backend queries the local SQLite rules DB and returns cited evidence. |
| **Diff Editor** | `DiffEditorPanel.tsx` | Shows proposed file changes before they are saved. GM reviews and approves or rejects. |
| **Trashbin** | `TrashbinPanel.tsx` | Soft-deleted files. GM can restore or permanently delete. |

### Passport Components

Every campaign file type has a dedicated **Passport** component — a rich, structured viewer that parses the JSON into a readable, aesthetically styled layout:

| File Type | Passport Component |
|-----------|--------------------|
| `state.json` | `StatePassport.tsx` |
| `System_Rules.json` | `SystemRulesPassport.tsx` |
| `Campaign_Overview.json` | `CampaignOverviewPassport.tsx` |
| `World_Dossier.json` | `WorldDossierPassport.tsx` |
| Character (PC, NPC, Bestiary) | `CharacterPassport.tsx` |
| Location | `LocationPassport.tsx` |
| Faction | `FactionPassport.tsx` |
| Episode Overview | `EpisodePassport.tsx` |
| Chapter Overview | `ChapterPassport.tsx` |
| Encounter | `EncounterPassport.tsx` |

Passports are **read+edit** views — they display structured data and allow inline editing via block editors.

### Block Editors

Passport components embed **block editors** for structured JSON fields:

| Editor | Purpose |
|--------|---------|
| `CharacterEditor.tsx` | Edits character stats, traits, skills, equipment |
| `LocationEditor.tsx` | Edits location zones, notable NPCs, connections |
| `StoryEditor.tsx` | Edits encounter/chapter/episode fields |
| `StructuredArrayEditors.tsx` | Chip-based editors for list fields (relations, tags, hooks) |

### Wizard Modal

`WizardModal.tsx` — a step-by-step creation wizard for new campaign entities. The GM provides parameters; the backend calls the AI and returns a populated draft JSON that can be reviewed in the Diff Editor before saving.

---

## Backend API (Key Endpoints)

The frontend communicates with the backend via `web/src/lib/api.ts`.

### Campaign API (`/api/campaign/`)
| Endpoint | Purpose |
|----------|---------|
| `GET /api/campaign/files` | List all campaign files (tree) |
| `GET /api/campaign/file?path=...` | Read a specific file's content |
| `PUT /api/campaign/file` | Save/update a file (with optional diff preview) |
| `DELETE /api/campaign/file` | Soft-delete a file (moves to trashbin) |
| `POST /api/campaign/rename` | Rename a file and update all references |
| `GET /api/campaign/validate` | Run the Pydantic validator on all campaign JSON files |
| `GET /api/campaign/mend` | Auto-fix known structural issues in campaign files |

### Chat API (`/api/chat/`)
| Endpoint | Purpose |
|----------|---------|
| `POST /api/chat/message` | Send a message; returns a streaming AI response |
| `GET /api/chat/history` | Get conversation history for the current session |
| `DELETE /api/chat/history` | Clear the current session history |

### Rules API (`/api/rules/`)
| Endpoint | Purpose |
|----------|---------|
| `POST /api/rules/qa` | Ask a GURPS rules question; returns cited evidence bundle |
| `GET /api/rules/search?q=...` | Search the rules DB for entities or chunks |

### Settings API (`/api/settings/`)
| Endpoint | Purpose |
|----------|---------|
| `GET /api/settings` | Get current provider/model/path configuration |
| `PUT /api/settings` | Update configuration |
| `GET /api/settings/providers` | List available providers and their status |
| `GET /api/settings/models` | List available models for the current provider |

---

## Campaign Path Configuration

The app reads from a campaign folder whose path is configured in the settings. The backend never assumes a fixed path. When a GM changes the campaign path, the frontend reloads the registry.

**Default dev paths** (for development in this repo):
- Primary dev example: `AnomalyHuntersCampaign/`
- Legacy reference: `Campaign/`

---

## AI Provider Support

The app supports multiple AI providers via a pluggable abstraction:
- **Gemini** (Google) — cloud
- **Claude** (Anthropic) — cloud
- **OpenAI** — cloud
- **Ollama** — local (no internet required)

The provider and model are switchable per-session from the Settings panel.

---

## Trust & Transparency Features

The app is designed so GMs always know what the AI is doing:
- **Diff review** — all AI-proposed file changes go through the Diff Editor before saving
- **Activity log** — every AI action is recorded in the Activity Panel
- **No silent mutations** — the AI cannot write files without GM review and approval
- **Citation display** — rules answers show page/block citations from the local DB
