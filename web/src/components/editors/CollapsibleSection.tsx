import { useState } from "react";

/**
 * A section that stays out of the way until it has something to say.
 *
 * An entity with nothing but a name is legitimate — the schema has always
 * allowed it — but the editor rendered every field anyway, so a one-line NPC
 * read as two dozen blanks the GM had failed to fill. That is what makes
 * "I just need a trader named Rick" feel like unfinished homework.
 *
 * Sections holding content are open. Empty ones collapse to a single line
 * offering to add them, and stay open once opened, so nothing is hidden from
 * someone who wants it and nothing is demanded of someone who does not.
 */

/** "", [], null, "???" and whitespace all mean "not filled in". */
export function hasValue(v: unknown): boolean {
  if (v == null) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "string") {
    const t = v.trim();
    return t !== "" && t !== "???" && t !== "?";
  }
  if (typeof v === "object") return Object.keys(v as object).length > 0;
  return true;
}

export function hasAnyValue(...values: unknown[]): boolean {
  return values.some(hasValue);
}

export function CollapsibleSection({
  title,
  hasContent,
  addLabel,
  children,
}: {
  title: string;
  /** Whether any field inside is filled in. Drives the default state only. */
  hasContent: boolean;
  /** Wording for the collapsed row; defaults to "Add <title>". */
  addLabel?: string;
  children: React.ReactNode;
}) {
  const [openedByHand, setOpenedByHand] = useState(false);
  const open = hasContent || openedByHand;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpenedByHand(true)}
        style={{
          display: "flex", alignItems: "center", gap: "8px", width: "100%",
          margin: "20px 0 0 0", padding: "10px 14px", textAlign: "left",
          background: "rgba(255, 255, 255, 0.03)",
          border: "1px dashed rgba(149, 181, 255, 0.25)",
          borderRadius: "8px", color: "#8b949e", cursor: "pointer",
          fontSize: "0.85rem", fontFamily: "inherit",
        }}
      >
        <span style={{ color: "#58a6ff", fontSize: "1rem", lineHeight: 1 }}>+</span>
        {addLabel || `Add ${title}`}
      </button>
    );
  }

  return (
    <>
      <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
        <h2 className="editor-section-title" style={{ marginBottom: 0 }}>{title}</h2>
        {/* Only offered for sections opened by hand — collapsing a section that
            holds content would hide the GM's own work behind a chevron. */}
        {!hasContent && openedByHand && (
          <button
            type="button"
            onClick={() => setOpenedByHand(false)}
            style={{
              background: "none", border: "none", color: "#8b949e",
              cursor: "pointer", fontSize: "0.72rem", padding: 0,
            }}
          >
            hide
          </button>
        )}
      </div>
      {children}
    </>
  );
}
