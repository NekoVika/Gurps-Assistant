---
description: Campaign Healer - Validator-driven, step-by-step fixer
---
# Workflow: Fix (Campaign Healer)

**Command Trigger:** `/fix`

## Objective
Use the latest validator report in `Campaign/_reports/` and fix issues **one at a time**, always explaining the intended change to the GM **before** editing files.

Two styles are supported:
- **Mechanical fix:** insert template placeholders only (safe, non-destructive).
- **AI fix:** use local file context to fill missing structure more intelligently, but never invent or overwrite GM-provided narrative notes.

## Execution Steps

### 1. Prepare Inputs (Validator-Driven)
1. Run `/validate` (or run `scripts/validate.ps1`) to generate a fresh report.
2. Open the latest `Campaign/_reports/validation-*.json` (machine-readable) and `validation-*.md` (human-readable).
3. Create an ordered list of findings:
   - Errors first, then warnings
   - Stable order: by file path, then line (if present), then code

### 2. Step-by-step Fix Loop (One Issue at a Time)
For each finding, repeat the following loop **without skipping ahead**:

1. **Show the issue**
   - File path + (line if present)
   - Contract id (if present)
   - Code + message

2. **Explain the proposed change (no file edits yet)**
   - State what will be added/changed/removed and *why* it satisfies the contract.
   - State whether this is **Mechanical** or **AI** style.
   - Promise non-destructive behavior: preserve existing content; append missing sections; never summarize GM notes.

3. **Ask for GM approval**
   - “Apply this exact change?”
   - If GM says **No**, propose an alternative (or mark as deferred) and move on.
   - If GM says **Yes**, apply the edit.

4. **Apply the change**
   - Make the minimal edit necessary.
   - Prefer inserting the missing template section using `.planning/_templates/` as the source of structure.

5. **Re-validate and continue**
   - Re-run `/validate` (or re-check the relevant file) to ensure the specific issue is resolved.
   - Proceed to the next finding in order.

### 3. Categories (How to Handle)
- **Template/Contract drift (missing headings/meta):** Prefer append-only or insert-before-next-heading fixes.
- **Taxonomy / MAP alignment:** Propose the move, ask approval, then move.
- **Links:** Fix broken relative links without changing narrative text.
- **Logical gaps / missing entities:** Ask whether to (a) create a skeleton via template, (b) run the dedicated workflow (e.g. `/create_npc`), or (c) leave as-is.

## Rules for AI Agent
- **DO NOT** delete files without explicit confirmation.
- **DO NOT** summarize or lose GM's narrative notes while fixing templates.
- **ALWAYS** use relative links for internal cross-references.
- **NEVER** touch the `Legacy/` directory.
- **ALWAYS** fix only one finding per approval (step-by-step).

