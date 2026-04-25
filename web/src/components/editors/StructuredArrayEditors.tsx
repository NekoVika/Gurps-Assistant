import { WorkspaceSelect } from './WorkspaceSelect';
import { parseAttribute, serializeAttribute, parseTrait, serializeTrait, parseSkill, serializeSkill, parseGear, serializeGear, parseHitLocation, serializeHitLocation } from '../../lib/TraitFormatters';

const inputStyle = { padding: "4px", background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.2)", color: "white", borderRadius: "4px", width: "100%" };
const labelStyle = { display: "block", fontSize: "0.75rem", opacity: 0.7, marginBottom: "2px", textTransform: "uppercase" as const };
const containerStyle = { background: "rgba(255,255,255,0.05)", padding: "8px", borderRadius: "6px", marginBottom: "8px", display: "flex", gap: "8px", alignItems: "flex-start" };

type ListProps = { title: string; items: string[]; onChange: (items: string[]) => void; };

function Field({ label, children, flex, hideLabel }: { label: string, children: React.ReactNode, flex?: string, hideLabel?: boolean }) {
    return <div style={{ flex: flex || 1 }}><label style={{...labelStyle, opacity: hideLabel ? 0 : 0.7}}>{label}</label>{children}</div>;
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
        <div style={{ marginBottom: "16px" }}>
            <h4 style={{ margin: "0 0 8px 0" }}>{title}</h4>
            {coreData.map((attr, idx) => (
                <div key={`core-${idx}`} style={containerStyle}>
                    <Field label="Name" flex="2" hideLabel={idx > 0}><input style={{...inputStyle, opacity: 0.6}} value={attr.name} readOnly /></Field>
                    <Field label="Level" flex="1" hideLabel={idx > 0}><input style={inputStyle} value={attr.level} onChange={e => updateCore(idx, 'level', e.target.value)} /></Field>
                    <Field label="Points" flex="1" hideLabel={idx > 0}><input style={inputStyle} value={attr.points} onChange={e => updateCore(idx, 'points', e.target.value)} /></Field>
                </div>
            ))}
            {extras.length > 0 && (
                <div style={{ marginTop: "16px", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "8px" }}>
                    <h5 style={{ margin: "0 0 8px 0", color: "#ff7b72" }}>Unrecognized / Malformed Attributes</h5>
                    {extras.map((ex, idx) => (
                        <div key={`extra-${idx}`} style={containerStyle}>
                            <Field label="Raw String" hideLabel={idx > 0}><input style={inputStyle} value={typeof ex === 'string' ? ex : serializeAttribute(ex)} onChange={e => updateExtra(idx, e.target.value)} /></Field>
                            <button type="button" onClick={() => deleteExtra(idx)} style={{ background: "transparent", border: "none", color: "#ff7b72", cursor: "pointer", marginTop: "16px" }}>✖</button>
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
        <div style={{ marginBottom: "16px" }}>
            <h4 style={{ margin: "0 0 8px 0" }}>{title}</h4>
            {parsed.map((trait, idx) => {
                if (typeof trait === 'string') {
                    return (
                        <div key={idx} style={containerStyle}>
                            <Field label="Raw String (Unparsed)" hideLabel={idx > 0}><input style={inputStyle} value={trait} onChange={e => updateRaw(idx, e.target.value)} /></Field>
                            <button type="button" onClick={() => deleteItem(idx)} style={{ background: "transparent", border: "none", color: "#ff7b72", cursor: "pointer", marginTop: "16px" }}>✖</button>
                        </div>
                    );
                }
                return (
                    <div key={idx} style={{...containerStyle, flexWrap: "wrap"}}>
                        <div style={{ display: "flex", gap: "8px", width: "100%" }}>
                            <Field label="Name" flex="3" hideLabel={idx > 0}><input style={inputStyle} value={trait.name} onChange={e => updateItem(idx, 'name', e.target.value)} /></Field>
                            <Field label="Points" flex="1" hideLabel={idx > 0}><input style={inputStyle} value={trait.points} onChange={e => updateItem(idx, 'points', e.target.value)} /></Field>
                            <button type="button" onClick={() => deleteItem(idx)} style={{ background: "transparent", border: "none", color: "#ff7b72", cursor: "pointer", marginTop: idx > 0 ? "4px" : "16px" }}>✖</button>
                        </div>
                        <div style={{ display: "flex", gap: "8px", width: "100%" }}>
                            <Field label="Notes" flex="3" hideLabel={idx > 0}><input style={inputStyle} value={trait.notes} onChange={e => updateItem(idx, 'notes', e.target.value)} /></Field>
                            <Field label="Ref" flex="1" hideLabel={idx > 0}><input style={inputStyle} value={trait.reference} onChange={e => updateItem(idx, 'reference', e.target.value)} /></Field>
                        </div>
                    </div>
                );
            })}
            <button type="button" onClick={addItem} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "white", padding: "4px 8px", borderRadius: "4px", cursor: "pointer" }}>+ Add Item</button>
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
        <div style={{ marginBottom: "16px" }}>
            <h4 style={{ margin: "0 0 8px 0" }}>{title}</h4>
            {parsed.map((skill, idx) => {
                if (typeof skill === 'string') {
                    return (
                        <div key={idx} style={containerStyle}>
                            <Field label="Raw String (Unparsed)" hideLabel={idx > 0}><input style={inputStyle} value={skill} onChange={e => updateRaw(idx, e.target.value)} /></Field>
                            <button type="button" onClick={() => deleteItem(idx)} style={{ background: "transparent", border: "none", color: "#ff7b72", cursor: "pointer", marginTop: "16px" }}>✖</button>
                        </div>
                    );
                }
                return (
                    <div key={idx} style={{...containerStyle, flexWrap: "wrap"}}>
                        <div style={{ display: "flex", gap: "8px", width: "100%" }}>
                            <Field label="Name" flex="3" hideLabel={idx > 0}><input style={inputStyle} value={skill.name} onChange={e => updateItem(idx, 'name', e.target.value)} /></Field>
                            <Field label="Base" flex="1" hideLabel={idx > 0}><input style={inputStyle} value={skill.base} onChange={e => updateItem(idx, 'base', e.target.value)} /></Field>
                            <Field label="Lvl" flex="1" hideLabel={idx > 0}><input style={inputStyle} value={skill.level} onChange={e => updateItem(idx, 'level', e.target.value)} type="number" /></Field>
                            <Field label="Pts" flex="1" hideLabel={idx > 0}><input style={inputStyle} value={skill.points} onChange={e => updateItem(idx, 'points', e.target.value)} type="number" /></Field>
                            <button type="button" onClick={() => deleteItem(idx)} style={{ background: "transparent", border: "none", color: "#ff7b72", cursor: "pointer", marginTop: idx > 0 ? "4px" : "16px" }}>✖</button>
                        </div>
                        <div style={{ display: "flex", gap: "8px", width: "100%" }}>
                            <Field label="Notes" flex="1" hideLabel={idx > 0}><input style={inputStyle} value={skill.notes} onChange={e => updateItem(idx, 'notes', e.target.value)} /></Field>
                        </div>
                    </div>
                );
            })}
            <button type="button" onClick={addItem} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "white", padding: "4px 8px", borderRadius: "4px", cursor: "pointer" }}>+ Add Skill</button>
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
        <div style={{ marginBottom: "16px" }}>
            <h4 style={{ margin: "0 0 8px 0" }}>{title}</h4>
            {parsed.map((gear, idx) => {
                if (typeof gear === 'string') {
                    return (
                        <div key={idx} style={containerStyle}>
                            <Field label="Raw String (Unparsed)" hideLabel={idx > 0}><input style={inputStyle} value={gear} onChange={e => updateRaw(idx, e.target.value)} /></Field>
                            <button type="button" onClick={() => deleteItem(idx)} style={{ background: "transparent", border: "none", color: "#ff7b72", cursor: "pointer", marginTop: "16px" }}>✖</button>
                        </div>
                    );
                }
                return (
                    <div key={idx} style={{...containerStyle, flexWrap: "wrap"}}>
                        <div style={{ display: "flex", gap: "8px", width: "100%" }}>
                            <Field label="Name" flex="3" hideLabel={idx > 0}><input style={inputStyle} value={gear.name} onChange={e => updateItem(idx, 'name', e.target.value)} /></Field>
                            <Field label="Qty" flex="1" hideLabel={idx > 0}><input style={inputStyle} value={gear.quantity} onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)} type="number" /></Field>
                            <Field label="Weight" flex="1" hideLabel={idx > 0}><input style={inputStyle} value={gear.weight} onChange={e => updateItem(idx, 'weight', e.target.value)} /></Field>
                            <Field label="Cost" flex="1" hideLabel={idx > 0}><input style={inputStyle} value={gear.cost} onChange={e => updateItem(idx, 'cost', e.target.value)} /></Field>
                            <button type="button" onClick={() => deleteItem(idx)} style={{ background: "transparent", border: "none", color: "#ff7b72", cursor: "pointer", marginTop: idx > 0 ? "4px" : "16px" }}>✖</button>
                        </div>
                        <div style={{ display: "flex", gap: "8px", width: "100%" }}>
                            <Field label="Notes" flex="1" hideLabel={idx > 0}><input style={inputStyle} value={gear.notes} onChange={e => updateItem(idx, 'notes', e.target.value)} /></Field>
                        </div>
                    </div>
                );
            })}
            <button type="button" onClick={addItem} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "white", padding: "4px 8px", borderRadius: "4px", cursor: "pointer" }}>+ Add Gear</button>
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
        <div style={{ marginBottom: "16px" }}>
            <h4 style={{ margin: "0 0 8px 0" }}>{title}</h4>
            {parsed.map((loc, idx) => {
                if (typeof loc === 'string') {
                    return (
                        <div key={idx} style={containerStyle}>
                            <Field label="Raw String (Unparsed)" hideLabel={idx > 0}><input style={inputStyle} value={loc} onChange={e => updateRaw(idx, e.target.value)} /></Field>
                            <button type="button" onClick={() => deleteItem(idx)} style={{ background: "transparent", border: "none", color: "#ff7b72", cursor: "pointer", marginTop: "16px" }}>✖</button>
                        </div>
                    );
                }
                return (
                    <div key={idx} style={{...containerStyle, flexWrap: "wrap"}}>
                        <div style={{ display: "flex", gap: "8px", width: "100%" }}>
                            <Field label="Location" flex="2" hideLabel={idx > 0}><input style={inputStyle} value={loc.location} onChange={e => updateItem(idx, 'location', e.target.value)} /></Field>
                            <Field label="Roll" flex="1" hideLabel={idx > 0}><input style={inputStyle} value={loc.roll} onChange={e => updateItem(idx, 'roll', e.target.value)} /></Field>
                            <Field label="DR" flex="1" hideLabel={idx > 0}><input style={inputStyle} value={loc.dr} onChange={e => updateItem(idx, 'dr', parseInt(e.target.value) || 0)} type="number" /></Field>
                            <button type="button" onClick={() => deleteItem(idx)} style={{ background: "transparent", border: "none", color: "#ff7b72", cursor: "pointer", marginTop: idx > 0 ? "4px" : "16px" }}>✖</button>
                        </div>
                        <div style={{ display: "flex", gap: "8px", width: "100%" }}>
                            <Field label="Notes" flex="1" hideLabel={idx > 0}><input style={inputStyle} value={loc.notes} onChange={e => updateItem(idx, 'notes', e.target.value)} /></Field>
                        </div>
                    </div>
                );
            })}
            <button type="button" onClick={addItem} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "white", padding: "4px 8px", borderRadius: "4px", cursor: "pointer" }}>+ Add Location</button>
        </div>
    );
}

type RelationListProps = { title: string; items: any[]; onChange: (items: any[]) => void; };
export function RelationEditorList({ title, items, onChange }: RelationListProps) {
    const handleAdd = () => {
        onChange([...items, { name: "New Relation", relationship: "Description" }]);
    };
    const handleRemove = (index: number) => {
        onChange(items.filter((_, i) => i !== index));
    };
    const updateItem = (index: number, field: string, value: string) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        onChange(newItems);
    };

    return (
        <div style={{ marginBottom: "16px", padding: "12px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontWeight: "bold", fontSize: "0.9em", color: "var(--color-primary, #a8c7fa)" }}>{title}</span>
                <button type="button" className="ghost-button" style={{ padding: "4px 8px", fontSize: "0.8em" }} onClick={handleAdd}>+ Add Item</button>
            </div>
            {items.length === 0 && <p style={{ fontSize: "0.85em", opacity: 0.5, fontStyle: "italic", margin: 0 }}>No items.</p>}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {items.map((item, i) => (
                    <div key={i} style={{ display: "flex", flexDirection: "column", gap: "4px", background: "rgba(255,255,255,0.05)", padding: "8px", borderRadius: "6px" }}>
                        <div style={{ display: "flex", gap: "8px" }}>
                            <WorkspaceSelect 
                                category="Character"
                                value={item.name || ""} 
                                onChange={(val) => updateItem(i, "name", val)} 
                                placeholder="Select Character..."
                                style={{ flex: 1, margin: 0 }}
                            />
                            <button type="button" style={{ background: "none", border: "none", color: "#ff6b6b", cursor: "pointer", padding: "0 8px" }} onClick={() => handleRemove(i)} title="Remove">✕</button>
                        </div>
                        <input 
                            type="text" 
                            value={item.relationship || ""} 
                            onChange={(e) => updateItem(i, "relationship", e.target.value)} 
                            placeholder="Relationship" 
                            style={{ width: "100%", padding: "6px 12px", borderRadius: "4px", border: "1px solid rgba(255,255,255,0.2)", background: "rgba(0,0,0,0.5)", color: "white" }}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}
