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

/** Type one character at a time onto whatever the field is showing. */
function typeInto(get: () => HTMLInputElement, text: string) {
  for (const letter of text) {
    const field = get();
    const next = field.value + letter;
    fireEvent.change(field, { target: { value: next, selectionStart: next.length } });
  }
}

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

  it("in a piece of gear's notes", () => {
    render(<Harness Editor={GearEditorList} initial={["Knife [1] (0.5, $40)"]} />);
    const get = () => screen.getByPlaceholderText(/^Notes/) as HTMLInputElement;
    typeInto(get, "worn on the belt");
    expect(get().value).toBe("worn on the belt");
  });
});
