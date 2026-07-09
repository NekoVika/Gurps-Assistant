import { useState, useEffect } from 'react';
import MDEditor from '@uiw/react-md-editor';
import type { LocationJSON } from '../../lib/types';
import { StringArrayEditor } from './StringArrayEditor';
import { ImageArrayEditor } from './ImageArrayEditor';
import { EntityRelationEditorList } from './StructuredArrayEditors';

type Props = {
    value: string;
    onChange: (val: string) => void;
    documentPath?: string;
};

export function LocationEditor({ value, onChange, documentPath = "" }: Props) {
    const [data, setData] = useState<LocationJSON | null>(null);

    const KNOWN_KEYS = new Set([
        'name', 'type', 'region', 'techLevel', 'manaLevel', 
        'images', 'overview', 'landmarks', 'internalStructure', 
        'factions', 'notableNpcs', 'plotHooks', 
        'characterRelations', 'locationRelations', 'factionRelations', 'storyAppearances'
    ]);

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

    return (
        <div className="editor-glass-panel" data-color-mode="dark">
            <h2 className="editor-section-title">Location Core</h2>
            <div className="editor-grid-3">
                <div className="editor-field">
                    <label className="editor-label">Name</label>
                    <input type="text" className="editor-input" value={data.name} onChange={e => handleUpdate('name', e.target.value)} />
                </div>
                <div className="editor-field">
                    <label className="editor-label">Type</label>
                    <input type="text" className="editor-input" value={data.type} onChange={e => handleUpdate('type', e.target.value)} />
                </div>
                <div className="editor-field">
                    <label className="editor-label">Region</label>
                    <input type="text" className="editor-input" value={data.region} onChange={e => handleUpdate('region', e.target.value)} />
                </div>
                <div className="editor-field">
                    <label className="editor-label">Tech Level</label>
                    <select className="editor-select" value={data.techLevel} onChange={e => handleUpdate('techLevel', e.target.value)}>
                        <option value="">Select Tech Level</option>
                        {Array.from({ length: 13 }, (_, i) => <option key={i} value={String(i)}>{`TL ${i}`}</option>)}
                        {!Array.from({ length: 13 }, (_, i) => String(i)).includes(data.techLevel) && data.techLevel !== "" && <option value={data.techLevel}>{data.techLevel}</option>}
                    </select>
                </div>
                <div className="editor-field">
                    <label className="editor-label">Mana Level</label>
                    <select className="editor-select" value={data.manaLevel} onChange={e => handleUpdate('manaLevel', e.target.value)}>
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

            <h2 className="editor-section-title">Overview</h2>
            <div className="editor-field">
                <MDEditor value={data.overview} onChange={val => handleUpdate('overview', val || "")} height={200} preview="edit" />
            </div>

            <h2 className="editor-section-title">Details & Connections</h2>
            <div className="editor-grid-2">
                <EntityRelationEditorList title="Character Relations" items={data.characterRelations || []} onChange={items => handleUpdate('characterRelations', items)} targetCategory="Character" />
                <EntityRelationEditorList title="Faction Relations" items={data.factionRelations || []} onChange={items => handleUpdate('factionRelations', items)} targetCategory="Faction" />
                <EntityRelationEditorList title="Location Relations" items={data.locationRelations || []} onChange={items => handleUpdate('locationRelations', items)} targetCategory="Location" />
                <StringArrayEditor title="Story Appearances" items={data.storyAppearances || []} onChange={items => handleUpdate('storyAppearances', items)} category="Story" />
                
                {data.factions && data.factions.length > 0 && (
                    <StringArrayEditor title="Factions (Legacy)" items={data.factions} onChange={(val) => handleUpdate('factions', val)} />
                )}
                {data.notableNpcs && data.notableNpcs.length > 0 && (
                    <StringArrayEditor title="Notable NPCs (Legacy)" items={data.notableNpcs} onChange={(val) => handleUpdate('notableNpcs', val)} category="Character" />
                )}
                
                <StringArrayEditor title="Landmarks" items={data.landmarks || []} onChange={(val) => handleUpdate('landmarks', val)} />
                <StringArrayEditor title="Plot Hooks" items={data.plotHooks || []} onChange={(val) => handleUpdate('plotHooks', val)} />
            </div>

            <h2 className="editor-section-title">Internal Zones & Maps</h2>
            <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <label className="editor-label" style={{ marginBottom: 0 }}>Internal Structure</label>
                    <button type="button" className="editor-add-btn" onClick={() => handleUpdate('internalStructure', [...data.internalStructure, { title: "New Zone", items: [] }])}>
                        + Add Zone
                    </button>
                </div>

                {data.internalStructure.length === 0 && <p style={{ fontSize: "0.85em", opacity: 0.5, fontStyle: "italic" }}>No internal zones defined.</p>}

                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {data.internalStructure.map((zone, zIndex) => (
                        <div key={zIndex} className="editor-array-container">
                            <div style={{ display: "flex", gap: "12px", marginBottom: "12px" }}>
                                <input 
                                    type="text" 
                                    className="editor-input" 
                                    style={{ marginBottom: 0, fontWeight: "bold" }} 
                                    placeholder="Zone Title"
                                    value={zone.title} 
                                    onChange={e => {
                                        const next = [...data.internalStructure];
                                        next[zIndex].title = e.target.value;
                                        handleUpdate('internalStructure', next);
                                    }} 
                                />
                                <button type="button" className="editor-action-btn danger" onClick={() => {
                                    const next = [...data.internalStructure];
                                    next.splice(zIndex, 1);
                                    handleUpdate('internalStructure', next);
                                }}>✕ Delete Zone</button>
                            </div>
                            <StringArrayEditor 
                                title="Rooms / Contents" 
                                items={zone.items || []} 
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

            <h2 className="editor-section-title">Media</h2>
            <ImageArrayEditor title="Image Links" items={data.images} onChange={(val) => handleUpdate('images', val)} documentPath={documentPath} />

            {Object.keys(data).filter(k => !KNOWN_KEYS.has(k)).length > 0 && (
                <>
                    <h2 className="editor-section-title" style={{ color: "#ff7b72" }}>Unrecognized / Legacy Fields</h2>
                    <div style={{ padding: "16px", background: "rgba(248, 81, 73, 0.1)", border: "1px solid rgba(248, 81, 73, 0.3)", borderRadius: "8px", marginBottom: "16px" }}>
                        <p style={{ fontSize: "0.85em", opacity: 0.8, marginBottom: "12px", color: "#ff7b72" }}>
                            These fields exist in the file but do not map to the current standard Location template. They are preserved here.
                        </p>
                        {Object.keys(data).filter(k => !KNOWN_KEYS.has(k)).map(key => (
                            <div key={key} className="editor-field" style={{ marginBottom: "12px" }}>
                                <label className="editor-label" style={{ fontFamily: "monospace", color: "#ff7b72" }}>{key}</label>
                                <textarea 
                                    className="editor-input" 
                                    style={{ fontFamily: "monospace", fontSize: "0.85em", minHeight: "80px", background: "rgba(0,0,0,0.2)" }} 
                                    value={typeof (data as any)[key] === 'string' ? (data as any)[key] : JSON.stringify((data as any)[key], null, 2)}
                                    onChange={e => {
                                        try {
                                            const val = e.target.value;
                                            if (val.trim().startsWith('{') || val.trim().startsWith('[')) {
                                                handleUpdate(key as any, JSON.parse(val));
                                            } else {
                                                handleUpdate(key as any, val);
                                            }
                                        } catch(err) {
                                            handleUpdate(key as any, e.target.value);
                                        }
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
