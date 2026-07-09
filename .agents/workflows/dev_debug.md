---
description: Dev Debug — Systematic backend or frontend debugging
---
# Workflow: Dev Debug

**Command Trigger:** `/dev_debug`

## Objective
To systematically isolate, diagnose, and fix a bug in the GurpsAI application — whether it's in the Python backend, the React frontend, or the connection between them.

## Execution Steps

1. **Reproduce (Hinaichigo):**
   Switch to **Hinaichigo** (QAEngineer) persona. Establish exact reproduction steps:
   - What action triggers the bug?
   - What is the **expected** behavior?
   - What is the **actual** behavior (error message, wrong output, crash, etc.)?
   - Does it happen every time, or only under specific conditions?

2. **Scope the Bug:**
   Determine whether this is a **frontend**, **backend**, or **integration** issue:
   
   | Signal | Likely Location |
   |--------|----------------|
   | Browser console error, React crash, wrong UI state | Frontend (Shinku) |
   | 4xx/5xx HTTP response, backend exception in logs | Backend (Suigintou) |
   | Backend returns success but frontend shows wrong data | Integration / API contract |
   | Campaign file saved incorrectly or not at all | Backend (files service) |
   | Validation passes but shouldn't (or fails and shouldn't) | Backend (domain models / Pydantic) |
   
   Check: browser DevTools console + Network tab, and the `gurpsai serve` terminal output.

3. **Isolate (Shinku or Suigintou):**
   Switch to the appropriate persona based on scope.
   - **Frontend:** Read the relevant component(s). Trace the data flow from API call → state → render. Find the exact line or condition causing the issue.
   - **Backend:** Read the relevant router → service → domain path. Check the request payload, service logic, and response shape. Use the `gurpsai serve --reload` log for stack traces.
   - **Integration:** Check that `web/src/lib/types.ts` and the backend Pydantic schema are in sync. Check `api.ts` for the exact request being sent.

4. **Propose the Fix:**
   Before writing any code, explain:
   - What is wrong and why
   - What the fix is and where it goes
   - Whether adjacent behavior could be affected
   
   **Wait for approval.**

5. **Implement the Fix:**
   Make the minimal change needed to fix the bug. Do not refactor unrelated code in the same edit.

6. **Verify (Hinaichigo):**
   After the fix:
   ```bash
   python -m unittest discover -s tests -v   # Backend tests
   npm test                                   # Frontend tests (in web/)
   ```
   Also manually reproduce the original bug scenario and confirm it's resolved.
   Check that adjacent features still work (e.g., if you fixed file saving, check that file reading is still correct).

7. **Report:**
   Summary:
   - What was wrong
   - What changed (file + line)
   - How it was verified
   - Anything to watch for going forward
