# 0011 — Campaign skills and Talents are declared once and priced by rule

**Date:** 2026-10-07 · **Status:** Accepted · **Commits:** 41a1567 (skills), 9025aad (Talents)

## Context
Read from the GM's Basic Set: a skill's price follows entirely from its
difficulty and the level bought against its attribute (B170), and its default
follows a general rule (B173). A Talent's price follows entirely from how many
skills it covers — 5, 10 or 15 points a level (B90) — and its bonus is free for
those skills (B89). So both are *determined*, not chosen, once their inputs are.

## Decision
- **Campaign skills** are declared in System Rules → `customSkills` with what
  the book prints for its own (attribute, difficulty, default, TL, specialty),
  and priced on every sheet like book skills. A skill of the GM's own on a sheet
  offers *Make it a campaign skill*.
- **Campaign Talents** are declared in `customTalents` by name and skill list;
  the cost per level is shown, never typed. A campaign may redefine a standard
  Talent's list.
- **Talent bonuses** are subtracted before the Skill Cost Table everywhere: the
  editor, the wizard, chat drafts and the checker.
- Custom Traits no longer offers a "skill" kind.
