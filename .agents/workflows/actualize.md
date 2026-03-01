---
description: Actualize Campaign After Core Update
---
# Workflow: Actualize

**Command Trigger:** `/actualize`

## Objective
Validate that campaign structure, active state, and legacy copy-mode compatibility remain consistent after a core/framework update.

## Execution Steps

1. **Run Actualization Check:**
   `powershell -ExecutionPolicy Bypass -File .\scripts\actualize-campaign.ps1`

2. **Review Findings:**
   Open the generated report in `.framework/reports/actualize-<timestamp>.md`.

3. **Fix Blocking Issues:**
   Resolve all `ERROR` findings first (missing folders/files, broken state references, broken workflow index links, missing required personas/templates/workflows, missing workflow invocation patterns in `AGENTS.md`).

4. **Handle Warnings:**
   Resolve `WARN` findings if they affect your current session flow.

5. **Finalize:**
   If report status is `PASS`, continue normal GM workflows (`/prep_session`, `/start_session`, etc.).
