---
description: Create NPC
---
# Workflow: Create NPC

**Command Trigger:** `/create_npc`

## Objective
To rapidly generate a mechanically sound GURPS 4e character sheet for an NPC and integrate them into the campaign world.

## Execution Steps

1.  **Gather Inputs:**
    Ask the GM for the following parameters:
    *   **Concept:** (e.g., "A grizzled veteran town guard who takes bribes.")
    *   **Point Total Target:** (e.g., "75 points," or "Just make them roughly equivalent to a starting PC.")
    *   **Key Focus:** (Combat, Social, Academic, etc.)

2.  **Mechanical Generation (RulesLawyer Mode):**
    Switch strictly to the **RulesLawyer** persona. Read `00_System_Rules.md` to ensure no forbidden traits are used. Calculate attributes, advantages, disadvantages, and skills to hit the target point total. *Always ensure math is correct*. **Crucial:** You MUST include a mechanical explanation for every Advantage generated, and a **Hit Location DR table** for characters expected to engage in combat, as per the Rules Lawyer's updated response format.

3.  **Output Format:**
    Present the stat block in the standard text format defined by the RulesLawyer, making it easy for the GM to read or input into GCS.

4.  **Narrative Integration (WorldBuilder Mode):**
    Switch to the **WorldBuilder** persona. Give the NPC a brief appearance description, a personality quirk, and a motivation that ties into the existing campaign lore.

5.  **File Creation:**
    Ask the GM if they approve of the NPC and whether they are a "Main Story NPC" or a "Generic Monster/Mook". Based on their answer, save the Markdown file in:
    *   `02_Characters/Main_Cast/` (for unique characters)
    *   `02_Characters/Bestiary/` (for monsters, guards, or creatures)
