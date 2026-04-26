import ReactMarkdown from "react-markdown";
import type { WorldDossierJSON } from "../lib/types";

type Props = {
  data: WorldDossierJSON;
};

export function WorldDossierPassport({ data }: Props) {
  return (
    <div className="character-passport" style={{ padding: "32px", width: "100%", margin: "0 auto" }}>
      <header className="passport-header" style={{ flexDirection: "column", gap: "24px", marginBottom: "32px" }}>
        <div className="passport-title-area" style={{ width: "100%" }}>
          <h1 style={{ fontSize: "2.5rem", margin: 0 }}>{data.name || "World Dossier"}</h1>
        </div>
        
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "12px", background: "rgba(11, 20, 37, 0.4)", padding: "16px", borderRadius: "8px", border: "1px solid rgba(149, 181, 255, 0.1)" }}>
          <div style={{ display: "flex", alignItems: "baseline" }}>
            <span className="eyebrow" style={{ color: "#9fbeff", width: "140px", flexShrink: 0 }}>World Type</span>
            <span style={{ fontSize: "1.1rem", fontWeight: 500 }}>{data.worldType || "Unknown"}</span>
          </div>
          
          <div style={{ display: "flex", alignItems: "baseline" }}>
            <span className="eyebrow" style={{ color: "#9fbeff", width: "140px", flexShrink: 0 }}>Scale of Play</span>
            <span style={{ fontSize: "1.1rem", fontWeight: 500 }}>{data.scaleOfPlay || "Unknown"}</span>
          </div>

          <div style={{ display: "flex", alignItems: "baseline" }}>
            <span className="eyebrow" style={{ color: "#9fbeff", width: "140px", flexShrink: 0 }}>Tone & Genre</span>
            <span style={{ fontSize: "1.1rem", fontWeight: 500 }}>{data.toneAndGenre || "Unknown"}</span>
          </div>

          <div style={{ display: "flex", alignItems: "baseline" }}>
            <span className="eyebrow" style={{ color: "#9fbeff", width: "140px", flexShrink: 0 }}>Baseline TL / Mana</span>
            <span style={{ fontSize: "1.1rem", fontWeight: 500 }}>{data.baselineTL} / {data.baselineMana}</span>
          </div>

          {data.themes && data.themes.length > 0 && (
            <div style={{ display: "flex", alignItems: "baseline", marginTop: "8px" }}>
              <span className="eyebrow" style={{ color: "#9fbeff", width: "140px", flexShrink: 0 }}>Themes</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {data.themes.map((theme, idx) => (
                  <span key={idx} className="tag-pill" style={{ background: "rgba(149, 181, 255, 0.15)", border: "1px solid rgba(149, 181, 255, 0.3)", color: "#c6d9ff" }}>
                    {theme}
                  </span>
                ))}
              </div>
            </div>
          )}

          {data.tags && data.tags.length > 0 && (
            <div style={{ display: "flex", alignItems: "baseline", marginTop: "8px" }}>
              <span className="eyebrow" style={{ color: "#9fbeff", width: "140px", flexShrink: 0 }}>Tags</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {data.tags.map((tag, idx) => (
                  <span key={idx} style={{ fontSize: "0.85rem", background: "rgba(255, 255, 255, 0.05)", border: "1px solid rgba(255, 255, 255, 0.1)", color: "#aaa", padding: "2px 8px", borderRadius: "12px" }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </header>

      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {data.elevatorPitch && (
          <section className="tactics-panel" style={{ border: "1px solid rgba(149, 181, 255, 0.3)", background: "rgba(11, 20, 37, 0.6)" }}>
            <span className="eyebrow" style={{ fontSize: "1.1rem", marginBottom: "16px", display: "inline-block", color: "#9fbeff" }}>
              Elevator Pitch
            </span>
            <div className="markdown-content lead-markdown" style={{ fontSize: "1.15rem", lineHeight: 1.6 }}>
              <ReactMarkdown>{data.elevatorPitch}</ReactMarkdown>
            </div>
          </section>
        )}

        {data.corePremises && data.corePremises.length > 0 && (
          <section className="tactics-panel" style={{ borderLeft: "3px solid rgba(149, 255, 181, 0.5)" }}>
            <span className="eyebrow" style={{ fontSize: "1.1rem", marginBottom: "16px", display: "inline-block", color: "#95ffb5" }}>
              Core Premises & Truths
            </span>
            <div className="markdown-content">
              <ul>
                {data.corePremises.map((premise, idx) => (
                  <li key={idx} style={{ marginBottom: "8px" }}><ReactMarkdown>{premise}</ReactMarkdown></li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {data.physicalReality && (
          <section className="tactics-panel" style={{ borderLeft: "3px solid rgba(149, 181, 255, 0.5)" }}>
            <span className="eyebrow" style={{ fontSize: "1.1rem", marginBottom: "16px", display: "inline-block", color: "#9fbeff" }}>
              Physical Reality & Constraints
            </span>
            <div className="markdown-content">
              <ReactMarkdown>{data.physicalReality}</ReactMarkdown>
            </div>
          </section>
        )}

        {data.metaphysics && (
          <section className="tactics-panel" style={{ borderLeft: "3px solid rgba(200, 149, 255, 0.5)" }}>
            <span className="eyebrow" style={{ fontSize: "1.1rem", marginBottom: "16px", display: "inline-block", color: "#c895ff" }}>
              Metaphysics & The Weird
            </span>
            <div className="markdown-content">
              <ReactMarkdown>{data.metaphysics}</ReactMarkdown>
            </div>
          </section>
        )}

        {data.peopleAndCulture && (
          <section className="tactics-panel" style={{ borderLeft: "3px solid rgba(255, 200, 149, 0.5)" }}>
            <span className="eyebrow" style={{ fontSize: "1.1rem", marginBottom: "16px", display: "inline-block", color: "#ffc895" }}>
              People, Culture & Everyday Life
            </span>
            <div className="markdown-content">
              <ReactMarkdown>{data.peopleAndCulture}</ReactMarkdown>
            </div>
          </section>
        )}

        {data.worldMeta && (
          <section className="tactics-panel" style={{ borderLeft: "3px solid rgba(255, 149, 149, 0.5)" }}>
            <span className="eyebrow" style={{ fontSize: "1.1rem", marginBottom: "16px", display: "inline-block", color: "#ff9595" }}>
              World Meta (GM Notes)
            </span>
            <div className="markdown-content">
              <ReactMarkdown>{data.worldMeta}</ReactMarkdown>
            </div>
          </section>
        )}

        {data.deepLore && (
          <section className="tactics-panel" style={{ borderLeft: "3px solid rgba(255, 100, 100, 0.5)", background: "rgba(255, 0, 0, 0.02)" }}>
            <span className="eyebrow" style={{ fontSize: "1.1rem", marginBottom: "16px", display: "inline-block", color: "#ff6464" }}>
              Deep Lore (Secrets)
            </span>
            <div className="markdown-content">
              <ReactMarkdown>{data.deepLore}</ReactMarkdown>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
