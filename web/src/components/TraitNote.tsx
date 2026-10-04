import { useMemo } from "react";
import { parseNote, pathLabel } from "../lib/noteMarkup";
import { useCampaignStore } from "../stores/useCampaignStore";
import { resolveEntity } from "../lib/entityResolution";
import type { FileTreeNode } from "../lib/api";

/**
 * A trait's note, with its references made to work.
 *
 * The note used to render as the literal characters the GM typed: asterisks
 * around emphasis, and backticked paths that led nowhere. One of Jamie's has
 * led nowhere since the campaign moved from Markdown to JSON — it cites
 * `03_Gift_And_Release.md`, and the file has been `Gift_And_Release.json` for
 * a long time. Nothing said so, because nothing was reading it.
 *
 * A reference that resolves is a link. One that does not is shown as a dead
 * reference rather than quietly rendered as text, since a GM who wrote it down
 * wanted to get back to it.
 *
 * The stored string is untouched, so Edit mode still edits exactly what is on
 * disk — which is also why a broken path can be repaired by typing.
 */

type Props = { note: string; style?: React.CSSProperties };

function flatten(nodes: FileTreeNode[], into: Set<string>): Set<string> {
  for (const node of nodes) {
    if (node.path) into.add(node.path.replace(/\\/g, "/").replace(/\/+$/, ""));
    const children = (node as { children?: FileTreeNode[] }).children;
    if (children?.length) flatten(children, into);
  }
  return into;
}

export function TraitNote({ note, style }: Props) {
  const fileTree = useCampaignStore(s => s.fileTree);
  const setSelectedPath = useCampaignStore(s => s.setSelectedPath);
  const registry = useCampaignStore(s => s.entityRegistry);

  const known = useMemo(() => flatten(fileTree || [], new Set<string>()), [fileTree]);
  const pieces = useMemo(() => parseNote(note), [note]);

  /**
   * What the tree calls this path, if it calls it anything.
   *
   * A citation written before the migration points at a `.md` file that is now
   * `.json`, and one written by hand may name a directory with or without its
   * trailing slash. Both are the same reference to a GM, so both are tried.
   */
  const resolve = (path: string): string | null => {
    const clean = path.replace(/\\/g, "/").replace(/\/+$/, "");
    if (known.has(clean)) return clean;
    const swapped = clean.replace(/\.md$/i, ".json");
    if (known.has(swapped)) return swapped;
    // An ordering prefix was dropped somewhere between the note and the file.
    const parts = clean.split("/");
    const base = (parts.pop() || "").replace(/\.[^.]+$/, "").replace(/^\d+[_-]/, "");
    const dir = parts.join("/");
    for (const candidate of known) {
      if (!candidate.startsWith(dir + "/")) continue;
      const name = (candidate.split("/").pop() || "").replace(/\.[^.]+$/, "");
      if (name.replace(/^\d+[_-]/, "") === base) return candidate;
    }
    return null;
  };

  if (!note) return null;

  return (
    <span style={style}>
      {pieces.map((piece, index) => {
        if (piece.kind === "emphasis") {
          return <strong key={index} style={{ fontWeight: 600 }}>{piece.text}</strong>;
        }
        if (piece.kind === "text") return <span key={index}>{piece.text}</span>;

        // A reference by name goes through the same resolver the structured
        // fields use, rather than a second one that would drift from it.
        if (piece.kind === "entity") {
          const found = resolveEntity(registry || [], piece.name);
          if (!found) {
            return (
              <span
                key={index}
                title={`No entity in this campaign is called "${piece.name}"`}
                style={{
                  color: "#ffb44d", borderBottom: "1px dashed rgba(255,180,77,0.5)",
                  cursor: "help",
                }}
              >{piece.text}</span>
            );
          }
          return (
            <a
              key={index}
              href="#"
              onClick={event => { event.preventDefault(); setSelectedPath(found.path); }}
              title={found.path}
              style={{ color: "#6da8ff", textDecoration: "none", borderBottom: "1px solid rgba(109,168,255,0.4)" }}
            >{piece.text}</a>
          );
        }

        const target = resolve(piece.path);
        const label = piece.text || pathLabel(piece.path);

        if (!target) {
          return (
            <span
              key={index}
              title={`Nothing in the campaign is at "${piece.path}" any more`}
              style={{
                color: "#ffb44d", borderBottom: "1px dashed rgba(255,180,77,0.5)",
                cursor: "help",
              }}
            >{label}</span>
          );
        }
        return (
          <a
            key={index}
            href="#"
            onClick={event => { event.preventDefault(); setSelectedPath(target); }}
            title={target}
            style={{ color: "#6da8ff", textDecoration: "none", borderBottom: "1px solid rgba(109,168,255,0.4)" }}
          >{label}</a>
        );
      })}
    </span>
  );
}
