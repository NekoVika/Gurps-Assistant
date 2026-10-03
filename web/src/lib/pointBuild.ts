/**
 * Read a character sheet's own strings as arithmetic.
 *
 * A GURPS sheet stores its mechanics as prose with the cost in brackets:
 * `Combat Reflexes [15] - Reacts quickly (B43)`. That is fine for a reader and
 * useless for checking, because nothing adds it up — Killian claims 225 points
 * and his parts sum to 215, and the app had no way to notice.
 *
 * This is the one place that turns those strings into numbers. The passport,
 * the editor and the generation path all read it, so there is a single answer
 * to "what does this character cost" rather than one per caller.
 *
 * It is deliberately honest about failure. A line it cannot read is reported,
 * never skipped quietly, because a confident total computed from thirteen of
 * sixteen lines is worse than no total at all. Everything here is advisory:
 * it says what it found and what the sheet claims, and the GM decides.
 */

export type EntryKind = "attribute" | "advantage" | "disadvantage" | "skill";

export type Entry = {
  /** The line as stored, untouched. */
  raw: string;
  /** The trait, without markdown, specialty or level notation. */
  name: string;
  /** Points, where a bracketed cost was found. */
  points: number | null;
  /** The parenthesised qualifier: "Pistol" in `Guns/TL8 (Pistol)`. */
  specialty: string;
  /** Level notation as written: `(DX/A)-14` or `(DX+1)-13`. */
  level: string;
  /** Whatever followed the first " - ". */
  notes: string;
  /** Why this line could not be read, or "" when it was read cleanly. */
  problem: string;
};

export type Section = {
  kind: EntryKind;
  label: string;
  entries: Entry[];
  /** Sum of the costs that could be read. */
  points: number;
  /** Lines that yielded no cost. */
  unreadable: Entry[];
};

export type PointBuild = {
  sections: Section[];
  /** Sum of every cost that could be read. */
  computed: number;
  /** What the sheet says it costs, when it says anything. */
  stated: number | null;
  /** stated − computed, when both are known. */
  difference: number | null;
  /** Every line that yielded no cost, across all sections. */
  unreadable: Entry[];
  /** False when any line could not be read, so the total is a floor. */
  complete: boolean;
};

const SECTION_LABELS: Record<EntryKind, string> = {
  attribute: "Attributes",
  advantage: "Advantages",
  disadvantage: "Disadvantages",
  skill: "Skills",
};

/** `[15]`, `[-30]`, and the doubled `[[4]]` that the markdown migration left. */
const COST = /\[+\s*(-?\d+)\s*\]+/g;
/** `(DX/A)-14` and `(DX+1)-13`: both end a skill line with its level. */
const LEVEL = /\s*\(([^)]*)\)\s*-\s*(-?\d+)\s*$/;
/** A trailing qualifier that is not a level: `(Pistol)`, `(Major)`. */
const SPECIALTY = /\s*\(([^)]+)\)\s*$/;
/** `ST 13`, `Basic Speed 6.00`, `Parry N/A` — a name then its value. */
const ATTRIBUTE = /^(.*?)\s+(-?[\d.]+|N\/A)$/;

function stripMarkdown(text: string): string {
  return text.replace(/\*\*/g, "").replace(/__/g, "").trim();
}

/**
 * Read one stored line.
 *
 * The cost is the last bracketed number, because notes routinely carry page
 * citations and damage sometimes leaves two costs on one line — and in both
 * cases the trailing one is the entry's own.
 */
export function parseEntry(raw: string, kind: EntryKind): Entry {
  const entry: Entry = {
    raw, name: "", points: null, specialty: "", level: "", notes: "", problem: "",
  };
  const text = stripMarkdown(raw);
  if (!text) {
    entry.problem = "blank line";
    return entry;
  }

  const costs = [...text.matchAll(COST)];
  if (costs.length === 0) {
    entry.name = text;
    entry.problem = "no cost in brackets";
    return entry;
  }
  if (costs.length > 1) {
    // Two entries ran together: "Note ()- [0] - Brawling (DX/E)-14 [4]".
    entry.problem = `${costs.length} costs on one line`;
  }
  const last = costs[costs.length - 1];
  entry.points = Number(last[1]);

  let head = text.slice(0, last.index ?? 0).trim();
  const tail = text.slice((last.index ?? 0) + last[0].length).trim();
  entry.notes = tail.replace(/^[-–—]\s*/, "").trim();

  if (kind === "attribute") {
    const attribute = ATTRIBUTE.exec(head);
    if (attribute) {
      entry.name = attribute[1].trim();
      entry.level = attribute[2];
    } else {
      entry.name = head;
    }
    if (!entry.name) entry.problem ||= "no attribute name";
    return entry;
  }

  const level = LEVEL.exec(head);
  if (level) {
    entry.level = `(${level[1]})-${level[2]}`;
    head = head.slice(0, level.index).trim();
  }
  const specialty = SPECIALTY.exec(head);
  if (specialty) {
    entry.specialty = specialty[1].trim();
    head = head.slice(0, specialty.index).trim();
  }
  entry.name = head;
  if (!entry.name) entry.problem ||= "no trait name";
  return entry;
}

function section(kind: EntryKind, lines: unknown): Section {
  const entries = (Array.isArray(lines) ? lines : [])
    .filter((l): l is string => typeof l === "string" && l.trim() !== "")
    .map(l => parseEntry(l, kind));
  return {
    kind,
    label: SECTION_LABELS[kind],
    entries,
    points: entries.reduce((sum, e) => sum + (e.points ?? 0), 0),
    unreadable: entries.filter(e => e.points === null),
  };
}

/** The sheet's own stated total, where it is a number rather than "???". */
export function statedTotal(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  // Thousands separators are written on the big sheets: "1,500" is one number,
  // not a 1. Reading it as 1 made Lambdadelta look 1,204 points overspent.
  const match = /-?\d[\d,  ]*\d|-?\d/.exec(value);
  return match ? Number(match[0].replace(/[,  ]/g, "")) : null;
}

/** What a character costs, according to its own lines. */
export function pointBuild(character: Record<string, unknown> | null | undefined): PointBuild {
  const data = character ?? {};
  const sections = [
    section("attribute", data.attributes),
    section("advantage", data.advantages),
    section("disadvantage", data.disadvantages),
    section("skill", data.skills),
  ];
  const computed = sections.reduce((sum, s) => sum + s.points, 0);
  const stated = statedTotal(data.pointTotal);
  const unreadable = sections.flatMap(s => s.unreadable);
  return {
    sections,
    computed,
    stated,
    difference: stated === null ? null : stated - computed,
    unreadable,
    complete: unreadable.length === 0,
  };
}

/** One line for the GM: what was found, and whether it agrees. */
export function describeBuild(build: PointBuild): string {
  const parts = [`${build.computed} points in the parts`];
  if (build.stated === null) {
    parts.push("the sheet states no total");
  } else if (build.difference === 0) {
    parts.push(`matching the stated ${build.stated}`);
  } else {
    const gap = Math.abs(build.difference as number);
    const over = (build.difference as number) > 0;
    parts.push(`the sheet says ${build.stated} — ${gap} ${over ? "unaccounted for" : "more than it claims"}`);
  }
  if (!build.complete) {
    parts.push(`${build.unreadable.length} line${build.unreadable.length === 1 ? "" : "s"} could not be read`);
  }
  return parts.join("; ") + ".";
}
