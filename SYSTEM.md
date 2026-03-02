# Core AI Instructions (Assistant-Neutral Root)

## 1. Project Purpose
This is the GURPS GM Assistant System. It helps a human GM run GURPS 4th Edition campaigns using specialized personas, workflows, and standardized folders.

## 2. Mandatory Reading Before Complex Tasks
Read:
- `state.md`
- `master_philosophy.md`
- `.planning/MAP.md`
- `00_System_Rules.md`

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
When creating/updating locations, prefer single parent files with hierarchical headers over many fragmented files.

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
