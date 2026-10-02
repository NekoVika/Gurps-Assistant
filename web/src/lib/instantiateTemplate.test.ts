import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

import { instantiateTemplate } from "./instantiateTemplate";
import { mergeGenerated } from "./mergeGenerated";
import { hasValue } from "../components/editors/CollapsibleSection";

// vitest runs with cwd = web/; templates live at the repo root.
const template = (name: string) =>
  readFileSync(`../.planning/_templates/${name}`, "utf-8");

const answers = {
  EntityType: "NPC",
  Name: "Killian",
  Concept: "Dock rat",
  Role: "Ally",
  Significance: "supporting",
  Description: "Gruff. Owes the Watch money.",
};

describe("instantiating the NPC example", () => {
  const stub = () => JSON.parse(instantiateTemplate(template("NPC_Template.json"), answers));

  it("keeps what the GM typed", () => {
    expect(stub()).toMatchObject({
      name: "Killian",
      concept: "Dock rat",
      role: "Ally",
      significance: "supporting",
      gmSummary: "Gruff. Owes the Watch money.",
    });
  });

  it("never writes the AI's instruction key into the campaign", () => {
    // `_INSTRUCTION` reached a real character file before this existed.
    expect(Object.keys(stub()).some(k => k.startsWith("_"))).toBe(false);
  });

  it("blanks every field the GM did not answer", () => {
    const written = Object.entries(stub())
      .filter(([, v]) => hasValue(v))
      .map(([k]) => k)
      .sort();
    expect(written).toEqual(["concept", "gmSummary", "kind", "name", "role", "significance"]);
  });

  it("carries none of the example's prose", () => {
    const text = JSON.stringify(stub());
    for (const fragment of [
      "Example Character Name",
      "Physical description",
      "Personality traits",
      "Hidden GM notes",
      "Combat Reflexes",
      "ST 10 [0]",
    ]) {
      expect(text).not.toContain(fragment);
    }
  });

  it("keeps the shape, so the editor still knows what the entity has", () => {
    const keys = Object.keys(stub());
    for (const field of ["appearance", "personality", "motivation", "attributes", "gear", "hitLocations"]) {
      expect(keys).toContain(field);
    }
  });
});

describe("the entity type the GM picked", () => {
  // A bestiary template is exempt from placement *by nature*; it only reads
  // that way if the stub records what kind of thing it is.
  it.each([
    ["NPC", "individual"],
    ["Bestiary", "type"],
    ["PC", "pc"],
  ])("%s becomes kind %s", (entityType, kind) => {
    const stub = JSON.parse(
      instantiateTemplate(template("NPC_Template.json"), { Name: "Sewer Wolf", EntityType: entityType })
    );
    expect(stub.kind).toBe(kind);
  });

  it("leaves a bestiary template with no significance", () => {
    // The field defaults to "core", which would make every wolf core cast.
    const stub = JSON.parse(
      instantiateTemplate(template("NPC_Template.json"), {
        Name: "Sewer Wolf", EntityType: "Bestiary", Significance: "core",
      })
    );
    expect(stub.significance).toBe("");
  });

  it("is not invented for entities that have no kind", () => {
    const stub = JSON.parse(instantiateTemplate(template("Location_Template.json"), { Name: "Old Docks" }));
    expect(stub.kind).toBeUndefined();
  });
});

describe("the stub a wizard writes can actually be deepened", () => {
  // This is the bug the shakedown found: the stub looked written, so the merge
  // kept all of it and generation changed nothing, for ever.
  it("lets generated content fill the fields the GM left alone", () => {
    const stub = JSON.parse(instantiateTemplate(template("NPC_Template.json"), answers));
    const generated = {
      name: "Something Else Entirely",
      appearance: "Weathered, salt-stained, one eye clouded.",
      personality: "Wary of anyone who pays in coin.",
      motivation: "Clear the debt before the Watch collects.",
      gmSummary: "A model's idea of a GM note.",
    };

    const report = mergeGenerated(stub, generated);

    expect(report.filled.sort()).toEqual(["appearance", "motivation", "personality"]);
    // Identity and the GM's own writing are untouchable.
    expect(report.merged.name).toBe("Killian");
    expect(report.merged.gmSummary).toBe("Gruff. Owes the Watch money.");
    expect(report.kept).toContain("gmSummary");
  });

  it("would have filled nothing at all before the example was blanked", () => {
    // Guards the regression directly: the raw example as a stub is inert.
    const raw = JSON.parse(template("NPC_Template.json"));
    const report = mergeGenerated(raw, { appearance: "Weathered and salt-stained." });
    expect(report.filled).toEqual([]);
  });
});

describe("the other entity examples", () => {
  it.each([
    ["Location_Template.json", "name"],
    ["Faction_Template.json", "name"],
    ["Encounter_Template.json", "title"],
    ["Chapter_Template.json", "title"],
    ["Episode_Template.json", "title"],
    ["Story_Template.json", "title"],
  ])("%s instantiates with the GM's name and no instruction key", (file, identity) => {
    const stub = JSON.parse(instantiateTemplate(template(file), { Name: "The Drowned Wharf" }));
    expect(stub[identity]).toBe("The Drowned Wharf");
    expect(Object.keys(stub).some(k => k.startsWith("_"))).toBe(false);
    expect(JSON.stringify(stub)).not.toContain("...");
  });
});

describe("templates that are not JSON", () => {
  it("substitutes tokens and leaves the rest alone", () => {
    const md = "# [Name]\n\nOverview for [Name Name].\n";
    expect(instantiateTemplate(md, { Name: "Chapter 04: The Rat King's Lair" }))
      .toBe("# Chapter 04: The Rat King's Lair\n\nOverview for Chapter 04: The Rat King's Lair.\n");
  });

  it("returns unparseable content untouched rather than throwing", () => {
    expect(instantiateTemplate("not json {", {})).toBe("not json {");
  });
});

describe("the visual anchor the GM typed", () => {
  // Reported three times: typed once in the wizard, then every later pass
  // asked for it again with an empty box. It was being discarded entirely.
  it("is stored, so it survives the stub", () => {
    const stub = JSON.parse(
      instantiateTemplate(template("NPC_Template.json"), {
        Name: "Killian",
        Visuals: "Old and scarred, a slight limp.",
      })
    );
    expect(stub.appearance).toBe("Old and scarred, a slight limp.");
  });

  it("is left to the model when the GM says nothing", () => {
    const stub = JSON.parse(
      instantiateTemplate(template("NPC_Template.json"), { Name: "Killian", Visuals: "   " })
    );
    expect(stub.appearance).toBe("");
  });

  it("is canon once written — generation cannot overwrite it", () => {
    const stub = JSON.parse(
      instantiateTemplate(template("NPC_Template.json"), { Name: "Killian", Visuals: "One clouded eye." })
    );
    const report = mergeGenerated(stub, { appearance: "A model's richer paragraph.", personality: "Wary." });
    expect(report.merged.appearance).toBe("One clouded eye.");
    expect(report.kept).toContain("appearance");
    expect(report.filled).toContain("personality");
  });
});
