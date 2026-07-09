---
description: Conclude Session
---
# Workflow: Conclude Session

**Command Trigger:** `/conclude_session`

## Objective
To process the events of a completed session, update the global state, modify NPC/lore files based on player actions, and prepare the foundation for the next prep cycle.

## Execution Steps

1.  **Gather Session Summary:**
    Ask the GM: "Session concluded. Please provide a summary of what happened. Key things I need to know:
    *   Who died or was defeated?
    *   What major choices did the players make?
    *   Did they acquire important items or meet new NPCs?
    *   Where did they end up?"

2.  **Update Global State:**
    Update `state.md`. 
    *   Add the summary to the "Recent Events" section.
    *   Update any resolved or new "Active Plotlines."
    *   Update the "Immediate Next Steps" (usually running `/prep_session`).

3.  **Update the World / Hierarchy:**
    *   **Characters:** If an NPC died, mark their file as `[DECEASED]`. If the players made an enemy, add a "Rivals the PCs" note to that faction/NPC file.
    *   **Story Tracking:** If an Encounter or Chapter was completed, note the outcome in the corresponding `03_Story/.../Encounters/*.json` file (e.g., "Outcome: Goblins routed, players took the map").

4.  **Experience Points (RulesLawyer Mode):**
    Ask the GM how many Character Points (CP) they are awarding. Remind them of the standard GURPS 4e award rate (usually 1-5 points per session depending on the length and danger).

5.  **Confirmation Output:**
    Present a bulleted changelog to the GM summarizing all the files that were updated as a result of the session conclusion.
