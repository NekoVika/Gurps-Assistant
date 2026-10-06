import type { CustomTraitJSON } from "../../lib/types";

/**
 * The campaign's own traits.
 *
 * GURPS lets a GM invent traits and says nothing against it, so the catalogue
 * built from books can never be the whole list. Declaring one here means the
 * app stops calling it unrecognised, counts its cost, and never argues about
 * the price — there is nothing to argue with.
 *
 * They live in the campaign's System Rules rather than in the rules database,
 * because the database is rebuilt from PDFs and a rebuild must never be able
 * to delete someone's homebrew.
 */

// No "skill": a skill has no one cost to declare -- its price follows from its
// level, attribute and difficulty -- so skills have their own list, below.
const KINDS = ["advantage", "disadvantage", "perk", "quirk"];

type Props = {
  items: CustomTraitJSON[];
  onChange: (items: CustomTraitJSON[]) => void;
};

export function CustomTraitEditor({ items = [], onChange }: Props) {
  const update = (index: number, field: keyof CustomTraitJSON, value: string) => {
    onChange(items.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  return (
    <div className="editor-field">
      <label className="editor-label">Custom Traits</label>
      <p style={{ fontSize: "0.78rem", color: "#9ca3af", margin: "0 0 10px" }}>
        Traits this campaign invented. The cost you give is the cost the app uses —
        it is your table.
      </p>

      {items.length === 0 && (
        <p style={{ fontSize: "0.8rem", color: "#6b7280", margin: "0 0 10px", fontStyle: "italic" }}>
          Nothing declared yet. Anything on a sheet that no book prices is listed as
          unrecognised until it appears here.
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {items.map((item, index) => (
          <div
            key={index}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0,2fr) minmax(0,1fr) minmax(0,1fr) minmax(0,2fr) auto",
              gap: "8px",
              alignItems: "center",
            }}
          >
            <input
              type="text"
              className="editor-input"
              placeholder="Sharp Teeth"
              value={item.name || ""}
              onChange={e => update(index, "name", e.target.value)}
            />
            <select
              className="editor-select"
              value={item.kind || "advantage"}
              onChange={e => update(index, "kind", e.target.value)}
            >
              {KINDS.map(k => <option key={k} value={k}>{k}</option>)}
              {/* An older declaration keeps its kind rather than being
                  silently changed to the first option on save. */}
              {item.kind && !KINDS.includes(item.kind) && <option value={item.kind}>{item.kind}</option>}
            </select>
            <input
              type="text"
              className="editor-input"
              placeholder="5 or 2/level"
              value={item.cost || ""}
              onChange={e => update(index, "cost", e.target.value)}
            />
            <input
              type="text"
              className="editor-input"
              placeholder="What it does (optional)"
              value={item.notes || ""}
              onChange={e => update(index, "notes", e.target.value)}
            />
            <button
              type="button"
              className="chip-button"
              style={{ borderColor: "rgba(255,60,60,0.4)", color: "#ff7b72" }}
              onClick={() => onChange(items.filter((_, i) => i !== index))}
              title={`Remove ${item.name || "this trait"}`}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="chip-button"
        style={{ marginTop: "10px" }}
        onClick={() => onChange([...items, { name: "", kind: "advantage", cost: "" }])}
      >
        + Declare a trait
      </button>
    </div>
  );
}
