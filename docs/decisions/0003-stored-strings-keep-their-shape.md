# 0003 — Sheets keep the string format they have

**Date:** 2026-10-03 · **Status:** Accepted · **Commits:** 76e450c, acf6523

## Context
Mechanical lines are stored as strings — `Name (Base)-Level [Points] - Notes`.
Structured data would be easier to price, but would mean migrating every
campaign the GM owns.

## Decision
No migration. The app reads the existing strings as arithmetic and renders its
own structured choices *into* the same notation. Lines nobody edits are written
back byte for byte.

## Consequences
- `render()` and `parseEntry()` are tested to round-trip each other.
- An edited skill line is written in the form that cannot contradict itself,
  `(DX/A)-12`; untouched lines keep the older `(DX+1)-11` (see 0010).
- The renderer is the first half of a migration, if one is ever wanted.
