import { WorkspaceSelect } from './WorkspaceSelect';
import { parseAttribute, serializeAttribute, parseTrait, serializeTrait, parseSkill, serializeSkill, parseGear, serializeGear, parseHitLocation, serializeHitLocation } from '../../lib/TraitFormatters';


type ListProps = { title: string; items: string[]; onChange: (items: string[]) => void; };

function Field({ label, children, flex, hideLabel }: { label: string, children: React.ReactNode, flex?: string, hideLabel?: boolean }) {
    return <div className="editor-field" style={{ flex: flex || 1, opacity: hideLabel ? 0.6 : 1 }}><label className="editor-label" style={{ display: hideLabel ? "none" : "block" }}>{label}</label>{children}</div>;
}

export function AttributeEditorList({ title, items = [], onChange }: ListProps) {
    const coreAttributes = ["ST", "DX", "IQ", "HT", "HP", "Will", "Per", "FP", "Basic Speed", "Basic Move"];
    let parsed = items.map(parseAttribute);
    
    const coreData = coreAttributes.map(ca => {
        const found = parsed.find(p => typeof p !== 'string' && p.name.toUpperCase() === ca.toUpperCase());
        if (found && typeof found !== 'string') {
            return { name: ca, level: found.level, points: found.points };
        }
        return { name: ca, level: "10", points: 0 };
    });

    const extras = parsed.filter(p => {
        if (typeof p === 'string') return true;
        return !coreAttributes.some(ca => ca.toUpperCase() === p.name.toUpperCase());
    });

    const triggerChange = (newCore: any[], newExtras: any[]) => {
        const activeCore = newCore.filter(ca => {
            const wasPresent = parsed.some(p => typeof p !== 'string' && p.name.toUpperCase() === ca.name.toUpperCase());
            const isChangedFromDefault = ca.level !== "10" || (ca.points !== 0 && ca.points !== "0");
            return wasPresent || isChangedFromDefault;
        });
        const newItems = [
            ...activeCore.map(serializeAttribute),
            ...newExtras.map(serializeAttribute)
        ];
        onChange(newItems);
    };

    const updateCore = (idx: number, field: string, val: any) => {
        const newCore = [...coreData];
        newCore[idx] = { ...newCore[idx], [field]: val };
        triggerChange(newCore, extras);
    };

    const updateExtra = (idx: number, val: string) => {
        const newExtras = [...extras];
        newExtras[idx] = val;
        triggerChange(coreData, newExtras);
    };

    const deleteExtra = (idx: number) => {
        const newExtras = [...extras];
        newExtras.splice(idx, 1);
        triggerChange(coreData, newExtras);
    };

    return (
        <div className="editor-array-container">
            <h4 className="editor-label" style={{ margin: "0", color: "#a8c7fa" }}>{title}</h4>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "10px", marginTop: "12px" }}>
                {coreData.map((attr, idx) => (
                    <div key={`core-${idx}`} style={{ display: "flex", alignItems: "center", background: "rgba(255,255,255,0.03)", padding: "6px 10px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)", gap: "8px", transition: "transform 0.2s ease, background 0.2s ease" }}>
                        <div style={{ fontSize: "0.85rem", color: "#c9dfff", width: "85px", fontWeight: "600", textTransform: "uppercase" }}>{attr.name}</div>
                        <input className="editor-input" style={{ padding: "6px 8px", flex: 1, minWidth: 0 }} value={attr.level} onChange={e => updateCore(idx, 'level', e.target.value)} title="Level" placeholder="Level" />
                        <input className="editor-input" style={{ padding: "6px 8px", width: "60px" }} value={attr.points} onChange={e => updateCore(idx, 'points', e.target.value)} type="number" title="Points" placeholder="Pts" />
                    </div>
                ))}
            </div>
            {extras.length > 0 && (
                <div style={{ marginTop: "16px", borderTop: "1px dashed rgba(255,255,255,0.1)", paddingTop: "16px" }}>
                    <h5 className="editor-label" style={{ margin: "0 0 12px 0", color: "#ff7b72" }}>Unrecognized / Malformed Attributes</h5>
                    {extras.map((ex, idx) => (
                        <div key={`extra-${idx}`} className="editor-array-item" style={{ alignItems: "flex-start" }}>
                            <Field label="Raw String" hideLabel={idx > 0}><input className="editor-input" value={typeof ex === 'string' ? ex : serializeAttribute(ex)} onChange={e => updateExtra(idx, e.target.value)} /></Field>
                            <button type="button" onClick={() => deleteExtra(idx)} className="editor-action-btn danger" style={{ marginTop: idx > 0 ? "4px" : "26px" }}>✕</button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export function TraitEditorList({ title, items = [], onChange }: ListProps) {
    let parsed = items.map(parseTrait);

    const updateItem = (idx: number, field: string, val: any) => {
        const newParsed = [...parsed];
        if (typeof newParsed[idx] === 'string') return;
        newParsed[idx] = { ...(newParsed[idx] as any), [field]: val };
        onChange(newParsed.map(serializeTrait));
    };

    const updateRaw = (idx: number, val: string) => {
        const newParsed = [...parsed];
        newParsed[idx] = val;
        onChange(newParsed.map(serializeTrait));
    };

    const deleteItem = (idx: number) => {
        const newParsed = [...parsed];
        newParsed.splice(idx, 1);
        onChange(newParsed.map(serializeTrait));
    };

    const moveItem = (idx: number, direction: -1 | 1) => {
        if (idx + direction < 0 || idx + direction >= parsed.length) return;
        const newParsed = [...parsed];
        const temp = newParsed[idx];
        newParsed[idx] = newParsed[idx + direction];
        newParsed[idx + direction] = temp;
        onChange(newParsed.map(serializeTrait));
    };

    const addItem = () => {
        onChange([...parsed.map(serializeTrait), " [0]"]);
    };

    return (
        <div className="editor-array-container">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="editor-label" style={{ color: "#a8c7fa" }}>{title}</span>
                <button type="button" className="editor-add-btn" onClick={addItem}>+ Add Trait</button>
            </div>
            {parsed.map((trait, idx) => {
                if (typeof trait === 'string') {
                    return (
                        <div key={idx} className="editor-array-item" style={{ alignItems: "flex-start", display: "flex", gap: "8px" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: idx > 0 ? "4px" : "26px" }}>
                                <button type="button" onClick={() => moveItem(idx, -1)} style={{ background: "none", border: "none", color: "white", cursor: idx === 0 ? "default" : "pointer", opacity: idx === 0 ? 0.2 : 0.7, padding: "0 4px" }}>▲</button>
                                <button type="button" onClick={() => moveItem(idx, 1)} style={{ background: "none", border: "none", color: "white", cursor: idx === parsed.length - 1 ? "default" : "pointer", opacity: idx === parsed.length - 1 ? 0.2 : 0.7, padding: "0 4px" }}>▼</button>
                            </div>
                            <div style={{ flex: 1 }}>
                                <Field label="Raw String (Unparsed)" hideLabel={idx > 0}><input className="editor-input" value={trait} onChange={e => updateRaw(idx, e.target.value)} /></Field>
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
                            <input className="editor-input" style={{ flex: 3 }} placeholder="Trait Name" value={trait.name} onChange={e => updateItem(idx, 'name', e.target.value)} />
                            <input className="editor-input" style={{ width: "80px" }} placeholder="Pts" value={trait.points} onChange={e => updateItem(idx, 'points', e.target.value)} type="number" />
                            <button type="button" onClick={() => deleteItem(idx)} className="editor-action-btn danger">✕</button>
                        </div>
                        <div style={{ display: "flex", gap: "8px", width: "100%", paddingRight: "36px" }}>
                            <input className="editor-input" style={{ flex: 3 }} placeholder="Notes" value={trait.notes} onChange={e => updateItem(idx, 'notes', e.target.value)} />
                            <input className="editor-input" style={{ flex: 1 }} placeholder="Ref (e.g., B42)" value={trait.reference} onChange={e => updateItem(idx, 'reference', e.target.value)} />
                        </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export function SkillEditorList({ title, items = [], onChange }: ListProps) {
    let parsed = items.map(parseSkill);

    const updateItem = (idx: number, field: string, val: any) => {
        const newParsed = [...parsed];
        if (typeof newParsed[idx] === 'string') return;
        newParsed[idx] = { ...(newParsed[idx] as any), [field]: val };
        onChange(newParsed.map(serializeSkill));
    };

    const updateRaw = (idx: number, val: string) => {
        const newParsed = [...parsed];
        newParsed[idx] = val;
        onChange(newParsed.map(serializeSkill));
    };

    const deleteItem = (idx: number) => {
        const newParsed = [...parsed];
        newParsed.splice(idx, 1);
        onChange(newParsed.map(serializeSkill));
    };

    const moveItem = (idx: number, direction: -1 | 1) => {
        if (idx + direction < 0 || idx + direction >= parsed.length) return;
        const newParsed = [...parsed];
        const temp = newParsed[idx];
        newParsed[idx] = newParsed[idx + direction];
        newParsed[idx + direction] = temp;
        onChange(newParsed.map(serializeSkill));
    };

    const addItem = () => {
        onChange([...parsed.map(serializeSkill), " ()-0 [0]"]);
    };

    return (
        <div className="editor-array-container">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="editor-label" style={{ color: "#a8c7fa" }}>{title}</span>
                <button type="button" className="editor-add-btn" onClick={addItem}>+ Add Skill</button>
            </div>
            {parsed.map((skill, idx) => {
                if (typeof skill === 'string') {
                    return (
                        <div key={idx} className="editor-array-item" style={{ alignItems: "flex-start", display: "flex", gap: "8px" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: idx > 0 ? "4px" : "26px" }}>
                                <button type="button" onClick={() => moveItem(idx, -1)} style={{ background: "none", border: "none", color: "white", cursor: idx === 0 ? "default" : "pointer", opacity: idx === 0 ? 0.2 : 0.7, padding: "0 4px" }}>▲</button>
                                <button type="button" onClick={() => moveItem(idx, 1)} style={{ background: "none", border: "none", color: "white", cursor: idx === parsed.length - 1 ? "default" : "pointer", opacity: idx === parsed.length - 1 ? 0.2 : 0.7, padding: "0 4px" }}>▼</button>
                            </div>
                            <div style={{ flex: 1 }}>
                                <Field label="Raw String (Unparsed)" hideLabel={idx > 0}><input className="editor-input" value={skill} onChange={e => updateRaw(idx, e.target.value)} /></Field>
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
                            <input className="editor-input" style={{ flex: 3 }} placeholder="Skill Name" value={skill.name} onChange={e => updateItem(idx, 'name', e.target.value)} />
                            <input className="editor-input" style={{ width: "60px" }} placeholder="Base" value={skill.base} onChange={e => updateItem(idx, 'base', e.target.value)} />
                            <input className="editor-input" style={{ width: "60px" }} placeholder="Lvl" value={skill.level} onChange={e => updateItem(idx, 'level', e.target.value)} type="number" />
                            <input className="editor-input" style={{ width: "60px" }} placeholder="Pts" value={skill.points} onChange={e => updateItem(idx, 'points', e.target.value)} type="number" />
                            <button type="button" onClick={() => deleteItem(idx)} className="editor-action-btn danger">✕</button>
                        </div>
                        <div style={{ display: "flex", gap: "8px", width: "100%", paddingRight: "36px" }}>
                            <input className="editor-input" style={{ flex: 1 }} placeholder="Notes" value={skill.notes} onChange={e => updateItem(idx, 'notes', e.target.value)} />
                        </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export function GearEditorList({ title, items = [], onChange }: ListProps) {
    let parsed = items.map(parseGear);

    const updateItem = (idx: number, field: string, val: any) => {
        const newParsed = [...parsed];
        if (typeof newParsed[idx] === 'string') return;
        newParsed[idx] = { ...(newParsed[idx] as any), [field]: val };
        onChange(newParsed.map(serializeGear));
    };

    const updateRaw = (idx: number, val: string) => {
        const newParsed = [...parsed];
        newParsed[idx] = val;
        onChange(newParsed.map(serializeGear));
    };

    const deleteItem = (idx: number) => {
        const newParsed = [...parsed];
        newParsed.splice(idx, 1);
        onChange(newParsed.map(serializeGear));
    };

    const moveItem = (idx: number, direction: -1 | 1) => {
        if (idx + direction < 0 || idx + direction >= parsed.length) return;
        const newParsed = [...parsed];
        const temp = newParsed[idx];
        newParsed[idx] = newParsed[idx + direction];
        newParsed[idx + direction] = temp;
        onChange(newParsed.map(serializeGear));
    };

    const addItem = () => {
        onChange([...parsed.map(serializeGear), " (0, 0)"]);
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
                                <Field label="Raw String (Unparsed)" hideLabel={idx > 0}><input className="editor-input" value={gear} onChange={e => updateRaw(idx, e.target.value)} /></Field>
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
    let parsed = items.map(parseHitLocation);

    const updateItem = (idx: number, field: string, val: any) => {
        const newParsed = [...parsed];
        if (typeof newParsed[idx] === 'string') return;
        newParsed[idx] = { ...(newParsed[idx] as any), [field]: val };
        onChange(newParsed.map(serializeHitLocation));
    };

    const updateRaw = (idx: number, val: string) => {
        const newParsed = [...parsed];
        newParsed[idx] = val;
        onChange(newParsed.map(serializeHitLocation));
    };

    const deleteItem = (idx: number) => {
        const newParsed = [...parsed];
        newParsed.splice(idx, 1);
        onChange(newParsed.map(serializeHitLocation));
    };

    const moveItem = (idx: number, direction: -1 | 1) => {
        if (idx + direction < 0 || idx + direction >= parsed.length) return;
        const newParsed = [...parsed];
        const temp = newParsed[idx];
        newParsed[idx] = newParsed[idx + direction];
        newParsed[idx + direction] = temp;
        onChange(newParsed.map(serializeHitLocation));
    };

    const addItem = () => {
        onChange([...parsed.map(serializeHitLocation), " (): DR 0"]);
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
                                <Field label="Raw String (Unparsed)" hideLabel={idx > 0}><input className="editor-input" value={loc} onChange={e => updateRaw(idx, e.target.value)} /></Field>
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

import { useState } from 'react';
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
