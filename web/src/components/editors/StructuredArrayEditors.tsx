import { useEffect, useRef, useState } from 'react';
import { render as renderEntry, wasPriced } from '../../lib/characterBuild';
import { ATTRIBUTE_COST, derive } from '../../lib/gurpsRules';
import { WorkspaceSelect } from './WorkspaceSelect';
import { parseAttribute, serializeAttribute, parseGear, serializeGear, parseHitLocation, serializeHitLocation } from '../../lib/TraitFormatters';


type ListProps = { title: string; items: string[]; onChange: (items: string[]) => void; };

function Field({ label, children, flex, hideLabel }: { label: string, children: React.ReactNode, flex?: string, hideLabel?: boolean }) {
    return <div className="editor-field" style={{ flex: flex || 1, opacity: hideLabel ? 0.6 : 1 }}><label className="editor-label" style={{ display: hideLabel ? "none" : "block" }}>{label}</label>{children}</div>;
}


/**
 * The rows a list editor is working on, held rather than re-read each render.
 *
 * Deriving them from the stored strings on every keystroke meant each
 * character typed was serialised onto a line and parsed straight back off it,
 * and every parser here trims. A space is trailing at the instant it is typed,
 * so it never survived to the next letter: "moves in shadow" arrived as
 * "movesinshadow", and no multi-word value could be typed into any of these
 * fields at all.
 *
 * The list still belongs to the document. Anything that changes it from
 * outside -- a save, a different sheet opened, an AI pass -- replaces what is
 * being held here.
 */
function useEditableRows<T>(
    items: string[],
    parse: (item: string) => T,
    serialize: (row: T) => string,
    onChange: (items: string[]) => void,
) {
    const [rows, setRows] = useState<T[]>(() => items.map(parse));
    const written = useRef<string[] | null>(null);

    useEffect(() => {
        const ours = written.current;
        if (ours && ours.length === items.length && ours.every((line, i) => line === items[i])) return;
        setRows(items.map(parse));
        written.current = null;
        // `parse` is a module function; only the incoming list can change.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [items]);

    const write = (next: T[]) => {
        setRows(next);
        const stored = next.map(serialize);
        written.current = stored;
        onChange(stored);
    };

    return [rows, write] as const;
}

/**
 * Why a stored line is shown as raw text rather than as fields.
 *
 * The box used to say only "Raw String (Unparsed)", which left the GM to
 * guess what the app wanted. A line that explains itself -- one the app wrote
 * as "not priced: ..." -- is left to do so.
 */
function UnreadHint({ raw, why }: { raw: string; why: string }) {
    if (/not priced:/.test(raw)) return null;
    return <div style={{ fontSize: "0.75rem", opacity: 0.6, marginTop: "4px" }}>{why}</div>;
}

const ATTRIBUTE_FORM = "not read as an attribute: expected Name Level [Points], e.g. Dodge 9 [0]";
const GEAR_FORM = "not read as gear: expected Name [Qty] (Weight, Cost) - Notes";
const LOCATION_FORM = "not read as a hit location: expected Location (Roll): DR X - Notes";

/**
 * What an attribute's score costs on this sheet, or null where the book does
 * not say (a score that is not a number, `N/A`). Secondaries are priced
 * against the attribute they come from (B18-19), so the primaries the editor
 * is showing are passed in.
 */
function attributePrice(name: string, level: string, core: Array<{ name: string; level: string }>): number | null {
    const score = Number(level);
    if (level.trim() === "" || !Number.isFinite(score)) return null;
    const scores: Record<string, number> = {};
    for (const c of core) {
        const n = Number(c.level);
        if (c.name in ATTRIBUTE_COST && Number.isFinite(n)) scores[c.name] = n;
    }
    const out = renderEntry({ kind: "attribute", name, score }, scores, null);
    return wasPriced(out) ? out.points : null;
}

/**
 * The score an attribute has when the sheet does not list it. Not 10 for all
 * of them: HP is ST, Will and Per are IQ, FP is HT, and Basic Speed and Move
 * come from DX and HT (B18-19). A sheet with ST 13 and no HP line has 13 HP.
 */
function defaultLevel(name: string, core: Array<{ name: string; level: string }>): string {
    const of = (n: string) => Number(core.find(c => c.name === n)?.level ?? 10);
    const d = derive({ ST: of("ST"), DX: of("DX"), IQ: of("IQ"), HT: of("HT") });
    const value: Record<string, number | null> = {
        HP: d.hp, Will: d.will, Per: d.per, FP: d.fp, "Basic Speed": d.basicSpeed, "Basic Move": d.basicMove,
    };
    const v = value[name];
    if (v === undefined || v === null) return "10";
    return name === "Basic Speed" ? v.toFixed(2) : String(v);
}

export function AttributeEditorList({ title, items = [], onChange }: ListProps) {
    const coreAttributes = ["ST", "DX", "IQ", "HT", "HP", "Will", "Per", "FP", "Basic Speed", "Basic Move"];
    const [parsed, writeRows] = useEditableRows(items, parseAttribute, serializeAttribute, onChange);

    const coreData: Array<{ name: string; level: string; points: string | number }> = [];
    for (const ca of coreAttributes) {
        const found = parsed.find(p => typeof p !== 'string' && p.name.toUpperCase() === ca.toUpperCase());
        coreData.push(found && typeof found !== 'string'
            ? { name: ca, level: found.level, points: found.points }
            // Primaries come first in the list, so a secondary's default is
            // worked out from the primaries already read.
            : { name: ca, level: defaultLevel(ca, coreData), points: 0 });
    }

    const extras = parsed.filter(p => {
        if (typeof p === 'string') return true;
        return !coreAttributes.some(ca => ca.toUpperCase() === p.name.toUpperCase());
    });

    const triggerChange = (newCore: any[], newExtras: any[]) => {
        const listed = (name: string) => parsed.some(p => typeof p !== 'string' && p.name.toUpperCase() === name.toUpperCase());
        // A secondary the sheet does not list is still at its derived value,
        // so it moves with the primaries -- raising DX on a blank stub must not
        // write Basic Speed and Move lines that nobody touched.
        const settled = newCore.map((ca, i) => !listed(ca.name)
            && String(ca.level) === defaultLevel(ca.name, coreData) && String(coreData[i].level) === String(ca.level)
            ? { ...ca, level: defaultLevel(ca.name, newCore) } : ca);
        const activeCore = settled.filter(ca => {
            const isChangedFromDefault = ca.level !== defaultLevel(ca.name, settled) || (ca.points !== 0 && ca.points !== "0");
            return listed(ca.name) || isChangedFromDefault;
        });
        writeRows([...activeCore, ...newExtras]);
    };

    // The score the GM changes takes the book's cost with it, while its cost
    // was the book's: DX 12 [40] typed to 13 becomes DX 13 [60]. A figure the
    // GM set is kept, and the book's is shown beside it. Other attributes are
    // never changed for them -- raising ST shows what HP now costs, with a
    // button, rather than rewriting the HP line.
    const updateCore = (idx: number, field: string, val: any) => {
        const before = coreData[idx];
        const newCore = [...coreData];
        newCore[idx] = { ...before, [field]: val };
        if (field === "level") {
            const was = attributePrice(before.name, String(before.level), coreData);
            const followed = String(before.points).trim() === "" || (was !== null && Number(before.points) === was);
            const now = attributePrice(before.name, String(val), newCore);
            if (followed && now !== null) newCore[idx] = { ...newCore[idx], points: now };
        }
        triggerChange(newCore, extras);
    };

    const updateExtra = (idx: number, val: string) => {
        const newExtras = [...extras];
        newExtras[idx] = val;
        triggerChange(coreData, newExtras);
    };

    const updateExtraField = (idx: number, field: string, val: string) => {
        const newExtras = [...extras];
        const row = newExtras[idx];
        if (typeof row === 'string') return;
        newExtras[idx] = { ...row, [field]: val };
        triggerChange(coreData, newExtras);
    };

    // Dodge, Parry and Block are not among the ten every sheet carries, but a
    // line like "Parry N/A [0]" is perfectly good. They used to be listed under
    // "Malformed" with everything the parser could not read, which told the GM
    // their sheet was broken when it was not.
    const otherRows = extras.map((ex, idx) => ({ ex, idx })).filter(({ ex }) => typeof ex !== 'string');
    const unreadRows = extras.map((ex, idx) => ({ ex, idx })).filter(({ ex }) => typeof ex === 'string');

    const deleteExtra = (idx: number) => {
        const newExtras = [...extras];
        newExtras.splice(idx, 1);
        triggerChange(coreData, newExtras);
    };

    return (
        <div className="editor-array-container">
            <h4 className="editor-label" style={{ margin: "0", color: "#a8c7fa" }}>{title}</h4>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "10px", marginTop: "12px" }}>
                {coreData.map((attr, idx) => {
                    const book = attributePrice(attr.name, String(attr.level), coreData);
                    const stated = String(attr.points).trim() === "" ? null : Number(attr.points);
                    const agrees = book !== null && stated === book;
                    return (
                    <div key={`core-${idx}`} style={{ display: "flex", flexDirection: "column", background: "rgba(255,255,255,0.03)", padding: "6px 10px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)", gap: "4px", transition: "transform 0.2s ease, background 0.2s ease" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div style={{ fontSize: "0.85rem", color: "#c9dfff", width: "85px", fontWeight: "600", textTransform: "uppercase" }}>{attr.name}</div>
                            <input className="editor-input" style={{ padding: "6px 8px", flex: 1, minWidth: 0 }} value={attr.level} onChange={e => updateCore(idx, 'level', e.target.value)} title="Level" aria-label={`${attr.name} score`} placeholder="Level" />
                            <input className="editor-input" style={{ padding: "6px 8px", width: "60px", color: agrees ? "#52d5ae" : undefined }} value={attr.points} onChange={e => updateCore(idx, 'points', e.target.value)} type="number" title={agrees ? "Worked out from the book" : "Points"} aria-label={`${attr.name} points`} placeholder="Pts" />
                        </div>
                        {book !== null && stated !== book && (
                            <div style={{ fontSize: "0.72rem", color: "#e3a952", display: "flex", gap: "8px", alignItems: "center" }}>
                                <span>the book gives {book} for {attr.name} {attr.level}</span>
                                <button type="button" className="editor-action-btn" style={{ fontSize: "0.7rem", padding: "1px 8px" }}
                                    onClick={() => updateCore(idx, 'points', book)}>Use {book}</button>
                            </div>
                        )}
                    </div>
                    );
                })}
            </div>
            {otherRows.length > 0 && (
                <div style={{ marginTop: "16px", borderTop: "1px dashed rgba(255,255,255,0.1)", paddingTop: "16px" }}>
                    <h5 className="editor-label" style={{ margin: "0 0 12px 0", color: "#a8c7fa" }}>Defences & Other</h5>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "10px" }}>
                        {otherRows.map(({ ex, idx }) => typeof ex !== 'string' && (
                            <div key={`other-${idx}`} style={{ display: "flex", alignItems: "center", background: "rgba(255,255,255,0.03)", padding: "6px 10px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)", gap: "8px" }}>
                                <input className="editor-input" style={{ padding: "6px 8px", width: "85px" }} value={ex.name} onChange={e => updateExtraField(idx, 'name', e.target.value)} title="Name" placeholder="Name" />
                                <input className="editor-input" style={{ padding: "6px 8px", flex: 1, minWidth: 0 }} value={ex.level} onChange={e => updateExtraField(idx, 'level', e.target.value)} title="Level" placeholder="Level" />
                                <input className="editor-input" style={{ padding: "6px 8px", width: "60px" }} value={ex.points} onChange={e => updateExtraField(idx, 'points', e.target.value)} type="number" title="Points" placeholder="Pts" />
                                <button type="button" onClick={() => deleteExtra(idx)} className="editor-action-btn danger">✕</button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {unreadRows.length > 0 && (
                <div style={{ marginTop: "16px", borderTop: "1px dashed rgba(255,255,255,0.1)", paddingTop: "16px" }}>
                    <h5 className="editor-label" style={{ margin: "0 0 12px 0", color: "#ff7b72" }}>Unrecognized / Malformed Attributes</h5>
                    {unreadRows.map(({ ex, idx }, row) => (
                        <div key={`extra-${idx}`} className="editor-array-item" style={{ alignItems: "flex-start" }}>
                            <Field label="Raw String" hideLabel={row > 0}><input className="editor-input" value={typeof ex === 'string' ? ex : serializeAttribute(ex)} onChange={e => updateExtra(idx, e.target.value)} /><UnreadHint raw={String(ex)} why={ATTRIBUTE_FORM} /></Field>
                            <button type="button" onClick={() => deleteExtra(idx)} className="editor-action-btn danger" style={{ marginTop: row > 0 ? "4px" : "26px" }}>✕</button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export function GearEditorList({ title, items = [], onChange }: ListProps) {
    const [parsed, write] = useEditableRows(items, parseGear, serializeGear, onChange);

    const updateItem = (idx: number, field: string, val: any) => {
        const newParsed = [...parsed];
        if (typeof newParsed[idx] === 'string') return;
        newParsed[idx] = { ...(newParsed[idx] as any), [field]: val };
        write(newParsed);
    };

    const updateRaw = (idx: number, val: string) => {
        const newParsed = [...parsed];
        newParsed[idx] = val;
        write(newParsed);
    };

    const deleteItem = (idx: number) => {
        const newParsed = [...parsed];
        newParsed.splice(idx, 1);
        write(newParsed);
    };

    const moveItem = (idx: number, direction: -1 | 1) => {
        if (idx + direction < 0 || idx + direction >= parsed.length) return;
        const newParsed = [...parsed];
        const temp = newParsed[idx];
        newParsed[idx] = newParsed[idx + direction];
        newParsed[idx + direction] = temp;
        write(newParsed);
    };

    const addItem = () => {
        write([...parsed, " (0, 0)"]);
    };

    return (
        <div className="editor-array-container">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="editor-label" style={{ color: "#a8c7fa" }}>{title}</span>
                <button type="button" className="editor-add-btn" onClick={addItem}>+ Add Gear</button>
            </div>
            {parsed.map((gear, idx) => {
                if (typeof gear === 'string') {
                    return (
                        <div key={idx} className="editor-array-item" style={{ alignItems: "flex-start", display: "flex", gap: "8px" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: idx > 0 ? "4px" : "26px" }}>
                                <button type="button" onClick={() => moveItem(idx, -1)} style={{ background: "none", border: "none", color: "white", cursor: idx === 0 ? "default" : "pointer", opacity: idx === 0 ? 0.2 : 0.7, padding: "0 4px" }}>▲</button>
                                <button type="button" onClick={() => moveItem(idx, 1)} style={{ background: "none", border: "none", color: "white", cursor: idx === parsed.length - 1 ? "default" : "pointer", opacity: idx === parsed.length - 1 ? 0.2 : 0.7, padding: "0 4px" }}>▼</button>
                            </div>
                            <div style={{ flex: 1 }}>
                                <Field label="Raw String (Unparsed)" hideLabel={idx > 0}><input className="editor-input" value={gear} onChange={e => updateRaw(idx, e.target.value)} /><UnreadHint raw={gear} why={GEAR_FORM} /></Field>
                            </div>
                            <button type="button" onClick={() => deleteItem(idx)} className="editor-action-btn danger" style={{ marginTop: idx > 0 ? "4px" : "26px" }}>✕</button>
                        </div>
                    );
                }
                return (
                    <div key={idx} className="editor-array-item" style={{ display: "flex", alignItems: "flex-start", padding: "8px", gap: "8px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px", paddingTop: "4px" }}>
                            <button type="button" onClick={() => moveItem(idx, -1)} style={{ background: "none", border: "none", color: "white", cursor: idx === 0 ? "default" : "pointer", opacity: idx === 0 ? 0.2 : 0.7, padding: "0 4px" }}>▲</button>
                            <button type="button" onClick={() => moveItem(idx, 1)} style={{ background: "none", border: "none", color: "white", cursor: idx === parsed.length - 1 ? "default" : "pointer", opacity: idx === parsed.length - 1 ? 0.2 : 0.7, padding: "0 4px" }}>▼</button>
                        </div>
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
                        <div style={{ display: "flex", gap: "8px", width: "100%", alignItems: "center" }}>
                            <input className="editor-input" style={{ flex: 3 }} placeholder="Gear Name" value={gear.name} onChange={e => updateItem(idx, 'name', e.target.value)} />
                            <input className="editor-input" style={{ width: "60px" }} placeholder="Qty" value={gear.quantity} onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)} type="number" />
                            <input className="editor-input" style={{ width: "80px" }} placeholder="Wt" value={gear.weight} onChange={e => updateItem(idx, 'weight', e.target.value)} />
                            <input className="editor-input" style={{ width: "80px" }} placeholder="Cost" value={gear.cost} onChange={e => updateItem(idx, 'cost', e.target.value)} />
                            <button type="button" onClick={() => deleteItem(idx)} className="editor-action-btn danger">✕</button>
                        </div>
                        <div style={{ display: "flex", gap: "8px", width: "100%", paddingRight: "36px" }}>
                            <input className="editor-input" style={{ flex: 1 }} placeholder="Notes (e.g., sw+1 cut)" value={gear.notes} onChange={e => updateItem(idx, 'notes', e.target.value)} />
                        </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export function HitLocationEditorList({ title, items = [], onChange }: ListProps) {
    const [parsed, write] = useEditableRows(items, parseHitLocation, serializeHitLocation, onChange);

    const updateItem = (idx: number, field: string, val: any) => {
        const newParsed = [...parsed];
        if (typeof newParsed[idx] === 'string') return;
        newParsed[idx] = { ...(newParsed[idx] as any), [field]: val };
        write(newParsed);
    };

    const updateRaw = (idx: number, val: string) => {
        const newParsed = [...parsed];
        newParsed[idx] = val;
        write(newParsed);
    };

    const deleteItem = (idx: number) => {
        const newParsed = [...parsed];
        newParsed.splice(idx, 1);
        write(newParsed);
    };

    const moveItem = (idx: number, direction: -1 | 1) => {
        if (idx + direction < 0 || idx + direction >= parsed.length) return;
        const newParsed = [...parsed];
        const temp = newParsed[idx];
        newParsed[idx] = newParsed[idx + direction];
        newParsed[idx + direction] = temp;
        write(newParsed);
    };

    const addItem = () => {
        write([...parsed, " (): DR 0"]);
    };

    return (
        <div className="editor-array-container">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="editor-label" style={{ color: "#a8c7fa" }}>{title}</span>
                <button type="button" className="editor-add-btn" onClick={addItem}>+ Add Location</button>
            </div>
            {parsed.map((loc, idx) => {
                if (typeof loc === 'string') {
                    return (
                        <div key={idx} className="editor-array-item" style={{ alignItems: "flex-start", display: "flex", gap: "8px" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: idx > 0 ? "4px" : "26px" }}>
                                <button type="button" onClick={() => moveItem(idx, -1)} style={{ background: "none", border: "none", color: "white", cursor: idx === 0 ? "default" : "pointer", opacity: idx === 0 ? 0.2 : 0.7, padding: "0 4px" }}>▲</button>
                                <button type="button" onClick={() => moveItem(idx, 1)} style={{ background: "none", border: "none", color: "white", cursor: idx === parsed.length - 1 ? "default" : "pointer", opacity: idx === parsed.length - 1 ? 0.2 : 0.7, padding: "0 4px" }}>▼</button>
                            </div>
                            <div style={{ flex: 1 }}>
                                <Field label="Raw String (Unparsed)" hideLabel={idx > 0}><input className="editor-input" value={loc} onChange={e => updateRaw(idx, e.target.value)} /><UnreadHint raw={loc} why={LOCATION_FORM} /></Field>
                            </div>
                            <button type="button" onClick={() => deleteItem(idx)} className="editor-action-btn danger" style={{ marginTop: idx > 0 ? "4px" : "26px" }}>✕</button>
                        </div>
                    );
                }
                return (
                    <div key={idx} className="editor-array-item" style={{ display: "flex", alignItems: "flex-start", padding: "8px", gap: "8px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px", paddingTop: "4px" }}>
                            <button type="button" onClick={() => moveItem(idx, -1)} style={{ background: "none", border: "none", color: "white", cursor: idx === 0 ? "default" : "pointer", opacity: idx === 0 ? 0.2 : 0.7, padding: "0 4px" }}>▲</button>
                            <button type="button" onClick={() => moveItem(idx, 1)} style={{ background: "none", border: "none", color: "white", cursor: idx === parsed.length - 1 ? "default" : "pointer", opacity: idx === parsed.length - 1 ? 0.2 : 0.7, padding: "0 4px" }}>▼</button>
                        </div>
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
                        <div style={{ display: "flex", gap: "8px", width: "100%", alignItems: "center" }}>
                            <input className="editor-input" style={{ flex: 2 }} placeholder="Location" value={loc.location} onChange={e => updateItem(idx, 'location', e.target.value)} />
                            <input className="editor-input" style={{ flex: 1 }} placeholder="Roll" value={loc.roll} onChange={e => updateItem(idx, 'roll', e.target.value)} />
                            <input className="editor-input" style={{ width: "80px" }} placeholder="DR" value={loc.dr} onChange={e => updateItem(idx, 'dr', e.target.value)} type="number" />
                            <button type="button" onClick={() => deleteItem(idx)} className="editor-action-btn danger">✕</button>
                        </div>
                        <div style={{ display: "flex", gap: "8px", width: "100%", paddingRight: "36px" }}>
                            <input className="editor-input" style={{ flex: 1 }} placeholder="Notes" value={loc.notes} onChange={e => updateItem(idx, 'notes', e.target.value)} />
                        </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

import { createBatchStubs } from '../../lib/api';
import { entityExists } from '../../lib/entityResolution';
import { useCampaignStore } from '../../stores/useCampaignStore';

type EntityRelationListProps = { 
    title: string; 
    items: any[]; 
    onChange: (items: any[]) => void; 
    targetCategory: "Character" | "Location" | "Story" | "Faction" | "All";
};
export function EntityRelationEditorList({ title, items = [], onChange, targetCategory }: EntityRelationListProps) {
    const registry = useCampaignStore(s => s.entityRegistry);
    const refreshCampaignArtifacts = useCampaignStore(s => s.refreshCampaignArtifacts);
    const [isGeneratingStubs, setIsGeneratingStubs] = useState(false);

    const handleAdd = () => {
        onChange([...items, { name: "", relation: "" }]);
    };
    const deleteItem = (index: number) => {
        onChange(items.filter((_, i) => i !== index));
    };
    const updateItem = (index: number, field: string, value: string) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        onChange(newItems);
    };

    const moveItem = (index: number, direction: -1 | 1) => {
        if (index + direction < 0 || index + direction >= items.length) return;
        const newItems = [...items];
        const temp = newItems[index];
        newItems[index] = newItems[index + direction];
        newItems[index + direction] = temp;
        onChange(newItems);
    };

    const missingStubs = items.filter(item => item.name && !entityExists(registry, item.name));

    const handleGenerateStubs = async () => {
        if (missingStubs.length === 0) return;
        setIsGeneratingStubs(true);
        try {
            const stubsToCreate = missingStubs.map(item => ({
                name: item.name,
                type: targetCategory === "All" ? "Character" : targetCategory
            }));
            await createBatchStubs(stubsToCreate);
            await refreshCampaignArtifacts();
        } catch (e) {
            console.error(e);
            alert("Failed to generate stubs");
        } finally {
            setIsGeneratingStubs(false);
        }
    };

    return (
        <div className="editor-array-container">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    <span className="editor-label" style={{ color: "#a8c7fa" }}>{title}</span>
                    {missingStubs.length > 0 && (
                        <button 
                            type="button" 
                            onClick={handleGenerateStubs} 
                            disabled={isGeneratingStubs}
                            style={{ 
                                background: "#4a3311", 
                                border: "1px solid #c27d0a", 
                                color: "#ffb44d", 
                                borderRadius: "4px", 
                                padding: "2px 8px", 
                                fontSize: "0.75rem", 
                                cursor: isGeneratingStubs ? "not-allowed" : "pointer" 
                            }}>
                            {isGeneratingStubs ? "Generating..." : `Generate Missing Stubs (${missingStubs.length})`}
                        </button>
                    )}
                </div>
                <button type="button" className="editor-add-btn" onClick={handleAdd}>+ Add {targetCategory}</button>
            </div>
            {items.length === 0 && <p style={{ fontSize: "0.85em", opacity: 0.5, fontStyle: "italic", margin: 0 }}>No items.</p>}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {items.map((item, i) => {
                    const isMissing = item.name && !entityExists(registry, item.name);
                    return (
                    <div key={i} className="editor-array-item" style={{ display: "flex", gap: "8px", alignItems: "center", padding: "8px", borderLeft: isMissing ? "3px solid #ffb44d" : "none" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            <button type="button" onClick={() => moveItem(i, -1)} style={{ background: "none", border: "none", color: "white", cursor: i === 0 ? "default" : "pointer", opacity: i === 0 ? 0.2 : 0.7, padding: "0 4px" }}>▲</button>
                            <button type="button" onClick={() => moveItem(i, 1)} style={{ background: "none", border: "none", color: "white", cursor: i === items.length - 1 ? "default" : "pointer", opacity: i === items.length - 1 ? 0.2 : 0.7, padding: "0 4px" }}>▼</button>
                        </div>
                        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                                <WorkspaceSelect
                                    value={item.name}
                                    onChange={name => updateItem(i, "name", name)}
                                    category={targetCategory}
                                    placeholder={`Select ${targetCategory}...`}
                                    style={{ flex: 1, margin: 0, padding: "6px 8px", borderRadius: "6px", border: "1px solid rgba(149,181,255,0.2)", background: "rgba(8,15,30,0.6)", color: "white", fontSize: "0.95rem" }}
                                />
                                {isMissing && <span style={{ color: "#ffb44d", fontSize: "0.75rem", fontWeight: "bold", paddingRight: "4px" }}>PROPOSED</span>}
                            </div>
                        </div>
                        <input
                            className="editor-input"
                            style={{ flex: 1, padding: "6px 8px" }}
                            placeholder="Relationship / Description"
                            value={item.relation || item.relationship || ""}
                            onChange={e => updateItem(i, "relation", e.target.value)}
                        />
                        <button type="button" onClick={() => deleteItem(i)} className="editor-action-btn danger">✕</button>
                    </div>
                )})}
            </div>
        </div>
    );
}

type EntityLinkListProps = {
    title: string;
    items: string[];
    onChange: (items: string[]) => void;
    targetCategory: "Character" | "Location" | "Story" | "Faction" | "All";
};
export function EntityLinkListEditor({ title, items = [], onChange, targetCategory }: EntityLinkListProps) {
    const registry = useCampaignStore(s => s.entityRegistry);
    const refreshCampaignArtifacts = useCampaignStore(s => s.refreshCampaignArtifacts);
    const [isGeneratingStubs, setIsGeneratingStubs] = useState(false);

    const handleAdd = () => {
        onChange([...items, ""]);
    };
    const deleteItem = (index: number) => {
        onChange(items.filter((_, i) => i !== index));
    };
    const updateItem = (index: number, value: string) => {
        const newItems = [...items];
        newItems[index] = value;
        onChange(newItems);
    };

    const moveItem = (index: number, direction: -1 | 1) => {
        if (index + direction < 0 || index + direction >= items.length) return;
        const newItems = [...items];
        const temp = newItems[index];
        newItems[index] = newItems[index + direction];
        newItems[index + direction] = temp;
        onChange(newItems);
    };

    const missingStubs = items.filter(item => item && !entityExists(registry, item));

    const handleGenerateStubs = async () => {
        if (missingStubs.length === 0) return;
        setIsGeneratingStubs(true);
        try {
            const stubsToCreate = missingStubs.map(item => ({
                name: item,
                type: targetCategory === "All" ? "Character" : targetCategory
            }));
            await createBatchStubs(stubsToCreate);
            await refreshCampaignArtifacts();
        } catch (e) {
            console.error(e);
            alert("Failed to generate stubs");
        } finally {
            setIsGeneratingStubs(false);
        }
    };

    return (
        <div className="editor-array-container">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    <span className="editor-label" style={{ color: "#a8c7fa" }}>{title}</span>
                    {missingStubs.length > 0 && (
                        <button
                            type="button"
                            onClick={handleGenerateStubs}
                            disabled={isGeneratingStubs}
                            style={{
                                background: "#4a3311",
                                border: "1px solid #c27d0a",
                                color: "#ffb44d",
                                borderRadius: "4px",
                                padding: "2px 8px",
                                fontSize: "0.75rem",
                                cursor: isGeneratingStubs ? "not-allowed" : "pointer"
                            }}>
                            {isGeneratingStubs ? "Generating..." : `Generate Missing Stubs (${missingStubs.length})`}
                        </button>
                    )}
                </div>
                <button type="button" className="editor-add-btn" onClick={handleAdd}>+ Add {targetCategory}</button>
            </div>
            {items.length === 0 && <p style={{ fontSize: "0.85em", opacity: 0.5, fontStyle: "italic", margin: 0 }}>No items.</p>}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {items.map((item, i) => {
                    const isMissing = item && !entityExists(registry, item);
                    return (
                    <div key={i} className="editor-array-item" style={{ display: "flex", gap: "8px", alignItems: "center", padding: "8px", borderLeft: isMissing ? "3px solid #ffb44d" : "none" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            <button type="button" onClick={() => moveItem(i, -1)} style={{ background: "none", border: "none", color: "white", cursor: i === 0 ? "default" : "pointer", opacity: i === 0 ? 0.2 : 0.7, padding: "0 4px" }}>▲</button>
                            <button type="button" onClick={() => moveItem(i, 1)} style={{ background: "none", border: "none", color: "white", cursor: i === items.length - 1 ? "default" : "pointer", opacity: i === items.length - 1 ? 0.2 : 0.7, padding: "0 4px" }}>▼</button>
                        </div>
                        <div style={{ flex: 1, display: "flex", gap: "6px", alignItems: "center" }}>
                            <WorkspaceSelect
                                value={item}
                                onChange={name => updateItem(i, name)}
                                category={targetCategory}
                                placeholder={`Select ${targetCategory}...`}
                                style={{ flex: 1, margin: 0, padding: "6px 8px", borderRadius: "6px", border: "1px solid rgba(149,181,255,0.2)", background: "rgba(8,15,30,0.6)", color: "white", fontSize: "0.95rem" }}
                            />
                            {isMissing && <span style={{ color: "#ffb44d", fontSize: "0.75rem", fontWeight: "bold", paddingRight: "4px" }}>PROPOSED</span>}
                        </div>
                        <button type="button" onClick={() => deleteItem(i)} className="editor-action-btn danger">✕</button>
                    </div>
                )})}
            </div>
        </div>
    );
}
