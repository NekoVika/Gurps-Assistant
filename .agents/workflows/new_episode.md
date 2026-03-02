---
description: Start New Episode
---
# Workflow: Start New Episode

**Command Trigger:** `/new_episode`

## Objective
To generate the necessary scaffolding for a major new story arc within an active campaign, updating the global state and linking it to the Campaign Overview.

## Execution Steps

1.  **Determine Parameters (Preserve Content):**
    Ask the GM for the episode title and a long-form brief. Accept any length. Preserve every detail the GM provides; you may lightly edit grammar, formatting, and flow, and enrich wording without changing meaning or omitting content.
    - Example prompt: “Provide the episode title and your full narrative brief. I will preserve all details and may lightly edit for clarity/flow and polish the wording without removing or altering meaning.”

2.  **Smart Interview & Gap Fill:**
    Analyze the provided brief and collect missing essentials via targeted questions only for gaps. Do not ask for information that is already present. Prefer multiple-choice scaffolds when helpful and always offer “skip/you decide” to defer to AI as a last resort.
    - Extract from brief where possible: Title, Primary Setting, Tone/Genre, Themes, Premise/Inciting Incident, Main Objectives, Key Antagonists/Figures (role, link, motivation), Stakes/Consequences, Chapter ideas, Constraints/Content boundaries, and PC Hooks (consult `02_Characters/PCs/` as needed).
    - For any missing item, ask a concise follow-up. If the GM answers “don’t know/your choice/skip”, propose 2–3 sensible options aligned with `state.md` and `00_System_Rules.md` and request approval. If still deferred, proceed with best-practice defaults and mark them as Assumptions in the file with a TODO to revisit.
    - Keep interviews short and focused; stop as soon as required fields are captured.

3.  **Generate Directory Structure:**
    Create a new directory in `03_Story/` with the appropriate number (e.g., `Episode_02/`).

4.  **Draft Overview (Use Template, Preserve All Information):**
    Create `Episode_Overview.md` in the new folder using `.planning/_templates/Episode_Overview_Template.md` as the base.
    - Add a section “GM Brief (preserved; lightly edited for clarity)” at the top and include the GM’s narrative with light grammar/formatting edits and optional wording polish while keeping all details intact.
    - Populate the remaining sections by reorganizing or quoting only the GM’s content. Do not invent or compress. If a section is not covered by the GM’s brief, leave the placeholder and a short TODO note rather than fabricating details.
    - When the GM provides extensive material, include it in full; prefer structure and headings over shortening.

5.  **Create Locations (If Requested):**
    If the GM requests new Locations during episode planning, create them under `01_World_Bible/Locations/` using `.planning/_templates/Location_Template.md`. Do not place locations inside Episode or Chapter folders. Add links to these locations in the Episode overview (and later in relevant Chapters).

5.  **Update Campaign Overview:**
    Modify the `03_Story/Campaign_Overview.md` file to add a link to the new Episode in the Episode Index.

6.  **Update Global State (Conditional):**
    Ask the GM if this is the new active Episode they are currently playing, or if they are prepping ahead. If active, modify `state.md` to update the "Current Episode" to the new episode and set "Current Chapter" to "None (Starting Episode)". If prepping ahead, leave `state.md` alone.

7.  **Next Steps:**
    Remind the GM that the episode is created, and they can now run `/new_chapter` (and specify the target episode) to set up the first beat of the story.
