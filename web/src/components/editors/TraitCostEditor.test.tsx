import { useState } from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { TraitCostEditor } from "./TraitCostEditor";
import { useCampaignStore } from "../../stores/useCampaignStore";
import { buildIndex } from "../../lib/traitAudit";

/**
 * The editor that stops the error being made rather than reporting it.
 *
 * Two behaviours matter more than the rest and are tested hardest: a new row
 * gets its cost worked out, and a saved row never has its cost changed without
 * the GM pressing something. The second is the whole reason this is not simply
 * automatic — a tool that rewrites a sheet while you look at it is not giving
 * advice.
 */

const index = buildIndex(
  [
    { book_id: 1, kind: "advantage", name: "Combat Reflexes", cost_text: "15",
      cost_kind: "flat", cost_value: 15, page: 43 },
    { book_id: 1, kind: "advantage", name: "Damage Resistance", cost_text: "5/level",
      cost_kind: "per_level", cost_value: 5, page: 46 },
    { book_id: 1, kind: "advantage", name: "Allies", cost_text: "Variable",
      cost_kind: "variable", cost_value: null, page: 36 },
    { book_id: 1, kind: "disadvantage", name: "Bad Temper", cost_text: "-10*",
      cost_kind: "flat", cost_value: -10, self_control: true, page: 124 },
  ],
  [{ name: "Sharp Teeth", kind: "advantage", cost: "1" }]);

beforeEach(() => useCampaignStore.setState({ traitIndex: index }));

const editor = (items: string[], kind: "advantage" | "disadvantage" = "advantage") => {
  const onChange = vi.fn();
  render(<TraitCostEditor title="Advantages" kind={kind} items={items} onChange={onChange} />);
  return onChange;
};

const nameBox = (index = 0) => screen.getAllByPlaceholderText("Trait name")[index];
const pointsBox = (index = 0) => screen.getAllByPlaceholderText("Pts")[index];

describe("picking a trait instead of typing a cost", () => {
  it("offers the catalogue for the kind being edited", () => {
    editor([]);
    const list = document.getElementById("catalogue-advantage");
    const offered = within(list as HTMLElement).queryAllByRole("option", { hidden: true });
    const values = offered.map(o => (o as HTMLOptionElement).value);
    expect(values).toContain("Combat Reflexes");
    expect(values).not.toContain("Bad Temper");   // a disadvantage
  });

  it("lists the campaign's own traits before the book's", () => {
    editor([]);
    const list = document.getElementById("catalogue-advantage");
    const values = within(list as HTMLElement)
      .queryAllByRole("option", { hidden: true })
      .map(o => (o as HTMLOptionElement).value);
    expect(values[0]).toBe("Sharp Teeth");
  });

  it("works out the cost of a trait the GM has just named", () => {
    const onChange = editor([" [0]"]);
    fireEvent.change(nameBox(), { target: { value: "Combat Reflexes" } });
    expect(onChange).toHaveBeenCalledWith(["Combat Reflexes [15]"]);
  });

  it("prices the campaign's own trait at the campaign's own figure", () => {
    const onChange = editor([" [0]"]);
    fireEvent.change(nameBox(), { target: { value: "Sharp Teeth" } });
    expect(onChange).toHaveBeenCalledWith(["Sharp Teeth [1]"]);
  });

  it("asks for a level only where the book charges per level", () => {
    editor(["Damage Resistance [0]"]);
    expect(screen.getByPlaceholderText("Levels")).toBeInTheDocument();
  });

  it("does not ask for a level on a flat-cost trait", () => {
    editor(["Combat Reflexes [15]"]);
    expect(screen.queryByPlaceholderText("Levels")).not.toBeInTheDocument();
  });

  it("prices a levelled trait once the level is given", () => {
    const onChange = editor(["Damage Resistance [0]"]);
    fireEvent.change(screen.getByPlaceholderText("Levels"), { target: { value: "8" } });
    expect(onChange).toHaveBeenCalledWith(["Damage Resistance 8 [40]"]);
  });

  it("offers the four self-control numbers the book uses, and no others", () => {
    editor(["Bad Temper [0]"], "disadvantage");
    const options = within(screen.getByTitle("Self-control number (B123)"))
      .getAllByRole("option").map(o => o.textContent);
    expect(options).toEqual(["CR …", "CR 6", "CR 9", "CR 12", "CR 15"]);
  });

  it("applies the self-control multiplier when one is chosen (B123)", () => {
    const onChange = editor(["Bad Temper [0]"], "disadvantage");
    fireEvent.change(screen.getByTitle("Self-control number (B123)"), { target: { value: "9" } });
    expect(onChange).toHaveBeenCalledWith(["Bad Temper (9) [-15]"]);
  });
});

describe("what it will not do to a sheet already written", () => {
  it("leaves a saved cost alone even when it disagrees with the book", () => {
    const onChange = editor(["Combat Reflexes [25]"]);
    expect(onChange).not.toHaveBeenCalled();
    expect((pointsBox() as HTMLInputElement).value).toBe("25");
  });

  it("shows the book's figure beside a cost that disagrees", () => {
    editor(["Combat Reflexes [25]"]);
    expect(screen.getByText(/the rules give 15 for this/)).toBeInTheDocument();
  });

  it("changes a saved cost only when the GM asks for it", () => {
    const onChange = editor(["Combat Reflexes [25]"]);
    fireEvent.click(screen.getByRole("button", { name: "Use 15" }));
    expect(onChange).toHaveBeenCalledWith(["Combat Reflexes [15]"]);
  });

  it("offers no button when the sheet and the book already agree", () => {
    editor(["Combat Reflexes [15]"]);
    expect(screen.queryByRole("button", { name: /^Use / })).not.toBeInTheDocument();
    expect(screen.getByText(/the book charges 15/)).toBeInTheDocument();
  });

  it("keeps the note and the trait apart when writing the line back", () => {
    const onChange = editor(["Combat Reflexes [15] - Reacts first."]);
    fireEvent.change(pointsBox(), { target: { value: "16" } });
    expect(onChange).toHaveBeenCalledWith(["Combat Reflexes [16] - Reacts first."]);
  });
});

describe("where the rules decline", () => {
  it("still takes a cost for a trait the book prices Variable", () => {
    const onChange = editor(["Allies [20]"]);
    expect((pointsBox() as HTMLInputElement).value).toBe("20");
    fireEvent.change(pointsBox(), { target: { value: "30" } });
    expect(onChange).toHaveBeenCalledWith(["Allies [30]"]);
  });

  it("says why it could not work the cost out", () => {
    editor(["Allies [20]"]);
    expect(screen.getByText(/a person has to choose/)).toBeInTheDocument();
  });

  it("sends the GM to their own table for undeclared homebrew", () => {
    editor(["Rot-Sense [12]"]);
    expect(screen.getByText(/in no catalogue/)).toBeInTheDocument();
  });

  it("says nothing at all about an empty row", () => {
    editor([" [0]"]);
    expect(screen.queryByText(/in no catalogue/)).not.toBeInTheDocument();
  });

  it("keeps working with no catalogue loaded at all", () => {
    useCampaignStore.setState({ traitIndex: null });
    const onChange = editor(["Combat Reflexes [15]"]);
    fireEvent.change(pointsBox(), { target: { value: "20" } });
    expect(onChange).toHaveBeenCalledWith(["Combat Reflexes [20]"]);
  });
});

describe("the list itself", () => {
  it("adds an empty row, with no cost nobody gave", () => {
    // It used to be stored as " [0]" -- a real cost on this sheet (B23, B51).
    const onChange = editor(["Combat Reflexes [15]"]);
    fireEvent.click(screen.getByRole("button", { name: "+ Add Trait" }));
    expect(onChange).toHaveBeenCalledWith(["Combat Reflexes [15]", ""]);
  });

  it("removes the row the GM pressed", () => {
    const onChange = editor(["Combat Reflexes [15]", "Allies [20]"]);
    fireEvent.click(screen.getAllByRole("button", { name: "✕" })[0]);
    expect(onChange).toHaveBeenCalledWith(["Allies [20]"]);
  });

  it("reorders without touching the costs", () => {
    const onChange = editor(["Combat Reflexes [15]", "Allies [20]"]);
    fireEvent.click(screen.getAllByRole("button", { name: "▼" })[0]);
    expect(onChange).toHaveBeenCalledWith(["Allies [20]", "Combat Reflexes [15]"]);
  });
});

describe("a trait that needed more than one line", () => {
  // Jamie's own shape: a homebrew advantage followed by its details, each
  // priced at zero because the array holds one line per entry.
  const blessing = [
    "Bernkastel Blessing [20]",
    "Cooldown [0] - 24 Hours.",
    "Ability [0] - Turns a critical success into a critical failure.",
  ];

  it("offers to fold a line the rules could not price into the one above", () => {
    editor(blessing);
    // Each row folds into the row directly above it, so a chain is cleared
    // from the top: fold Cooldown in, and Ability then sits under the Blessing.
    const offers = screen.getAllByRole("button", { name: /fold into/ })
      .map(b => b.textContent);
    expect(offers).toEqual(["fold into Bernkastel Blessing", "fold into Bernkastel Blessing"]);
  });

  it("clears a chain of details one line at a time", () => {
    const onChange = editor(blessing);
    fireEvent.click(screen.getAllByRole("button", { name: /fold into/ })[0]);
    expect(onChange).toHaveBeenLastCalledWith([
      "Bernkastel Blessing [20] - Cooldown: 24 Hours.",
      "Ability [0] - Turns a critical success into a critical failure.",
    ]);
  });

  it("folds the line in with its label kept", () => {
    const onChange = editor(blessing);
    fireEvent.click(screen.getAllByRole("button", { name: /fold into/ })[0]);
    expect(onChange).toHaveBeenCalledWith([
      "Bernkastel Blessing [20] - Cooldown: 24 Hours.",
      "Ability [0] - Turns a critical success into a critical failure.",
    ]);
  });

  it("appends rather than replacing what the trait already said", () => {
    const onChange = editor([
      "Bernkastel Blessing [20] - A gift from a witch.",
      "Cooldown [0] - 24 Hours.",
    ]);
    fireEvent.click(screen.getByRole("button", { name: /fold into/ }));
    expect(onChange).toHaveBeenCalledWith(
      ["Bernkastel Blessing [20] - A gift from a witch. Cooldown: 24 Hours."]);
  });

  it("never offers it on the first line, which has nothing above it", () => {
    editor(["Cooldown [0] - 24 Hours."]);
    expect(screen.queryByRole("button", { name: /fold into/ })).not.toBeInTheDocument();
  });

  it("does not offer it for a trait the rules priced", () => {
    // Combat Reflexes is a trait in its own right, not a note on anything.
    editor(["Bernkastel Blessing [20]", "Combat Reflexes [15]"]);
    expect(screen.queryByRole("button", { name: /fold into/ })).not.toBeInTheDocument();
  });

  it("leaves a legitimate nought-point trait alone", () => {
    // A native culture is free (B23), and the catalogue prices it, so it is
    // never mistaken for a note on the trait above.
    const withCulture = buildIndex([
      { book_id: 1, kind: "advantage", name: "Combat Reflexes", cost_text: "15",
        cost_kind: "flat", cost_value: 15, page: 43 },
      { book_id: 1, kind: "advantage", name: "Free Culture", cost_text: "0",
        cost_kind: "flat", cost_value: 0, page: 23 },
    ]);
    useCampaignStore.setState({ traitIndex: withCulture });
    render(<TraitCostEditor title="Advantages" kind="advantage"
      items={["Combat Reflexes [15]", "Free Culture [0]"]} onChange={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /fold into/ })).not.toBeInTheDocument();
  });
});

/**
 * A parent that actually holds the list, which is what the character editor
 * is. Without one the bug is invisible: onChange carries the right string and
 * nothing ever feeds the re-parsed, trimmed version back into the field.
 */
function Harness({ initial, kind = "advantage" as const }: { initial: string[]; kind?: "advantage" | "disadvantage" }) {
  const [items, setItems] = useState(initial);
  return <TraitCostEditor title="Advantages" kind={kind} items={items} onChange={setItems} />;
}

describe("typing in a note", () => {
  it("lets a space be typed", () => {
    // Every keystroke serialises the row and parses it back, and the parser
    // trims -- so a space, which is always trailing at the moment it is
    // typed, was eaten before the next letter arrived.
    render(<Harness initial={["Combat Reflexes [15] - Reacts"]} />);
    const note = screen.getByPlaceholderText(/^Notes/) as HTMLTextAreaElement;
    fireEvent.change(note, { target: { value: "Reacts ", selectionStart: 7 } });
    expect((screen.getByPlaceholderText(/^Notes/) as HTMLTextAreaElement).value).toBe("Reacts ");
  });

  it("lets a whole phrase be typed, one keystroke at a time", () => {
    render(<Harness initial={["Combat Reflexes [15]"]} />);
    // Each keystroke is appended to what the field is actually showing, which
    // is the only way the loss of a character shows up at all.
    for (const letter of "Reacts first in a fight") {
      const note = screen.getByPlaceholderText(/^Notes/) as HTMLTextAreaElement;
      const next = note.value + letter;
      fireEvent.change(note, { target: { value: next, selectionStart: next.length } });
    }
    expect((screen.getByPlaceholderText(/^Notes/) as HTMLTextAreaElement).value)
      .toBe("Reacts first in a fight");
  });

  it("lets a space be typed in a trait's name", () => {
    render(<Harness initial={["Combat [15]"]} />);
    const name = screen.getByPlaceholderText("Trait name") as HTMLInputElement;
    fireEvent.change(name, { target: { value: "Combat " } });
    expect((screen.getByPlaceholderText("Trait name") as HTMLInputElement).value).toBe("Combat ");
  });

  it("still takes a list changed from outside", () => {
    const { rerender } = render(
      <TraitCostEditor title="Advantages" kind="advantage"
        items={["Combat Reflexes [15]"]} onChange={vi.fn()} />);
    rerender(
      <TraitCostEditor title="Advantages" kind="advantage"
        items={["Danger Sense [15]"]} onChange={vi.fn()} />);
    expect((screen.getByPlaceholderText("Trait name") as HTMLInputElement).value)
      .toBe("Danger Sense");
  });
});

describe("what it preserves when it writes a line back", () => {
  it("keeps the emphasis the campaign wrote around a name", () => {
    // Most of this campaign's trait names are written "**Danger Sense**", and
    // the sheet renders the emphasis. Dropping it on save edits the GM's text
    // without being asked.
    const onChange = vi.fn();
    render(<TraitCostEditor title="Advantages" kind="advantage"
      items={["**Danger Sense** [15]", "Combat Reflexes [15]"]} onChange={onChange} />);
    fireEvent.click(screen.getAllByRole("button", { name: "▼" })[0]);
    expect(onChange).toHaveBeenLastCalledWith(
      ["Combat Reflexes [15]", "**Danger Sense** [15]"]);
  });

  it("keeps emphasis inside a note", () => {
    const onChange = vi.fn();
    const note = "Tokens [0] - **5** awareness, now a **Focused** version";
    render(<TraitCostEditor title="Advantages" kind="advantage"
      items={[note, "Combat Reflexes [15]"]} onChange={onChange} />);
    fireEvent.click(screen.getAllByRole("button", { name: "▼" })[0]);
    expect(onChange).toHaveBeenLastCalledWith(["Combat Reflexes [15]", note]);
  });

  it("never stamps [0] on a line the app left unpriced", () => {
    // Walter White's sheet, saved during the 0.5 manual check: every unpriced
    // advantage came back ending in " [0]" though nobody touched it.
    const line = "Strong Will 2 - Adds 2 to Will rolls.; not priced: this name is in no catalogue";
    const onChange = vi.fn();
    render(<TraitCostEditor title="Advantages" kind="advantage"
      items={[line, "Combat Reflexes [15]"]} onChange={onChange} />);
    fireEvent.click(screen.getAllByRole("button", { name: "▼" })[0]);
    expect(onChange).toHaveBeenLastCalledWith(["Combat Reflexes [15]", line]);
  });

  it("reads an unpriced line as a name and a note", () => {
    editor(["Allies (Old unit) - not priced: the book prices this \"Variable\""]);
    expect((nameBox() as HTMLInputElement).value).toBe("Allies");
    expect((screen.getByPlaceholderText(/^Notes/) as HTMLTextAreaElement).value)
      .toBe("not priced: the book prices this \"Variable\"");
    expect((pointsBox() as HTMLInputElement).value).toBe("");
  });

  it("prices it once the GM settles it, and drops the stale reason", () => {
    render(<Harness initial={["Bad Temperament - Snaps at people.; not priced: this name is in no catalogue"]} kind="disadvantage" />);
    fireEvent.change(nameBox(), { target: { value: "Bad Temper" } });
    fireEvent.change(screen.getByLabelText(/self-control/i), { target: { value: "12" } });
    expect((pointsBox() as HTMLInputElement).value).toBe("-10");
    expect((screen.getByPlaceholderText(/^Notes/) as HTMLTextAreaElement).value).toBe("Snaps at people.");
  });

  it("writes no bracket when the GM clears a cost", () => {
    const onChange = editor(["Combat Reflexes [15]"]);
    fireEvent.change(pointsBox(), { target: { value: "" } });
    expect(onChange).toHaveBeenLastCalledWith(["Combat Reflexes"]);
  });

  it("leaves a line alone that is only reordered", () => {
    const onChange = vi.fn();
    render(<TraitCostEditor title="Advantages" kind="advantage"
      items={["**Ambidexterity** [5]", "Combat Reflexes [15]"]} onChange={onChange} />);
    fireEvent.click(screen.getAllByRole("button", { name: "▼" })[0]);
    expect(onChange).toHaveBeenLastCalledWith(
      ["Combat Reflexes [15]", "**Ambidexterity** [5]"]);
  });
});
