import { describe, it, expect } from "vitest";
import { checkMechanics, primaryAttributes, readSkillLevel } from "./mechanicsCheck";
import { buildTraitIndex, type CatalogueEntry } from "./traitResolver";
import { buildIndex } from "./traitAudit";

const skill = (name: string, difficulty: string): CatalogueEntry =>
  ({ book_id: 1, kind: "skill", name, difficulty, attr: "DX", cost_kind: "formula" });

const INDEX = buildTraitIndex([
  skill("Brawling", "E"),
  skill("Stealth", "A"),
  skill("Occultism", "A"),
]);

describe("reading a skill's level notation", () => {
  it("reads the form that spells the difficulty out", () => {
    expect(readSkillLevel("(DX/A)-14")).toEqual(
      { attribute: "DX", difficulty: "A", relative: null, absolute: 14 });
  });

  it("reads the form that gives a relative level", () => {
    // Both numbers are kept: the label is a claim about the level, and when the
    // two disagree the level is the one that gets rolled against.
    expect(readSkillLevel("(DX+1)-13")).toEqual(
      { attribute: "DX", difficulty: null, relative: 1, absolute: 13 });
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

describe("advantage and disadvantage costs", () => {
  const CATALOGUE = buildTraitIndex([
    { book_id: 1, kind: "advantage", name: "Combat Reflexes", cost_kind: "flat", cost_value: 15 },
    { book_id: 1, kind: "advantage", name: "Insubstantiality", cost_kind: "flat", cost_value: 80 },
    { book_id: 1, kind: "advantage", name: "Damage Resistance", cost_kind: "per_level", cost_value: 5 },
    { book_id: 1, kind: "advantage", name: "Allies", cost_kind: "variable", cost_value: null },
    { book_id: 1, kind: "disadvantage", name: "Bad Temper", cost_kind: "flat", cost_value: -10 },
  ]);

  it("passes a plain trait priced as the book prices it", () => {
    const check = checkMechanics({ advantages: ["Combat Reflexes [15]"] }, CATALOGUE);
    expect(check.findings).toEqual([]);
    expect(check.checked).toBe(1);
  });

  it("reports one priced differently", () => {
    const check = checkMechanics({ advantages: ["Combat Reflexes [20]"] }, CATALOGUE);
    expect(check.findings[0]).toMatchObject({ name: "Combat Reflexes", stated: 20, expected: 15 });
  });

  it("prices a modified trait from its base and its percentages", () => {
    // Straight off Lambdadelta's sheet: 80 base at +60% is 128.
    const check = checkMechanics({
      advantages: ["Insubstantiality (Affect Substantial, +100%; Always On, -50%; Switchable, +10%) [128]"],
    }, CATALOGUE);
    expect(check.findings).toEqual([]);
  });

  it("prices a levelled trait by the level written into its name", () => {
    // Damage Resistance 50 at 5/level is 250, and +20% makes 300.
    const check = checkMechanics({
      advantages: ["Damage Resistance 50 (Force Field, +20%) [300]"],
    }, CATALOGUE);
    expect(check.findings).toEqual([]);
  });

  it("explains a modified cost in terms of its base and net percentage", () => {
    const check = checkMechanics({
      advantages: ["Insubstantiality (Always On, -50%) [50]"],
    }, CATALOGUE);
    expect(check.findings[0].because).toContain("80 base at -50% comes to 40");
  });

  it("claims nothing about a trait the book prices as Variable", () => {
    const check = checkMechanics({ advantages: ["Allies [20]"] }, CATALOGUE);
    expect(check.findings).toEqual([]);
    expect(check.unchecked).toBe(1);
  });

  it("claims nothing about a trait no book contains", () => {
    const check = checkMechanics({ advantages: ["Rot-Sense [12]"] }, CATALOGUE);
    expect(check.findings).toEqual([]);
    expect(check.unchecked).toBe(1);
  });

  it("checks nothing in these sections without a catalogue", () => {
    const check = checkMechanics({ advantages: ["Combat Reflexes [20]"] });
    expect(check.findings).toEqual([]);
  });
});

/**
 * The five classes the GM's own triage found.
 *
 * Every case here is a line from Anomaly Hunters that the checker reported and
 * should not have, or reported for the wrong reason. They are kept verbatim,
 * because the point of each is that the sheet was already right.
 */
describe("lines the sheet got right and the checker did not", () => {
  const index = buildIndex([
    { book_id: 1, kind: "disadvantage", name: "Bad Temper", cost_text: "-10*",
      cost_kind: "flat", cost_value: -10, self_control: true },
    { book_id: 1, kind: "disadvantage", name: "Berserk", cost_text: "-10*",
      cost_kind: "flat", cost_value: -10, self_control: true },
    { book_id: 1, kind: "advantage", name: "Flight", cost_text: "40",
      cost_kind: "flat", cost_value: 40 },
    { book_id: 1, kind: "advantage", name: "Warp", cost_text: "100",
      cost_kind: "flat", cost_value: 100 },
    { book_id: 1, kind: "advantage", name: "Eidetic Memory", cost_text: "5",
      cost_kind: "flat", cost_value: 5 },
    { book_id: 1, kind: "advantage", name: "Photographic Memory", cost_text: "10",
      cost_kind: "flat", cost_value: 10 },
    { book_id: 1, kind: "skill", name: "Axe/Mace", attr: "DX", difficulty: "A" },
    { book_id: 1, kind: "skill", name: "Guns/TL", attr: "DX", difficulty: "E", specialised: true },
    { book_id: 1, kind: "skill", name: "Explosives/TL", attr: "IQ", difficulty: "A", specialised: true },
  ]);

  const sheet = (over: Record<string, unknown>) => ({
    name: "Subject", attributes: ["ST 10 [0]", "DX 11 [20]", "IQ 11 [20]", "HT 10 [0]"],
    advantages: [], disadvantages: [], skills: [], ...over,
  });

  it("applies a self-control number to the printed cost (B123)", () => {
    // -10 x 1.5 = -15, and the book writes the number this way itself (B461).
    const out = checkMechanics(sheet({ disadvantages: ["Bad Temper (9) [-15]"] }), index);
    expect(out.findings).toEqual([]);
  });

  it("doubles a cost at a self-control number of 6", () => {
    const out = checkMechanics(sheet({
      disadvantages: ["Berserk (6) (Modified) [-20] - very easy to trigger"] }), index);
    expect(out.findings).toEqual([]);
  });

  it("still reports a self-control trait priced at neither multiple", () => {
    const out = checkMechanics(sheet({ disadvantages: ["Bad Temper (9) [-40]"] }), index);
    expect(out.findings).toHaveLength(1);
    expect(out.findings[0].because).toContain("self-control number of 9");
  });

  it("declines to price a qualifier it cannot value, instead of charging the base", () => {
    // Winged is -25% (B58), printed inside Flight's own entry rather than in
    // the modifier table, so 40 x 0.75 = 30 is right and unprovable here.
    const out = checkMechanics(sheet({ advantages: ["Flight (Winged) [30] - Air Move 12."] }), index);
    expect(out.findings).toEqual([]);
    expect(out.notes).toHaveLength(1);
    expect(out.notes[0].because).toContain("may be right");
  });

  it("declines when the modifiers are priced in the note rather than the brackets", () => {
    const out = checkMechanics(sheet({
      advantages: ["Warp [350] - Cosmic, No Die Roll Required, +100%, Exospatial, +50%"] }), index);
    expect(out.findings).toEqual([]);
    expect(out.notes[0].because).toContain("written in the note");
  });

  it("declines when a list names modifiers and values none of them", () => {
    // Lambdadelta's line. Three modifiers, no percentages, so the 100 base
    // says nothing about whether 160 is right -- which leaves the question
    // open for the GM rather than answering it wrongly.
    const out = checkMechanics(sheet({
      advantages: ["Warp (Range: Interstellar; Reliable +10; No Anchor) [160]"] }), index);
    expect(out.findings).toEqual([]);
    expect(out.notes).toHaveLength(1);
    expect(out.notes[0].because).toContain("may be right");
  });

  it("declines when a list prices only some of its modifiers", () => {
    const out = checkMechanics(sheet({
      advantages: ["Warp (Switchable, +10%; No Anchor by default) [160]"] }), index);
    expect(out.findings).toEqual([]);
    expect(out.notes[0].because).toContain("cannot be adjusted");
  });

  it("matches the variety the book prices separately", () => {
    // B51 prices Eidetic Memory at 5 and Photographic Memory at 10.
    const out = checkMechanics(sheet({
      advantages: ["Eidetic Memory (Photographic) [10] - perfect recall."] }), index);
    expect(out.findings).toEqual([]);
  });

  it("believes the level the skill reaches over the label on the line", () => {
    // DX 11, so the level 11 is DX+0, which is what 2 points buy. The label
    // is what is wrong, and saying so is a different job to fix.
    const out = checkMechanics(sheet({ skills: ["Axe/Mace (DX+1)-11 [2]"] }), index);
    expect(out.findings).toHaveLength(1);
    expect(out.findings[0].kind).toBe("label");
    expect(out.findings[0].because).toContain("the points are right");
  });

  it("believes the catalogue's difficulty over the one the line claims", () => {
    // Explosives is IQ/Average (B194). At Average, IQ+3 costs 12.
    const out = checkMechanics(sheet({
      skills: ["Explosives/TL8 (EOD) (IQ/H)-14 [12]"] }), index);
    expect(out.findings).toHaveLength(1);
    expect(out.findings[0].kind).toBe("label");
    expect(out.findings[0].because).toContain("the points are right");
  });

  it("reads a second specialty as bought up from a default (B171, B175)", () => {
    // Jamie Hass's own lines. At DX 12, Pistol-15 is DX+3 for 8 points and
    // correct; Rifle defaults to Pistol-2, so reaching 14 costs only the
    // difference between the two levels, and 2 is right.
    const out = checkMechanics(sheet({
      attributes: ["ST 10 [0]", "DX 12 [40]", "IQ 11 [20]", "HT 10 [0]"],
      skills: ["Guns/TL8 (Pistol) (DX/E)-15 [8]", "Guns/TL8 (Rifle) (DX/E)-14 [2]"] }), index);
    expect(out.findings).toEqual([]);
    expect(out.notes).toHaveLength(1);
    expect(out.notes[0].because).toContain("default");
  });

  it("does not excuse an underpaid skill with no better specialty on the sheet", () => {
    const out = checkMechanics(sheet({
      attributes: ["ST 10 [0]", "DX 12 [40]", "IQ 11 [20]", "HT 10 [0]"],
      skills: ["Guns/TL8 (Rifle) (DX/E)-14 [2]"] }), index);
    expect(out.findings).toHaveLength(1);
    expect(out.findings[0].kind).toBe("cost");
    expect(out.notes).toEqual([]);
  });

  it("still reports a skill that overpays for the level it reaches", () => {
    // 4 points buy Average at DX+1 = 12; this reaches 11 and claims 4.
    const out = checkMechanics(sheet({ skills: ["Axe/Mace (DX/A)-11 [4]"] }), index);
    expect(out.findings).toHaveLength(1);
    expect(out.findings[0].kind).toBe("cost");
  });

  it("says nothing at all about a line where everything agrees", () => {
    const out = checkMechanics(sheet({
      skills: ["Axe/Mace (DX/A)-11 [2]"], disadvantages: ["Bad Temper (12) [-10]"] }), index);
    expect(out.findings).toEqual([]);
    expect(out.notes).toEqual([]);
  });
});

describe("holding a sheet to the campaign's own prices", () => {
  const index = buildIndex(
    [{ book_id: 1, kind: "advantage", name: "Combat Reflexes", cost_text: "15",
       cost_kind: "flat", cost_value: 15 }],
    [
      { name: "Sharp Teeth", kind: "advantage", cost: "1" },
      { name: "Wild Animal", kind: "disadvantage", cost: "-30" },
      { name: "Bernkastel Blessing", kind: "advantage", cost: "Variable" },
    ]);
  const sheet = (over: Record<string, unknown>) => ({
    name: "Subject", attributes: ["ST 10 [0]", "DX 10 [0]", "IQ 10 [0]", "HT 10 [0]"],
    advantages: [], disadvantages: [], skills: [], ...over,
  });

  it("says nothing when a line matches the declared price", () => {
    const out = checkMechanics(sheet({
      advantages: ["Sharp Teeth [1]"], disadvantages: ["Wild Animal [-30]"] }), index);
    expect(out.findings).toEqual([]);
  });

  it("reports a line that disagrees with the campaign's own price", () => {
    // Declaring a trait is the point at which the app can start checking it.
    const out = checkMechanics(sheet({ advantages: ["Sharp Teeth [5]"] }), index);
    expect(out.findings).toHaveLength(1);
    expect(out.findings[0].expected).toBe(1);
  });

  it("stays quiet about homebrew the campaign named but did not price", () => {
    const out = checkMechanics(sheet({ advantages: ["Bernkastel Blessing [20]"] }), index);
    expect(out.findings).toEqual([]);
    expect(out.notes).toEqual([]);
  });
});
