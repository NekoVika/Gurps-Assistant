# Core AI Instructions (Assistant-Neutral Root)

## 1. Project Purpose
This is the GURPS GM Assistant System. It helps a human GM run GURPS 4th Edition campaigns using specialized personas, workflows, and standardized folders.

## 2. Mandatory Reading Before Complex Tasks
Read:
- `state.md`
- `master_philosophy.md`
- `.planning/MAP.md`
- `00_System_Rules.md`

If `state.md` or `00_System_Rules.md` is missing in `Campaign/`, create them using templates:
- `.planning/_templates/State_Template.md` → `Campaign/state.md`
- `.planning/_templates/00_System_Rules_Template.md` → `Campaign/00_System_Rules.md`

## 3. Ignored Directories
- The `Legacy/` directory contains unformatted, ongoing campaign notes. **ALL agents and workflows MUST completely ignore the `Legacy/` directory**, EXCEPT when explicitly executing the `.agents/workflows/catch_up.md` workflow.

## 4. State Management
Update `state.md` when:
- `new_campaign` completes (Current Campaign section)
- `prep_session` completes (anticipated next scene)
- Major lore or NPC additions are created (Recent Events)

## 4. Workflows and Personas
- Workflow call: load the matching file in `.agents/workflows/` and execute it step-by-step.
- Persona call: load the matching file in `.agents/agents/` before answering in that mode.

## 5. Location Consolidation
When creating/updating locations, prefer single parent files with hierarchical headers over many fragmented files. Always place new Location files under `01_World_Bible/Locations/` using the Location template, and link to them from Episodes/Chapters as needed. Do not create Location files inside Episode or Chapter folders.

## 6. Character-Centric Design
During planning or narrative generation, consult `02_Characters/PCs/` and incorporate PC traits, strengths, and weaknesses.

## 7. Mechanical Transparency
For generated character sheets (PC/NPC/Bestiary):
- Explain each Advantage briefly for simple traits.
- Provide detailed adjudication for complex/combat/custom traits.

## 8. Language & Localization
- Default response language is English.
- If `Campaign/state.md` sets **Assistant Preferences → Preferred Language** to a specific language (e.g., Ukrainian), use that language for all user-facing chat and summaries.
- Keep file/folder names and system keywords as-is unless the workflow explicitly requires translation.

## 9. Project Integrity & Post-Task Verification
After completing any task, workflow, or file creation, you MUST perform a self-audit to ensure project health:
1.  **File Taxonomy**: Cross-reference `.planning/MAP.md`. Verify that new files are in the correct directories (e.g., Locations belong in `01_World_Bible/`, NOT in Chapter folders).
2.  **Template Adherence**: Ensure all new files strictly follow their respective templates in `.planning/_templates/`.
3.  **Link Integrity**: Verify that all internal markdown links are **relative** and point to files that actually exist.
4.  **State Sync**: Confirm that `state.md` has been updated if the task involved narrative progress, new characters, or significant world changes.
5.  **Detail Preservation**: Double-check that no narrative or mechanical details from the user's prompt were lost during summarization or conversion.
