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

5.  **Smart Extraction (Auto-Generation):**
    Analyze the GM's provided pitch/file for the following and execute accordingly:
    - **Locations**: If specific locations (e.g., "The Ballroom," "The Command Cabin") are described with unique details, create them in `01_World_Bible/Locations/` using the template and link them in the Chapter Overview.
    - **NPCs**: If new NPCs are introduced, create their files in `02_Characters/Main_Cast/` or `02_Characters/NPCs/` and link them.
    - **Multiple Encounters**: If the pitch describes distinct scenes or choice branches (e.g., "Path A vs Path B," "Searching the Room," "The Final Encounter"), create **separate** encounter files in `Encounters/` for each, rather than one generic file.
    - If any of these are ambiguous, create the Chapter Overview first, then list the "Identified Components" and ask the GM for permission to generate them.

6.  **Update Episode Overview:**
    Add a link to the new `Chapter_Overview.md` in the *Target* `Episode_Overview.md` file. Include the GM’s chapter summary (truncated for the Episode level if very long, but linking to the full text in the Chapter file).

7.  **Update Global State (Conditional):**
    If the GM is creating a chapter for the *current active* Episode, modify `state.md` to set the "Current Chapter" to this newly created chapter.

8.  **Finalise Session Prep:**
    Ask the GM if they want to run `/prep_session` to further detail the newly created encounters.
