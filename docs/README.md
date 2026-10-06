# Project documentation

Where to find what, sorted by how often it changes. Small files with one job
each, so a person or an AI session reads only what the task needs.

| Folder | What it holds | Changes |
|---|---|---|
| [`releases/`](releases/) | One file per release: its goal, what is done, in progress and next, and known issues. **The current one is the project's status.** | Every working session |
| [`backlog.md`](backlog.md) | Everything not scheduled for a release yet, bugs included. `/bug` writes here. | Whenever something comes up |
| [`decisions/`](decisions/) | One record per settled decision: what, why, and what it rules out. Never rewritten — a changed mind is a new record that supersedes the old. | When a decision is made |
| [`rules/`](rules/) | The GURPS rules the app implements, with page citations, and how the app applies them. | When a rule is implemented |
| [`architecture/`](architecture/) | How the app is built and why: codebase map, app system, design philosophy. | When the structure changes |
| [`qa/`](qa/) | Release checklist, manual test scenarios, and each release's manual check. | Per release |
| [`archive/`](archive/) | Superseded plans kept for their history: the original TODO, the rules DB roadmap, the 0.5 handoff. Not maintained. | Never |

What shipped is in [`../CHANGELOG.md`](../CHANGELOG.md), written for the GM.
The AI entry point is [`../AGENTS.md`](../AGENTS.md).

## What stays outside `docs/`

`SYSTEM.md`, `master_philosophy.md`, `.agents/` and `.planning/` (the maps,
`_templates/` and `contracts/`) are the **GMing product**, not project
documentation: the app and its workflows read them by path, and the framework's
`update_core` copies several of them into campaigns. They stay where they are.

## Keeping this current

- At the end of a piece of work, update the current release file: move what
  finished to *Done* with its commit, and say what is next.
- A decision the GM settles gets a record in `decisions/` before the code that
  depends on it is merged.
- An idea or bug that is not for this release goes in `backlog.md`, not in the
  release file.
