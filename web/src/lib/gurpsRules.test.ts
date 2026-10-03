import { describe, it, expect } from "vitest";
import {
  attributeCost, derive, encumbranceFor, secondaryCost, skillCost,
} from "./gurpsRules";

/**
 * Checked against the Basic Set's own worked examples wherever it gives one.
 * A GURPS tool that is confidently wrong about a cost is worse than one that
 * says nothing, because the GM has no reason to doubt it.
 */

describe("primary attributes", () => {
  it.each([
    ["ST", 11, 10], ["ST", 13, 30], ["HT", 12, 20],
    ["DX", 13, 60], ["IQ", 12, 40], ["IQ", 10, 0],
  ])("%s at %i costs %i", (name, score, expected) => {
    expect(attributeCost(name, score)).toBe(expected);
  });

  it("gives points back below 10", () => {
    // "scores lower than 10 have a negative cost" (B16)
    expect(attributeCost("ST", 8)).toBe(-20);
    expect(attributeCost("IQ", 3)).toBe(-140);
  });

  it("says nothing about something that is not an attribute", () => {
    expect(attributeCost("Luck", 12)).toBeNull();
  });
});

describe("secondary characteristics", () => {
  it("charges nothing when they sit at their default", () => {
    // HP defaults to ST, Will and Per to IQ, FP to HT (B18)
    expect(secondaryCost("HP", 11, 11)).toBe(0);
    expect(secondaryCost("Will", 12, 12)).toBe(0);
  });

  it.each([
    ["HP", 13, 11, 4],      // 2 points per ±1 HP
    ["Will", 14, 12, 10],   // 5 points per ±1
    ["Per", 10, 12, -10],
    ["FP", 13, 12, 3],      // 3 points per ±1
  ])("%s at %i over a base of %i costs %i", (name, score, base, expected) => {
    expect(secondaryCost(name, score, base)).toBe(expected);
  });

  it("charges Basic Speed per quarter point", () => {
    // "5 points per +0.25" (B19)
    expect(secondaryCost("Basic Speed", 6.25, 6.0)).toBe(5);
    expect(secondaryCost("Basic Speed", 6.0, 6.25)).toBe(-5);
  });
});

describe("skill costs", () => {
  it("matches the book's own worked example", () => {
    // "Shortsword (DX/Average) at level 17 ... DX+3 ... 12 points." (B172)
    expect(skillCost("A", 3)).toBe(12);
  });

  it.each([
    ["E", 0, 1], ["E", 1, 2], ["E", 2, 4], ["E", 5, 16],
    ["A", -1, 1], ["A", 0, 2], ["A", 1, 4],
    ["H", -2, 1], ["H", 0, 4], ["H", 2, 12],
    ["VH", -3, 1], ["VH", 0, 8], ["VH", 5, 28],
  ])("%s at attribute%+i costs %i", (difficulty, relative, expected) => {
    expect(skillCost(difficulty, relative)).toBe(expected);
  });

  it("adds four a level above the table", () => {
    // "Extra +1  +4" (B172)
    expect(skillCost("A", 6)).toBe(24);
    expect(skillCost("E", 7)).toBe(24);
  });

  it("says nothing below where the table starts", () => {
    // An Easy skill cannot be bought at attribute-1; there is no such cost.
    expect(skillCost("E", -1)).toBeNull();
    expect(skillCost("A", -2)).toBeNull();
  });

  it("says nothing about a difficulty it does not know", () => {
    expect(skillCost("Impossible", 0)).toBeNull();
  });
});

describe("what the book derives", () => {
  const killian = derive({ ST: 11, DX: 13, IQ: 12, HT: 12 });

  it("computes Basic Speed without rounding it", () => {
    // "add your HT and DX together, and then divide the total by 4.
    //  Do not round it off." (B19)
    expect(killian.basicSpeed).toBe(6.25);
  });

  it("drops the fraction for Basic Move", () => {
    expect(killian.basicMove).toBe(6);
    expect(derive({ DX: 10, HT: 13 }).basicMove).toBe(5);  // 5.75 -> 5
  });

  it("computes Dodge as Basic Speed plus three, fractions dropped", () => {
    // The book's example: Basic Speed 5.25 gives Dodge 8.
    expect(derive({ DX: 11, HT: 10 }).dodge).toBe(8);
  });

  it("computes Basic Lift from ST squared", () => {
    // "(ST×ST)/5 lbs ... The average human has ST 10 and a BL of 20 lbs." (B17)
    expect(derive({ ST: 10 }).basicLift).toBe(20);
    expect(derive({ ST: 11 }).basicLift).toBe(24);   // 24.2, rounded at >= 10
    expect(derive({ ST: 5 }).basicLift).toBe(5);     // below 10, not rounded
  });

  it("reads thrust and swing off the damage table", () => {
    expect([killian.thrust, killian.swing]).toEqual(["1d-1", "1d+1"]);
    expect(derive({ ST: 10 }).swing).toBe("1d");
  });

  it("says nothing about damage outside the range the book prints", () => {
    expect(derive({ ST: 40 }).thrust).toBeNull();
  });

  it("gives the defaults the secondary characteristics start from", () => {
    expect([killian.hp, killian.will, killian.per, killian.fp]).toEqual([11, 12, 12, 12]);
  });

  it("says nothing when it was given nothing", () => {
    const empty = derive({});
    expect([empty.basicSpeed, empty.basicMove, empty.basicLift]).toEqual([null, null, null]);
  });
});

describe("encumbrance", () => {
  it("bands a load by multiples of Basic Lift", () => {
    expect(encumbranceFor(20, 20)?.name).toBe("None");
    expect(encumbranceFor(21, 20)?.name).toBe("Light");
    expect(encumbranceFor(60, 20)?.name).toBe("Medium");
    expect(encumbranceFor(200, 20)?.name).toBe("Extra-Heavy");
  });

  it("says nothing about a load nobody could carry", () => {
    expect(encumbranceFor(500, 20)).toBeNull();
  });

  it("carries the movement and dodge penalties with the band", () => {
    const light = encumbranceFor(30, 20)!;
    expect([light.move, light.dodge]).toEqual([0.8, -1]);
  });
});
