---
description: Start New Chapter
---
# Workflow: Start New Chapter

**Command Trigger:** `/new_chapter`

## Objective
To create a localized structural block for the next phase of the adventure within the current Episode.

## Execution Steps

1.  **Determine Target Episode:**
    Check `state.md` for the current active Episode. Ask the GM: "Are we creating this chapter for the current active Episode, or are you prepping ahead for a different Episode?"

2.  **Determine Parameters:**
    Ask the GM for the focus or setting of this chapter (e.g., "Exploring the docks," or "Investigating the murder scene").

3.  **Smart Interview & Gap Fill:**
    Analyze the provided info and ask only for missing pieces, offering multiple-choice scaffolds and a “skip/you decide” option as a last resort.
    - Extract where possible: Scene purpose, Starting situation, Primary location(s), Primary conflict/goal, Stakes, Notable NPCs present (role/link/motivation), Expected beats/encounters, Clues or props, Map needs, Time pressure, PC hooks, and Success/Fail outcomes.
    - If the GM provides a file (e.g., `@[Text.md]`) or a long narrative pitch, **do not ask for details already present in the text**.

4.  **Generate Structure:**
    Create a new folder (e.g., `Chapter_01`) inside the *Target* `Episode_XX` folder.
    Inside the new Chapter folder, create two sub-folders: `Encounters/` and `Battle_Maps/`.
    **Create `Chapter_Overview.md`** inside the Chapter folder using `.planning/_templates/Chapter_Template.md`. Preserve the GM's provided text **in full** within the "GM Summary" section.

5.  **Smart Extraction (Identify & Confirm):**
    Analyze the GM's provided pitch/file to identify potential sub-components. **Do not create files yet.** Instead, present a list to the GM:
    - **Identified Locations**: (e.g., "The Ballroom," "The Command Cabin")
    - **Identified NPCs**: (e.g., "The Commander," "Mary")
    - **Proposed Encounters**: (e.g., "The Ballroom Choice," "Investigating the Cabin," "The Descent")
    Ask: "I've identified these components from your notes. Should I generate them now using their respective templates, or would you like to refine the list?"

6.  **Smart Generation (Procedural):**
    Once confirmed, generate **each file individually** following these strict template rules:
    - **Locations**: Create in `01_World_Bible/Locations/` using `.planning/_templates/Location_Template.md`.
    - **NPCs**: Generate a full GURPS stat block and narrative profile in `02_Characters/Main_Cast/` using `.planning/_templates/NPC_Template.md` (referencing the logic of `/create_npc`).
    - **Multiple Encounters**: Create separate files in `Encounters/` using `.planning/_templates/Encounter_Template.md`.
    **CRITICAL:** Every generated file MUST contain all sections of its template. Do not truncate sections or summarize unless the GM explicitly asks for a "Quick/Empty" version.

7.  **Update Episode Overview:**
    Add a link to the new `Chapter_Overview.md` in the *Target* `Episode_Overview.md` file. Include the GM’s chapter summary (truncated for the Episode level if very long, but linking to the full text in the Chapter file).

7.  **Update Global State (Conditional):**
    If the GM is creating a chapter for the *current active* Episode, ask: "Would you like to set this as the active Current Chapter in `state.md` now?" If they agree, update the "Current Chapter" field in `state.md`. If they decline or are prepping ahead, leave `state.md` alone.

8.  **Finalise Session Prep:**
    Ask the GM if they want to run `/prep_session` to further detail the newly created encounters.
