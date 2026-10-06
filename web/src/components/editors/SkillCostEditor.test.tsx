import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { SkillCostEditor } from "./SkillCostEditor";
import { useCampaignStore } from "../../stores/useCampaignStore";
import { buildIndex } from "../../lib/traitAudit";

/**
 * The skill editor, tested through a parent that holds the list -- a vi.fn()
 * parent never feeds the written value back, and two editor bugs in 0.5 hid
 * behind exactly that.
 */

const index = buildIndex([
  { book_id: 1, kind: "skill", name: "Guns/TL", attr: "DX", difficulty: "E", specialised: true, page: 198 },
  { book_id: 1, kind: "skill", name: "Stealth", attr: "DX", difficulty: "A", page: 222 },
  { book_id: 1, kind: "skill", name: "Armoury/TL", attr: "IQ", difficulty: "A", specialised: true, page: 178 },
]);
beforeEach(() => useCampaignStore.setState({ traitIndex: index }));

const DX12 = ["ST 10 [0]", "DX 12 [40]", "IQ 11 [20]", "HT 11 [10]"];

function Holder({ initial, attributes = DX12, advantages = [] }: { initial: string[]; attributes?: string[]; advantages?: string[] }) {
  const [items, setItems] = useState(initial);
  return <>
    <SkillCostEditor title="Skills" items={items} onChange={setItems} attributes={attributes} advantages={advantages} />
    <pre data-testid="stored">{JSON.stringify(items)}</pre>
  </>;
}
const stored = () => JSON.parse(screen.getByTestId("stored").textContent || "[]") as string[];
const field = (label: string, i = 0) => screen.getAllByLabelText(label)[i] as HTMLInputElement;

describe("pricing from the level the GM types", () => {
  it("works the points out and writes the line that states its difficulty", () => {
    render(<Holder initial={[]} />);
    fireEvent.click(screen.getByText("+ Add Skill"));
    fireEvent.change(field("Skill name"), { target: { value: "Guns/TL" } });
    fireEvent.change(field("Specialty"), { target: { value: "Pistol" } });
    fireEvent.change(field("Tech level"), { target: { value: "8" } });
    fireEvent.change(field("Level"), { target: { value: "14" } });
    expect(field("Points").value).toBe("4");
    expect(stored()).toEqual(["Guns/TL8 (Pistol) (DX/E)-14 [4]"]);
    expect(screen.getByText(/DX\+2 · 4 pts/)).toBeTruthy();
  });

  it("lets the points follow the level while they are the book's", () => {
    render(<Holder initial={["Stealth (DX/A)-12 [2]"]} />);
    fireEvent.change(field("Level"), { target: { value: "13" } });
    expect(stored()).toEqual(["Stealth (DX/A)-13 [4]"]);
  });

  it("keeps a figure the GM typed, and shows the table's beside it", () => {
    render(<Holder initial={["Stealth (DX/A)-12 [5]"]} />);
    fireEvent.change(field("Level"), { target: { value: "13" } });
    expect(stored()).toEqual(["Stealth (DX/A)-13 [5]"]);
    expect(screen.getByText("the table gives 4 for this")).toBeTruthy();
    fireEvent.click(screen.getByText("Use 4"));
    expect(stored()).toEqual(["Stealth (DX/A)-13 [4]"]);
  });

  it("rewrites an old-notation line in the form that cannot contradict itself, once edited", () => {
    // Abella's: labelled DX+1, on DX 11, at 11 -- really DX+0.
    render(<Holder initial={["Stealth (DX+1)-11 [2]"]} attributes={["DX 11 [20]"]} />);
    fireEvent.change(field("Level"), { target: { value: "12" } });
    expect(stored()).toEqual(["Stealth (DX/A)-12 [4]"]);
  });

  it("offers the book's attribute where a line uses another", () => {
    render(<Holder initial={["Armoury/TL8 (Small Arms) (DX+1)-13 [4]"]} attributes={["DX 11 [20]", "IQ 12 [40]"]} />);
    expect(screen.getByText("the book bases this on IQ")).toBeTruthy();
    fireEvent.click(screen.getByText("Use IQ"));
    expect(stored()).toEqual(["Armoury/TL8 (Small Arms) (IQ/A)-13 [4]"]);
  });
});

describe("a skill of the GM's own", () => {
  it("asks for its attribute and difficulty, then prices it from the same table", () => {
    render(<Holder initial={[]} />);
    fireEvent.click(screen.getByText("+ Add Skill"));
    fireEvent.change(field("Skill name"), { target: { value: "Rumour-Mongering" } });
    fireEvent.change(field("Level"), { target: { value: "12" } });
    expect(screen.getByText("your own skill")).toBeTruthy();
    expect(screen.getByText("choose the attribute it is based on")).toBeTruthy();
    fireEvent.change(field("Based on"), { target: { value: "IQ" } });
    fireEvent.change(field("Difficulty"), { target: { value: "A" } });
    expect(stored()).toEqual(["Rumour-Mongering (IQ/A)-12 [4]"]);
  });
});

describe("what it leaves alone", () => {
  it("writes back untouched lines exactly, damaged and old ones included", () => {
    const lines = ["B ()- [0] - rawling (DX/E)-16 [[4]]", "Axe/Mace (DX+1)-11 [2]", "Stealth (DX/A)-12 [2]"];
    render(<Holder initial={lines} />);
    fireEvent.click(screen.getAllByLabelText("Move down")[0]);
    expect(stored()).toEqual([lines[1], lines[0], lines[2]]);
  });

  it("reports a line it cannot read, and turns it into a row once corrected", () => {
    render(<Holder initial={["B ()- [0] - rawling (DX/E)-16 [[4]]"]} />);
    expect(screen.getByText(/not read as a skill \(2 costs on one line\)/)).toBeTruthy();
    fireEvent.change(field("Skill line as written"), { target: { value: "Brawling (DX/E)-16 [4]" } });
    expect((screen.getByLabelText("Skill name") as HTMLInputElement).value).toBe("Brawling");
  });

  it("lets a space be typed, in a name and in a note", () => {
    render(<Holder initial={["Stealth (DX/A)-12 [2]"]} />);
    fireEvent.change(field("Skill name"), { target: { value: "Fast " } });
    expect(field("Skill name").value).toBe("Fast ");
    const note = screen.getByPlaceholderText(/^Notes/) as HTMLTextAreaElement;
    fireEvent.change(note, { target: { value: "moves in ", selectionStart: 9 } });
    expect((screen.getByPlaceholderText(/^Notes/) as HTMLTextAreaElement).value).toBe("moves in ");
  });
});

describe("when an attribute changes under the skills", () => {
  const skills = ["Guns/TL8 (Pistol) (DX/E)-14 [4]", "Stealth (DX/A)-12 [2]", "Armoury/TL8 (Small Arms) (IQ/A)-11 [2]"];

  it("asks before moving anything, and raises only the skills on that attribute", () => {
    const { rerender } = render(<Holder initial={skills} />);
    expect(screen.queryByRole("status")).toBeNull();
    rerender(<Holder initial={skills} attributes={["ST 10 [0]", "DX 13 [60]", "IQ 11 [20]", "HT 11 [10]"]} />);
    expect(screen.getByRole("status").textContent).toMatch(/DX changed 12 → 13.*2 skills based on DX would rise by 1/);
    expect(stored()).toEqual(skills);   // nothing moved yet
    fireEvent.click(screen.getByText("Raise their levels"));
    // Same points, one level higher: that is what raising DX buys (B170).
    expect(stored()).toEqual([
      "Guns/TL8 (Pistol) (DX/E)-15 [4]",
      "Stealth (DX/A)-13 [2]",
      "Armoury/TL8 (Small Arms) (IQ/A)-11 [2]",
    ]);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("leaves the levels when the GM says not now", () => {
    const { rerender } = render(<Holder initial={skills} />);
    rerender(<Holder initial={skills} attributes={["DX 13 [60]", "IQ 11 [20]"]} />);
    fireEvent.click(screen.getByText("Not now"));
    expect(stored()).toEqual(skills);
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("campaign skills on a sheet", () => {
  it("prices one declared in System Rules, and says it is the campaign's", () => {
    useCampaignStore.setState({ traitIndex: buildIndex([], [], [{ name: "Rumour-Mongering", attr: "IQ", difficulty: "A" }]) });
    render(<Holder initial={[]} />);
    fireEvent.click(screen.getByText("+ Add Skill"));
    fireEvent.change(field("Skill name"), { target: { value: "Rumour-Mongering" } });
    fireEvent.change(field("Level"), { target: { value: "12" } });
    expect(stored()).toEqual(["Rumour-Mongering (IQ/A)-12 [4]"]);
    expect(screen.getByText(/campaign skill/)).toBeTruthy();
    expect(screen.queryByText("your own skill")).toBeNull();
  });

  it("offers to declare a skill of the GM's own, once it has an attribute and a difficulty", async () => {
    const declare = vi.fn().mockResolvedValue({ ok: true, message: "Rumour-Mongering is now a campaign skill." });
    useCampaignStore.setState({ declareCampaignSkill: declare });
    render(<Holder initial={[]} />);
    fireEvent.click(screen.getByText("+ Add Skill"));
    fireEvent.change(field("Skill name"), { target: { value: "Rumour-Mongering" } });
    expect(screen.queryByText("Make it a campaign skill")).toBeNull();
    fireEvent.change(field("Based on"), { target: { value: "IQ" } });
    fireEvent.change(field("Difficulty"), { target: { value: "A" } });
    fireEvent.click(screen.getByText("Make it a campaign skill"));
    expect(declare).toHaveBeenCalledWith({ name: "Rumour-Mongering", attr: "IQ", difficulty: "A",
      tl: false, specialised: false, defaults: "IQ-5" });
    expect(await screen.findByText("Rumour-Mongering is now a campaign skill.")).toBeTruthy();
  });
});

describe("a Talent on the sheet (B89)", () => {
  beforeEach(() => useCampaignStore.setState({ traitIndex: buildIndex([
    { book_id: 1, kind: "skill", name: "Accounting", attr: "IQ", difficulty: "H", page: 174 },
  ]) }));

  it("prices Arthur Vance's Accounting without the Talent's bonus, and says so", () => {
    render(<Holder initial={["Accounting (IQ/H)-16 [4] - Includes +2 from Math Ability"]}
      attributes={["IQ 14 [80]"]} advantages={["Mathematical Ability 2 [20]"]} />);
    expect(screen.getByText(/IQ · \+2 Mathematical Ability · 4 pts/)).toBeTruthy();
    expect(screen.queryByText(/the table gives/)).toBeNull();
  });

  it("follows the level for the same points as the Talent goes up", () => {
    const { rerender } = render(<Holder initial={["Accounting (IQ/H)-16 [4]"]}
      attributes={["IQ 14 [80]"]} advantages={["Mathematical Ability 2 [20]"]} />);
    rerender(<Holder initial={["Accounting (IQ/H)-16 [4]"]}
      attributes={["IQ 14 [80]"]} advantages={["Mathematical Ability 3 [30]"]} />);
    // At 16 with +3 only IQ-1 is bought now: the table gives 2 for that.
    expect(screen.getByText(/IQ-1 · \+3 Mathematical Ability · 2 pts/)).toBeTruthy();
  });
});
