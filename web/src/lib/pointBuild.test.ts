import { describe, it, expect } from "vitest";
import { parseEntry, pointBuild, statedTotal, describeBuild } from "./pointBuild";

/**
 * Every fixture here is a line shape taken from the Anomaly Hunters campaign,
 * including the damaged ones. The point of this module is to be honest about
 * what it cannot read, so the damage is as important to test as the clean data.
 */

describe("reading one line", () => {
  it("reads an attribute as name, value and cost", () => {
    const e = parseEntry("ST 13 [30]", "attribute");
    expect([e.name, e.level, e.points, e.problem]).toEqual(["ST", "13", 30, ""]);
  });

  it("reads a two-word attribute with a decimal value", () => {
    const e = parseEntry("Basic Speed 6.00 [0]", "attribute");
    expect([e.name, e.level, e.points]).toEqual(["Basic Speed", "6.00", 0]);
  });

  it("reads an attribute whose value is not a number", () => {
    const e = parseEntry("Parry N/A [0]", "attribute");
    expect([e.name, e.level, e.points, e.problem]).toEqual(["Parry", "N/A", 0, ""]);
  });

  it("reads a negative cost", () => {
    expect(parseEntry("IQ 3 [-140]", "attribute").points).toBe(-140);
  });

  it("reads an advantage with notes and a page citation", () => {
    const e = parseEntry("Combat Reflexes [15] - Reacts quickly (B43)", "advantage");
    expect([e.name, e.points, e.notes]).toEqual(["Combat Reflexes", 15, "Reacts quickly (B43)"]);
  });

  it("separates a qualifier from the trait it qualifies", () => {
    const e = parseEntry("Lame (Major) [-30] - Move halved", "disadvantage");
    expect([e.name, e.specialty, e.points]).toEqual(["Lame", "Major", -30]);
  });

  it("reads a skill written with attribute and difficulty", () => {
    const e = parseEntry("Stealth (DX/A)-14 [8]", "skill");
    expect([e.name, e.level, e.points]).toEqual(["Stealth", "(DX/A)-14", 8]);
  });

  it("reads a skill written with a relative level", () => {
    const e = parseEntry("Brawling (DX+1)-13 [2] - Punching", "skill");
    expect([e.name, e.level, e.points]).toEqual(["Brawling", "(DX+1)-13", 2]);
  });

  it("keeps a specialty and a level apart", () => {
    const e = parseEntry("Guns/TL8 (Pistol) (DX+1)-13 [2]", "skill");
    expect([e.name, e.specialty, e.level, e.points]).toEqual(
      ["Guns/TL8", "Pistol", "(DX+1)-13", 2]);
  });

  it("strips the markdown the migration left behind", () => {
    const e = parseEntry("**Danger Sense** [15]", "advantage");
    expect([e.name, e.points, e.problem]).toEqual(["Danger Sense", 15, ""]);
  });

  it("strips markdown around a name that also carries a specialty", () => {
    const e = parseEntry("**Electronics Operation/TL8 (Communications)** (IQ/A)-12 [2]", "skill");
    expect([e.name, e.specialty, e.points]).toEqual(
      ["Electronics Operation/TL8", "Communications", 2]);
  });
});

describe("lines it cannot read", () => {
  it("says so when there is no cost at all", () => {
    const e = parseEntry("Combat Reflexes - reacts quickly", "advantage");
    expect(e.points).toBeNull();
    expect(e.problem).toBe("no cost in brackets");
  });

  it("takes the trailing cost but reports two entries run together", () => {
    // Real damage: "Note ()- [0] - Brawling (DX/E)-14 [4]" is one stored line.
    const e = parseEntry("Note ()- [0] - Brawling (DX/E)-14 [4]", "skill");
    expect(e.points).toBe(4);
    expect(e.problem).toBe("2 costs on one line");
  });

  it("reads a doubled bracket, which the migration also produced", () => {
    const e = parseEntry("B ()- [0] - rawling (DX/E)-16 [[4]]", "skill");
    expect(e.points).toBe(4);
  });

  it("treats a blank line as a blank line", () => {
    expect(parseEntry("   ", "skill").problem).toBe("blank line");
  });
});

describe("what a character costs", () => {
  const killian = {
    pointTotal: "225",
    attributes: ["ST 11 [10]", "DX 13 [60]", "IQ 12 [40]", "HT 12 [20]"],
    advantages: ["Combat Reflexes [15] - Reacts quickly (B43)", "Fit [5]"],
    disadvantages: ["Bad Temper [-10] - CR: 12 (B121)", "Lame (Major) [-30]"],
    skills: ["Brawling (DX+0)-13 [1]", "Stealth (DX/A)-14 [8]"],
  };

  it("sums the parts section by section", () => {
    const build = pointBuild(killian);
    expect(build.sections.map(s => [s.label, s.points])).toEqual([
      ["Attributes", 130], ["Advantages", 20], ["Disadvantages", -40], ["Skills", 9],
    ]);
    expect(build.computed).toBe(119);
  });

  it("reports the gap between the parts and the claim", () => {
    const build = pointBuild(killian);
    expect([build.stated, build.difference]).toEqual([225, 106]);
  });

  it("agrees when the sheet is right", () => {
    const build = pointBuild({ ...killian, pointTotal: "119" });
    expect(build.difference).toBe(0);
    expect(describeBuild(build)).toContain("matching the stated 119");
  });

  it("is complete only when every line was read", () => {
    expect(pointBuild(killian).complete).toBe(true);
    const damaged = pointBuild({ ...killian, skills: ["Brawling (DX+0)-13"] });
    expect(damaged.complete).toBe(false);
    expect(damaged.unreadable).toHaveLength(1);
  });

  it("says the total is a floor when a line could not be read", () => {
    const build = pointBuild({ ...killian, skills: ["Brawling (DX+0)-13"] });
    expect(describeBuild(build)).toContain("1 line could not be read");
  });

  it("survives a character with nothing on it", () => {
    const build = pointBuild({});
    expect([build.computed, build.stated, build.difference]).toEqual([0, null, null]);
    expect(describeBuild(build)).toContain("states no total");
  });

  it("survives being handed nothing at all", () => {
    expect(pointBuild(null).computed).toBe(0);
  });
});

describe("the sheet's stated total", () => {
  it.each([
    ["225", 225],
    ["150 points", 150],
    ["1,500", 1500],
    ["1 500", 1500],
    [225, 225],
    ["???", null],
    ["", null],
    [undefined, null],
  ])("reads %p as %p", (input, expected) => {
    expect(statedTotal(input)).toBe(expected);
  });

  it("reads the ??? both imported PCs carry as no total", () => {
    // sync_pc_from_gcs never captured one, so these two have said "???" since
    // they were imported. Tier one gives them a number for the first time.
    expect(statedTotal("???")).toBeNull();
  });
});
