import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { SkillEditorList, AttributeEditorList, GearEditorList } from "./StructuredArrayEditors";

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

  it("explains a skill line it cannot read", () => {
    render(<Holder Editor={SkillEditorList} initial={["B ()- [0] - rawling (DX/E)-16 [[4]]"]} />);
    expect(screen.getByText(/not read as a skill/)).toBeTruthy();
  });

  it("leaves a line that already says why to say it", () => {
    render(<Holder Editor={SkillEditorList} initial={["Diving - at HT+2; not priced: no catalogue entry"]} />);
    expect(screen.queryByText(/not read as a skill/)).toBeNull();
  });

  it("reads gear whose name has parentheses", () => {
    render(<Holder Editor={GearEditorList} initial={["Commlink (Handheld) [1] (0.5 lbs, $500) - TL8"]} />);
    expect(screen.getByDisplayValue("Commlink (Handheld)")).toBeTruthy();
    expect(screen.getByDisplayValue("0.5 lbs")).toBeTruthy();
  });
});

describe("spaces survive being typed", () => {
  it("in a skill's notes", () => {
    render(<Harness Editor={SkillEditorList} initial={["Stealth (DX/A)-14 [4]"]} />);
    const get = () => screen.getByPlaceholderText("Notes") as HTMLInputElement;
    typeInto(get, "moves in shadow");
    expect(get().value).toBe("moves in shadow");
  });

  it("in a skill's name", () => {
    render(<Harness Editor={SkillEditorList} initial={["Stealth (DX/A)-14 [4]"]} />);
    const get = () => screen.getAllByRole("textbox")[0] as HTMLInputElement;
    fireEvent.change(get(), { target: { value: "" } });
    typeInto(get, "Fast Talk");
    expect(get().value).toBe("Fast Talk");
  });

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
