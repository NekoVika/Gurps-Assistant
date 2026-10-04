import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { MentionTextarea } from "./MentionTextarea";
import { useCampaignStore } from "../../stores/useCampaignStore";

/**
 * Writing a reference without typing a path.
 *
 * Ninety of the ninety-three file references written by hand in this
 * campaign's prose are dead, all of them .md paths the migration to JSON left
 * behind. A name is looked up in the registry instead, so the reference holds
 * when a file is renamed, moved or converted.
 */

const registry = [
  { id: "Gift_And_Release", title: "Gift and Release", type: "Encounter",
    path: "Campaign/03_Story/Ep3/Chapter_08/Encounters/Gift_And_Release.json" },
  { id: "Gate", title: "The Gate", type: "Location", path: "Campaign/01_World_Bible/Locations/Gate.json" },
  { id: "Bernkastel", title: "Bernkastel", type: "Character", path: "Campaign/02_Characters/Main_Cast/Bernkastel.json" },
  { id: "Giant_Spider", title: "Giant Spider", type: "Character", path: "Campaign/02_Characters/Bestiary/Giant_Spider.json" },
];

beforeEach(() => useCampaignStore.setState({ entityRegistry: registry as never[] }));

/**
 * A controlled field needs a parent that actually holds the value, or picking
 * an entity splices the insertion into whatever the value was at mount.
 */
function Harness({ initial, onChange }: { initial: string; onChange: (v: string) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <MentionTextarea
      value={value}
      onChange={next => { setValue(next); onChange(next); }}
      placeholder="Notes"
    />
  );
}

const field = (initial = "") => {
  const onChange = vi.fn();
  const view = render(<Harness initial={initial} onChange={onChange} />);
  return { onChange, box: screen.getByPlaceholderText("Notes") as HTMLTextAreaElement, view };
};

/**
 * Type into the box, cursor at the end.
 *
 * Only fireEvent sets the value: assigning box.value first makes React's own
 * value tracker see no change and skip the handler entirely.
 */
const type = (box: HTMLTextAreaElement, text: string, cursor = text.length) => {
  fireEvent.change(box, { target: { value: text, selectionStart: cursor, selectionEnd: cursor } });
};

describe("reaching for an entity with @", () => {
  it("says nothing until an @ is typed", () => {
    const { box } = field();
    type(box, "Cooldown: 24 hours.");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("offers the campaign's entities on @", () => {
    const { box } = field();
    type(box, "See @");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getAllByRole("option").length).toBe(4);
  });

  it("narrows as the name is typed", () => {
    const { box } = field();
    type(box, "See @gif");
    const shown = screen.getAllByRole("option").map(o => o.textContent);
    expect(shown).toHaveLength(1);
    expect(shown[0]).toContain("Gift and Release");
  });

  it("puts a name that starts with the query above one that merely contains it", () => {
    const { box } = field();
    type(box, "@g");
    const shown = screen.getAllByRole("option").map(o => o.textContent || "");
    // "Gift and Release" and "Gate" begin with g; "Giant Spider" does too.
    // "Bernkastel" does not appear at all.
    expect(shown.some(s => s.includes("Bernkastel"))).toBe(false);
    expect(shown[0]).toMatch(/Gift and Release|Gate|Giant Spider/);
  });

  it("shows what kind of thing each one is", () => {
    const { box } = field();
    type(box, "@gift");
    expect(screen.getByRole("option").textContent).toContain("Encounter");
  });

  it("does not open on an @ in the middle of a word", () => {
    // An email address in a note is not a reference.
    const { box } = field();
    type(box, "mail jamie@example");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it.each([
    ["at the end of a finished sentence", "Cooldown: 24 Hours.@"],
    ["after a comma", "Cooldown,@"],
    ["after an opening bracket", "(@"],
    ["after a space", "Cooldown. @"],
    ["on a new line", "Cooldown.\n@"],
  ])("opens %s", (_label, text) => {
    // Requiring a space in front of the @ meant it opened only on an empty
    // note, since a note almost always ends in a full stop.
    const { box } = field();
    type(box, text);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("offers the same thing every time on a bare @", () => {
    // File-tree order put "dummy" and "state" at the top. Alphabetical is at
    // least predictable.
    const { box } = field();
    type(box, "@");
    const shown = screen.getAllByRole("option").map(o => o.textContent || "");
    const names = shown.map(s => s.replace(/(Encounter|Location|Character)$/, ""));
    expect([...names].sort((a, b) => a.localeCompare(b))).toEqual(names);
  });

  it("leaves out a registry entry that is still named after its file", () => {
    useCampaignStore.setState({ entityRegistry: [
      ...registry,
      { id: "Karin", title: "Karin.json", type: "Unknown", path: "Campaign/.trash/x.meta.json" },
    ] as never[] });
    const { box } = field();
    type(box, "@");
    expect(screen.queryByText(/Karin\.json/)).not.toBeInTheDocument();
  });
});

describe("what picking writes", () => {
  it("inserts the name in double brackets, not a path", () => {
    const { box, onChange } = field();
    type(box, "Details: @gift");
    fireEvent.mouseDown(screen.getByRole("option"));
    expect(onChange).toHaveBeenLastCalledWith("Details: [[Gift and Release]]");
  });

  it("keeps whatever followed the cursor", () => {
    const { box, onChange } = field();
    type(box, "See @gift later.", 9);   // cursor sits right after "@gift"
    fireEvent.mouseDown(screen.getByRole("option"));
    expect(onChange).toHaveBeenLastCalledWith("See [[Gift and Release]] later.");
  });

  it("picks with the keyboard", () => {
    const { box, onChange } = field();
    type(box, "@gift");
    fireEvent.keyDown(box, { key: "Enter" });
    expect(onChange).toHaveBeenLastCalledWith("[[Gift and Release]]");
  });

  it("moves the highlight with the arrow keys", () => {
    const { box, onChange } = field();
    type(box, "@");
    // Whatever the menu puts second is what the second one down inserts; the
    // order itself is the alphabetical sort's business, not this test's.
    const second = screen.getAllByRole("option")[1];
    const name = second.firstElementChild?.textContent;
    fireEvent.keyDown(box, { key: "ArrowDown" });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(onChange).toHaveBeenLastCalledWith(`[[${name}]]`);
  });

  it("closes without writing anything on Escape", () => {
    const { box, onChange } = field();
    type(box, "@gift");
    onChange.mockClear();
    fireEvent.keyDown(box, { key: "Escape" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("leaves Enter alone when no menu is open", () => {
    // A note is prose; pressing Enter in it should make a new line.
    const { box } = field();
    type(box, "Cooldown: 24 hours.");
    const event = fireEvent.keyDown(box, { key: "Enter" });
    expect(event).toBe(true);   // not prevented
  });
});

describe("with no campaign loaded", () => {
  it("still takes typing", () => {
    useCampaignStore.setState({ entityRegistry: [] });
    const { box, onChange } = field();
    type(box, "Cooldown: 24 hours.");
    expect(onChange).toHaveBeenLastCalledWith("Cooldown: 24 hours.");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
