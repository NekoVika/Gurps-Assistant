import { useState, useEffect } from 'react';
import MDEditor from '@uiw/react-md-editor';
import type { LocationJSON } from '../../lib/types';
import { StringArrayEditor } from './StringArrayEditor';
import { ImageArrayEditor } from './ImageArrayEditor';

type Props = {
    value: string;
    onChange: (val: string) => void;
    documentPath?: string;
};

export function LocationEditor({ value, onChange, documentPath = "" }: Props) {
    const [data, setData] = useState<LocationJSON | null>(null);

    useEffect(() => {
        try {
            const parsed = JSON.parse(value) as LocationJSON;
            if (!parsed.internalStructure) parsed.internalStructure = [];
            setData(parsed);
        } catch (e) {
            console.error("Parse error in LocationEditor:", e);
        }
    }, []);

    const handleUpdate = (field: keyof LocationJSON, val: any) => {
        if (!data) return;
        const newData = { ...data, [field]: val };
        setData(newData);
        onChange(JSON.stringify(newData, null, 2));
    };

    if (!data) return <div style={{ padding: "20px" }}>Invalid JSON data. Cannot render editor.</div>;

    const inputStyle = {
        width: "100%", padding: "8px 12px", borderRadius: "6px", 
        border: "1px solid rgba(255,255,255,0.2)", background: "rgba(0,0,0,0.5)", color: "white",
        marginBottom: "16px"
    };
    const labelStyle = { display: "block", fontSize: "0.85em", fontWeight: "bold", textTransform: "uppercase" as const, opacity: 0.7, marginBottom: "4px" };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px", padding: "16px", background: "var(--color-surface, #1e1e1e)", borderRadius: "8px" }} data-color-mode="dark">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                    <label style={labelStyle}>Name</label>
                    <input type="text" style={inputStyle} value={data.name} onChange={e => handleUpdate('name', e.target.value)} />
                </div>
                <div>
                    <label style={labelStyle}>Type</label>
                    <input type="text" style={inputStyle} value={data.type} onChange={e => handleUpdate('type', e.target.value)} />
                </div>
                <div>
                    <label style={labelStyle}>Region</label>
                    <input type="text" style={inputStyle} value={data.region} onChange={e => handleUpdate('region', e.target.value)} />
                </div>
                <div>
                    <label style={labelStyle}>Tech Level</label>
                    <select style={inputStyle} value={data.techLevel} onChange={e => handleUpdate('techLevel', e.target.value)}>
                        <option value="">Select Tech Level</option>
                        {Array.from({ length: 13 }, (_, i) => <option key={i} value={String(i)}>{`TL ${i}`}</option>)}
                        {!Array.from({ length: 13 }, (_, i) => String(i)).includes(data.techLevel) && data.techLevel !== "" && <option value={data.techLevel}>{data.techLevel}</option>}
                    </select>
                </div>
                <div>
                    <label style={labelStyle}>Mana Level</label>
                    <select style={inputStyle} value={data.manaLevel} onChange={e => handleUpdate('manaLevel', e.target.value)}>
                        <option value="">Select Mana Range</option>
                        <option value="No Mana">No Mana</option>
                        <option value="Low Mana">Low Mana</option>
                        <option value="Normal Mana">Normal Mana</option>
                        <option value="High Mana">High Mana</option>
                        <option value="Very High Mana">Very High Mana</option>
                        {!["No Mana", "Low Mana", "Normal Mana", "High Mana", "Very High Mana", ""].includes(data.manaLevel) && <option value={data.manaLevel}>{data.manaLevel}</option>}
                    </select>
                </div>
            </div>

            <hr style={{ borderColor: "rgba(255,255,255,0.1)", margin: "8px 0" }} />

            <div>
                <label style={labelStyle}>Overview</label>
                <MDEditor value={data.overview} onChange={val => handleUpdate('overview', val || "")} height={200} preview="edit" />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <StringArrayEditor title="Landmarks" items={data.landmarks} onChange={(val) => handleUpdate('landmarks', val)} />
                <StringArrayEditor title="Factions" items={data.factions} onChange={(val) => handleUpdate('factions', val)} />
                <StringArrayEditor title="Notable NPCs" items={data.notableNpcs} onChange={(val) => handleUpdate('notableNpcs', val)} />
                <StringArrayEditor title="Plot Hooks" items={data.plotHooks} onChange={(val) => handleUpdate('plotHooks', val)} />
                <ImageArrayEditor title="Image Links" items={data.images} onChange={(val) => handleUpdate('images', val)} documentPath={documentPath} />
            </div>

            <hr style={{ borderColor: "rgba(255,255,255,0.1)", margin: "8px 0" }} />
            
            <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <label style={{...labelStyle, marginBottom: 0}}>Internal Structure</label>
                    <button type="button" className="ghost-button" style={{ padding: "4px 8px", fontSize: "0.8em" }} onClick={() => handleUpdate('internalStructure', [...data.internalStructure, { title: "New Zone", items: [] }])}>
                        + Add Zone
                    </button>
                </div>

                {data.internalStructure.length === 0 && <p style={{ fontSize: "0.85em", opacity: 0.5, fontStyle: "italic" }}>No internal zones defined.</p>}

                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {data.internalStructure.map((zone, zIndex) => (
                        <div key={zIndex} style={{ border: "1px solid rgba(255,255,255,0.1)", padding: "12px", borderRadius: "8px", background: "rgba(0,0,0,0.2)" }}>
                            <div style={{ display: "flex", gap: "12px", marginBottom: "12px" }}>
                                <input 
                                    type="text" 
                                    style={{ ...inputStyle, marginBottom: 0, fontWeight: "bold" }} 
                                    placeholder="Zone Title"
                                    value={zone.title} 
                                    onChange={e => {
                                        const next = [...data.internalStructure];
                                        next[zIndex].title = e.target.value;
                                        handleUpdate('internalStructure', next);
                                    }} 
                                />
                                <button type="button" style={{ background: "none", border: "none", color: "#ff6b6b", cursor: "pointer" }} onClick={() => {
                                    const next = [...data.internalStructure];
                                    next.splice(zIndex, 1);
                                    handleUpdate('internalStructure', next);
                                }}>Delete Zone</button>
                            </div>
                            <StringArrayEditor 
                                title="Rooms / Contents" 
                                items={zone.items} 
                                onChange={(val) => {
                                    const next = [...data.internalStructure];
                                    next[zIndex].items = val;
                                    handleUpdate('internalStructure', next);
                                }} 
                            />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
