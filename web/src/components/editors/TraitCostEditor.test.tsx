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
  it("adds an empty row", () => {
    const onChange = editor(["Combat Reflexes [15]"]);
    fireEvent.click(screen.getByRole("button", { name: "+ Add Trait" }));
    expect(onChange).toHaveBeenCalledWith(["Combat Reflexes [15]", " [0]"]);
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
