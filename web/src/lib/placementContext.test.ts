import { describe, it, expect } from "vitest";
import { inferPlacement, describePlacement } from "./placementContext";

const encounter = { title: "Flooded Passages Entry", type: "Encounter", childLinks: [] };
const location = { name: "The Lower Drains", internalStructure: [] };
const character = { name: "Rick", attributes: [], pointTotal: "???" };

describe("inferPlacement", () => {
  it("attaches a character created inside an encounter to that encounter", () => {
    expect(inferPlacement(encounter, "Character")).toEqual({
      story_node: "Flooded Passages Entry",
      story_mode: "appearance",
    });
  });

  it("never assumes a fixture -- reaching downward is the GM's call", () => {
    expect(inferPlacement(encounter, "Character").story_mode).toBe("appearance");
  });

  it("places a character created inside a location at that location", () => {
    expect(inferPlacement(location, "Character")).toEqual({ location: "The Lower Drains" });
  });

  it("nests a location created inside a location", () => {
    expect(inferPlacement(location, "Location")).toEqual({ parent_location: "The Lower Drains" });
  });

  it("gives a location created inside a story node a story placement", () => {
    expect(inferPlacement(encounter, "Location")).toEqual({
      story_node: "Flooded Passages Entry",
      story_mode: "appearance",
    });
  });

  it("infers nothing from a character sheet -- there is no containment to borrow", () => {
    expect(inferPlacement(character, "Character")).toEqual({});
  });

  it("infers nothing for story children -- parent_path already carries that", () => {
    expect(inferPlacement(encounter, "Chapter")).toEqual({});
  });

  it("reads a raw JSON string the way the file panel holds it", () => {
    expect(inferPlacement(JSON.stringify(location), "Character")).toEqual({ location: "The Lower Drains" });
  });

  it("stays quiet on unparseable or empty input", () => {
    expect(inferPlacement("not json", "Character")).toEqual({});
    expect(inferPlacement(null, "Character")).toEqual({});
    expect(inferPlacement({ internalStructure: [] }, "Character")).toEqual({});
  });
});

describe("describePlacement", () => {
  it("says where the new thing will land, in the GM's terms", () => {
    expect(describePlacement({ story_node: "The Lower Drains" })).toContain("appear in");
    expect(describePlacement({ location: "HQ" })).toContain("be at");
    expect(describePlacement({ parent_location: "HQ" })).toContain("sit inside");
    expect(describePlacement({})).toBe("");
  });
});
