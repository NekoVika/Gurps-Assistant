# Bug Logger Workflow

**Description:** Quickly logs a bug to `BUGS.md` so you can continue your primary task without losing track of issues.

## Steps

1. **Read `BUGS.md`**
   - Use `view_file` to read `BUGS.md` in the repository root. If it doesn't exist, create it.
2. **Append the Bug**
   - Format the user's reported bug as a checklist item under the `## Unresolved Bugs` section.
   - Example format: `- [ ] **[Component/Area]:** [Brief description of the bug]`
   - If the user provides extra context (e.g. error messages, steps to reproduce), add them as indented sub-bullets.
3. **Confirm and Return**
   - Tell the user the bug has been logged.
   - Immediately ask if they want to continue what they were previously doing, to ensure the workflow is non-disruptive.
