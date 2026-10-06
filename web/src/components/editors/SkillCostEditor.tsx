import { useEffect, useMemo, useRef, useState } from "react";
import { catalogueNames } from "../../lib/traitResolver";
import { DIFFICULTY_NAMES } from "../../lib/gurpsRules";
import {
  BASES, DIFFICULTIES, blankSkill, bookSkill, priceSkill, readSkill, relativeLabel,
  skillScores, wasSkillPriced, writeSkill, type SkillRow,
} from "../../lib/skillRow";
import { useCampaignStore } from "../../stores/useCampaignStore";
import { MentionTextarea } from "./MentionTextarea";

/**
 * Skills, priced from the level the GM types — the trait editor's rules,
 * applied to the one section that still took a typed figure.
 *
 * The GM types the final level, the number on the sheet. The book says what
 * the skill is based on and how hard it is; the character's own attributes
 * say what that level costs. A figure that is the book's follows the level as
 * it changes; a figure the GM typed is kept, and the book's is shown beside
 * it with a button. A skill the book does not list is the GM's own: they pick
 * its attribute and difficulty, and the same table prices it.
 *
 * When an attribute changes in the same edit, the skills based on it are not
 * moved — the GM is asked. In GURPS raising DX raises every DX skill for the
 * same points (B170), but rewriting a dozen lines because one box changed is
 * the editor deciding for the GM.
 */

type Props = {
  title: string;
  items: string[];
  onChange: (items: string[]) => void;
  /** The sheet's attribute lines, as they are in this edit. */
  attributes: string[];
};

export function SkillCostEditor({ title, items = [], onChange, attributes }: Props) {
  const traitIndex = useCampaignStore(s => s.traitIndex);
  const names = useMemo(() => catalogueNames(traitIndex, "skill"), [traitIndex]);
  const scores = useMemo(() => skillScores(attributes), [attributes]);

  // The scores the skills were last levelled against. Starts as the sheet
  // was opened; moves when the GM answers the offer below.
  const [baseline, setBaseline] = useState<Record<string, number>>(() => skillScores(attributes));

  // Held rather than re-read each render, so a space survives being typed;
  // replaced whenever the list changes from outside. See TraitCostEditor.
  const [rows, setRows] = useState<SkillRow[]>(() => items.map(readSkill));
  const written = useRef<string[] | null>(null);
  useEffect(() => {
    const ours = written.current;
    if (ours && ours.length === items.length && ours.every((line, i) => line === items[i])) return;
    setRows(items.map(readSkill));
    written.current = null;
  }, [items]);

  const write = (next: SkillRow[]) => {
    setRows(next);
    const stored = next.map(r => writeSkill(r, bookSkill(r, traitIndex)));
    written.current = stored;
    onChange(stored);
  };

  const priceOf = (row: SkillRow) => priceSkill(row, scores, bookSkill(row, traitIndex));

  /** Change one field. Points follow the level while they are the book's. */
  const update = (index: number, field: keyof SkillRow, value: string) => {
    const before = rows[index];
    const after: SkillRow = { ...before, [field]: value, raw: undefined };
    if (field !== "points" && field !== "notes") {
      const was = priceOf(before);
      const wasBook = wasSkillPriced(was) && was.points !== null && String(was.points) === before.points.trim();
      if (before.points.trim() === "" || wasBook) {
        const now = priceOf(after);
        after.points = wasSkillPriced(now) && now.points !== null ? String(now.points) : "";
      }
    }
    const next = [...rows];
    next[index] = after;
    write(next);
  };

  const add = () => write([...rows, blankSkill()]);
  const remove = (index: number) => write(rows.filter((_, i) => i !== index));
  const move = (index: number, by: -1 | 1) => {
    if (index + by < 0 || index + by >= rows.length) return;
    const next = [...rows];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    write(next);
  };

  // --- an attribute moved under these skills --------------------------------
  const baseOf = (row: SkillRow) => row.attr || bookSkill(row, traitIndex)?.attr || "";
  const shifted = BASES
    .filter(a => baseline[a] !== undefined && scores[a] !== undefined && baseline[a] !== scores[a])
    .map(a => ({
      attr: a, from: baseline[a], to: scores[a], by: scores[a] - baseline[a],
      rows: rows.map((r, i) => ({ r, i })).filter(({ r }) => r.level.trim() !== "" && baseOf(r) === a),
    }))
    .filter(s => s.rows.length > 0);

  const relevel = (attr: string, by: number, which: number[]) => {
    const next = rows.map((r, i) => which.includes(i)
      ? { ...r, level: String(Number(r.level) + by), raw: undefined } : r);
    write(next);
    setBaseline(b => ({ ...b, [attr]: scores[attr] }));
  };
  const keep = (attr: string) => setBaseline(b => ({ ...b, [attr]: scores[attr] }));

  return (
    <div className="editor-array-container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="editor-label" style={{ color: "#a8c7fa" }}>{title}</span>
        <button type="button" className="editor-add-btn" onClick={add}>+ Add Skill</button>
      </div>

      <datalist id="catalogue-skill">
        {names.map(name => <option key={name} value={name} />)}
      </datalist>

      {shifted.map(s => {
        const sample = s.rows.slice(0, 3).map(({ r }) =>
          `${r.name.replace(/\/TL$/i, "")}${r.specialty ? ` (${r.specialty})` : ""} ${r.level} → ${Number(r.level) + s.by}`);
        return (
          <div key={s.attr} role="status" style={{ border: "1px solid rgba(227, 169, 82, 0.5)", background: "rgba(227, 169, 82, 0.08)", borderRadius: 6, padding: "8px 10px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: "0.8rem" }}>
            <span style={{ flex: 1, minWidth: 200 }}>
              <b>{s.attr} changed {s.from} → {s.to}.</b>{" "}
              {s.rows.length} skill{s.rows.length === 1 ? "" : "s"} based on {s.attr} would {s.by > 0 ? "rise" : "fall"} by {Math.abs(s.by)} for the same points
              {": "}{sample.join(", ")}{s.rows.length > 3 ? "…" : ""}
            </span>
            <button type="button" className="editor-action-btn" style={{ fontSize: "0.75rem", padding: "2px 10px" }}
              onClick={() => relevel(s.attr, s.by, s.rows.map(({ i }) => i))}>
              {s.by > 0 ? "Raise" : "Lower"} their levels
            </button>
            <button type="button" className="editor-action-btn" style={{ fontSize: "0.75rem", padding: "2px 10px" }}
              onClick={() => keep(s.attr)}>Not now</button>
          </div>
        );
      })}

      {rows.map((row, index) => {
        const mover = (
          <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingTop: 4 }}>
            <button type="button" aria-label="Move up" onClick={() => move(index, -1)}
              style={{ background: "none", border: "none", color: "white", padding: "0 4px", opacity: index === 0 ? 0.2 : 0.7, cursor: index === 0 ? "default" : "pointer" }}>▲</button>
            <button type="button" aria-label="Move down" onClick={() => move(index, 1)}
              style={{ background: "none", border: "none", color: "white", padding: "0 4px", opacity: index === rows.length - 1 ? 0.2 : 0.7, cursor: index === rows.length - 1 ? "default" : "pointer" }}>▼</button>
          </div>
        );
        if (row.unreadable) {
          // Shown as written, with the reason. Editing the text re-reads it,
          // so a line the GM corrects becomes an ordinary row.
          return (
            <div key={index} className="editor-array-item" style={{ display: "flex", alignItems: "flex-start", padding: 8, gap: 8 }}>
              {mover}
              <div style={{ flex: 1, minWidth: 0 }}>
                <input className="editor-input" style={{ width: "100%", fontFamily: "monospace" }} aria-label="Skill line as written"
                  value={row.raw ?? ""} onChange={e => { const next = [...rows]; next[index] = readSkill(e.target.value); write(next); }} />
                <div style={{ fontSize: "0.72rem", color: "#e3a952", marginTop: 4 }}>
                  not read as a skill ({row.unreadable}): expected Name (Attribute/Difficulty)-Level [Points]
                </div>
              </div>
              <button type="button" onClick={() => remove(index)} className="editor-action-btn danger" aria-label="Remove skill">✕</button>
            </div>
          );
        }
        const book = bookSkill(row, traitIndex);
        const price = priceOf(row);
        const computed = wasSkillPriced(price) ? price.points : null;
        const stated = row.points.trim() === "" ? null : Number(row.points);
        const disagrees = computed !== null && stated !== null && computed !== stated;
        const named = Boolean(row.name.trim());
        const own = named && !book;
        const takesTl = /\/TL$/i.test(row.name.trim()) || Boolean(book && /\/TL$/i.test(book.name)) || row.tl !== "";
        const attrShown = row.attr || book?.attr || "";

        return (
          <div key={index} className="editor-array-item" style={{ display: "flex", alignItems: "flex-start", padding: 8, gap: 8 }}>
            {mover}

            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input className="editor-input" style={{ flex: 3, minWidth: 140 }} list="catalogue-skill"
                  placeholder="Skill name" aria-label="Skill name" value={row.name}
                  onChange={e => update(index, "name", e.target.value)} />
                <input className="editor-input" style={{ flex: 2, minWidth: 90 }}
                  placeholder="Specialty" aria-label="Specialty" value={row.specialty}
                  onChange={e => update(index, "specialty", e.target.value)} />
                {takesTl && (
                  <input className="editor-input" style={{ width: 56 }} type="number" placeholder="TL"
                    aria-label="Tech level" value={row.tl} onChange={e => update(index, "tl", e.target.value)} />
                )}
                <input className="editor-input" style={{ width: 64, textAlign: "right" }} type="number"
                  placeholder="Level" aria-label="Level" title="The final level, the number you roll against"
                  value={row.level} onChange={e => update(index, "level", e.target.value)} />
                <input className="editor-input" type="number" placeholder="Pts" aria-label="Points"
                  style={{ width: 64, textAlign: "right", color: computed !== null && !disagrees ? "#52d5ae" : undefined }}
                  title={computed !== null && !disagrees ? "Worked out from the book" : "Typed"}
                  value={row.points} onChange={e => update(index, "points", e.target.value)} />
                <button type="button" onClick={() => remove(index)} className="editor-action-btn danger" aria-label="Remove skill">✕</button>
              </div>

              <MentionTextarea
                className="editor-input" placeholder="Notes — press @ to link something"
                value={row.notes}
                rows={Math.min(6, Math.max(1, Math.ceil(row.notes.length / 90)))}
                style={{ resize: "vertical", lineHeight: 1.5, fontFamily: "inherit", width: "100%" }}
                onChange={text => update(index, "notes", text)}
              />

              {named && (
                <div style={{ fontSize: "0.72rem", color: "#9ca3af", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <select className="editor-select" style={{ width: 72, fontSize: "0.72rem", padding: "1px 4px" }}
                    aria-label="Based on" title={book ? `The book bases this on ${book.attr}` : "What your skill is based on"}
                    value={attrShown} onChange={e => update(index, "attr", e.target.value)}>
                    {!attrShown && <option value="">Attr…</option>}
                    {BASES.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                  {own ? (
                    <select className="editor-select" style={{ width: 108, fontSize: "0.72rem", padding: "1px 4px" }}
                      aria-label="Difficulty" value={row.difficulty} onChange={e => update(index, "difficulty", e.target.value)}>
                      {!row.difficulty && <option value="">Difficulty…</option>}
                      {DIFFICULTIES.map(d => <option key={d} value={d}>{DIFFICULTY_NAMES[d]}</option>)}
                    </select>
                  ) : (
                    <span>{DIFFICULTY_NAMES[book!.difficulty] ?? book!.difficulty}{book!.page ? ` (B${book!.page})` : ""}</span>
                  )}

                  {wasSkillPriced(price) && (
                    <span style={{ color: computed !== null && !disagrees ? "#52d5ae" : undefined }}>
                      {relativeLabel(price.attr, price.relative)}
                      {computed === null ? " — below what one point buys" : ` · ${computed} pts`}
                    </span>
                  )}
                  {!wasSkillPriced(price) && <span>{price.problem}</span>}
                  {own && <span>your own skill</span>}

                  {book && row.attr && row.attr !== book.attr && (
                    <>
                      <span style={{ color: "#e3a952" }}>the book bases this on {book.attr}</span>
                      <button type="button" className="editor-action-btn" style={{ fontSize: "0.7rem", padding: "1px 8px" }}
                        onClick={() => update(index, "attr", book.attr)}>Use {book.attr}</button>
                    </>
                  )}
                  {disagrees && (
                    <>
                      <span style={{ color: "#e3a952" }}>the table gives {computed} for this</span>
                      <button type="button" className="editor-action-btn" style={{ fontSize: "0.7rem", padding: "1px 8px" }}
                        onClick={() => update(index, "points", String(computed))}>Use {computed}</button>
                    </>
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
