import { describe, it, expect } from "vitest";
import { prepareCharacterDraft, describeDraft } from "./characterDraft";
import { buildIndex } from "./traitAudit";

const index = buildIndex([
  { book_id: 1, kind: "skill", name: "Guns/TL", attr: "DX", difficulty: "E", specialised: true },
  { book_id: 1, kind: "skill", name: "Observation", attr: "Per", difficulty: "A" },
  { book_id: 1, kind: "advantage", name: "Combat Reflexes", cost_text: "15", cost_kind: "flat", cost_value: 15 },
  { book_id: 1, kind: "disadvantage", name: "Bad Temper", cost_text: "-10*",
    cost_kind: "flat", cost_value: -10, self_control: true },
  { book_id: 1, kind: "advantage", name: "Allies", cost_text: "Variable", cost_kind: "variable", cost_value: null },
]);

/** Killian as the campaign stores him, trimmed. */
const killian = {
  name: "Killian",
  pointTotal: "150",
  attributes: ["ST 11 [10]", "DX 14 [80]", "IQ 10 [0]", "HT 11 [10]"],
  advantages: ["**Danger Sense** [15] - Never surprised"],
  disadvantages: ["Bad Temper (12) [-10]", "Chronic Pain [-10] (Result of EOD accident)"],
  skills: ["Guns/TL8 (Rifle) (DX/E)-16 [4]"],
  gear: ["Commlink (Handheld) [1] (0.5 lbs, $500) - TL8"],
  gmSummary: "Hired muscle. Owes the Hunters.",
};
const original = JSON.stringify(killian, null, 2);
const prepare = (draft: Record<string, unknown>, from = original) =>
  prepareCharacterDraft(JSON.stringify(draft), from, index);
const read = (content: string) => JSON.parse(content) as Record<string, any>;

describe("a draft in the sectioned shape the assistant is now told to use", () => {
  it("raises a skill and adds a trait, priced against the sheet", () => {
    const { content, report } = prepare({ ...killian, build: {
      advantages: [{ name: "Combat Reflexes" }],
      skills: [{ name: "Guns/TL", specialty: "Rifle", level: "DX+3", tl: 8 }],
    } });
    const out = read(content);
    expect(out.skills).toEqual(["Guns/TL8 (Rifle) (DX/E)-17 [8]"]);
    expect(out.advantages).toContain("Combat Reflexes [15]");
    expect(report.priced).toBe(2);
  });
});

describe("a draft that changes a sheet that already exists", () => {
  it("adds a chosen skill, priced against the sheet's own DX", () => {
    const { content, report } = prepare({ ...killian, build: { entries: [
      { kind: "skill", name: "Guns/TL", specialty: "Pistol", tl: 8, level: "DX+1" },
    ] } });
    expect(read(content).skills).toEqual([
      "Guns/TL8 (Rifle) (DX/E)-16 [4]",
      "Guns/TL8 (Pistol) (DX/E)-15 [2]",
    ]);
    expect(report.priced).toBe(1);
    expect(report.modelWritten).toEqual([]);
  });

  it("replaces the line a choice is about, and leaves every other line exactly as it was", () => {
    const { content } = prepare({ ...killian, build: { entries: [
      { kind: "disadvantage", name: "Bad Temper", self_control: 9 },
    ] } });
    const out = read(content);
    expect(out.disadvantages).toEqual(["Bad Temper (9) [-15]", "Chronic Pain [-10] (Result of EOD accident)"]);
    // Markup and notes on lines the draft did not touch survive byte for byte.
    expect(out.advantages).toEqual(["**Danger Sense** [15] - Never surprised"]);
  });

  it("prices a skill against an attribute the same draft raises", () => {
    const { content } = prepare({ ...killian, build: { entries: [
      { kind: "attribute", name: "DX", score: 15 },
      { kind: "skill", name: "Guns/TL", specialty: "Pistol", tl: 8, level: "DX" },
    ] } });
    const out = read(content);
    expect(out.attributes).toContain("DX 15 [100]");
    expect(out.attributes).not.toContain("DX 14 [80]");
    expect(out.skills).toContain("Guns/TL8 (Pistol) (DX/E)-15 [1]");
  });

  it("measures a Per skill against the default when the sheet has no Per line", () => {
    const { content } = prepare({ ...killian, build: { entries: [
      { kind: "skill", name: "Observation", level: "Per+1" },
    ] } });
    expect(read(content).skills).toContain("Observation (Per/A)-11 [4]");
  });

  it("keeps the GM's stated total, whatever the model put there", () => {
    const { content } = prepare({ ...killian, pointTotal: "999", build: { entries: [] } });
    expect(read(content).pointTotal).toBe("150");
  });

  it("keeps the file's own key order, so the diff shows changes rather than shuffles", () => {
    const shuffled = { gmSummary: killian.gmSummary, skills: killian.skills, name: "Killian",
      pointTotal: "150", attributes: killian.attributes, advantages: killian.advantages,
      disadvantages: killian.disadvantages, gear: killian.gear };
    const { content } = prepare(shuffled);
    expect(content).toBe(original);
  });

  it("appends what the model could not price to the GM's summary", () => {
    const { content, report } = prepare({ ...killian, build: { entries: [], unpriceable: ["An Ally: his old unit"] } });
    expect(read(content).gmSummary).toBe("Hired muscle. Owes the Hunters.\n\nLeft to the GM:\n- An Ally: his old unit");
    expect(report.leftToGM).toBe(1);
  });

  it("keeps a choice it cannot price on the sheet, with the reason", () => {
    const { content, report } = prepare({ ...killian, build: { entries: [{ kind: "advantage", name: "Allies" }] } });
    expect(read(content).advantages.at(-1)).toMatch(/^Allies - not priced: /);
    expect(report.unpriced).toBe(1);
  });

  it("never lets the build itself reach the file", () => {
    const { content } = prepare({ ...killian, build: { entries: [] } });
    expect(read(content)).not.toHaveProperty("build");
  });
});

describe("what Gemini 2.5 Flash actually drafted for Test Rook", () => {
  // The first live chat draft, 2026-10-05. It copied the sheet and put its
  // choices under build, as asked -- and found two bugs.
  const rook = {
    name: "Test Rook", pointTotal: "88",
    attributes: ["DX 12 [40]", "IQ 11 [20]"],
    advantages: ["Fit [5]", "Acute Senses (Vision) - not priced: this name is in no catalogue"],
    skills: ["Guns (Pistol) (DX/E)-14 [4]", "Stealth (DX/A)-12 [2]"],
    gmSummary: "Left to the GM:\n- Patron (Salvage Company, 9 or less)",
  };
  const from = JSON.stringify(rook, null, 2);

  it("raises the skill it names, rather than adding a second one", () => {
    // It wrote "Guns (Pistol)" as the name, with no specialty field.
    const { content } = prepare({ ...rook, build: { entries: [
      { kind: "skill", name: "Guns (Pistol)", level: "DX+3" },
    ] } }, from);
    expect(read(content).skills).toEqual(["Guns (Pistol) (DX/E)-15 [8]", "Stealth (DX/A)-12 [2]"]);
  });

  it("does not repeat what the sheet and summary already say", () => {
    // It listed the sheet's own unpriced line as unpriceable, and the summary
    // grew a second "Left to the GM:" repeating it.
    const { content, report } = prepare({ ...rook, build: { entries: [], unpriceable: [
      "Acute Senses (Vision) - not priced: this name is in no catalogue",
      "Patron (Salvage Company, 9 or less)",
    ] } }, from);
    expect(read(content).gmSummary).toBe(rook.gmSummary);
    expect(report.leftToGM).toBe(0);
  });

  it("adds something new to the list that is already there", () => {
    const { content } = prepare({ ...rook, gmSummary: rook.gmSummary + "\n\nShe owes Killian.",
      build: { entries: [], unpriceable: ["Duty (Salvage Company)"] } }, from);
    expect(read(content).gmSummary).toBe(
      "Left to the GM:\n- Patron (Salvage Company, 9 or less)\n- Duty (Salvage Company)\n\nShe owes Killian.");
  });
});

describe("what the model wrote itself", () => {
  it("reports a line the model priced, without refusing it", () => {
    const { content, report } = prepare({ ...killian, advantages: [...killian.advantages, "Combat Reflexes [15]"] });
    expect(read(content).advantages).toContain("Combat Reflexes [15]");
    expect(report.modelWritten).toEqual(["Combat Reflexes [15]"]);
    expect(describeDraft(report)).toMatch(/1 line priced by the model, not the app/);
  });

  it("does not report the lines the sheet already had", () => {
    expect(prepare({ ...killian }).report.modelWritten).toEqual([]);
  });

  it("reports a line nobody can read", () => {
    const { report } = prepare({ ...killian, skills: [...killian.skills, "Brawling at DX+2"] });
    expect(report.unreadable).toEqual(["Brawling at DX+2"]);
  });

  it("shows a draft that is not JSON exactly as sent", () => {
    const { content, report } = prepareCharacterDraft("{ not json", original, index);
    expect(content).toBe("{ not json");
    expect(describeDraft(report)).toMatch(/not valid JSON/);
  });
});

describe("a draft for a new character", () => {
  it("writes every attribute and states the total its lines add up to", () => {
    const { content } = prepare({ name: "Rook", build: { entries: [
      { kind: "attribute", name: "DX", score: 12 },
      { kind: "advantage", name: "Combat Reflexes" },
    ] } }, "");
    const out = read(content);
    expect(out.attributes).toHaveLength(10);
    expect(out.attributes).toContain("DX 12 [40]");
    expect(out.pointTotal).toBe("55");
  });

  it("writes gear items as lines, and counts a model-written gear line it cannot read", () => {
    const { content, report } = prepare({ name: "Rook", gear: [
      { name: "Air Tank (Scuba)", quantity: 1, weight: "30 lbs", cost: "$500", notes: "TL8" },
      "Speargun, heavy one",
    ] }, "");
    expect(read(content).gear).toEqual(["Air Tank (Scuba) (30 lbs, $500) - TL8", "Speargun, heavy one"]);
    expect(report.unreadable).toEqual(["Speargun, heavy one"]);
  });
});
