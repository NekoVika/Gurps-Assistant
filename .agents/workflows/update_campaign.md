---
description: One-Command Core Update + Actualize
---
# Workflow: Update Campaign

**Command Trigger:** `/update_campaign`

## Objective
Run the full update pipeline in one command: sync technical core, then validate campaign consistency.

## Execution Steps

1. **Dry Run First:**
   `powershell -ExecutionPolicy Bypass -File .\scripts\update-campaign.ps1 -DryRun`

2. **Apply Full Update:**
   `powershell -ExecutionPolicy Bypass -File .\scripts\update-campaign.ps1`

3. **Conflict Override (Optional):**
   If approved by GM:
   `powershell -ExecutionPolicy Bypass -File .\scripts\update-campaign.ps1 -Force`

4. **Review Report:**
   Open `.framework/reports/actualize-<timestamp>.md` and resolve any `ERROR` findings.
