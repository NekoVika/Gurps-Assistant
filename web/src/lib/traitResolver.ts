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
 *
 * Order is the whole point, because the first alias that matches wins. A
 * parenthetical sometimes names a variety the book prices separately rather
 * than a specialty of one trait: the Basic Set prices Eidetic Memory at 5 and
 * Photographic Memory at 10 (B51), so a sheet writing "Eidetic Memory
 * (Photographic) [10]" means the second and is correctly priced. Stripping
 * the parenthetical first would match the cheaper entry and report a gap that
 * is not there, so the variety is tried before the bare name.
 */
export function traitAliases(name: string): string[] {
  const base = normaliseTrait(name);
  if (!base) return [];
  const forms = [base];

  const qualified = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(base);
  if (qualified) {
    const [, stem, qualifier] = qualified;
    const words = stem.trim().split(/\s+/);
    const last = words[words.length - 1];
    // "eidetic memory (photographic)" -> "photographic memory", and the
    // longer "photographic eidetic memory" in case a book spells it out.
    if (qualifier && last && words.length > 1) forms.push(`${qualifier} ${last}`.trim());
    if (qualifier && stem) forms.push(`${qualifier} ${stem}`.trim());
  }

  const withoutSpecialty = base.replace(/\s*\([^)]*\)\s*$/, "").trim();
  if (withoutSpecialty && withoutSpecialty !== base) forms.push(withoutSpecialty);

  for (const form of [...forms]) {
    // "guns/tl8" is the book's "guns/tl"; the level belongs to the character.
    const generic = form.replace(/\/tl\s*\d+/g, "/tl");
    if (generic !== form) forms.push(generic);
    // And the other way: a sheet writes "Research" where the book, which has
    // to cover every tech level, prints "Research/TL".
    if (!/\/tl/.test(form)) forms.push(`${form}/tl`);
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

/**
 * A stored line's name with its parenthetical put back.
 *
 * `pointBuild` splits `Eidetic Memory (Photographic)` into a name and a
 * specialty, which is right for reading the line but wrong for looking it up:
 * the parenthetical is sometimes the half that identifies which entry the book
 * means. Callers that want the most specific match hand both back.
 */
export function qualifiedName(name: string, specialty?: string | null): string {
  const tail = (specialty || "").trim();
  return tail ? `${(name || "").trim()} (${tail})` : (name || "").trim();
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
