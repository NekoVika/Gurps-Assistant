import { WorkspaceSelect } from './WorkspaceSelect';
import { parseAttribute, serializeAttribute, parseTrait, serializeTrait, parseSkill, serializeSkill, parseGear, serializeGear, parseHitLocation, serializeHitLocation } from '../../lib/TraitFormatters';


type ListProps = { title: string; items: string[]; onChange: (items: string[]) => void; };

function Field({ label, children, flex, hideLabel }: { label: string, children: React.ReactNode, flex?: string, hideLabel?: boolean }) {
    return <div className="editor-field" style={{ flex: flex || 1, opacity: hideLabel ? 0.6 : 1 }}><label className="editor-label" style={{ display: hideLabel ? "none" : "block" }}>{label}</label>{children}</div>;
}

export function AttributeEditorList({ title, items, onChange }: ListProps) {
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

export function TraitEditorList({ title, items, onChange }: ListProps) {
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

    const addItem = () => {
        onChange([...parsed.map(serializeTrait), "New Trait [0] - Notes"]);
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
                        <div key={idx} className="editor-array-item" style={{ alignItems: "flex-start" }}>
                            <Field label="Raw String (Unparsed)" hideLabel={idx > 0}><input className="editor-input" value={trait} onChange={e => updateRaw(idx, e.target.value)} /></Field>
                            <button type="button" onClick={() => deleteItem(idx)} className="editor-action-btn danger" style={{ marginTop: idx > 0 ? "4px" : "26px" }}>✕</button>
                        </div>
                    );
                }
                return (
                    <div key={idx} className="editor-array-item" style={{ flexDirection: "column", alignItems: "stretch", padding: "8px" }}>
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
                );
            })}
        </div>
    );
}

export function SkillEditorList({ title, items, onChange }: ListProps) {
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

    const addItem = () => {
        onChange([...parsed.map(serializeSkill), "New Skill (DX)-10 [1]"]);
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
                        <div key={idx} className="editor-array-item" style={{ alignItems: "flex-start" }}>
                            <Field label="Raw String (Unparsed)" hideLabel={idx > 0}><input className="editor-input" value={skill} onChange={e => updateRaw(idx, e.target.value)} /></Field>
                            <button type="button" onClick={() => deleteItem(idx)} className="editor-action-btn danger" style={{ marginTop: idx > 0 ? "4px" : "26px" }}>✕</button>
                        </div>
                    );
                }
                return (
                    <div key={idx} className="editor-array-item" style={{ flexDirection: "column", alignItems: "stretch", padding: "8px" }}>
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
                );
            })}
        </div>
    );
}

export function GearEditorList({ title, items, onChange }: ListProps) {
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

    const addItem = () => {
        onChange([...parsed.map(serializeGear), "New Item [1] (0 lbs, $0)"]);
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
                        <div key={idx} className="editor-array-item" style={{ alignItems: "flex-start" }}>
                            <Field label="Raw String (Unparsed)" hideLabel={idx > 0}><input className="editor-input" value={gear} onChange={e => updateRaw(idx, e.target.value)} /></Field>
                            <button type="button" onClick={() => deleteItem(idx)} className="editor-action-btn danger" style={{ marginTop: idx > 0 ? "4px" : "26px" }}>✕</button>
                        </div>
                    );
                }
                return (
                    <div key={idx} className="editor-array-item" style={{ flexDirection: "column", alignItems: "stretch", padding: "8px" }}>
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
                );
            })}
        </div>
    );
}

export function HitLocationEditorList({ title, items, onChange }: ListProps) {
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

    const addItem = () => {
        onChange([...parsed.map(serializeHitLocation), "Skull (3-4): DR 2"]);
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
                        <div key={idx} className="editor-array-item" style={{ alignItems: "flex-start" }}>
                            <Field label="Raw String (Unparsed)" hideLabel={idx > 0}><input className="editor-input" value={loc} onChange={e => updateRaw(idx, e.target.value)} /></Field>
                            <button type="button" onClick={() => deleteItem(idx)} className="editor-action-btn danger" style={{ marginTop: idx > 0 ? "4px" : "26px" }}>✕</button>
                        </div>
                    );
                }
                return (
                    <div key={idx} className="editor-array-item" style={{ flexDirection: "column", alignItems: "stretch", padding: "8px" }}>
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
                );
            })}
        </div>
    );
}

type EntityRelationListProps = { 
    title: string; 
    items: any[]; 
    onChange: (items: any[]) => void; 
    targetCategory: "Character" | "Location" | "Story" | "Faction" | "All";
};
export function EntityRelationEditorList({ title, items, onChange, targetCategory }: EntityRelationListProps) {
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

    return (
        <div className="editor-array-container">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="editor-label" style={{ color: "#a8c7fa" }}>{title}</span>
                <button type="button" className="editor-add-btn" onClick={handleAdd}>+ Add {targetCategory}</button>
            </div>
            {items.length === 0 && <p style={{ fontSize: "0.85em", opacity: 0.5, fontStyle: "italic", margin: 0 }}>No items.</p>}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {items.map((item, i) => (
                    <div key={i} className="editor-array-item" style={{ display: "flex", gap: "8px", alignItems: "center", padding: "8px" }}>
                        <div style={{ flex: 1 }}>
                            <WorkspaceSelect
                                value={item.name}
                                onChange={name => updateItem(i, "name", name)}
                                category={targetCategory}
                                placeholder={`Select ${targetCategory}...`}
                                style={{ margin: 0, padding: "6px 8px", borderRadius: "6px", border: "1px solid rgba(149,181,255,0.2)", background: "rgba(8,15,30,0.6)", color: "white", width: "100%", fontSize: "0.95rem" }}
                            />
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
                ))}
            </div>
        </div>
    );
}
