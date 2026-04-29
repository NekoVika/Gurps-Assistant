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

export function EpisodePassport({ data, documentPath, onNavigate }: Props) {
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const images = data.images || [];
  const safeImageIdx = images.length > 0 && activeImageIdx < images.length ? activeImageIdx : 0;
  return (
    <div className="character-passport story-passport">
      {/* Hero Banner */}
      <header className="passport-header episode-header" style={{ paddingBottom: "16px", borderBottom: "none" }}>
        <div className="passport-meta" style={{ width: "100%", display: "flex", gap: "16px" }}>
          <div className="meta-badge" style={{ background: "rgba(149, 181, 255, 0.1)", border: "1px solid rgba(149, 181, 255, 0.2)" }}>
            <span className="eyebrow">Type</span>
            <span className="value" style={{ color: "#9fbeff" }}>{data.type || "Episode"} Overview</span>
          </div>
          <div className="meta-badge significance-badge">
            <span className="eyebrow">Status</span>
            <span className="value">{data.status || "?"}</span>
          </div>
          <div className="meta-badge" style={{ flexGrow: 1 }}>
            <span className="eyebrow">Primary Setting</span>
            <span className="value">
              {data.primaryLocation ? <InternalLink target={data.primaryLocation} onNavigate={onNavigate} /> : "?"}
            </span>
          </div>
        </div>
      </header>

      {/* CORE DRIVE (Full Width) */}
      {(data.objectives || data.stakesAndAntagonists) && (
        <div className="episode-core-drive" style={{ marginBottom: "32px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", background: "rgba(16, 28, 49, 0.4)", padding: "24px", borderRadius: "12px", border: "1px solid rgba(89, 137, 219, 0.2)" }}>
          {data.objectives && (
            <section className="mission-block">
              <h3 style={{ color: "#f0d588", borderBottom: "1px solid rgba(240, 213, 136, 0.2)", paddingBottom: "8px", marginTop: 0 }}>Primary Objectives</h3>
              <div className="markdown-content">
                 <ReactMarkdown>{data.objectives}</ReactMarkdown>
              </div>
            </section>
          )}
          {data.stakesAndAntagonists && (
            <section className="mission-block">
              <h3 style={{ color: "#ffb4b4", borderBottom: "1px solid rgba(255, 180, 180, 0.2)", paddingBottom: "8px", marginTop: 0 }}>Stakes & Participants</h3>
              <div className="markdown-content">
                 <ReactMarkdown>{data.stakesAndAntagonists}</ReactMarkdown>
              </div>
            </section>
          )}
        </div>
      )}

      <div className="passport-grid" style={{ gridTemplateColumns: "1fr 280px" }}>
        {/* LEFT COLUMN: Main Canvas (The Narrative Meat) */}
        <main className="passport-main" style={{ padding: 0 }}>
          {data.gmBrief && (
             <section className="tactics-panel" style={{ marginBottom: "28px", background: "rgba(34, 73, 131, 0.1)" }}>
               <span className="eyebrow" style={{ color: "#9fbeff" }}>GM Brief (Raw)</span>
               <div className="markdown-content lead-markdown">
                 <ReactMarkdown>{data.gmBrief}</ReactMarkdown>
               </div>
             </section>
          )}

          {data.premise && (
             <section style={{ marginBottom: "28px", borderLeft: "4px solid rgba(149, 181, 255, 0.6)", paddingLeft: "16px" }}>
               <span className="eyebrow" style={{ fontSize: "0.85rem", letterSpacing: "2px" }}>Scene Setup / Premise</span>
               <div className="markdown-content lead-markdown" style={{ fontSize: "1.1rem" }}>
                 <ReactMarkdown>{data.premise}</ReactMarkdown>
               </div>
             </section>
          )}

          {data.mainOutline && (
             <section style={{ marginBottom: "28px" }}>
               <h3 style={{ color: "#9fbeff", borderBottom: "1px solid rgba(149, 181, 255, 0.2)", paddingBottom: "8px", marginBottom: "16px", textTransform: "uppercase", letterSpacing: "1px" }}>Primary Outline</h3>
               <div className="markdown-content lead-markdown">
                 <ReactMarkdown>{data.mainOutline}</ReactMarkdown>
               </div>
             </section>
          )}
          
          {data.branchingPath && (
             <section style={{ marginBottom: "28px", background: "rgba(20, 20, 20, 0.3)", padding: "20px", borderRadius: "8px", border: "1px dashed rgba(255, 180, 180, 0.3)" }}>
               <span className="eyebrow" style={{ color: "#ffb4b4", marginBottom: "12px", display: "inline-block" }}>Branching / Variant Path</span>
               <div className="markdown-content">
                 <ReactMarkdown>{data.branchingPath}</ReactMarkdown>
               </div>
             </section>
          )}

          {data.cluesAndProps && (
             <section className="mechanics-panel" style={{ marginBottom: "20px" }}>
               <div className="mechanics-header">
                 <h3>Clues & Props</h3>
               </div>
               <div className="mechanics-section markdown-content" style={{ padding: "12px" }}>
                 <ReactMarkdown>{data.cluesAndProps}</ReactMarkdown>
               </div>
             </section>
          )}

          {data.mechanicsAndHazards && (
             <section className="mechanics-panel" style={{ marginBottom: "20px" }}>
               <div className="mechanics-header">
                 <h3 style={{ color: "#ffb4b4" }}>Mechanics & Hazards</h3>
               </div>
               <div className="mechanics-section markdown-content" style={{ padding: "12px" }}>
                 <ReactMarkdown>{data.mechanicsAndHazards}</ReactMarkdown>
               </div>
             </section>
          )}
        </main>

        {/* RIGHT COLUMN: Condensed Sidebar */}
        <aside className="passport-sidebar">
          {images.length > 0 && (
            <div className="passport-gallery" style={{ aspectRatio: "16 / 9", marginBottom: "20px" }}>
              <div className="gallery-main-image" style={{ aspectRatio: "16 / 9" }}>
                 <img src={getMediaUrl(images[safeImageIdx], documentPath)} alt="Story Art" />
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

          {/* Cast & Setting */}
          {((data.characters && data.characters.length > 0) || (data.factions && data.factions.length > 0) || (data.locations && data.locations.length > 0)) && (
            <section className="passport-block" style={{ background: "rgba(10, 16, 28, 0.6)", border: "1px solid rgba(89, 137, 219, 0.15)", borderRadius: "8px", padding: "16px", marginBottom: "20px" }}>
              <h3 style={{ borderBottom: "none", marginBottom: "12px" }}>Dramatis Personae</h3>
              
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

              {data.locations && data.locations.length > 0 && (
                <div>
                  <span className="eyebrow" style={{ fontSize: "0.65rem", display: "block", marginBottom: "6px" }}>Locations</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {data.locations.map((loc, i) => (
                       <span className="tag-pill" key={`l-${i}`}>
                          <InternalLink target={loc} onNavigate={onNavigate} />
                       </span>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {data.rewards && (
            <section className="passport-block">
              <h3 style={{ color: "#f0d588" }}>Rewards & Loot</h3>
              <div className="markdown-content">
                 <ReactMarkdown>{data.rewards}</ReactMarkdown>
              </div>
            </section>
          )}

          {data.assumptions && (
             <section className="passport-block">
               <h3>Assumptions</h3>
               <div className="markdown-content">
                 <ReactMarkdown>{data.assumptions}</ReactMarkdown>
               </div>
             </section>
          )}

          {data.openQuestions && (
             <section className="passport-block highlight-block" style={{ borderLeftColor: "#ffb4b4" }}>
               <h3 style={{ color: "#ffb4b4" }}>Open Questions</h3>
               <div className="markdown-content">
                 <ReactMarkdown>{data.openQuestions}</ReactMarkdown>
               </div>
             </section>
          )}

          {data.outcomes && (
            <section className="passport-block">
              <h3>Expected Outcomes</h3>
              <div className="markdown-content">
                 <ReactMarkdown>{data.outcomes}</ReactMarkdown>
              </div>
            </section>
          )}
        </aside>
      </div>

      {/* Progression Track & Hooks (Footer) */}
      <footer className="passport-footer" style={{ marginTop: "32px", borderTop: "2px solid rgba(89, 137, 219, 0.2)", paddingTop: "24px" }}>
        {data.childLinks && (
          <div style={{ marginBottom: "24px" }}>
            <span className="eyebrow" style={{ display: "block", marginBottom: "8px" }}>Child Links</span>
            {Array.isArray(data.childLinks) ? (
               <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {data.childLinks.map((link, idx) => (
                     <div key={idx} className="tag-pill" style={{ padding: "4px 10px", background: "rgba(149, 181, 255, 0.1)", border: "1px solid rgba(149, 181, 255, 0.2)", fontSize: "0.8rem" }}>
                         <InternalLink target={link} onNavigate={onNavigate} />
                     </div>
                  ))}
               </div>
            ) : (
               <div className="markdown-content" style={{ fontSize: "0.85rem", opacity: 0.8 }}>
                  <ReactMarkdown>{data.childLinks}</ReactMarkdown>
               </div>
            )}
          </div>
        )}

        {data.pcHooks && (
          <div className="markdown-content">
            <span className="eyebrow" style={{ display: "block", marginBottom: "8px" }}>PC Hooks</span>
            <ReactMarkdown>{data.pcHooks}</ReactMarkdown>
          </div>
        )}
      </footer>
    </div>
  );
}
