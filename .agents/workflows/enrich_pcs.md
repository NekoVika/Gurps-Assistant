---
description: Enrich PC sheets with AI-friendly mechanical notes (Step 2)
---
# Workflow: Enrich PC Sheets (AI Notes)

**Command Trigger:** `/enrich_pcs` or `run enrich_pcs workflow`

## Objective
Augment PC Markdown files in `Campaign/02_Characters/PCs/` with **AI/GM-readable mechanical explanations** for:
- Advantages & Perks
- Disadvantages & Quirks
- Key Skills (and optionally key gear/weapons)

This workflow MUST preserve deterministic sync blocks generated from `.gcs` files by writing explanations as **nested note bullets** directly under each item (the sync script preserves these across re-syncs).

## Hard Rules (Do Not Violate)
1. **Never change the canonical stat lines inside any generated blocks:**
   - Between `<!-- GURPSAI:BEGIN GCS:* -->` and `<!-- GURPSAI:END GCS:* -->`, do not alter the list item lines like `*   **Danger Sense** [15]`.
   - You MAY add nested note bullets directly under an item (4-space indented).
2. **Never rewrite, translate, or “clean up” GM-provided narrative notes**, especially `## GM Summary (Raw Archive)`.
3. **No stat changes:** Do not change point costs, levels, equipment quantities, or trait names in the generated blocks. If something looks wrong, raise it as a question to the GM instead.
4. **No duplicate stat lists:** Do not copy/re-list Advantages/Skills/etc. into another “second sheet”. The canonical lists remain in the GCS-generated blocks; this workflow adds *explanations keyed to those items*.

## Execution Steps

1. **Select scope (GM choice):**
   - Enrich **one** PC file, or **all** PCs in `Campaign/02_Characters/PCs/` (excluding `_source/`).

2. **Load PC file(s) and extract the canonical lists (read-only):**
   From the generated blocks in each PC file, extract:
   - Advantages & Perks list
   - Disadvantages & Quirks list
   - Skills list (include point spends where present)
   - Gear list (optional)

3. **Decide enrichment depth (GM choice):**
   - **Light:** Explain all Advantages/Disadvantages; explain only the top ~6 skills by points + any combat skills.
   - **Standard (recommended):** Explain all Advantages/Disadvantages; explain top ~10 skills by points + combat skills + any “weird” skills.
   - **Deep:** Explain all Advantages/Disadvantages; explain every listed skill (shorter per-skill notes).

4. **Prepare a patch plan (no writing yet):**
   For each PC, propose adding/updating **nested note bullets directly under items** in the generated blocks.

   Format (example):
   - A canonical line (unchanged): `*   **Danger Sense** [15]`
   - Followed by nested notes (added/updated):  
     `    - AI: In play: ...`  
     `    - AI: Edge cases: ...`

   Notes MUST be indented by 4 spaces to stay attached to the list item.

5. **Generate explanations (RulesLawyer mode):**
   - Use concise, table-useful phrasing: “In play: …”, “Common rolls: …”, “Edge cases: …”.
   - For standard traits/skills: provide a 1–4 line explanation.
   - For any custom/anomalous trait: add a `TODO (GM)` line asking for the specific table ruling to avoid hallucinating.
   - If you can’t be confident, prefer *questions* over assertions.

6. **Merge policy (idempotent updates):**
   - Treat any 4-space-indented bullets under an item as that item’s notes.
   - Update existing `AI:` bullets in-place; do not delete GM-authored nested bullets (prefer prefix `GM:`).
   - Keep notes short (bullet points preferred) and table-useful.

7. **GM confirmation:**
   Show a summary of what will change per PC (which files, which sections). Ask approval.

8. **Write changes:**
   Apply the edits to the selected PC file(s).
