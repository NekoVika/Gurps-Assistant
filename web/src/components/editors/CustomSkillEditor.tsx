import type { CustomSkillJSON } from "../../lib/types";
import { DIFFICULTY_NAMES } from "../../lib/gurpsRules";
import { BASES, DIFFICULTIES, ruleDefault } from "../../lib/skillRow";

/**
 * The campaign's own skills.
 *
 * A skill's price is not a figure the GM sets: it follows from the level a
 * character buys, the attribute the skill rests on and how hard it is to
 * learn (Skill Cost Table, B170). So a campaign skill is declared with those
 * two, exactly as the book prints its own (B174), and every sheet then prices
 * it like any skill in the book. Its default follows the book's general rule
 * (B173) unless the GM writes another.
 *
 * They live in System Rules beside the custom traits, for the same reason:
 * the rules database is rebuilt from PDFs, and a rebuild must never be able
 * to delete someone's homebrew.
 */

type Props = {
  items: CustomSkillJSON[];
  onChange: (items: CustomSkillJSON[]) => void;
};

/** Paraphrased from the Basic Set's own guidance, B167-168. */
const ATTRIBUTE_HINTS: Record<string, string> = {
  ST: "brawn alone — very rare",
  DX: "coordination and reflexes: athletics, combat, driving and piloting",
  IQ: "knowledge and reasoning: artistic, scientific and social skills, magic",
  HT: "fitness, posture, lung capacity",
  Per: "noticing subtle differences: spotting clues and hidden things",
  Will: "focus: resisting the mind being worked on, altered states",
};
const DIFFICULTY_HINTS: Record<string, string> = {
  E: "anyone picks it up quickly; not much to learn",
  A: "most combat, job, social and survival skills — the usual case",
  H: "needs formal study: academic fields, demanding combat and athletics",
  VH: "huge scope, or alien, counterintuitive or secret",
};

export function CustomSkillEditor({ items = [], onChange }: Props) {
  const update = (index: number, patch: Partial<CustomSkillJSON>) => {
    onChange(items.map((item, i) => {
      if (i !== index) return item;
      const next = { ...item, ...patch };
      // The default follows the rule until the GM writes their own.
      const before = ruleDefault(item.attr, item.difficulty);
      if (("attr" in patch || "difficulty" in patch) && (!item.defaults || item.defaults === before)) {
        next.defaults = ruleDefault(next.attr, next.difficulty);
      }
      return next;
    }));
  };

  return (
    <div className="editor-field">
      <label className="editor-label">Campaign Skills</label>
      <p style={{ fontSize: "0.78rem", color: "#9ca3af", margin: "0 0 10px" }}>
        Skills this campaign invented. Choose what each is based on and how hard it is,
        and every sheet prices it from the Skill Cost Table (B170) like any skill in the book.
      </p>

      {items.length === 0 && (
        <p style={{ fontSize: "0.8rem", color: "#6b7280", margin: "0 0 10px", fontStyle: "italic" }}>
          Nothing declared yet. You can also make one from a character sheet: a skill the
          book does not list offers “Make it a campaign skill”.
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((item, index) => (
          <div key={index} style={{ display: "flex", flexDirection: "column", gap: 6, padding: 8, border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <input type="text" className="editor-input" style={{ flex: 3, minWidth: 160 }}
                placeholder="Rumour-Mongering" aria-label="Skill name"
                value={item.name || ""} onChange={e => update(index, { name: e.target.value })} />
              <select className="editor-select" style={{ width: 84 }} aria-label="Based on"
                title={ATTRIBUTE_HINTS[item.attr] ?? "What it is based on"}
                value={item.attr || ""} onChange={e => update(index, { attr: e.target.value })}>
                {!item.attr && <option value="">Attr…</option>}
                {BASES.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              <select className="editor-select" style={{ width: 116 }} aria-label="Difficulty"
                title={DIFFICULTY_HINTS[item.difficulty] ?? "How hard it is to learn"}
                value={item.difficulty || ""} onChange={e => update(index, { difficulty: e.target.value })}>
                {!item.difficulty && <option value="">Difficulty…</option>}
                {DIFFICULTIES.map(d => <option key={d} value={d}>{DIFFICULTY_NAMES[d]}</option>)}
              </select>
              <input type="text" className="editor-input" style={{ width: 110 }}
                placeholder={ruleDefault(item.attr, item.difficulty) || "Default"} aria-label="Default"
                title="Its default, the level anyone has untrained (B173)"
                value={item.defaults || ""} onChange={e => update(index, { defaults: e.target.value })} />
              <label style={{ fontSize: "0.75rem", color: "#9ca3af", display: "flex", gap: 4, alignItems: "center" }}
                title="Learned at a tech level, written Name/TL8 (B168)">
                <input type="checkbox" checked={Boolean(item.tl)} onChange={e => update(index, { tl: e.target.checked })} /> /TL
              </label>
              <label style={{ fontSize: "0.75rem", color: "#9ca3af", display: "flex", gap: 4, alignItems: "center" }}
                title="Must be learned with a specialty, as Survival (Arctic) (B169)">
                <input type="checkbox" checked={Boolean(item.specialised)} onChange={e => update(index, { specialised: e.target.checked })} /> specialty
              </label>
              <button type="button" className="chip-button" style={{ borderColor: "rgba(255,60,60,0.4)", color: "#ff7b72" }}
                onClick={() => onChange(items.filter((_, i) => i !== index))} title={`Remove ${item.name || "this skill"}`}>✕</button>
            </div>
            <input type="text" className="editor-input" placeholder="What it is for (optional)" aria-label="Notes"
              value={item.notes || ""} onChange={e => update(index, { notes: e.target.value })} />
            {(item.attr || item.difficulty) && (
              <div style={{ fontSize: "0.72rem", color: "#9ca3af" }}>
                {item.attr && <span>{item.attr}: {ATTRIBUTE_HINTS[item.attr]}. </span>}
                {item.difficulty && <span>{DIFFICULTY_NAMES[item.difficulty]}: {DIFFICULTY_HINTS[item.difficulty]}.</span>}
              </div>
            )}
          </div>
        ))}
      </div>

      <button type="button" className="chip-button" style={{ marginTop: 10 }}
        onClick={() => onChange([...items, { name: "", attr: "", difficulty: "" }])}>
        + Declare a skill
      </button>
    </div>
  );
}
