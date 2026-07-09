import { useState } from "react";
import ReactMarkdown from "react-markdown";
import type { WorldDossierJSON } from "../lib/types";
import { getMediaUrl } from "../lib/api";

type Props = {
  data: WorldDossierJSON;
  documentPath?: string;
};

export function WorldDossierPassport({ data, documentPath = "" }: Props) {
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const images = data.images || [];
  const safeImageIdx = images.length > 0 && activeImageIdx < images.length ? activeImageIdx : 0;

  return (
    <div className="character-passport" style={{ width: "100%", display: "flex", flexDirection: "column", gap: "24px" }}>
      
      <div style={{ display: "flex", gap: "32px", flexWrap: "wrap", alignItems: "flex-start" }}>
        {images.length > 0 && (
          <div className="passport-gallery" style={{ width: "280px", flexShrink: 0 }}>
            <div className="gallery-main-image">
               <img src={getMediaUrl(images[safeImageIdx], documentPath)} alt="World Portrait" />
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
              <span className="eyebrow" style={{ color: "#9fbeff", marginBottom: "6px" }}>World Type</span>
              <span style={{ fontSize: "1.1rem", fontWeight: 500 }}>{data.worldType || "Unknown"}</span>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span className="eyebrow" style={{ color: "#9fbeff", marginBottom: "6px" }}>Scale of Play</span>
              <span style={{ fontSize: "1.1rem", fontWeight: 500 }}>{data.scaleOfPlay || "Unknown"}</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column" }}>
              <span className="eyebrow" style={{ color: "#9fbeff", marginBottom: "6px" }}>Tone & Genre</span>
              <span style={{ fontSize: "1.1rem", fontWeight: 500 }}>{data.toneAndGenre || "Unknown"}</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column" }}>
              <span className="eyebrow" style={{ color: "#9fbeff", marginBottom: "6px" }}>Baseline TL / Mana</span>
              <span style={{ fontSize: "1.1rem", fontWeight: 500 }}>{data.baselineTL} / {data.baselineMana}</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: "32px", flexWrap: "wrap" }}>
            {data.themes && data.themes.length > 0 && (
              <section style={{ flexGrow: 1 }}>
                <span className="eyebrow" style={{ color: "#9fbeff", display: "block", marginBottom: "12px" }}>Themes</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {data.themes.map((theme, idx) => (
                    <span key={idx} className="tag-pill" style={{ background: "rgba(149, 181, 255, 0.15)", border: "1px solid rgba(149, 181, 255, 0.3)", color: "#c6d9ff" }}>
                      {theme}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {data.tags && data.tags.length > 0 && (
              <section style={{ flexGrow: 1 }}>
                <span className="eyebrow" style={{ color: "#9fbeff", display: "block", marginBottom: "12px" }}>Tags</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {data.tags.map((tag, idx) => (
                    <span key={idx} style={{ fontSize: "0.85rem", background: "rgba(255, 255, 255, 0.05)", border: "1px solid rgba(255, 255, 255, 0.1)", color: "#aaa", padding: "4px 10px", borderRadius: "12px" }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {data.elevatorPitch && (
          <section style={{ padding: "24px", border: "1px solid rgba(149, 181, 255, 0.3)", background: "rgba(11, 20, 37, 0.6)", borderRadius: "12px" }}>
            <span className="eyebrow" style={{ fontSize: "1.1rem", marginBottom: "16px", display: "inline-block", color: "#9fbeff" }}>
              Elevator Pitch
            </span>
            <div className="markdown-content lead-markdown" style={{ fontSize: "1.15rem", lineHeight: 1.6 }}>
              <ReactMarkdown>{data.elevatorPitch}</ReactMarkdown>
            </div>
          </section>
        )}

        {data.corePremises && data.corePremises.length > 0 && (
          <section style={{ padding: "24px", borderLeft: "4px solid rgba(149, 255, 181, 0.6)", background: "rgba(149, 255, 181, 0.04)", borderRadius: "0 12px 12px 0" }}>
            <span className="eyebrow" style={{ fontSize: "1.1rem", marginBottom: "16px", display: "inline-block", color: "#95ffb5" }}>
              Core Premises & Truths
            </span>
            <div className="markdown-content">
              <ul style={{ paddingLeft: "20px", fontSize: "1.05rem" }}>
                {data.corePremises.map((premise, idx) => (
                  <li key={idx} style={{ marginBottom: "12px" }}><ReactMarkdown>{premise}</ReactMarkdown></li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {data.physicalReality && (
          <section style={{ padding: "24px", borderLeft: "4px solid rgba(149, 181, 255, 0.6)", background: "rgba(149, 181, 255, 0.04)", borderRadius: "0 12px 12px 0" }}>
            <span className="eyebrow" style={{ fontSize: "1.1rem", marginBottom: "16px", display: "inline-block", color: "#9fbeff" }}>
              Physical Reality & Constraints
            </span>
            <div className="markdown-content" style={{ fontSize: "1.05rem" }}>
              <ReactMarkdown>{data.physicalReality}</ReactMarkdown>
            </div>
          </section>
        )}

        {data.metaphysics && (
          <section style={{ padding: "24px", borderLeft: "4px solid rgba(200, 149, 255, 0.6)", background: "rgba(200, 149, 255, 0.04)", borderRadius: "0 12px 12px 0" }}>
            <span className="eyebrow" style={{ fontSize: "1.1rem", marginBottom: "16px", display: "inline-block", color: "#c895ff" }}>
              Metaphysics & The Weird
            </span>
            <div className="markdown-content" style={{ fontSize: "1.05rem" }}>
              <ReactMarkdown>{data.metaphysics}</ReactMarkdown>
            </div>
          </section>
        )}

        {data.peopleAndCulture && (
          <section style={{ padding: "24px", borderLeft: "4px solid rgba(255, 200, 149, 0.6)", background: "rgba(255, 200, 149, 0.04)", borderRadius: "0 12px 12px 0" }}>
            <span className="eyebrow" style={{ fontSize: "1.1rem", marginBottom: "16px", display: "inline-block", color: "#ffc895" }}>
              People, Culture & Everyday Life
            </span>
            <div className="markdown-content" style={{ fontSize: "1.05rem" }}>
              <ReactMarkdown>{data.peopleAndCulture}</ReactMarkdown>
            </div>
          </section>
        )}

        {data.worldMeta && (
          <section style={{ padding: "24px", borderLeft: "4px solid rgba(255, 149, 149, 0.6)", background: "rgba(255, 149, 149, 0.04)", borderRadius: "0 12px 12px 0" }}>
            <span className="eyebrow" style={{ fontSize: "1.1rem", marginBottom: "16px", display: "inline-block", color: "#ff9595" }}>
              World Meta (GM Notes)
            </span>
            <div className="markdown-content" style={{ fontSize: "1.05rem" }}>
              <ReactMarkdown>{data.worldMeta}</ReactMarkdown>
            </div>
          </section>
        )}

        {data.deepLore && (
          <section style={{ padding: "24px", borderLeft: "4px solid rgba(255, 100, 100, 0.6)", background: "rgba(255, 100, 100, 0.06)", borderRadius: "0 12px 12px 0" }}>
            <span className="eyebrow" style={{ fontSize: "1.1rem", marginBottom: "16px", display: "inline-block", color: "#ff6464" }}>
              Deep Lore (Secrets)
            </span>
            <div className="markdown-content" style={{ fontSize: "1.05rem" }}>
              <ReactMarkdown>{data.deepLore}</ReactMarkdown>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
