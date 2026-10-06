import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { CustomSkillEditor } from "./CustomSkillEditor";
import type { CustomSkillJSON } from "../../lib/types";

function Holder({ initial }: { initial: CustomSkillJSON[] }) {
  const [items, setItems] = useState(initial);
  return <><CustomSkillEditor items={items} onChange={setItems} /><pre data-testid="stored">{JSON.stringify(items)}</pre></>;
}
const stored = () => JSON.parse(screen.getByTestId("stored").textContent || "[]") as CustomSkillJSON[];
const pick = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("declaring a campaign skill", () => {
  it("fills its default by the book's rule as attribute and difficulty are chosen (B173)", () => {
    render(<Holder initial={[]} />);
    fireEvent.click(screen.getByText("+ Declare a skill"));
    fireEvent.change(screen.getByLabelText("Skill name"), { target: { value: "Rumour-Mongering" } });
    pick("Based on", "IQ");
    pick("Difficulty", "A");
    expect(stored()[0]).toMatchObject({ name: "Rumour-Mongering", attr: "IQ", difficulty: "A", defaults: "IQ-5" });
    pick("Difficulty", "H");
    expect(stored()[0].defaults).toBe("IQ-6");
  });

  it("keeps a default the GM wrote", () => {
    render(<Holder initial={[{ name: "Rig Hacking", attr: "IQ", difficulty: "H", defaults: "Computer Hacking-3" }]} />);
    pick("Difficulty", "VH");
    expect(stored()[0].defaults).toBe("Computer Hacking-3");
  });

  it("explains each choice in the book's terms", () => {
    render(<Holder initial={[{ name: "Rig Hacking", attr: "Per", difficulty: "VH" }]} />);
    expect(screen.getByText(/noticing subtle differences/)).toBeTruthy();
    expect(screen.getByText(/huge scope, or alien/)).toBeTruthy();
  });
});
