/**
 * The arithmetic GURPS does for you, so the app can stop asking a model for it.
 *
 * Every figure here was read out of the Basic Set rather than recalled, and the
 * citation is on each one. That matters more than it sounds: this is a GURPS
 * tool, and a plausible-looking wrong cost is worse than no cost, because the
 * GM has no reason to doubt it. Where the book is ambiguous or the rule needs
 * judgement, nothing is computed and the caller is told so.
 *
 * None of it needs the rules database. These are formulas and small fixed
 * tables, not catalogue entries — which is why tier two works on a machine
 * that has never ingested a PDF.
 */

/** Point cost per level of a primary attribute. Basic Set p.16-17. */
export const ATTRIBUTE_COST: Record<string, number> = {
  ST: 10,   // "10 points to raise ST or HT by one level" (B16)
  HT: 10,
  DX: 20,   // "20 points to raise DX or IQ by one level" (B16)
  IQ: 20,
};

/** Secondary characteristics: cost per point, and what they default to. B18-19. */
export const SECONDARY: Record<string, { cost: number; from: string; step: number }> = {
  HP: { cost: 2, from: "ST", step: 1 },            // "2 points per ±1 HP" (B18)
  Will: { cost: 5, from: "IQ", step: 1 },          // "5 points per ±1 Will" (B18)
  Per: { cost: 5, from: "IQ", step: 1 },           // "5 points per ±1 Per" (B18)
  FP: { cost: 3, from: "HT", step: 1 },            // "3 points per ±1 FP" (B18)
  "Basic Speed": { cost: 5, from: "", step: 0.25 },// "5 points per ±0.25" (B19)
  "Basic Move": { cost: 5, from: "", step: 1 },    // "5 points per ±1 yard/second" (B19)
};

/**
 * Skill Cost Table, B172, as printed.
 *
 * Indexed by level relative to the controlling attribute. The book's own
 * worked example is the test: Shortsword (DX/Average) at DX+3 costs 12.
 */
export const SKILL_COST: Record<string, Record<number, number>> = {
  E:  { 0: 1, 1: 2, 2: 4, 3: 8, 4: 12, 5: 16 },
  A:  { [-1]: 1, 0: 2, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20 },
  H:  { [-2]: 1, [-1]: 2, 0: 4, 1: 8, 2: 12, 3: 16, 4: 20, 5: 24 },
  VH: { [-3]: 1, [-2]: 2, [-1]: 4, 0: 8, 1: 12, 2: 16, 3: 20, 4: 24, 5: 28 },
};

/** Above +5 the table stops and each further level costs 4 more. B172. */
const EXTRA_LEVEL = 4;

/**
 * Self-control numbers, B123.
 *
 *   "You resist quite rarely (roll of 6 or less): 2 x listed cost.
 *    You resist fairly often (roll of 9 or less): 1.5 x listed cost.
 *    You resist quite often (roll of 12 or less): listed cost.
 *    You resist almost all the time (roll of 15 or less): 0.5 x listed cost.
 *    Drop all fractions (e.g., -22.5 points becomes -22 points)."
 *
 * The book writes the number in parentheses after the name -- "Berserk (9)" --
 * and its own Tiger Shark on B461 is written that way, so a campaign using the
 * notation is following the Basic Set rather than departing from it. 12 is the
 * default, which is why a printed cost carries an asterisk instead of a table.
 */
export const SELF_CONTROL: Record<number, number> = {
  6: 2, 9: 1.5, 12: 1, 15: 0.5,
};

/** The self-control number a line declares, as in `Bad Temper (9) [-15]`. */
export function selfControlNumber(text: string): number | null {
  for (const match of (text || "").matchAll(/\((\d{1,2})\)/g)) {
    const n = Number(match[1]);
    if (n in SELF_CONTROL) return n;
  }
  return null;
}

/**
 * What a self-control disadvantage costs at a given number.
 *
 * "Drop all fractions" means toward zero, which for a negative cost is the
 * same direction the book rounds everything else: -22.5 becomes -22.
 */
export function selfControlCost(listed: number, number: number | null): number | null {
  if (!Number.isFinite(listed)) return null;
  const multiplier = number === null ? 1 : SELF_CONTROL[number];
  if (multiplier === undefined) return null;
  return Math.trunc(listed * multiplier);
}

export const DIFFICULTY_NAMES: Record<string, string> = {
  E: "Easy", A: "Average", H: "Hard", VH: "Very Hard",
};

/** What a skill costs at a relative level, or null when the book does not say. */
export function skillCost(difficulty: string, relative: number): number | null {
  const table = SKILL_COST[(difficulty || "").toUpperCase()];
  if (!table || !Number.isFinite(relative)) return null;
  if (relative in table) return table[relative];
  if (relative > 5) return table[5] + (relative - 5) * EXTRA_LEVEL;
  return null;  // below the table a skill cannot be bought at all
}

/**
 * The relative level a number of points buys, or null when it buys none.
 *
 * The inverse of the table, and the more useful direction for a GM: "these 4
 * points buy Average+1" says what to change, where "it should cost 2" does not.
 */
export function levelFor(difficulty: string, points: number): number | null {
  const table = SKILL_COST[(difficulty || "").toUpperCase()];
  if (!table || !Number.isFinite(points) || points < 1) return null;
  let best: number | null = null;
  for (const [relative, cost] of Object.entries(table)) {
    if (cost <= points && (best === null || Number(relative) > best)) best = Number(relative);
  }
  if (best === null) return null;
  // Past the printed table each further level costs four more.
  const top = table[5];
  if (top !== undefined && points >= top) best = 5 + Math.floor((points - top) / EXTRA_LEVEL);
  return best;
}

/** What a primary attribute costs at a given score. B16-17. */
export function attributeCost(name: string, score: number): number | null {
  const per = ATTRIBUTE_COST[name];
  if (per === undefined || !Number.isFinite(score)) return null;
  return (score - 10) * per;
}

/** What a secondary characteristic costs, given the attribute it comes from. B18-19. */
export function secondaryCost(name: string, score: number, base: number): number | null {
  const rule = SECONDARY[name];
  if (!rule || !Number.isFinite(score) || !Number.isFinite(base)) return null;
  return Math.round(((score - base) / rule.step) * rule.cost);
}

export type Derived = {
  basicSpeed: number | null;
  basicMove: number | null;
  basicLift: number | null;
  dodge: number | null;
  thrust: string | null;
  swing: string | null;
  hp: number | null;
  will: number | null;
  per: number | null;
  fp: number | null;
};

/**
 * Basic damage by ST, B16. A table rather than a formula, and only the human
 * range is transcribed; outside it the app says nothing rather than guess.
 */
const DAMAGE: Record<number, [string, string]> = {
  1: ["1d-6", "1d-5"], 2: ["1d-6", "1d-5"], 3: ["1d-5", "1d-4"], 4: ["1d-5", "1d-4"],
  5: ["1d-4", "1d-3"], 6: ["1d-4", "1d-3"], 7: ["1d-3", "1d-2"], 8: ["1d-3", "1d-2"],
  9: ["1d-2", "1d-1"], 10: ["1d-2", "1d"], 11: ["1d-1", "1d+1"], 12: ["1d-1", "1d+2"],
  13: ["1d", "2d-1"], 14: ["1d", "2d"], 15: ["1d+1", "2d+1"], 16: ["1d+1", "2d+2"],
  17: ["1d+2", "3d-1"], 18: ["1d+2", "3d"], 19: ["2d-1", "3d+1"], 20: ["2d-1", "3d+2"],
};

/** Everything the book derives from ST, DX, IQ and HT. */
export function derive(primary: {
  ST?: number; DX?: number; IQ?: number; HT?: number;
}): Derived {
  const { ST, DX, IQ, HT } = primary;
  // "add your HT and DX together, and then divide the total by 4.
  //  Do not round it off." (B19)
  const basicSpeed = DX !== undefined && HT !== undefined ? (DX + HT) / 4 : null;
  // "Basic Move starts out equal to Basic Speed, less any fractions" (B19)
  const basicMove = basicSpeed === null ? null : Math.floor(basicSpeed);
  // "(ST×ST)/5 lbs. If BL is 10 lbs. or more, round to the nearest whole
  //  number" (B17)
  const rawLift = ST === undefined ? null : (ST * ST) / 5;
  const basicLift = rawLift === null ? null : (rawLift >= 10 ? Math.round(rawLift) : rawLift);
  // "Dodge ... equals Basic Speed + 3, dropping all fractions" (B19)
  const dodge = basicSpeed === null ? null : Math.floor(basicSpeed + 3);
  const damage = ST !== undefined ? DAMAGE[ST] : undefined;
  return {
    basicSpeed, basicMove, basicLift, dodge,
    thrust: damage ? damage[0] : null,
    swing: damage ? damage[1] : null,
    hp: ST ?? null,       // "By default, you have HP equal to your ST" (B18)
    will: IQ ?? null,     // "By default, Will is equal to IQ" (B18)
    per: IQ ?? null,      // "By default, Per equals IQ" (B18)
    fp: HT ?? null,       // "By default, you have FP equal to your HT" (B18)
  };
}

/** Encumbrance bands, B19. Each is a multiple of Basic Lift. */
export const ENCUMBRANCE = [
  { level: 0, name: "None", maxBL: 1, move: 1, dodge: 0 },
  { level: 1, name: "Light", maxBL: 2, move: 0.8, dodge: -1 },
  { level: 2, name: "Medium", maxBL: 3, move: 0.6, dodge: -2 },
  { level: 3, name: "Heavy", maxBL: 6, move: 0.4, dodge: -3 },
  { level: 4, name: "Extra-Heavy", maxBL: 10, move: 0.2, dodge: -4 },
];

/** Which encumbrance band a load falls in, or null when it exceeds them all. */
export function encumbranceFor(weight: number, basicLift: number) {
  if (!Number.isFinite(weight) || !Number.isFinite(basicLift) || basicLift <= 0) return null;
  return ENCUMBRANCE.find(band => weight <= band.maxBL * basicLift) ?? null;
}
