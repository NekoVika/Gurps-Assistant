import { useMemo, useRef, useState } from "react";
import { useCampaignStore } from "../../stores/useCampaignStore";
import { normalizeEntityName } from "../../lib/entityResolution";
import type { RegistryItem } from "../../lib/api";

/**
 * A note field that can point at the rest of the campaign.
 *
 * Writing a reference by hand meant typing a path, and across this campaign
 * ninety of the ninety-three references written that way are dead — the move
 * from Markdown to JSON rewrote the files and left every citation inside prose
 * pointing at a .md that no longer exists. Making paths easier to type would
 * only have produced more of them.
 *
 * So a reference here is an entity's name, which is what the structured fields
 * have always used and the reason they came through the same migration intact:
 * a name is looked up in the registry, and a file that moves or is renamed is
 * still found. Press @ and pick.
 *
 * The text stays text. What is stored is what you see, so a reference can also
 * be typed, corrected or deleted by hand.
 */

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  style?: React.CSSProperties;
  className?: string;
};

/** How many entities to offer at once. More is a list, not a suggestion. */
const SHOWN = 8;

export function MentionTextarea({
  value, onChange, placeholder, rows, style, className,
}: Props) {
  const registry = useCampaignStore(s => s.entityRegistry);
  const [query, setQuery] = useState<string | null>(null);
  const [highlighted, setHighlighted] = useState(0);
  const box = useRef<HTMLTextAreaElement>(null);

  const matches = useMemo(() => {
    if (query === null) return [] as RegistryItem[];
    const wanted = normalizeEntityName(query);
    // A registry entry whose title is still a file name has nothing to offer a
    // GM reaching for something by name.
    const named = (registry || [])
      .filter(item => (item.title || item.id) && !/\.(json|md)$/i.test(item.title || ""))
      .sort((a, b) => (a.title || a.id).localeCompare(b.title || b.id));
    // On a bare @ the order was whatever the file tree happened to give, which
    // put "dummy" and "state" at the top of the list. Alphabetical at least
    // means the same keystroke always offers the same thing.
    if (!wanted) return named.slice(0, SHOWN);
    // Entities whose name begins with what has been typed come first: typing
    // "gif" is reaching for Gift and Release, not for something that merely
    // contains those letters.
    const starts: RegistryItem[] = [];
    const contains: RegistryItem[] = [];
    for (const item of named) {
      const key = normalizeEntityName(item.title || item.id);
      if (key.startsWith(wanted)) starts.push(item);
      else if (key.includes(wanted)) contains.push(item);
    }
    return [...starts, ...contains].slice(0, SHOWN);
  }, [query, registry]);

  /**
   * The `@word` being typed immediately before the cursor, if there is one.
   *
   * What matters is that the @ is not stuck to the end of a word, which is
   * what an email address looks like. Requiring whitespace in front of it was
   * too strict by far: a note almost always ends in a full stop, so typing @
   * where you would actually type it -- at the end of what you have written --
   * opened nothing at all, and the menu appeared only on an empty note.
   */
  const queryAtCursor = (text: string, cursor: number): string | null => {
    const before = text.slice(0, cursor);
    const match = /(?:^|[^\w@])@([^\s@]*)$/.exec(before);
    return match ? match[1] : null;
  };

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = event.target.value;
    onChange(next);
    const found = queryAtCursor(next, event.target.selectionStart ?? next.length);
    setQuery(found);
    setHighlighted(0);
  };

  const insert = (item: RegistryItem) => {
    const field = box.current;
    const cursor = field?.selectionStart ?? value.length;
    const before = value.slice(0, cursor).replace(/@([^\s@]*)$/, "");
    const after = value.slice(cursor);
    const name = item.title || item.id;
    const next = `${before}[[${name}]]${after}`;
    onChange(next);
    setQuery(null);
    // Put the caret after what was just inserted, so typing carries on.
    const caret = before.length + name.length + 4;
    requestAnimationFrame(() => {
      field?.focus();
      field?.setSelectionRange(caret, caret);
    });
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (query === null || !matches.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlighted(i => Math.min(i + 1, matches.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlighted(i => Math.max(i - 1, 0));
    } else if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      insert(matches[highlighted]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setQuery(null);
    }
  };

  return (
    <div style={{ position: "relative" }}>
      <textarea
        ref={box}
        className={className}
        placeholder={placeholder}
        value={value}
        rows={rows}
        style={style}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => window.setTimeout(() => setQuery(null), 120)}
      />
      {query !== null && matches.length > 0 && (
        <div
          role="listbox"
          aria-label="Campaign entities"
          style={{
            position: "absolute", zIndex: 30, left: 0, right: 0, top: "100%",
            marginTop: 2, maxHeight: 220, overflowY: "auto",
            background: "#101c31", border: "1px solid #22365a", borderRadius: 6,
            boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
          }}
        >
          {matches.map((item, index) => (
            <div
              key={item.path}
              role="option"
              aria-selected={index === highlighted}
              onMouseDown={event => { event.preventDefault(); insert(item); }}
              onMouseEnter={() => setHighlighted(index)}
              style={{
                padding: "5px 10px", cursor: "pointer", fontSize: "0.8rem",
                display: "flex", justifyContent: "space-between", gap: 10,
                background: index === highlighted ? "rgba(109,168,255,0.18)" : "transparent",
              }}
            >
              <span>{item.title || item.id}</span>
              <span style={{ opacity: 0.55, fontSize: "0.72rem" }}>{item.type}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
