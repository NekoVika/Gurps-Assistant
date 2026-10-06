import { describe, it, expect } from "vitest";
import { auditTraits, buildIndex, campaignVocabulary, isCustom, unrecognisedAcross, type CustomTrait } from "./traitAudit";
import { render, wasPriced } from "./characterBuild";
import type { CatalogueEntry } from "./traitResolver";

const book = (name: string, kind: string, cost = "15"): CatalogueEntry =>
  ({ book_id: 1, kind, name, cost_text: cost, cost_kind: "flat", cost_value: Number(cost) || null });

const CATALOGUE = [
  book("Combat Reflexes", "advantage"),
  book("Bad Temper", "disadvantage", "-10"),
  book("Brawling", "skill", ""),
];

// Two creature traits this campaign uses constantly and no book contains.
const CUSTOM: CustomTrait[] = [
  { name: "Sharp Teeth", kind: "advantage", cost: "5", notes: "1d-1 cutting bite" },
  { name: "Wild Animal", kind: "disadvantage", cost: "-30" },
];

const INDEX = buildIndex(CATALOGUE, CUSTOM);

const creature = {
  pointTotal: "40",
  advantages: ["Combat Reflexes [15]", "Sharp Teeth [5]", "Rot-Sense [12]"],
  disadvantages: ["Wild Animal [-30]"],
  skills: ["Brawling (DX+1)-13 [2]"],
};

describe("where each line's price comes from", () => {
  it("separates the book's traits from the campaign's from the unknown", () => {
    const audit = auditTraits(creature, INDEX);
    expect(audit.entries.map(e => [e.entry.name, e.provenance])).toEqual([
      ["Combat Reflexes", "catalogued"],
      ["Sharp Teeth", "custom"],
      ["Rot-Sense", "unrecognised"],
      ["Wild Animal", "custom"],
      ["Brawling", "catalogued"],
    ]);
    expect([audit.catalogued, audit.custom, audit.unrecognised.length]).toEqual([2, 2, 1]);
  });

  it("marks a campaign trait so the UI can say whose price it used", () => {
    const audit = auditTraits(creature, INDEX);
    const teeth = audit.entries.find(e => e.entry.name === "Sharp Teeth")!;
    expect(isCustom(teeth.source)).toBe(true);
    expect(teeth.source?.cost_text).toBe("5");
  });

  it("lets the campaign's price win over a book's", () => {
    // It is the GM's table. If they have repriced Combat Reflexes, that is the
    // price, and the app does not argue.
    const index = buildIndex(CATALOGUE, [{ name: "Combat Reflexes", kind: "advantage", cost: "20" }]);
    const found = auditTraits({ advantages: ["Combat Reflexes [20]"] }, index).entries[0];
    expect(found.provenance).toBe("custom");
    expect(found.source?.cost_text).toBe("20");
  });

  it("does not audit attributes, which are formulaic rather than priced", () => {
    const audit = auditTraits({ attributes: ["ST 11 [10]"], advantages: [] }, INDEX);
    expect(audit.entries).toEqual([]);
  });

  it("looks in the right kind", () => {
    // "Brawling" is a skill; an advantage of that name is not the same thing.
    const audit = auditTraits({ advantages: ["Brawling [2]"] }, INDEX);
    expect(audit.entries[0].provenance).toBe("unrecognised");
  });

  it("ignores a declared trait with no name", () => {
    const index = buildIndex(CATALOGUE, [{ name: "  ", kind: "advantage", cost: "5" }]);
    expect(auditTraits({ advantages: ["Rot-Sense [12]"] }, index).unrecognised).toHaveLength(1);
  });
});

describe("what nobody prices, across the campaign", () => {
  const cast = [
    creature,
    { advantages: ["Rot-Sense [12]"], disadvantages: [] },
    { advantages: ["Rot-Sense [12]", "Combat Reflexes [15]"], skills: ["Spelunking (DX/A)-12 [4]"] },
  ];

  it("counts uses so the commonest gap comes first", () => {
    expect(unrecognisedAcross(cast, INDEX)).toEqual([
      { name: "Rot-Sense", kind: "advantage", uses: 3 },
      { name: "Spelunking", kind: "skill", uses: 1 },
    ]);
  });

  it("is empty once everything has been declared or catalogued", () => {
    const index = buildIndex(CATALOGUE, [
      ...CUSTOM,
      { name: "Rot-Sense", kind: "advantage", cost: "12" },
      { name: "Spelunking", kind: "skill", cost: "" },
    ]);
    expect(unrecognisedAcross(cast, index)).toEqual([]);
  });

  it("survives a cast with nothing in it", () => {
    expect(unrecognisedAcross([], INDEX)).toEqual([]);
  });
});

describe("the campaign's own skills", () => {
  const index = buildIndex(
    [{ book_id: 1, kind: "skill", name: "Stealth", attr: "DX", difficulty: "A" } as CatalogueEntry],
    [{ name: "Struggling", kind: "disadvantage", cost: "-5" }],
    [{ name: "Rumour-Mongering", attr: "IQ", difficulty: "A" }]);

  it("are priced when the AI chooses one, like a book skill", () => {
    const out = render({ kind: "skill", name: "Rumour-Mongering", level: "IQ+1" }, { IQ: 11 }, index);
    if (!wasPriced(out)) throw new Error(out.problem);
    expect(out.line).toBe("Rumour-Mongering (IQ/A)-12 [4]");
  });

  it("count as the campaign's, not as unrecognised", () => {
    const audit = auditTraits({ skills: ["Rumour-Mongering (IQ/A)-12 [4]"] }, index);
    expect(audit.entries[0].provenance).toBe("custom");
    expect(audit.unrecognised).toEqual([]);
  });

  it("are named to the model with their attribute and difficulty", () => {
    const told = campaignVocabulary(index);
    expect(told).toContain("Rumour-Mongering (IQ/A)");
    expect(told).toContain("Struggling (disadvantage, -5)");
    expect(told).not.toContain("Stealth");
  });

  it("say nothing to the model when nothing is declared", () => {
    expect(campaignVocabulary(buildIndex([]))).toBe("");
    expect(campaignVocabulary(null)).toBe("");
  });
});
