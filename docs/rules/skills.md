# Skills

Read from the GM's Basic Set (B167-175, B89-90) on 2026-10-07.

## Implemented

| Rule | Book | In the app |
|---|---|---|
| A skill's price follows from its **difficulty** and the **level bought against its controlling attribute**, by the Skill Cost Table. Beyond +5, each level is +4 points. | B170 | `gurpsRules.skillCost`, `skillRow.priceSkill` |
| The controlling attribute is ST, DX, IQ, HT, Per or Will. | B167-168 | `skillRow.BASES` |
| Difficulties: Easy, Average, Hard, Very Hard. | B168 | `skillRow.DIFFICULTIES` |
| A technological skill is learned at a tech level, written `Name/TL8 (Specialty)`. | B168, B172 | `skillRow.writeSkill` |
| Raising an attribute raises every skill based on it at no extra cost. | B170 | the skill editor's offer when an attribute changes |
| **Talents**: +1 per level to every skill on the Talent's list, even at default, free — the points buy the level without it. At most 4 levels of one Talent; overlapping Talents add. | B89, B174 | `talents.ts`; subtracted in the editor, wizard, chat drafts and checker |
| A Talent costs **5/level for 6 or fewer skills, 10 for 7-12, 15 for 13+**; a skill with several specialties counts once. The book's nine standard Talents follow this rule exactly. | B90 | `talents.talentCostPerLevel` |
| A skill's **default**, as a general rule: attribute −4 if Easy, −5 if Average, −6 if Hard; Very Hard usually none. | B173 | `skillRow.ruleDefault` (campaign skills) |
| A skill the book does not list is the GM's to define; it is priced from the same table. | B174 (entry format) | campaign skills ([0011](../decisions/0011-campaign-skills-and-talents.md)) |

## Not yet implemented

| Rule | Book | Effect today |
|---|---|---|
| **Improving from a default**: a skill whose default (from an attribute or another skill) is high enough to be worth points costs only the difference to raise. | B173 | A second specialty bought up from the first is reported as underpaid; the checker softens it to a note when a better specialty is on the sheet. |
| **Optional specialties**: an Average-or-harder IQ skill may be learned in one narrow field as if one level easier; the general skill then defaults to it at −2. | B169 | Priced at the general skill's difficulty. |
| **Wildcard skills**. | B175 | Not handled; none in the campaign. |
| **Rule of 20**: a default from an attribute above 20 is figured from 20. | B173 | Defaults are not yet used in pricing. |
| **Prerequisites**. | B169 | Not checked. |

## Where the catalogue disagrees with the book

Found by use, to be checked in a catalogue audit against the skill list (B301):

- **Tactics** (B224) is missing.
- **Electronics Operation/TL** and **Electronics Repair/TL** are collapsed into
  one "Electronics (IQ/A)".
- **Smooth Operator** (B91), a Talent, is missing; the app fills it in.
