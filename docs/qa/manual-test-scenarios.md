# Manual Test Scenarios — AnomalyHuntersCampaign (v0.3.0)

Concrete scenarios against the **real campaign**, using real entity names.
Run top to bottom — later scenarios reuse artifacts from earlier ones.
Most write-scenarios operate inside **Episode: Test Episode Sewers**, which is
already a sandbox episode.

> **Before you start:** the campaign folder is NOT in git. Make a copy:
> `Copy-Item -Recurse AnomalyHuntersCampaign AnomalyHuntersCampaign.bak`
> Restore by deleting the folder and renaming the copy back.

Baseline numbers below were captured on 2026-07-19 against the current
campaign state; if you've edited the campaign since, expect small drifts.

---

## 1. Baseline validation (read-only)

**Steps:** Config tab → Run Global Validation.

**Expect:**
- ~106 structural files scanned, **0 schema faults** (red section absent).
- Amber "proposed entities without files" group with **~16 entries**, including:
  - `Missing Hunter (NPC)`, `Horned King Rat (NPC)`, `City Sewers`,
    `Forgotten Pumping Station`, `Anomaly Nest`, and 3 chapters
    (`Chapter 01: Descent into Filth` …) — all from *Test Episode Sewers*
  - 3 encounters (`Flooded Passages Entry`, `Temporal Echo Chamber`,
    `Bulkhead Control Station`) from *The Lower Drains*
  - `Marina` from *The Watcher*'s relations
- **Must NOT appear** (false-positive guards):
  - `Chapter 00`…`Chapter 08` from *Watcher of the Rain* (they reference
    directory names — resolver now aliases `Chapter_01/` etc.)
  - Any `**Dominant Faction:** …` / `**Law & Order:** …` prose from Location
    files (prose is not treated as a reference)

## 2. Ghost rows in Story Arcs (read-only)

**Steps:** Workspace → expand Story Arcs.

**Expect:**
- *Test Episode Sewers* shows 3 amber dashed ghost rows "(proposed)" for its
  three planned chapters, each with a small `+`.
- Under its chapter *The Lower Drains*: 3 ghost rows for the encounters above.
- *Watcher of the Rain* (Episode 03) shows **no ghost rows** — all 9 chapters exist.
- *When They Cry*, *Helen of Troy* render normally.
- An **🗃️ Unsorted** section (collapsed, at the bottom) lists campaign files no
  curated bucket matched — currently `dummy`, `Integrity Report`, `README`.
  These were invisible in older builds; decide whether to keep, move, or trash them.

## 3. Passport proposed cues (read-only)

**Steps:** Open *Test Episode Sewers* → Episode overview passport.

**Expect:**
- Amber banner: "**8 proposed entities have no files yet**" (2 characters +
  3 locations + 3 chapters) with a "Create 8 stubs" button. Don't click yet.
- In the passport body, `Missing Hunter (NPC)`, `City Sewers`, etc. render as
  amber dashed "(proposed)" chips; existing entities render as normal blue links.
- Cross-check: open *Watcher of the Rain* overview — **no banner**.

## 4. One-click stub from a ghost row

**Steps:** In Story Arcs, under *The Lower Drains*, click `+` on the
`Flooded Passages Entry` ghost row → confirm "Create stub".

**Expect:**
- File created at
  `03_Story/Episode_Test_Episode_Sewers/Chapter_The_Lower_Drains/Encounters/Flooded_Passages_Entry.json`.
- Ghost row is replaced by a real (numbered) entry **without page reload**;
  app navigates to the new stub; its title is "Flooded Passages Entry".

## 5. Batch create from the passport banner

**Steps:** Open *Test Episode Sewers* overview → click "Create 8 stubs".

**Expect:**
- Banner disappears; sidebar updates without reload:
  - `Missing Hunter (NPC)`, `Horned King Rat (NPC)` → **Main Cast**
  - `City Sewers`, `Forgotten Pumping Station`, `Anomaly Nest` → **Locations**
  - 3 chapters appear under *Test Episode Sewers* as
    `Chapter_Chapter_01_Descent_into_Filth/` etc. (dir name is derived from the
    full childLink text — cosmetic, titles display correctly)
- Re-run Global Validation: the Test-Episode entries are gone; remaining
  dangling ≈ 5 (encounters you haven't created + Marina + 2 verbose
  storyAppearances on *Sector 4 Municipal Maintenance*).

## 6. Proposed relation → create-stub prompt

**Steps:** Open *The Watcher* (Main Cast). Find `Marina (proposed)` in
relations → click it.

**Expect:**
- Modal: "No file exists for 'Marina' yet. Create a Character stub?" →
  Confirm → `02_Characters/Main_Cast/Marina.json` created, app navigates to it.
- Known behavior (documented, not a bug): Marina's own relations start empty;
  the reciprocal link to The Watcher appears the next time The Watcher's file
  is saved.

## 7. Relation sync (reciprocal links)

**Steps:** Open the `Missing Hunter (NPC)` stub → Edit → add a Character
relation to `Rachel` with text "Handler" → Save.

**Expect:**
- Open *Rachel* → her Character relations now include
  `Missing Hunter (NPC)` / "Handler" (added automatically by relation sync).
- Case-variant guard: add another relation and type `the watcher` (lowercase)
  → it must NOT show a PROPOSED badge (resolves to The Watcher). Remove it
  before saving.

## 8. Rename with reference refactor

**Steps:** Open the `City Sewers` stub (Locations) → Edit → change name to
`City Sewers Deep` → Save.

**Expect:**
- File renamed; *Test Episode Sewers* overview's `locations` array now reads
  `City Sewers Deep` (open the raw JSON to confirm).
- No new dangling entry for it in validation.
- Rename it back the same way.

## 9. Trash lifecycle

**Steps:** Delete the `Anomaly Nest` stub (🗑️ on its passport) → Trashbin tab.

**Expect:**
- Listed in Trashbin → Restore → back in Locations and in the registry
  (no reload needed). Delete again → permanent delete in Trashbin → gone;
  validation shows `Anomaly Nest` as dangling again (referenced but no file).

## 10. Story wizard end-to-end (needs Gemini key)

**Steps:** Story Arcs → + Create → Encounter, Parent Episode
`Episode_Test_Episode_Sewers`, Parent Chapter `Chapter_The_Lower_Drains`,
Name `Temporal Echo Chamber`. Generate with AI.

**Expect:**
- Encounter appears under *The Lower Drains*, replacing its ghost row, in
  childLinks order (it was already listed in the chapter's childLinks, so no
  duplicate is added).
- Chapter overview's `childLinks` unchanged (name already present) — for a NEW
  name, verify it gets appended instead.

## 11. Chat draft flow (needs provider)

**Steps:** In GM chat ask: *"Read the Test Episode Sewers overview and draft a
short encounter file 'Bulkhead Control Station' for chapter The Lower Drains."*
Review the draft diff → Apply.

**Expect:**
- File appears in the sidebar immediately. If the AI picked a non-canonical
  path, it shows under **Unsorted** rather than disappearing.

## 12. Full-cycle re-validation (read-only)

**Steps:** Config → Run Global Validation one last time.

**Expect:** 0 schema faults; dangling reduced to only what you deliberately
left uncreated. Every remaining entry should be something you recognize.

---

## Cleanup

Everything created above lives in the sandbox episode or Main_Cast/Locations:

- Stubs to trash (or keep as real campaign content if useful):
  `Missing Hunter (NPC)`, `Horned King Rat (NPC)`, `Marina`, `City Sewers`,
  `Forgotten Pumping Station`, `Anomaly Nest`, the three
  `Chapter_Chapter_0X_*` folders, `Flooded_Passages_Entry.json`, and anything
  from scenarios 10–11.
- Or restore the whole folder from `AnomalyHuntersCampaign.bak`.
- Remove the relation added to `Missing Hunter` in scenario 7 **before**
  trashing the stub if you want Rachel's reciprocal entry auto-removed.
