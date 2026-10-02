import type { CharacterJSON } from "./types";

/**
 * Re-open the creation wizard against a character that already exists.
 *
 * Rick starts as a name and six sessions later he matters enough to flesh out.
 * The wizard is pre-filled from what the entity already says, so the GM is not
 * retyping their own NPC — and generated fields fill blanks only, so this is
 * safe on a character who is already half written.
 *
 * Lives here rather than in the passport because the button belongs on the
 * document toolbar with Edit and Delete, which is a different component.
 */
export function deepenRequestFor(data: CharacterJSON, documentPath: string) {
  return {
    wizardId: "create_npc",
    path: documentPath,
    answers: {
      EntityType: data.kind === "type" ? "Bestiary" : data.kind === "pc" ? "PC" : "NPC",
      Name: data.name || "",
      Concept: data.concept || "",
      Description: data.gmSummary || "",
      Role: data.role || "",
      Significance: data.significance || "",
      // The anchor was typed once, at creation, and every later pass asked for
      // it again with an empty box — so it read as not persisting. It is stored
      // as the appearance, so that is where it comes back from.
      Visuals: data.appearance || "",
    },
  };
}
