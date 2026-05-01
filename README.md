# GURPS GM Assistant System

This is a local-first, AI-assisted standalone application for running GURPS 4th Edition campaigns. It provides a cohesive environment with reusable personas, workflows, offline rules retrieval, and a standardized campaign architecture.

**Status:** The application is fully functional as a local web UI. It operates using a Python FastAPI backend and a React/Vite frontend, allowing GMs to interface with their campaign files directly through rich "Passport" components, built-in chat, and AI-driven generation wizards.

## Project Purpose
The system acts as a co-pilot for Game Masters. It offloads rules crunching, entity tracking, and campaign organization, enabling the GM to focus on pacing, improvisation, and narrative delivery. The campaign structure is JSON-first, making it perfectly suited for AI reading, deterministic manipulation, and validation.

## Core Architecture

- **Backend**: `FastAPI` + `Uvicorn` + `Pydantic`
  - Handles campaign IO, rules DB querying, structural validation, and AI provider orchestration.
- **Frontend**: `React` + `Vite` + `TypeScript`
  - Provides a rich GM Workspace with a file browser, Markdown/JSON block editors, and bespoke "Passport" components for viewing Characters, Locations, Factions, and Story elements (Episodes, Chapters, Encounters).
- **AI Integration**: Pluggable provider abstraction with first-class support for both cloud (Gemini, Claude, OpenAI) and local (Ollama) models.

## Local App Configuration & Setup

1. Copy `.env.example` to `.env` in the repository root.
2. Add your provider API keys (e.g., `GEMINI_API_KEY`). This keeps your credentials secure and Git-ignored.
3. Start the backend server: `gurpsai serve --reload` (or `python scripts/python/gurpsai.py serve`)
4. Start the frontend server (in `web/`): `npm run dev`
5. Open the app in your browser (usually `http://localhost:5173`).

The frontend **Config** tab allows configuring default providers, models, timeouts, and generation endpoints directly from the UI.

## Core Philosophy
- **System Supremacy (GURPS 4e)**: Use official 4e rules and avoid fabricated mechanics.
- **Mechanical Transparency**: Explain how advantages/traits work at the table.
- **Character-Centric Design**: Pull hooks from PC sheets into scenes and encounters.
- **JSON-First Data**: All campaign data lives in structured JSON files backed by strict Pydantic/TypeScript schemas, allowing safe and deterministic AI edits.

*(For full design principles, see `master_philosophy.md`.)*

## Directory Structure

```text
/GurpsAI/
|-- .agents/                # Personas and workflow definitions (authoritative)
|-- .planning/              # Folder map and JSON templates (authoritative)
|-- rules_db/               # Local rules SQLite DB, schemas, and extraction tools
|-- src/                    # Python Backend (FastAPI routes, schemas, services)
|-- web/                    # React Frontend (Vite, TSX components, UI)
|-- tests/                  # Automated tests (Backend & Frontend)
|-- SYSTEM.md               # Assistant-neutral canonical instructions
|-- master_philosophy.md    # Core principles
|-- README.md               # This file
|-- TODO.md                 # Roadmap and active tickets
`-- Campaign/               # Active campaign workspace (User Data)
```

**Campaign Taxonomy:**
- `00_System_Rules.json`: Tech Level, Mana, house rules
- `01_World_Bible/`: Lore, factions, locations
- `02_Characters/`: PCs, NPCs, bestiary
- `03_Story/`: Episodes, chapters, encounters
- `state.json`: Current campaign state clock and active plotlines

*(For detailed taxonomy see `.planning/MAP.md`)*

## Key Features

### 1. Smart UI Passports
Entities in the campaign are viewed through rich Passport components that parse the underlying JSON into readable, aesthetically pleasing summaries. Different passports exist for Characters, Factions, Locations, Encounters, Chapters, and Episodes.

### 2. Creation Wizards
The UI features generation wizards that allow the GM to quickly mock up a new entity (like an Encounter or NPC), pass parameters to the AI, and have a fully populated Draft created within the correct campaign folder.

### 3. Deep Campaign Validation
The backend exposes a Mender/Validator API that scans all campaign JSON files against their strict Pydantic schemas, surfacing broken relations, missing keys, or structural fractures for immediate fixing.

### 4. Local Rules Retrieval
The repository includes a local, offline rules database pipeline for the GURPS Basic Set. The AI Assistant automatically queries this DB for rules questions (e.g., "How does a Deceptive Attack work?") to ensure deterministic accuracy instead of hallucinating mechanics. Evidence bundles and citations are rendered directly in the chat UI.

## Workflows & Personas

**Workflows:** You can invoke workflows naturally in the chat window (e.g., `run prep_session workflow`). Popular workflows include:
- `new_campaign`
- `prep_session`
- `start_session`
- `conclude_session`
- `create_npc`
- `brainstorm`

**Personas:** You can invoke personas directly to get tailored advice:
- **Narrator**: Scene text, dialogue, atmosphere.
- **RulesLawyer**: Mechanical rulings, point math, adjudication.
- **WorldBuilder**: Locations, factions, lore depth.
- **SessionPlanner**: Session/chapter structure and encounter flow.
