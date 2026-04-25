import { useEffect, useState } from "react";
import { getActivityEvents, type ActivityEventSchema } from "../lib/api";

export function ActivityPanel() {
  const [events, setEvents] = useState<ActivityEventSchema[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const data = await getActivityEvents();
        if (active) {
          // Sort descending (newest first)
          const sorted = data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          setEvents(sorted);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  const getEventBadge = (type: string) => {
    switch (type) {
      case "FILE_EDIT":
        return <span style={{ padding: "4px 8px", background: "rgba(46, 160, 67, 0.15)", border: "1px solid rgba(46, 160, 67, 0.4)", borderRadius: "4px", color: "#3fb950", fontSize: "0.75rem", fontWeight: "bold" }}>FILE EDIT</span>;
      case "RULES_QUERY":
        return <span style={{ padding: "4px 8px", background: "rgba(163, 113, 247, 0.15)", border: "1px solid rgba(163, 113, 247, 0.4)", borderRadius: "4px", color: "#d2a8ff", fontSize: "0.75rem", fontWeight: "bold" }}>RULES QUERY</span>;
      case "CHAT":
        return <span style={{ padding: "4px 8px", background: "rgba(89, 137, 219, 0.15)", border: "1px solid rgba(89, 137, 219, 0.4)", borderRadius: "4px", color: "#9fbeff", fontSize: "0.75rem", fontWeight: "bold" }}>CHAT SESSION</span>;
      default:
        return <span style={{ padding: "4px 8px", background: "rgba(255, 255, 255, 0.1)", border: "1px solid rgba(255, 255, 255, 0.2)", borderRadius: "4px", color: "#ccc", fontSize: "0.75rem", fontWeight: "bold" }}>{type}</span>;
    }
  };

  return (
    <div className="workspace-centered" style={{ maxWidth: "100%" }}>
      <main className="panel main-panel" style={{ margin: "0 auto", width: "100%", maxWidth: "1200px" }}>
        <div className="panel-header" style={{ marginBottom: "24px" }}>
          <p className="eyebrow">Audit Trail</p>
          <h2>Activity Log</h2>
          <p className="lede" style={{ marginTop: "8px" }}>Review the timeline of AI actions, file modifications, and database queries.</p>
        </div>

        {loading ? (
          <div className="status-copy" style={{ textAlign: "center", padding: "40px 0" }}>Loading activity history...</div>
        ) : error ? (
          <div className="error-copy" style={{ whiteSpace: "pre-wrap", padding: "16px", background: "rgba(255, 60, 60, 0.1)", border: "1px solid rgba(255, 60, 60, 0.4)", borderRadius: "8px" }}>
            {error}
          </div>
        ) : events.length === 0 ? (
          <div className="status-copy" style={{ textAlign: "center", padding: "40px 0", opacity: 0.5 }}>
            No activity recorded yet for this campaign.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {events.map((ev) => (
              <div key={ev.id} style={{ display: "flex", flexDirection: "column", gap: "8px", background: "rgba(16, 28, 49, 0.4)", border: "1px solid rgba(149, 181, 255, 0.1)", borderRadius: "12px", padding: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    {getEventBadge(ev.event_type)}
                    <span style={{ fontWeight: 600, color: "#e6edf3", fontSize: "1.05rem" }}>{ev.description}</span>
                  </div>
                  <span style={{ fontSize: "0.85rem", color: "#8fb0db" }}>{new Date(ev.timestamp).toLocaleString()}</span>
                </div>
                
                {Object.keys(ev.metadata).length > 0 && (
                  <div style={{ marginTop: "8px", padding: "12px", background: "rgba(0,0,0,0.3)", borderRadius: "8px", border: "1px solid rgba(0,0,0,0.5)" }}>
                    <ul style={{ margin: 0, paddingLeft: "16px", color: "#bbcbdf", fontSize: "0.9rem", fontFamily: "monospace" }}>
                      {Object.entries(ev.metadata).map(([k, v]) => (
                        <li key={k}>
                          <span style={{ color: "#9fbeff" }}>{k}:</span> {typeof v === "object" ? JSON.stringify(v) : String(v)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
