import { describe, it, expect } from "vitest";
import {
  baseCost, modifiedCost, modifiersArePriced, netModifier, parseModifiers, traitLevel,
} from "./modifiers";

/**
 * The book's worked examples are the tests, and so are three lines from the
 * campaign that already price themselves correctly — if the implementation
 * disagrees with Bernkastel's sheet, the implementation is wrong.
 */

describe("the book's own examples", () => {
  it("totals a mixed set and rounds the result up (B103)", () => {
    // "a +10% enhancement, a +40% enhancement, a -30% limitation, and a -45%
    //  limitation would give a net modifier of -25%. This would reduce the cost
    //  of a 10-point advantage to 7.5 points, which would round up to 8 points."
    const mods = [
      { name: "a", percent: 10 }, { name: "b", percent: 40 },
      { name: "c", percent: -30 }, { name: "d", percent: -45 },
    ];
    expect(netModifier(mods)).toBe(-25);
    expect(modifiedCost(10, mods)).toBe(8);
  });

  it("rounds an enhanced cost up (B11)", () => {
    // "a 25% enhancement to a 15-point ability would result in 18.75 points,
    //  which would round to 19 points."
    expect(modifiedCost(15, [{ name: "x", percent: 25 }])).toBe(19);
  });

  it("rounds a limited disadvantage toward zero (B11, B112)", () => {
    // "a -10% limitation on a -25-point disadvantage would make it a -22.5-point
    //  trait, which rounds to -22 points." -- "up" means positive-ward.
    expect(modifiedCost(-25, [{ name: "x", percent: -10 }])).toBe(-22);
  });

  it("never reduces a cost by more than 80% (B103)", () => {
    const heavy = [{ name: "a", percent: -60 }, { name: "b", percent: -60 }];
    expect(netModifier(heavy)).toBe(-80);
    expect(modifiedCost(100, heavy)).toBe(20);   // a fifth of base, never less
  });

  it("leaves a cost alone when the modifiers cancel", () => {
    expect(modifiedCost(40, [{ name: "a", percent: 50 }, { name: "b", percent: -50 }])).toBe(40);
  });
});

describe("reading modifiers off a sheet", () => {
  it("reads a semicolon-separated list", () => {
    const mods = parseModifiers(
      "Insubstantiality (Affect Substantial, +100%; Always On, -50%; Switchable, +10%) [128]");
    expect(mods).toEqual([
      { name: "Affect Substantial", percent: 100 },
      { name: "Always On", percent: -50 },
      { name: "Switchable", percent: 10 },
    ]);
  });

  it("reads a single modifier", () => {
    expect(parseModifiers("Damage Resistance 50 (Force Field, +20%) [300]"))
      .toEqual([{ name: "Force Field", percent: 20 }]);
  });

  it("reads a modifier worth nothing", () => {
    const mods = parseModifiers("Super Luck (Cosmic, +50%; Game Time, +0%) [150]");
    expect(mods.map(m => m.percent)).toEqual([50, 0]);
  });

  it("finds nothing in a plain trait", () => {
    expect(parseModifiers("Combat Reflexes [15] - Reacts quickly (B43)")).toEqual([]);
  });

  it("ignores percentages written in the notes rather than the parenthetical", () => {
    // "Warp [350] - Cosmic, No Die Roll Required, +100%, Exospatial, +50%..."
    // Prose is prose: a percentage in a sentence may be an aside, and guessing
    // at a cost is worse than declining to give one.
    expect(parseModifiers("Warp [350] - Cosmic, No Die Roll Required, +100%, Exospatial, +50%")).toEqual([]);
  });

  it("survives an empty or absent line", () => {
    expect(parseModifiers("")).toEqual([]);
    expect(netModifier([])).toBe(0);
  });
});

describe("against lines from the campaign that are already right", () => {
  it.each([
    // trait, catalogue base, stated cost
    ["Insubstantiality (Affect Substantial, +100%; Always On, -50%; Switchable, +10%) [128]", 80, 128],
    ["Damage Resistance 50 (Force Field, +20%) [300]", 250, 300],
    ["Super Luck (Cosmic, +50%; Game Time, +0%) [150]", 100, 150],
  ])("prices %s at %i", (line, base, expected) => {
    expect(modifiedCost(base, parseModifiers(line))).toBe(expected);
  });
});

describe("the base a trait starts from", () => {
  it("multiplies a per-level cost by the level on the sheet", () => {
    // Damage Resistance is 5/level, and the sheet says 50 levels.
    expect(baseCost({ cost_kind: "per_level", cost_value: 5 }, 50)).toBe(250);
  });

  it("takes a flat cost as it stands", () => {
    expect(baseCost({ cost_kind: "flat", cost_value: 80 }, null)).toBe(80);
  });

  it("claims nothing when the book does not price it with a number", () => {
    expect(baseCost({ cost_kind: "variable", cost_value: null }, null)).toBeNull();
    expect(baseCost({ cost_kind: "range", cost_value: null }, 2)).toBeNull();
    expect(baseCost(null, 3)).toBeNull();
  });

  it("claims nothing for a per-level trait with no level written", () => {
    expect(baseCost({ cost_kind: "per_level", cost_value: 5 }, null)).toBeNull();
  });

  it("reads the level a sheet writes into the name", () => {
    expect(traitLevel("Damage Resistance 50")).toBe(50);
    expect(traitLevel("Night Vision 5")).toBe(5);
  });

  it("finds no level where there is none", () => {
    expect(traitLevel("Combat Reflexes")).toBeNull();
    // A number at the front is part of the name, not a level.
    expect(traitLevel("360° Vision")).toBeNull();
  });
});

describe("a list that prices only some of its modifiers", () => {
  // Both of the campaign's modified-trait findings were this, and both were
  // false. The sheet is right; the line just does not write every value.
  it.each([
    "Invisibility (Switchable, +10%; Affects bystanders by default) [55]",
    "Visualization (Reduced Time 7: Instant; Blessing, +100%) [30]",
  ])("declines to total %s", line => {
    expect(modifiersArePriced(line)).toBe(false);
  });

  it("accepts a list where every modifier carries a value", () => {
    expect(modifiersArePriced(
      "Insubstantiality (Affect Substantial, +100%; Always On, -50%) [128]")).toBe(true);
  });

  it("treats a parenthetical with no percentage as a specialty", () => {
    // "Lame (Major)" names the variety of the trait, not a modifier.
    expect(modifiersArePriced("Lame (Major) [-30]")).toBe(true);
    expect(modifiersArePriced("Combat Reflexes [15]")).toBe(true);
  });
});
