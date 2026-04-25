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

export function StoryPassport({ data, documentPath, onNavigate }: Props) {
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const images = data.images || [];

  return (
    <div className="character-passport story-passport">
      <header className="passport-header">
        <div className="passport-title-area">
          <h1>{data.title || "Unknown Story Part"}</h1>
          {data.type && <h2>{data.type} Format</h2>}
        </div>
        <div className="passport-meta">
          <div className="meta-badge significance-badge">
            <span className="eyebrow">Type</span>
            <span className="value">{data.type}</span>
          </div>
          <div className="meta-badge">
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

      <div className="passport-grid">
        {/* LEFT COLUMN: Metadata, Lists, Visuals */}
        <aside className="passport-sidebar">
          {images.length > 0 && (
            <div className="passport-gallery" style={{ aspectRatio: "16 / 9" }}>
              <div className="gallery-main-image" style={{ aspectRatio: "16 / 9" }}>
                 <img src={getMediaUrl(images[activeImageIdx], documentPath)} alt="Story Art" />
              </div>
              {images.length > 1 && (
                 <div className="gallery-thumbnails">
                    {images.map((img: string, idx: number) => (
                       <button 
                         key={idx} 
                         className={`thumb-button ${idx === activeImageIdx ? 'active' : ''}`}
                         onClick={() => setActiveImageIdx(idx)}
                       >
                         <img src={getMediaUrl(img, documentPath)} alt={`Thumbnail ${idx+1}`} />
                       </button>
                    ))}
                 </div>
              )}
            </div>
          )}

          {data.objectives && (
            <section className="passport-block">
              <h3>Objectives</h3>
              <div className="markdown-content">
                 <ReactMarkdown>{data.objectives}</ReactMarkdown>
              </div>
            </section>
          )}

          {data.stakesAndAntagonists && (
            <section className="passport-block highlight-block">
              <h3>Stakes & Participants</h3>
              <div className="markdown-content">
                 <ReactMarkdown>{data.stakesAndAntagonists}</ReactMarkdown>
              </div>
            </section>
          )}

          {data.childLinks && (
            <section className="passport-block">
              <h3>Sub-Index</h3>
              <div className="markdown-content">
                 <ReactMarkdown>{data.childLinks}</ReactMarkdown>
              </div>
            </section>
          )}

          {data.rewards && (
            <section className="passport-block">
              <h3 style={{ color: "#f0d588" }}>Loot & Rewards</h3>
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

        {/* RIGHT COLUMN: The Massive Text Canvas */}
        <main className="passport-main">
          
          {data.gmBrief && (
             <section className="tactics-panel" style={{ marginBottom: "20px", background: "rgba(34, 73, 131, 0.1)" }}>
               <span className="eyebrow" style={{ color: "#9fbeff" }}>GM Brief (Raw)</span>
               <div className="markdown-content">
                 <ReactMarkdown>{data.gmBrief}</ReactMarkdown>
               </div>
             </section>
          )}

          {data.premise && (
             <section className="tactics-panel" style={{ marginBottom: "20px", borderLeft: "3px solid rgba(149, 181, 255, 0.4)" }}>
               <span className="eyebrow">Scene Setup / Premise</span>
               <div className="markdown-content">
                 <ReactMarkdown>{data.premise}</ReactMarkdown>
               </div>
             </section>
          )}

          {data.mainOutline && (
             <section className="tactics-panel" style={{ border: "1px solid rgba(149, 181, 255, 0.2)", background: "rgba(11, 20, 37, 0.5)", marginBottom: "20px" }}>
               <span className="eyebrow" style={{ fontSize: "1.1rem", marginBottom: "12px", display: "inline-block" }}>Primary Outline / Beats</span>
               <div className="markdown-content lead-markdown">
                 <ReactMarkdown>{data.mainOutline}</ReactMarkdown>
               </div>
             </section>
          )}

          {data.branchingPath && (
             <section className="tactics-panel" style={{ border: "1px dashed rgba(255, 180, 180, 0.3)", marginBottom: "20px" }}>
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

          {/* Render Assumptions/Questions at the bottom if any */}
          {data.assumptions && (
             <section className="mechanics-panel" style={{ marginBottom: "20px" }}>
               <div className="mechanics-header">
                 <h3>Assumptions</h3>
               </div>
               <div className="mechanics-section markdown-content" style={{ padding: "12px" }}>
                 <ReactMarkdown>{data.assumptions}</ReactMarkdown>
               </div>
             </section>
          )}

          {data.openQuestions && (
             <section className="mechanics-panel" style={{ marginBottom: "20px" }}>
               <div className="mechanics-header">
                 <h3 style={{ color: "#ffb4b4" }}>Open Questions</h3>
               </div>
               <div className="mechanics-section markdown-content" style={{ padding: "12px" }}>
                 <ReactMarkdown>{data.openQuestions}</ReactMarkdown>
               </div>
             </section>
          )}

        </main>
      </div>

      {data.pcHooks && (
         <footer className="passport-footer markdown-content" style={{ marginTop: "24px", padding: "14px" }}>
            <span className="eyebrow">PC Hooks</span>
            <ReactMarkdown>{data.pcHooks}</ReactMarkdown>
         </footer>
      )}
    </div>
  );
}
