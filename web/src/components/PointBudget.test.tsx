import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { PointBudget } from "./PointBudget";
import type { CharacterJSON } from "../lib/types";

const sheet = (over: Partial<CharacterJSON> = {}) => ({
  name: "Killian",
  kind: "individual",
  pointTotal: "225",
  attributes: ["ST 11 [10]", "DX 13 [60]"],
  advantages: ["Combat Reflexes [15]"],
  disadvantages: ["Bad Temper [-10]"],
  skills: ["Stealth (DX/A)-14 [8]"],
  ...over,
} as CharacterJSON);

describe("the points badge", () => {
  it("shows the stated total, and what the parts actually come to", () => {
    render(<PointBudget data={sheet()} />);
    expect(screen.getByText("225")).toBeInTheDocument();
    expect(screen.getByText(/83 in the parts/)).toBeInTheDocument();
    expect(screen.getByText(/142 unaccounted for/)).toBeInTheDocument();
  });

  it("says nothing extra when the sheet is right", () => {
    render(<PointBudget data={sheet({ pointTotal: "83" })} />);
    expect(screen.getByText("83")).toBeInTheDocument();
    expect(screen.queryByText(/in the parts/)).not.toBeInTheDocument();
  });

  it("reports a sheet that costs more than it claims", () => {
    render(<PointBudget data={sheet({ pointTotal: "50" })} />);
    expect(screen.getByText(/33 over what it claims/)).toBeInTheDocument();
  });

  it("gives a figure to a character that states none", () => {
    // Both imported PCs have carried "???" since the GCS import.
    render(<PointBudget data={sheet({ pointTotal: "???" })} />);
    expect(screen.getByText("83")).toBeInTheDocument();
    expect(screen.getByText(/no total on the sheet/)).toBeInTheDocument();
  });

  it("claims no disagreement on a bestiary template", () => {
    // A type carries a nominal figure rather than a budget someone spent, the
    // same reasoning that exempts types from placement.
    render(<PointBudget data={sheet({ kind: "type", pointTotal: "115" })} />);
    expect(screen.getByText("115")).toBeInTheDocument();
    expect(screen.queryByText(/unaccounted for/)).not.toBeInTheDocument();
    expect(screen.getByText(/83 in the parts/)).toBeInTheDocument();
  });

  it("says when a line could not be read, so the total reads as a floor", () => {
    render(<PointBudget data={sheet({ pointTotal: "83", skills: ["Brawling (DX/E)-14"] })} />);
    expect(screen.getByText(/75 in the parts . 1 line unread/)).toBeInTheDocument();
  });

  it("claims no gap when a line could not be read", () => {
    // 75 of a stated 83, but one skill carries no cost -- the missing line
    // explains the difference at least as well as an error would.
    render(<PointBudget data={sheet({ pointTotal: "83", skills: ["Brawling (DX/E)-14"] })} />);
    expect(screen.queryByText(/unaccounted for/)).not.toBeInTheDocument();
  });

  it("survives a sheet with nothing on it", () => {
    render(<PointBudget data={{ name: "Rick" } as CharacterJSON} />);
    expect(screen.getByText("0")).toBeInTheDocument();
  });
});
