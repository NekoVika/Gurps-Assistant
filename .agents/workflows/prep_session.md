---
description: Session Preparation
---
# Workflow: Session Preparation

**Command Trigger:** `/prep_session`

## Objective
To assist the GM in outlining the next session of play, ensuring tight pacing, narrative continuity, and balanced mechanical encounters.

## Execution Steps

1.  **Review the Target (SessionPlanner Mode):**
    Read `state.md` to determine the *Current Episode* and *Current Chapter*. Read the corresponding `03_Story/.../Encounter.json` files or previous session logs to understand the starting point. Identify where the PCs currently are and what unresolved plot threads exist.

2.  **Precheck Episode/Chapter Structure:**
    If the current Episode or Chapter folders are missing, ask whether to:
    * Run `/new_episode` and/or `/new_chapter` now, or
    * Create the necessary Episode_XX/Chapter_YY structure inline before proceeding.
    Proceed only after the target Chapter folder exists.

3.  **Determine Session Goal:**
    Ask the GM: "What is the primary objective or theme for the upcoming session?" (e.g., "Infiltrate the baron's manor," "Survive the journey through the acid swamps.")

4.  **Draft the Outline (SessionPlanner Mode):**
    Generate a framework of Encounters (Hook, Encounter 1, Encounter 2, Climax, Resolution) for the upcoming **Chapter**, based on the GM's goal and the established lore. Outline the narrative beats, required skill checks, and potential consequences. Do not generate full stat blocks yet. Save this draft in `03_Story/Episode_XX/Chapter_YY/Session_Prep.json`. If desired, create blank encounter files using `.planning/_templates/Story_Template.json`.

5.  **Mechanical Setup (RulesLawyer Mode):**
    Identify the key NPCs or monsters required for the Encounters outlined in Step 3. Switch to the **RulesLawyer** persona and verify if those NPCs exist in `02_Characters/`. If they do not, ask the GM if they want you to generate the stat blocks now.

6.  **Flavor Generation (Narrator Mode):**
    Switch to the **Narrator** persona and generate 1-2 paragraphs of read-aloud boxed text for the opening scene of the session to give the GM a strong starting point.
