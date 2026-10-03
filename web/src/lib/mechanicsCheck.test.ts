import { describe, it, expect } from "vitest";
import { checkMechanics, primaryAttributes, readSkillLevel } from "./mechanicsCheck";
import { buildTraitIndex, type CatalogueEntry } from "./traitResolver";

const skill = (name: string, difficulty: string): CatalogueEntry =>
  ({ book_id: 1, kind: "skill", name, difficulty, attr: "DX", cost_kind: "formula" });

const INDEX = buildTraitIndex([
  skill("Brawling", "E"),
  skill("Stealth", "A"),
  skill("Occultism", "A"),
]);

describe("reading a skill's level notation", () => {
  it("reads the form that spells the difficulty out", () => {
    expect(readSkillLevel("(DX/A)-14")).toEqual({ attribute: "DX", difficulty: "A", relative: null });
  });

  it("reads the form that gives a relative level", () => {
    expect(readSkillLevel("(DX+1)-13")).toEqual({ attribute: "DX", difficulty: null, relative: 1 });
  });

  it("reads a negative relative level", () => {
    expect(readSkillLevel("(IQ-2)-10")?.relative).toBe(-2);
  });

  it("says nothing about a notation it does not know", () => {
    expect(readSkillLevel("level 14")).toBeNull();
    expect(readSkillLevel("")).toBeNull();
  });
});

describe("attribute costs", () => {
  it("passes a sheet whose attributes are priced correctly", () => {
    const check = checkMechanics({
      attributes: ["ST 11 [10]", "DX 13 [60]", "IQ 12 [40]", "HT 12 [20]"],
    });
    expect(check.findings).toEqual([]);
    expect(check.checked).toBe(4);
  });

  it("reports one that is not", () => {
    const check = checkMechanics({ attributes: ["DX 13 [40]"] });
    expect(check.findings).toHaveLength(1);
    expect(check.findings[0]).toMatchObject({ name: "DX", stated: 40, expected: 60 });
    expect(check.findings[0].because).toContain("20 points a level");
  });

  it("prices a secondary characteristic against the attribute it comes from", () => {
    // HP defaults to ST and costs 2 a point beyond it.
    const check = checkMechanics({ attributes: ["ST 11 [10]", "HP 13 [4]"] });
    expect(check.findings).toEqual([]);
  });

  it("reports a secondary characteristic priced wrongly", () => {
    const check = checkMechanics({ attributes: ["IQ 12 [40]", "Will 14 [5]"] });
    expect(check.findings[0]).toMatchObject({ name: "Will", stated: 5, expected: 10 });
  });

  it("says nothing about a secondary characteristic with no attribute to compare", () => {
    // Without ST on the sheet there is nothing to price HP against.
    const check = checkMechanics({ attributes: ["HP 13 [4]"] });
    expect(check.findings).toEqual([]);
    expect(check.unchecked).toBe(1);
  });

  it("says nothing about a line it does not recognise as an attribute", () => {
    const check = checkMechanics({ attributes: ["Parry N/A [0]"] });
    expect(check.findings).toEqual([]);
    expect(check.unchecked).toBe(1);
  });
});

describe("skill costs", () => {
  it("prices a skill whose notation spells out its difficulty", () => {
    // Stealth (DX/A)-14 with DX 13 is attribute+1, which costs 4 for Average.
    const check = checkMechanics({
      attributes: ["DX 13 [60]"],
      skills: ["Stealth (DX/A)-14 [4]"],
    });
    expect(check.findings).toEqual([]);
    expect(check.checked).toBe(2);
  });

  it("reports a skill priced wrongly", () => {
    const check = checkMechanics({
      attributes: ["DX 13 [60]"],
      skills: ["Stealth (DX/A)-14 [8]"],
    });
    expect(check.findings[0]).toMatchObject({ name: "Stealth", stated: 8, expected: 4 });
    expect(check.findings[0].because).toContain("Average");
  });

  it("takes the difficulty from the catalogue when the notation omits it", () => {
    // "(DX+1)-13" says how far above DX, but not how hard the skill is.
    const check = checkMechanics(
      { attributes: ["DX 12 [40]"], skills: ["Brawling (DX+1)-13 [2]"] }, INDEX);
    expect(check.findings).toEqual([]);   // Easy at +1 costs 2
    expect(check.checked).toBe(2);
  });

  it("claims nothing when no difficulty can be found", () => {
    // Same line, but nothing knows what Brawling is.
    const check = checkMechanics({ attributes: ["DX 12 [40]"], skills: ["Brawling (DX+1)-13 [2]"] });
    expect(check.findings).toEqual([]);
    expect(check.unchecked).toBe(1);
  });

  it("works on attributes alone when there is no rules database", () => {
    const check = checkMechanics({
      attributes: ["DX 13 [40]"],
      skills: ["Brawling (DX+1)-13 [2]"],
    });
    expect(check.findings).toHaveLength(1);
    expect(check.findings[0].name).toBe("DX");
  });

  it("says nothing about a line with no cost", () => {
    const check = checkMechanics({ skills: ["Brawling (DX/E)-13"] }, INDEX);
    expect(check.findings).toEqual([]);
    expect(check.unchecked).toBe(1);
  });
});

describe("reading the sheet's attributes", () => {
  it("picks out the four primaries and ignores the rest", () => {
    expect(primaryAttributes({
      attributes: ["ST 11 [10]", "DX 13 [60]", "HP 11 [0]", "Basic Speed 6.25 [0]"],
    })).toEqual({ ST: 11, DX: 13 });
  });

  it("survives a character with nothing on it", () => {
    expect(primaryAttributes(null)).toEqual({});
    expect(checkMechanics(null).findings).toEqual([]);
  });
});
