/**
 * Names that say nothing.
 *
 * Mirrors `gurpsai/app/services/naming.py` — keep both in step.
 *
 * A bare category word plus a number is not a name. It says what kind of thing
 * this is and nothing about which one, so it collides with every other entity
 * given the same non-name. "Chapter 01" was listed by two of this campaign's
 * episodes, and one chapter ended up parented to the other's episode with none
 * of its fixtures.
 *
 * The backend refuses these at the stub endpoint, but the wizard writes files
 * directly and never passes through it — so the check has to live where the
 * name is typed, which is the better place anyway.
 */

import { linkText } from "./entityResolution";

const CATEGORY =
  "(?:chapter|episode|encounter|scene|session|arc|npc|character|char|" +
  "location|place|faction|item|new|untitled|unnamed|test|temp|tmp|draft|stub)";

// A run of category words, then only digits and separators, consuming the whole
// string — so "Chapter 01: Descent into Filth" and "Test Episode Sewers" pass.
const GENERIC = new RegExp(`^\\s*(?:${CATEGORY}[\\s_.-]*)+[\\d\\s._-]*$`, "i");
const ONLY_NUMBER = /^[\d\s._-]+$/;

/** A sentence saying why this cannot be a name, or null when it can. */
export function genericNameProblem(name: unknown): string | null {
  const raw = typeof name === "string" ? name.trim() : "";
  if (!raw) return "Give it a name.";

  const text = linkText(raw);
  if (!text) return "Give it a name.";

  if (ONLY_NUMBER.test(text)) {
    return `“${text}” is just a number. Say what it is — a name never collides, a number always does.`;
  }
  if (text.includes("/") || text.includes("\\") || /\.(md|json)$/i.test(text)) {
    return `“${text.slice(0, 60)}” looks like a file path, not a name.`;
  }
  if (GENERIC.test(text)) {
    return (
      `“${text}” names a category, not this particular one. Give it a title ` +
      `as well — two episodes can each have a “${text}”, and then neither ` +
      `can be told from the other.`
    );
  }
  return null;
}

export function isGenericName(name: unknown): boolean {
  return genericNameProblem(name) !== null;
}
