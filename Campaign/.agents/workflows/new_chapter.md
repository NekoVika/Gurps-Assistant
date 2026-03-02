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

3.  **Generate Directories:**
    Create a new folder (e.g., `Chapter_01`) inside the *Target* `Episode_XX` folder.
    Inside the new Chapter folder, create two sub-folders: `Encounters/` and `Battle_Maps/`.

4.  **Update Episode Overview:**
    Add a brief summary and a link to this new Chapter in the *Target* `Episode_Overview.md` file.

5.  **Update Global State (Conditional):**
    If the GM is creating a chapter for the *current active* Episode, modify `state.md` to set the "Current Chapter" to this newly created chapter. If they are prepping ahead, leave `state.md` alone.

6.  **Provide Encounter Template:**
    Create a blank encounter file (e.g., `01_Encounter.md`) inside the `Encounters/` folder using the `.planning/_templates/Encounter_Template.md`, or ask if they want to run `/prep_session` to automatically fill it out.
