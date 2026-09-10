import { useEffect, useState } from "react";
import { getStoryScope, type ScopeMember } from "../lib/api";
import { InternalLink } from "./InternalLink";
import { useCampaignStore } from "../stores/useCampaignStore";

type Props = {
  /** Name of the episode, chapter or encounter being viewed. */
  node: string;
  onNavigate?: (path: string) => void;
};

/**
 * Everything that belongs to one story node.
 *
 * Two ways in, and the distinction is the point: *pinned* entities are placed
 * at this node, while *inherited* ones are fixtures declared further up — the
 * recurring trader who is present through the whole chapter without being
 * pinned to any single scene. An appearance higher up never reaches down here,
 * which is why the episode's whole cast does not flood every encounter.
 */
export function ScopePanel({ node, onNavigate }: Props) {
  const focusNode = useCampaignStore(s => s.focusNode);
  const setFocusNode = useCampaignStore(s => s.setFocusNode);
  const [members, setMembers] = useState<ScopeMember[] | null>(null);
  const [lineage, setLineage] = useState<string[]>([]);

  useEffect(() => {
    let live = true;
    if (!node) return;
    getStoryScope(node)
      .then(res => {
        if (!live) return;
        setMembers(res.members);
        setLineage(res.lineage);
      })
      .catch(() => { if (live) setMembers([]); });
    return () => { live = false; };
  }, [node]);

  if (members === null) {
    return <p className="status-copy" style={{ fontSize: "0.8rem" }}>Working out what's in scope…</p>;
  }

  const pinned = members.filter(m => m.via === "pinned");
  const inherited = members.filter(m => m.via === "inherited");

  const row = (m: ScopeMember) => (
    <li key={`${m.via}-${m.name}`} style={{ marginBottom: "4px", fontSize: "0.85rem" }}>
      <InternalLink target={m.name} onNavigate={onNavigate} />
      {m.via === "inherited" && (
        <span style={{ opacity: 0.6, fontSize: "0.75rem" }}> — throughout {m.placed_at}</span>
      )}
    </li>
  );

  return (
    <div style={{
      border: "1px solid rgba(149, 181, 255, 0.2)", borderRadius: "8px",
      padding: "12px 14px", marginBottom: "20px", background: "rgba(0,0,0,0.15)",
    }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "8px" }}>
        <p className="section-label" style={{ margin: "0 0 2px 0" }}>In scope here</p>
        {/* Narrowing the sidebar to this node -- the GM running one encounter
            does not need every NPC and bestiary entry in the campaign. */}
        <button
          type="button"
          onClick={() => setFocusNode(focusNode === node ? null : node)}
          style={{
            background: "none", border: "none", padding: 0, cursor: "pointer",
            fontSize: "0.72rem", color: focusNode === node ? "#ffb44d" : "#58a6ff",
          }}
        >
          {focusNode === node ? "Stop focusing" : "Focus the sidebar"}
        </button>
      </div>
      {lineage.length > 1 && (
        <p style={{ color: "#8b949e", fontSize: "0.72rem", margin: "0 0 10px 0" }}>
          {lineage.slice(1).reverse().join(" › ")} › <strong style={{ color: "#c9dfff" }}>{node}</strong>
        </p>
      )}

      {members.length === 0 ? (
        <p style={{ color: "#8b949e", fontSize: "0.8rem", margin: 0 }}>
          Nothing is placed here yet.
        </p>
      ) : (
        <>
          {pinned.length > 0 && (
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 8px 0" }}>{pinned.map(row)}</ul>
          )}
          {inherited.length > 0 && (
            <>
              <p style={{ color: "#8b949e", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 4px 0" }}>
                Also present
              </p>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>{inherited.map(row)}</ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
