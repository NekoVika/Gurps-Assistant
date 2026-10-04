/**
 * Check the costs a sheet states against the costs the rules give.
 *
 * Tier two: no catalogue needed for attributes, because the book prices them
 * with a formula. Skills need one thing from the catalogue — a skill's
 * difficulty — and only when the sheet writes a relative level rather than
 * spelling the difficulty out. So this degrades rather than fails: with no
 * rules database it still checks every attribute, and as much of the skills as
 * the notation itself reveals.
 *
 * Advisory throughout. A finding says what the sheet claims and what the rules
 * give, and stops there. Where the rules are silent, so is this.
 *
 * Silence has a cost of its own, though. A line the rules cannot price used to
 * vanish into a counter, which left the GM unable to tell "the app agrees with
 * me" from "the app gave up on this line". So declining is now an outcome with
 * a reason attached, and a note is not a complaint: it says what would have to
 * be known before anything could be claimed.
 */

import { pointBuild, type Entry } from "./pointBuild";
import {
  attributeCost, secondaryCost, skillCost, levelFor, SECONDARY, ATTRIBUTE_COST,
  DIFFICULTY_NAMES, selfControlCost, selfControlNumber,
} from "./gurpsRules";
import { qualifiedName, resolveTrait, type TraitIndex } from "./traitResolver";
import { isCustom } from "./traitAudit";
import {
  baseCost, modifiedCost, modifiersArePriced, netModifier, parseModifiers, traitLevel,
} from "./modifiers";

export type Finding = {
  /** The line as stored, so the GM can find it. */
  raw: string;
  name: string;
  /** What the sheet says it costs. */
  stated: number;
  /** What the rules say it costs. */
  expected: number;
  /** Where that figure comes from, in the GM's language. */
  because: string;
  /**
   * What disagrees. A `cost` finding says the points are wrong; a `label`
   * finding says the points are right and the line describes itself wrongly,
   * which is a different job to fix and must not be reported as overspending.
   */
  kind?: "cost" | "label";
};

export type Note = {
  raw: string;
  name: string;
  /** Why the rules decline to price this line, in the GM's language. */
  because: string;
};

export type MechanicsCheck = {
  findings: Finding[];
  /** Lines the rules deliberately decline to price, and the reason for each. */
  notes: Note[];
  /** Lines the rules could price, whether or not they agreed. */
  checked: number;
  /** Lines nothing could price — no difficulty known, or not an attribute. */
  unchecked: number;
};

/** `(DX/A)-14` or `(DX+1)-13`: the two notations the campaign actually uses. */
const SPELLED = /^\(([A-Za-z]+)\/([A-Za-z]+)\)-(-?\d+)$/;
const RELATIVE = /^\(([A-Za-z]+)([+-]\d+)\)-(-?\d+)$/;

type SkillLevel = {
  attribute: string;
  difficulty: string | null;
  /** The level the line *labels* itself with, as in the `+1` of `(DX+1)-11`. */
  relative: number | null;
  /** The level the line actually reaches, the `11` of `(DX+1)-11`. */
  absolute: number | null;
};

export function readSkillLevel(level: string): SkillLevel | null {
  const spelled = SPELLED.exec(level || "");
  if (spelled) {
    return {
      attribute: spelled[1].toUpperCase(), difficulty: spelled[2].toUpperCase(),
      relative: null, absolute: Number(spelled[3]),
    };
  }
  const relative = RELATIVE.exec(level || "");
  if (relative) {
    return {
      attribute: relative[1].toUpperCase(), difficulty: null,
      relative: Number(relative[2]), absolute: Number(relative[3]),
    };
  }
  return null;
}

/** `Guns/TL8 (Rifle)` and `Guns/TL8 (Pistol)` are two specialties of one skill. */
export function baseSkillName(name: string): string {
  return (name || "").replace(/\*\*/g, "").replace(/\s*\([^)]*\)\s*$/, "").trim().toLowerCase();
}

/** The four primary attributes as the sheet states them. */
export function primaryAttributes(character: Record<string, unknown> | null | undefined) {
  const scores: Record<string, number> = {};
  for (const entry of pointBuild(character).sections[0].entries) {
    const score = Number(entry.level);
    if (entry.name in ATTRIBUTE_COST && Number.isFinite(score)) scores[entry.name] = score;
  }
  return scores;
}

function attributeFindings(entries: Entry[]): Part {
  const findings: Finding[] = [];
  const notes: Note[] = [];
  let checked = 0;
  let unchecked = 0;
  const scores: Record<string, number> = {};
  for (const entry of entries) {
    const score = Number(entry.level);
    if (entry.name in ATTRIBUTE_COST && Number.isFinite(score)) scores[entry.name] = score;
  }

  for (const entry of entries) {
    if (entry.points === null) { unchecked++; continue; }
    const score = Number(entry.level);
    if (!Number.isFinite(score)) { unchecked++; continue; }

    if (entry.name in ATTRIBUTE_COST) {
      const expected = attributeCost(entry.name, score);
      if (expected === null) { unchecked++; continue; }
      checked++;
      if (expected !== entry.points) {
        findings.push({
          raw: entry.raw, name: entry.name, stated: entry.points, expected,
          because: `${entry.name} ${score} costs ${expected} at ${ATTRIBUTE_COST[entry.name]} points a level`,
        });
      }
      continue;
    }

    const rule = SECONDARY[entry.name];
    // A secondary characteristic is priced against the attribute it comes
    // from, so without that attribute on the sheet there is nothing to compare.
    const base = rule?.from ? scores[rule.from] : undefined;
    if (!rule || base === undefined) { unchecked++; continue; }
    const expected = secondaryCost(entry.name, score, base);
    if (expected === null) { unchecked++; continue; }
    checked++;
    if (expected !== entry.points) {
      findings.push({
        raw: entry.raw, name: entry.name, stated: entry.points, expected,
        because: `${entry.name} ${score} against ${rule.from} ${base} costs ${expected}`,
      });
    }
  }
  return { findings, notes, checked, unchecked };
}

type Part = { findings: Finding[]; notes: Note[]; checked: number; unchecked: number };

const sign = (n: number) => `${n >= 0 ? "+" : ""}${n}`;

/**
 * Skills, where three things on one line have to agree.
 *
 * `Axe/Mace (DX+1)-11 [2]` states a label, a level and a cost, and the sheet's
 * own DX settles which is wrong: at DX 11 the level 11 *is* DX+0, which is
 * what 2 points buy, so the cost is right and the label is not. Reading the
 * label and ignoring the level reported a perfectly good line as overspent, so
 * the level the skill actually reaches wins — it is the number that gets
 * rolled against — and the label is reported separately.
 *
 * The same applies to difficulty: a line reading `Explosives/TL8 (EOD) (IQ/H)`
 * calls the skill Hard where the book (B194) prices it Average, and at Average
 * the sheet's own figure is exactly right. The catalogue outranks the line.
 */
function skillFindings(
  entries: Entry[],
  scores: Record<string, number>,
  index: TraitIndex | null,
): Part {
  const findings: Finding[] = [];
  const notes: Note[] = [];
  let checked = 0;
  let unchecked = 0;

  // The best level reached in each skill, so a second specialty can be
  // recognised as one. B171: "There is usually a favorable 'default' between
  // specialties."
  const best = new Map<string, number>();
  for (const entry of entries) {
    const level = readSkillLevel(entry.level);
    if (!level || level.absolute === null || !Number.isFinite(level.absolute)) continue;
    const base = baseSkillName(entry.name);
    if (!base) continue;
    const seen = best.get(base);
    if (seen === undefined || level.absolute > seen) best.set(base, level.absolute);
  }

  for (const entry of entries) {
    if (entry.points === null) { unchecked++; continue; }
    const level = readSkillLevel(entry.level);
    if (!level) { unchecked++; continue; }

    const score = scores[level.attribute];
    let relative: number | null = null;
    let labelled: number | null = level.relative;

    // The level the skill reaches, measured against the attribute it is based
    // on, is the authority. The label is only a claim about that number.
    if (score !== undefined && level.absolute !== null && Number.isFinite(level.absolute)) {
      relative = level.absolute - score;
    } else if (labelled !== null) {
      relative = labelled;
      labelled = null;        // nothing to check the label against
    }
    if (relative === null) { unchecked++; continue; }

    // Difficulty: the catalogue outranks what the line calls itself.
    const found = index
      ? resolveTrait(qualifiedName(entry.name, entry.specialty), index, "skill").entry : null;
    const catalogued = (found?.difficulty as string) || null;
    const stated = level.difficulty;
    const difficulty = catalogued || stated;
    if (!difficulty) { unchecked++; continue; }

    const expected = skillCost(difficulty, relative);
    if (expected === null) { unchecked++; continue; }
    checked++;

    const name = DIFFICULTY_NAMES[difficulty.toUpperCase()] || difficulty;
    const named = `${/^[AEIOU]/i.test(name) ? "an" : "a"} ${name}`;

    if (expected === entry.points) {
      // The cost is right, so anything left to say is about the line's wording.
      if (labelled !== null && labelled !== relative) {
        findings.push({
          raw: entry.raw, name: entry.name, stated: entry.points, expected, kind: "label",
          because: `the points are right, but the line calls this attribute${sign(labelled)} `
            + `where the level ${level.absolute} against ${level.attribute} ${score} is `
            + `attribute${sign(relative)}`,
        });
      } else if (stated && catalogued && stated.toUpperCase() !== catalogued.toUpperCase()) {
        findings.push({
          raw: entry.raw, name: entry.name, stated: entry.points, expected, kind: "label",
          because: `the points are right for ${named} skill, which is how the book prices this one, `
            + `but the line calls it ${DIFFICULTY_NAMES[stated.toUpperCase()] || stated}`,
        });
      }
      continue;
    }

    // Paying less than the level implies is what buying up from a default
    // looks like. B175: "you may improve the skill past its default level by
    // paying only the difference in point costs." With a better specialty of
    // the same skill on the sheet, that is the likelier reading than an error,
    // and the book does not print one figure for every pair -- so this says
    // what would explain the gap rather than inventing the number.
    const sibling = best.get(baseSkillName(entry.name));
    const fromDefault = entry.points < expected
      && sibling !== undefined && level.absolute !== null && sibling > level.absolute;
    if (fromDefault) {
      notes.push({
        raw: entry.raw, name: entry.name,
        because: `${entry.points} is less than the ${expected} this level costs outright, which is `
          + `what buying up from a default looks like — another specialty of this skill is on the `
          + `sheet at ${sibling}, and specialties default to one another (B171, B175)`,
      });
      continue;
    }

    const bought = levelFor(difficulty, entry.points);
    const because = bought === null
      ? `${named} skill at attribute${sign(relative)} costs ${expected}`
      : `${entry.points} points buy ${named} skill at attribute${sign(bought)}, `
        + `but it reaches attribute${sign(relative)}`;
    findings.push({
      raw: entry.raw, name: entry.name, stated: entry.points, expected, because, kind: "cost",
    });
  }
  return { findings, notes, checked, unchecked };
}

/**
 * Advantages and disadvantages, where the catalogue prices them with a number.
 *
 * This is where modifiers earn their place: a trait with enhancements and
 * limitations is a base cost and a percentage, so once the base is known the
 * whole thing is computable. Where the book prices a trait as Variable, a range
 * or a choice there is no base, and nothing is claimed.
 */
function traitCostFindings(
  entries: Entry[],
  kind: string,
  index: TraitIndex | null,
): Part {
  const findings: Finding[] = [];
  const notes: Note[] = [];
  let checked = 0;
  let unchecked = 0;
  if (!index) return { findings, notes, checked, unchecked: entries.length };

  for (const entry of entries) {
    if (entry.points === null) { unchecked++; continue; }
    const found = resolveTrait(qualifiedName(entry.name, entry.specialty), index, kind).entry;
    const listed = baseCost(found, traitLevel(entry.name));
    if (listed === null) { unchecked++; continue; }

    // A printed cost carries an asterisk when the trait offers a chance to
    // resist, and the number the sheet writes in parentheses sets the
    // multiplier. B123, and it is the book's own notation.
    const control = found?.self_control ? selfControlNumber(entry.raw) : null;
    const base = found?.self_control
      ? selfControlCost(listed, control)
      : listed;
    if (base === null) { unchecked++; continue; }

    // A price the campaign declared is the answer, not a base to reason from.
    // Jamie's Combat Paralysis is a flat -5 because the GM wrote it down as
    // one, and the note explaining the decision mentions the -40% it replaces
    // -- which the rules below would otherwise take for an unread modifier and
    // decline over. There is nothing to decline: the figure is already final.
    if (isCustom(found)) {
      checked++;
      if (base !== entry.points) {
        findings.push({
          raw: entry.raw, name: entry.name, stated: entry.points, expected: base, kind: "cost",
          because: `your campaign prices this at ${base}`,
        });
      }
      continue;
    }

    // A line that names a modifier without pricing it cannot be totalled, and
    // totalling the rest would report a gap the sheet does not have. Saying so
    // is the point: the GM can then price it, or not, knowing the app did not.
    if (!modifiersArePriced(entry.raw)) {
      notes.push({
        raw: entry.raw, name: entry.name,
        because: `this names a modifier without a percentage, so the ${base} the book charges `
          + `cannot be adjusted — nothing here says whether ${entry.points} is right`,
      });
      continue;
    }
    if (pricedInProse(entry.raw)) {
      notes.push({
        raw: entry.raw, name: entry.name,
        because: `the modifiers are written in the note rather than in brackets after the name, and `
          + `a percentage in a sentence is as likely to be an aside — so the ${base} base is left alone`,
      });
      continue;
    }

    const modifiers = parseModifiers(entry.raw);
    const expected = modifiedCost(base, modifiers);
    if (expected === null) { unchecked++; continue; }

    // A parenthetical that is not a self-control number, not a specialty the
    // book recognises and not a priced modifier may still be a limitation the
    // GM named without valuing. Claiming the unmodified cost against it would
    // be the same mistake in a different coat.
    if (expected !== entry.points && !modifiers.length && unaccountedQualifier(entry, found, control)) {
      notes.push({
        raw: entry.raw, name: entry.name,
        because: `the book prices this at ${expected} and the line qualifies it, so the ${entry.points} `
          + `here may be right — nothing in the line says what the qualifier is worth`,
      });
      continue;
    }

    checked++;
    if (expected !== entry.points) {
      const net = netModifier(modifiers);
      const how = modifiers.length
        ? `${base} base at ${net >= 0 ? "+" : ""}${net}% comes to ${expected}`
        : control !== null
          ? `the book prices it at ${listed} and a self-control number of ${control} makes that ${expected}`
          : `the book prices it at ${expected}`;
      findings.push({
        raw: entry.raw, name: entry.name, stated: entry.points, expected, because: how, kind: "cost",
      });
    }
  }
  return { findings, notes, checked, unchecked };
}

/** Percentages after the cost bracket, where the campaign writes prose. */
function pricedInProse(raw: string): boolean {
  const afterCost = (raw || "").split(/\]/).slice(1).join("]");
  return /[+-]\s*\d+\s*%/.test(afterCost);
}

/**
 * Whether the line qualifies the trait in a way nothing can price.
 *
 * `Lame (Major)` names a variety the book itself prices, and the catalogue
 * knows that skill or trait takes a specialty. `Flight (Winged)` names a
 * limitation printed inside the trait's own entry rather than in the modifier
 * table, and `Precognition (Passive/Vague)` names one the GM invented. Neither
 * is in the catalogue, and guessing at either is how a sheet that is right
 * gets reported as wrong.
 */
function unaccountedQualifier(
  entry: Entry,
  found: { specialised?: boolean } | null,
  control: number | null,
): boolean {
  if (control !== null) return false;              // the parenthetical was the self-control number
  if (found?.specialised) return false;            // the book says this one takes a specialty
  return Boolean(entry.specialty);
}

/** Everything tier two can say about one character. */
export function checkMechanics(
  character: Record<string, unknown> | null | undefined,
  index: TraitIndex | null = null,
): MechanicsCheck {
  const build = pointBuild(character);
  const [attributes, advantages, disadvantages, skills] = build.sections;
  const scores = primaryAttributes(character);

  const parts = [
    attributeFindings(attributes.entries),
    traitCostFindings(advantages.entries, "advantage", index),
    traitCostFindings(disadvantages.entries, "disadvantage", index),
    skillFindings(skills.entries, scores, index),
  ];

  return {
    findings: parts.flatMap(p => p.findings),
    notes: parts.flatMap(p => p.notes),
    checked: parts.reduce((n, p) => n + p.checked, 0),
    unchecked: parts.reduce((n, p) => n + p.unchecked, 0),
  };
}
