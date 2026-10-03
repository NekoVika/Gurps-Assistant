import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../../lib/api', () => ({}));

import { WhereField, StoryPlacementField, KindField } from './PlacementFields';
import { useCampaignStore } from '../../stores/useCampaignStore';

const tree = [{
  path: "Campaign", name: "Campaign", node_type: "directory", children: [
    { path: "Campaign/02_Characters", name: "02_Characters", node_type: "directory", children: [
      { path: "Campaign/02_Characters/Povo_Witiko.json", name: "Povo_Witiko.json", node_type: "file", children: [] },
    ]},
    { path: "Campaign/01_World_Bible/Locations", name: "Locations", node_type: "directory", children: [
      { path: "Campaign/01_World_Bible/Locations/HQ.json", name: "HQ.json", node_type: "file", children: [] },
    ]},
    { path: "Campaign/03_Story", name: "03_Story", node_type: "directory", children: [
      { path: "Campaign/03_Story/Episode_03.json", name: "Watcher_of_the_Rain.json", node_type: "file", children: [] },
    ]},
  ],
}];

beforeEach(() => {
  useCampaignStore.setState({ fileTree: tree as any });
});

describe("WhereField", () => {
  it("offers a place picker by default", () => {
    render(<WhereField value="" onChange={() => {}} />);
    expect(screen.getByText("place")).toBeInTheDocument();
    expect(screen.getByText("travels with")).toBeInTheDocument();
  });

  it("starts in travels-with mode when the link already names a person", () => {
    // Guessing from the string alone would flip the control and quietly
    // rewrite an existing companion link on first render.
    render(<WhereField value="Povo Witiko" onChange={() => {}} />);
    expect(screen.getByText(/Resolves to wherever they are/)).toBeInTheDocument();
  });

  it("treats a link naming a location as a place", () => {
    render(<WhereField value="HQ" onChange={() => {}} />);
    expect(screen.getByText(/normally found/)).toBeInTheDocument();
  });

  it("clears the link when switching what kind of thing it points at", () => {
    const onChange = vi.fn();
    render(<WhereField value="HQ" onChange={onChange} />);
    fireEvent.click(screen.getByText("travels with"));
    expect(onChange).toHaveBeenCalledWith("");
  });
});

describe("StoryPlacementField", () => {
  it("defaults to appearance when nothing is set", () => {
    render(<StoryPlacementField value={undefined} onChange={() => {}} />);
    expect((screen.getByDisplayValue("Appears there") as HTMLSelectElement).value).toBe("appearance");
  });

  it("explains that a fixture reaches downward", () => {
    render(<StoryPlacementField value={{ node: "Ep 3", mode: "fixture" }} onChange={() => {}} />);
    expect(screen.getByText(/including everything under it/)).toBeInTheDocument();
  });

  it("keeps the node when only the mode changes", () => {
    const onChange = vi.fn();
    render(<StoryPlacementField value={{ node: "Ep 3", mode: "appearance" }} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue("Appears there"), { target: { value: "fixture" } });
    expect(onChange).toHaveBeenCalledWith({ node: "Ep 3", mode: "fixture" });
  });
});

describe("KindField", () => {
  it("treats an unset kind as individual", () => {
    render(<KindField value={undefined} onChange={() => {}} />);
    expect((screen.getByDisplayValue("Individual") as HTMLSelectElement).value).toBe("individual");
  });

  it("says why a type needs no placement", () => {
    render(<KindField value="type" onChange={() => {}} />);
    expect(screen.getByText(/instances are placed, it is not/)).toBeInTheDocument();
  });
});
