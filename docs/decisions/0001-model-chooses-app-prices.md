# 0001 — The model chooses, the app prices

**Date:** 2026-10-04 · **Status:** Accepted · **Commits:** b9774cf, acf6523

## Context
Of the campaign's sheets that state a point total, none added up to its own
brackets; the median error was 34%, and a 100-point NPC was 34 over. The cost
of a line is not a property of the line: Guns (Rifle) is priced partly by
whether Guns (Pistol) is on the sheet (B171, B175), a disadvantage by its
self-control number (B123), a skill by a difficulty the book prints and the
sheet does not. A model writing prose cannot hold that graph.

## Decision
A model only ever *chooses*: which trait, at what level, with which specialty,
self-control number or modifiers. The app prices every line and states the
total. The schema a model fills (`CharacterBuild`) has nowhere to put a cost,
which is worth more than any instruction telling it not to.

## Consequences
- Every AI path — the Create Entity wizard, chat drafts, flesh-out — sends
  choices and gets lines priced by `characterBuild.ts`.
- A model-written `[cost]` is reported, never trusted (see 0007).
- What the book does not price with one figure goes to *Left to the GM* in
  plain words, never a guessed number.
