/**
 * A model's `CharacterBuild`, turned into the sheet the campaign stores.
 *
 * `characterBuild.ts` prices choices; this is the seam between it and a
 * provider. What arrives is whatever the backend validated against
 * `gurpsai.domain.character_build`, so it is snake_case and carries `null`
 * for every field the model left out — and the renderer reads `undefined` as
 * "not chosen" and `null` as a value. Normalising that here is what keeps a
 * skill from being written as `Guns/TLnull`.
 *
 * Two rules decide what lands in the file, both settled with the GM:
 *
 *  - A choice the app cannot price stays on the sheet, in its own section,
 *    with no bracket and the reason as its note. The budget then reads it as
 *    unread and calls the total a floor, which is the truth. Dropping it would
 *    lose something the model chose for a reason.
 *  - What the model itself said the book does not price — a Patron, a Secret —
 *    goes under "Left to the GM" in the GM Summary, in its own words.
 */

import { buildSheet, type BuildEntry, type Declined } from "./characterBuild";
import { derive, ATTRIBUTE_COST } from "./gurpsRules";
import type { Modifier } from "./modifiers";
import { parseEntry } from "./pointBuild";
import { serializeGear } from "./TraitFormatters";
import type { TraitIndex } from "./traitResolver";

const KINDS = new Set<BuildEntry["kind"]>(["attribute", "advantage", "disadvantage", "skill"]);

/** The order every sheet in the campaign lists its attributes in. */
const ATTRIBUTE_ORDER = ["ST", "DX", "IQ", "HT", "HP", "Will", "Per", "FP", "Basic Speed", "Basic Move"];

function text(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function number(value: unknown): number | undefined {
  const n = typeof value === "string" ? Number(value.trim()) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : undefined;
}

function modifiers(value: unknown): Modifier[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out = value.flatMap(m => {
    const name = text((m as Record<string, unknown>)?.name);
    const percent = number((m as Record<string, unknown>)?.percent);
    return name && percent !== undefined ? [{ name, percent }] : [];
  });
  return out.length ? out : undefined;
}

/**
 * Attribute names a model spells out. Live, Gemini sent "Perception", which
 * the renderer took for a derived figure and wrote as a second `Per` at [0].
 */
const ATTRIBUTE_ALIASES: Record<string, string> = {
  strength: "ST", dexterity: "DX", intelligence: "IQ", health: "HT",
  "hit points": "HP", willpower: "Will", will: "Will",
  perception: "Per", per: "Per", "fatigue points": "FP",
  speed: "Basic Speed", "basic speed": "Basic Speed",
  move: "Basic Move", "basic move": "Basic Move",
  st: "ST", dx: "DX", iq: "IQ", ht: "HT", hp: "HP", fp: "FP",
};

/** One entry as the model sent it, as the renderer expects it. */
export function entryFromModel(raw: unknown): BuildEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const kind = r.kind as BuildEntry["kind"];
  const said = text(r.name);
  const name = said && kind === "attribute" ? ATTRIBUTE_ALIASES[said.toLowerCase()] ?? said : said;
  if (!KINDS.has(kind) || !name) return null;

  const entry: BuildEntry = { kind, name };
  // Live, Gemini sent `"name": "Guns (Pistol)"` with no specialty, and the
  // chat draft then added a second Guns line beside the one it was raising.
  // A trailing parenthesis is the specialty when none is given: the book is
  // looked up as "Name (Specialty)" either way, so only the matching changes.
  const split = kind !== "attribute" && !text(r.specialty) ? /^(.+?)\s*\(([^()]+)\)$/.exec(name) : null;
  if (split) {
    entry.name = split[1].trim();
    entry.specialty = split[2].trim();
  }
  const score = number(r.score);
  if (score !== undefined) entry.score = score;
  const level = text(r.level);
  if (level !== undefined) entry.level = level;
  const levels = number(r.levels);
  if (levels !== undefined) entry.levels = levels;
  const specialty = text(r.specialty);
  if (specialty !== undefined) entry.specialty = specialty;
  const tl = number(r.tl);
  if (tl !== undefined) entry.tl = tl;
  const control = number(r.self_control ?? r.selfControl);
  if (control !== undefined) entry.selfControl = control;
  const mods = modifiers(r.modifiers);
  if (mods) entry.modifiers = mods;
  // A model writes "[15]" out of habit, and the parser reads the last bracket
  // on a line as its cost — so one left in a note would overrule the app's.
  const notes = text(typeof r.notes === "string" ? r.notes.replace(/\[+\s*-?\d+\s*\]+/g, "") : r.notes);
  if (notes !== undefined) entry.notes = notes;
  return entry;
}

/** The scores a sheet already states, read from its own attribute lines. */
export function statedScores(lines: unknown): Record<string, number> {
  const scores: Record<string, number> = {};
  if (!Array.isArray(lines)) return scores;
  for (const line of lines) {
    if (typeof line !== "string") continue;
    const read = parseEntry(line, "attribute");
    const score = Number(read.level);
    if (read.name && read.level && Number.isFinite(score)) scores[read.name] = score;
  }
  return scores;
}

/**
 * Every attribute a sheet lists, chosen or not.
 *
 * A model leaves out what it did not change, and that is fine: the book gives
 * every one a default (B14-19). Writing those defaults at [0] keeps the sheet
 * the shape the campaign's other sheets have, and — the real reason — lets a
 * skill bought against Per be priced when the model never mentioned Per.
 *
 * `fixed` is a sheet that already exists. Its scores win, because the merge
 * keeps them, and a skill priced against a DX the file does not have would
 * be written at a level the character does not reach.
 */
function completeAttributes(entries: BuildEntry[], fixed: Record<string, number>): BuildEntry[] {
  const chosen = new Map<string, BuildEntry>();
  for (const e of entries) if (e.kind === "attribute") chosen.set(e.name, e);
  for (const [name, score] of Object.entries(fixed)) {
    chosen.set(name, { ...(chosen.get(name) ?? { kind: "attribute", name }), score });
  }

  const scoreOf = (name: string) => chosen.get(name)?.score;
  for (const name of Object.keys(ATTRIBUTE_COST)) {
    if (scoreOf(name) === undefined) chosen.set(name, { kind: "attribute", name, score: 10 });
  }

  const d = derive({ ST: scoreOf("ST"), DX: scoreOf("DX"), IQ: scoreOf("IQ"), HT: scoreOf("HT") });
  const defaults: Record<string, number | null> = {
    HP: d.hp, Will: d.will, Per: d.per, FP: d.fp,
    "Basic Speed": d.basicSpeed, "Basic Move": d.basicMove,
  };
  for (const [name, value] of Object.entries(defaults)) {
    if (scoreOf(name) === undefined && value !== null) {
      chosen.set(name, { kind: "attribute", name, score: value });
    }
  }

  const rank = (name: string) => {
    const i = ATTRIBUTE_ORDER.indexOf(name);
    return i === -1 ? ATTRIBUTE_ORDER.length : i;
  };
  const attributes = [...chosen.values()].sort((a, b) => rank(a.name) - rank(b.name));
  return [...attributes, ...entries.filter(e => e.kind !== "attribute")];
}

/**
 * A choice nothing could price, written so the GM can see it and finish it.
 *
 * No bracket, deliberately: a guessed `[0]` would be read as a real cost, and
 * on this sheet a nought is one (B23, B51). With none, the budget counts the
 * line as unread and says the total is a floor.
 */
export function unpricedLine(declined: Declined): string {
  const e = declined.entry;
  const name = e?.kind === "skill" && e.tl !== undefined
    ? declined.name.replace(/\/TL$/i, `/TL${e.tl}`)
    : declined.name;
  const head = [
    name,
    e?.levels !== undefined ? String(e.levels) : "",
    e?.specialty ? `(${e.specialty})` : "",
  ].filter(Boolean).join(" ");
  const said = [
    e?.kind === "skill" && e.level ? `at ${e.level}` : "",
    e?.kind === "attribute" && e.score !== undefined ? `at ${e.score}` : "",
    e?.notes ?? "",
  ].filter(Boolean).join("; ");
  return `${head} - ${said ? `${said}; ` : ""}not priced: ${declined.problem}`;
}

export type GeneratedSheet = {
  attributes: string[];
  advantages: string[];
  disadvantages: string[];
  skills: string[];
  /** What the priced lines add up to. A floor wherever `unpriced` is not 0. */
  pointTotal: string;
  /** Lines on the sheet with no cost, for the GM to finish. */
  unpriced: number;
  /** What the model said the book does not price, in its own words. */
  leftToGM: string[];
};

/**
 * Price a whole generated build into the fields `CharacterData` stores.
 *
 * `build` is the model's `CharacterBuild`; `existing` is the sheet being
 * deepened, if any, whose attribute scores the new lines are priced against.
 */
export function sheetFromBuild(
  build: unknown,
  index: TraitIndex | null,
  existing?: Record<string, unknown> | null,
): GeneratedSheet {
  const raw = (build && typeof build === "object" ? build : {}) as Record<string, unknown>;
  const chosen = (Array.isArray(raw.entries) ? raw.entries : [])
    .map(entryFromModel)
    .filter((e): e is BuildEntry => e !== null);

  const entries = completeAttributes(chosen, statedScores(existing?.attributes));
  const sheet = buildSheet(entries, index);

  const sections = {
    attribute: sheet.attributes, advantage: sheet.advantages,
    disadvantage: sheet.disadvantages, skill: sheet.skills,
  };
  // A model sometimes lists a choice twice, once whole and once without its
  // level. The priced copy is the choice; the other is noise, not a gap.
  const key = (e: BuildEntry) =>
    `${e.kind}|${e.name.toLowerCase().replace(/\/tl\d*$/, "")}|${(e.specialty ?? "").toLowerCase()}`;
  const unpriced = new Set(sheet.declined.map(d => d.entry));
  const priced = new Set(entries.filter(e => !unpriced.has(e)).map(key));
  const declined = sheet.declined.filter(d => !d.entry || !priced.has(key(d.entry)));

  for (const d of declined) {
    const kind = d.entry?.kind;
    if (kind && sections[kind]) sections[kind].push(unpricedLine(d));
  }

  const leftToGM = (Array.isArray(raw.unpriceable) ? raw.unpriceable : [])
    .map(text)
    .filter((s): s is string => s !== undefined);

  return {
    attributes: sheet.attributes,
    advantages: sheet.advantages,
    disadvantages: sheet.disadvantages,
    skills: sheet.skills,
    pointTotal: String(sheet.pointTotal),
    unpriced: declined.length,
    leftToGM,
  };
}

/**
 * A model's gear items, written as the lines the sheet stores.
 *
 * Each part arrives in its own field, so the only way to write an unreadable
 * line is for a field to carry the notation's own punctuation: a bracket in a
 * name reads as a quantity, a parenthesis or comma in a weight splits the
 * weight-and-cost group. Those are taken out of the parts they would break.
 * A weight or cost the model did not give is written "?", never 0 — a
 * nought here would read as a fact.
 *
 * A string where an item was expected is kept as sent: it is the model's
 * choice, and the sheet will say if it cannot read it.
 */
export function gearLines(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap(item => {
    if (typeof item === "string") return item.trim() ? [item.trim()] : [];
    if (!item || typeof item !== "object") return [];
    const r = item as Record<string, unknown>;
    const name = text(r.name)?.replace(/[[\]]/g, "").trim();
    if (!name) return [];
    const count = number(r.quantity);
    const quantity = count !== undefined && count >= 1 ? Math.floor(count) : 1;
    const weight = text(r.weight)?.replace(/[(),]/g, "").trim() || "?";
    const cost = text(r.cost)?.replace(/[()]/g, "").trim() || "?";
    const notes = text(r.notes);
    return [serializeGear({ name, quantity, weight, cost, notes: notes ?? "" })];
  });
}

/** The GM Summary block for what the model handed back unpriced. */
export function leftToGMBlock(items: string[]): string {
  if (!items.length) return "";
  return ["Left to the GM:", ...items.map(i => `- ${i}`)].join("\n");
}
