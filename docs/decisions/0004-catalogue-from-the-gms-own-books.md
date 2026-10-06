# 0004 — The catalogue is built from the GM's own PDFs

**Date:** 2026-10-03 · **Status:** Accepted · **Commits:** 261e756, 984beb8

## Context
Pricing needs the book's trait and skill tables. The book is copyrighted.

## Decision
The catalogue (`rules_db/*.sqlite`) is extracted locally from the GM's own PDFs
and is gitignored; nothing of the book ships in the repository. Basic Set
first, then the books the campaign lists (High-Tech, Martial Arts).

## Consequences
- CI tests must not need the rules database.
- Extraction has gaps, found by use: Tactics, Smooth Operator, and Electronics
  Operation/Repair collapsed into one "Electronics". The app fills the standard
  Talents it knows (Smooth Operator) behind the catalogue; the rest is a
  catalogue audit in the backlog.
- Rules text in the app or docs is paraphrased and cited by page.
