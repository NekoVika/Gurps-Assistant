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
│   └── _templates/          # Blank GURPS Markdown templates 
│       ├── 00_System_Rules_Template.md
│       ├── Campaign_Overview_Template.md
│       ├── Encounter_Template.md
│       ├── Episode_Overview_Template.md
│       ├── Chapter_Template.md
│       ├── Location_Template.md
│       ├── NPC_Template.md
│       ├── State_Template.md
│       └── World_Dossier_Template.md
│
├── Campaign/                # Your Active Campaign Folder
│   ├── 00_System_Rules.md   # System rules, Tech Level, Mana Level
│   ├── 01_World_Bible/      # Lore, Factions, and Locations
│   │   ├── World_Dossier.md # Setting-wide lore, rules, and metadata
│   │   ├── Factions/
│   │   ├── Locations/
│   │   └── World_Maps_and_Art/
│   ├── 02_Characters/       # Mechanics and descriptions
│   │   ├── PCs/             # Player Characters
│   │   ├── Main_Cast/       # Story-crucial NPCs
│   │   └── Bestiary/        # Monsters, animals, generic mooks, guards
│   ├── 03_Story/            # Timeline, Sessions, and Encounters
│   │   ├── Campaign_Overview.md # Global timeline and arcs
│   │   └── Episode_01/      # A major narrative arc
│   │       ├── Episode_Overview.md
│   │       └── Chapter_01/  # A subdivision of an Episode
│   │           ├── Encounters/  # Specific scenes derived from Encounter_Template.md
│   │           └── Battle_Maps/
│   └── state.md             # Current game state and what's happening NOW
│
├── gemini.md                # System instructions for AI parsing
└── master_philosophy.md     # AI Core principles and GURPS rules adherence
```

## Template Enforcement
Whenever a workflow or user prompt instructs you to create a "Location", an "Encounter", an "Episode Overview", or an "NPC," you MUST use the corresponding `.md` template from `.planning/_templates/`. If multiple entries are requested, make separate files. Ensure formatting stays consistent with the template.
