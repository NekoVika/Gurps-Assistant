import { useState } from "react";
import ReactMarkdown from "react-markdown";
import type { FactionJSON } from "../lib/types";
import { getMediaUrl } from "../lib/api";
import { InternalLink } from "./InternalLink";

type Props = {
  data: FactionJSON;
  documentPath: string;
  onNavigate?: (target: string) => void;
};

export function FactionPassport({ data, documentPath, onNavigate }: Props) {
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const images = data.images || [];
  const safeImageIdx = images.length > 0 && activeImageIdx < images.length ? activeImageIdx : 0;

  return (
    <div className="character-passport">
      <header className="passport-header" style={{ paddingBottom: "16px", borderBottom: "none" }}>
        <div className="passport-meta" style={{ width: "100%", display: "flex", gap: "16px" }}>
          <div className="meta-badge">
            <span className="eyebrow">Type</span>
            <span className="value">{data.type || "?"}</span>
          </div>
          <div className="meta-badge">
            <span className="eyebrow">Status</span>
            <span className="value">{data.status || "Unknown"}</span>
          </div>
          <div className="meta-badge">
            <span className="eyebrow">Headquarters</span>
            <span className="value">{data.headquarters || "?"}</span>
          </div>
          <div className="meta-badge">
            <span className="eyebrow">Leader</span>
            <span className="value">{data.leader || "???"}</span>
          </div>
        </div>
      </header>

      <div className="passport-grid">
        {/* LEFT COLUMN: Lore & Relations */}
        <aside className="passport-sidebar">
          {images.length > 0 && (
            <div className="passport-gallery">
              <div className="gallery-main-image">
                 <img src={getMediaUrl(images[safeImageIdx], documentPath)} alt="Faction Image" />
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
              <div className="markdown-content">
                  <ReactMarkdown>{data.overview}</ReactMarkdown>
              </div>
            </section>
          )}

          {data.goals && (
            <section className="passport-block">
              <h3>Goals</h3>
              <div className="markdown-content">
                  <ReactMarkdown>{data.goals}</ReactMarkdown>
              </div>
            </section>
          )}

          {data.characterRelations && data.characterRelations.length > 0 && (
            <section className="passport-block">
              <h3>Character Relations</h3>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "4px" }}>
                {data.characterRelations.map((rel, i) => (
                   <li key={i} style={{ fontSize: "0.9em" }}>
                      <InternalLink target={rel.name} onNavigate={onNavigate} />
                      <span style={{ opacity: 0.7, marginLeft: "6px" }}>— {rel.relation}</span>
                   </li>
                ))}
              </ul>
            </section>
          )}

          {data.factionRelations && data.factionRelations.length > 0 && (
            <section className="passport-block">
              <h3>Faction Relations</h3>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "4px" }}>
                {data.factionRelations.map((rel, i) => (
                   <li key={i} style={{ fontSize: "0.9em" }}>
                      <InternalLink target={rel.name} onNavigate={onNavigate} />
                      <span style={{ opacity: 0.7, marginLeft: "6px" }}>— {rel.relation}</span>
                   </li>
                ))}
              </ul>
            </section>
          )}

          {data.locationRelations && data.locationRelations.length > 0 && (
            <section className="passport-block">
              <h3>Location Relations</h3>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "4px" }}>
                {data.locationRelations.map((rel, i) => (
                   <li key={i} style={{ fontSize: "0.9em" }}>
                      <InternalLink target={rel.name} onNavigate={onNavigate} />
                      <span style={{ opacity: 0.7, marginLeft: "6px" }}>— {rel.relation}</span>
                   </li>
                ))}
              </ul>
            </section>
          )}

          {data.storyAppearances && data.storyAppearances.length > 0 && (
            <section className="passport-block">
              <h3>Story Appearances</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {data.storyAppearances.map((loc, i) => (
                   <span className="tag-pill" key={i}>
                      <InternalLink target={loc} onNavigate={onNavigate} />
                   </span>
                ))}
              </div>
            </section>
          )}
        </aside>

        {/* RIGHT COLUMN: Assets & Structure */}
        <main className="passport-main">
          <section className="mechanics-panel">
            <div className="mechanics-header">
              <h3>Structure & Assets</h3>
            </div>
            
            {data.assets && data.assets.length > 0 && (
              <div className="mechanics-section">
                <span className="eyebrow">Assets</span>
                <ul className="traits-list" style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
                  {data.assets.map((asset: string, idx: number) => (
                    <li key={idx} style={{ background: "rgba(255,255,255,0.05)", padding: "4px 8px", borderRadius: "4px" }}>
                      {asset}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.notableMembers && data.notableMembers.length > 0 && (
              <div className="mechanics-section">
                <span className="eyebrow">Notable Members (Legacy)</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {data.notableMembers.map((member: string, idx: number) => (
                    <span className="tag-pill" key={idx}>
                       <InternalLink target={member} onNavigate={onNavigate} />
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="mechanics-split">
              {data.allies && data.allies.length > 0 && (
                <div className="mechanics-section">
                  <span className="eyebrow">Allies (Legacy)</span>
                   <ul className="traits-list" style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
                    {data.allies.map((ally: string, idx: number) => (
                      <li key={idx}>
                        <InternalLink target={ally} onNavigate={onNavigate} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {data.enemies && data.enemies.length > 0 && (
                <div className="mechanics-section">
                  <span className="eyebrow">Enemies (Legacy)</span>
                  <ul className="traits-list flaws" style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
                    {data.enemies.map((enemy: string, idx: number) => (
                      <li key={idx}>
                        <InternalLink target={enemy} onNavigate={onNavigate} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
