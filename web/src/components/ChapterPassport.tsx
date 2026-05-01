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

export function ChapterPassport({ data, documentPath, onNavigate }: Props) {
  const [activeImageIdx] = useState(0);
  const images = data.images || [];
  const safeImageIdx = images.length > 0 && activeImageIdx < images.length ? activeImageIdx : 0;
  return (
    <div className="character-passport story-passport">
      <header className="passport-header" style={{ paddingBottom: "16px", borderBottom: "none" }}>
        <div className="passport-meta" style={{ width: "100%", display: "flex", gap: "16px" }}>
          <div className="meta-badge" style={{ background: "rgba(149, 181, 255, 0.1)", border: "1px solid rgba(149, 181, 255, 0.2)" }}>
            <span className="eyebrow">Type</span>
            <span className="value" style={{ color: "#9fbeff" }}>{data.type || "Chapter"}</span>
          </div>
          <div className="meta-badge significance-badge">
            <span className="eyebrow">Status</span>
            <span className="value">{data.status || "?"}</span>
          </div>
          <div className="meta-badge" style={{ flexGrow: 1 }}>
            <span className="eyebrow">Setting</span>
            <span className="value">
              {data.primaryLocation ? <InternalLink target={data.primaryLocation} onNavigate={onNavigate} /> : "?"}
            </span>
          </div>
        </div>
      </header>

      <div className="passport-grid" style={{ gridTemplateColumns: "1fr 300px", marginTop: "24px" }}>
        {/* LEFT COLUMN: Narrative Beats */}
        <main className="passport-main" style={{ padding: 0 }}>
          {data.gmBrief && (
             <section className="tactics-panel" style={{ marginBottom: "24px", background: "rgba(34, 73, 131, 0.1)" }}>
               <span className="eyebrow" style={{ color: "#9fbeff" }}>GM Brief</span>
               <div className="markdown-content">
                 <ReactMarkdown>{data.gmBrief}</ReactMarkdown>
               </div>
             </section>
          )}

          {data.premise && (
             <section style={{ marginBottom: "28px" }}>
               <h3 style={{ borderBottom: "1px solid rgba(149, 181, 255, 0.2)", paddingBottom: "8px", marginBottom: "16px", color: "#e2e8f0" }}>Scene Setup</h3>
               <div className="markdown-content lead-markdown" style={{ fontSize: "1.05rem" }}>
                 <ReactMarkdown>{data.premise}</ReactMarkdown>
               </div>
             </section>
          )}

          {data.mainOutline && (
             <section style={{ marginBottom: "28px", background: "rgba(11, 20, 37, 0.5)", padding: "20px", borderRadius: "12px", border: "1px solid rgba(149, 181, 255, 0.1)" }}>
               <h3 style={{ color: "#9fbeff", marginBottom: "16px", marginTop: 0 }}>Primary Outline / Beats</h3>
               <div className="markdown-content lead-markdown">
                 <ReactMarkdown>{data.mainOutline}</ReactMarkdown>
               </div>
             </section>
          )}
          
          {data.branchingPath && (
             <section style={{ marginBottom: "28px", borderLeft: "3px dashed rgba(255, 180, 180, 0.5)", paddingLeft: "16px" }}>
               <span className="eyebrow" style={{ color: "#ffb4b4", marginBottom: "12px", display: "inline-block" }}>Branching Path / Variants</span>
               <div className="markdown-content">
                 <ReactMarkdown>{data.branchingPath}</ReactMarkdown>
               </div>
             </section>
          )}

          {data.cluesAndProps && (
             <section className="mechanics-panel" style={{ marginBottom: "20px", background: "rgba(0,0,0,0.15)", border: "1px solid rgba(255,255,255,0.05)" }}>
               <div className="mechanics-header">
                 <h3>Clues & Props</h3>
               </div>
               <div className="mechanics-section markdown-content" style={{ padding: "12px" }}>
                 <ReactMarkdown>{data.cluesAndProps}</ReactMarkdown>
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

          {data.objectives && (
            <section className="passport-block highlight-block" style={{ borderLeftColor: "#f0d588", background: "rgba(240, 213, 136, 0.05)", marginBottom: "20px" }}>
              <h3 style={{ color: "#f0d588" }}>Chapter Objectives</h3>
              <div className="markdown-content">
                 <ReactMarkdown>{data.objectives}</ReactMarkdown>
              </div>
            </section>
          )}

          {data.stakesAndAntagonists && (
            <section className="passport-block" style={{ marginBottom: "20px" }}>
              <h3 style={{ color: "#ffb4b4" }}>Stakes & Opponents</h3>
              <div className="markdown-content">
                 <ReactMarkdown>{data.stakesAndAntagonists}</ReactMarkdown>
              </div>
            </section>
          )}

          {/* Cast & Setting */}
          {((data.characters && data.characters.length > 0) || (data.factions && data.factions.length > 0) || (data.locations && data.locations.length > 0)) && (
            <section className="passport-block" style={{ background: "rgba(10, 16, 28, 0.6)", border: "1px solid rgba(89, 137, 219, 0.15)", borderRadius: "8px", padding: "16px", marginBottom: "20px" }}>
              <h3 style={{ borderBottom: "none", marginBottom: "12px" }}>Present Entities</h3>
              
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

          {data.mechanicsAndHazards && (
             <section className="passport-block highlight-block" style={{ borderLeftColor: "#ffb4b4", background: "rgba(255, 180, 180, 0.05)", marginBottom: "20px" }}>
               <h3 style={{ color: "#ffb4b4" }}>Mechanics & Hazards</h3>
               <div className="markdown-content">
                 <ReactMarkdown>{data.mechanicsAndHazards}</ReactMarkdown>
               </div>
             </section>
          )}

          {data.rewards && (
            <section className="passport-block">
              <h3 style={{ color: "#f0d588" }}>Rewards</h3>
              <div className="markdown-content">
                 <ReactMarkdown>{data.rewards}</ReactMarkdown>
              </div>
            </section>
          )}

          {data.outcomes && (
            <section className="passport-block">
              <h3>Outcomes</h3>
              <div className="markdown-content">
                 <ReactMarkdown>{data.outcomes}</ReactMarkdown>
              </div>
            </section>
          )}
        </aside>
      </div>

      <footer className="passport-footer" style={{ marginTop: "24px", paddingTop: "16px" }}>
        {data.childLinks && (
          <div style={{ marginBottom: "16px" }}>
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
      </footer>
    </div>
  );
}
