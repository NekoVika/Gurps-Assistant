/**
 * Enhancements and limitations: what a modified trait costs.
 *
 * This is what makes the sixty-odd "Variable" traits computable rather than
 * merely recorded. A trait with modifiers is not a different trait — it is a
 * base cost and a percentage — so once the catalogue knows the base, the app
 * can price the whole thing.
 *
 * The rule is B103, quoted rather than remembered:
 *
 *   "You can apply any number of modifiers to a trait. Total them to find the
 *    net modifier, and then apply this modifier to the base cost of the trait.
 *    Round the resulting cost up to the next-highest whole number. ...
 *    Modifiers can never reduce cost by more than 80%. Treat a net modifier of
 *    -80% or worse as -80%."
 *
 * with B11 on what "up" means: "For negative numbers, 'up' means 'in the
 * positive direction'", which is why a -25-point disadvantage at -10% comes to
 * -22 and not -23 (B112's own example).
 */

/** Modifiers can never reduce a cost by more than this. B103. */
export const LIMITATION_FLOOR = -80;

export type Modifier = {
  /** What it was called on the sheet, where it was named. */
  name: string;
  /** Its value as a percentage: +100, -50. */
  percent: number;
};

/** `Affect Substantial, +100%` and `Cosmic, +50%`, separated by ; or , */
const NAMED = /([^;,()]*?)\s*,?\s*([+-]\d+)\s*%/g;

/**
 * Pull the modifiers out of a stored trait line.
 *
 * The campaign writes them in a parenthetical before the cost —
 * `Insubstantiality (Affect Substantial, +100%; Always On, -50%) [128]` — and
 * sometimes in the notes after it. Only the parenthetical form is read: notes
 * are prose, and a percentage mentioned in a sentence is as likely to be an
 * aside as a modifier. Reading those would guess, and a wrong cost is worse
 * than no cost.
 */
export function parseModifiers(text: string): Modifier[] {
  const parenthetical = /\(([^)]*%[^)]*)\)/.exec(text || "");
  if (!parenthetical) return [];
  const found: Modifier[] = [];
  for (const match of parenthetical[1].matchAll(NAMED)) {
    found.push({
      name: match[1].replace(/^[;,\s]+/, "").trim(),
      percent: Number(match[2]),
    });
  }
  return found;
}

/**
 * Whether every modifier on the line carries a value.
 *
 * `Invisibility (Switchable, +10%; Affects bystanders by default) [55]` names
 * two modifiers and prices one. Totalling what is written would give +10% and
 * report a gap that is not there -- the sheet is right and the line is simply
 * incomplete. So a list with any unvalued item is not checkable at all.
 *
 * A parenthetical with no percentage anywhere is read as a specialty rather
 * than a modifier list, which is what `Lame (Major)` is.
 */
export function modifiersArePriced(text: string): boolean {
  const parenthetical = /\(([^)]*%[^)]*)\)/.exec(text || "");
  if (!parenthetical) return true;
  return parenthetical[1]
    .split(";")
    .every(part => !part.trim() || /[+-]\d+\s*%/.test(part));
}

/** The net modifier, with the floor applied. B103. */
export function netModifier(modifiers: Modifier[]): number {
  const total = modifiers.reduce((sum, m) => sum + m.percent, 0);
  return Math.max(total, LIMITATION_FLOOR);
}

/**
 * What a base cost becomes under a set of modifiers.
 *
 * Rounds toward positive infinity, which is what the book means by "up" for
 * both signs: 7.5 becomes 8, and -22.5 becomes -22.
 */
export function modifiedCost(base: number, modifiers: Modifier[]): number | null {
  if (!Number.isFinite(base)) return null;
  const net = netModifier(modifiers);
  return Math.ceil(base * (1 + net / 100));
}

/**
 * The base cost of a trait before modifiers, given what the catalogue says.
 *
 * A per-level trait is priced by its level, which the sheet writes into the
 * name: `Damage Resistance 50` is fifty levels at 5 points each. Anything the
 * catalogue does not price with a number — Variable, a range, a choice — has
 * no base here, and nothing is claimed about it.
 */
export function baseCost(
  entry: { cost_kind?: string | null; cost_value?: number | null } | null,
  level: number | null,
): number | null {
  if (!entry || typeof entry.cost_value !== "number") return null;
  if (entry.cost_kind === "per_level") {
    return level === null ? null : entry.cost_value * level;
  }
  if (entry.cost_kind === "flat") return entry.cost_value;
  return null;
}

/** The level a sheet wrote into a trait's name, as in `Damage Resistance 50`. */
export function traitLevel(name: string): number | null {
  const match = /\s(\d+)\s*$/.exec((name || "").trim());
  return match ? Number(match[1]) : null;
}
