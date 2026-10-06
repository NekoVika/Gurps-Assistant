/**
 * What a model should send, and the line the app writes from it.
 *
 * Measured across Anomaly Hunters, not one of twenty-three sheets with a
 * stated total adds up to its own brackets, and the median error is 34% — a
 * hundred-point NPC came out thirty-four points over. That is not a prompt
 * that needs tightening. The cost of a line is not a property of the line:
 * Guns (Rifle) is priced partly by whether Guns (Pistol) is on the same sheet
 * (B171, B175), a disadvantage by its self-control number (B123), a skill by
 * a difficulty printed in the book rather than on the sheet. No amount of
 * instruction makes a model hold that graph while it writes prose.
 *
 * So the model chooses and the app prices. A `BuildEntry` carries only what a
 * person actually decides — which trait, at what level, with which modifiers —
 * and every bracket on the sheet is computed here. A schema with no field for
 * a cost cannot carry a wrong one, which is worth more than any instruction
 * telling it not to.
 *
 * Nothing is migrated. `render()` emits exactly the string the campaign
 * already stores, so the files on disk do not change shape and `parseEntry`
 * reads them as it always has. The round-trip is tested both ways, because
 * that agreement is the whole reason this is safe.
 */

import {
  attributeCost, derive, secondaryCost, skillCost, selfControlCost, selfControlNumber,
  ATTRIBUTE_COST, SECONDARY,
} from "./gurpsRules";
import { baseCost, modifiedCost, type Modifier } from "./modifiers";
import { qualifiedName, resolveTrait, type TraitIndex } from "./traitResolver";
import { isCustom } from "./traitAudit";
import { noTalents, talentBonuses, talentsIn, type BonusFor } from "./talents";

/** A level written against the attribute it is based on: `DX+2`, `IQ-1`. */
const RELATIVE_LEVEL = /^([A-Za-z]+)\s*([+-]\d+)?$/;

/** What a skill can be based on, as the sheet spells each one. */
const CONTROLLING: Record<string, string> = {
  ST: "ST", DX: "DX", IQ: "IQ", HT: "HT", PER: "Per", WILL: "Will",
};

export type BuildEntry = {
  kind: "attribute" | "advantage" | "disadvantage" | "skill";
  /** The trait as the book names it: `Guns/TL`, `Bad Temper`, `DX`. */
  name: string;
  /**
   * A primary or secondary attribute's score. Attributes only, and the one
   * place a number on the line is a choice rather than a consequence.
   */
  score?: number;
  /** A skill's level against its attribute: `DX+2`. Skills only. */
  level?: string;
  /** A levelled trait's level: 50 for `Damage Resistance 50`. */
  levels?: number;
  /** `Rifle` in `Guns/TL8 (Rifle)`, or the variety a trait is bought at. */
  specialty?: string;
  /** The tech level a `/TL` skill is learned at. */
  tl?: number;
  /** A self-control number: 6, 9, 12 or 15. B123. */
  selfControl?: number;
  /** Enhancements and limitations, each with the value the book gives it. */
  modifiers?: Modifier[];
  /** Whatever the GM should read after the cost. Never priced. */
  notes?: string;
};

export type Rendered = {
  /** The line as the campaign stores it, with the cost this file computed. */
  line: string;
  points: number;
};

export type Declined = {
  /** What the model asked for, so the GM can see what went unpriced. */
  name: string;
  /** Why nothing could be written, in the GM's language. */
  problem: string;
  /** The choice itself, where a whole sheet was being built. */
  entry?: BuildEntry;
};

export type Priced = Rendered | Declined;

export function wasPriced(result: Priced): result is Rendered {
  return (result as Rendered).line !== undefined;
}

/** The scores a skill has to be measured against. */
export type Scores = Record<string, number>;

function decline(name: string, problem: string): Declined {
  return { name, problem };
}

/** `[15]`, and `[-10]` where the trait gives points back. */
function bracket(points: number): string {
  return `[${points}]`;
}

function withNotes(line: string, notes?: string): string {
  const tail = (notes || "").trim();
  return tail ? `${line} - ${tail}` : line;
}

/**
 * What Basic Speed and Basic Move come to before anything is spent on them.
 *
 * Both are consequences of DX and HT (B19), so the levels a character pays
 * for are the ones above that figure, not above zero.
 */
function derivedBase(name: string, scores: Scores): number | null {
  const { basicSpeed, basicMove } = derive(scores);
  if (name === "Basic Speed") return basicSpeed;
  if (name === "Basic Move") return basicMove;
  return null;
}

/**
 * An attribute, which is the one kind priced from the sheet alone.
 *
 * A primary attribute costs by the step the book sets (B16-17); a secondary
 * one is priced against the attribute it comes from (B18-19), so that
 * attribute has to be known first. Dodge, Parry and Block are not bought at
 * all — they are derived — so they are written at zero rather than refused.
 */
function renderAttribute(entry: BuildEntry, scores: Scores): Priced {
  const score = entry.score;
  if (score === undefined || !Number.isFinite(score)) {
    return decline(entry.name, "an attribute needs a score");
  }
  const shown = Number.isInteger(score) ? String(score) : score.toFixed(2);

  if (entry.name in ATTRIBUTE_COST) {
    const points = attributeCost(entry.name, score);
    if (points === null) return decline(entry.name, "the book gives no cost for this score");
    return { line: withNotes(`${entry.name} ${shown} ${bracket(points)}`, entry.notes), points };
  }

  const rule = SECONDARY[entry.name];
  if (rule) {
    // HP, Will, Per and FP are priced against an attribute. Basic Speed and
    // Basic Move are priced against the figure the book derives from DX and
    // HT (B19), so the free value has to be computed before the paid levels
    // above it can be counted.
    const free = rule.from ? scores[rule.from] : derivedBase(entry.name, scores);
    if (free === undefined || free === null) {
      return decline(entry.name, rule.from
        ? `priced against ${rule.from}, which is not on the sheet yet`
        : "priced against a figure derived from DX and HT, which are not on the sheet yet");
    }
    const points = secondaryCost(entry.name, score, free);
    if (points === null) return decline(entry.name, "the book gives no cost for this score");
    return { line: withNotes(`${entry.name} ${shown} ${bracket(points)}`, entry.notes), points };
  }

  // Dodge, Parry, Block: consequences of other numbers, never bought.
  return { line: withNotes(`${entry.name} ${shown} ${bracket(0)}`, entry.notes), points: 0 };
}

/**
 * A skill, written in the notation that cannot contradict itself.
 *
 * The campaign stores two notations, and only one of them is safe to generate.
 * `(DX+1)-11` states a label and a level, which can disagree — and does, on
 * sheets already written. `(DX/E)-14` states the difficulty the book gives and
 * the level the skill reaches, which are independent facts, so the form with
 * the difficulty spelled out is the one written here.
 */
function renderSkill(entry: BuildEntry, scores: Scores, index: TraitIndex | null, bonusFor: BonusFor): Priced {
  const written = (entry.level || "").trim();
  const parsed = RELATIVE_LEVEL.exec(written);
  if (!parsed) {
    return decline(entry.name, `a skill needs a level against its attribute, as in "DX+2"`);
  }
  // Skills are bought against Per and Will as well as the four primaries
  // (B170), and those two are not written in capitals.
  const asked = CONTROLLING[parsed[1].toUpperCase()] ?? parsed[1];
  const relative = parsed[2] ? Number(parsed[2]) : 0;

  const found = index
    ? resolveTrait(qualifiedName(entry.name, entry.specialty), index, "skill").entry
    : null;
  const difficulty = (found?.difficulty as string) || null;
  if (!difficulty) {
    return decline(entry.name, "no catalogue entry, so the book's difficulty is unknown");
  }

  // The book says what a skill is based on; a request can only say how far
  // above it. Asked for Scuba at HT+1, a model has chosen "one level of
  // skill" and misremembered the attribute — Scuba is IQ/A (B219) — so the
  // level it meant is IQ+1, and that is the line the checker will accept.
  const printed = typeof found?.attr === "string" ? CONTROLLING[found.attr.toUpperCase()] : undefined;
  const attribute = printed ?? asked;

  const score = scores[attribute];
  if (score === undefined) {
    return decline(entry.name, `measured against ${attribute}, which is not on the sheet`);
  }

  const points = skillCost(difficulty, relative);
  if (points === null) {
    return decline(entry.name, `the book's table does not price ${attribute}${parsed[2] || "+0"}`);
  }

  // The sheet writes the tech level it was learned at; the book prints `/TL`.
  // A model often drops the `/TL` from the name, so the book's name decides
  // whether there is one to write: "Guns" with tl 8 is Guns/TL8.
  const base = entry.tl !== undefined
    && typeof found?.name === "string" && /\/TL$/i.test(found.name)
    && !/\/TL\d*$/i.test(entry.name)
    ? `${entry.name}/TL`
    : entry.name;
  const name = entry.tl !== undefined ? base.replace(/\/TL$/i, `/TL${entry.tl}`) : base;
  const specialty = entry.specialty ? ` (${entry.specialty})` : "";
  // The level asked for is the one bought. A Talent on the same sheet adds to
  // it for free (B89), so the line states the higher level at the same cost.
  const talent = bonusFor(entry.name, entry.specialty ?? "").bonus;
  const level = `(${attribute}/${difficulty.toUpperCase()})-${score + relative + talent}`;
  return {
    line: withNotes(`${name}${specialty} ${level} ${bracket(points)}`, entry.notes),
    points,
  };
}

/**
 * An advantage or disadvantage, priced from the catalogue and the line's own
 * choices: its level where the book charges per level, its self-control
 * number where the book marks the cost with an asterisk, and its modifiers.
 *
 * Where the book prices a trait Variable, or as a range or a choice, there is
 * no single figure to start from and this declines rather than guessing. That
 * is the honest boundary: those are the traits a person still has to price,
 * and naming them is more useful than a plausible number.
 */
function renderTrait(entry: BuildEntry, kind: string, index: TraitIndex | null): Priced {
  if (!index) return decline(entry.name, "no catalogue loaded, so nothing prices this");

  const found = resolveTrait(qualifiedName(entry.name, entry.specialty), index, kind).entry;
  if (!found) return decline(entry.name, "this name is in no catalogue");

  const listed = baseCost(found, entry.levels ?? null);
  if (listed === null) {
    const printed = found.cost_text ? `"${found.cost_text}"` : "no single figure";
    if (found.cost_kind === "per_level") {
      return decline(entry.name, "the book charges this per level, and no level was given");
    }
    // A trait the campaign invented is the GM's to price, so the answer is to
    // go and set a cost on it rather than to consult the book.
    return isCustom(found)
      ? decline(entry.name,
          `your campaign declares this trait but gives its cost as ${printed}, `
          + "so set a figure on it in Custom Traits")
      : decline(entry.name, `the book prices this ${printed}, so a person has to choose`);
  }

  // B123: the number in parentheses multiplies the printed cost.
  const control = found.self_control ? (entry.selfControl ?? null) : null;
  if (found.self_control && control === null) {
    return decline(entry.name, "this one takes a self-control number (6, 9, 12 or 15)");
  }
  const base = found.self_control ? selfControlCost(listed, control) : listed;
  if (base === null) {
    return decline(entry.name, `${control} is not a self-control number the book uses`);
  }

  const modifiers = entry.modifiers ?? [];
  const points = modifiedCost(base, modifiers);
  if (points === null) return decline(entry.name, "the modifiers could not be totalled");

  const level = entry.levels !== undefined && found.cost_kind === "per_level"
    ? ` ${entry.levels}` : "";
  const qualifier = control !== null
    ? ` (${control})`
    : modifiers.length
      ? ` (${modifiers.map(m => `${m.name}, ${m.percent >= 0 ? "+" : ""}${m.percent}%`).join("; ")})`
      : entry.specialty
        ? ` (${entry.specialty})`
        : "";
  return {
    line: withNotes(`${entry.name}${level}${qualifier} ${bracket(points)}`, entry.notes),
    points,
  };
}

/** Write one chosen entry as the line the campaign stores, or say why not. */
export function render(
  entry: BuildEntry, scores: Scores, index: TraitIndex | null = null, bonusFor: BonusFor = noTalents,
): Priced {
  switch (entry.kind) {
    case "attribute": return renderAttribute(entry, scores);
    case "skill": return renderSkill(entry, scores, index, bonusFor);
    case "advantage": return renderTrait(entry, "advantage", index);
    case "disadvantage": return renderTrait(entry, "disadvantage", index);
    default: return decline(entry.name, `"${entry.kind}" is not a section of a sheet`);
  }
}

export type BuiltSheet = {
  attributes: string[];
  advantages: string[];
  disadvantages: string[];
  skills: string[];
  /** The total the app computed, which is the only total worth stating. */
  pointTotal: number;
  /** Everything nothing could price, for the GM to settle by hand. */
  declined: Declined[];
};

/**
 * Price a whole chosen build.
 *
 * Attributes are rendered first and in the order given, because a secondary
 * characteristic is priced against a primary one and a skill against both —
 * which is the dependency that made asking a model for this hopeless, and is
 * trivial once something holds the sheet in memory while it works.
 */
export function buildSheet(entries: BuildEntry[], index: TraitIndex | null = null): BuiltSheet {
  const sheet: BuiltSheet = {
    attributes: [], advantages: [], disadvantages: [], skills: [],
    pointTotal: 0, declined: [],
  };
  const scores: Scores = {};

  const bucket: Record<BuildEntry["kind"], keyof BuiltSheet> = {
    attribute: "attributes", advantage: "advantages",
    disadvantage: "disadvantages", skill: "skills",
  };

  // Attributes before anything measured against them, and traits before
  // skills, because a Talent among the traits raises skills (B89).
  const ordered = [
    ...entries.filter(e => e.kind === "attribute" && e.name in ATTRIBUTE_COST),
    ...entries.filter(e => e.kind === "attribute" && !(e.name in ATTRIBUTE_COST)),
    ...entries.filter(e => e.kind === "advantage" || e.kind === "disadvantage"),
    ...entries.filter(e => e.kind === "skill"),
  ];

  const talents = talentsIn(index);
  for (const entry of ordered) {
    if (entry.kind === "attribute" && entry.score !== undefined) scores[entry.name] = entry.score;
    const bonusFor = entry.kind === "skill" ? talentBonuses(sheet.advantages, talents) : noTalents;
    const result = render(entry, scores, index, bonusFor);
    if (!wasPriced(result)) { sheet.declined.push({ ...result, entry }); continue; }
    const target = bucket[entry.kind];
    if (target) (sheet[target] as string[]).push(result.line);
    sheet.pointTotal += result.points;
  }
  return sheet;
}

/** The self-control number a rendered line carries, for the round-trip test. */
export { selfControlNumber };
