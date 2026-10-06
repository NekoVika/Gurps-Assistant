# Backlog

Everything not scheduled for a release. When something is picked up, it moves
into the current release file in [`releases/`](releases/).

## Bugs

Logged by `/bug`. Format: `- [ ] **[Area]:** what goes wrong`, with steps or
errors as sub-bullets.

*(none open — v0.3's resolved bugs are in [`archive/BUGS-resolved-v0.3.md`](archive/BUGS-resolved-v0.3.md))*

## From the GM's 0.5 manual check

- **The review panel reads as a code diff.** Hard for a GM who is not a
  developer. Wanted: a sheet-style review — `+ Combat Reflexes [15]`,
  `Guns (Pistol): 14 → 15` — with the same accept/reject per change.
- **A policy for damaged lines.** The editor now says what it expected, but
  there is no path from a broken line to a good one except retyping it. The GM
  ruled out automatic repair ([0005](decisions/0005-correct-when-written.md));
  what remains to decide is what help, if any, the editor offers.

## Rules and pricing

- **Talent level changes**: offer to move a Talent's skills when its level
  changes, as the editor does for attributes.
- **More books**: extend the catalogue to the books the campaign lists —
  High-Tech, Martial Arts ([0004](decisions/0004-catalogue-from-the-gms-own-books.md)).
- **High Manual Dexterity** (B59) and similar traits that add to some skills —
  check whether they change skill pricing as Talents do.
- **An enforced `draft_character` tool**, if models ignore the prose contract
  ([0009](decisions/0009-chat-contract-in-prose.md)).

## Carried over from 0.4

- Entity-type indicators when two things share a name.
- PCs always visible under focus; the focus rework.
- `region` beside *Inside*.
- Modernise `sync_pc_from_gcs.py`.

## Older ideas

- **Prep Session wizard**: needs a full rethink (deferred since v0.3).
- The original plan, [`archive/TODO-v0.1-to-v0.3.md`](archive/TODO-v0.1-to-v0.3.md),
  has older ideas never triaged — search, session timeline, multi-tab
  workspaces. Many of its unchecked boxes are long done; check before reviving.
