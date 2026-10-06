/**
 * Say, for every mechanical line on a sheet, where its price comes from.
 *
 * GURPS lets a GM invent traits and the rules say nothing against it, so a
 * catalogue built from books can never be a closed list. A name it does not
 * know might be a gap in our extraction, or it might be `Sharp Teeth`, which
 * this campaign uses ten times and no book will ever contain.
 *
 * Three answers, and the app owes each a different duty:
 *
 *   catalogued   a book prices it, so the cost can be checked
 *   custom       the GM declared it, so the declared cost is final
 *   unrecognised nobody has said what it costs, so nothing is claimed
 *
 * The third is not an error. It is the to-do list — for the catalogue when the
 * trait is really from a book, and for the campaign when it is homebrew.
 */

import { pointBuild, type Entry } from "./pointBuild";
import {
  buildTraitIndex, qualifiedName, resolveTrait,
  type CatalogueEntry, type TraitIndex,
} from "./traitResolver";

export type CustomTrait = {
  name: string;
  /** advantage, disadvantage, skill, perk or quirk — whatever the GM calls it. */
  kind: string;
  /** As the GM writes it: "12", "-5", "2/level", "Variable". */
  cost: string;
  notes?: string;
};

export type Provenance = "catalogued" | "custom" | "unrecognised";

export type AuditedEntry = {
  entry: Entry;
  kind: string;
  provenance: Provenance;
  /** The catalogue or campaign entry this matched, when it matched. */
  source: CatalogueEntry | null;
};

export type TraitAudit = {
  entries: AuditedEntry[];
  catalogued: number;
  custom: number;
  unrecognised: AuditedEntry[];
};

/** Which sections carry traits a book could price. Attributes are formulaic. */
const AUDITED_KINDS: Record<string, string> = {
  advantage: "advantage",
  disadvantage: "disadvantage",
  skill: "skill",
};

/**
 * Fold the GM's declared traits in beside the books'.
 *
 * They are kept in one index rather than two so a caller cannot forget to ask
 * the second one. Campaign entries are marked, because "your campaign says 12"
 * and "the Basic Set says 12" are different claims and the UI should be able
 * to tell the GM which it used.
 */
/**
 * The shape of a cost a GM typed into the custom-trait box.
 *
 * The editor promises that the cost you give is the cost the app uses, and it
 * was not keeping that promise: a declared trait was stamped `declared`, which
 * reaches no priced branch, so homebrew was quietly left out of every total.
 * A GM who writes "12" has said what it costs, and the app should hold the
 * sheet to it exactly as it does for a printed trait.
 *
 * This is not the extractor's `classify_cost` in another language. That one
 * reads a cell from the book's own tables and has to cope with eight printed
 * shapes. This reads one short form field, and only has to recognise the two
 * ways a single figure can be written. Anything else is a trait the campaign
 * named but did not price with a number, which the app records and leaves
 * alone -- the same answer the book's own Variable traits get.
 */
function declaredCost(text: string | undefined): { kind: string; value: number | null } {
  const raw = (text ?? "").trim();
  if (/^-?\d+$/.test(raw)) return { kind: "flat", value: Number(raw) };
  const perLevel = /^(-?\d+)\s*\/\s*level$/i.exec(raw);
  if (perLevel) return { kind: "per_level", value: Number(perLevel[1]) };
  return { kind: "declared", value: null };
}

export type CustomSkill = {
  name: string;
  attr: string;
  difficulty: string;
  tl?: boolean;
  specialised?: boolean;
  defaults?: string;
  notes?: string;
};

/**
 * A campaign skill as a catalogue entry: the same shape the book's skills
 * have, so everything that prices a book skill prices it too.
 */
function declaredSkill(s: CustomSkill): CatalogueEntry {
  const bare = s.name.trim().replace(/\/TL\d*$/i, "");
  return {
    book_id: 0,
    kind: "skill",
    name: s.tl ? `${bare}/TL` : bare,
    cost_text: "",
    cost_kind: "formula",
    cost_value: null,
    attr: (s.attr || "").trim(),
    difficulty: (s.difficulty || "").trim().toUpperCase(),
    defaults: s.defaults ?? "",
    specialised: Boolean(s.specialised),
    page: null,
    campaign: true,
    notes: s.notes ?? "",
  };
}

export function buildIndex(
  catalogue: CatalogueEntry[],
  custom: CustomTrait[] = [],
  skills: CustomSkill[] = [],
): TraitIndex {
  const declared: CatalogueEntry[] = custom
    .filter(t => t && typeof t.name === "string" && t.name.trim())
    .map(t => {
      const { kind: costKind, value } = declaredCost(t.cost);
      return {
        book_id: 0,
        kind: (t.kind || "advantage").trim(),
        name: t.name.trim(),
        cost_text: t.cost ?? "",
        cost_kind: costKind,
        cost_value: value,
        page: null,
        campaign: true,
        notes: t.notes ?? "",
      };
    });
  const declaredSkills = skills
    .filter(s => s && typeof s.name === "string" && s.name.trim())
    .map(declaredSkill);
  // The campaign is listed first, so a GM who redefines a printed trait gets
  // their own price. It is their table.
  return buildTraitIndex([...declared, ...declaredSkills, ...catalogue]);
}

/**
 * What the campaign declared, as lines a model can choose from.
 *
 * A model that has never seen this campaign cannot know its own skills and
 * traits, and a near-miss name ("Rumor Mongering") is a line nothing prices.
 * The list is short -- a campaign declares a handful -- so it costs little
 * to send with every character the wizard builds. Empty when nothing is
 * declared.
 */
export function campaignVocabulary(index: TraitIndex | null): string {
  if (!index) return "";
  const skills: string[] = [];
  const traits: string[] = [];
  const seen = new Set<string>();
  for (const entries of index.byName.values()) {
    for (const e of entries) {
      if (!isCustom(e) || seen.has(e.name)) continue;
      seen.add(e.name);
      if (e.kind === "skill") skills.push(`${e.name} (${e.attr}/${e.difficulty})`);
      else traits.push(`${e.name} (${e.kind}${e.cost_text ? `, ${e.cost_text}` : ""})`);
    }
  }
  const lines: string[] = [];
  if (skills.length) lines.push(`This campaign's own skills, priced like any skill -- use these exact names: ${skills.join("; ")}.`);
  if (traits.length) lines.push(`This campaign's own traits -- use these exact names: ${traits.join("; ")}.`);
  return lines.join("\n");
}

export function isCustom(entry: CatalogueEntry | null): boolean {
  return Boolean(entry && (entry as { campaign?: boolean }).campaign);
}

/** Classify every mechanical line on one character. */
export function auditTraits(
  character: Record<string, unknown> | null | undefined,
  index: TraitIndex,
): TraitAudit {
  const entries: AuditedEntry[] = [];
  for (const section of pointBuild(character).sections) {
    const kind = AUDITED_KINDS[section.kind];
    if (!kind) continue;
    for (const entry of section.entries) {
      if (!entry.name) continue;
      const found = resolveTrait(qualifiedName(entry.name, entry.specialty), index, kind).entry;
      entries.push({
        entry,
        kind,
        provenance: !found ? "unrecognised" : isCustom(found) ? "custom" : "catalogued",
        source: found,
      });
    }
  }
  return {
    entries,
    catalogued: entries.filter(e => e.provenance === "catalogued").length,
    custom: entries.filter(e => e.provenance === "custom").length,
    unrecognised: entries.filter(e => e.provenance === "unrecognised"),
  };
}

/**
 * Every name across a campaign that nobody prices, commonest first.
 *
 * This is the useful end of the audit: it is simultaneously the gap list for
 * the catalogue and the candidate list for declaring homebrew.
 */
export function unrecognisedAcross(
  characters: Array<Record<string, unknown>>,
  index: TraitIndex,
): Array<{ name: string; kind: string; uses: number }> {
  const seen = new Map<string, { name: string; kind: string; uses: number }>();
  for (const character of characters) {
    for (const audited of auditTraits(character, index).unrecognised) {
      const key = `${audited.kind}:${audited.entry.name.toLowerCase()}`;
      const existing = seen.get(key);
      if (existing) existing.uses += 1;
      else seen.set(key, { name: audited.entry.name, kind: audited.kind, uses: 1 });
    }
  }
  return [...seen.values()].sort((a, b) => b.uses - a.uses || a.name.localeCompare(b.name));
}
