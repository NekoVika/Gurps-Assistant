import { useMemo } from "react";
import { parseEntry } from "../../lib/pointBuild";
import { render, wasPriced, type BuildEntry } from "../../lib/characterBuild";
import { catalogueNames, qualifiedName, resolveTrait } from "../../lib/traitResolver";
import { isCustom } from "../../lib/traitAudit";
import { parseModifiers } from "../../lib/modifiers";
import { SELF_CONTROL } from "../../lib/gurpsRules";
import { useCampaignStore } from "../../stores/useCampaignStore";
import { MentionTextarea } from "./MentionTextarea";

/**
 * Advantages, with the cost worked out rather than typed.
 *
 * Everything else in this release checks a sheet after it is written. This is
 * the first editor that stops the error being made: the GM picks a trait and
 * the level or self-control number it is bought at, and the app prices it from
 * the book. The field that used to invite a wrong number is not a field.
 *
 * Two rules keep it honest, and they are the reason this is not simply
 * automatic.
 *
 * A row the GM is adding has no cost to lose, so the computed one is used.
 * A row that is already saved keeps the number on it, and a disagreement is
 * shown with the book's figure and a button -- because silently rewriting a
 * saved sheet is not advice, and advisory was the whole premise.
 *
 * Where the rules decline to price something -- a trait the book charges
 * "Variable", a Patron, anything the campaign has not declared a figure for --
 * the number stays editable and the reason is printed beside it. Refusing to
 * take a cost the app cannot compute would make the editor useless on exactly
 * the traits a GM most needs to record.
 *
 * Stored format is untouched. Rows go in and out as the same strings the
 * campaign already holds, so this drops into CharacterEditor beside the other
 * list editors and nothing on disk changes shape.
 */

type Props = {
  title: string;
  items: string[];
  onChange: (items: string[]) => void;
  kind: "advantage" | "disadvantage";
};

type Row = {
  name: string;
  specialty: string;
  levels: string;
  selfControl: string;
  points: string;
  notes: string;
};

const CONTROL_NUMBERS = Object.keys(SELF_CONTROL).map(Number).sort((a, b) => a - b);

/** The stored string, read into the fields a GM edits. */
function toRow(raw: string, kind: Props["kind"]): Row {
  const entry = parseEntry(raw, kind);
  const control = /\((\d{1,2})\)/.exec(entry.specialty || "");
  const levels = /\s(\d+)\s*$/.exec(entry.name.trim());
  return {
    name: entry.name.trim(),
    specialty: control ? "" : entry.specialty,
    levels: levels ? levels[1] : "",
    selfControl: entry.specialty && /^\d{1,2}$/.test(entry.specialty.trim())
      ? entry.specialty.trim() : "",
    points: entry.points === null ? "" : String(entry.points),
    notes: entry.notes,
  };
}

/** What the row is asking the rules for. */
function toBuildEntry(row: Row, kind: Props["kind"]): BuildEntry {
  return {
    kind,
    name: row.name.replace(/\s+\d+\s*$/, "").trim(),
    levels: row.levels ? Number(row.levels) : undefined,
    specialty: row.specialty || undefined,
    selfControl: row.selfControl ? Number(row.selfControl) : undefined,
    notes: row.notes || undefined,
  };
}

/** The row, written back as the campaign stores it. */
function toStored(row: Row): string {
  const level = row.levels ? ` ${row.levels}` : "";
  const qualifier = row.selfControl
    ? ` (${row.selfControl})`
    : row.specialty ? ` (${row.specialty})` : "";
  const points = row.points === "" ? "0" : row.points;
  const notes = row.notes ? ` - ${row.notes}` : "";
  return `${row.name.replace(/\s+\d+\s*$/, "")}${level}${qualifier} [${points}]${notes}`;
}

export function TraitCostEditor({ title, items = [], onChange, kind }: Props) {
  const traitIndex = useCampaignStore(s => s.traitIndex);
  const names = useMemo(() => catalogueNames(traitIndex, kind), [traitIndex, kind]);
  const listId = `catalogue-${kind}`;

  const rows = items.map(item => toRow(item, kind));

  const write = (next: Row[]) => onChange(next.map(toStored));

  const update = (index: number, field: keyof Row, value: string) => {
    const next = [...rows];
    next[index] = { ...next[index], [field]: value };

    // Choosing a trait, a level or a self-control number is the moment the
    // cost becomes knowable, so it is filled in then -- except that a saved
    // figure is the GM's and is never overwritten without being asked.
    if (field !== "points" && field !== "notes") {
      const priced = render(toBuildEntry(next[index], kind), {}, traitIndex);
      if (wasPriced(priced) && (rows[index].points === "" || rows[index].points === "0")) {
        next[index] = { ...next[index], points: String(priced.points) };
      }
    }
    write(next);
  };

  const add = () => write([...rows,
    { name: "", specialty: "", levels: "", selfControl: "", points: "", notes: "" }]);
  const remove = (index: number) => write(rows.filter((_, i) => i !== index));

  /**
   * Move a line into the trait above it as part of its description.
   *
   * A trait needing more than one line has nowhere to put the rest, so the
   * details become sibling entries priced at zero: Jamie's Bernkastel Blessing
   * is followed by Cooldown, Ability, Tokens and two more, and Povo's dagger by
   * five of its own. Seventeen such lines sit across the campaign.
   *
   * No rule tells those apart from a trait that genuinely costs nothing -- a
   * native language and a native culture are free (B23-24), and Doesn't Breathe
   * (Gills) is a nought-point feature (B51). Markdown bold happens to separate
   * them in both files and still does not generalise, since Chronic Pain is
   * written plain and is real. So nothing is folded automatically. The offer
   * appears wherever the rules could not price a line, and the GM is the one
   * who knows.
   */
  const fold = (index: number) => {
    const target = parentOf(index);
    if (target === null) return;
    const child = rows[index];
    const parent = rows[target];
    const detail = [child.name.trim(), child.notes.trim()].filter(Boolean).join(": ");
    const next = rows.filter((_, i) => i !== index);
    next[target] = {
      ...parent,
      notes: [parent.notes.trim(), detail].filter(Boolean).join(" "),
    };
    write(next);
  };

  /**
   * Whether a row reads as a trait's description rather than a trait.
   *
   * Costing nothing is not enough on its own: a native language and a native
   * culture are free (B23-24) and so is Doesn't Breathe (Gills) (B51). Nor is
   * being unpriceable, which is equally true of homebrew nobody has declared.
   * Together with carrying a description they are a fair guess — Jamie's
   * Cooldown, Ability, Tokens, Current Status and Stage Edit all match, and
   * his Bernkastel Blessing at 20 and Missing Digit at 2 do not.
   *
   * It stays a guess, which is why it only decides where to put an offer.
   */
  const looksLikeDetail = (row: Row): boolean =>
    Number(row.points) === 0 && row.points !== ""
    && Boolean(row.notes.trim())
    && !wasPriced(render(toBuildEntry(row, kind), {}, traitIndex));

  /** The nearest trait above, skipping that trait's other description lines. */
  const parentOf = (index: number): number | null => {
    for (let i = index - 1; i >= 0; i--) {
      if (!looksLikeDetail(rows[i]) && rows[i].name.trim()) return i;
    }
    return null;
  };
  const move = (index: number, by: -1 | 1) => {
    if (index + by < 0 || index + by >= rows.length) return;
    const next = [...rows];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    write(next);
  };

  return (
    <div className="editor-array-container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="editor-label" style={{ color: "#a8c7fa" }}>{title}</span>
        <button type="button" className="editor-add-btn" onClick={add}>+ Add Trait</button>
      </div>

      <datalist id={listId}>
        {names.map(name => <option key={name} value={name} />)}
      </datalist>

      {rows.map((row, index) => {
        const build = toBuildEntry(row, kind);
        const found = traitIndex
          ? resolveTrait(qualifiedName(build.name, row.specialty), traitIndex, kind).entry
          : null;
        const priced = render(build, {}, traitIndex);
        const computed = wasPriced(priced) ? priced.points : null;
        const stated = row.points === "" ? null : Number(row.points);
        const disagrees = computed !== null && stated !== null && computed !== stated;
        const named = Boolean(row.name.trim());

        // Modifiers are read from the note, where the campaign writes them,
        // and only shown -- pricing them is a separate job from this one.
        const modifiers = parseModifiers(`(${row.notes})`);

        return (
          <div key={index} className="editor-array-item"
            style={{ display: "flex", alignItems: "flex-start", padding: 8, gap: 8 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingTop: 4 }}>
              <button type="button" onClick={() => move(index, -1)}
                style={{ background: "none", border: "none", color: "white", padding: "0 4px", opacity: index === 0 ? 0.2 : 0.7, cursor: index === 0 ? "default" : "pointer" }}>▲</button>
              <button type="button" onClick={() => move(index, 1)}
                style={{ background: "none", border: "none", color: "white", padding: "0 4px", opacity: index === rows.length - 1 ? 0.2 : 0.7, cursor: index === rows.length - 1 ? "default" : "pointer" }}>▼</button>
            </div>

            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input
                  className="editor-input" style={{ flex: 3, minWidth: 140 }}
                  list={listId} placeholder="Trait name" value={row.name}
                  onChange={e => update(index, "name", e.target.value)}
                />

                {found?.cost_kind === "per_level" && (
                  <input
                    className="editor-input" style={{ width: 72 }} type="number"
                    placeholder="Levels" title="How many levels"
                    value={row.levels} onChange={e => update(index, "levels", e.target.value)}
                  />
                )}

                {found?.self_control && (
                  <select
                    className="editor-select" style={{ width: 92 }}
                    title="Self-control number (B123)"
                    value={row.selfControl}
                    onChange={e => update(index, "selfControl", e.target.value)}
                  >
                    <option value="">CR …</option>
                    {CONTROL_NUMBERS.map(n => <option key={n} value={n}>CR {n}</option>)}
                  </select>
                )}

                <input
                  className="editor-input"
                  style={{
                    width: 80, textAlign: "right",
                    color: computed !== null && !disagrees ? "#52d5ae" : undefined,
                  }}
                  type="number" placeholder="Pts" value={row.points}
                  title={computed !== null && !disagrees
                    ? "Worked out from the book" : "Typed, because nothing could work it out"}
                  onChange={e => update(index, "points", e.target.value)}
                />

                <button type="button" onClick={() => remove(index)}
                  className="editor-action-btn danger">✕</button>
              </div>

              {/*
                A note is one line until it is not. Folding a trait's own
                description onto its line gave Jamie's Bernkastel Blessing an
                eight-hundred-character note, and a single-line input is no way
                to read or repair one — including the stale path in it, which
                has to be typed to be fixed. It grows to what it holds.
              */}
              <MentionTextarea
                className="editor-input" placeholder="Notes — press @ to link something"
                value={row.notes}
                rows={Math.min(8, Math.max(1, Math.ceil(row.notes.length / 90)))}
                style={{ resize: "vertical", lineHeight: 1.5, fontFamily: "inherit", width: "100%" }}
                onChange={text => update(index, "notes", text)}
              />

              {named && (
                <div style={{ fontSize: "0.72rem", color: "#9ca3af", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  {computed !== null && !disagrees && (
                    <span style={{ color: "#52d5ae" }}>
                      {found?.cost_text ? `the book charges ${found.cost_text}` : "priced"}
                      {found?.page ? ` (B${found.page})` : ""}
                      {isCustom(found) ? " — your campaign's own figure" : ""}
                    </span>
                  )}
                  {disagrees && (
                    <>
                      <span style={{ color: "#e3a952" }}>
                        the rules give {computed} for this
                        {found?.page ? ` (B${found.page})` : ""}
                      </span>
                      <button
                        type="button" className="editor-action-btn"
                        style={{ fontSize: "0.7rem", padding: "1px 8px" }}
                        onClick={() => update(index, "points", String(computed))}
                      >Use {computed}</button>
                    </>
                  )}
                  {computed === null && !wasPriced(priced) && (
                    <span>{priced.problem}</span>
                  )}
                  {looksLikeDetail(row) && parentOf(index) !== null && (
                    <button
                      type="button" className="editor-action-btn"
                      style={{ fontSize: "0.7rem", padding: "1px 8px" }}
                      title="Move this line into that trait as part of its description"
                      onClick={() => fold(index)}
                    >fold into {rows[parentOf(index)!].name.replace(/\s+\d+\s*$/, "").trim()}</button>
                  )}
                  {modifiers.length > 0 && (
                    <span title={modifiers.map(m => `${m.name} ${m.percent >= 0 ? "+" : ""}${m.percent}%`).join("\n")}>
                      {modifiers.length} modifier{modifiers.length === 1 ? "" : "s"} written in the note
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
