/**
 * What kind of thing an entity is, and what it sits inside.
 *
 * The registry reports whatever each file calls itself, which is a mixture:
 * "Encounter" and "Chapter" are kinds, "Megastructure / Ruins" and "Guild" are
 * descriptions of a place in the world, and thirty-two entries say nothing at
 * all. None of that helps a GM picking from a list of names.
 *
 * Where a file lives does say, reliably, because the campaign's shape is the
 * campaign's own convention. It also gives the thing a list of names badly
 * needs: an encounter called "Recall Misfire" means little until you are told
 * which chapter it belongs to.
 */

export type EntityKind =
  | "PC" | "Character" | "Bestiary"
  | "Location" | "Faction" | "Lore"
  | "Episode" | "Chapter" | "Encounter"
  | "Campaign" | "Note";

const SEGMENT: Array<[RegExp, EntityKind]> = [
  [/\/02_Characters\/PCs\//i, "PC"],
  [/\/02_Characters\/Bestiary\//i, "Bestiary"],
  [/\/02_Characters\//i, "Character"],
  [/\/01_World_Bible\/Locations\//i, "Location"],
  [/\/01_World_Bible\/Factions\//i, "Faction"],
  [/\/01_World_Bible\//i, "Lore"],
];

/** The folder a story file sits in, as the campaign names them. */
const EPISODE_DIR = /(^|\/)Episode[^/]*\//i;
const CHAPTER_DIR = /(^|\/)Chapter[^/]*\//i;

export function entityKind(path: string): EntityKind {
  const p = (path || "").replace(/\\/g, "/");
  for (const [pattern, kind] of SEGMENT) {
    if (pattern.test(p)) return kind;
  }
  if (/\/03_Story\//i.test(p)) {
    if (/\/Encounters\//i.test(p)) return "Encounter";
    if (/\/Campaign_Overview\.json$/i.test(p)) return "Campaign";
    // An overview names the folder it sits in; anything else in a chapter
    // folder is a scene of that chapter either way.
    if (CHAPTER_DIR.test(p)) return "Chapter";
    if (EPISODE_DIR.test(p)) return "Episode";
    return "Note";
  }
  return "Note";
}

/**
 * The path of the thing this one belongs to, or "" when it belongs to nothing.
 *
 * An encounter belongs to its chapter, a chapter to its episode. Both are the
 * overview file of the folder above, which the campaign names two ways.
 */
export function parentPath(path: string): string {
  const p = (path || "").replace(/\\/g, "/");
  const kind = entityKind(p);
  const parts = p.split("/");
  if (kind === "Encounter") {
    // .../Chapter_08/Encounters/Gift_And_Release.json -> .../Chapter_08
    const at = parts.findIndex(part => /^Encounters$/i.test(part));
    return at > 0 ? parts.slice(0, at).join("/") : "";
  }
  if (kind === "Chapter") {
    const at = parts.findIndex(part => /^Chapter/i.test(part));
    return at > 0 ? parts.slice(0, at).join("/") : "";
  }
  return "";
}

/**
 * What to show beside a name so two similar ones can be told apart.
 *
 * Looks up the folder's own overview, so an encounter is labelled with its
 * chapter's title rather than "Chapter_08". Where there is no overview to find,
 * the folder's name is better than nothing, tidied of its ordering prefix.
 */
export function entityContext(
  path: string,
  byPath: Map<string, string>,
): string {
  const parent = parentPath(path);
  if (!parent) return "";
  for (const file of ["Chapter_Overview.json", "Episode_Overview.json"]) {
    const title = byPath.get(`${parent}/${file}`);
    if (title) return title;
  }
  // A chapter whose overview is named after itself, which the campaign also does.
  for (const [candidate, title] of byPath) {
    if (candidate.startsWith(`${parent}/`)
      && candidate.slice(parent.length + 1).indexOf("/") === -1
      && entityKind(candidate) === "Chapter") {
      return title;
    }
  }
  return (parent.split("/").pop() || "").replace(/^\d+[_-]/, "").replace(/_/g, " ");
}
