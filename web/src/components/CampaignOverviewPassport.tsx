import ReactMarkdown from "react-markdown";
import type { CampaignOverviewJSON } from "../lib/types";

type Props = {
  data: CampaignOverviewJSON;
};

export function CampaignOverviewPassport({ data }: Props) {
  return (
    <div className="character-passport" style={{ padding: "32px", width: "100%", margin: "0 auto" }}>
      <header className="passport-header" style={{ flexDirection: "column", gap: "24px", marginBottom: "32px" }}>
        <div className="passport-title-area" style={{ width: "100%" }}>
          <h1 style={{ fontSize: "2.5rem", margin: 0 }}>{data.title || "Campaign Overview"}</h1>
        </div>
        
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "12px", background: "rgba(11, 20, 37, 0.4)", padding: "16px", borderRadius: "8px", border: "1px solid rgba(149, 181, 255, 0.1)" }}>
          <div style={{ display: "flex", alignItems: "baseline" }}>
            <span className="eyebrow" style={{ color: "#f0d588", width: "140px", flexShrink: 0 }}>Status</span>
            <span style={{ fontSize: "1.1rem", fontWeight: 500, color: "#f0d588" }}>{data.status || "Unknown"}</span>
          </div>
          
          <div style={{ display: "flex", alignItems: "baseline" }}>
            <span className="eyebrow" style={{ color: "#9fbeff", width: "140px", flexShrink: 0 }}>Tone & Genre</span>
            <span style={{ fontSize: "1.1rem", fontWeight: 500 }}>{data.toneAndGenre || "Unknown"}</span>
          </div>

          <div style={{ display: "flex", alignItems: "baseline" }}>
            <span className="eyebrow" style={{ color: "#9fbeff", width: "140px", flexShrink: 0 }}>Tech & Mana</span>
            <span style={{ fontSize: "1.1rem", fontWeight: 500 }}>{data.techAndMana || "Unknown"}</span>
          </div>

          {data.players && data.players.length > 0 && (
            <div style={{ display: "flex", alignItems: "baseline", marginTop: "8px" }}>
              <span className="eyebrow" style={{ color: "#9fbeff", width: "140px", flexShrink: 0 }}>Players</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {data.players.map((player, idx) => (
                  <span key={idx} className="tag-pill" style={{ background: "rgba(149, 181, 255, 0.15)", border: "1px solid rgba(149, 181, 255, 0.3)", color: "#c6d9ff" }}>
                    {player}
                  </span>
                ))}
              </div>
            </div>
          )}

          {data.pcs && data.pcs.length > 0 && (
            <div style={{ display: "flex", alignItems: "baseline", marginTop: "8px" }}>
              <span className="eyebrow" style={{ color: "#9fbeff", width: "140px", flexShrink: 0 }}>PCs</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {data.pcs.map((pc, idx) => (
                  <span key={idx} className="tag-pill" style={{ background: "rgba(149, 181, 255, 0.15)", border: "1px solid rgba(149, 181, 255, 0.3)", color: "#c6d9ff" }}>
                    {pc}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </header>

      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {data.synopsis && (
          <section className="tactics-panel" style={{ border: "1px solid rgba(149, 181, 255, 0.3)", background: "rgba(11, 20, 37, 0.6)" }}>
            <span className="eyebrow" style={{ fontSize: "1.1rem", marginBottom: "16px", display: "inline-block", color: "#9fbeff" }}>
              Synopsis
            </span>
            <div className="markdown-content lead-markdown" style={{ fontSize: "1.15rem", lineHeight: 1.6 }}>
              <ReactMarkdown>{data.synopsis}</ReactMarkdown>
            </div>
          </section>
        )}

        {data.currentArcSummary && (
          <section className="tactics-panel" style={{ borderLeft: "3px solid rgba(255, 200, 149, 0.5)" }}>
            <span className="eyebrow" style={{ fontSize: "1.1rem", marginBottom: "16px", display: "inline-block", color: "#ffc895" }}>
              Current Arc Summary
            </span>
            <div className="markdown-content">
              <ReactMarkdown>{data.currentArcSummary}</ReactMarkdown>
            </div>
          </section>
        )}

        {data.episodeIndex && (
          <section className="tactics-panel" style={{ borderLeft: "3px solid rgba(149, 255, 181, 0.5)" }}>
            <span className="eyebrow" style={{ fontSize: "1.1rem", marginBottom: "16px", display: "inline-block", color: "#95ffb5" }}>
              Episode Index
            </span>
            <div className="markdown-content">
              <ReactMarkdown>{data.episodeIndex}</ReactMarkdown>
            </div>
          </section>
        )}

        {data.timelineBeats && (
          <section className="tactics-panel" style={{ borderLeft: "3px solid rgba(149, 181, 255, 0.5)" }}>
            <span className="eyebrow" style={{ fontSize: "1.1rem", marginBottom: "16px", display: "inline-block", color: "#9fbeff" }}>
              Timeline Beats
            </span>
            <div className="markdown-content">
              <ReactMarkdown>{data.timelineBeats}</ReactMarkdown>
            </div>
          </section>
        )}

        {data.openThreads && (
          <section className="tactics-panel" style={{ borderLeft: "3px solid rgba(255, 100, 100, 0.5)" }}>
            <span className="eyebrow" style={{ fontSize: "1.1rem", marginBottom: "16px", display: "inline-block", color: "#ff6464" }}>
              Open Threads & Hooks
            </span>
            <div className="markdown-content">
              <ReactMarkdown>{data.openThreads}</ReactMarkdown>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
