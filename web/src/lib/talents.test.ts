import { describe, it, expect } from "vitest";
import { talentBonuses, talentCostPerLevel, talentsIn, STANDARD_TALENTS } from "./talents";
import { buildIndex } from "./traitAudit";
import { resolveTrait } from "./traitResolver";
import { checkMechanics } from "./mechanicsCheck";
import { sheetFromBuild } from "./generatedSheet";
import { prepareCharacterDraft } from "./characterDraft";

/** Arthur Vance as the campaign stores him, trimmed. */
const arthur = {
  attributes: ["DX 11 [20]", "IQ 14 [80]"],
  advantages: ["Mathematical Ability 2 [20] - +2 to Accounting, Finance, etc."],
  skills: ["Accounting (IQ/H)-16 [4] - Includes +2 from Math Ability", "Merchant (IQ/A)-14 [2]"],
};
const index = buildIndex([
  { book_id: 1, kind: "skill", name: "Accounting", attr: "IQ", difficulty: "H" },
  { book_id: 1, kind: "skill", name: "Merchant", attr: "IQ", difficulty: "A" },
  { book_id: 1, kind: "skill", name: "Finance", attr: "IQ", difficulty: "H" },
  { book_id: 1, kind: "advantage", name: "Mathematical Ability", cost_text: "10/level", cost_kind: "per_level", cost_value: 10, page: 90 },
]);

describe("what a Talent costs (B90)", () => {
  it("is set by how many skills it covers", () => {
    const n = (k: number) => Array.from({ length: k }, (_, i) => `Skill ${i}`);
    expect(talentCostPerLevel(n(6))).toBe(5);
    expect(talentCostPerLevel(n(7))).toBe(10);
    expect(talentCostPerLevel(n(12))).toBe(10);
    expect(talentCostPerLevel(n(13))).toBe(15);
    expect(talentCostPerLevel([])).toBeNull();
  });

  it("counts a skill with several specialties once, and ignores tech level", () => {
    expect(talentCostPerLevel(["Survival (Arctic)", "Survival (Desert)", "Engineer/TL8", "Engineer"])).toBe(5);
  });

  it("agrees with the figure the book prints for every standard Talent", () => {
    // The size rule, applied to the book's own lists, gives the book's own
    // prices: the rule and the examples check each other.
    for (const t of STANDARD_TALENTS) expect(talentCostPerLevel(t.skills)).toBe(t.perLevel);
  });
});

describe("the bonus a Talent gives its skills (B89)", () => {
  it("reads the Talent and its level from the sheet's own line", () => {
    const bonusFor = talentBonuses(arthur.advantages);
    expect(bonusFor("Accounting")).toEqual({ bonus: 2, from: [{ name: "Mathematical Ability", levels: 2 }] });
    expect(bonusFor("Merchant").bonus).toBe(0);
  });

  it("adds overlapping Talents", () => {
    const bonusFor = talentBonuses(["Mathematical Ability 2 [20]", "**Business Acumen** 1 [10]"]);
    expect(bonusFor("Accounting").bonus).toBe(3);
    expect(bonusFor("Merchant").bonus).toBe(1);
  });

  it("counts a Talent written without a level as one", () => {
    expect(talentBonuses(["Green Thumb [5]"])("Gardening").bonus).toBe(1);
  });

  it("honours a specialty where the book names one", () => {
    const bonusFor = talentBonuses(["Musical Ability 1 [5]"]);
    expect(bonusFor("Group Performance", "Conducting").bonus).toBe(1);
    expect(bonusFor("Group Performance", "Choreography").bonus).toBe(0);
    expect(bonusFor("Musical Instrument", "Guitar").bonus).toBe(1);
  });

  it("ignores a tech level on the skill", () => {
    expect(talentBonuses(["Artificer 1 [10]"])("Engineer/TL8", "Civil").bonus).toBe(1);
  });
});

describe("Talents the catalogue does not have", () => {
  it("knows Smooth Operator, which the extraction dropped (B91)", () => {
    const found = resolveTrait("Smooth Operator", index, "advantage").entry;
    expect(found).toMatchObject({ cost_kind: "per_level", cost_value: 15, page: 91 });
  });

  it("prices a campaign Talent from its skill list, and gives its skills the bonus", () => {
    const own = buildIndex([], [], [], [{ name: "Rig Sense", skills: ["Mechanic", "Electrician", "Scrounging"] }]);
    expect(resolveTrait("Rig Sense", own, "advantage").entry).toMatchObject({ cost_value: 5, campaign: true });
    expect(talentBonuses(["Rig Sense 2 [10]"], talentsIn(own))("Scrounging").bonus).toBe(2);
  });

  it("lets the campaign redefine a standard Talent's list", () => {
    const own = buildIndex([], [], [], [{ name: "Healer", skills: ["First Aid", "Diagnosis", "Herb Lore"] }]);
    const bonusFor = talentBonuses(["Healer 1 [5]"], talentsIn(own));
    expect(bonusFor("Herb Lore").bonus).toBe(1);
    expect(bonusFor("Surgery").bonus).toBe(0);
  });
});

describe("every pricing path counts the Talent", () => {
  it("the checker: Arthur's Accounting is correctly paid, not underpaid", () => {
    const out = checkMechanics(arthur, index);
    expect(out.findings.filter(f => /Accounting/.test(f.raw))).toEqual([]);
    // Without the Talent the same line would be wrong, and is reported.
    const without = checkMechanics({ ...arthur, advantages: [] }, index);
    expect(without.findings.some(f => /Accounting/.test(f.raw))).toBe(true);
  });

  it("the wizard: the level bought, raised by the Talent on the line", () => {
    const sheet = sheetFromBuild({
      attributes: [{ name: "IQ", score: 14 }],
      advantages: [{ name: "Mathematical Ability", levels: 2 }],
      skills: [{ name: "Accounting", level: "IQ" }],
    }, index);
    expect(sheet.advantages).toContain("Mathematical Ability 2 [20]");
    expect(sheet.skills).toEqual(["Accounting (IQ/H)-16 [4]"]);
  });

  it("a chat draft: a Talent added in the same draft raises its skill", () => {
    const { content } = prepareCharacterDraft(JSON.stringify({
      ...arthur, advantages: [],
      build: { advantages: [{ name: "Mathematical Ability", levels: 2 }], skills: [{ name: "Finance", level: "IQ" }] },
    }), JSON.stringify({ ...arthur, advantages: [] }), index);
    expect(JSON.parse(content).skills).toContain("Finance (IQ/H)-16 [4]");
  });
});
