import { useState } from "react";
import { InternalLink } from "./InternalLink";
import type { LocationJSON } from "../lib/types";
import { getMediaUrl } from "../lib/api";

type Props = {
  data: LocationJSON;
  documentPath: string;
  onNavigate?: (target: string) => void;
};

export function LocationPassport({ data, documentPath, onNavigate }: Props) {
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const images = data.images || [];
  const safeImageIdx = images.length > 0 && activeImageIdx < images.length ? activeImageIdx : 0;

  return (
    <div className="character-passport">
      <header className="passport-header" style={{ paddingBottom: "16px", borderBottom: "none" }}>
        <div className="passport-meta" style={{ width: "100%", display: "flex", gap: "16px" }}>
          <div className="meta-badge significance-badge">
            <span className="eyebrow">Type</span>
            <span className="value">{data.type || "?"}</span>
          </div>
          <div className="meta-badge">
            <span className="eyebrow">Region</span>
            <span className="value">{data.region || "?"}</span>
          </div>
          <div className="meta-badge">
            <span className="eyebrow">Tech Level</span>
            <span className="value">{data.techLevel || "?"}</span>
          </div>
          <div className="meta-badge">
            <span className="eyebrow">Mana</span>
            <span className="value">{data.manaLevel || "?"}</span>
          </div>
        </div>
      </header>

      <div className="passport-grid">
        {/* LEFT COLUMN: Visuals & Lore */}
        <aside className="passport-sidebar">
          {images.length > 0 && (
            <div className="passport-gallery" style={{ aspectRatio: "16 / 9" }}>
              <div className="gallery-main-image" style={{ aspectRatio: "16 / 9" }}>
                 <img src={getMediaUrl(images[safeImageIdx], documentPath)} alt="Location Geography" />
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

          {data.overview && (
            <section className="passport-block">
              <h3>Overview</h3>
              <p>{data.overview.replace(/\[|\]/g, "")}</p>
            </section>
          )}

          {data.landmarks && data.landmarks.length > 0 && (
            <section className="passport-block">
              <h3>Key Landmarks</h3>
              <ul className="plain-list">
                 {data.landmarks.map((mark: string, i: number) => <li key={i}>{mark}</li>)}
              </ul>
            </section>
          )}
        </aside>

        {/* RIGHT COLUMN: Structure & Mechanics */}
        <main className="passport-main">
          
          {data.internalStructure && data.internalStructure.length > 0 && (
             <section className="mechanics-panel" style={{ marginBottom: "20px" }}>
               <div className="mechanics-header">
                 <h3>Internal Structure / Topography</h3>
               </div>
               
               {data.internalStructure.map((struct: any, i: number) => (
                 <div className="mechanics-section" key={i}>
                   <span className="eyebrow" style={{ color: "#9fbeff" }}>{struct.title}</span>
                   <ul className="traits-list">
                       {struct.items.map((item: string, id: number) => <li key={id}>{item}</li>)}
                   </ul>
                 </div>
               ))}
             </section>
          )}

          <section className="mechanics-panel">
            <div className="mechanics-header">
              <h3>Entities & Control</h3>
            </div>
            
            {data.characterRelations && data.characterRelations.length > 0 && (
              <div className="mechanics-section">
                <span className="eyebrow">Character Relations</span>
                <ul className="traits-list">
                  {data.characterRelations.map((rel, idx) => (
                      <li key={idx}>
                         <InternalLink target={rel.name} onNavigate={onNavigate} />
                         <span style={{ opacity: 0.7, marginLeft: "6px" }}>— {rel.relation}</span>
                      </li>
                  ))}
                </ul>
              </div>
            )}

            {data.factionRelations && data.factionRelations.length > 0 && (
              <div className="mechanics-section">
                <span className="eyebrow">Faction Relations</span>
                <ul className="traits-list">
                  {data.factionRelations.map((rel, idx) => (
                      <li key={idx}>
                         <InternalLink target={rel.name} onNavigate={onNavigate} />
                         <span style={{ opacity: 0.7, marginLeft: "6px" }}>— {rel.relation}</span>
                      </li>
                  ))}
                </ul>
              </div>
            )}

            {data.locationRelations && data.locationRelations.length > 0 && (
              <div className="mechanics-section">
                <span className="eyebrow">Location Relations</span>
                <ul className="traits-list">
                  {data.locationRelations.map((rel, idx) => (
                      <li key={idx}>
                         <InternalLink target={rel.name} onNavigate={onNavigate} />
                         <span style={{ opacity: 0.7, marginLeft: "6px" }}>— {rel.relation}</span>
                      </li>
                  ))}
                </ul>
              </div>
            )}

            {data.storyAppearances && data.storyAppearances.length > 0 && (
              <div className="mechanics-section">
                <span className="eyebrow">Story Appearances</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "4px" }}>
                  {data.storyAppearances.map((loc, idx) => (
                     <span className="tag-pill" key={idx}>
                        <InternalLink target={loc} onNavigate={onNavigate} />
                     </span>
                  ))}
                </div>
              </div>
            )}

            {data.factions && data.factions.length > 0 && (
              <div className="mechanics-section">
                <span className="eyebrow">Factions (Legacy)</span>
                <ul className="traits-list">
                  {data.factions.map((fac: string, idx: number) => <li key={idx}><InternalLink target={fac} onNavigate={onNavigate} /></li>)}
                </ul>
              </div>
            )}

            {data.notableNpcs && data.notableNpcs.length > 0 && (
              <div className="mechanics-section">
                <span className="eyebrow">Notable NPCs (Legacy)</span>
                <ul className="traits-list skills-list">
                  {data.notableNpcs.map((npc: string, idx: number) => <li key={idx}><InternalLink target={npc} onNavigate={onNavigate} /></li>)}
                </ul>
              </div>
            )}
            
            {data.plotHooks && data.plotHooks.length > 0 && (
              <div className="mechanics-section">
                <span className="eyebrow" style={{ color: "#ffb4b4" }}>Plot Hooks & Secrets</span>
                <ul className="traits-list flaws">
                  {data.plotHooks.map((hook: string, idx: number) => <li key={idx}>{hook}</li>)}
                </ul>
              </div>
            )}
          </section>

        </main>
      </div>
    </div>
  );
}
