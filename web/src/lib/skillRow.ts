/**
 * A skill line, as the editor holds it and as the app prices it.
 *
 * The GM edits what they read on a sheet and roll against: the skill's final
 * level, 14. What that level costs depends on two things the line does not
 * decide by itself — the attribute the skill is based on and its difficulty,
 * both printed in the book (B170-172) — and on the character's own score in
 * that attribute. So the editor shows "DX/E · DX+2 · 4 pts" beside the 14 and
 * works the points out from it.
 *
 * Settled with the GM:
 *  - the book decides attribute and difficulty for a skill it lists; the GM
 *    may override the attribute (a house rule), and is shown the book's;
 *  - a skill the book does not list is the GM's own: they choose its
 *    attribute and difficulty, and it is priced from the same table;
 *  - points follow the level while they are the book's figure; a figure the
 *    GM typed is kept, with the book's shown beside it;
 *  - a line nobody edits is written back exactly as it was read, and a line
 *    nothing can read is reported, never repaired.
 *
 * A line the editor writes uses the notation that cannot contradict itself,
 * `(DX/E)-14`. The older `(DX+1)-13` states a label and a level that can
 * disagree, and on this campaign does: Abella's `Axe/Mace (DX+1)-11` sits on
 * DX 11.
 */

import { skillCost, ATTRIBUTE_COST, derive } from "./gurpsRules";
import { parseEntry } from "./pointBuild";
import { qualifiedName, resolveTrait, type TraitIndex } from "./traitResolver";

export const DIFFICULTIES = ["E", "A", "H", "VH"] as const;
export const BASES = ["ST", "DX", "IQ", "HT", "Per", "Will"] as const;

/** What a skill can be based on, as the sheet spells each one. */
const CANONICAL: Record<string, string> = {
  ST: "ST", DX: "DX", IQ: "IQ", HT: "HT", PER: "Per", WILL: "Will",
};
export function canonicalBase(attr: string): string {
  return CANONICAL[(attr || "").toUpperCase()] ?? attr;
}

export type SkillRow = {
  /** As the book names it, without the tech level: `Guns/TL`, `Stealth`. */
  name: string;
  specialty: string;
  /** The tech level a `/TL` skill was learned at. */
  tl: string;
  /** The attribute the line is based on; "" to follow the book. */
  attr: string;
  /** The difficulty the line states; "" when it states none. */
  difficulty: string;
  /** The final level, the number rolled against. */
  level: string;
  points: string;
  notes: string;
  emphasised: boolean;
  /** The stored line, while nobody has edited the row. */
  raw?: string;
  /**
   * Why the line could not be read, when it could not. Such a line is shown
   * as written with the reason, and never taken apart: a line like
   * `B ()- [0] - rawling (DX/E)-16 [[4]]` could be anything, and guessing
   * what it meant is the GM's call, not the editor's.
   */
  unreadable?: string;
};

/** The note exactly as written, markup and all: the tail after the cost. */
function rawNote(raw: string): string {
  const costs = [...raw.matchAll(/\[+\s*(-?\d+)\s*\]+/g)];
  if (!costs.length) return "";
  const last = costs[costs.length - 1];
  return raw.slice((last.index ?? 0) + last[0].length).replace(/^\s*[-–—]\s?/, "");
}

/** `(DX/E)`, `(DX+1)`, `(IQ)`: the attribute, and a difficulty where one is written. */
const BASE = /^([A-Za-z]+)(?:\/(E|A|H|VH))?\s*(?:[+-]\d+)?$/i;

/** A stored line, read into the fields the GM edits. */
export function readSkill(raw: string): SkillRow {
  const priced = /\[+\s*-?\d+\s*\]+/.test(raw || "");
  // An unpriced line the app wrote, `Name (Spec) - at DX+2; not priced: …`,
  // is read as a name and a note, as the trait editor reads one.
  const dash = priced ? -1 : (raw || "").indexOf(" - ");
  const head = dash >= 0 ? raw.slice(0, dash) : raw;
  const entry = parseEntry(priced ? raw : `${head} [0]`, "skill");
  if (priced && entry.problem) {
    return { ...blankSkill(), raw, unreadable: entry.problem };
  }

  let name = entry.name.trim();
  let tl = "";
  const withTl = /^(.*\/TL)(\d+)$/i.exec(name);
  if (withTl) { name = withTl[1]; tl = withTl[2]; }

  let attr = "", difficulty = "", level = "";
  const lv = /^\(([^)]*)\)-(-?\d+)$/.exec(entry.level || "");
  if (lv) {
    level = lv[2];
    const base = BASE.exec(lv[1].trim());
    if (base) {
      attr = canonicalBase(base[1]);
      difficulty = (base[2] || "").toUpperCase();
    }
  }

  return {
    name, specialty: entry.specialty, tl, attr, difficulty, level,
    points: priced && entry.points !== null ? String(entry.points) : "",
    notes: priced ? rawNote(raw) : dash >= 0 ? raw.slice(dash + 3) : "",
    emphasised: /^\s*\*\*/.test(raw || ""),
    raw,
  };
}

export type BookSkill = { name: string; attr: string; difficulty: string; page: number | null };

/** What the book says about this skill, or null for one it does not list. */
export function bookSkill(row: Pick<SkillRow, "name" | "specialty">, index: TraitIndex | null): BookSkill | null {
  if (!index || !row.name.trim()) return null;
  const found = resolveTrait(qualifiedName(row.name.trim(), row.specialty), index, "skill").entry;
  if (!found || typeof found.difficulty !== "string" || !found.difficulty) return null;
  return {
    name: found.name,
    attr: typeof found.attr === "string" ? canonicalBase(found.attr) : "",
    difficulty: found.difficulty.toUpperCase(),
    page: typeof found.page === "number" ? found.page : null,
  };
}

/**
 * The scores skills are measured against, from a sheet's attribute lines,
 * with the book's defaults where a line is missing: Per and Will from IQ
 * (B18), a primary at 10.
 */
export function skillScores(attributeLines: string[]): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const line of attributeLines) {
    const read = parseEntry(line, "attribute");
    const n = Number(read.level);
    if (read.name && read.level && Number.isFinite(n)) scores[canonicalBase(read.name.replace(/\*\*/g, "").trim())] = n;
  }
  for (const name of Object.keys(ATTRIBUTE_COST)) scores[name] ??= 10;
  const d = derive({ ST: scores.ST, DX: scores.DX, IQ: scores.IQ, HT: scores.HT });
  if (d.will !== null) scores.Will ??= d.will;
  if (d.per !== null) scores.Per ??= d.per;
  return scores;
}

export type SkillPrice = {
  /** The attribute and difficulty the price is worked from. */
  attr: string;
  difficulty: string;
  /** The level against the attribute: +2 for DX+2. */
  relative: number;
  /** What the book's table charges, or null below what a point buys. */
  points: number | null;
};

/** What the row's level costs on this sheet, or why it cannot be said. */
export function priceSkill(
  row: SkillRow, scores: Record<string, number>, book: BookSkill | null,
): SkillPrice | { problem: string } {
  const attr = row.attr || book?.attr || "";
  // The book's difficulty, where it lists the skill: a line labelled Hard for
  // a skill the book prices Average is a wording problem, not a price.
  const difficulty = book?.difficulty || row.difficulty;
  if (!attr) return { problem: "choose the attribute it is based on" };
  if (!difficulty) return { problem: "choose its difficulty" };
  if (row.level.trim() === "") return { problem: "give it a level" };
  const level = Number(row.level);
  const score = scores[attr];
  if (!Number.isFinite(level)) return { problem: "the level is not a number" };
  if (score === undefined) return { problem: `${attr} is not on the sheet` };
  const relative = level - score;
  return { attr, difficulty, relative, points: skillCost(difficulty, relative) };
}

export function wasSkillPriced(p: SkillPrice | { problem: string }): p is SkillPrice {
  return (p as SkillPrice).difficulty !== undefined;
}

/** `DX+2`, `IQ-1`, `Per`. */
export function relativeLabel(attr: string, relative: number): string {
  return relative === 0 ? attr : `${attr}${relative > 0 ? "+" : ""}${relative}`;
}

/** The row written back as the campaign stores it. */
export function writeSkill(row: SkillRow, book: BookSkill | null): string {
  if (row.raw !== undefined) return row.raw;
  const bare = row.name.replace(/\*\*/g, "").trim();
  // The book's name decides whether there is a tech level to write: a GM who
  // picked "Guns" from a sheet that once said "Guns/TL8" still gets one.
  const tlName = row.tl
    ? (/\/TL$/i.test(bare) ? `${bare}${row.tl}`
      : book && /\/TL$/i.test(book.name) ? `${bare}/TL${row.tl}` : bare)
    : bare;
  const name = row.emphasised && tlName ? `**${tlName}**` : tlName;
  const specialty = row.specialty.trim() ? ` (${row.specialty.trim()})` : "";
  const attr = row.attr || book?.attr || "";
  const difficulty = book?.difficulty || row.difficulty;
  const base = attr && difficulty ? `${attr}/${difficulty}` : attr || difficulty;
  const level = row.level.trim() !== "" && base ? ` (${base})-${row.level.trim()}` : "";
  // No figure is no bracket: a nought is a real cost on this sheet.
  const points = row.points.trim() === "" ? "" : ` [${row.points.trim()}]`;
  const notes = row.notes ? ` - ${row.notes}` : "";
  return `${name}${specialty}${level}${points}${notes}`;
}

/** An empty row for a skill the GM is about to add. */
export function blankSkill(): SkillRow {
  return { name: "", specialty: "", tl: "", attr: "", difficulty: "", level: "", points: "", notes: "", emphasised: false };
}
