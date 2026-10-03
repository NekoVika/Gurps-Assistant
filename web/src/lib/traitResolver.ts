/**
 * Match a trait as a sheet writes it against the catalogue as a book prints it.
 *
 * The two never agree on spelling. A book lists `Guns/TL`, `Phobias` and
 * `Acute Hearing`; a sheet writes `Guns/TL8 (Pistol)`, `Phobia (Spiders)` and
 * `**Acute Hearing** [2]`. Matched naively, 47 specialised skills and every
 * plural-headed trait miss, and the checker looks broken on traits a GM uses
 * constantly.
 *
 * This is the only place that rule lives. The same mistake has been made twice
 * in this project with campaign entity names — three private copies of one
 * matching rule, each producing a bug at a seam — so trait matching gets one
 * resolver and every caller goes through it.
 *
 * Nothing here guesses. A name that does not resolve is reported as
 * unrecognised rather than attached to the nearest thing, because an unknown
 * trait may be homebrew, which the GM is entitled to invent.
 */

export type CatalogueEntry = {
  book_id: number;
  kind: string;
  name: string;
  cost_text?: string | null;
  cost_kind?: string | null;
  cost_value?: number | null;
  specialised?: boolean;
  self_control?: boolean;
  page?: number | null;
  [key: string]: unknown;
};

/** Lower case, markdown gone, punctuation and spacing normalised. */
export function normaliseTrait(name: string): string {
  return (name || "")
    .replace(/\*\*/g, "")
    .replace(/__/g, "")
    .toLowerCase()
    .replace(/[’'`]/g, "")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The forms a stored name might take, most specific first.
 *
 * Each step removes one thing a sheet adds and a book does not:
 * a parenthesised specialty, a tech level on a `/TL` skill, and the plural the
 * book uses for headings that cover a family ("Phobias", "Patrons").
 */
export function traitAliases(name: string): string[] {
  const base = normaliseTrait(name);
  if (!base) return [];
  const forms = [base];

  const withoutSpecialty = base.replace(/\s*\([^)]*\)\s*$/, "").trim();
  if (withoutSpecialty && withoutSpecialty !== base) forms.push(withoutSpecialty);

  for (const form of [...forms]) {
    // "guns/tl8" is the book's "guns/tl"; the level belongs to the character.
    const generic = form.replace(/\/tl\s*\d+/g, "/tl");
    if (generic !== form) forms.push(generic);
  }
  for (const form of [...forms]) {
    // A levelled trait is priced per level, so the book lists "Damage
    // Resistance" and the sheet writes "Damage Resistance 2". Only a trailing
    // standalone integer goes: "360 Vision" keeps its number, which is part of
    // the name rather than a level.
    const unlevelled = form.replace(/\s+\d+$/, "");
    if (unlevelled && unlevelled !== form) forms.push(unlevelled);
  }
  for (const form of [...forms]) {
    // A book heading covering a family is plural: Phobias, Patrons, Allies.
    if (!/s$/.test(form)) forms.push(form + "s");
    else forms.push(form.replace(/s$/, ""));
  }
  return [...new Set(forms)].filter(Boolean);
}

export type TraitIndex = {
  byName: Map<string, CatalogueEntry[]>;
  size: number;
};

/** Build the lookup once; a character has dozens of lines and the app many characters. */
export function buildTraitIndex(entries: CatalogueEntry[]): TraitIndex {
  const byName = new Map<string, CatalogueEntry[]>();
  for (const entry of entries) {
    const key = normaliseTrait(entry.name);
    if (!key) continue;
    const existing = byName.get(key);
    if (existing) existing.push(entry);
    else byName.set(key, [entry]);
  }
  return { byName, size: entries.length };
}

export type Resolution = {
  entry: CatalogueEntry | null;
  /** Which alias matched, so a surprising match can be explained. */
  matchedAs: string;
  /** Set when several catalogue entries answer to the same name. */
  ambiguous: boolean;
};

const UNRESOLVED: Resolution = { entry: null, matchedAs: "", ambiguous: false };

/**
 * Find the catalogue entry a sheet's trait refers to.
 *
 * `kind` narrows the search when the caller knows it — a sheet's advantages
 * array should not match a skill of the same name. Left out, any kind matches.
 */
export function resolveTrait(
  name: string,
  index: TraitIndex,
  kind?: string,
): Resolution {
  for (const alias of traitAliases(name)) {
    const candidates = (index.byName.get(alias) || [])
      .filter(entry => !kind || entry.kind === kind);
    if (candidates.length === 1) {
      return { entry: candidates[0], matchedAs: alias, ambiguous: false };
    }
    if (candidates.length > 1) {
      // Several books price the same name. The first book wins for now, and
      // the caller is told so it can say which it used.
      return { entry: candidates[0], matchedAs: alias, ambiguous: true };
    }
  }
  return UNRESOLVED;
}
