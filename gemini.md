# Core AI Instructions (Gemini Compatibility)

This file is retained for Gemini compatibility.

Canonical instructions now live in `SYSTEM.md`.

On startup, read:
1. `Campaign/state.json`
2. `SYSTEM.md`
3. `master_philosophy.md`
4. `.planning/MAP.md`
5. `Campaign/00_System_Rules.json`

When a workflow is requested, load the matching file in `.agents/workflows/`.
When a persona is requested, load the matching file in `.agents/agents/`.
