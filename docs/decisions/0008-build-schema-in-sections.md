# 0008 — A build lists its sections apart; a skill's level is required

**Date:** 2026-10-06 · **Status:** Accepted · **Commits:** c168c9a

## Context
A build was one list of entries with a `kind`, so `level` had to be optional —
attributes and traits have none. Gemini 2.5 Flash then left the level off every
skill that had a specialty (Guns (Pistol), Driving (Automobile)), reproducibly,
and none of them could be priced.

## Decision
`CharacterBuild` lists `attributes`, `advantages`, `disadvantages` and `skills`
separately, each asking only for what applies to it. A skill's `level` and an
attribute's `score` are required, and `propertyOrdering` settles a skill's name
and specialty before its level. A skill's level leaves out any Talent bonus;
the app adds it (0011).

## Consequences
- The Python contract, the wizard schema and the chat description change
  together; field names are pinned in both test suites.
- The page still reads the older `entries` shape.
