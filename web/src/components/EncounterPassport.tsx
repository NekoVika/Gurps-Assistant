import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { InternalLink } from "./InternalLink";
import type { StoryJSON } from "../lib/types";
import { getMediaUrl } from "../lib/api";

type Props = {
  data: StoryJSON;
  documentPath: string;
  onNavigate?: (target: string) => void;
};

export function EncounterPassport({ data, documentPath, onNavigate }: Props) {
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const images = data.images || [];
  const safeImageIdx = images.length > 0 && activeImageIdx < images.length ? activeImageIdx : 0;
  const hasMechanics = !!data.mechanicsAndHazards;
  const hasClues = !!data.cluesAndProps;
  const topGridCols = (hasMechanics && hasClues) ? "1fr 1fr" : "1fr";

  return (
    <div className="character-passport story-passport">
      <header className="passport-header" style={{ paddingBottom: "16px", borderBottom: "none" }}>
        <div className="passport-meta" style={{ width: "100%", display: "flex", gap: "16px" }}>
          <div className="meta-badge" style={{ background: "rgba(255, 100, 100, 0.1)", border: "1px solid rgba(255, 100, 100, 0.3)" }}>
            <span className="eyebrow" style={{ color: "#ffb4b4" }}>Type</span>
            <span className="value" style={{ color: "#ffb4b4" }}>{data.type || "Encounter"}</span>
          </div>
          <div className="meta-badge" style={{ background: "rgba(255, 100, 100, 0.1)", borderColor: "rgba(255, 100, 100, 0.3)" }}>
            <span className="eyebrow" style={{ color: "#ffb4b4" }}>Status</span>
            <span className="value" style={{ color: "#ffb4b4" }}>{data.status || "?"}</span>
          </div>
          <div className="meta-badge" style={{ flexGrow: 1 }}>
            <span className="eyebrow">Location</span>
            <span className="value">
              {data.primaryLocation ? <InternalLink target={data.primaryLocation} onNavigate={onNavigate} /> : "?"}
            </span>
          </div>
        </div>
      </header>

      {/* TOP ROW: Tactical Overview */}
      {(hasMechanics || hasClues) && (
        <div style={{ display: "grid", gridTemplateColumns: topGridCols, gap: "24px", marginTop: "24px" }}>
          {hasMechanics && (
             <section className="mechanics-panel" style={{ background: "rgba(255, 50, 50, 0.05)", border: "1px solid rgba(255, 100, 100, 0.2)" }}>
               <div className="mechanics-header">
                 <h3 style={{ color: "#ffb4b4", margin: 0 }}>Mechanics & Hazards</h3>
               </div>
               <div className="mechanics-section markdown-content" style={{ padding: "12px", paddingTop: "16px" }}>
                 <ReactMarkdown>{data.mechanicsAndHazards as string}</ReactMarkdown>
               </div>
             </section>
          )}
          
          {hasClues && (
             <section className="mechanics-panel" style={{ background: "rgba(100, 200, 255, 0.05)", border: "1px solid rgba(100, 200, 255, 0.2)" }}>
               <div className="mechanics-header">
                 <h3 style={{ color: "#a5d8ff", margin: 0 }}>Clues & Props</h3>
               </div>
               <div className="mechanics-section markdown-content" style={{ padding: "12px", paddingTop: "16px" }}>
                 <ReactMarkdown>{data.cluesAndProps as string}</ReactMarkdown>
               </div>
             </section>
          )}
        </div>
      )}

      <div className="passport-grid" style={{ gridTemplateColumns: "1fr 300px", marginTop: "24px" }}>
        {/* LEFT COLUMN: Narrative Details */}
        <main className="passport-main" style={{ padding: 0 }}>
          {data.premise && (
             <section style={{ marginBottom: "28px" }}>
               <h3 style={{ color: "#e2e8f0", marginBottom: "12px", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "8px" }}>Setup / Trigger</h3>
               <div className="markdown-content" style={{ fontSize: "1.05rem" }}>
                 <ReactMarkdown>{data.premise}</ReactMarkdown>
               </div>
             </section>
          )}

          {data.mainOutline && (
             <section style={{ marginBottom: "28px", background: "rgba(11, 20, 37, 0.5)", padding: "16px", borderRadius: "8px" }}>
               <h3 style={{ color: "#9fbeff", marginBottom: "12px", marginTop: 0 }}>Encounter Flow</h3>
               <div className="markdown-content">
                 <ReactMarkdown>{data.mainOutline}</ReactMarkdown>
               </div>
             </section>
          )}
          
          {data.branchingPath && (
             <section style={{ marginBottom: "28px", borderLeft: "3px dashed rgba(255, 180, 180, 0.5)", paddingLeft: "16px" }}>
               <span className="eyebrow" style={{ color: "#ffb4b4", marginBottom: "12px", display: "inline-block" }}>Variants / Escalation</span>
               <div className="markdown-content">
                 <ReactMarkdown>{data.branchingPath}</ReactMarkdown>
               </div>
             </section>
          )}
          
          {data.gmBrief && (
             <section className="tactics-panel" style={{ marginBottom: "24px", background: "rgba(34, 73, 131, 0.1)" }}>
               <span className="eyebrow" style={{ color: "#9fbeff" }}>GM Notes</span>
               <div className="markdown-content">
                 <ReactMarkdown>{data.gmBrief}</ReactMarkdown>
               </div>
             </section>
          )}
        </main>

        {/* RIGHT COLUMN: Sidebar */}
        <aside className="passport-sidebar">
          {images.length > 0 && (
            <div className="passport-gallery" style={{ aspectRatio: "16 / 9", marginBottom: "20px" }}>
              <div className="gallery-main-image" style={{ aspectRatio: "16 / 9" }}>
                 <img src={getMediaUrl(images[safeImageIdx], documentPath)} alt="Story Art" />
              </div>
            </div>
          )}

          {data.stakesAndAntagonists && (
            <section className="passport-block highlight-block" style={{ borderLeftColor: "#ffb4b4", background: "rgba(255, 180, 180, 0.05)", marginBottom: "20px" }}>
              <h3 style={{ color: "#ffb4b4" }}>Opponents & Stakes</h3>
              <div className="markdown-content">
                 <ReactMarkdown>{data.stakesAndAntagonists}</ReactMarkdown>
              </div>
            </section>
          )}

          {/* Cast & Setting */}
          {((data.characters && data.characters.length > 0) || (data.factions && data.factions.length > 0)) && (
            <section className="passport-block" style={{ background: "rgba(10, 16, 28, 0.6)", border: "1px solid rgba(89, 137, 219, 0.15)", borderRadius: "8px", padding: "16px", marginBottom: "20px" }}>
              <h3 style={{ borderBottom: "none", marginBottom: "12px" }}>Combatants & NPCs</h3>
              
              {data.characters && data.characters.length > 0 && (
                <div style={{ marginBottom: "12px" }}>
                  <span className="eyebrow" style={{ fontSize: "0.65rem", display: "block", marginBottom: "6px" }}>Characters</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {data.characters.map((char, i) => (
                       <span className="tag-pill" key={`c-${i}`}>
                          <InternalLink target={char} onNavigate={onNavigate} />
                       </span>
                    ))}
                  </div>
                </div>
              )}

              {data.factions && data.factions.length > 0 && (
                <div style={{ marginBottom: "12px" }}>
                  <span className="eyebrow" style={{ fontSize: "0.65rem", display: "block", marginBottom: "6px" }}>Factions</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {data.factions.map((fac, i) => (
                       <span className="tag-pill" key={`f-${i}`}>
                          <InternalLink target={fac} onNavigate={onNavigate} />
                       </span>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {data.rewards && (
            <section className="passport-block">
              <h3 style={{ color: "#f0d588" }}>Loot</h3>
              <div className="markdown-content">
                 <ReactMarkdown>{data.rewards}</ReactMarkdown>
              </div>
            </section>
          )}

          {data.outcomes && (
            <section className="passport-block">
              <h3>Resolutions</h3>
              <div className="markdown-content">
                 <ReactMarkdown>{data.outcomes}</ReactMarkdown>
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
