import { describe, it, expect } from "vitest";
import { genericNameProblem, isGenericName } from "./naming";

// Mirrors tests/test_naming.py — keep both suites in step.
describe("names that say nothing", () => {
  it.each([
    "Chapter 01", "chapter 1", "Chapter_04", "Episode 3", "Encounter", "Scene 2",
    "NPC", "NPC 2", "Character 7", "New", "Untitled", "Test", "Draft 3",
  ])("refuses the category word %p", (name) => {
    expect(isGenericName(name)).toBe(true);
  });

  it.each(["01", "3", "1.2"])("refuses the bare number %p", (name) => {
    expect(genericNameProblem(name)).toContain("number");
  });

  it.each(["", "   "])("refuses nothing at all: %p", (name) => {
    expect(genericNameProblem(name)).toBe("Give it a name.");
  });

  it.each(["01_World_Bible/Locations/HQ.md", "The_Shoals.md"])("refuses the path %p", (name) => {
    expect(genericNameProblem(name)).toContain("file path");
  });

  it.each([
    "Chapter 01: Descent into Filth",
    "Test Episode Sewers",
    "The Drainage Awakening",
    "Rick",
    "New Hinamizawa",
  ])("accepts %p", (name) => {
    expect(genericNameProblem(name)).toBeNull();
  });

  it("unwraps a migrated link before judging it", () => {
    expect(genericNameProblem("[The Shoals](../../Locations/The_Shoals.md)")).toBeNull();
  });

  it("shows what a good name looks like", () => {
    const problem = genericNameProblem("Chapter 04");
    expect(problem).toContain("Chapter 04");
    expect(problem).toContain("category");
    // No invented title: the message explains the collision instead.
    expect(problem).not.toContain("Rat King");
  });
});
