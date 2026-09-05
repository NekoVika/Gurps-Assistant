# QA Release Checklist

Run this from-scratch script against the **installed build** before tagging a release.
Goal: a GM can prepare a campaign from zero with no dead ends.

## 0. Pre-flight (dev machine)

- [ ] `python -m pytest tests/` — all green
- [ ] `cd web && npx tsc --noEmit && npx vitest run` — all green
- [ ] Version identical in `src/gurpsai/__version__.py`, `setup.py`, `web/package.json`
      (drift breaks `/update/check`)
- [ ] `python scripts/build_alpha.py` completes; installer exe produced

## 1. Install

- [ ] Run `GURPS_Assistant_Setup_v<ver>.exe` on a clean profile (or after uninstall)
- [ ] App launches; header shows the new version; health indicator OK

## 2. Campaign from scratch

- [ ] Browse → select an **empty** folder → Initialize Skeleton
- [ ] Registry immediately shows Core Docs (Campaign State, System Rules,
      Campaign Overview, World Dossier) and section Create buttons
- [ ] Re-running Initialize reports "already complete" and overwrites nothing

## 3. Wizards

- [ ] Create NPC — both AI-generation and manual-stub paths
- [ ] Create Location, create Faction
- [ ] Create Episode → Chapter under it → Encounter under that
- [ ] After each creation the entity appears in the sidebar **without reload**,
      in the correct section
- [ ] Parent overview's `childLinks` gains the new child (open the parent's
      raw JSON to confirm); chapters/encounters are ordered by childLinks

## 4. Proposed / dangling entities (Phase 8)

- [ ] Open a story passport; add a relation or cast entry with a nonexistent
      name in edit mode → amber PROPOSED badge appears
- [ ] Story passport shows the "N proposed entities have no files" banner;
      Create-stubs button materializes them in canonical folders
- [ ] Registry tree shows unresolved childLinks as amber ghost "(proposed)"
      rows; the "+" creates the stub under the right parent
- [ ] Clicking a proposed link in a passport offers "Create stub?" and
      navigates to the new file after confirm
- [ ] Config → Run Global Validation lists dangling references grouped by
      source file; "Create all missing stubs" clears them; re-validate → clean
- [ ] Case/underscore variants (e.g. `The_Watch` vs "the watch") are NOT
      flagged as missing

## 5. Editing, linking, renaming

- [ ] Edit an entity in a structured editor; save; changes persist
- [ ] Add a relation between two existing characters → reciprocal relation
      appears on the counterpart's passport
- [ ] Rename an NPC referenced by a story file → references (including
      relation objects) are refactored; registry updates without reload

## 6. Trash

- [ ] Delete an entity → appears in Trashbin → restore → back in tree
- [ ] Permanent delete removes it from the Trashbin

## 7. Chat assist

- [ ] Ask GM chat to read a file (`read_file`), query rules (`query_rules`)
- [ ] Ask for a new entity via `draft_file` → review diff → apply → file
      appears in tree (in Unsorted if the AI picked a non-canonical path)

## 8. Updater hop

- [ ] On a machine with the **previous** version installed: Check for update
      sees the new GitHub release
- [ ] Apply downloads and silently reinstalls; app relaunches at new version

## Release steps (owner only)

1. Merge `develop` → `main`
2. Tag exactly `v<version>` (updater compares `tag_name.lstrip("v")` against
   `__version__` by string inequality)
3. Create the GitHub release on `NekoVika/Gurps-Assistant` with
   `GURPS_Assistant_Setup_v<ver>.exe` attached (updater requires an asset
   whose name ends with `.exe`)
4. Release notes from BUGS.md / TODO.md deltas
