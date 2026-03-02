---
description: One-Command Core Update + Actualize
---
# Workflow: Update Campaign

**Command Trigger:** `/update_campaign`

## Objective
Run the full update pipeline in one command: sync technical core, then validate campaign consistency.

## Execution Steps

1. **Dry Run First:**
   `gurpsai update-campaign -DryRun`

2. **Apply Full Update:**
   `gurpsai update-campaign`

3. **Conflict Override (Optional):**
   If approved by GM:
   `gurpsai update-campaign -Force`

4. **Review Report:**
   Open `.framework/reports/actualize-<timestamp>.md` and resolve any `ERROR` findings.
