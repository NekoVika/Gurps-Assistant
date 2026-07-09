---
description: GM Brainstorming & Logging
---
# Workflow: GM Brainstorming & Logging

**Command Trigger:** `/brainstorm` or `/log_thoughts`

## Objective
To capture unstructured thoughts, ideas, or notes from the GM and automatically categorize them into the appropriate Campaign Template files (Lore, Characters, or Plot).

## Execution Steps

1.  **Receive Input:**
    The GM will provide a block of text, notes, or bullet points. (e.g., "The king is actually a vampire. Also, add a new magic sword to the loot pile in chapter 2.")

2.  **Select Mode (Triage Level):**
    Ask the GM to choose how deeply to process this brainstorm now:
    *   **Idea Dump:** Capture and park with tags for later triage.
    *   **Triage:** Classify, link to existing files, and queue next steps; no writing yet.
    *   **Commit:** Propose concrete file edits and, on approval, write them.

3.  **Smart Interview (Targeted Questions):**
    Keep this brief and skip already-provided details.
    *   **Scope:** Is this about a Location, NPC, Item/Artifact, Faction, or Plot Beat?
    *   **Timescale:** Next session, this episode, campaign-long, or backlog?
    *   **PC Hooks:** Which PCs does this touch and how? (consult `02_Characters/PCs/` when needed)
    *   **Constraints:** Any content boundaries, tone notes, or spoilers to isolate?
    *   **Mechanics:** Any rules/gear/spells implied? If yes, note for RulesLawyer follow-up.
    *   **Priority:** High, Medium, Low.

4.  **System & Canon Checks:**
    Cross-check against `System_Rules.json` (TL, Mana, Allowed Books). Flag anything out-of-bounds and propose allowed alternatives.

5.  **Analysis & Segmentation:**
    Analyze the input and categorize the information into:
    *   **World Lore** (Locations, Factions, Secrets)
    *   **Characters** (NPC updates or new traits)
    *   **Story / Plot** (Upcoming Encounters, Episode hooks)

6.  **Tagging & Linking:**
    Attach quick tags (e.g., `theme:intrigue`, `location:old_city`, `npc:king_roderick`, `priority:high`, `timescale:next_session`) and identify links to existing files where possible.

7.  **File Updates:**
    Identify which specific files in the campaign hierarchy need to be updated. (e.g., updating the King's NPC markdown file under `02_Characters/Main_Cast/`, adding the sword to an Encounter file under `03_Story/Episode_XX/Chapter_YY/Encounters/`).
    *   Use the **Atlas** (WorldBuilder) persona for lore updates.
    *   Use the **Archer** (SessionPlanner) persona for story updates.
    *   If mechanical work is required (new traits/gear/spells), queue a handoff to **Marauder** (RulesLawyer) or suggest running `/create_npc` as appropriate.

8.  **Confirmation Output:**
    Present the GM with a summary of the changes you *plan* to make before executing them. "I will add the 'Vampire' template to King Roderick's sheet, and put the 'Sunblade' in Chapter 2, Encounter 3. Proceed?" No files are modified until you confirm.
