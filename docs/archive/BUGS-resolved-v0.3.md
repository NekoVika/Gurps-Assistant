# Known Bugs

This file contains a list of known bugs discovered during testing or development. 
You can use the `/bug` command (e.g. `/bug The retry button doesn't work on mobile`) to let the AI automatically log new issues here without derailing your current task.

## Unresolved Bugs

*(none currently logged)*

## Resolved Bugs

- `[x]` **GM Chat:** A failed provider call softlocked the session — the error was posted as raw JSON and every later message failed identically, so the only escape was starting a new chat. *(Resolved in v0.3.0 — two causes. The transcript kept the half-finished turn, leaving an assistant `tool_calls` entry whose result never arrived; providers reject that pairing, so the poisoned history failed forever. `ChatService` now prunes orphaned calls/results before dispatch (`prune_orphaned_tool_calls`) and the store rolls the turn back on error. Separately, Gemini's HTTP handler surfaced Google's raw JSON body straight into the panel; it now logs the body and shows one actionable sentence, in a banner with Retry and Dismiss.)*
- `[x]` **GM Chat:** The session selector felt laggy and sometimes selecting a chat did nothing. *(Resolved in v0.3.0 — switching waited on a `getSession` round trip before swapping the transcript even though the session list already carries messages, the whole control cluster was disabled during unrelated session mutations, a failed fetch only reached the console, and concurrent switches could land the wrong transcript. Switching is now instant from the cached list, guarded by a token so a stale response cannot win, and failures surface in the UI.)*
- `[x]` **Campaign Browser:** Newly created Episode ("Test Episode") is created on disk but does not appear in the UI browser. *(Resolved in v0.3.0 — root cause was a cluster of issues: batch stubs wrote to folders the curated registry never rendered (`02_Characters/Cast/`, `04_Factions/`, flat `03_Story/Encounters/`); the sidebar file tree was not refreshed after stub creation; wizard parent-childLink updates never fired due to an answer-key mismatch (`vars["Parent Episode"]` vs field id `ParentEpisode`); and `/campaign/init` produced only markdown stubs invisible to the registry's JSON-only Core Docs bucket. All fixed; the registry also gained an "Unsorted" catch-all section so no file can silently disappear again.)*
