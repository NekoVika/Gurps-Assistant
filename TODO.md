# TODO

## Current direction

Primary product direction for the next phase:
- build a local-first standalone GM app
- use a local web UI instead of relying only on Antigravity
- keep a Python backend as the system brain
- support both cloud and local LLM providers
- make local LLMs first-class through Ollama
- preserve the current campaign/workflow/rules-db architecture instead of replacing it

Working product idea:
- a local GM cockpit with:
  - chat
  - workflow launching
  - campaign file browsing
  - rules DB lookup
  - model/provider switching
  - reviewable file writes

## Ticket 1 decision

Concrete stack choice:
- backend: `FastAPI` + `Uvicorn` + `Pydantic`
- frontend: `React` + `Vite` + `TypeScript`
- local LLM adapter target: `Ollama`
- packaging later if needed: `Tauri`

Why this stack:
- Python stays the backend language, which fits the existing workflows and rules DB code
- FastAPI is a strong fit for local HTTP APIs, typed request/response models, and iterative development
- React + Vite gives us the smoothest path for a local browser UI with chat, panels, file browsing, and settings
- TypeScript will help keep frontend/backend contracts sane once the UI grows
- Tauri stays a later option, so we do not need to solve desktop packaging before the local web app works

Chosen repo layout:
- `src/gurpsai/`
  - shared Python package root
- `src/gurpsai/api/`
  - FastAPI app, routers, request/response schemas
- `src/gurpsai/app/`
  - application services for chat, workflows, campaign files, validation, and rules DB orchestration
- `src/gurpsai/providers/`
  - provider abstraction and adapters such as Ollama
- `src/gurpsai/domain/`
  - core app/domain models that should not depend on HTTP or provider implementations
- `src/gurpsai/integrations/`
  - wrappers around existing repo systems such as `rulesdb`, workflow execution, validation, and campaign IO
- `web/`
  - Vite/React frontend app
- `web/src/`
  - UI screens, components, API client, state
- `web/public/`
  - static assets
- `tests/`
  - Python tests
- `web/` tests later
  - frontend tests once the UI starts to stabilize

Boundary rules:
- keep campaign markdown files and `.agents/` workflows as the source of truth
- keep rules DB implementation callable from Python services instead of shelling out where possible
- do not put frontend code inside the Python package
- do not create a second hidden campaign-state store for canonical data

## Product goals

### Main goals
- [x] Create a usable standalone UI for GMs
- [x] Allow local LLM usage without depending on external chat clients
- [x] Keep the app usable even when cloud services are unavailable
- [x] Preserve current workflow compatibility with existing campaign repos
- [x] Make assistant actions more inspectable and trustworthy

### Non-goals for the first version
- [ ] Do not require a packaged desktop app immediately
- [ ] Do not rebuild all campaign/workflow logic from scratch
- [ ] Do not block progress on perfect offline parity with frontier cloud models
- [ ] Do not over-design multi-user/server deployment before the local single-user flow works

## Architecture plan

### Core architecture
- [x] Build a Python backend that owns:
  - workflows
  - campaign file operations
  - rules DB access
  - validation
  - provider/model orchestration
- [x] Build a local web frontend that talks to the backend over HTTP
- [x] Add a provider abstraction layer so the app is not coupled to one model vendor
- [x] Keep repo/campaign files as the source of truth rather than moving campaign state into a hidden app database

### Backend responsibilities
- [x] Expose chat/session endpoints
- [x] Expose workflow execution endpoints
- [x] Expose campaign file read/write endpoints
- [x] Expose rules DB search and QA endpoints
- [x] Expose model/provider configuration endpoints
- [x] Expose validation/report endpoints

### Frontend responsibilities
- [x] Provide a main chat workspace
- [x] Provide campaign navigation and preview
- [x] Provide workflow launch UI
- [x] Provide a dedicated rules/retrieval panel
- [x] Provide action history and changed-file review
- [x] Provide settings for models/providers/runtime behavior

## MVP scope

### MVP outcome
- [x] Launch a local web app from the repo
- [x] Open it in the browser and use it as the main GM interface
- [x] Chat with the assistant against the active campaign
- [x] Run key workflows from UI
- [x] Query the local rules DB from UI
- [x] Select either a cloud provider or a local Ollama model

### MVP features
- [x] Single-campaign local app mode
- [x] Chat with streaming responses
- [x] Workflow runner for common workflows
- [x] Read-only campaign file browser at first
- [x] Explicit review before file writes
- [x] Rules DB query panel with citations
- [x] Provider/model selector in the UI
- [x] Session log / activity history

### MVP workflows to support first
- [ ] `prep_session`
- [ ] `create_npc`
- [ ] `brainstorm`
- [ ] `catch_up`
- [ ] rules lookup via `RulesLawyer` + `rulesdb`

## UI roadmap

### UI principles
- [ ] Local-first UX
- [ ] Fast iteration over visual polish
- [ ] Strong inspectability of assistant actions
- [ ] Easy file/context awareness
- [ ] Low-friction switching between creative work and rules lookup

### Primary screens
- [x] Main workspace
  - chat panel
  - context/status sidebar
  - preview/inspector panel
- [x] Campaign browser
  - folder tree
  - markdown preview
  - quick-open for key files
- [x] Workflow launcher
  - list available workflows
  - parameter inputs where needed
  - run log / output summary
- [x] Rules panel
  - QA box
  - evidence bundle display
  - citations / supporting entities / chunk previews
- [x] Settings panel
  - provider selection
  - model selection
  - runtime settings
  - local paths / app behavior

### Key UI features
- [x] Streaming assistant output
- [x] Render markdown cleanly
- [x] Show citations distinctly from narrative output
- [x] Show files touched by the assistant
- [x] Show diffs before save/apply
- [ ] Allow copying prompts / outputs / citations easily
- [ ] Show current campaign, episode, chapter, and state context
- [ ] Show which model/provider handled the request

### UI nice-to-have later
- [ ] Multi-tab workspaces
- [ ] Session timeline
- [ ] Pinned campaign references
- [ ] Search across campaign files
- [ ] Voice / narration helpers
- [ ] Desktop packaging with Tauri or similar

## Local LLM roadmap

### Provider strategy
- [ ] Create a provider abstraction used by the backend
- [ ] Make Ollama the first local-provider target
- [ ] Keep cloud providers possible as optional adapters
- [ ] Avoid UI/backend logic depending on one provider's API shape

### Provider interface
- [ ] Define common operations:
  - chat
  - text generation
  - streaming
  - model listing
  - health check
  - capability metadata
- [ ] Track provider capabilities:
  - streaming support
  - JSON mode
  - tool support
  - context limits

### Ollama support
- [ ] Detect local Ollama availability
- [ ] List installed models
- [ ] Select model per session/request
- [ ] Send chat requests through the provider abstraction
- [ ] Handle unavailable models gracefully
- [ ] Expose clear errors when Ollama is missing or stopped

### Model strategy
- [ ] Add model presets such as:
  - `Fast Local`
  - `Balanced Local`
  - `Best Available`
  - `Offline Only`
- [ ] Route smaller/local models toward retrieval-grounded tasks
- [ ] Avoid assuming small local models can replace larger cloud models in every workflow
- [ ] Keep prompts adaptable by provider/model capability

## Backend roadmap

### API foundation
- [x] Pick backend framework
  - likely `FastAPI`
- [x] Define API schemas for:
  - chat requests
  - workflow runs
  - file reads
  - file diffs
  - rules lookups
  - provider settings
- [x] Add health endpoints
- [x] Add structured error responses

### Application services
- [x] Chat/session service
- [x] Workflow service
- [x] Campaign file service
- [x] Rules DB service
- [x] Validation service
- [x] Provider registry/service

### Session and state handling
- [ ] Keep the campaign files as canonical state
- [ ] Track app session state separately from campaign canon
- [ ] Persist UI-side chat/session history locally
- [ ] Keep request logs for debugging

## Workflow integration roadmap

### Compatibility goals
- [ ] Keep `.agents/`, `.planning/`, and campaign files usable as they are now
- [ ] Make workflow invocation available from both UI and repo instructions
- [ ] Preserve persona-based routing where useful
- [ ] Avoid creating a separate hidden workflow definition system if the markdown workflows remain sufficient

### Integration tasks
- [ ] Wrap existing workflow execution in backend services
- [ ] Return structured workflow results to the UI
- [ ] Show file outputs and changed paths after workflow completion
- [ ] Add confirmation steps for write-heavy workflows
- [ ] Surface validation issues before/after workflow runs when useful

## Rules DB roadmap

### Immediate stance
- [ ] Pause deep DB expansion while standalone app foundations are built
- [ ] Preserve the current DB work and keep it usable during app development
- [ ] Integrate the current DB into the standalone app early

### Integration tasks
- [x] Add backend endpoint for `qa`
- [ ] Add backend endpoint for entity search/show
- [ ] Add backend endpoint for chunk show/search
- [x] Render evidence bundles cleanly in UI
- [ ] Preserve citations and refs in a readable format

### Return-to-DB later
- [ ] Resume equipment/table cleanup
- [ ] Add DB-backed integration tests
- [ ] Add item-level equipment extraction

## Trust and safety UX

### User trust goals
- [ ] Show what the assistant changed
- [ ] Show why it changed it
- [ ] Show what source/context it used when relevant
- [ ] Avoid silent file mutations

### Review and audit features
- [x] Preview file diffs before apply
- [x] Record changed files in activity log
- [x] Show workflow execution summaries
- [ ] Show rules evidence when a mechanical answer is generated
- [ ] Preserve rollback/review paths for user-authored content

## Packaging and runtime

### Early runtime target
- [ ] Run backend locally
- [ ] Run frontend locally
- [ ] Start app with a simple local dev command

### Later runtime target
- [ ] Add one-command local startup
- [ ] Add optional desktop wrapper
- [ ] Add release/build story only after local dev flow is solid

## Suggested implementation order

### Phase 1: foundation
- [x] Choose stack and repo layout for backend + frontend
- [x] Add backend skeleton
- [x] Add frontend skeleton
- [x] Add provider abstraction
- [x] Add Ollama provider prototype

### Phase 2: first usable app
- [x] Add chat UI with streaming
- [x] Add campaign browser
- [x] Add rules DB panel
- [x] Add workflow runner
- [x] Add provider/model selector

### Phase 3: trust and polish
- [x] Add changed-file review and diffs
- [x] Add activity/session logs
- [ ] Improve prompt/provider routing
- [ ] Improve error handling and recoverability

### Phase 4: deeper standalone behavior
- [ ] Add richer local model support
- [ ] Add better search/navigation
- [ ] Consider desktop packaging
- [ ] Resume broader DB improvements

## Open decisions

- [x] Confirm frontend stack
  - React + Vite + TypeScript
- [x] Confirm backend stack
  - FastAPI + Uvicorn + Pydantic
- [ ] Confirm whether first write flow is:
  - direct apply after review
  - draft output only
- [ ] Confirm whether chat history should live in repo or app-local storage
- [ ] Confirm how much workflow parameterization the first UI should expose

## Immediate next tickets

- [x] Ticket 1: pick concrete stack and repo layout for backend + frontend
- [x] Ticket 2: create backend skeleton with health endpoint and provider interface
- [x] Ticket 3: create frontend skeleton with main workspace shell
- [x] Ticket 4: add Ollama provider adapter and model listing
- [x] Ticket 5: expose rules DB `qa` endpoint and render it in the UI

## Existing work that should stay visible

### GM Assistant improvements
- [ ] Add campaign creation roadmap to help AI and GM understand end-to-end campaign setup order

### Mechanics improvements
- [ ] Add scripts for validating already created files within the campaign structure
- [ ] Store validation results in a form the assistant can use to quickly fix found issues

## MD2JSON Migration Pipeline

### Phase 1: Data Blueprints
- [x] Define backend JSON Pydantic Schemas for `Character`, `Location`, `Episode`, `Encounter`.
- [x] Define identical TypeScript JSON Interfaces in the React frontend.
- [x] Generate blank JSON Templates for the GM to use manually if creating without AI.
- [x] Update `master_philosophy.md` instructing AI to return pure JSON objects instead of Markdown blobs when creating entities.

### Phase 2: The Migration Script (Safe Export)
- [x] Build a robust TypeScript script (e.g. `scripts/migrate_to_json.ts`) that reads the current `Campaign` markdown files via legacy regex parsers.
- [x] Safely export the parsed data as strict structured JSON strings into an entirely separate export directory (e.g. `AnomalyHunter_v2_JSON_Campaign/`) to guarantee zero data loss.
- [x] Run the migration on all existing Bestiary, Main Cast, Locations, and Passports.

### Phase 3: The React Smart Block Editors
- [x] Deprecate the legacy `ReactMarkdown` renderer explicitly for entities in `MainWorkspace.tsx`.
- [x] Build specific React Block-Editor views (`CharacterEditor`, `LocationEditor`, `StoryEditor`) mapping JSON keys to discreet edit fields that auto-save cleanly.
- [x] Support complex sub-structures (Lists, Zones) natively using structured arrays.

### Phase 4: Workflow Rework
- [x] Update AI workflows (`create_npc.md`, `prep_session.md`, `new_episode.md`, `new_chapter.md`) templates to output strict JSON `<draft>` overrides.
- [x] Ensure AI payloads are seamlessly ingested into the new `Context` JSON schemas.

### Phase 5: Fast Deterministic Healer
- [x] Delete or archive legacy regex-based markdown `validate.py`.
- [x] Create a fast Pydantic Validator API endpoint.
- [x] Wire the UI to instantly display missing/broken JSON keys and allow one-click Healer injection or deep scanning via Config panel.

## AI Assistant Upgrades (Phase 6)

### Tool Calling & Reliability
- [x] Implement Native Tool Calling: Switch from custom XML tags (`<read>`, `<query_rules>`) to provider-native function calling via API schemas.
- [x] Migrate `read_file` to a native tool.
- [x] Migrate `query_rules` to a native tool.
- [x] Migrate `draft_file` to a native tool.

### Structured Outputs
- [x] Implement JSON Mode / Structured Outputs for workflows and entity generation.
- [x] Ensure AI payloads match Pydantic schemas via provider-level schema enforcement.

### Context Management
- [x] Implement Token Budget Guard to prevent context overflow on large campaigns (file tree truncation with configurable char limit).

## Wizard Perfection (Phase 7)

### Prompt Hardening
- [x] Story Wizard: split generic prompt into type-specific (Episode/Chapter/Encounter) prompts with detailed field-format instructions.
- [x] Story Wizard: add new contextual fields (Theme/Tone, Duration Estimate, Encounter Type, GM Notes).
- [x] Faction Wizard: rewrite prompt with exhaustive field-format instructions matching create_npc quality.
- [x] Faction Wizard: add Notable Members and Reputation fields to wizard steps.
- [x] Location Wizard: rewrite prompt with exhaustive field-format instructions for internalStructure, landmarks, relations.

### Legacy Cleanup
- [x] Remove legacy streaming XML `<draft>` fallback from WizardModal — all wizards now use structured output path exclusively.
- [x] Remove `onSubmitPrompt` handler and associated imports from MainWorkspace.
- [x] Remove unused `createSession`, `updateSession`, `ChatMessage` imports from MainWorkspace.

### UX Improvements
- [x] Add retry button on generation error banner in WizardModal.
- [x] Add keyboard shortcuts: Escape to close modal, Enter to advance wizard steps.

### Deferred
- [ ] Prep Session wizard: needs full rethink (separate effort — logic must be redesigned from scratch).

## AI Campaign Consistency & Scope Awareness (Phase 8)

### Contextual Relevance (Scope Management)
- [x] Prevent plot cross-contamination: The AI currently sees global `state.json` lore (like "Rot" or "The Watcher") and weaves it into isolated chapters/encounters where it might not belong. *(ScopeService now emits explicit "self-contained — do NOT weave global arcs" guidance for standalone nodes, layered on the existing SCOPE GUARDRAIL.)*
- [x] Implement scope awareness: Give the AI context on *how* episodes are linked (or not linked) so it knows when to introduce global arcs vs when to stick to local standalone themes. *(New `ScopeService` computes a semantic scope descriptor — entity type, parent/children hierarchy, resolved vs unresolved child links, and keyword-overlap ties to `state.json` arcs — passed via `scope_path` from the focused file. See `src/gurpsai/app/services/scope.py` + `tests/test_scope_service.py`.)*

### Dangling References & Hallucinated Relations
- [ ] Differentiate existing vs new entities: The model currently invents new relations, child encounters (e.g., "Drone Defense"), and factions perfectly, but this confuses the GM because no such files exist yet.
- [ ] UI visual cues for "Draft/Unlinked" entities: If the AI generates an array of `childLinks` or `characters` that do not map to existing files, the UI should clearly highlight them as "Proposed/Missing" so the GM knows they need to be created.
- [ ] Batch creation workflows: Provide the GM with a 1-click way to generate stubs for any new entities the AI just hallucinated into the campaign.
