import { describe, it, expect } from "vitest";
import { mergeGenerated, describeMerge, nothingLeftToFill } from "./mergeGenerated";

describe("deepening an entity that already exists", () => {
  it("fills a blank field", () => {
    const { merged, filled } = mergeGenerated({ name: "Rick", concept: "" }, { concept: "Lower Market trader" });
    expect(merged.concept).toBe("Lower Market trader");
    expect(filled).toEqual(["concept"]);
  });

  it("never replaces something the GM wrote", () => {
    // "Better" is not a judgement the app gets to make about someone's campaign.
    const { merged, kept } = mergeGenerated(
      { name: "Rick", personality: "Gruff. Hates the Watch." },
      { personality: "A cheerful and outgoing merchant." }
    );
    expect(merged.personality).toBe("Gruff. Hates the Watch.");
    expect(kept).toContain("personality");
  });

  it("keeps an existing list rather than merging into it", () => {
    const { merged } = mergeGenerated(
      { name: "Rick", skills: ["Merchant (IQ+1)-12 [4]"] },
      { skills: ["Brawling (DX)-10 [1]", "Fast-Talk (IQ)-10 [2]"] }
    );
    expect(merged.skills).toEqual(["Merchant (IQ+1)-12 [4]"]);
  });

  it("fills an empty list", () => {
    const { merged } = mergeGenerated({ name: "Rick", skills: [] }, { skills: ["Brawling (DX)-10 [1]"] });
    expect(merged.skills).toEqual(["Brawling (DX)-10 [1]"]);
  });

  it("treats the unset marker as a blank worth filling", () => {
    // CharacterData.pointTotal defaults to "???".
    const { merged } = mergeGenerated({ name: "Rick", pointTotal: "???" }, { pointTotal: "75" });
    expect(merged.pointTotal).toBe("75");
  });

  it("never renames the entity", () => {
    // A rename during deepening would orphan every link pointing at the old name.
    const { merged, filled } = mergeGenerated({ name: "Rick" }, { name: "Richard of the Lower Market", concept: "Trader" });
    expect(merged.name).toBe("Rick");
    expect(filled).not.toContain("name");
  });

  it("never retitles a story node", () => {
    const { merged } = mergeGenerated({ title: "The Drainage Awakening" }, { title: "Chapter 01" });
    expect(merged.title).toBe("The Drainage Awakening");
  });

  it("keeps fields the model said nothing about", () => {
    const { merged } = mergeGenerated({ name: "Rick", gmSummary: "Owes the Watch." }, { concept: "Trader" });
    expect(merged.gmSummary).toBe("Owes the Watch.");
  });

  it("ignores empty generated values instead of blanking a field", () => {
    const { merged, filled } = mergeGenerated({ name: "Rick", concept: "Trader" }, { concept: "", role: "" });
    expect(merged.concept).toBe("Trader");
    expect(filled).toEqual([]);
  });

  it("preserves placement the GM already set", () => {
    const existing = { name: "Rick", storyPlacement: { node: "Chapter 2", mode: "fixture" } };
    const { merged } = mergeGenerated(existing, { storyPlacement: { node: "Episode 3", mode: "appearance" } });
    expect(merged.storyPlacement).toEqual({ node: "Chapter 2", mode: "fixture" });
  });

  it("is safe to run twice — the second pass changes nothing", () => {
    const first = mergeGenerated({ name: "Rick", concept: "" }, { concept: "Trader" });
    const second = mergeGenerated(first.merged, { concept: "Something else" });
    expect(second.merged).toEqual(first.merged);
    expect(second.filled).toEqual([]);
  });
});

describe("describeMerge", () => {
  it("says what was filled and that nothing was overwritten", () => {
    const line = describeMerge({ merged: {}, filled: ["concept", "role"], kept: ["personality"] });
    expect(line).toContain("concept, role");
    expect(line).toContain("Nothing you had written was changed");
  });

  it("summarises a long list", () => {
    const line = describeMerge({ merged: {}, filled: ["a", "b", "c", "d", "e", "f"], kept: [] });
    expect(line).toContain("and 2 more");
  });

  it("is honest when there was nothing to add", () => {
    expect(describeMerge({ merged: {}, filled: [], kept: ["concept"] })).toContain("already written");
  });
});

describe('nothingLeftToFill', () => {
  const required = ['name', 'appearance', 'personality'];

  it('is false when a contracted field is still blank', () => {
    expect(nothingLeftToFill({ name: 'Killian', appearance: 'Scarred.', personality: '' }, required)).toBe(false);
  });

  it('is true only when every contracted field is written', () => {
    expect(nothingLeftToFill({ name: 'Killian', appearance: 'Scarred.', personality: 'Gruff.' }, required)).toBe(true);
  });

  it('ignores fields outside the contract', () => {
    // Relations and placement are the GM's; the model is told to leave them, so
    // a blank there is no reason to spend a generation.
    const full = { name: 'K', appearance: 'a', personality: 'p', characterRelations: [], location: '' };
    expect(nothingLeftToFill(full, required)).toBe(true);
  });

  it('never skips when there is no contract to judge by', () => {
    // Wrongly skipping looks exactly like the no-op bug, so absent a required
    // list the generation must run.
    expect(nothingLeftToFill({ name: 'K' }, undefined)).toBe(false);
    expect(nothingLeftToFill({ name: 'K' }, [])).toBe(false);
  });

  it('treats a placeholder as blank, the way the editor does', () => {
    expect(nothingLeftToFill({ name: 'K', appearance: '???', personality: 'p' }, required)).toBe(false);
  });
});
