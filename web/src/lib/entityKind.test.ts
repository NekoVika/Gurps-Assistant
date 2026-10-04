import { describe, it, expect } from "vitest";
import { entityKind, parentPath, entityContext } from "./entityKind";

/**
 * Every path here is a real one from the Anomaly Hunters campaign.
 *
 * The registry's own `type` is a mixture — "Encounter" and "Chapter" are kinds,
 * "Megastructure / Ruins" and "Guild" describe a place in the world, and
 * thirty-two entries say "Unknown". Where a file lives is the reliable answer.
 */

const EP = "Campaign/03_Story/Episode_03_Watcher_of_the_Rain";

describe("what kind of thing a path holds", () => {
  it.each([
    ["Campaign/02_Characters/PCs/Jamie_Hass.json", "PC"],
    ["Campaign/02_Characters/Main_Cast/Bernkastel.json", "Character"],
    ["Campaign/02_Characters/Bestiary/Giant_Spider.json", "Bestiary"],
    ["Campaign/01_World_Bible/Locations/HQ.json", "Location"],
    ["Campaign/01_World_Bible/Factions/Anomaly_Hunters.json", "Faction"],
    ["Campaign/01_World_Bible/World_Dossier.json", "Lore"],
    [`${EP}/Episode_Overview.json`, "Episode"],
    [`${EP}/Chapter_08/Chapter_Overview.json`, "Chapter"],
    [`${EP}/Chapter_00/The Interlude.json`, "Chapter"],
    [`${EP}/Chapter_08/Encounters/Gift_And_Release.json`, "Encounter"],
    ["Campaign/03_Story/Campaign_Overview.json", "Campaign"],
    ["Campaign/state.json", "Note"],
  ])("reads %s as %s", (path, kind) => {
    expect(entityKind(path)).toBe(kind);
  });

  it("does not care which way the slashes lean", () => {
    expect(entityKind("Campaign\\02_Characters\\PCs\\Jamie_Hass.json")).toBe("PC");
  });
});

describe("what a thing sits inside", () => {
  it("puts an encounter in its chapter", () => {
    expect(parentPath(`${EP}/Chapter_08/Encounters/Gift_And_Release.json`))
      .toBe(`${EP}/Chapter_08`);
  });

  it("puts a chapter in its episode", () => {
    expect(parentPath(`${EP}/Chapter_08/Chapter_Overview.json`)).toBe(EP);
  });

  it("gives a character nothing to sit inside", () => {
    expect(parentPath("Campaign/02_Characters/PCs/Jamie_Hass.json")).toBe("");
  });
});

describe("the label beside a name", () => {
  const byPath = new Map([
    [`${EP}/Chapter_08/Chapter_Overview.json`, "Epilogue - Back to the Stage"],
    [`${EP}/Episode_Overview.json`, "Watcher of the Rain"],
    [`${EP}/Chapter_00/The Interlude.json`, "The Interlude"],
  ]);

  it("names an encounter's chapter rather than its folder", () => {
    // "Recall Misfire" means little until you know which chapter it is in.
    expect(entityContext(`${EP}/Chapter_08/Encounters/Recall_Misfire.json`, byPath))
      .toBe("Epilogue - Back to the Stage");
  });

  it("names a chapter's episode", () => {
    expect(entityContext(`${EP}/Chapter_08/Chapter_Overview.json`, byPath))
      .toBe("Watcher of the Rain");
  });

  it("finds a chapter whose overview is named after itself", () => {
    expect(entityContext(`${EP}/Chapter_00/Encounters/Arrival.json`, byPath))
      .toBe("The Interlude");
  });

  it("falls back to a tidied folder name when no overview exists", () => {
    expect(entityContext("Campaign/03_Story/Episode_09/Chapter_02/Encounters/X.json", new Map()))
      .toBe("Chapter 02");
  });

  it("says nothing for something that sits inside nothing", () => {
    expect(entityContext("Campaign/02_Characters/PCs/Jamie_Hass.json", byPath)).toBe("");
  });
});
