import { RegistryItem } from "./api";

/**
 * Shared entity-name resolution for campaign links.
 *
 * TS mirror of src/gurpsai/app/services/link_resolver.py — keep the two in
 * sync. Decides whether a referenced name (childLink, relation entry, cast
 * member) maps to an existing campaign file.
 */

/** Values that are never real entity references. */
// Mirrors link_resolver.PLACEHOLDER_VALUES. "???" is the codebase's own unset
// marker (CharacterData.pointTotal defaults to it) and "unknown" means undecided,
// which is a loose end rather than a place. The two lists must not drift.
const PLACEHOLDER_VALUES = new Set(["", "tbd", "tba", "none", "n/a", "?", "???", "unknown"]);

/**
 * Normalize an entity name for matching: case, underscores, extensions,
 * leading ordinal prefixes ("2. Ambush" -> "ambush").
 */
const MARKDOWN_LINK = /^\s*\[([^\]]*)\]\(([^)]*)\)\s*$/;

/**
 * The readable half of a markdown link, or the string unchanged.
 *
 * Mirrors link_resolver.link_text. The MD2JSON migration left references like
 * "[The Shoals](../../01_World_Bible/Locations/The_Shoals.md)" in fields the UI
 * renders as entity links; shown whole they leak a file path at the GM and
 * resolve to nothing. The two implementations must not drift.
 */
export function linkText(name: unknown): string {
  if (typeof name !== "string") return "";
  const text = name.trim();
  const match = MARKDOWN_LINK.exec(text);
  if (!match) return text;
  const label = match[1].trim();
  if (label) return label;
  const target = match[2].split("#")[0].replace(/\/+$/, "");
  if (!target) return text;
  const file = target.split("/").pop() || text;
  return file.replace(/\.[^.]+$/, "");
}

export function normalizeEntityName(name: string | null | undefined): string {
  let text = linkText(name ?? "");
  text = text.replace(/\.(json|md)$/i, "");
  text = text.replace(/_/g, " ");
  text = text.replace(/^\d+[.\s_-]+/, "");
  text = text.replace(/\s+/g, " ");
  return text.trim().toLowerCase();
}

export function isPlaceholderName(name: unknown): boolean {
  if (typeof name !== "string") return true;
  return PLACEHOLDER_VALUES.has(normalizeEntityName(name));
}

/**
 * True when the string plausibly names an entity. Legacy markdown-migrated
 * arrays hold prose like "**Dominant Faction:** None (Natural Predators)." —
 * offering "proposed" badges and stubs for those is pure noise.
 */
export function isReferenceName(name: unknown): boolean {
  if (typeof name !== "string" || isPlaceholderName(name)) return false;
  if (name.includes("**")) return false;
  if (name.trim().length > 100) return false;
  // Mirrors link_resolver.is_reference: migrated prose sits in the same arrays
  // as names ("None currently present."), and entity names do not end in
  // sentence punctuation.
  const t = String(name).trim();
  if (/[.!?]$/.test(t) && !t.endsWith("...")) return false;
  return true;
}

/**
 * Resolve a referenced name against the registry.
 * Match order: exact id/title -> normalized id/title -> unique tail match.
 * A tail match that fits more than one entity is NOT a resolution.
 */
/**
 * Story childLinks often reference the containing directory name
 * ("Chapter 01" -> Chapter_01/Chapter_Overview.json), so files inside an
 * Episode_/Chapter_ directory also answer to that directory's name.
 */
function itemKeys(item: RegistryItem): string[] {
  const keys = [normalizeEntityName(item.id), normalizeEntityName(item.title)];
  const parts = (item.path || "").split("/");
  if (parts.length >= 2) {
    const parentDir = parts[parts.length - 2];
    if (parentDir.startsWith("Episode_") || parentDir.startsWith("Chapter_")) {
      keys.push(normalizeEntityName(parentDir));
    }
  }
  return keys.filter(Boolean);
}

export function resolveEntity(
  registry: RegistryItem[],
  name: unknown
): RegistryItem | null {
  if (typeof name !== "string") return null;
  const raw = name.trim();
  if (isPlaceholderName(raw)) return null;

  for (const item of registry) {
    if (item.id === raw || item.title === raw) return item;
  }

  const norm = normalizeEntityName(raw);
  for (const item of registry) {
    if (itemKeys(item).includes(norm)) {
      return item;
    }
  }

  const tailPaths = new Set<string>();
  let tailItem: RegistryItem | null = null;
  for (const item of registry) {
    if (itemKeys(item).some((k) => k.endsWith(norm))) {
      tailPaths.add(item.path);
      tailItem = item;
    }
  }
  if (tailPaths.size === 1) return tailItem;
  return null;
}

export function entityExists(registry: RegistryItem[], name: unknown): boolean {
  return resolveEntity(registry, name) !== null;
}

/** Names from the list that resolve to no existing entity (placeholders excluded). */
export function findMissingEntities(
  registry: RegistryItem[],
  names: unknown[]
): string[] {
  const missing: string[] = [];
  for (const name of names) {
    if (typeof name !== "string") continue;
    if (!isReferenceName(name)) continue;
    if (!entityExists(registry, name)) missing.push(name);
  }
  return Array.from(new Set(missing));
}
