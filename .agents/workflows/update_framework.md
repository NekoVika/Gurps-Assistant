---
description: Update Core Framework
---
# Workflow: Update Framework

**Command Trigger:** `/update_framework`

## Objective
Advanced/alternative path. To safely apply updates from a shared GURPSAI core bundle into the current repo using a local framework folder, without overwriting campaign-specific content. The **primary** update flow should still be `/update_core` (engine) followed by `/actualize` (campaign).

## Execution Steps

1. **Collect Source Path:**
   Ask for the path to the updated core folder (the one containing `.framework/framework.manifest.json`).

2. **Preview Changes (Dry Run):**
   Run:
   `gurpsai framework-sync -CorePath "<CORE_PATH>" -DryRun`

3. **Apply Update:**
   If the GM approves the dry-run output, run:
   `gurpsai framework-sync -CorePath "<CORE_PATH>"`

4. **Conflict Handling:**
   If conflicts are reported, show the list and ask whether to keep local edits or force overwrite:
   `gurpsai framework-sync -CorePath "<CORE_PATH>" -Force`
   Explain that forced overwrite creates backups in `.framework/backups/<timestamp>/`.

5. **Report Result:**
   Summarize created, updated, skipped, and conflicted files.
