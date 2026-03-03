---
description: New Campaign Initialization
---

# Workflow: New Campaign Initialization

**Command Trigger:** `/new_campaign`

## Objective
To assist the GM in standing up a brand new GURPS campaign by defining the core rules, setting up the basic lore framework, and preparing the `root folder` structure.

## Execution Steps

1.  **Gather Inputs (The Interview):**
    Ask the GM these questions one by one (or all at once if they prefer):
    *   What is the core genre and concept of the campaign?
    *   What is the Tech Level (TL) and Mana Level?
    *   What is the starting point total and disadvantage limit?
    *   Are there any specific GURPS supplements we are using (e.g., Dungeon Fantasy, Action, Space)?

2.  **Generate `00_System_Rules.md`:**
    Using the GM's answers, immediately draft the `00_System_Rules.md` file using the established template format from `.planning/_templates/00_System_Rules_Template.md`. Include recommendations for forbidden advantages or required skills based on the genre.

3.  **Create Folder Skeleton (Per MAP):**
    Ensure the standard campaign folders exist as defined in `.planning/MAP.md`:
    *   `01_World_Bible/` with `Factions/` and `Locations/`
    *   `02_Characters/` with `PCs/`, `Main_Cast/`, and `Bestiary/`
    *   `03_Story/` with `Campaign_Overview.md`
    If any are missing, create them now (blank files where applicable).

4.  **Initialize `state.md` (If Missing):**
    Create `state.md` from `.planning/_templates/State_Template.md` if it does not exist. Populate the basics (Active Campaign Name if known).

5.  **Establish Initial Lore (WorldBuilder Mode):**
    Transition to the **WorldBuilder** persona. Ask the GM for a single starting location (a town, a spaceship, a dungeon entrance). Generate a brief Markdown file for that location and save it in `01_World_Bible/`. Include 2-3 notable NPCs and 1-2 plot hooks.

6.  **Ready confirmation:**
    Inform the GM that the campaign structure is initialized (rules, folders, and state). They can now begin creating PCs or run the `new_episode` workflow.