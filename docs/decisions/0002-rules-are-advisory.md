# 0002 — The rules advise; the GM's price wins

**Date:** 2026-10-04 · **Status:** Accepted · **Commits:** b2507e0, a76ed2c, b076420

## Context
The app now knows what the book charges. It could correct sheets, or refuse
ones that disagree. The GM runs the table, and house prices are normal.

## Decision
The app reports and never corrects or blocks. Where the rules are silent, so is
the app; a finding is a sentence, not a refusal. A price the campaign declares
(System Rules → Custom Traits) is the answer, not the book's — it is the GM's
table. A saved cost is never rewritten unless the GM presses a button.

## Consequences
- Editors show the book's figure beside a disagreeing one, with a *Use N*
  button; they never overwrite it.
- This is about *rules*. *Format* is enforced — see 0005.
