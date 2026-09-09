/**
 * What a new entity should be attached to, read from where the GM is standing.
 *
 * Creating a character while looking at an encounter means the character
 * belongs to that encounter; creating one while looking at a location means
 * they are there. Asking would produce the same answer nine times in ten and
 * junk data the tenth, so the app fills it in and leaves it editable.
 */

export type PlacementContext = {
  location?: string;
  parent_location?: string;
  story_node?: string;
  story_mode?: "appearance" | "fixture";
};

type Doc = Record<string, unknown>;

const STORY_TYPES = new Set(["episode", "chapter", "encounter"]);

function asDoc(content: unknown): Doc | null {
  if (typeof content === "string") {
    try {
      const parsed = JSON.parse(content);
      return parsed && typeof parsed === "object" ? (parsed as Doc) : null;
    } catch {
      return null;
    }
  }
  return content && typeof content === "object" ? (content as Doc) : null;
}

/** "Character", "Location", "Chapter"… → what family the stub belongs to. */
function family(stubType: string): "character" | "location" | "story" | "other" {
  const t = stubType.toLowerCase();
  if (t.includes("char") || t.includes("npc")) return "character";
  if (t.includes("loc")) return "location";
  if (["episode", "chapter", "encounter", "story"].some(k => t.includes(k))) return "story";
  return "other";
}

export function inferPlacement(currentDocument: unknown, stubType: string): PlacementContext {
  const doc = asDoc(currentDocument);
  if (!doc) return {};

  const name = String(doc.name ?? doc.title ?? "").trim();
  if (!name) return {};

  const isStoryNode =
    "childLinks" in doc || STORY_TYPES.has(String(doc.type ?? "").toLowerCase());
  const isLocation = "internalStructure" in doc;
  const kind = family(stubType);

  // Created from inside a story node: that node is where it appears. An
  // appearance, not a fixture -- reaching downward is a deliberate claim the
  // GM should make, not one the app should assume.
  if (isStoryNode && (kind === "character" || kind === "location")) {
    return { story_node: name, story_mode: "appearance" };
  }

  if (isLocation && kind === "character") return { location: name };
  if (isLocation && kind === "location") return { parent_location: name };

  return {};
}

/** One clause for the confirm dialog, or empty when nothing was inferred. */
export function describePlacement(ctx: PlacementContext): string {
  if (ctx.story_node) return `It will appear in “${ctx.story_node}”.`;
  if (ctx.location) return `It will be at “${ctx.location}”.`;
  if (ctx.parent_location) return `It will sit inside “${ctx.parent_location}”.`;
  return "";
}
