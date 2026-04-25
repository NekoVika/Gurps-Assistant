---
description: Create NPC
---
# Workflow: Create NPC

**Command Trigger:** `/create_npc`

## Objective
To rapidly generate a mechanically sound GURPS 4e character sheet for an NPC and integrate them into the campaign world.

## Execution Steps

1.  **Run a Multi-Step NPC Interview (Wizard Style):**
    Silently load campaign context from `state.md`, `SYSTEM.md`, `master_philosophy.md`, `00_System_Rules.md`, and `01_World_Bible/World_Dossier.md`. Do not re-ask what’s already defined unless the GM marks an exception.
    - **Preservation rule (critical):** Treat GM-provided details as canon. Capture appearance as a **Visual Anchor** and paste it into the final file **verbatim**.
    - **One question at a time:** Ask a single compact question, wait, then continue.
    - **Build mode (pick one):** Quick / Standard / Detailed / You decide.
    - **Core prompts (ask in order, each as its own step):**
        1. Concept (free text)
        2. Name (GM picks / GM types / You decide)
        3. Visual Anchor (GM describes / reference / generate 3 options, then GM picks)
        4. Narrative role (Ally/Enemy/Contact/Patron/Mook/etc.)
        5. **Significance** (store as `number (label)`): 0 Common Variant (Bestiary type), 1 Extra, 2 Supporting, 3 Featured, 4 Major, 5 Keystone.
    - **Mechanical scale (separate steps):** point total target, key focus (combat/social/support/etc.), desired complexity.
    - **Defaults vs exception:** Ask if the NPC follows campaign defaults. Only if it’s an exception, ask for overrides (tone, power source, TL).
    - **Constraints:** required elements, disallowed elements, and any NPC-specific exceptions to log under **Assumptions & Open Questions**.

2.  **Smart Gap Fill Using Defaults:**
    Analyze provided info and identify only what is still missing for a robust NPC build, **respecting the chosen build mode**:
    - For **Quick NPCs**, aggressively minimize questions; only ask about details that would significantly change play (e.g., combat role, obvious signature gear). Otherwise, rely on best-practice defaults and campaign norms.
    - For **Standard NPCs**, ask a moderate number of follow-ups to clarify role, capabilities, and any distinctive hooks, but avoid overwhelming the GM.
    - For **Detailed NPCs**, ask more granular questions where useful (e.g., secondary skills, nuanced social roles, specific cultural details), while still avoiding redundancy with campaign context.
    - In all modes, prefer **short, targeted follow-up questions** using multiple-choice scaffolds (with “Other (type your own)” and “You decide”).
    - Specifically ensure coverage of: **Visual Anchor** (and must-not-change details), signature weapons/armor, combat role, social role, languages/culture, notable contacts, reaction modifiers, signature gear, legal status, constraints/content boundaries, and desired complexity (quick build vs detailed).
    - If **Significance = 0 (Common Variant)** (Bestiary entry), additionally ensure coverage of a **Variations** section:
        - Name pool / callsigns (only for humans/sapients)
        - 3-6 loadout kits (weapons + armor + notable gear swaps)
        - Visual tags (quick distinguishing details)
        - Behavior/tactics tags (discipline, cowardice, aggression, teamwork)
        - Stat toggles (Rookie/Regular/Veteran/Elite) with **explicit small deltas**
        - Optional Leader/Elite package (1 standout in a group)
    - When the GM chooses “You decide” or skips, propose 2–3 sensible options aligned with `state.md` and `00_System_Rules.md` and ask for quick approval. If they still defer, pick the best-practice default and later record it as an Assumption with a TODO in the NPC file under **Assumptions & Open Questions**.

3.  **Mechanical Generation (RulesLawyer Mode):**
    Switch strictly to the **RulesLawyer** persona. Read `00_System_Rules.md` to ensure no forbidden traits are used. Calculate attributes, advantages, disadvantages, and skills to hit the target point total, scaling detail to the chosen build mode:
    - For **Quick NPCs**, prioritize a small, clear set of traits and skills that capture the concept and role; avoid excessive niche abilities that will not matter in play.
    - For **Standard NPCs**, provide a solid, rounded build suitable for recurring use without going into exhaustive detail.
    - For **Detailed NPCs**, aim for PC-grade completeness where appropriate, within reasonable length for the chat format.
    *Always ensure math is correct*. **Crucial:** You MUST include a mechanical explanation for every Advantage generated, and a **Hit Location DR table** for characters expected to engage in combat, as per the Rules Lawyer's updated response format.

4.  **Validation & Compliance:**
    Verify point totals, prerequisites, and book allowances against `00_System_Rules.md`. If a chosen trait is disallowed, select a nearest-analog allowed trait and note the substitution in Assumptions. Ensure attack/damage lines and defenses are coherent with ST, skills, weapons, and armor coverage.
    - **Coverage check (critical):** Compare the final NPC writeup against the interview answers and the Visual Anchor. If anything is missing or contradicted (especially appearance), stop and ask the GM to correct it before saving the file.

5.  **Output Format:**
    Present the stat block in the strict JSON format matching the template. Do not use Markdown text blocks for the final file.

6.  **Narrative Integration (WorldBuilder Mode):**
    Switch to the **WorldBuilder** persona. Provide appearance, a personality quirk, a motivation tied to existing lore, and a short speech snippet. Add PC hooks by consulting `02_Characters/PCs/` where relevant. Preserve GM-provided narrative details with light edits for clarity only.
    - **Appearance rule (critical):** If the GM provided a Visual Anchor, paste it into the NPC file's appearance section **verbatim** (or with only minimal formatting fixes), and only add extra flavor in a clearly separated "Additional notes" line that does not contradict the anchor.

7.  **File Creation:**
     Ask the GM if they approve of the NPC. Then save the JSON file based on Significance:
     *   If **Significance = 0 (Common Variant)**: save in `02_Characters/Bestiary/` as `.json`
     *   If **Significance = 1-5**: save in `02_Characters/Main_Cast/` as `.json`
    Use the correct template as the base:
    - If **Significance = 0 (Common Variant)**: use `.planning/_templates/NPC_Template.json` (populate appropriately for Bestiary)
    - If **Significance = 1-5**: use `.planning/_templates/NPC_Template.json`
    - Output your draft EXCLUSIVELY as a strictly formatted JSON block matching these templates. Do not output Markdown text blocks.
