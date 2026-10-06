# 0006 — An unpriced line has no bracket; `[0]` is a real cost

**Date:** 2026-10-05 · **Status:** Accepted · **Commits:** acf6523, c168c9a

## Context
Some choices cannot be priced: a name not in the catalogue, a trait the book
prices "Variable". Writing `[0]` would be a guess, and on this sheet a nought
is a real cost — a native language (B23-24), Doesn't Breathe (Gills) (B51).

## Decision
Such a choice stays on the sheet, in its section, with **no bracket** and the
reason as its note: `Curiosity - not priced: this name is in no catalogue`.
The budget counts it as unread and calls the total a floor. Considered and
rejected by the GM: an explicit `[?]` marker.

## Consequences
- No editor may write `[0]` for a cost nobody gave. A trait editor did until
  c168c9a, stamping four onto a test character's sheet in the manual check.
