import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { AttributeEditorList, GearEditorList } from "./StructuredArrayEditors";

/**
 * Typing into a list editor.
 *
 * Each of these derives its rows from the stored strings on every render, so a
 * keystroke is serialised onto a line and parsed straight back off it. Every
 * parser trims, and a space is trailing at the instant it is typed, so it
 * never survived to the next letter.
 */

function Harness({ Editor, initial }: { Editor: React.ComponentType<any>; initial: string[] }) {
  const [items, setItems] = useState(initial);
  return <Editor title="Things" items={items} onChange={setItems} />;
}

/** A Harness that also shows what the document now holds. */
function Holder({ Editor, initial }: { Editor: React.ComponentType<any>; initial: string[] }) {
  const [items, setItems] = useState(initial);
  return <><Editor title="Things" items={items} onChange={setItems} /><pre data-testid="stored">{JSON.stringify(items)}</pre></>;
}
const stored = () => JSON.parse(screen.getByTestId("stored").textContent || "[]") as string[];

/** Type one character at a time onto whatever the field is showing. */
function typeInto(get: () => HTMLInputElement, text: string) {
  for (const letter of text) {
    const field = get();
    const next = field.value + letter;
    fireEvent.change(field, { target: { value: next, selectionStart: next.length } });
  }
}

describe("attributes, priced by the app", () => {
  const score = (name: string) => screen.getByLabelText(`${name} score`) as HTMLInputElement;
  const points = (name: string) => screen.getByLabelText(`${name} points`) as HTMLInputElement;

  it("takes the book's cost with the score while it was the book's (B16)", () => {
    render(<Holder Editor={AttributeEditorList} initial={["DX 12 [40]"]} />);
    fireEvent.change(score("DX"), { target: { value: "13" } });
    expect(stored()).toContain("DX 13 [60]");
  });

  it("keeps a figure the GM set, and shows the book's beside it", () => {
    render(<Holder Editor={AttributeEditorList} initial={["DX 12 [35]"]} />);
    fireEvent.change(score("DX"), { target: { value: "13" } });
    expect(stored()).toContain("DX 13 [35]");
    expect(screen.getByText("the book gives 60 for DX 13")).toBeTruthy();
    fireEvent.click(screen.getByText("Use 60"));
    expect(stored()).toContain("DX 13 [60]");
  });

  it("prices a stub's first attribute, which had no line at all", () => {
    // Step 7 of the manual check: a stub, then DX 14 set by hand.
    render(<Holder Editor={AttributeEditorList} initial={[]} />);
    fireEvent.change(score("DX"), { target: { value: "14" } });
    expect(stored()).toEqual(["DX 14 [80]"]);
  });

  it("shows a missing secondary at its real default, not 10", () => {
    // HP is ST, Per is IQ (B18).
    render(<Holder Editor={AttributeEditorList} initial={["ST 13 [30]", "IQ 12 [40]"]} />);
    expect(score("HP").value).toBe("13");
    expect(score("Per").value).toBe("12");
  });

  it("prices a secondary against the attribute it comes from", () => {
    render(<Holder Editor={AttributeEditorList} initial={["ST 11 [10]", "HP 11 [0]"]} />);
    fireEvent.change(score("HP"), { target: { value: "13" } });
    expect(stored()).toContain("HP 13 [4]");
  });

  it("never rewrites another attribute's line, and says what it now costs", () => {
    // Raising ST changes what HP 13 costs. The HP line is the GM's; the book's
    // figure is shown with a button instead.
    render(<Holder Editor={AttributeEditorList} initial={["ST 11 [10]", "HP 13 [4]"]} />);
    fireEvent.change(score("ST"), { target: { value: "12" } });
    expect(stored()).toEqual(["ST 12 [20]", "HP 13 [4]"]);
    expect(screen.getByText("the book gives 2 for HP 13")).toBeTruthy();
    expect(points("HP").value).toBe("4");
  });
});

describe("what the editor calls malformed", () => {
  it("does not call a defence malformed because it is not one of the ten", () => {
    // Blue Lizard: "Dodge 10 [0]", "Parry N/A [0]", "Block N/A [0]" were all
    // listed under "Unrecognized / Malformed Attributes".
    render(<Holder Editor={AttributeEditorList} initial={["ST 12 [20]", "Dodge 10 [0]", "Parry N/A [0]", "Block N/A [0]"]} />);
    expect(screen.queryByText(/Malformed/)).toBeNull();
    expect(screen.getByText("Defences & Other")).toBeTruthy();
    expect(screen.getAllByDisplayValue("N/A")).toHaveLength(2);
  });

  it("still lists a line it cannot read, and says what it expected", () => {
    render(<Holder Editor={AttributeEditorList} initial={["Will 14 [0]; Per 14 [0]"]} />);
    expect(screen.getByText(/Malformed/)).toBeTruthy();
    expect(screen.getByText(/expected Name Level \[Points\]/)).toBeTruthy();
  });

  
  
  it("reads gear whose name has parentheses", () => {
    render(<Holder Editor={GearEditorList} initial={["Commlink (Handheld) [1] (0.5 lbs, $500) - TL8"]} />);
    expect(screen.getByDisplayValue("Commlink (Handheld)")).toBeTruthy();
    expect(screen.getByDisplayValue("0.5 lbs")).toBeTruthy();
  });
});

describe("spaces survive being typed", () => {
  
  
  it("in an attribute that is not one of the ten", () => {
    render(<Holder Editor={AttributeEditorList} initial={["Parry N/A [0]"]} />);
    const get = () => screen.getByDisplayValue("N/A") as HTMLInputElement;
    fireEvent.change(get(), { target: { value: "" } });
    typeInto(() => screen.getAllByTitle("Level").at(-1) as HTMLInputElement, "9 (Knife)");
    expect(stored()).toContain("Parry 9 (Knife) [0]");
  });

  it("in a piece of gear's notes", () => {
    render(<Harness Editor={GearEditorList} initial={["Knife [1] (0.5, $40)"]} />);
    const get = () => screen.getByPlaceholderText(/^Notes/) as HTMLInputElement;
    typeInto(get, "worn on the belt");
    expect(get().value).toBe("worn on the belt");
  });
});
