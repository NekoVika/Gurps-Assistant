---
description: Campaign Catch-Up (Import)
---
# Workflow: Campaign Catch-Up (Import)

**Command Trigger:** `/catch_up` or `/import_campaign`

## Objective
To take an existing, ongoing GURPS campaignâ€”often contained in messy text files, PDFs, or scattered notesâ€”and systematically migrate it into the standardized `root folder` structure.

## Execution Steps

1.  **Ingest Raw Materials:**
    Ask the GM to paste or upload their existing campaign documents, lore dumps, NPC lists, or session summaries. Acknowledge receipt of the data.

2.  **Define System Rules (RulesLawyer Mode):**
    Ask the GM to quickly define the mechanical boundaries so we can construct `00_System_Rules.md`.
    *   What is the Tech Level (TL) and Mana Level?
    *   What is the base point total and what books are in use?

3.  **Data Parsing & Organization (WorldBuilder & SessionPlanner Mode):**
    Analyze the raw materials provided in Step 1. Automatically segment the information and ask the GM to verify the proposed structure:
    *   **Locations / Factions:** Propose the files to be created in `01_World_Bible/`.
    *   **Characters (PCs & NPCs):** List the key names found and propose creating their markdown sheets in `02_Characters/`.
    *   **The Story So Far:** Summarize the past events and draft a `Campaign_Overview.md`.

4.  **Establish Current State (The Interview):**
    Once the past data is sorted, interview the GM to define the *present* moment to populate `state.md`:
    *   "What Episode and Chapter are we currently on?"
    *   "Where are the PCs right now, physically?"
    *   "What are the active plotlines or immediate threats?"
    *   "What is the very next thing you plan to run for them?"

5.  **Execution & File Generation:**
    Upon GM approval, generate all the corresponding files in their proper directories (`01_World_Bible`, `02_Characters`, `03_Story`). Update `state.md` with the current Episode/Chapter and Active Plotlines.

6.  **Confirmation Output:**
    Inform the GM: *"Catch-up complete. All lore and story files have been integrated into the standard hierarchy. You may now run `/prep_session` to plan the next encounter, or `/start_session` to resume play."*
