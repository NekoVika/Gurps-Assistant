import { describe, it, expect } from "vitest";
import {
  readSkill, writeSkill, bookSkill, priceSkill, wasSkillPriced, skillScores,
  relativeLabel, blankSkill, ruleDefault, type SkillRow,
} from "./skillRow";
import { buildIndex } from "./traitAudit";

const index = buildIndex([
  { book_id: 1, kind: "skill", name: "Guns/TL", attr: "DX", difficulty: "E", specialised: true, page: 198 },
  { book_id: 1, kind: "skill", name: "Stealth", attr: "DX", difficulty: "A", page: 222 },
  { book_id: 1, kind: "skill", name: "Armoury/TL", attr: "IQ", difficulty: "A", specialised: true, page: 178 },
  { book_id: 1, kind: "skill", name: "Axe/Mace", attr: "DX", difficulty: "A", page: 208 },
  { book_id: 1, kind: "skill", name: "Observation", attr: "Per", difficulty: "A", page: 211 },
]);
const scores = skillScores(["ST 10 [0]", "DX 12 [40]", "IQ 11 [20]", "HT 11 [10]"]);
const edited = (row: SkillRow, patch: Partial<SkillRow>): SkillRow => ({ ...row, ...patch, raw: undefined });

describe("reading the lines the campaign stores", () => {
  it("reads the notation that states the difficulty", () => {
    const row = readSkill("Guns/TL8 (Pistol) (DX/E)-14 [4] - Sidearm");
    expect(row).toMatchObject({ name: "Guns/TL", tl: "8", specialty: "Pistol", attr: "DX",
      difficulty: "E", level: "14", points: "4", notes: "Sidearm" });
  });

  it("reads the older notation, which states no difficulty", () => {
    expect(readSkill("Axe/Mace (DX+1)-11 [2]")).toMatchObject(
      { name: "Axe/Mace", attr: "DX", difficulty: "", level: "11", points: "2" });
  });

  it("reads a plain attribute label", () => {
    expect(readSkill("Navigation (Rain World) (IQ)-12 [0] - Navigation"))
      .toMatchObject({ name: "Navigation", specialty: "Rain World", attr: "IQ", level: "12", points: "0" });
  });

  it("reads Per and Will as the sheet spells them", () => {
    expect(readSkill("Observation (PER/A)-13 [8]").attr).toBe("Per");
  });

  it("reads a line the app left unpriced as a name and a note", () => {
    expect(readSkill("Diving - at HT+2; not priced: no catalogue entry")).toMatchObject(
      { name: "Diving", level: "", points: "", notes: "at HT+2; not priced: no catalogue entry" });
  });

  it("writes back a line nobody edited exactly as it was, damaged or not", () => {
    for (const line of [
      "Axe/Mace (DX+1)-11 [2]",
      "**Brawling** (DX/E)-14 [4] - **fists**",
      "B ()- [0] - rawling (DX/E)-16 [[4]]",
      "Diving - at HT+2; not priced: no catalogue entry",
    ]) {
      expect(writeSkill(readSkill(line), null)).toBe(line);
    }
  });
});

describe("a line nothing can read", () => {
  it("is reported with its reason, not taken apart", () => {
    const row = readSkill("B ()- [0] - rawling (DX/E)-16 [[4]]");
    expect(row.unreadable).toBe("2 costs on one line");
    expect(row.name).toBe("");
  });

  it("is a normal row once the GM corrects it", () => {
    expect(readSkill("Brawling (DX/E)-16 [4]").unreadable).toBeUndefined();
  });
});

describe("what the book says", () => {
  it("finds the attribute and difficulty, through a specialty and a tech level", () => {
    expect(bookSkill({ name: "Guns/TL", specialty: "Rifle" }, index))
      .toMatchObject({ attr: "DX", difficulty: "E", page: 198 });
  });

  it("has nothing to say about a skill of the GM's own", () => {
    expect(bookSkill({ name: "Rumour-Mongering", specialty: "" }, index)).toBeNull();
  });
});

describe("pricing the level the GM typed", () => {
  const price = (row: SkillRow) => {
    const p = priceSkill(row, scores, bookSkill(row, index));
    if (!wasSkillPriced(p)) throw new Error(p.problem);
    return p;
  };

  it("works the points out from the final level (B172)", () => {
    // DX 12, Guns Easy, 14 is DX+2: 4 points.
    expect(price(edited(blankSkill(), { name: "Guns/TL", specialty: "Pistol", level: "14" })))
      .toMatchObject({ attr: "DX", difficulty: "E", relative: 2, points: 4 });
  });

  it("prices an Average skill at attribute-1 for one point", () => {
    // Walter White's Stealth: DX 12, level 11, 1 point.
    expect(price(edited(blankSkill(), { name: "Stealth", level: "11" })).points).toBe(1);
  });

  it("measures a Per skill against the default when the sheet has no Per line", () => {
    expect(price(edited(blankSkill(), { name: "Observation", level: "12" }))).toMatchObject({ relative: 1, points: 4 });
  });

  it("follows the book's difficulty, not the one a line states", () => {
    // Stealth is Average; a line calling it Hard is a wording problem.
    expect(price({ ...readSkill("Stealth (DX/H)-12 [4]"), raw: undefined }).difficulty).toBe("A");
  });

  it("prices against the line's attribute, so an override is honoured", () => {
    // Abella's Armoury reads DX; the book says IQ. The line's own wins, and
    // the editor shows the book's beside it.
    const row = readSkill("Armoury/TL8 (Small Arms) (DX+1)-13 [4]");
    expect(price(row).attr).toBe("DX");
    expect(bookSkill(row, index)?.attr).toBe("IQ");
  });

  it("prices a skill of the GM's own from the difficulty they chose", () => {
    expect(price(edited(blankSkill(), { name: "Rumour-Mongering", attr: "IQ", difficulty: "A", level: "12" })))
      .toMatchObject({ attr: "IQ", difficulty: "A", relative: 1, points: 4 });
  });

  it("says what is missing rather than guessing", () => {
    const own = edited(blankSkill(), { name: "Rumour-Mongering", level: "12" });
    expect(priceSkill(own, scores, null)).toEqual({ problem: "choose the attribute it is based on" });
    expect(priceSkill({ ...own, attr: "IQ" }, scores, null)).toEqual({ problem: "choose its difficulty" });
  });

  it("has no price below what one point buys", () => {
    // Easy at DX-1 is a default, not something bought.
    expect(price(edited(blankSkill(), { name: "Guns/TL", level: "11" })).points).toBeNull();
  });

  it("labels the level the way the GM reads it", () => {
    expect(relativeLabel("DX", 2)).toBe("DX+2");
    expect(relativeLabel("Per", 0)).toBe("Per");
    expect(relativeLabel("IQ", -1)).toBe("IQ-1");
  });
});

describe("writing an edited line", () => {
  it("uses the notation that states the difficulty", () => {
    const row = edited(readSkill("Axe/Mace (DX+1)-11 [2]"), { level: "12", points: "4" });
    expect(writeSkill(row, bookSkill(row, index))).toBe("Axe/Mace (DX/A)-12 [4]");
  });

  it("writes the tech level where the book's name has one", () => {
    const row = edited(blankSkill(), { name: "Guns", specialty: "Pistol", tl: "8", level: "14", points: "4" });
    expect(writeSkill(row, bookSkill(row, index))).toBe("Guns/TL8 (Pistol) (DX/E)-14 [4]");
  });

  it("writes a skill of the GM's own with the difficulty they chose", () => {
    const row = edited(blankSkill(), { name: "Rumour-Mongering", attr: "IQ", difficulty: "A", level: "12", points: "4" });
    expect(writeSkill(row, null)).toBe("Rumour-Mongering (IQ/A)-12 [4]");
  });

  it("writes no bracket when there is no figure", () => {
    const row = edited(blankSkill(), { name: "Stealth", level: "12" });
    expect(writeSkill(row, bookSkill(row, index))).toBe("Stealth (DX/A)-12");
  });

  it("keeps a name's emphasis and a note's markup", () => {
    const row = edited(readSkill("**Brawling** (DX/E)-14 [4] - **fists**"), { level: "15", points: "8" });
    expect(writeSkill(row, null)).toBe("**Brawling** (DX/E)-15 [8] - **fists**");
  });

  it("reads back what it writes", () => {
    const row = edited(blankSkill(), { name: "Guns/TL", specialty: "Rifle", tl: "8", level: "13", points: "2", notes: "Hunting" });
    const line = writeSkill(row, bookSkill(row, index));
    expect(readSkill(line)).toMatchObject({ name: "Guns/TL", specialty: "Rifle", tl: "8", attr: "DX",
      difficulty: "E", level: "13", points: "2", notes: "Hunting" });
  });
});

describe("a campaign skill", () => {
  const withOwn = buildIndex(
    [{ book_id: 1, kind: "skill", name: "Stealth", attr: "DX", difficulty: "A", page: 222 }],
    [],
    [{ name: "Rumour-Mongering", attr: "IQ", difficulty: "A", defaults: "IQ-5" },
     { name: "Rig Hacking", attr: "IQ", difficulty: "H", tl: true }]);

  it("is found like a book skill, and says where it came from", () => {
    expect(bookSkill({ name: "Rumour-Mongering", specialty: "" }, withOwn))
      .toEqual({ name: "Rumour-Mongering", attr: "IQ", difficulty: "A", page: null, campaign: true, defaults: "IQ-5" });
    expect(bookSkill({ name: "Stealth", specialty: "" }, withOwn)?.campaign).toBe(false);
  });

  it("is priced from the table like any skill", () => {
    const row = { ...blankSkill(), name: "Rumour-Mongering", level: "12" };
    expect(priceSkill(row, scores, bookSkill(row, withOwn))).toMatchObject({ attr: "IQ", difficulty: "A", relative: 1, points: 4 });
  });

  it("is a technological skill when declared as one, whatever the sheet writes", () => {
    const row = { ...blankSkill(), name: "Rig Hacking", tl: "9", level: "11", points: "4" };
    expect(writeSkill(row, bookSkill(row, withOwn))).toBe("Rig Hacking/TL9 (IQ/H)-11 [4]");
    expect(bookSkill({ name: "Rig Hacking/TL", specialty: "" }, withOwn)?.difficulty).toBe("H");
  });
});

describe("the book's general rule for a default (B173)", () => {
  it("is attribute-4, -5 or -6 by difficulty, and none for Very Hard", () => {
    expect(ruleDefault("DX", "E")).toBe("DX-4");
    expect(ruleDefault("IQ", "A")).toBe("IQ-5");
    expect(ruleDefault("IQ", "H")).toBe("IQ-6");
    expect(ruleDefault("IQ", "VH")).toBe("None");
    expect(ruleDefault("", "A")).toBe("");
  });
});
