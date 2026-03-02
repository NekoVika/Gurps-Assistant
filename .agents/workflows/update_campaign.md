---
description: One-Command Core Update + Actualize
---
# Workflow: Update Campaign

**Command Trigger:** `/update_campaign`

## Objective
Provide a **convenience wrapper** that runs the full update pipeline in one command: first sync the technical core, then validate campaign consistency. This is a shortcut for manually running `/update_core` followed by `/actualize`.

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
