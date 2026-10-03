import { describe, it, expect } from "vitest";
import { narrowToScope } from "./scopeFilter";

const inScope = (name: string) => ["Rachel", "Satan"].includes(name);

describe("narrowing a sidebar section under focus", () => {
  it("narrows to the members that are in scope", () => {
    expect(narrowToScope(["Rachel", "Killian", "Satan"], inScope)).toEqual(["Rachel", "Satan"]);
  });

  it("leaves the section whole when scope knows nothing about it", () => {
    // Factions can never be scope members, and no location is story-placed yet.
    // Filtering them emptied both sections outright: 6 locations -> 0, 2 -> 0.
    expect(narrowToScope(["Anomaly Hunters", "Sector 4"], inScope))
      .toEqual(["Anomaly Hunters", "Sector 4"]);
  });

  it("starts narrowing as soon as one member is in scope", () => {
    // The rule corrects itself as placement data arrives.
    expect(narrowToScope(["Anomaly Hunters", "Rachel"], inScope)).toEqual(["Rachel"]);
  });

  it("handles an empty section without inventing rows", () => {
    expect(narrowToScope([], inScope)).toEqual([]);
  });
});
