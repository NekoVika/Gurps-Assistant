import { useMemo } from "react";
import type { FileTreeNode } from "../../lib/api";
import { useCampaignStore } from "../../stores/useCampaignStore";

/**
 * Pick a story node from the story, not from the filesystem.
 *
 * The generic picker lists files by folder, and story folders are all called
 * Chapter_00, Chapter_01… with a single Episode_Overview.json inside — so it
 * produced a wall of numbered headings holding one item each, with every
 * encounter in the campaign dumped together and sorted alphabetically.
 *
 * The hierarchy is what the GM actually thinks in: campaign, episode, chapter,
 * scene. This renders that shape directly, indented, in story order.
 */

type Entry = { label: string; depth: number };

const OVERVIEW = /overview/i;

/** The title a folder carries, taken from the overview file inside it.
 *
 * The campaign uses two conventions: Chapter_01/Chapter_Overview.json and
 * Chapter_00/The Interlude.json. Matching only the first made a chapter render
 * as a sibling of its own encounters, so fall back to the lone direct file.
 */
function overviewFile(node: FileTreeNode): FileTreeNode | null {
  const direct = (node.children || []).filter(
    c => c.node_type === "file" && c.name.endsWith(".json")
  );
  return direct.find(c => OVERVIEW.test(c.name)) || (direct.length === 1 ? direct[0] : null);
}

function folderTitle(node: FileTreeNode): string | null {
  const overview = overviewFile(node);
  return overview?.title || null;
}

function collect(
  nodes: FileTreeNode[],
  depth: number,
  out: Entry[],
  overviewFor: FileTreeNode | null = null,
): void {
  // Files first, so a node's own title precedes the things inside it.
  const files = nodes.filter(n => n.node_type === "file" && n.name.endsWith(".json"));
  const dirs = nodes.filter(n => n.node_type === "directory");

  // Whichever file is this folder's overview has already been listed as the
  // folder itself; listing it again would duplicate the node.
  const ownOverview = overviewFor;
  for (const file of files) {
    if (ownOverview && file.path === ownOverview.path) continue;
    const label = file.title || file.name.replace(/\.json$/, "").replace(/_/g, " ");
    out.push({ label, depth });
  }

  for (const dir of dirs) {
    const title = folderTitle(dir);
    if (title) {
      out.push({ label: title, depth });
      collect(dir.children || [], depth + 1, out, overviewFile(dir));
    } else {
      // A grouping folder like Encounters/ — its contents belong to the parent.
      collect(dir.children || [], depth, out, null);
    }
  }
}

export function StoryNodeSelect({
  value,
  onChange,
  placeholder = "— not in the story yet —",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const fileTree = useCampaignStore(s => s.fileTree);

  const entries = useMemo(() => {
    const findStory = (nodes: FileTreeNode[]): FileTreeNode | null => {
      for (const n of nodes) {
        if (n.node_type === "directory" && /03_story/i.test(n.path)) return n;
        if (n.children) {
          const hit = findStory(n.children);
          if (hit) return hit;
        }
      }
      return null;
    };
    const story = findStory(fileTree);
    if (!story) return [];
    const out: Entry[] = [];
    collect(story.children || [], 0, out);
    return out;
  }, [fileTree]);

  // A value written before this picker existed may name something no longer
  // listed; keep it selectable so saving cannot silently drop it.
  const known = entries.some(e => e.label === value);

  return (
    <select className="editor-select" value={value} onChange={e => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {!known && value && <option value={value}>{value}</option>}
      {entries.map((entry, i) => (
        <option key={`${entry.label}-${i}`} value={entry.label}>
          {"  ".repeat(entry.depth) + (entry.depth > 0 ? "└ " : "") + entry.label}
        </option>
      ))}
    </select>
  );
}
