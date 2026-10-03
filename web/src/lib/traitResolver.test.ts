import { describe, it, expect } from "vitest";
import {
  buildTraitIndex, normaliseTrait, resolveTrait, traitAliases,
  type CatalogueEntry,
} from "./traitResolver";

const entry = (name: string, kind: string, over: Partial<CatalogueEntry> = {}): CatalogueEntry =>
  ({ book_id: 1, kind, name, cost_text: "15", cost_kind: "flat", cost_value: 15, ...over });

// Names exactly as the Basic Set prints them, including the ones that caused
// the misses: a dagger skill stored generically, and plural family headings.
const CATALOGUE = [
  entry("Combat Reflexes", "advantage"),
  entry("Acute Hearing", "advantage", { cost_text: "2/level", cost_kind: "per_level", cost_value: 2 }),
  entry("Patrons", "advantage", { cost_text: "Variable", cost_kind: "variable", cost_value: null }),
  entry("Lame", "disadvantage", { cost_text: "-10 to -30", cost_kind: "range", cost_value: null }),
  entry("Phobias", "disadvantage", { cost_text: "Variable", cost_kind: "variable" }),
  entry("Bad Temper", "disadvantage", { cost_text: "-10*", cost_value: -10, self_control: true }),
  entry("Guns/TL", "skill", { specialised: true, cost_kind: "formula" }),
  entry("Knife", "skill", { cost_kind: "formula" }),
  entry("Stealth", "skill", { cost_kind: "formula" }),
  entry("Damage Resistance", "advantage", { cost_text: "5/level", cost_kind: "per_level", cost_value: 5 }),
  entry("360° Vision", "advantage", { cost_text: "25", cost_value: 25 }),
];

const INDEX = buildTraitIndex(CATALOGUE);

describe("matching a sheet's trait to the book's", () => {
  it.each([
    ["Combat Reflexes", "Combat Reflexes"],
    ["**Combat Reflexes**", "Combat Reflexes"],          // migration markdown
    ["combat reflexes", "Combat Reflexes"],
    ["Lame (Major)", "Lame"],                             // a specialty
    ["Phobia (Spiders)", "Phobias"],                      // singular on the sheet
    ["Patron", "Patrons"],
    ["Guns/TL8 (Pistol)", "Guns/TL"],                     // tech level and specialty
    ["Guns/TL9", "Guns/TL"],
    ["Knife", "Knife"],
    ["Damage Resistance 2", "Damage Resistance"],        // the level is the character's
    ["Night Vision 5", null],                            // not in this fixture
  ])("resolves %p to %p", (written, expected) => {
    expect(resolveTrait(written, INDEX).entry?.name ?? null).toBe(expected);
  });

  it("keeps a number that is part of the name rather than a level", () => {
    expect(resolveTrait("360° Vision", INDEX).entry?.name).toBe("360° Vision");
  });

  it("brings the cost back with the match", () => {
    const found = resolveTrait("Guns/TL8 (Pistol)", INDEX).entry;
    expect(found?.specialised).toBe(true);
    expect(resolveTrait("Acute Hearing", INDEX).entry?.cost_value).toBe(2);
  });

  it("says which form matched, so a surprising match can be explained", () => {
    expect(resolveTrait("Phobia (Spiders)", INDEX).matchedAs).toBe("phobias");
  });

  it("can be told which kind to look in", () => {
    // A sheet's advantages array should not match a skill of the same name.
    expect(resolveTrait("Stealth", INDEX, "advantage").entry).toBeNull();
    expect(resolveTrait("Stealth", INDEX, "skill").entry?.name).toBe("Stealth");
  });
});

describe("what it refuses to do", () => {
  it("reports an unknown trait rather than guessing at the nearest", () => {
    // It may be homebrew, which the GM is entitled to invent.
    const found = resolveTrait("Rot-Sense", INDEX);
    expect(found.entry).toBeNull();
    expect(found.matchedAs).toBe("");
  });

  it("does not match a trait that merely starts the same", () => {
    expect(resolveTrait("Combat", INDEX).entry).toBeNull();
    expect(resolveTrait("Combat Reflexes and Then Some", INDEX).entry).toBeNull();
  });

  it("handles an empty or absent name", () => {
    expect(resolveTrait("", INDEX).entry).toBeNull();
    expect(traitAliases("   ")).toEqual([]);
  });

  it("flags a name two books both price", () => {
    const shared = buildTraitIndex([
      entry("Danger Sense", "advantage"),
      entry("Danger Sense", "advantage", { book_id: 2, cost_value: 20 }),
    ]);
    const found = resolveTrait("Danger Sense", shared);
    expect(found.ambiguous).toBe(true);
    expect(found.entry?.book_id).toBe(1);
  });
});

describe("normalising a name", () => {
  it.each([
    ["**Danger Sense**", "danger sense"],
    ["Fortune-Telling", "fortune-telling"],
    ["  Acute   Hearing  ", "acute hearing"],
    ["Rider’s Bond", "riders bond"],
  ])("reduces %p to %p", (input, expected) => {
    expect(normaliseTrait(input)).toBe(expected);
  });

  it("offers the specialty-stripped form before the plural guess", () => {
    const aliases = traitAliases("Guns/TL8 (Pistol)");
    expect(aliases[0]).toBe("guns/tl8 (pistol)");
    expect(aliases).toContain("guns/tl");
  });
});
