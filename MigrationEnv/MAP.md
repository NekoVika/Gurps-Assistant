# GURPS AI Assistant - Campaign Directory Map

This document is the source of truth for the folder architecture. Always refer to this structure when instructed to create, place, or look for files. Any generated files MUST follow this taxonomy exactly.

## Directory Structure

```text
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
```

## Template Enforcement
For specific entities:
- Use `Character_Template.json` for all NPCs, PCs, Main Cast, and Bestiary entries.
- Use `Location_Template.json` for Locations.
- Use `Faction_Template.json` for Factions.
- Use `Story_Template.json` for Episodes, Chapters, and Encounters.
