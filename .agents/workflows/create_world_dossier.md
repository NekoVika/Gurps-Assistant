---
description: Create or update the campaign World Dossier
---
# Workflow: Create World Dossier

**Command Trigger:** `/create_world_dossier`

## Objective
Create (or update) `Campaign/01_World_Bible/World_Dossier.md` from `.planning/_templates/World_Dossier_Template.md`, auto-filling what can be inferred from the existing campaign files, and asking the GM for any missing setting-canon pieces.

## Execution Steps

1. **Load Campaign Context (Silent)**
   Silently load and honor:
   - `Campaign/state.md`
   - `SYSTEM.md`
   - `master_philosophy.md`
   - `.planning/MAP.md`
   - `Campaign/00_System_Rules.md`
   - `Campaign/03_Story/Campaign_Overview.md` (if present)
   - Existing World Bible files (especially `Campaign/01_World_Bible/Locations/` and `Campaign/01_World_Bible/Factions/`)

2. **Use Canonical File Path (Hardcoded)**
   The dossier file path is fixed and canonical:
   - `Campaign/01_World_Bible/World_Dossier.md`

   If it exists, update it in place. If it does not exist, create it from the template.

3. **Auto-Fill What Exists (No GM Questions Yet)**
   Build a draft dossier by starting from `.planning/_templates/World_Dossier_Template.md` and pre-populating fields using:
   - `Campaign/00_System_Rules.md` for baseline TL, mana/power baseline, allowed sources, campaign genre notes.
   - `Campaign/03_Story/Campaign_Overview.md` (and episode overviews) for destination shards, major arcs, recurring threats, and clocks.
   - `Campaign/01_World_Bible/Locations/HQ.md` (if present) for the anchor-world summary and operational assumptions.
   - `Campaign/state.md` for current active arc facts that are setting-relevant (do not copy transient table notes into immutable lore).

   While drafting, mark anything that cannot be inferred as `TBD (GM)` inline.

4. **Gap Check: Ask GM for Missing Setting Canon (One Question at a Time)**
   Ask only for items still marked `TBD (GM)`, using compact prompts. Prefer option pickers with:
   - 3–6 sensible defaults inferred from the campaign
   - plus "Other (type your own)" and "You decide"

   Minimum questions to cover (skip any already inferred):
   - **World Type** (e.g., "Single world", "Anchor world + shards", "Multiverse web", etc.)
   - **Primary World ID / naming** (what the table calls the anchor world and shards)
   - **Immutable premises** (3 short statements)
   - **Travel constraints** (what the Gate can/can't do; what counts as contamination)
   - **Cosmic-meta layer** (do higher entities exist? what are their boundaries? if unknown, explicitly set as "Unknown by design")
   - **Content notes (setting)** (what exists in-world; not table safety rules)
   - **Disclosure plan** (what is safe to reveal now vs later)

5. **Write the Dossier File**
   Save the completed dossier to:
   - `Campaign/01_World_Bible/World_Dossier.md`

   Ensure:
   - All links are relative and point to existing files when possible.
   - The Change Log includes an entry for today’s update.

6. **Post-Task Self-Audit**
   - Confirm the dossier follows the template section structure.
   - Confirm the file is placed exactly under `Campaign/01_World_Bible/`.
   - Confirm no GM-provided narrative text was paraphrased if the GM requested verbatim preservation.
