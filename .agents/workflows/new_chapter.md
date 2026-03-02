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
    - For gaps, ask concise follow-ups. If the GM defers, propose 2–3 sensible options aligned with `state.md` and `00_System_Rules.md` and request approval. If still deferred, proceed with best-practice defaults and mark as Assumptions with a TODO in the Chapter and Episode overview.
    - Keep questioning minimal; stop once essentials are captured.

4.  **Generate Directories:**
    Create a new folder (e.g., `Chapter_01`) inside the *Target* `Episode_XX` folder.
    Inside the new Chapter folder, create two sub-folders: `Encounters/` and `Battle_Maps/`.

5.  **Create Locations (If Requested):**
    If the GM asks to create a Location during this flow, create a new file under `01_World_Bible/Locations/` using `.planning/_templates/Location_Template.md`. Do not place locations inside Chapter folders. After creation, add a reference link to the Location under “Locations & Map Needs” in this Chapter and, if helpful, in the Episode overview.

6.  **Update Episode Overview:**
    Add a link to this new Chapter in the *Target* `Episode_Overview.md` file and include the GM’s chapter summary preserving all details. Lightly edit grammar/formatting and optionally polish wording without changing meaning or omitting content. If the GM has not provided wording, leave a placeholder and a TODO rather than inventing text.

7.  **Update Global State (Conditional):**
    If the GM is creating a chapter for the *current active* Episode, modify `state.md` to set the "Current Chapter" to this newly created chapter. If they are prepping ahead, leave `state.md` alone.

8.  **Provide Encounter Template:**
    Create a blank encounter file (e.g., `01_Encounter.md`) inside the `Encounters/` folder using the `.planning/_templates/Encounter_Template.md`, or ask if they want to run `/prep_session` to automatically fill it out.
