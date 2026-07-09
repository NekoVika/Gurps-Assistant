import { useState } from "react";
import ReactMarkdown from "react-markdown";
import type { CampaignOverviewJSON } from "../lib/types";
import { getMediaUrl } from "../lib/api";

type Props = {
  data: CampaignOverviewJSON;
  documentPath?: string;
};

export function CampaignOverviewPassport({ data, documentPath = "" }: Props) {
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const images = data.images || [];
  const safeImageIdx = images.length > 0 && activeImageIdx < images.length ? activeImageIdx : 0;

  return (
    <div className="character-passport" style={{ width: "100%", display: "flex", flexDirection: "column", gap: "24px" }}>
      
      <div style={{ display: "flex", gap: "32px", flexWrap: "wrap", alignItems: "flex-start" }}>
        {images.length > 0 && (
          <div className="passport-gallery" style={{ width: "280px", flexShrink: 0 }}>
            <div className="gallery-main-image">
               <img src={getMediaUrl(images[safeImageIdx], documentPath)} alt="Campaign Cover" />
            </div>
            {images.length > 1 && (
               <div className="gallery-thumbnails">
                  {images.map((img: string, idx: number) => (
                     <button 
                       key={idx} 
                       className={`thumb-button ${idx === safeImageIdx ? 'active' : ''}`}
                       onClick={() => setActiveImageIdx(idx)}
                     >
                       <img src={getMediaUrl(img, documentPath)} alt={`Thumbnail ${idx+1}`} />
                     </button>
                  ))}
               </div>
            )}
          </div>
        )}

        <div style={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: "20px", minWidth: "300px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px", background: "rgba(11, 20, 37, 0.4)", padding: "20px", borderRadius: "12px", border: "1px solid rgba(149, 181, 255, 0.1)" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span className="eyebrow" style={{ color: "#f0d588", marginBottom: "6px" }}>Status</span>
              <span style={{ fontSize: "1.1rem", fontWeight: 500, color: "#f0d588" }}>{data.status || "Unknown"}</span>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span className="eyebrow" style={{ color: "#9fbeff", marginBottom: "6px" }}>Tone & Genre</span>
              <span style={{ fontSize: "1.1rem", fontWeight: 500 }}>{data.toneAndGenre || "Unknown"}</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column" }}>
              <span className="eyebrow" style={{ color: "#9fbeff", marginBottom: "6px" }}>Tech & Mana</span>
              <span style={{ fontSize: "1.1rem", fontWeight: 500 }}>{data.techAndMana || "Unknown"}</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: "32px", flexWrap: "wrap" }}>
            {data.players && data.players.length > 0 && (
              <section style={{ flexGrow: 1 }}>
                <span className="eyebrow" style={{ color: "#9fbeff", display: "block", marginBottom: "12px" }}>Players</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {data.players.map((player, idx) => (
                    <span key={idx} className="tag-pill" style={{ background: "rgba(149, 181, 255, 0.15)", border: "1px solid rgba(149, 181, 255, 0.3)", color: "#c6d9ff" }}>
                      {player}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {data.pcs && data.pcs.length > 0 && (
              <section style={{ flexGrow: 1 }}>
                <span className="eyebrow" style={{ color: "#9fbeff", display: "block", marginBottom: "12px" }}>PCs</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {data.pcs.map((pc, idx) => (
                    <span key={idx} className="tag-pill" style={{ background: "rgba(149, 181, 255, 0.15)", border: "1px solid rgba(149, 181, 255, 0.3)", color: "#c6d9ff" }}>
                      {pc}
                    </span>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {data.synopsis && (
          <section style={{ padding: "24px", border: "1px solid rgba(149, 181, 255, 0.3)", background: "rgba(11, 20, 37, 0.6)", borderRadius: "12px" }}>
            <span className="eyebrow" style={{ fontSize: "1.1rem", marginBottom: "16px", display: "inline-block", color: "#9fbeff" }}>
              Synopsis
            </span>
            <div className="markdown-content lead-markdown" style={{ fontSize: "1.15rem", lineHeight: 1.6 }}>
              <ReactMarkdown>{data.synopsis}</ReactMarkdown>
            </div>
          </section>
        )}

        {data.currentArcSummary && (
          <section style={{ padding: "24px", borderLeft: "4px solid rgba(255, 200, 149, 0.6)", background: "rgba(255, 200, 149, 0.04)", borderRadius: "0 12px 12px 0" }}>
            <span className="eyebrow" style={{ fontSize: "1.1rem", marginBottom: "16px", display: "inline-block", color: "#ffc895" }}>
              Current Arc Summary
            </span>
            <div className="markdown-content" style={{ fontSize: "1.05rem" }}>
              <ReactMarkdown>{data.currentArcSummary}</ReactMarkdown>
            </div>
          </section>
        )}

        {data.episodeIndex && (
          <section style={{ padding: "24px", borderLeft: "4px solid rgba(149, 255, 181, 0.6)", background: "rgba(149, 255, 181, 0.04)", borderRadius: "0 12px 12px 0" }}>
            <span className="eyebrow" style={{ fontSize: "1.1rem", marginBottom: "16px", display: "inline-block", color: "#95ffb5" }}>
              Episode Index
            </span>
            <div className="markdown-content" style={{ fontSize: "1.05rem" }}>
              <ReactMarkdown>{data.episodeIndex}</ReactMarkdown>
            </div>
          </section>
        )}

        {data.timelineBeats && (
          <section style={{ padding: "24px", borderLeft: "4px solid rgba(149, 181, 255, 0.6)", background: "rgba(149, 181, 255, 0.04)", borderRadius: "0 12px 12px 0" }}>
            <span className="eyebrow" style={{ fontSize: "1.1rem", marginBottom: "16px", display: "inline-block", color: "#9fbeff" }}>
              Timeline Beats
            </span>
            <div className="markdown-content" style={{ fontSize: "1.05rem" }}>
              <ReactMarkdown>{data.timelineBeats}</ReactMarkdown>
            </div>
          </section>
        )}

        {data.openThreads && (
          <section style={{ padding: "24px", borderLeft: "4px solid rgba(255, 100, 100, 0.6)", background: "rgba(255, 100, 100, 0.06)", borderRadius: "0 12px 12px 0" }}>
            <span className="eyebrow" style={{ fontSize: "1.1rem", marginBottom: "16px", display: "inline-block", color: "#ff6464" }}>
              Open Threads & Hooks
            </span>
            <div className="markdown-content" style={{ fontSize: "1.05rem" }}>
              <ReactMarkdown>{data.openThreads}</ReactMarkdown>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
