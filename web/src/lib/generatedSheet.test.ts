import { describe, it, expect } from "vitest";
import { entryFromModel, sheetFromBuild, statedScores, leftToGMBlock, gearLines } from "./generatedSheet";
import { parseGear } from "./TraitFormatters";
import { buildIndex } from "./traitAudit";
import { pointBuild } from "./pointBuild";
import { checkMechanics } from "./mechanicsCheck";

/**
 * What the backend hands over is a Pydantic dump: snake_case, and `null` for
 * every field the model did not fill. These tests feed it exactly that shape,
 * because a test written in the renderer's own camelCase would pass against
 * the bug this file exists to prevent.
 */

const index = buildIndex([
  { book_id: 1, kind: "skill", name: "Guns/TL", attr: "DX", difficulty: "E", specialised: true },
  { book_id: 1, kind: "skill", name: "Observation", attr: "Per", difficulty: "A" },
  { book_id: 1, kind: "advantage", name: "Combat Reflexes", cost_text: "15",
    cost_kind: "flat", cost_value: 15 },
  { book_id: 1, kind: "disadvantage", name: "Bad Temper", cost_text: "-10*",
    cost_kind: "flat", cost_value: -10, self_control: true },
  { book_id: 1, kind: "disadvantage", name: "Secret", cost_text: "-5 to -30",
    cost_kind: "range", cost_value: null },
]);

/** An entry as `BuildEntry.model_dump()` writes it. */
const dumped = (fields: Record<string, unknown>) => ({
  score: null, level: null, levels: null, specialty: null, tl: null,
  self_control: null, modifiers: [], notes: "", ...fields,
});

describe("reading what the backend sends", () => {
  it("treats null as not chosen, so no line says TLnull", () => {
    const entry = entryFromModel(dumped({ kind: "skill", name: "Stealth", level: "DX+1" }));
    expect(entry).toEqual({ kind: "skill", name: "Stealth", level: "DX+1" });
  });

  it("reads the snake_case self-control number", () => {
    expect(entryFromModel(dumped({ kind: "disadvantage", name: "Bad Temper", self_control: 9 }))
      ?.selfControl).toBe(9);
  });

  it("drops an entry with no name or no section", () => {
    expect(entryFromModel(dumped({ kind: "skill", name: "  " }))).toBeNull();
    expect(entryFromModel(dumped({ kind: "equipment", name: "Pistol" }))).toBeNull();
  });

  it("strips a cost written into a note, which the parser would read as the line's", () => {
    const entry = entryFromModel(dumped({
      kind: "advantage", name: "Combat Reflexes", notes: "Reacts first [15]" }));
    expect(entry?.notes).toBe("Reacts first");
  });
});

describe("a generated sheet", () => {
  const build = {
    name: "Rick", concept: "", unpriceable: ["A Patron: the Hunters"],
    entries: [
      dumped({ kind: "attribute", name: "DX", score: 12 }),
      dumped({ kind: "attribute", name: "IQ", score: 11 }),
      dumped({ kind: "advantage", name: "Combat Reflexes", notes: "Reacts first." }),
      dumped({ kind: "disadvantage", name: "Bad Temper", self_control: 9 }),
      dumped({ kind: "disadvantage", name: "Secret", specialty: "Ex-cultist" }),
      dumped({ kind: "skill", name: "Guns/TL", specialty: "Pistol", tl: 8, level: "DX+3" }),
      dumped({ kind: "skill", name: "Observation", level: "Per+1" }),
    ],
  };
  const sheet = sheetFromBuild(build, index);

  it("lists every attribute, at its default where the model left it out", () => {
    expect(sheet.attributes).toEqual([
      "ST 10 [0]", "DX 12 [40]", "IQ 11 [20]", "HT 10 [0]",
      "HP 10 [0]", "Will 11 [0]", "Per 11 [0]", "FP 10 [0]",
      "Basic Speed 5.50 [0]", "Basic Move 5 [0]",
    ]);
  });

  it("prices a skill against an attribute the model never mentioned", () => {
    // Per defaults to IQ (B18). Observation is Per/A; Per+1 costs 4.
    expect(sheet.skills).toContain("Observation (Per/A)-12 [4]");
  });

  it("keeps an unpriced choice on the sheet, with no bracket and the reason", () => {
    const secret = sheet.disadvantages.find(l => l.startsWith("Secret"));
    expect(secret).toBe(
      'Secret (Ex-cultist) - not priced: the book prices this "-5 to -30", so a person has to choose');
    expect(secret).not.toMatch(/\[/);
    expect(sheet.unpriced).toBe(1);
  });

  it("states the total of what it priced, and the budget reads that as a floor", () => {
    // 40 + 20 + 15 - 15 + 8 + 4
    expect(sheet.pointTotal).toBe("72");
    const read = pointBuild(sheet as unknown as Record<string, unknown>);
    expect(read.computed).toBe(72);
    expect(read.unreadable).toHaveLength(1);
    expect(read.complete).toBe(false);
  });

  it("finds nothing to correct in what it priced itself", () => {
    const out = checkMechanics(sheet as unknown as Record<string, unknown>, index);
    expect(out.findings).toEqual([]);
  });

  it("hands back what the model said it could not price", () => {
    expect(sheet.leftToGM).toEqual(["A Patron: the Hunters"]);
    expect(leftToGMBlock(sheet.leftToGM)).toBe("Left to the GM:\n- A Patron: the Hunters");
    expect(leftToGMBlock([])).toBe("");
  });

  it("writes a sheet even when the model sent nothing usable", () => {
    const empty = sheetFromBuild(undefined, index);
    expect(empty.attributes).toHaveLength(10);
    expect(empty.pointTotal).toBe("0");
  });

  it("writes everything unpriced, rather than dropping it, when no catalogue is loaded", () => {
    const bare = sheetFromBuild(build, null);
    expect(bare.advantages[0]).toMatch(/^Combat Reflexes - Reacts first\.; not priced:/);
    expect(bare.unpriced).toBe(5);
  });
});

describe("a build Gemini 2.5 Flash actually sent", () => {
  // The first live generation, 2026-10-05, trimmed to the entries that went
  // wrong. Each test below is a bug that run found and the unit tests above,
  // written from what a model was expected to send, did not.
  const live = buildIndex([
    { book_id: 1, kind: "skill", name: "Guns/TL", attr: "DX", difficulty: "E", specialised: true },
    { book_id: 1, kind: "skill", name: "Scuba/TL", attr: "IQ", difficulty: "A" },
    { book_id: 1, kind: "skill", name: "Observation", attr: "Per", difficulty: "A" },
  ]);
  const sheet = sheetFromBuild({ entries: [
    dumped({ kind: "attribute", name: "DX", score: 12.0 }),
    dumped({ kind: "attribute", name: "IQ", score: 11.0 }),
    dumped({ kind: "attribute", name: "Perception", score: 11.0 }),
    dumped({ kind: "skill", name: "Guns", specialty: "Pistol", tl: 8 }),
    dumped({ kind: "skill", name: "Guns", specialty: "Pistol", tl: 8, level: "DX+2" }),
    dumped({ kind: "skill", name: "Observation", tl: 8, level: "Per+2" }),
    dumped({ kind: "skill", name: "Scuba", tl: 8, level: "HT+1" }),
  ] }, live);

  it("reads 'Perception' as Per rather than writing a second one", () => {
    expect(sheet.attributes.filter(l => /^Per(ception)? /.test(l))).toEqual(["Per 11 [0]"]);
  });

  it("keeps the tech level the model dropped from the name", () => {
    expect(sheet.skills).toContain("Guns/TL8 (Pistol) (DX/E)-14 [4]");
  });

  it("bases Scuba on IQ, as the book does, not on the HT it was asked for", () => {
    expect(sheet.skills).toContain("Scuba/TL8 (IQ/A)-12 [4]");
  });

  it("drops a levelless duplicate of a skill that was priced", () => {
    expect(sheet.skills.filter(l => l.startsWith("Guns"))).toHaveLength(1);
    expect(sheet.unpriced).toBe(0);
  });

  it("leaves the checker nothing to say about any of it", () => {
    const out = checkMechanics(sheet as unknown as Record<string, unknown>, live);
    expect(out.findings).toEqual([]);
  });
});

describe("gear, written by the app", () => {
  it("writes every item Gemini sent for Test Rook as a line the sheet reads back", () => {
    // The same items, as fields. As strings, two of these came back with the
    // weight read as "9mm) [20] (0.5 lbs".
    const items = [
      { name: "Light Pistol", quantity: 1, weight: "1.5 lbs", cost: "$200", notes: "TL8, 2d-1 pi, Acc 3, RoF 3, Rcl 1" },
      { name: "Ammo, Pistol (9mm)", quantity: 20, weight: "0.5 lbs", cost: "$20", notes: "For light pistol" },
      { name: "Speargun", quantity: 1, weight: "3 lbs", cost: "$100", notes: "TL8, 1d+1 imp, Acc 2, RoF 1, underwater only" },
      { name: "Air Tank (Scuba)", quantity: 1, weight: "30 lbs", cost: "$500", notes: "TL8, 1 hour duration" },
      { name: "Utility Knife", quantity: 1, weight: "0.5 lbs", cost: "$20", notes: "TL8, 1d-3 cut, 1d-4 imp" },
    ];
    const lines = gearLines(items);
    expect(lines).toHaveLength(items.length);
    lines.forEach((line, i) => {
      const read = parseGear(line);
      expect(read).toEqual({ ...items[i], notes: items[i].notes });
    });
  });

  it("takes out what would break the line, from the part it would break", () => {
    const [line] = gearLines([{ name: "Rope [heavy]", quantity: 2, weight: "1,500 (approx) lbs", cost: "$5 (each)", notes: "x" }]);
    expect(parseGear(line)).toEqual({ name: "Rope heavy", quantity: 2, weight: "1500 approx lbs", cost: "$5 each", notes: "x" });
  });

  it("writes an unknown weight or cost as ?, never as 0", () => {
    const [line] = gearLines([{ name: "Relic", quantity: 0 }]);
    expect(line).toBe("Relic (?, ?)");
    expect(parseGear(line)).toMatchObject({ name: "Relic", quantity: 1, weight: "?", cost: "?" });
  });

  it("keeps a string the model sent instead of an item, and drops nothing else", () => {
    expect(gearLines(["Medkit (2 lbs, $100)", { name: "" }, null, 7])).toEqual(["Medkit (2 lbs, $100)"]);
    expect(gearLines(undefined)).toEqual([]);
  });
});

describe("deepening a sheet that already exists", () => {
  it("prices new skills against the scores the file already has", () => {
    // The merge keeps the file's DX 14. A skill priced against the model's
    // DX 10 would be written at a level the character does not reach.
    const existing = { attributes: ["ST 10 [0]", "DX 14 [80]", "IQ 10 [0]", "HT 10 [0]"] };
    const sheet = sheetFromBuild({ entries: [
      dumped({ kind: "attribute", name: "DX", score: 10 }),
      dumped({ kind: "skill", name: "Guns/TL", specialty: "Pistol", tl: 8, level: "DX+1" }),
    ] }, index, existing);
    expect(sheet.skills).toEqual(["Guns/TL8 (Pistol) (DX/E)-15 [2]"]);
  });

  it("reads scores from the campaign's own attribute lines", () => {
    expect(statedScores(["DX 14 [80]", "Basic Speed 6.25 [5]", "Parry N/A [0]", 7]))
      .toEqual({ DX: 14, "Basic Speed": 6.25 });
  });
});
