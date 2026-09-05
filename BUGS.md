# Known Bugs

This file contains a list of known bugs discovered during testing or development. 
You can use the `/bug` command (e.g. `/bug The retry button doesn't work on mobile`) to let the AI automatically log new issues here without derailing your current task.

## Unresolved Bugs

*(none currently logged)*

## Resolved Bugs

- `[x]` **Campaign Browser:** Newly created Episode ("Test Episode") is created on disk but does not appear in the UI browser. *(Resolved in v0.3.0 — root cause was a cluster of issues: batch stubs wrote to folders the curated registry never rendered (`02_Characters/Cast/`, `04_Factions/`, flat `03_Story/Encounters/`); the sidebar file tree was not refreshed after stub creation; wizard parent-childLink updates never fired due to an answer-key mismatch (`vars["Parent Episode"]` vs field id `ParentEpisode`); and `/campaign/init` produced only markdown stubs invisible to the registry's JSON-only Core Docs bucket. All fixed; the registry also gained an "Unsorted" catch-all section so no file can silently disappear again.)*
