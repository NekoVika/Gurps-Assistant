import { useState } from "react";
import { createBatchStubs, type StubRequest } from "../lib/api";
import { findMissingEntities } from "../lib/entityResolution";
import { useCampaignStore } from "../stores/useCampaignStore";

type Props = {
  data: {
    type?: string;
    childLinks?: unknown;
    characters?: unknown;
    locations?: unknown;
    factions?: unknown;
  };
  documentPath: string;
};

const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/**
 * Banner shown on story passports when the document references entities
 * that have no backing files (typically AI-invented childLinks/cast).
 * One click creates stubs for all of them in their canonical folders.
 */
export function MissingEntitiesBanner({ data, documentPath }: Props) {
  const registry = useCampaignStore(s => s.entityRegistry);
  const refreshCampaignArtifacts = useCampaignStore(s => s.refreshCampaignArtifacts);
  const [busy, setBusy] = useState(false);

  const srcType = (data.type || "").toLowerCase();
  const childType = srcType === "episode" ? "Chapter" : "Encounter";

  const stubs: StubRequest[] = [];
  const seen = new Set<string>();
  const push = (names: string[], type: string, parentPath?: string) => {
    for (const name of names) {
      if (seen.has(name)) continue;
      seen.add(name);
      stubs.push({ name, type, parent_path: parentPath });
    }
  };
  push(findMissingEntities(registry, asArray(data.childLinks)), childType, documentPath);
  push(findMissingEntities(registry, asArray(data.characters)), "Character");
  push(findMissingEntities(registry, asArray(data.locations)), "Location");
  push(findMissingEntities(registry, asArray(data.factions)), "Faction");

  if (stubs.length === 0) return null;

  const handleCreateAll = async () => {
    setBusy(true);
    try {
      await createBatchStubs(stubs);
      await refreshCampaignArtifacts();
    } catch (e) {
      console.error("Failed to create stubs", e);
      alert("Failed to create stubs");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "12px",
      margin: "0 0 16px 0", padding: "10px 14px",
      background: "rgba(255, 180, 77, 0.08)",
      border: "1px dashed rgba(255, 180, 77, 0.45)",
      borderRadius: "8px", color: "#ffb44d", fontSize: "0.85rem"
    }}>
      <span style={{ flex: 1 }}>
        ⚠ {stubs.length} proposed {stubs.length === 1 ? "entity has" : "entities have"} no files yet:{" "}
        <em>{stubs.map(s => s.name).join(", ")}</em>
      </span>
      <button
        type="button"
        onClick={handleCreateAll}
        disabled={busy}
        style={{
          background: "#4a3311", border: "1px solid #c27d0a", color: "#ffb44d",
          borderRadius: "4px", padding: "4px 10px", fontSize: "0.8rem",
          cursor: busy ? "not-allowed" : "pointer", whiteSpace: "nowrap"
        }}
      >
        {busy ? "Creating..." : `Create ${stubs.length} stub${stubs.length === 1 ? "" : "s"}`}
      </button>
    </div>
  );
}
