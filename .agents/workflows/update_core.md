---
description: Update Core From Global Repo
---
# Workflow: Update Core

**Command Trigger:** `/update_core`

## Objective
Update the technical framework from a global core repository release/tag/branch.

## Execution Steps

1. **Select Source Mode:**
   Prefer configured mode (if `.framework/core-source.json` exists). Otherwise choose one:
   - Core repository URL + target ref (tag/branch), or latest tag
   - Local core path

2. **Preview Update:**
   Run one:
   `powershell -ExecutionPolicy Bypass -File .\scripts\update-core.ps1 -DryRun`
   `powershell -ExecutionPolicy Bypass -File .\scripts\update-core.ps1 -RepoUrl "<REPO_URL>" -Ref "<REF>" -DryRun`
   `powershell -ExecutionPolicy Bypass -File .\scripts\update-core.ps1 -RepoUrl "<REPO_URL>" -LatestTag -DryRun`
   `powershell -ExecutionPolicy Bypass -File .\scripts\update-core.ps1 -CorePath "<CORE_PATH>" -DryRun`

3. **Apply Update:**
   If approved, run the same command without `-DryRun`.

4. **Conflict Policy:**
   If conflicts remain and the GM wants core to win, run:
   add `-Force` to the chosen command.

5. **Next Step:**
   Recommend running `/actualize` to validate campaign integrity after update.
