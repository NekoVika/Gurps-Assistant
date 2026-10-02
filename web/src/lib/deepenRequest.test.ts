import { describe, it, expect } from "vitest";
import { deepenRequestFor } from "./deepenRequest";
import type { CharacterJSON } from "./types";

const character = (over: Partial<CharacterJSON> = {}) =>
  ({ name: "Killian", concept: "Retired hunter", role: "Ally",
     significance: "supporting", gmSummary: "Advises novices.",
     appearance: "Old and scarred.", kind: "individual", ...over } as CharacterJSON);

describe("re-opening the wizard against an existing character", () => {
  it("pre-fills from what the entity already says", () => {
    expect(deepenRequestFor(character(), "Campaign/02_Characters/Main_Cast/Killian.json")).toEqual({
      wizardId: "create_npc",
      path: "Campaign/02_Characters/Main_Cast/Killian.json",
      answers: {
        EntityType: "NPC",
        Name: "Killian",
        Concept: "Retired hunter",
        Description: "Advises novices.",
        Role: "Ally",
        Significance: "supporting",
        Visuals: "Old and scarred.",
      },
    });
  });

  it("brings the visual anchor back, rather than asking again", () => {
    // Reported three times: it was never stored, so every pass showed a blank.
    const req = deepenRequestFor(character({ appearance: "One clouded eye." }), "p.json");
    expect(req.answers.Visuals).toBe("One clouded eye.");
  });

  it.each([
    ["individual", "NPC"],
    ["type", "Bestiary"],
    ["pc", "PC"],
  ])("maps kind %p back to entity type %p", (kind, entityType) => {
    const req = deepenRequestFor(character({ kind: kind as CharacterJSON["kind"] }), "p.json");
    expect(req.answers.EntityType).toBe(entityType);
  });

  it("survives a character with nothing written but a name", () => {
    const req = deepenRequestFor({ name: "Rick" } as CharacterJSON, "p.json");
    expect(req.answers.Name).toBe("Rick");
    expect(req.answers.Visuals).toBe("");
    expect(req.answers.EntityType).toBe("NPC");
  });
});
