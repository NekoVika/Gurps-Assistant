---
description: Deterministic Campaign validator (no AI) + report
---
# Workflow: Validate (Campaign Validator)

**Command Trigger:** `/validate`

## Objective
Run a purely mechanical validator over `Campaign/` Markdown files to detect template/contract structural drift (missing required sections, missing/forbidden meta keys, etc.) and produce a report under `Campaign/_reports/`.

## Execution Steps

1. Run the validator script:
   - `powershell -ExecutionPolicy Bypass -File scripts/validate.ps1`
2. Review the latest report in `Campaign/_reports/`:
   - `validation-*.md` for quick reading
   - `validation-*.json` for machine parsing / future fixer automation

## Notes
- This validator does not use AI and does not modify campaign files.
- Contracts live in `.planning/contracts/` and are versioned independently from `.planning/_templates/`.

