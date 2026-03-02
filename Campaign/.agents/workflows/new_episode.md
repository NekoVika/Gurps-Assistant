---
description: Start New Episode
---
# Workflow: Start New Episode

**Command Trigger:** `/new_episode`

## Objective
To generate the necessary scaffolding for a major new story arc within an active campaign, updating the global state and linking it to the Campaign Overview.

## Execution Steps

1.  **Determine Parameters:**
    Ask the GM for a brief premise or title for the new episode. (e.g., "Episode 2: The Warehouse Raid").

2.  **Generate Directory Structure:**
    Create a new directory in `03_Story/` with the appropriate number (e.g., `Episode_02/`).

3.  **Draft Overview:**
    Generate the `Episode_Overview.md` within this new folder. Fill in the Setup, Main Goal, and Key Antagonists based on the GM's premise and the current global state logic from `state.md`.

4.  **Update Campaign Overview:**
    Modify the `03_Story/Campaign_Overview.md` file to add a link to the new Episode in the Episode Index.

5.  **Update Global State (Conditional):**
    Ask the GM if this is the new active Episode they are currently playing, or if they are prepping ahead. If active, modify `state.md` to update the "Current Episode" to the new episode and set "Current Chapter" to "None (Starting Episode)". If prepping ahead, leave `state.md` alone.

6.  **Next Steps:**
    Remind the GM that the episode is created, and they can now run `/new_chapter` (and specify the target episode) to set up the first beat of the story.
