# GurpsAI — Application Codebase Map

This document maps the **GurpsAI application's** internal structure. Use this when working on app development — adding features, fixing bugs, writing components, or improving services.

> [!NOTE]
> For campaign folder structure, see `CAMPAIGN_MAP.md`. For AI system files, see `SYSTEM_MAP.md`.

---

## Full Application Structure

```text
GurpsAI/
│
├── src/gurpsai/             # Python backend package (the application engine)
│   ├── __init__.py
│   ├── __version__.py
│   ├── cli.py               # CLI entrypoint: `gurpsai serve`, `gurpsai validate`
│   ├── launcher.py          # Dev server launcher
│   │
│   ├── api/                 # HTTP layer: FastAPI routers and request/response schemas
│   │   ├── routers/         # One router module per feature domain
│   │   │   ├── campaign.py  # Campaign file CRUD, registry, rename, validate
│   │   │   ├── chat.py      # AI chat and streaming
│   │   │   ├── rules.py     # Rules DB QA and search
│   │   │   ├── settings.py  # Provider/model configuration
│   │   │   └── ...
│   │   └── schemas/         # Pydantic request/response models for the API
│   │
│   ├── app/                 # Application services (business logic layer)
│   │   └── services/
│   │       ├── files.py     # Campaign file reading, writing, listing, diff
│   │       ├── chat.py      # AI session/context management
│   │       ├── validation.py # JSON schema validation against templates
│   │       └── ...
│   │
│   ├── domain/              # Core domain models (no HTTP or provider dependencies)
│   │   └── models/          # Pydantic domain models (Character, Location, Episode, etc.)
│   │
│   ├── integrations/        # Wrappers around repo sub-systems
│   │   ├── rulesdb.py       # Wraps scripts/rulesdb.py CLI for in-process use
│   │   ├── campaign_io.py   # Campaign folder discovery and path resolution
│   │   └── ...
│   │
│   └── providers/           # AI provider abstraction layer
│       ├── base.py          # Provider interface (chat, stream, list_models, health)
│       ├── gemini.py        # Google Gemini adapter
│       ├── claude.py        # Anthropic Claude adapter
│       ├── openai.py        # OpenAI adapter
│       └── ollama.py        # Local Ollama adapter
│
├── web/                     # React/Vite/TypeScript frontend (the GM workspace)
│   ├── index.html
│   ├── vite.config.ts
│   ├── package.json
│   └── src/
│       ├── main.tsx         # App entry point
│       ├── App.tsx          # Root component
│       ├── styles.css       # Global design system: CSS variables, tokens, utilities
│       │
│       ├── components/      # All UI components
│       │   ├── MainWorkspace.tsx        # Root GM workspace: routing, panels, state
│       │   ├── CampaignRegistry.tsx     # Campaign file browser (tree + quick-open)
│       │   ├── ActivityPanel.tsx        # Session log and changed-file history
│       │   ├── DiffEditorPanel.tsx      # File diff review before apply
│       │   ├── RulesPanel.tsx           # Rules DB QA panel with citations
│       │   ├── WizardModal.tsx          # Entity creation wizard modal
│       │   ├── TrashbinPanel.tsx        # Soft-deleted files recovery
│       │   ├── ConfirmModal.tsx         # Generic confirmation dialog
│       │   ├── CorePassport.tsx         # Base passport wrapper
│       │   ├── StatePassport.tsx        # Campaign state.json viewer
│       │   ├── SystemRulesPassport.tsx  # System_Rules.json viewer
│       │   ├── CampaignOverviewPassport.tsx
│       │   ├── WorldDossierPassport.tsx
│       │   ├── CharacterPassport.tsx    # Full character sheet viewer
│       │   ├── LocationPassport.tsx
│       │   ├── FactionPassport.tsx
│       │   ├── EpisodePassport.tsx
│       │   ├── ChapterPassport.tsx
│       │   ├── EncounterPassport.tsx
│       │   ├── StoryPassport.tsx
│       │   ├── InternalLink.tsx         # Campaign file cross-link component
│       │   └── editors/                 # Block-editor components for JSON fields
│       │       ├── CharacterEditor.tsx
│       │       ├── LocationEditor.tsx
│       │       ├── StoryEditor.tsx
│       │       ├── StructuredArrayEditors.tsx  # Chip editors for list fields
│       │       └── ...
│       │
│       └── lib/             # Shared utilities, types, and API client
│           ├── api.ts        # Typed fetch wrapper for the backend API
│           └── types.ts      # TypeScript interfaces mirroring Pydantic schemas
│
├── scripts/                 # CLI tools and pipeline utilities
│   ├── python/              # Python CLI entrypoints
│   ├── rulesdb.py           # GURPS rules DB extraction, search, and QA CLI
│   ├── rulesdb_lib/         # Modular rulesdb logic (commands, extractors)
│   ├── md_to_json.py        # Legacy Markdown → JSON migration
│   ├── migrate_to_json.ts   # TypeScript migration runner
│   └── archive/             # One-off scripts that have been retired
│
├── rules_db/                # GURPS Basic Set rules database
│   └── basic_set.sqlite     # SQLite DB: books, pages, blocks, chunks, entities
│
├── tests/                   # Python test suite
│   └── (test_*.py files)
│
└── .test/                   # Frontend test assets and fixtures
```

---

## Architecture Boundary Rules

These rules enforce clean separation between layers:

| Rule | Detail |
|------|--------|
| **Frontend never reads campaign files directly** | All campaign IO goes through the backend API (`web/src/lib/api.ts` → `src/gurpsai/api/`) |
| **Backend never imports frontend code** | The Python package knows nothing about TSX/CSS |
| **Domain models have no HTTP or provider dependencies** | `src/gurpsai/domain/` is pure data modeling |
| **Providers are hot-swappable** | All AI calls go through `providers/base.py` interface — never call a provider SDK directly from services |
| **Campaign path is configurable** | No hard-coded `/Campaign/` path in app code. Path resolution lives in `integrations/campaign_io.py` |
| **Workflow logic lives in `.agents/workflows/`** | App code invokes workflows; it doesn't re-implement them |

---

## Where to Add New Things

| Adding... | Location |
|-----------|----------|
| New API endpoint | `src/gurpsai/api/routers/<domain>.py` + schema in `api/schemas/` |
| New business logic / service | `src/gurpsai/app/services/<feature>.py` |
| New domain model | `src/gurpsai/domain/models/` |
| New provider adapter | `src/gurpsai/providers/<name>.py` (implement `base.py` interface) |
| New React component | `web/src/components/<ComponentName>.tsx` |
| New TypeScript types | `web/src/lib/types.ts` |
| New Passport for a file type | `web/src/components/<Type>Passport.tsx` + register in `MainWorkspace.tsx` |
| New editor for a JSON field | `web/src/components/editors/<field>Editor.tsx` |
| New campaign entity template | `.planning/_templates/<Type>_Template.json` |

---

## Running the Application

```bash
# Backend (from repo root)
gurpsai serve --reload

# Frontend (from web/)
npm run dev

# Run Python tests
python -m unittest discover -s tests -v

# Validate campaign files
gurpsai validate
```
