---
description: Campaign Healer - Audit and repair campaign integrity
---
# Workflow: Fix (Campaign Healer)

**Command Trigger:** `/fix`

## Objective
To ensure the Campaign folder adheres to high-quality standards, following the `.planning/MAP.md` taxonomy, template structures, and technical integrity. This workflow is "Smart"—it fixes trivial issues automatically and collaborates with the GM on logical or creative gaps.

## Execution Steps

### 1. Comprehensive Audit
Scan the `Campaign/` directory (skipping `Legacy/`) for the following issues:

*   **Taxonomy (MAP Alignment)**: Files in the wrong folders (e.g., a Location in a Chapter folder).
*   **Template Integrity**: Files missing sections defined in `.planning/_templates/`.
*   **Link Integrity**: Broken internal Markdown links or absolute links that should be relative.
*   **Logical Gaps**: 
    - Mention of an NPC or Location in Chapter/Episode text that has no corresponding file in `02_Characters/` or `01_World_Bible/`.
    - `state.md` inconsistencies (e.g., active chapter points to a deleted folder).
    - Timeline contradictions (if detectable).

### 2. Healing Report
Present findings to the GM in a three-tier format:

🟢 **Safe Auto-Fixes** (Will be done automatically):
- Moving files to correct folders per `MAP.md`.
- Converting absolute links to relative links.
- Fixing minor formatting/indentation in templates.

🟡 **Structural Issues** (Requires decision):
- Identified mentions of NPCs/Locations without files.
- **Action**: Offer a list. "I found these: [List]. Should I fast-generate their skeletons or link to `/create_npc`?"

🔴 **Logical Conflicts** (Requires GM input):
- Contradictions in narrative state or broken timeline links.
- **Action**: "I noticed [Conflict]. How should we resolve this to match your vision?"

### 3. Execution Phase

1.  **Perform Auto-Fixes**: Execute all 🟢 items immediately.
2.  **Interactive Healing**: 
    - For 🟡 items: If GM agrees, create skeleton files using correct templates or guide through specialized workflows.
    - For 🔴 items: Engage in a brief dialogue to fix the specific logic gap.
3.  **Final Validation**: Re-run the audit to ensure a "Clean Health" status.

## Rules for AI Agent
- **DO NOT** delete files without explicit confirmation.
- **DO NOT** summarize or lose GM's narrative notes while fixing templates.
- **ALWAYS** use relative links for internal cross-references.
- **NEVER** touch the `Legacy/` directory.
