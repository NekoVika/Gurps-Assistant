import { useEffect, useMemo, useState } from "react";
import { WorkspaceSelect } from "./WorkspaceSelect";
import { useCampaignStore } from "../../stores/useCampaignStore";
import type { StoryPlacementJSON } from "../../lib/types";

/**
 * Editors for the two axes an entity is placed on.
 *
 * These fields were previously only writable by migration scripts, which is the
 * wrong way round: anything automation can set, hands must be able to set too.
 */

const EMPTY: StoryPlacementJSON = { node: "", mode: "appearance" };

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="editor-field">
      <label className="editor-label">{label}</label>
      {children}
      {hint && (
        <span style={{ color: "#8b949e", fontSize: "0.7rem", marginTop: "2px", display: "block" }}>
          {hint}
        </span>
      )}
    </div>
  );
}

/**
 * Where a character is. The link may point at a place, or at someone they travel
 * with — a companion resolves through that person, so when the party moves the
 * companion moves with them and this field never needs touching.
 */
export function WhereField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const fileTree = useCampaignStore(s => s.fileTree);

  // Whether the current link names a place or a person decides which picker to
  // show. Guessing from the string alone would flip the control on first render
  // and quietly rewrite an existing "travels with" link.
  const isPerson = useMemo(() => {
    if (!value.trim()) return false;
    const wanted = value.trim().replace(/_/g, " ").toLowerCase();
    let found = false;
    const walk = (nodes: typeof fileTree) => {
      for (const n of nodes) {
        if (n.node_type === "file" && n.name.replace(/\.json$/, "").replace(/_/g, " ").toLowerCase() === wanted) {
          if (n.path.toLowerCase().includes("02_characters")) found = true;
        }
        if (n.children) walk(n.children);
      }
    };
    walk(fileTree);
    return found;
  }, [fileTree, value]);

  const [mode, setMode] = useState<"place" | "person">(isPerson ? "person" : "place");
  useEffect(() => { setMode(isPerson ? "person" : "place"); }, [isPerson]);

  return (
    <Field
      label="Where"
      hint={mode === "person"
        ? "Resolves to wherever they are — nothing to update when the party moves."
        : "The place this character is normally found."}
    >
      <div style={{ display: "flex", gap: "6px", marginBottom: "4px" }}>
        {(["place", "person"] as const).map(option => (
          <button
            key={option}
            type="button"
            onClick={() => { setMode(option); onChange(""); }}
            className={mode === option ? "primary-button" : "ghost-button"}
            style={{ width: "auto", margin: 0, padding: "2px 10px", fontSize: "0.7rem" }}
          >
            {option === "place" ? "A place" : "Travels with"}
          </button>
        ))}
      </div>
      <WorkspaceSelect
        category={mode === "person" ? "Character" : "Location"}
        value={value}
        onChange={onChange}
        placeholder={mode === "person" ? "— no one —" : "— nowhere yet —"}
      />
    </Field>
  );
}

/** Which Location contains this one. Containment rolls upward only. */
export function ParentLocationField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Field label="Inside" hint="The place that contains this one.">
      <WorkspaceSelect
        category="Location"
        value={value}
        onChange={onChange}
        placeholder="— top level —"
      />
    </Field>
  );
}

/**
 * Where an entity belongs in the story, and in what sense.
 *
 * The mode is the load-bearing half: an appearance stays at its node, while a
 * fixture is present throughout everything beneath it.
 */
export function StoryPlacementField({
  value,
  onChange,
}: {
  value?: StoryPlacementJSON;
  onChange: (v: StoryPlacementJSON) => void;
}) {
  const current = value ?? EMPTY;
  return (
    <>
      <Field label="Story placement" hint="Episode, chapter or encounter.">
        <WorkspaceSelect
          category="Story"
          value={current.node}
          onChange={node => onChange({ ...current, node })}
          placeholder="— not in the story yet —"
        />
      </Field>
      <Field
        label="Present how"
        hint={
          current.mode === "fixture"
            ? "Throughout that node, including everything under it."
            : "At that node only — does not carry into its scenes."
        }
      >
        <select
          className="editor-select"
          value={current.mode}
          onChange={e => onChange({ ...current, mode: e.target.value as StoryPlacementJSON["mode"] })}
        >
          <option value="appearance">Appears there</option>
          <option value="fixture">Present throughout</option>
        </select>
      </Field>
    </>
  );
}

/** Individual, reusable template, or player character. */
export function KindField({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  return (
    <Field
      label="Kind"
      hint={value === "type" ? "A template — instances are placed, it is not." : undefined}
    >
      <select className="editor-select" value={value || "individual"} onChange={e => onChange(e.target.value)}>
        <option value="individual">Individual</option>
        <option value="type">Type / bestiary template</option>
        <option value="pc">Player character</option>
      </select>
    </Field>
  );
}
