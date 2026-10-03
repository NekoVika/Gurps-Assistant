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
 */

import { pointBuild, type Entry } from "./pointBuild";
import {
  attributeCost, secondaryCost, skillCost, levelFor, SECONDARY, ATTRIBUTE_COST,
  DIFFICULTY_NAMES,
} from "./gurpsRules";
import { resolveTrait, type TraitIndex } from "./traitResolver";
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
};

export type MechanicsCheck = {
  findings: Finding[];
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
  relative: number | null;
};

export function readSkillLevel(level: string): SkillLevel | null {
  const spelled = SPELLED.exec(level || "");
  if (spelled) {
    return { attribute: spelled[1].toUpperCase(), difficulty: spelled[2].toUpperCase(), relative: null };
  }
  const relative = RELATIVE.exec(level || "");
  if (relative) {
    return { attribute: relative[1].toUpperCase(), difficulty: null, relative: Number(relative[2]) };
  }
  return null;
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

function attributeFindings(entries: Entry[]): { findings: Finding[]; checked: number; unchecked: number } {
  const findings: Finding[] = [];
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
  return { findings, checked, unchecked };
}

function skillFindings(
  entries: Entry[],
  scores: Record<string, number>,
  index: TraitIndex | null,
): { findings: Finding[]; checked: number; unchecked: number } {
  const findings: Finding[] = [];
  let checked = 0;
  let unchecked = 0;

  for (const entry of entries) {
    if (entry.points === null) { unchecked++; continue; }
    const level = readSkillLevel(entry.level);
    if (!level) { unchecked++; continue; }

    let { difficulty, relative } = level;
    if (relative === null) {
      // The notation spelled the difficulty out but gave an absolute level, so
      // the relative level comes from the sheet's own attribute.
      const base = scores[level.attribute];
      const final = Number(/-(-?\d+)$/.exec(entry.level)?.[1]);
      if (base === undefined || !Number.isFinite(final)) { unchecked++; continue; }
      relative = final - base;
    }
    if (!difficulty) {
      // The notation gave a relative level but no difficulty, so the catalogue
      // has to supply it. Without one, nothing is claimed.
      const found = index ? resolveTrait(entry.name, index, "skill").entry : null;
      difficulty = (found?.difficulty as string) || null;
    }
    if (!difficulty) { unchecked++; continue; }

    const expected = skillCost(difficulty, relative);
    if (expected === null) { unchecked++; continue; }
    checked++;
    if (expected !== entry.points) {
      const name = DIFFICULTY_NAMES[difficulty.toUpperCase()] || difficulty;
      const named = `${/^[AEIOU]/i.test(name) ? "an" : "a"} ${name}`;
      const bought = levelFor(difficulty, entry.points);
      const sign = (n: number) => `${n >= 0 ? "+" : ""}${n}`;
      // Said as levels rather than costs, because that is what a GM changes --
      // and because a level higher than the points bought is the signature of
      // a Talent or another bonus, which is not an error at all.
      const because = bought === null
        ? `${named} skill at attribute${sign(relative)} costs ${expected}`
        : entry.points < expected
          ? `${entry.points} points buy ${named} skill at attribute${sign(bought)}, but it is written at attribute${sign(relative)} — a Talent or other bonus would account for that`
          : `${entry.points} points buy ${named} skill at attribute${sign(bought)}, but it is written at attribute${sign(relative)}`;
      findings.push({ raw: entry.raw, name: entry.name, stated: entry.points, expected, because });
    }
  }
  return { findings, checked, unchecked };
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
): { findings: Finding[]; checked: number; unchecked: number } {
  const findings: Finding[] = [];
  let checked = 0;
  let unchecked = 0;
  if (!index) return { findings, checked, unchecked: entries.length };

  for (const entry of entries) {
    if (entry.points === null) { unchecked++; continue; }
    const found = resolveTrait(entry.name, index, kind).entry;
    const base = baseCost(found, traitLevel(entry.name));
    if (base === null) { unchecked++; continue; }

    // A line that names a modifier without pricing it cannot be totalled, and
    // totalling the rest would report a gap the sheet does not have.
    if (!modifiersArePriced(entry.raw)) { unchecked++; continue; }
    const modifiers = parseModifiers(entry.raw);
    const expected = modifiedCost(base, modifiers);
    if (expected === null) { unchecked++; continue; }
    checked++;
    if (expected !== entry.points) {
      const net = netModifier(modifiers);
      const how = modifiers.length
        ? `${base} base at ${net >= 0 ? "+" : ""}${net}% comes to ${expected}`
        : `the book prices it at ${expected}`;
      findings.push({ raw: entry.raw, name: entry.name, stated: entry.points, expected, because: how });
    }
  }
  return { findings, checked, unchecked };
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
    checked: parts.reduce((n, p) => n + p.checked, 0),
    unchecked: parts.reduce((n, p) => n + p.unchecked, 0),
  };
}
