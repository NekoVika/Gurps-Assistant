---
description: Create NPC
---
# Workflow: Create NPC

**Command Trigger:** `/create_npc`

## Objective
To rapidly generate a mechanically sound GURPS 4e character sheet for an NPC and integrate them into the campaign world.

## Execution Steps

1.  **Run a Multi-Step NPC Interview (Wizard Style):**
    Before asking anything, silently load and honor the existing campaign context from `state.md`, `SYSTEM.md`, `master_philosophy.md`, and `00_System_Rules.md`. Treat those as defaults for tone, genre, power sources, tech level, and safety/content boundaries.
    - Do **not** re-ask for information that is already clearly defined at campaign level unless the GM explicitly marks this NPC as an exception.
    - Start by asking the GM to choose a **build mode** using a **single interactive option picker (radio buttons)** with exactly one selection allowed:
        - Options: "Quick NPC (scene-use, low friction)", "Standard NPC (balanced detail)", "Detailed NPC (PC-grade, full treatment)", plus "You decide (pick what fits)".
        - If **Quick NPC** is chosen, favor minimal follow-up questions, accept more "You decide" defaults, and bias toward simple, robust builds with only the most relevant traits/skills.
        - If **Detailed NPC** is chosen, prefer asking the full set of clarifying questions, including finer-grained personality, background, and niche capabilities.
        - If **Standard NPC** is chosen or the GM defers, strike a middle ground between brevity and detail.
    - For **every subsequent step**, ask **one compact interactive question at a time** (checkboxes/radio buttons with “Other (type your own)” and “You decide” options where appropriate), wait for the GM’s answer, then continue. **Do not** merge multiple unrelated questions into a single long text message.
    1.  **Core Concept & Role:**
        - Ask these as **separate prompts**, in order:
            1. **High-level concept** — free-text input only (short, e.g., "Grizzled veteran town guard who takes bribes."). Do **not** add buttons here.
            2. **Narrative role** — **single-choice option picker** with options like: "Ally", "Enemy", "Contact", "Patron", "Background/Mook", "Unknown/You decide", plus "Other (type your own)".
            3. **Story importance** — **single-choice option picker** with options: "Main Story NPC", "Recurring Side NPC", "One-off/Mook", "Template Monster", plus "You decide".
        - Each of the three bullets above should be delivered in its **own** message/step (with its own picker where applicable), not concatenated into one combined question.
    2.  **Mechanical Scale & Focus:**
        - Ask for, again as **separate interactive prompts**, in this order:
            1. **Point total target** — single-choice option picker with options: "25", "50", "75", "100", "150", "Same ballpark as PCs", "Irrelevant/Use what fits scene", plus "Other (type your own)".
            2. **Key focus** — multi-select option picker: "Frontline Combat", "Skirmisher/Ranged", "Face/Social", "Investigator", "Scholar/Academic", "Support/Healer", "Utility/Scout", "Non-combatant", plus "Other (type your own)" and "You decide".
            3. **Desired build complexity** — single-choice option picker: "Ultra-quick (few traits, good enough)", "Standard NPC (balanced, readable)", "Detailed (PC-grade)", plus "You decide".
    3.  **World & Power Context (Only When Deviating From Defaults):**
        - First, **summarize inferred campaign defaults** very briefly (tone, power sources, TL, any key boundaries) based on `state.md` and `00_System_Rules.md`.
        - Ask the GM a single, high-level question:
            - **Is this NPC within normal campaign rules, or an exception?** (single-choice): "Within normal campaign rules", "Minor twist but basically on-theme", "Major exception/genre-bending", "You decide"
        - If the GM chooses **Within normal campaign rules**, do **not** re-ask world/power questions; proceed using campaign defaults.
        - If they pick **Minor twist** or **Major exception**, then ask for:
            - **Tone & realism override** (single-choice): "Same as campaign default", "Grittier", "More cinematic", "Over-the-top/gonzo", plus "Other (type your own)" and "You decide"
            - **Power source overrides** (multi-select): "Same as campaign defaults", "Add Magic", "Add Psionics", "Add Divine/Miracles", "Add Superpowers/Meta-traits", "Add Ultra-tech/Biotech", "Strip all supernatural", plus "Other (type your own)"
            - **Tech level anchor override** (single-choice): "Same as campaign default", "One TL higher", "One TL lower", plus “Other (type your own)” and “You decide”
    4.  **Archetype & Template Hints:**
        - Offer a short list of archetypes inferred from `state.md` and recent sessions (e.g., City Guard, Cult Adept, Guild Factor, Street Urchin, Courtier, Monster type) as single-choice plus “Other (type your own)”. Accept a free-form profession/background if the GM prefers to type.
    5.  **Constraints & Content Boundaries:**
        - Start from the campaign’s existing safety tools and content boundaries (from `state.md` or `00_System_Rules.md`) and **assume they apply** unless the GM explicitly marks an exception.
        - Ask for:
            - **Required elements** (free text and/or multi-select keywords, e.g., "Must have Social Stigma", "Must be 100% loyal", "Must be cowardly")
            - **Additional disallowed elements for this NPC** (traits, books, themes to avoid) with a multi-select offering common categories ("No supernatural", "No mind control", "No graphic violence", "No sexual content") plus “Other (type your own)”
            - Any **NPC-specific exceptions** where the GM wants to temporarily bend campaign norms; clearly flag these internally as out-of-bounds choices to be logged later under **Assumptions & Open Questions**.

2.  **Smart Gap Fill Using Defaults:**
    Analyze provided info and identify only what is still missing for a robust NPC build, **respecting the chosen build mode**:
    - For **Quick NPCs**, aggressively minimize questions; only ask about details that would significantly change play (e.g., combat role, obvious signature gear). Otherwise, rely on best-practice defaults and campaign norms.
    - For **Standard NPCs**, ask a moderate number of follow-ups to clarify role, capabilities, and any distinctive hooks, but avoid overwhelming the GM.
    - For **Detailed NPCs**, ask more granular questions where useful (e.g., secondary skills, nuanced social roles, specific cultural details), while still avoiding redundancy with campaign context.
    - In all modes, prefer **short, targeted follow-up questions** using multiple-choice scaffolds (with “Other (type your own)” and “You decide”).
    - Specifically ensure coverage of: signature weapons/armor, combat role, social role, languages/culture, notable contacts, reaction modifiers, signature gear, legal status, constraints/content boundaries, and desired complexity (quick build vs detailed).
    - When the GM chooses “You decide” or skips, propose 2–3 sensible options aligned with `state.md` and `00_System_Rules.md` and ask for quick approval. If they still defer, pick the best-practice default and later record it as an Assumption with a TODO in the NPC file under **Assumptions & Open Questions**.

3.  **Mechanical Generation (RulesLawyer Mode):**
    Switch strictly to the **RulesLawyer** persona. Read `00_System_Rules.md` to ensure no forbidden traits are used. Calculate attributes, advantages, disadvantages, and skills to hit the target point total, scaling detail to the chosen build mode:
    - For **Quick NPCs**, prioritize a small, clear set of traits and skills that capture the concept and role; avoid excessive niche abilities that will not matter in play.
    - For **Standard NPCs**, provide a solid, rounded build suitable for recurring use without going into exhaustive detail.
    - For **Detailed NPCs**, aim for PC-grade completeness where appropriate, within reasonable length for the chat format.
    *Always ensure math is correct*. **Crucial:** You MUST include a mechanical explanation for every Advantage generated, and a **Hit Location DR table** for characters expected to engage in combat, as per the Rules Lawyer's updated response format.

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
