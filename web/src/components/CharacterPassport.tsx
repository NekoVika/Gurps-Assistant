import { useState } from "react";
import ReactMarkdown from "react-markdown";
import type { CharacterJSON } from "../lib/types";
import { getMediaUrl, mendString } from "../lib/api";
import { InternalLink } from "./InternalLink";
import { parseAttribute, parseTrait, parseSkill, parseGear, parseHitLocation } from "../lib/TraitFormatters";


function MendableString({ 
   rawString, targetType, field, idx, data, onUpdate 
}: { 
   rawString: string; targetType: string; field: keyof CharacterJSON; idx: number; data: CharacterJSON; onUpdate?: (newData: CharacterJSON) => void 
}) {
   const [loading, setLoading] = useState(false);
   const [history, setHistory] = useState<string[]>([]);

   const handleSave = (newVal: string) => {
      if (!onUpdate) return;
      setHistory(prev => [...prev, rawString]);
      const arr = [...(data[field] as string[])];
      arr[idx] = newVal;
      onUpdate({ ...data, [field]: arr });
   };

   const handleRollback = () => {
      if (!onUpdate || history.length === 0) return;
      const last = history[history.length - 1];
      setHistory(prev => prev.slice(0, -1));
      const arr = [...(data[field] as string[])];
      arr[idx] = last;
      onUpdate({ ...data, [field]: arr });
   };

   const handleMend = async () => {
      setLoading(true);
      try {
         const res = await mendString({ provider: "", model: "", target_type: targetType, raw_string: rawString });
         handleSave(res.mended_string);
      } catch (err) {
         console.error(err);
         alert("Mend failed. " + String(err));
      } finally {
         setLoading(false);
      }
   };

   return (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", padding: "4px 8px", background: "rgba(245, 158, 11, 0.1)", borderLeft: "3px solid #f59e0b", margin: "4px 0", borderRadius: "0 4px 4px 0" }}>
         <span style={{ fontFamily: "monospace", opacity: 0.9, wordBreak: "break-word", fontSize: "0.85em", color: "#fcd34d" }}>{rawString}</span>
         <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
            {history.length > 0 && onUpdate && (
               <button onClick={handleRollback} disabled={loading} style={{ background: "transparent", border: "1px solid #f59e0b", color: "#f59e0b", padding: "2px 8px", fontSize: "0.75rem", borderRadius: "4px", cursor: "pointer" }}>
                  ⎌ Undo
               </button>
            )}
            {onUpdate && <button onClick={handleMend} disabled={loading} style={{ background: "#1f6feb", border: "none", color: "white", padding: "2px 8px", fontSize: "0.75rem", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", boxShadow: "0 2px 4px rgba(0,0,0,0.2)" }}>
               {loading ? "..." : "AI Mend"}
            </button>}
         </div>
      </div>
   );
}

type Props = {
  data: CharacterJSON;
  documentPath: string;
  onUpdate?: (newData: CharacterJSON) => void;
  onNavigate?: (target: string) => void;
};

export function CharacterPassport({ data, documentPath, onUpdate, onNavigate }: Props) {
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const images = data.images || [];

  const parsedAttributes = (data.attributes || []).map(parseAttribute);
  const parsedAdvantages = (data.advantages || []).map(parseTrait);
  const parsedDisadvantages = (data.disadvantages || []).map(parseTrait);
  const parsedSkills = (data.skills || []).map(parseSkill);
  const parsedGear = (data.gear || []).map(parseGear);
  const parsedHitLocations = (typeof data.hitLocations === 'string') 
      ? data.hitLocations 
      : (data.hitLocations || []).map(parseHitLocation);


  return (
    <div className="character-passport">
      <header className="passport-header">
        <div className="passport-title-area">
          <h1>{data.name || "Unknown Identity"}</h1>
          {data.concept && <h2>{data.concept}</h2>}
        </div>
        <div className="passport-meta">
          <div className="meta-badge significance-badge">
            <span className="eyebrow">Significance</span>
            <span className="value">{data.significance || "?"}</span>
          </div>
          <div className="meta-badge">
            <span className="eyebrow">Role</span>
            <span className="value">{data.role || "?"}</span>
          </div>
          <div className="meta-badge">
            <span className="eyebrow">Status</span>
            <span className="value">{data.status || "Unknown"}</span>
          </div>
          <div className="meta-badge">
            <span className="eyebrow">Points</span>
            <span className="value">{data.pointTotal || "???"}</span>
          </div>
        </div>
      </header>

      <div className="passport-grid">
        {/* LEFT COLUMN: Narrative & Identity */}
        <aside className="passport-sidebar">
          {images.length > 0 && (
            <div className="passport-gallery">
              <div className="gallery-main-image">
                 <img src={getMediaUrl(images[activeImageIdx], documentPath)} alt="Character Portrait" />
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

          {data.appearance && (
            <section className="passport-block">
              <h3>Appearance</h3>
              <p>{data.appearance.replace(/\[|\]/g, "")}</p>
            </section>
          )}

          {data.personality && (
            <section className="passport-block">
              <h3>Personality & Quirks</h3>
              <p>{data.personality.replace(/\[|\]/g, "")}</p>
            </section>
          )}

          {data.motivation && (
            <section className="passport-block">
              <h3>Motivation</h3>
              <p>{data.motivation.replace(/\[|\]/g, "")}</p>
            </section>
          )}

          {data.speech && (
            <section className="passport-block highlight-block">
              <h3>Quote</h3>
              <blockquote>"{data.speech.replace(/\[|\]/g, "")}"</blockquote>
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

          {data.locations && data.locations.length > 0 && (
            <section className="passport-block">
              <h3>Locations (Legacy)</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {data.locations.map((loc, i) => (
                   <span className="tag-pill" key={i}>
                      <InternalLink target={loc.replace(/\[|\]/g, "")} onNavigate={onNavigate} />
                   </span>
                ))}
              </div>
            </section>
          )}
          
          {data.relations && data.relations.length > 0 && (
            <section className="passport-block">
              <h3>Relations (Legacy)</h3>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "4px" }}>
                {data.relations.map((rel, i) => (
                   <li key={i} style={{ fontSize: "0.9em" }}>
                      <InternalLink target={rel.name.replace(/\[|\]/g, "")} onNavigate={onNavigate} />
                      <span style={{ opacity: 0.7, marginLeft: "6px" }}>— {rel.relationship}</span>
                   </li>
                ))}
              </ul>
            </section>
          )}

          {data.appearances && data.appearances.length > 0 && (
            <section className="passport-block">
              <h3>Appearances (Legacy)</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {data.appearances.map((app, i) => (
                   <span className="tag-pill" key={i}>
                      <InternalLink target={app.replace(/\[|\]/g, "")} onNavigate={onNavigate} />
                   </span>
                ))}
              </div>
            </section>
          )}
        </aside>

        {/* RIGHT COLUMN: Mechanics */}
        <main className="passport-main">
          <section className="mechanics-panel">
            <div className="mechanics-header">
              <h3>GURPS 4e Statistics</h3>
            </div>
            
            {data.attributes && data.attributes.length > 0 && (
              <div className="mechanics-section">
                <span className="eyebrow">Attributes</span>
                <ul className="stats-list" style={{ display: "flex", gap: "12px", flexWrap: "wrap", listStyle: "none", padding: 0 }}>
                  {parsedAttributes.map((attr: any, idx: number) => {
                     if (typeof attr === 'string') return <li key={idx} style={{ width: "100%" }}><MendableString rawString={attr} targetType="Attribute" field="attributes" idx={idx} data={data} onUpdate={onUpdate} /></li>;
                     return <li key={idx} style={{ background: "rgba(255,255,255,0.05)", padding: "4px 8px", borderRadius: "4px" }}><strong>{attr.name}</strong> {attr.level} <span style={{ opacity: 0.6, fontSize: "0.85em" }}>[{attr.points}]</span></li>;
                  })}
                </ul>
              </div>
            )}

            <div className="mechanics-split">
              {data.advantages && data.advantages.length > 0 && (
                <div className="mechanics-section">
                  <span className="eyebrow">Advantages</span>
                   <ul className="traits-list" style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
                    {parsedAdvantages.map((adv: any, idx: number) => {
                       if (typeof adv === 'string') return <li key={idx} style={{ width: "100%" }}><MendableString rawString={adv} targetType="Trait" field="advantages" idx={idx} data={data} onUpdate={onUpdate} /></li>;
                       return (
                         <li key={idx}>
                           <div style={{ display: "flex", justifyContent: "space-between" }}>
                             <span>{adv.name}</span>
                             <span style={{ opacity: 0.6 }}>[{adv.points}]</span>
                           </div>
                           {adv.notes && <div style={{ fontSize: "0.85em", opacity: 0.7 }}>{adv.notes}</div>}
                         </li>
                       );
                    })}
                  </ul>
                </div>
              )}
              
              {data.disadvantages && data.disadvantages.length > 0 && (
                <div className="mechanics-section">
                  <span className="eyebrow">Disadvantages</span>
                  <ul className="traits-list flaws" style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
                    {parsedDisadvantages.map((dis: any, idx: number) => {
                       if (typeof dis === 'string') return <li key={idx} style={{ width: "100%" }}><MendableString rawString={dis} targetType="Trait" field="disadvantages" idx={idx} data={data} onUpdate={onUpdate} /></li>;
                       return (
                         <li key={idx}>
                           <div style={{ display: "flex", justifyContent: "space-between" }}>
                             <span>{dis.name}</span>
                             <span style={{ opacity: 0.6 }}>[{dis.points}]</span>
                           </div>
                           {dis.notes && <div style={{ fontSize: "0.85em", opacity: 0.7 }}>{dis.notes}</div>}
                         </li>
                       );
                    })}
                  </ul>
                </div>
              )}
            </div>

            {data.skills && data.skills.length > 0 && (
              <div className="mechanics-section">
                <span className="eyebrow">Skills</span>
                <table className="skills-table" style={{ width: "100%", textAlign: "left", fontSize: "0.9em", borderCollapse: "collapse", marginTop: "8px" }}>
                  <thead style={{ borderBottom: "1px solid rgba(255,255,255,0.1)", opacity: 0.6 }}>
                    <tr><th style={{ paddingBottom: "4px" }}>Name</th><th>Base</th><th>Level</th><th style={{ textAlign: "right" }}>Pts</th></tr>
                  </thead>
                  <tbody>
                  {parsedSkills.map((skill: any, idx: number) => {
                    if (typeof skill === 'string') return <tr key={idx}><td colSpan={4}><MendableString rawString={skill} targetType="Skill" field="skills" idx={idx} data={data} onUpdate={onUpdate} /></td></tr>;
                    return (
                      <tr key={idx} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                        <td style={{ padding: "6px 0" }}>{skill.name} {skill.notes && <span style={{ opacity: 0.6 }}>({skill.notes})</span>}</td>
                        <td>{skill.base}</td>
                        <td>{skill.level}</td>
                        <td style={{ textAlign: "right", opacity: 0.6 }}>[{skill.points}]</td>
                      </tr>
                    );
                  })}
                  </tbody>
                </table>
              </div>
            )}
            
            {data.gear && data.gear.length > 0 && (
              <div className="mechanics-section">
                <span className="eyebrow">Gear & Weapons</span>
                <table className="gear-table" style={{ width: "100%", textAlign: "left", fontSize: "0.9em", borderCollapse: "collapse", marginTop: "8px" }}>
                  <thead style={{ borderBottom: "1px solid rgba(255,255,255,0.1)", opacity: 0.6 }}>
                    <tr><th style={{ paddingBottom: "4px" }}>Item</th><th>Qty</th><th>Weight</th><th>Cost</th></tr>
                  </thead>
                  <tbody>
                  {parsedGear.map((g: any, idx: number) => {
                    if (typeof g === 'string') return <tr key={idx}><td colSpan={4}><MendableString rawString={g} targetType="Gear" field="gear" idx={idx} data={data} onUpdate={onUpdate} /></td></tr>;
                    return (
                      <tr key={idx} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                        <td style={{ padding: "6px 0" }}>{g.name} {g.notes && <span style={{ opacity: 0.6 }}>({g.notes})</span>}</td>
                        <td>{g.quantity}</td>
                        <td>{g.weight}</td>
                        <td>{g.cost}</td>
                      </tr>
                    );
                  })}
                  </tbody>
                </table>
              </div>
            )}

            {data.variations && data.variations.length > 0 && (
              <div className="mechanics-section">
                <span className="eyebrow">Variations</span>
                <ul className="traits-list">
                  {data.variations.map((vari: string, idx: number) => <li key={idx}>{vari}</li>)}
                </ul>
              </div>
            )}
          </section>

          {data.tactics && (
            <section className="tactics-panel">
              <span className="eyebrow">Tactics & Combat Style</span>
              <div className="markdown-content">
                <ReactMarkdown>{data.tactics}</ReactMarkdown>
              </div>
            </section>
          )}

          {data.hitLocations && data.hitLocations.length > 0 && (
            <section className="tactics-panel" style={{ marginTop: "16px" }}>
              <span className="eyebrow">Hit Locations & DR</span>
              {typeof data.hitLocations === 'string' ? (
                 <div className="markdown-content"><ReactMarkdown>{data.hitLocations}</ReactMarkdown></div>
              ) : (
                <table style={{ width: "100%", textAlign: "left", fontSize: "0.9em", borderCollapse: "collapse", marginTop: "8px" }}>
                  <thead style={{ borderBottom: "1px solid rgba(255,255,255,0.1)", opacity: 0.6 }}>
                    <tr><th style={{ paddingBottom: "4px" }}>Roll</th><th>Location</th><th>DR</th><th>Notes</th></tr>
                  </thead>
                  <tbody>
                  {(() => {
                     let locs = [...(parsedHitLocations as any)];
                     locs.sort((a: any, b: any) => {
                         const getNum = (r: any) => {
                             if (!r || typeof r !== 'string') return 999;
                             const m = r.match(/\d+/);
                             return m ? parseInt(m[0], 10) : 999;
                         };
                         return getNum(a.roll) - getNum(b.roll);
                     });
                     return locs.map((loc: any, idx: number) => {
                       if (typeof loc === 'string') return <tr key={idx}><td colSpan={4}><MendableString rawString={loc} targetType="HitLocation" field="hitLocations" idx={idx} data={data} onUpdate={onUpdate} /></td></tr>;
                       return (
                         <tr key={idx} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                           <td style={{ padding: "6px 0", fontWeight: "bold" }}>{loc.roll}</td>
                           <td>{loc.location}</td>
                           <td>{loc.dr}</td>
                           <td style={{ opacity: 0.6 }}>{loc.notes}</td>
                         </tr>
                       );
                     });
                  })()}
                  </tbody>
                </table>
              )}
            </section>
          )}
        </main>
      </div>

      {data.pcHooks && (
         <footer className="passport-footer">
            <span className="eyebrow">Hooks</span>
            <div className="markdown-content">
              <ReactMarkdown>{data.pcHooks}</ReactMarkdown>
            </div>
         </footer>
      )}
    </div>
  );
}
