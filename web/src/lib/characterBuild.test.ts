import { describe, it, expect } from "vitest";
import { buildSheet, render, wasPriced, type BuildEntry } from "./characterBuild";
import { buildIndex } from "./traitAudit";
import { parseEntry, pointBuild } from "./pointBuild";
import { checkMechanics } from "./mechanicsCheck";

/**
 * The renderer only earns its keep if what it writes is what the app already
 * reads. So the tests that matter most here are round-trips: render a chosen
 * entry, parse it back with the parser the campaign files go through, and
 * check the facts survived — then run the checker over the finished sheet and
 * require it to find nothing, because a sheet the app priced itself has no
 * business disagreeing with the app.
 */

const index = buildIndex([
  { book_id: 1, kind: "skill", name: "Guns/TL", attr: "DX", difficulty: "E", specialised: true },
  { book_id: 1, kind: "skill", name: "Stealth", attr: "DX", difficulty: "A" },
  { book_id: 1, kind: "skill", name: "Diplomacy", attr: "IQ", difficulty: "H" },
  { book_id: 1, kind: "advantage", name: "Combat Reflexes", cost_text: "15",
    cost_kind: "flat", cost_value: 15 },
  { book_id: 1, kind: "advantage", name: "Damage Resistance", cost_text: "5/level",
    cost_kind: "per_level", cost_value: 5 },
  { book_id: 1, kind: "advantage", name: "Insubstantiality", cost_text: "80",
    cost_kind: "flat", cost_value: 80 },
  { book_id: 1, kind: "disadvantage", name: "Bad Temper", cost_text: "-10*",
    cost_kind: "flat", cost_value: -10, self_control: true },
  { book_id: 1, kind: "disadvantage", name: "Lame", cost_text: "-10 to -30",
    cost_kind: "range", cost_value: null },
  { book_id: 1, kind: "advantage", name: "Allies", cost_text: "Variable",
    cost_kind: "variable", cost_value: null },
]);

const scores = { ST: 11, DX: 12, IQ: 11, HT: 12 };

const line = (entry: BuildEntry, s = scores) => {
  const out = render(entry, s, index);
  if (!wasPriced(out)) throw new Error(`declined: ${out.problem}`);
  return out;
};

describe("writing the line the campaign already stores", () => {
  it("prices a primary attribute from its score (B16-17)", () => {
    expect(line({ kind: "attribute", name: "DX", score: 13 }).line).toBe("DX 13 [60]");
  });

  it("prices a secondary characteristic against what it comes from (B18-19)", () => {
    // HP 13 against ST 11 is two levels at 2 points each.
    expect(line({ kind: "attribute", name: "HP", score: 13 }).line).toBe("HP 13 [4]");
  });

  it("writes a derived attribute at zero rather than refusing it", () => {
    // Dodge is Basic Speed + 3; nobody buys it, so it costs nothing.
    expect(line({ kind: "attribute", name: "Dodge", score: 9 }).line).toBe("Dodge 9 [0]");
  });

  it("writes Basic Speed with the quarter the book prices in", () => {
    expect(line({ kind: "attribute", name: "Basic Speed", score: 6.25 }).line)
      .toBe("Basic Speed 6.25 [5]");
  });

  it("spells the difficulty out rather than labelling the level", () => {
    // `(DX+1)-11` can contradict itself and does on sheets already written.
    // `(DX/E)-14` states two independent facts, so it cannot.
    expect(line({ kind: "skill", name: "Guns/TL", specialty: "Pistol", tl: 8, level: "DX+3" }).line)
      .toBe("Guns/TL8 (Pistol) (DX/E)-15 [8]");
  });

  it("takes the difficulty from the book, never from the request", () => {
    // Diplomacy is IQ/Hard (B187). At Hard, IQ+0 costs 4.
    expect(line({ kind: "skill", name: "Diplomacy", level: "IQ" }).line)
      .toBe("Diplomacy (IQ/H)-11 [4]");
  });

  it("prices a levelled trait by its level", () => {
    expect(line({ kind: "advantage", name: "Damage Resistance", levels: 50 }).line)
      .toBe("Damage Resistance 50 [250]");
  });

  it("applies a self-control number to a printed cost (B123)", () => {
    expect(line({ kind: "disadvantage", name: "Bad Temper", selfControl: 9 }).line)
      .toBe("Bad Temper (9) [-15]");
  });

  it("totals modifiers and writes them as the sheet writes them (B103)", () => {
    // The book's own example on Bernkastel's sheet: 80 at +60% is 128.
    expect(line({
      kind: "advantage", name: "Insubstantiality",
      modifiers: [
        { name: "Affect Substantial", percent: 100 },
        { name: "Always On", percent: -50 },
        { name: "Switchable", percent: 10 },
      ],
    }).line).toBe(
      "Insubstantiality (Affect Substantial, +100%; Always On, -50%; Switchable, +10%) [128]");
  });

  it("keeps a note after the cost without pricing it", () => {
    expect(line({ kind: "advantage", name: "Combat Reflexes", notes: "Reacts first." }).line)
      .toBe("Combat Reflexes [15] - Reacts first.");
  });
});

describe("what it declines, and why", () => {
  const why = (entry: BuildEntry) => {
    const out = render(entry, scores, index);
    if (wasPriced(out)) throw new Error(`priced unexpectedly: ${out.line}`);
    return out.problem;
  };

  it("declines a trait the book prices as a range", () => {
    // Lame is -10 to -30, so which variety it is remains a person's call.
    expect(why({ kind: "disadvantage", name: "Lame", specialty: "Major" }))
      .toContain("a person has to choose");
  });

  it("declines a trait the book prices as Variable", () => {
    expect(why({ kind: "advantage", name: "Allies" })).toContain("a person has to choose");
  });

  it("declines a name no catalogue carries", () => {
    expect(why({ kind: "advantage", name: "Rot-Sense" })).toContain("in no catalogue");
  });

  it("declines a levelled trait with no level", () => {
    expect(why({ kind: "advantage", name: "Damage Resistance" })).toContain("per level");
  });

  it("asks for the self-control number the book requires", () => {
    expect(why({ kind: "disadvantage", name: "Bad Temper" })).toContain("self-control number");
  });

  it("declines a skill measured against an attribute that is not there", () => {
    expect(why({ kind: "skill", name: "Stealth", level: "Per+1" })).toContain("not on the sheet");
  });

  it("declines a skill with no level at all", () => {
    expect(why({ kind: "skill", name: "Stealth" })).toContain("needs a level");
  });

  it("names the trait it declined, so the GM can price it by hand", () => {
    const out = render({ kind: "advantage", name: "Allies" }, scores, index);
    expect(wasPriced(out)).toBe(false);
    if (!wasPriced(out)) expect(out.name).toBe("Allies");
  });
});

describe("what it writes, the app can read back", () => {
  it.each([
    ["attribute", { kind: "attribute", name: "DX", score: 13 }, "DX", 60],
    ["skill", { kind: "skill", name: "Guns/TL", specialty: "Rifle", tl: 8, level: "DX+2" },
      "Guns/TL8", 4],
    ["levelled trait", { kind: "advantage", name: "Damage Resistance", levels: 50 },
      "Damage Resistance 50", 250],
    ["self-control", { kind: "disadvantage", name: "Bad Temper", selfControl: 9 },
      "Bad Temper", -15],
    ["flat trait", { kind: "advantage", name: "Combat Reflexes" }, "Combat Reflexes", 15],
  ] as Array<[string, BuildEntry, string, number]>)(
    "round-trips a %s through the parser the campaign files use",
    (_what, entry, name, points) => {
      const written = line(entry);
      const read = parseEntry(written.line, entry.kind);
      expect(read.problem).toBe("");
      expect(read.name).toBe(name);
      expect(read.points).toBe(points);
      expect(read.points).toBe(written.points);
    });

  it("keeps a note out of the name when it is read back", () => {
    const written = line({ kind: "advantage", name: "Combat Reflexes", notes: "Reacts first." });
    const read = parseEntry(written.line, "advantage");
    expect(read.name).toBe("Combat Reflexes");
    expect(read.notes).toBe("Reacts first.");
  });
});

describe("a whole sheet, priced by the app", () => {
  const chosen: BuildEntry[] = [
    { kind: "attribute", name: "ST", score: 11 },
    { kind: "attribute", name: "DX", score: 12 },
    { kind: "attribute", name: "IQ", score: 11 },
    { kind: "attribute", name: "HT", score: 12 },
    { kind: "attribute", name: "HP", score: 11 },
    { kind: "attribute", name: "FP", score: 12 },
    { kind: "advantage", name: "Combat Reflexes" },
    { kind: "disadvantage", name: "Bad Temper", selfControl: 9 },
    { kind: "skill", name: "Guns/TL", specialty: "Pistol", tl: 8, level: "DX+3" },
    { kind: "skill", name: "Stealth", level: "DX+1" },
  ];

  it("states a total it computed rather than one it was told", () => {
    const sheet = buildSheet(chosen, index);
    // 10 + 40 + 20 + 20 + 0 + 0 + 15 - 15 + 8 + 4
    expect(sheet.pointTotal).toBe(102);
    expect(sheet.declined).toEqual([]);
  });

  it("agrees with the checker, because the same rules wrote it", () => {
    const sheet = buildSheet(chosen, index);
    const out = checkMechanics(sheet as unknown as Record<string, unknown>, index);
    expect(out.findings).toEqual([]);
    expect(out.notes).toEqual([]);
  });

  it("adds up to exactly what the sheet's own brackets say", () => {
    const sheet = buildSheet(chosen, index);
    const build = pointBuild(sheet as unknown as Record<string, unknown>);
    expect(build.computed).toBe(sheet.pointTotal);
    expect(build.complete).toBe(true);
  });

  it("prices a secondary characteristic against an attribute given later", () => {
    // The request need not be in order; attributes are rendered first.
    const sheet = buildSheet([
      { kind: "attribute", name: "HP", score: 13 },
      { kind: "attribute", name: "ST", score: 11 },
    ], index);
    expect(sheet.attributes).toEqual(["ST 11 [10]", "HP 13 [4]"]);
  });

  it("keeps building when one line cannot be priced", () => {
    const sheet = buildSheet([
      { kind: "attribute", name: "ST", score: 11 },
      { kind: "advantage", name: "Allies" },
      { kind: "advantage", name: "Combat Reflexes" },
    ], index);
    expect(sheet.advantages).toEqual(["Combat Reflexes [15]"]);
    expect(sheet.declined.map(d => d.name)).toEqual(["Allies"]);
    expect(sheet.pointTotal).toBe(25);
  });
});
