import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { CharacterJSON } from "../lib/types";
import { PointBudget } from "./PointBudget";
import { getMediaUrl, resolvePlacement, type ResolvedPlacement } from "../lib/api";
import { InternalLink } from "./InternalLink";
import { parseGear, parseHitLocation } from "../lib/TraitFormatters";
import { parseEntry, type Entry, type EntryKind } from "../lib/pointBuild";
import { qualifiedName } from "../lib/traitResolver";
import { TraitNote } from './TraitNote';
import { plainName } from '../lib/noteMarkup';


/**
 * A line the sheet cannot read, shown as written with the reason.
 *
 * There used to be an "AI Mend" button here, which asked a model to rewrite
 * the line as `Name [Points]` — so on a line the app had deliberately left
 * unpriced, it invented exactly the cost the app had declined to guess. A
 * line the app cannot read is now the GM's to settle, in the editor that
 * prices from the catalogue.
 */
function UnreadLine({ raw, reason, onEdit }: { raw: string; reason?: string; onEdit?: () => void }) {
   return (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", width: "100%", padding: "4px 8px", background: "rgba(245, 158, 11, 0.1)", borderLeft: "3px solid #f59e0b", margin: "4px 0", borderRadius: "0 4px 4px 0" }}>
         <span style={{ wordBreak: "break-word" }}>
            <span style={{ fontFamily: "monospace", opacity: 0.9, fontSize: "0.85em", color: "#fcd34d" }}>{raw}</span>
            {reason && <span style={{ display: "block", fontSize: "0.75em", opacity: 0.6 }}>{reason}</span>}
         </span>
         {onEdit && (
            <button onClick={onEdit} title="Open the editor to settle this line" style={{ background: "transparent", border: "1px solid #f59e0b", color: "#f59e0b", padding: "2px 8px", fontSize: "0.75rem", borderRadius: "4px", cursor: "pointer", flexShrink: 0 }}>
               Edit
            </button>
         )}
      </div>
   );
}

/**
 * Read a mechanical line with the parser the point total uses.
 *
 * The sheet used to read traits with a stricter parser that wanted the cost
 * last, so `Chronic Pain [-10] (Result of EOD accident)` — which the total
 * counts correctly — was shown as broken. One parser, one answer.
 */
function readLine(raw: unknown, kind: EntryKind): Entry | string {
  if (typeof raw !== "string") return String(raw);
  const entry = parseEntry(raw, kind);
  return entry.points === null ? raw : entry;
}

/** Why a line could not be read, in the GM's words. */
function unreadReason(raw: string, kind: EntryKind): string {
  if (/not priced:/.test(raw)) return "";  // it already says why
  return parseEntry(raw, kind).problem;
}

/** `(DX/E)-14` into its base and its level. */
function splitSkillLevel(level: string): { base: string; level: string } {
  const m = /^\(([^)]*)\)-(-?\d+)$/.exec(level);
  return m ? { base: m[1], level: m[2] } : { base: "", level };
}

type Props = {
  data: CharacterJSON;
  documentPath: string;
  onUpdate?: (newData: CharacterJSON) => void;
  onNavigate?: (target: string) => void;
  /** Opens the structured editor, where an unreadable line is settled. */
  onEdit?: () => void;
};

export function CharacterPassport({ data, documentPath, onNavigate, onEdit }: Props) {

  // Placement is resolved rather than stored -- a companion's location is
  // wherever the person they travel with is -- so it has to be asked for.
  const [placement, setPlacement] = useState<ResolvedPlacement | null>(null);
  useEffect(() => {
    let live = true;
    if (!data.name) return;
    resolvePlacement(data.name)
      .then(p => { if (live) setPlacement(p); })
      .catch(() => { if (live) setPlacement(null); });
    return () => { live = false; };
  }, [data.name]);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const images = data.images || [];
  const safeImageIdx = images.length > 0 && activeImageIdx < images.length ? activeImageIdx : 0;

  const parsedAttributes = (data.attributes || []).map(a => readLine(a, "attribute"));
  const parsedAdvantages = (data.advantages || []).map(a => readLine(a, "advantage"));
  const parsedDisadvantages = (data.disadvantages || []).map(d => readLine(d, "disadvantage"));
  const parsedSkills = (data.skills || []).map(s => readLine(s, "skill"));
  const parsedGear = (data.gear || []).map(parseGear);
  const parsedHitLocations = (typeof data.hitLocations === 'string') 
      ? data.hitLocations 
      : (data.hitLocations || []).map(parseHitLocation);



  return (
    <div className="character-passport">
      <header className="passport-header" style={{ paddingBottom: "16px", borderBottom: "none", alignItems: "center" }}>
        {data.concept ? (
          <div className="passport-title-area" style={{ flexGrow: 1 }}>
            <div style={{ fontSize: "1.35rem", color: "#c9dfff", fontStyle: "italic", letterSpacing: "1px", borderLeft: "3px solid rgba(149, 181, 255, 0.4)", paddingLeft: "16px", textTransform: "uppercase" }}>{data.concept}</div>
          </div>
        ) : <div style={{ flexGrow: 1 }} />}
        {/* "Flesh out with AI" used to sit here, wedged between the concept and
            the significance badges. It belongs on the document toolbar with
            Edit and Delete — see FileEditorPanel. */}
        <div className="passport-meta" style={{ display: "flex", gap: "16px" }}>
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
          <div className="meta-badge" title={placement?.chain?.length ? `Resolved through ${placement.chain.join(" → ")}` : undefined}>
            <span className="eyebrow">Where</span>
            <span className="value" style={placement && placement.status !== "placed" ? { color: "#79c0ff", opacity: 0.85 } : undefined}>
              {placement ? placement.description : "…"}
            </span>
          </div>
          <PointBudget data={data} />
        </div>
      </header>

      <div className="passport-grid">
        {/* LEFT COLUMN: Narrative & Identity */}
        <aside className="passport-sidebar">
          {images.length > 0 && (
            <div className="passport-gallery">
              <div className="gallery-main-image">
                 <img src={getMediaUrl(images[safeImageIdx], documentPath)} alt="Character Portrait" />
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
                  {parsedAttributes.map((attr, idx) => {
                     if (typeof attr === 'string') return <li key={idx} style={{ width: "100%" }}><UnreadLine raw={attr} reason={unreadReason(attr, "attribute")} onEdit={onEdit} /></li>;
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
                    {parsedAdvantages.map((adv, idx) => {
                       if (typeof adv === 'string') return <li key={idx} style={{ width: "100%" }}><UnreadLine raw={adv} reason={unreadReason(adv, "advantage")} onEdit={onEdit} /></li>;
                       return (
                         <li key={idx}>
                           <div style={{ display: "flex", justifyContent: "space-between" }}>
                             <span>{plainName(qualifiedName(adv.name, adv.specialty))}</span>
                             <span style={{ opacity: 0.6 }}>[{adv.points}]</span>
                           </div>
                           {adv.notes && <div style={{ fontSize: "0.85em", opacity: 0.7 }}><TraitNote note={adv.notes} /></div>}
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
                    {parsedDisadvantages.map((dis, idx) => {
                       if (typeof dis === 'string') return <li key={idx} style={{ width: "100%" }}><UnreadLine raw={dis} reason={unreadReason(dis, "disadvantage")} onEdit={onEdit} /></li>;
                       return (
                         <li key={idx}>
                           <div style={{ display: "flex", justifyContent: "space-between" }}>
                             <span>{plainName(qualifiedName(dis.name, dis.specialty))}</span>
                             <span style={{ opacity: 0.6 }}>[{dis.points}]</span>
                           </div>
                           {dis.notes && <div style={{ fontSize: "0.85em", opacity: 0.7 }}><TraitNote note={dis.notes} /></div>}
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
                  {parsedSkills.map((skill, idx) => {
                    if (typeof skill === 'string') return <tr key={idx}><td colSpan={4}><UnreadLine raw={skill} reason={unreadReason(skill, "skill")} onEdit={onEdit} /></td></tr>;
                    const { base, level } = splitSkillLevel(skill.level);
                    return (
                      <tr key={idx} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                        <td style={{ padding: "6px 0" }}>{qualifiedName(skill.name, skill.specialty)} {skill.notes && <span style={{ opacity: 0.6 }}>({skill.notes})</span>}</td>
                        <td>{base}</td>
                        <td>{level}</td>
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
                    if (typeof g === 'string') return <tr key={idx}><td colSpan={4}><UnreadLine raw={g} reason="not in the form Name [Qty] (Weight, Cost) - Notes" onEdit={onEdit} /></td></tr>;
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
                       if (typeof loc === 'string') return <tr key={idx}><td colSpan={4}><UnreadLine raw={loc} reason="not in the form Location (Roll): DR X - Notes" onEdit={onEdit} /></td></tr>;
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
