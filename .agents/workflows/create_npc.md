---
description: Create NPC
---
# Workflow: Create NPC

**Command Trigger:** `/create_npc`

## Objective
To rapidly generate a mechanically sound GURPS 4e character sheet for an NPC and integrate them into the campaign world.

## Execution Steps

1.  **Gather Inputs (Preserve Content):**
    Ask the GM for initial parameters. Preserve all details; lightly edit for clarity only.
    *   **Concept:** (e.g., "A grizzled veteran town guard who takes bribes.")
    *   **Point Total Target:** (e.g., "75 points," or "Just make them roughly equivalent to a starting PC.")
    *   **Key Focus:** (Combat, Social, Academic, etc.)
    *   **Role & Placement:** Ally/Enemy/Contact; Main Cast vs Mook; usual location.
    *   **Power Source & Tone:** Realistic/Cinematic, Tech Level, Mana/Psi/Supers allowed.
    *   **Archetype Template Preference:** Profession/background if any (e.g., City Guard, Cult Adept).
    *   **Disallowed/Required Elements:** Traits/books to avoid or include.

2.  **Smart Interview & Gap Fill:**
    Analyze provided info; ask only for missing essentials with concise targeted questions and multiple-choice scaffolds. Always offer “skip/you decide” to defer to AI as a last resort.
    - Capture: signature weapons/armor, combat role, social role, languages/culture, notable contacts, reaction modifiers, signature gear, legal status, constraints/content boundaries, and desired complexity (quick build vs detailed).
    - If the GM defers, propose 2–3 sensible options aligned with `state.md` and `00_System_Rules.md` and request approval. If still deferred, proceed with best-practice defaults and record them as Assumptions in the file with TODOs.

3.  **Mechanical Generation (RulesLawyer Mode):**
    Switch strictly to the **RulesLawyer** persona. Read `00_System_Rules.md` to ensure no forbidden traits are used. Calculate attributes, advantages, disadvantages, and skills to hit the target point total. *Always ensure math is correct*. **Crucial:** You MUST include a mechanical explanation for every Advantage generated, and a **Hit Location DR table** for characters expected to engage in combat, as per the Rules Lawyer's updated response format.

4.  **Validation & Compliance:**
    Verify point totals, prerequisites, and book allowances against `00_System_Rules.md`. If a chosen trait is disallowed, select a nearest-analog allowed trait and note the substitution in Assumptions. Ensure attack/damage lines and defenses are coherent with ST, skills, weapons, and armor coverage.

5.  **Output Format:**
    Present the stat block in the standard text format defined by the RulesLawyer, making it easy for the GM to read or input into GCS.

6.  **Narrative Integration (WorldBuilder Mode):**
    Switch to the **WorldBuilder** persona. Provide appearance, a personality quirk, a motivation tied to existing lore, and a short speech snippet. Add PC hooks by consulting `02_Characters/PCs/` where relevant. Preserve GM-provided narrative details with light edits for clarity only.

7.  **File Creation:**
    Ask the GM if they approve of the NPC and whether they are a "Main Story NPC" or a "Generic Monster/Mook". Based on their answer, save the Markdown file in:
    *   `02_Characters/Main_Cast/` (for unique characters)
    *   `02_Characters/Bestiary/` (for monsters, guards, or creatures)
    Use `.planning/_templates/NPC_Template.md` as the base. Populate “Assumptions & Open Questions” with any deferred choices and TODOs to confirm later.
