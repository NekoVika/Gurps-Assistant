# GurpsAI — Campaign Folder Taxonomy

This document is the **authoritative source of truth** for how any GurpsAI campaign folder is structured. The app expects this exact structure. AI agents must follow this taxonomy exactly when creating, placing, or looking for campaign files.

> [!IMPORTANT]
> This map describes **any user campaign folder** — not the repository root itself. In production, a GM selects any folder on their machine as their campaign. In the development repo, `AnomalyHuntersCampaign/` is the richest example of this structure. `Campaign/` is a legacy reference.

---

## Campaign Directory Structure

```text
<YourCampaignFolder>/           # Root of the GM's campaign (user-selected path)
│
├── state.json                  # Current game state: active episode/chapter, recent events, plotlines
├── System_Rules.json           # Campaign-specific rules: Tech Level, Mana Level, house rules, allowed supplements
│
├── 01_World_Bible/             # Setting lore, factions, locations, and world-level canon
│   ├── World_Dossier.json      # Setting-wide lore, cosmology, travel rules, immutable premises
│   ├── Locations/              # One .json file per location
│   ├── Factions/               # One .json file per faction
│   └── World_Maps_and_Art/     # Image assets for the setting
│
├── 02_Characters/              # All characters: PCs, named NPCs, and generic mooks
│   ├── PCs/                    # Player Characters (synced from .gcs files)
│   ├── Main_Cast/              # Story-crucial NPCs (Significance 1-5)
│   └── Bestiary/               # Generic mooks, monsters, animals (Significance 0)
│
├── 03_Story/                   # Narrative structure: campaign, episodes, chapters, encounters
│   ├── Campaign_Overview.json  # Global timeline, story arcs, episode index
│   └── Episode_01/             # One directory per major story arc
│       ├── Episode_Overview.json
│       └── Chapter_01/         # One directory per chapter
│           ├── Chapter_Overview.json
│           ├── Encounters/     # One .json file per encounter (scene/combat/social)
│           └── Battle_Maps/    # Image assets for this chapter
│
└── Legacy/                     # IGNORED by all agents except `catch_up` workflow
                                # Contains unformatted GM notes awaiting import
```

---

## Template Enforcement

Whenever a workflow or prompt instructs you to create a campaign entity, you **MUST** use the corresponding template from `.planning/_templates/`. Never truncate or skip template sections.

| Entity Type | Template | Destination |
|-------------|----------|-------------|
| NPC (Significance 1-5, Main Cast) | `NPC_Template.json` | `02_Characters/Main_Cast/` |
| NPC (Significance 0, Bestiary) | `NPC_Template.json` | `02_Characters/Bestiary/` |
| Location | `Location_Template.json` | `01_World_Bible/Locations/` |
| Faction | `Faction_Template.json` | `01_World_Bible/Factions/` |
| Episode Overview | `Story_Template.json` (`"type": "Episode"`) | `03_Story/Episode_XX/` |
| Chapter Overview | `Story_Template.json` (`"type": "Chapter"`) | `03_Story/Episode_XX/Chapter_YY/` |
| Encounter | `Story_Template.json` (`"type": "Encounter"`) | `03_Story/.../Encounters/` |
| World Dossier | `World_Dossier_Template.json` | `01_World_Bible/` |
| State | `State_Template.json` | `<campaign_root>/` |
| System Rules | `System_Rules_Template.json` | `<campaign_root>/` |

---

## Key Taxonomy Rules

1. **Locations belong in `01_World_Bible/Locations/`** — never inside Episode or Chapter folders.
2. **NPCs belong in `02_Characters/`** — never inline in story files.
3. **Encounters belong in `03_Story/.../Chapter_XX/Encounters/`** — not at the Episode level.
4. **Sub-locations** (rooms, floors, wings) live *inside* the parent Location file — do not create separate files for sub-locations unless they have exceptional narrative or mechanical density.
5. **`state.json` only updates** when narrative progress actually occurs — content creation does not auto-update state.
6. **`Legacy/` is always ignored** by all agents except the `catch_up` workflow.

---

## Character Significance Scale

| Level | Label | Destination |
|-------|-------|-------------|
| 0 | Common Variant (Bestiary type) | `02_Characters/Bestiary/` |
| 1 | Extra | `02_Characters/Main_Cast/` |
| 2 | Supporting | `02_Characters/Main_Cast/` |
| 3 | Featured | `02_Characters/Main_Cast/` |
| 4 | Major | `02_Characters/Main_Cast/` |
| 5 | Keystone | `02_Characters/Main_Cast/` |
