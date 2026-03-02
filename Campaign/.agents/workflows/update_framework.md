---
description: Update Core Framework
---
# Workflow: Update Framework

**Command Trigger:** `/update_framework`

## Objective
To safely apply updates from the shared GURPSAI core into the current campaign folder without overwriting campaign-specific content.

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
