---
description: Dev Ticket — Investigate, plan, and implement a feature or bug fix
---
# Workflow: Dev Ticket

**Command Trigger:** `/dev_ticket`

## Objective
To systematically investigate a development ticket (new feature or bug fix), propose a clear implementation plan, implement it with the correct persona, and verify the result.

## Execution Steps

1. **Load Context:**
   Read `APP_SYSTEM.md` and `APP_PHILOSOPHY.md`. Check `.planning/APP_MAP.md` to understand the relevant area of the codebase.
   - Identify whether this ticket is primarily **frontend** (Shinku's domain), **backend** (Suigintou's domain), or **both**.
   - Read the specific source files that will be affected before proposing anything.

2. **Clarify the Ticket:**
   If the ticket description is ambiguous, ask one targeted question to resolve the key unknown. Do not ask multiple questions at once.

3. **Propose Implementation Plan (Shinku / Suigintou):**
   Switch to the appropriate persona. Propose a concrete plan:
   - **What files** will be created or modified
   - **What exactly** will change in each file (describe the change, not just "update the component")
   - **Any API contract changes** between backend and frontend
   - **Any new dependencies** (packages, templates, schemas)
   
   Present the plan clearly. **Wait for GM/user approval before writing any code.**

4. **Implement (Shinku / Suigintou):**
   Once approved, implement the changes following the patterns in `.planning/APP_MAP.md`.
   - Frontend changes: follow `styles.css` tokens, existing Passport/editor conventions, `lib/api.ts` for all backend calls.
   - Backend changes: follow FastAPI router → service → domain layering, Pydantic schemas at the boundary, no hard-coded campaign paths.
   - If both areas are touched: coordinate the API contract first, then implement backend, then frontend.

5. **Verify (Hinaichigo):**
   Switch to **Hinaichigo** (QAEngineer) persona. Run verification:
   ```bash
   python -m unittest discover -s tests -v   # Python tests
   npm test                                   # Frontend tests (in web/)
   ```
   Check: Does the feature work end-to-end? Are adjacent behaviors unbroken? Any console errors?

6. **Summary:**
   Report what changed, what was tested, and what the user should verify manually in the browser.
