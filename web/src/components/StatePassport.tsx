import ReactMarkdown from "react-markdown";
import type { StateJSON } from "../lib/types";

type Props = {
  data: StateJSON;
};

export function StatePassport({ data }: Props) {
  return (
    <div className="character-passport" style={{ padding: "32px", maxWidth: "1100px", margin: "0 auto" }}>
      <header className="passport-header" style={{ marginBottom: "32px" }}>
        <div className="passport-title-area">
          <h1>{data.campaignName || "Campaign State"}</h1>
        </div>
        <div className="passport-meta">
          <div className="meta-badge significance-badge">
            <span className="eyebrow">Current Date</span>
            <span className="value">{data.currentDate || "Unknown"}</span>
          </div>
          <div className="meta-badge" style={{ flexGrow: 1 }}>
            <span className="eyebrow">Current Location</span>
            <span className="value">{data.currentLocation || "Unknown"}</span>
          </div>
        </div>
      </header>

      <div className="passport-grid">
        <aside className="passport-sidebar">
          {data.activeQuests && data.activeQuests.length > 0 && (
            <section className="passport-block">
              <h3 style={{ color: "#f0d588" }}>Active Quests & Objectives</h3>
              <ul style={{ paddingLeft: "20px", marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                {data.activeQuests.map((quest, idx) => (
                  <li key={idx}>
                     <ReactMarkdown>{quest}</ReactMarkdown>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {data.inventory && data.inventory.length > 0 && (
            <section className="passport-block">
              <h3>Shared Inventory</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
                {data.inventory.map((item, idx) => (
                  <span key={idx} className="tag-pill" style={{ background: "rgba(255, 255, 255, 0.05)" }}>
                    {item}
                  </span>
                ))}
              </div>
            </section>
          )}

          {data.reputation && (
            <section className="passport-block">
              <h3>Reputation & Standing</h3>
              <div className="markdown-content">
                <ReactMarkdown>{data.reputation}</ReactMarkdown>
              </div>
            </section>
          )}
        </aside>

        <main className="passport-main">
          {data.recentEvents && data.recentEvents.length > 0 && (
            <section className="tactics-panel" style={{ border: "1px solid rgba(149, 181, 255, 0.2)", background: "rgba(11, 20, 37, 0.5)", marginBottom: "24px" }}>
              <span className="eyebrow" style={{ fontSize: "1.1rem", marginBottom: "16px", display: "inline-block", color: "#9fbeff" }}>
                Recent Events & Summaries
              </span>
              <div className="markdown-content lead-markdown">
                <ul>
                  {data.recentEvents.map((evt, idx) => (
                    <li key={idx} style={{ marginBottom: "12px" }}>
                      <ReactMarkdown>{evt}</ReactMarkdown>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          {data.notes && (
            <section className="mechanics-panel">
              <div className="mechanics-header">
                <h3>GM Notes</h3>
              </div>
              <div className="mechanics-section markdown-content" style={{ padding: "16px" }}>
                <ReactMarkdown>{data.notes}</ReactMarkdown>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
