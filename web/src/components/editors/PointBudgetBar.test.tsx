import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { PointBudgetBar } from "./PointBudgetBar";
import { useCampaignStore } from "../../stores/useCampaignStore";
import { buildIndex } from "../../lib/traitAudit";
import type { CharacterJSON } from "../../lib/types";

const sheet = (over: Partial<CharacterJSON> = {}) => ({
  name: "Rick",
  attributes: ["ST 11 [10]", "DX 13 [60]", "IQ 12 [40]", "HT 12 [20]"],
  advantages: ["Combat Reflexes [15]"],
  disadvantages: ["Bad Temper [-10]"],
  skills: ["Stealth (DX/A)-14 [4]"],
  ...over,
} as CharacterJSON);

beforeEach(() => {
  useCampaignStore.setState({ traitIndex: null, campaignPointBudget: null });
});

describe("the budget while you spend it", () => {
  it("shows what has been spent", () => {
    render(<PointBudgetBar data={sheet()} />);
    expect(screen.getByText("139")).toBeInTheDocument();
  });

  it("counts against the character's own stated total first", () => {
    render(<PointBudgetBar data={sheet({ pointTotal: "150" })} />);
    expect(screen.getByText("of 150 spent")).toBeInTheDocument();
    expect(screen.getByText("11 left")).toBeInTheDocument();
  });

  it("falls back to the campaign's budget when the sheet states none", () => {
    useCampaignStore.setState({ campaignPointBudget: 225 });
    render(<PointBudgetBar data={sheet()} />);
    expect(screen.getByText("of 225 spent")).toBeInTheDocument();
    expect(screen.getByText("86 left")).toBeInTheDocument();
  });

  it("prefers the sheet's own figure over the campaign default", () => {
    useCampaignStore.setState({ campaignPointBudget: 225 });
    render(<PointBudgetBar data={sheet({ pointTotal: "150" })} />);
    expect(screen.getByText("of 150 spent")).toBeInTheDocument();
  });

  it("says when the build has gone over", () => {
    render(<PointBudgetBar data={sheet({ pointTotal: "100" })} />);
    expect(screen.getByText("39 over")).toBeInTheDocument();
  });

  it("still totals when nobody has set a budget at all", () => {
    render(<PointBudgetBar data={sheet()} />);
    expect(screen.getByText("points spent — no budget set")).toBeInTheDocument();
  });

  it("breaks the spend down by section", () => {
    render(<PointBudgetBar data={sheet()} />);
    expect(screen.getByText("Attributes")).toBeInTheDocument();
    expect(screen.getByText("+130")).toBeInTheDocument();
    expect(screen.getByText("-10")).toBeInTheDocument();
  });
});

describe("what it warns about while building", () => {
  it("counts costs the rules price differently", () => {
    // DX 13 costs 60, not 40.
    render(<PointBudgetBar data={sheet({ attributes: ["DX 13 [40]"] })} />);
    expect(screen.getByText(/1 cost the rules price differently/)).toBeInTheDocument();
  });

  it("says the total is a floor when a line cannot be read", () => {
    render(<PointBudgetBar data={sheet({ skills: ["Stealth (DX/A)-14"] })} />);
    expect(screen.getByText(/1 line unread, so this is a floor/)).toBeInTheDocument();
  });

  it("counts traits nobody prices, once there is a catalogue to ask", () => {
    useCampaignStore.setState({
      traitIndex: buildIndex([
        { book_id: 1, kind: "advantage", name: "Combat Reflexes", cost_text: "15" },
      ]),
    });
    // Bad Temper and Stealth are not in this catalogue either, so three lines
    // go unpriced -- which is the honest count, not just the obvious one.
    render(<PointBudgetBar data={sheet({ advantages: ["Combat Reflexes [15]", "Rot-Sense [12]"] })} />);
    expect(screen.getByText(/3 traits nobody prices/)).toBeInTheDocument();
  });

  it("says nothing about unpriced traits when there is no catalogue", () => {
    render(<PointBudgetBar data={sheet({ advantages: ["Rot-Sense [12]"] })} />);
    expect(screen.queryByText(/nobody prices/)).not.toBeInTheDocument();
  });

  it("stays quiet on a clean sheet", () => {
    render(<PointBudgetBar data={sheet()} />);
    expect(screen.queryByText(/price differently/)).not.toBeInTheDocument();
    expect(screen.queryByText(/floor/)).not.toBeInTheDocument();
  });
});

describe("the three things it can say about a line", () => {
  const index = buildIndex([
    { book_id: 1, kind: "skill", name: "Axe/Mace", attr: "DX", difficulty: "A" },
    { book_id: 1, kind: "advantage", name: "Flight", cost_text: "40",
      cost_kind: "flat", cost_value: 40 },
  ]);

  it("separates a mislabelled line from a disputed cost", () => {
    useCampaignStore.setState({ traitIndex: index });
    // DX 13 on the fixture, so level 13 is DX+0, which is what 2 points buy.
    render(<PointBudgetBar data={sheet({ skills: ["Axe/Mace (DX+1)-13 [2]"] })} />);
    expect(screen.getByText(/1 line described wrongly/)).toBeInTheDocument();
    expect(screen.queryByText(/price differently/)).not.toBeInTheDocument();
  });

  it("counts a line the rules decline to price", () => {
    useCampaignStore.setState({ traitIndex: index });
    render(<PointBudgetBar data={sheet({ advantages: ["Flight (Winged) [30]"] })} />);
    expect(screen.getByText(/1 the rules decline to price/)).toBeInTheDocument();
    expect(screen.queryByText(/price differently/)).not.toBeInTheDocument();
  });
});
