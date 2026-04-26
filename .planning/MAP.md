# GURPS AI Assistant - Campaign Directory Map

This document is the source of truth for the folder architecture. Always refer to this structure when instructed to create, place, or look for files. Any generated files MUST follow this taxonomy exactly.

## Directory Structure

```text
/Project_Root/              # This project root
├── .agents/                 # Core AI behaviors and automations
│   ├── agents/              # Persona files (e.g., SessionPlanner.md, WorldBuilder.md)
│   └── workflows/           # Slash commands & procedures (e.g., prep_session.md)
│
├── .planning/               # Architectural truth and standardized blueprints
│   ├── MAP.md               # [THIS FILE] The campaign folder map & taxonomy 
│   └── _templates/          # Blank GURPS JSON templates 
│       ├── System_Rules_Template.json
│       ├── Story_Template.json
│       ├── Location_Template.json
│       ├── Character_Template.json
│       ├── Faction_Template.json
│       ├── State_Template.json
│       └── World_Dossier_Template.json
│
├── Campaign/                # Your Active Campaign Folder
│   ├── 00_System_Rules.json # System rules, Tech Level, Mana Level
│   ├── 01_World_Bible/      # Lore, Factions, and Locations
│   │   ├── World_Dossier.json # Setting-wide lore, rules, and metadata
│   │   ├── Factions/
│   │   ├── Locations/
│   │   └── World_Maps_and_Art/
│   ├── 02_Characters/       # Mechanics and descriptions
│   │   ├── PCs/             # Player Characters
│   │   ├── Main_Cast/       # Story-crucial NPCs
│   │   └── Bestiary/        # Monsters, animals, generic mooks, guards
│   ├── 03_Story/            # Timeline, Sessions, and Encounters
│   │   ├── Campaign_Overview.json # Global timeline and arcs
│   │   └── Episode_01/      # A major narrative arc
│   │       ├── Episode_Overview.json
│   │       └── Chapter_01/  # A subdivision of an Episode
│   │           ├── Encounters/  # Specific scenes derived from Story_Template.json
│   │           └── Battle_Maps/
│   └── state.json           # Current game state and what's happening NOW
│
├── gemini.md                # System instructions for AI parsing
└── master_philosophy.md     # AI Core principles and GURPS rules adherence
```

## Repo-Scoped Skills (Portable)

This repo may include a `skills/` directory containing portable "repo-scoped skills" (each as `skills/<name>/SKILL.md`). These are designed to work even when a chat UI removes slash-command support by providing a plain-text entrypoint that routes to the authoritative workflows in `.agents/workflows/`.

## Template Enforcement

Whenever a workflow or user prompt instructs you to create a "Location", an "Encounter", an "Episode Overview", or an "NPC," you MUST use the corresponding `.json` template from `.planning/_templates/`. If multiple entries are requested, make separate files. Ensure formatting stays consistent with the pure JSON schema.

For specific entities:
- Use `Character_Template.json` for all NPCs, PCs, Main Cast, and Bestiary entries.
- Use `Location_Template.json` for Locations.
- Use `Faction_Template.json` for Factions.
- Use `Story_Template.json` for Episodes, Chapters, and Encounters.
