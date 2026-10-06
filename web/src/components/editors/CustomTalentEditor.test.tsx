import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { CustomTalentEditor } from "./CustomTalentEditor";
import type { CustomTalentJSON } from "../../lib/types";

function Holder({ initial }: { initial: CustomTalentJSON[] }) {
  const [items, setItems] = useState(initial);
  return <><CustomTalentEditor items={items} onChange={setItems} /><pre data-testid="stored">{JSON.stringify(items)}</pre></>;
}
const stored = () => JSON.parse(screen.getByTestId("stored").textContent || "[]") as CustomTalentJSON[];

describe("declaring a campaign Talent (B90)", () => {
  it("prices it from its skill list as the skills are named", () => {
    render(<Holder initial={[{ name: "Sports Talent", skills: [] }]} />);
    expect(screen.getByText("name its skills to price it")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Skills it covers"), { target: { value: "Climbing, Jumping, Running, Swimming, Throwing, Sports, Skiing" } });
    expect(stored()[0].skills).toHaveLength(7);
    expect(screen.getByText("7 skills · medium · 10/level")).toBeTruthy();
  });

  it("keeps a comma and a space as they are typed", () => {
    render(<Holder initial={[{ name: "Sports Talent", skills: [] }]} />);
    const box = screen.getByLabelText("Skills it covers") as HTMLInputElement;
    fireEvent.change(box, { target: { value: "Climbing, " } });
    expect(box.value).toBe("Climbing, ");
    expect(stored()[0].skills).toEqual(["Climbing"]);
  });
});
