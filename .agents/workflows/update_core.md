---
description: Update Core From Global Repo
---
# Workflow: Update Core

**Command Trigger:** `/update_core`

## Objective
Update the technical framework from a global core repository release/tag/branch.

## Execution Steps

1. **Run Core Update (Dry Run):**
   Use the configured core source (from `%USERPROFILE%\.gurps-assistant\core-source.json` or `GURPSAI_HOME`), and run:
   `gurpsai update-core -DryRun`

2. **Apply Core Update:**
   If the dry run output looks correct, run:
   `gurpsai update-core`

3. **Conflict Policy (Optional):**
   If conflicts remain and the GM explicitly wants the core to win, rerun with:
   `gurpsai update-core -Force`

4. **Next Step (Required):**
   After the core update completes, run `/actualize` to validate and adjust the currently selected campaign without overwriting its narrative content.

## Advanced Source Overrides (Optional)

If you need to pull core updates from a non-default source, you can replace step 1 with one of these dry-run variants, then repeat without `-DryRun`:

- `gurpsai update-core -RepoUrl "<REPO_URL>" -Ref "<REF>" -DryRun`
- `gurpsai update-core -RepoUrl "<REPO_URL>" -LatestTag -DryRun`
- `gurpsai update-core -CorePath "<CORE_PATH>" -DryRun`
