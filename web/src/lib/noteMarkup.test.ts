import { describe, it, expect } from "vitest";
import { parseNote, pathLabel, looksLikePath, noteText, plainName } from "./noteMarkup";

/**
 * The markup a trait's note actually carries, taken from the campaign.
 *
 * Jamie's Bernkastel Blessing is the hard case: eight hundred characters of
 * prose with emphasis, a directory citation and a file citation written before
 * the campaign moved from Markdown to JSON.
 */

const BLESSING =
  "Cooldown: 24 Hours. Tokens: **5** (Lambdadelta is fully aware). "
  + "Post-Chapter-08 (Planned) Stage Edit: After "
  + "`Campaign/03_Story/Episode_03_Watcher_of_the_Rain/Chapter_08/`, the witches may rewrite "
  + "the Blessing into a **Focused** version. (Details: "
  + "`Campaign/03_Story/Episode_03_Watcher_of_the_Rain/Chapter_08/Encounters/03_Gift_And_Release.md`.)";

describe("reading a path a GM wrote down", () => {
  it("names a file by its last meaningful part", () => {
    expect(pathLabel("Campaign/03_Story/Ep/Chapter_08/Encounters/03_Gift_And_Release.md"))
      .toBe("Gift And Release");
  });

  it("names a directory the same way, trailing slash or not", () => {
    expect(pathLabel("Campaign/03_Story/Ep/Chapter_08/")).toBe("Chapter 08");
    expect(pathLabel("Campaign/03_Story/Ep/Chapter_08")).toBe("Chapter 08");
  });

  it("knows a path from a piece of prose in backticks", () => {
    expect(looksLikePath("Campaign/03_Story/Chapter_08/")).toBe(true);
    expect(looksLikePath("state.json")).toBe(true);
    expect(looksLikePath("3d-2")).toBe(false);
    expect(looksLikePath("roll vs. HT")).toBe(false);
  });
});

describe("breaking a note into its pieces", () => {
  it("finds both citations in the Blessing and keeps their order", () => {
    const links = parseNote(BLESSING).filter(p => p.kind === "link");
    expect(links.map(l => l.text)).toEqual(["Chapter 08", "Gift And Release"]);
    expect(links[1].kind === "link" && links[1].path).toContain("03_Gift_And_Release.md");
  });

  it("reads emphasis rather than showing the asterisks", () => {
    const emphasised = parseNote(BLESSING).filter(p => p.kind === "emphasis");
    expect(emphasised.map(e => e.text)).toEqual(["5", "Focused"]);
  });

  it("puts the whole note back together unchanged", () => {
    // Every character the GM wrote is still accounted for in some piece.
    const rebuilt = parseNote(BLESSING).map(p => p.text).join("");
    expect(rebuilt).toContain("the witches may rewrite the Blessing into a");
    expect(rebuilt).not.toContain("**");
    expect(rebuilt).not.toContain("`");
  });

  it("leaves backticked prose that is not a path as text", () => {
    // A GM writing dice in backticks means the dice.
    const pieces = parseNote("Bite does `3d-2` cutting.");
    expect(pieces.every(p => p.kind === "text")).toBe(true);
    expect(noteText("Bite does `3d-2` cutting.")).toBe("Bite does 3d-2 cutting.");
  });

  it("reads the migrated markdown link form", () => {
    const pieces = parseNote("See [the encounter](Campaign/03_Story/Ep/Chapter_08/Gift.json).");
    const link = pieces.find(p => p.kind === "link");
    expect(link && link.kind === "link" && link.text).toBe("the encounter");
    expect(link && link.kind === "link" && link.path).toBe("Campaign/03_Story/Ep/Chapter_08/Gift.json");
  });

  it("falls back to the path's own name when the link has no label", () => {
    const pieces = parseNote("See [](Campaign/03_Story/Ep/Chapter_08/Gift_And_Release.json).");
    const link = pieces.find(p => p.kind === "link");
    expect(link && link.kind === "link" && link.text).toBe("Gift And Release");
  });

  it("survives a note with no markup at all", () => {
    expect(parseNote("Reacts quickly.")).toEqual([{ kind: "text", text: "Reacts quickly." }]);
  });

  it("survives an empty note", () => {
    expect(parseNote("")).toEqual([]);
    expect(noteText("")).toBe("");
  });

  it("does not lose text that follows the last citation", () => {
    const pieces = parseNote("See `a/b.json` and then stop.");
    expect(pieces[pieces.length - 1]).toEqual({ kind: "text", text: " and then stop." });
  });
});

describe("showing a trait's name", () => {
  it("drops the bold the campaign writes around every name", () => {
    expect(plainName("**Danger Sense**")).toBe("Danger Sense");
    expect(plainName("**Sign Language: Tactical Police Signs**"))
      .toBe("Sign Language: Tactical Police Signs");
  });

  it("leaves a plain name alone", () => {
    expect(plainName("Chronic Pain")).toBe("Chronic Pain");
    expect(plainName("")).toBe("");
  });

  it("keeps a name that only looks like markup", () => {
    // Nothing in the Basic Set is called this, but losing characters silently
    // would be worse than keeping an odd one.
    expect(plainName("Luck*")).toBe("Luck*");
  });
});
