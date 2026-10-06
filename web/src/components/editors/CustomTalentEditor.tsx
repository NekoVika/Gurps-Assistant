import { useEffect, useState } from "react";
import type { CustomTalentJSON } from "../../lib/types";
import { MAX_TALENT_LEVELS, talentCostPerLevel, talentSkillCount } from "../../lib/talents";

/**
 * The campaign's own Talents (B90, "Custom Talents").
 *
 * A Talent is a name and the skills it covers. The book prices it by how many
 * skills that is -- 6 or fewer 5 points a level, 7 to 12 ten, 13 or more
 * fifteen -- so the cost is shown, never typed. Every skill on the list gets
 * +1 per level on any sheet that has the Talent, and is priced without it
 * (B89). "The GM's word is law" on what is related; the app only counts.
 */

type Props = {
  items: CustomTalentJSON[];
  onChange: (items: CustomTalentJSON[]) => void;
};

const parse = (text: string) => text.split(",").map(s => s.trim()).filter(Boolean);
const sizeName = (perLevel: number) => perLevel === 5 ? "small" : perLevel === 10 ? "medium" : "large";

/**
 * The skill list is typed as text and kept as typed while it is being edited.
 * Writing it back through the parsed list on each keystroke would eat a comma
 * or a space the moment it was typed, as the list editors once ate spaces.
 */
function SkillList({ skills, onChange }: { skills: string[]; onChange: (skills: string[]) => void }) {
  const [text, setText] = useState(skills.join(", "));
  useEffect(() => {
    if (parse(text).join("|") !== skills.join("|")) setText(skills.join(", "));
    // Only an outside change to the list should replace what is typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skills]);
  return (
    <input type="text" className="editor-input" style={{ width: "100%" }} aria-label="Skills it covers"
      placeholder="Skills it covers, separated by commas: Climbing, Jumping, Running"
      value={text}
      onChange={e => { setText(e.target.value); onChange(parse(e.target.value)); }} />
  );
}

export function CustomTalentEditor({ items = [], onChange }: Props) {
  const update = (index: number, patch: Partial<CustomTalentJSON>) =>
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  return (
    <div className="editor-field">
      <label className="editor-label">Campaign Talents</label>
      <p style={{ fontSize: "0.78rem", color: "#9ca3af", margin: "0 0 10px" }}>
        Inborn aptitudes this campaign invented (B90). Name the related skills: each gets +1 per
        level, priced without it, and the Talent's cost follows from how many there are.
      </p>

      {items.length === 0 && (
        <p style={{ fontSize: "0.8rem", color: "#6b7280", margin: "0 0 10px", fontStyle: "italic" }}>
          Nothing declared yet. The book's standard Talents — Mathematical Ability, Business Acumen,
          Smooth Operator and the rest — are already known.
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((item, index) => {
          const perLevel = talentCostPerLevel(item.skills || []);
          const count = talentSkillCount(item.skills || []);
          return (
            <div key={index} style={{ display: "flex", flexDirection: "column", gap: 6, padding: 8, border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input type="text" className="editor-input" style={{ flex: 1, minWidth: 160 }}
                  placeholder="Sports Talent" aria-label="Talent name"
                  value={item.name || ""} onChange={e => update(index, { name: e.target.value })} />
                <span style={{ fontSize: "0.8rem", color: perLevel ? "#52d5ae" : "#9ca3af", whiteSpace: "nowrap" }}
                  title="B90: 6 or fewer skills 5/level, 7 to 12 10/level, 13 or more 15/level">
                  {perLevel
                    ? `${count} skill${count === 1 ? "" : "s"} · ${sizeName(perLevel)} · ${perLevel}/level`
                    : "name its skills to price it"}
                </span>
                <button type="button" className="chip-button" style={{ borderColor: "rgba(255,60,60,0.4)", color: "#ff7b72" }}
                  onClick={() => onChange(items.filter((_, i) => i !== index))} title={`Remove ${item.name || "this Talent"}`}>✕</button>
              </div>
              <SkillList skills={item.skills || []} onChange={skills => update(index, { skills })} />
              <input type="text" className="editor-input" placeholder="Who is impressed by it, for the reaction bonus (optional)"
                aria-label="Notes" value={item.notes || ""} onChange={e => update(index, { notes: e.target.value })} />
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: "0.72rem", color: "#6b7280", margin: "8px 0 0" }}>
        A character may have at most {MAX_TALENT_LEVELS} levels of one Talent (B89).
      </p>
      <button type="button" className="chip-button" style={{ marginTop: 6 }}
        onClick={() => onChange([...items, { name: "", skills: [] }])}>
        + Declare a Talent
      </button>
    </div>
  );
}
