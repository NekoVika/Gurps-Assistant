import ReactMarkdown from "react-markdown";
import type { StateJSON } from "../lib/types";

type Props = {
  data: StateJSON;
};

export function StatePassport({ data }: Props) {
  return (
    <div className="character-passport" style={{ width: "100%", display: "flex", flexDirection: "column", gap: "24px" }}>
      
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px", background: "rgba(11, 20, 37, 0.4)", padding: "20px", borderRadius: "12px", border: "1px solid rgba(149, 181, 255, 0.1)" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span className="eyebrow" style={{ color: "#f0d588", marginBottom: "6px" }}>Current Date</span>
            <span style={{ fontSize: "1.1rem", fontWeight: 500, color: "#f0d588" }}>{data.currentDate || "Unknown"}</span>
          </div>
          
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span className="eyebrow" style={{ color: "#9fbeff", marginBottom: "6px" }}>Current Location</span>
            <span style={{ fontSize: "1.1rem", fontWeight: 500 }}>{data.currentLocation || "Unknown"}</span>
          </div>
        </div>

        {data.inventory && data.inventory.length > 0 && (
          <section>
            <span className="eyebrow" style={{ color: "#9fbeff", display: "block", marginBottom: "12px" }}>Shared Inventory</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {data.inventory.map((item, idx) => (
                <span key={idx} className="tag-pill" style={{ background: "rgba(149, 181, 255, 0.15)", border: "1px solid rgba(149, 181, 255, 0.3)", color: "#c6d9ff" }}>
                  {item}
                </span>
              ))}
            </div>
          </section>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {data.activeQuests && data.activeQuests.length > 0 && (
          <section style={{ padding: "24px", borderLeft: "4px solid rgba(240, 213, 136, 0.6)", background: "rgba(240, 213, 136, 0.04)", borderRadius: "0 12px 12px 0" }}>
            <span className="eyebrow" style={{ fontSize: "1.1rem", marginBottom: "16px", display: "inline-block", color: "#f0d588" }}>
              Active Quests & Objectives
            </span>
            <div className="markdown-content">
              <ul style={{ paddingLeft: "20px", fontSize: "1.05rem" }}>
                {data.activeQuests.map((quest, idx) => (
                  <li key={idx} style={{ marginBottom: "12px" }}><ReactMarkdown>{quest}</ReactMarkdown></li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {data.recentEvents && data.recentEvents.length > 0 && (
          <section style={{ padding: "24px", borderLeft: "4px solid rgba(149, 181, 255, 0.6)", background: "rgba(149, 181, 255, 0.04)", borderRadius: "0 12px 12px 0" }}>
            <span className="eyebrow" style={{ fontSize: "1.1rem", marginBottom: "16px", display: "inline-block", color: "#9fbeff" }}>
              Recent Events & Summaries
            </span>
            <div className="markdown-content">
              <ul style={{ paddingLeft: "20px", fontSize: "1.05rem" }}>
                {data.recentEvents.map((evt, idx) => (
                  <li key={idx} style={{ marginBottom: "12px" }}><ReactMarkdown>{evt}</ReactMarkdown></li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {data.reputation && (
          <section style={{ padding: "24px", border: "1px solid rgba(149, 181, 255, 0.3)", background: "rgba(11, 20, 37, 0.6)", borderRadius: "12px" }}>
            <span className="eyebrow" style={{ fontSize: "1.1rem", marginBottom: "16px", display: "inline-block", color: "#9fbeff" }}>
              Reputation & Standing
            </span>
            <div className="markdown-content" style={{ fontSize: "1.05rem" }}>
              <ReactMarkdown>{data.reputation}</ReactMarkdown>
            </div>
          </section>
        )}

        {data.notes && (
          <section style={{ padding: "24px", borderLeft: "4px solid rgba(255, 149, 149, 0.6)", background: "rgba(255, 149, 149, 0.04)", borderRadius: "0 12px 12px 0" }}>
            <span className="eyebrow" style={{ fontSize: "1.1rem", marginBottom: "16px", display: "inline-block", color: "#ff9595" }}>
              GM Notes
            </span>
            <div className="markdown-content" style={{ fontSize: "1.05rem" }}>
              <ReactMarkdown>{data.notes}</ReactMarkdown>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
