---
description: Campaign Catch-Up (Import)
---
# Workflow: Campaign Catch-Up (Import)

**Command Trigger:** `/catch_up` or `/import_campaign`

## Objective
To take an existing, ongoing GURPS campaign—often contained in messy text files, PDFs, or scattered notes—and systematically migrate it into the standardized `root folder` structure.

## Execution Steps

1.  **Ingest Raw Materials:**
    Instruct the GM to place their messy, unstructured campaign notes, documents, lore dumps, or session summaries directly into the `Legacy/` folder at the root of the campaign. The workflow will read, ingest, and process all contents found strictly within this `Legacy/` folder. Acknowledge receipt of the data once it is placed there.

2.  **Define System Rules (RulesLawyer Mode):**
    Ask the GM to quickly define the mechanical boundaries so we can construct `00_System_Rules.md`.
    *   What is the Tech Level (TL) and Mana Level?
    *   What is the base point total and what books are in use?

3.  **Initialize Required Core Files (If Missing):**
    If `00_System_Rules.md` or `state.md` is missing in the campaign root, create them using templates from `.planning/_templates/`:
    * `.planning/_templates/00_System_Rules_Template.md` → `00_System_Rules.md`
    * `.planning/_templates/State_Template.md` → `state.md`

4.  **Data Parsing & Organization (WorldBuilder & SessionPlanner Mode):**
    Analyze the raw materials provided in Step 1. Automatically segment the information and ask the GM to verify the proposed structure:
    *   **Locations / Factions:** Propose the files to be created in `01_World_Bible/`.
    *   **Characters (PCs & NPCs):** List the key names found and propose creating their markdown sheets in `02_Characters/`.
    *   **The Story So Far:** Summarize the past events and draft a `Campaign_Overview.md`.

5.  **Establish Current State (The Interview):**
    Once the past data is sorted, interview the GM to define the *present* moment to populate `state.md`:
    *   "What Episode and Chapter are we currently on?"
    *   "Where are the PCs right now, physically?"
    *   "What are the active plotlines or immediate threats?"
    *   "What is the very next thing you plan to run for them?"

6.  **Execution & File Generation:**
    Upon GM approval, generate all the corresponding files in their proper directories (`01_World_Bible`, `02_Characters`, `03_Story`). Update `state.md` with the current Episode/Chapter and Active Plotlines.

7.  **Confirmation Output:**
    Inform the GM: *"Catch-up complete. All lore and story files have been integrated into the standard hierarchy. You may now run `/prep_session` to plan the next encounter, or `/start_session` to resume play."*
