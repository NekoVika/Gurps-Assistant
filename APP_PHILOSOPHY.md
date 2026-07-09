# GurpsAI — Application Design Philosophy

This document describes **why** the app is built the way it is. Load this when making architecture decisions, designing new features, or reviewing whether a proposed change aligns with the project's values.

---

## Core Design Values

### 1. Local-First

The app runs entirely on the GM's machine. No cloud account, no subscription, no account creation. All campaign data lives in files the GM owns and controls. Network access is optional and only used for cloud AI providers — the app works fully offline with Ollama.

**In practice:**
- Campaign data stays in the GM's chosen folder, not in a database the app owns
- The rules DB is a local SQLite file — no API call needed for rules lookups
- Configuration is stored in `.env` — not synced to any cloud service

### 2. JSON-First Data Model

All canonical campaign entities (Characters, Locations, Factions, Episodes, Chapters, Encounters) are stored as structured `.json` files. No Markdown blobs for entity data.

**Why:**
- AI can read and modify structured JSON deterministically without guessing at parsing
- Pydantic schemas on the backend give us strict validation for free
- TypeScript interfaces on the frontend give us compile-time safety
- Diffs are human-readable and meaningful
- Templates define the exact shape of every entity type

**Rule:** When the AI generates or modifies a campaign entity, it outputs a pure JSON object. The app displays it through the appropriate Passport. The GM never has to look at raw JSON unless they want to.

### 3. Passport Pattern

Every campaign file type has a dedicated **Passport** component that renders it as a rich, styled, readable document — not a raw JSON editor.

**Why Passports:**
- A character sheet should look like a character sheet, not a JSON tree
- GMs are storytellers, not database administrators
- Each file type has unique fields that need purpose-built presentation

**What a Passport is:**
- A TypeScript React component that accepts a typed JSON object
- Renders a structured, premium visual layout with all fields displayed meaningfully
- Includes inline block editors for direct editing without leaving the view
- Registers in `MainWorkspace.tsx` via the file-type routing logic

**When to add a new Passport:**
When a new canonical entity type is added to the campaign schema, it gets its own Passport. Don't use a generic JSON viewer for canonical types.

### 4. Trust & Transparency

GMs must always know what the AI did and be able to undo it. No silent mutations.

**Principles:**
- AI-proposed file changes are shown in the Diff Editor **before** saving — the GM reviews and approves
- Every AI action is logged in the Activity Panel with timestamps and affected files
- Rules answers cite the exact page and block from the local DB — no hallucinated mechanics
- Workflow steps are explicit and visible — the GM can see what the system is doing

**Never:**
- Write to campaign files without showing a diff first
- Make irreversible changes without explicit confirmation
- Present rules claims without evidence from the local DB

### 5. Inspectable and Recoverable

The GM can always see, undo, or override what the app did.

- Soft-delete moves files to a trashbin, not permanent deletion
- The Diff Editor allows the GM to reject any AI-proposed change
- Campaign files are plain JSON — the GM can edit them in any text editor if needed
- The app never holds campaign state in a hidden database — the files are the truth

### 6. AI as a Co-Pilot, Not a Replacement

The app enhances the GM's capabilities; it doesn't replace GM judgment.

- AI handles cognitive load: rules lookup, point math, lore cross-referencing, template population
- GM makes all narrative and creative decisions
- Workflows are step-by-step processes with explicit GM confirmation gates, not fire-and-forget automation
- The AI should always surface options and ask for choices, not make them silently

---

## Architecture Decisions

### Why FastAPI + Python

Python owns the existing workflows, rules DB code, and validation pipeline. FastAPI gives us typed request/response models, easy streaming for chat, and a clean local HTTP API that the React frontend can consume. Keeping the backend in Python means no rewrites of existing logic.

### Why React + Vite + TypeScript

The GM workspace needs a rich, stateful UI with panels, file trees, diff views, streaming chat, and complex form editors. React is the natural fit. Vite gives fast iteration. TypeScript enforces the contract between frontend and backend schemas at compile time.

### Why Not a Desktop App (Yet)

Tauri (or Electron) adds packaging complexity before the local web app is solid. Running as a local web app gives us the same UX with simpler iteration. Desktop packaging is a future option once the app matures.

### Why SQLite for the Rules DB

The GURPS rules DB is read-heavy and single-user. SQLite is zero-config, portable, and fast for this use case. FTS (full-text search) and a Chroma vector store give us hybrid retrieval without a server.

### Why Not a Monorepo Build

The Python backend and the React frontend are developed and run independently. This keeps the Python dev loop (hot-reload with Uvicorn) separate from the frontend dev loop (Vite HMR). They communicate over HTTP, which is the real production contract anyway.

---

## Component Conventions

### Passport Components
- Named `<Type>Passport.tsx`
- Accept a single typed prop (the parsed JSON object from the campaign file)
- Registered in `MainWorkspace.tsx` in the file-type routing block
- Render a full-width, premium visual layout — not a card, not a modal
- Include inline editors where the GM would naturally want to edit

### Editor Components
- Named `<Feature>Editor.tsx` or as a section inside a Passport
- Handle one domain of editing (character stats, location zones, etc.)
- Use `StructuredArrayEditors.tsx` for any list field (tags, relations, hooks, etc.)
- Auto-save or provide explicit save buttons — never lose data silently

### API Client (`web/src/lib/api.ts`)
- Typed wrappers around `fetch`
- All backend calls go through this file — no direct `fetch()` calls in components
- Returns typed results matching backend Pydantic schemas (via TypeScript interfaces in `lib/types.ts`)

### Python Services
- Services in `src/gurpsai/app/services/` contain business logic
- Routers in `src/gurpsai/api/routers/` contain only HTTP handling and validation
- Services never import from routers — dependencies flow one way
