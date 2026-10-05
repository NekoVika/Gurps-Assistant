import { describe, it, expect } from "vitest";
import { parseAttribute, serializeAttribute, parseGear, serializeGear } from "./TraitFormatters";

/**
 * Every line here is one the campaign actually stores. A parser that fails
 * shows the GM a raw-text box; one that succeeds wrongly shows them a table
 * with the wrong numbers in it, which nobody thinks to question.
 */

describe("gear", () => {
  it.each([
    ["Ammo, Pistol (9mm) [20] (0.5 lbs, $20) - For light pistol",
      { name: "Ammo, Pistol (9mm)", quantity: 20, weight: "0.5 lbs", cost: "$20", notes: "For light pistol" }],
    ["Commlink (Handheld) [1] (0.5 lbs, $500) - TL8, 5-mile range",
      { name: "Commlink (Handheld)", quantity: 1, weight: "0.5 lbs", cost: "$500", notes: "TL8, 5-mile range" }],
    ["Tactical Vest (Light) [1] (0 lbs, $0) - DR 3/2* (Torso only).",
      { name: "Tactical Vest (Light)", quantity: 1, weight: "0 lbs", cost: "$0", notes: "DR 3/2* (Torso only)." }],
    ["Assault Rifle [1] (9 lbs, $2,000) - TL8, 7d pi",
      { name: "Assault Rifle", quantity: 1, weight: "9 lbs", cost: "$2,000", notes: "TL8, 7d pi" }],
    ["Medkit (2 lbs, $100) - First Aid kit",
      { name: "Medkit", quantity: 1, weight: "2 lbs", cost: "$100", notes: "First Aid kit" }],
  ])("reads %s", (line, expected) => {
    expect(parseGear(line)).toEqual(expected);
  });

  it("writes back what it read", () => {
    const line = "Commlink (Handheld) [2] (0.5 lbs, $500) - TL8, 5-mile range";
    expect(serializeGear(parseGear(line))).toBe(line);
  });

  it("leaves a line with no weight and cost as written", () => {
    expect(parseGear("[TBD]")).toBe("[TBD]");
  });
});

describe("attributes", () => {
  it("reads a defence the character does not have", () => {
    expect(parseAttribute("Parry N/A [0]")).toEqual({ name: "Parry", level: "N/A", points: "0" });
    expect(serializeAttribute(parseAttribute("Block N/A [0]"))).toBe("Block N/A [0]");
  });

  it("still reads a score", () => {
    expect(parseAttribute("Basic Speed 5.75 [0]")).toEqual({ name: "Basic Speed", level: "5.75", points: "0" });
  });
});
