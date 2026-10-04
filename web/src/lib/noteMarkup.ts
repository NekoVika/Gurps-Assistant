/**
 * The small amount of markup a trait's note actually carries.
 *
 * A note is prose the GM wrote, and it has always held two things the sheet
 * rendered as literal characters: emphasis in asterisks, and references to
 * other campaign files. Folding a trait's description onto its own line made
 * that visible rather than causing it — Jamie's Bernkastel Blessing now reads
 * as one paragraph with two paths sitting in it, and neither goes anywhere.
 *
 * This splits a note into the pieces a renderer can show properly. It reads
 * markup and nothing else: whether a path leads anywhere is the caller's
 * question, since only the caller knows what the campaign contains.
 */

export type NotePiece =
  | { kind: "text"; text: string }
  | { kind: "emphasis"; text: string }
  /** A reference to another campaign file, with the path as written. */
  | { kind: "link"; text: string; path: string };

/** `[Chapter 08](Campaign/03_Story/.../Chapter_08)` — the migrated form. */
const MARKDOWN_LINK = /\[([^\]]*)\]\(([^)]+)\)/;
/** A path in backticks, which is how the campaign's prose cites a file. */
const BACKTICK_PATH = /`([^`]+)`/;
/** `**like this**`, which the campaign uses for emphasis inside a note. */
const EMPHASIS = /\*\*([^*]+)\*\*/;

/**
 * A readable name for a campaign path.
 *
 * `Campaign/03_Story/Episode_03.../Chapter_08/Encounters/03_Gift_And_Release.md`
 * is not something to show a GM mid-sentence. The last meaningful segment is,
 * once the extension, the ordering prefix and the underscores are gone.
 */
export function pathLabel(path: string): string {
  const clean = (path || "").trim().replace(/[\\/]+$/, "");
  if (!clean) return "";
  const last = clean.split(/[\\/]/).pop() || clean;
  return last
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/^\d+[_-]/, "")
    .replace(/_/g, " ")
    .trim();
}

/** Whether a string looks like a reference to a file rather than code. */
export function looksLikePath(text: string): boolean {
  const t = (text || "").trim();
  if (!t || /\s/.test(t)) return false;
  return t.includes("/") || /\.(json|md)$/i.test(t);
}

/**
 * Break a note into text, emphasis and references, in the order written.
 *
 * Backticks that do not hold a path are left as text, because a GM writing
 * `3d-2` in a note means the dice and not a file.
 */
export function parseNote(note: string): NotePiece[] {
  const pieces: NotePiece[] = [];
  let rest = note || "";

  const push = (piece: NotePiece) => {
    if (piece.kind === "text" && !piece.text) return;
    pieces.push(piece);
  };

  while (rest) {
    const candidates = [
      { re: MARKDOWN_LINK, kind: "link" as const },
      { re: BACKTICK_PATH, kind: "path" as const },
      { re: EMPHASIS, kind: "emphasis" as const },
    ]
      .map(c => ({ ...c, match: c.re.exec(rest) }))
      .filter(c => c.match)
      .sort((a, b) => a.match!.index - b.match!.index);

    if (!candidates.length) {
      push({ kind: "text", text: rest });
      break;
    }

    const next = candidates[0];
    const match = next.match!;
    push({ kind: "text", text: rest.slice(0, match.index) });

    if (next.kind === "link") {
      const label = (match[1] || "").trim();
      const path = (match[2] || "").trim();
      push({ kind: "link", text: label || pathLabel(path), path });
    } else if (next.kind === "path") {
      const inner = match[1];
      if (looksLikePath(inner)) {
        push({ kind: "link", text: pathLabel(inner), path: inner.trim() });
      } else {
        // Backticks around something that is not a file: dice, a stat, a word.
        push({ kind: "text", text: inner });
      }
    } else {
      push({ kind: "emphasis", text: match[1] });
    }

    rest = rest.slice(match.index + match[0].length);
  }

  return pieces;
}

/** The note as a GM would read it aloud, with no markup and no paths. */
export function noteText(note: string): string {
  return parseNote(note)
    .map(p => p.text)
    .join("")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * A trait's name as it should be read, without the markup around it.
 *
 * The campaign writes most trait names in bold -- "**Danger Sense**" -- and
 * the sheet rendered the asterisks. They are emphasis in a context that is
 * already a list of names, so they say nothing and are dropped on sight.
 * Only for display: what is stored stays as the GM wrote it.
 */
export function plainName(name: string): string {
  return (name || "").replace(/\*\*/g, "").replace(/__/g, "").trim();
}
