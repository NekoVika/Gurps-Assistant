import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { CollapsibleSection, hasValue, hasAnyValue } from './CollapsibleSection';

describe("what counts as filled in", () => {
  it.each([["", false], ["   ", false], ["Rick", true]])("string %p -> %s", (v, expected) => {
    expect(hasValue(v)).toBe(expected);
  });

  it.each([["???", false], ["?", false]])("treats the unset marker %p as empty", (v) => {
    // CharacterData.pointTotal defaults to "???"; a default is not content.
    expect(hasValue(v)).toBe(false);
  });

  it.each([[[], false], [["a"], true], [null, false], [undefined, false]])("%p -> %s", (v, expected) => {
    expect(hasValue(v)).toBe(expected);
  });

  it("treats an empty placement object as empty", () => {
    expect(hasValue({})).toBe(false);
    expect(hasValue({ node: "Ep 3" })).toBe(true);
  });

  it("hasAnyValue is true when a single field is filled", () => {
    expect(hasAnyValue("", [], null, "Rick")).toBe(true);
    expect(hasAnyValue("", [], null, "???")).toBe(false);
  });
});

describe("CollapsibleSection", () => {
  it("opens a section that holds content", () => {
    render(<CollapsibleSection title="Mechanics" hasContent={true}><p>stats</p></CollapsibleSection>);
    expect(screen.getByText("Mechanics")).toBeInTheDocument();
    expect(screen.getByText("stats")).toBeInTheDocument();
  });

  it("collapses an empty section to a single offer", () => {
    // A one-line NPC should not read as two dozen blanks he failed to fill.
    render(<CollapsibleSection title="Mechanics" hasContent={false}><p>stats</p></CollapsibleSection>);
    expect(screen.queryByText("stats")).not.toBeInTheDocument();
    expect(screen.getByText(/Add Mechanics/)).toBeInTheDocument();
  });

  it("uses the given wording for the offer", () => {
    render(
      <CollapsibleSection title="Mechanics" hasContent={false} addLabel="Add stats — attributes, skills">
        <p>stats</p>
      </CollapsibleSection>
    );
    expect(screen.getByText(/attributes, skills/)).toBeInTheDocument();
  });

  it("reveals the fields when the offer is taken", () => {
    render(<CollapsibleSection title="Mechanics" hasContent={false}><p>stats</p></CollapsibleSection>);
    fireEvent.click(screen.getByText(/Add Mechanics/));
    expect(screen.getByText("stats")).toBeInTheDocument();
  });

  it("can be hidden again while it is still empty", () => {
    render(<CollapsibleSection title="Mechanics" hasContent={false}><p>stats</p></CollapsibleSection>);
    fireEvent.click(screen.getByText(/Add Mechanics/));
    fireEvent.click(screen.getByText("hide"));
    expect(screen.queryByText("stats")).not.toBeInTheDocument();
  });

  it("offers no hide on a section holding content", () => {
    // Collapsing that would put the GM's own work behind a chevron.
    render(<CollapsibleSection title="Mechanics" hasContent={true}><p>stats</p></CollapsibleSection>);
    expect(screen.queryByText("hide")).not.toBeInTheDocument();
  });
});
