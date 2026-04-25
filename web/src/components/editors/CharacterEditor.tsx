import { useState, useEffect } from 'react';
import MDEditor from '@uiw/react-md-editor';
import type { CharacterJSON } from '../../lib/types';
import { StringArrayEditor } from './StringArrayEditor';
import { ImageArrayEditor } from './ImageArrayEditor';
import { AttributeEditorList, TraitEditorList, SkillEditorList, GearEditorList, HitLocationEditorList, RelationEditorList } from './StructuredArrayEditors';

type Props = {
    value: string;
    onChange: (val: string) => void;
    documentPath?: string;
};

export function CharacterEditor({ value, onChange, documentPath = "" }: Props) {
    const [data, setData] = useState<CharacterJSON | null>(null);

    useEffect(() => {
        try {
            const parsed = JSON.parse(value) as CharacterJSON;
            setData(parsed);
        } catch (e) {
            console.error("Parse error in CharacterEditor:", e);
        }
    }, []);

    // We do NOT want to update 'data' when 'value' changes globally after initial load,
    // otherwise it resets cursor positions in text fields.
    // Instead, we call onChange(JSON.stringify(updatedData)) whenever local 'data' changes!

    const handleUpdate = (field: keyof CharacterJSON, val: any) => {
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
                    <label style={labelStyle}>Concept</label>
                    <input type="text" style={inputStyle} value={data.concept} onChange={e => handleUpdate('concept', e.target.value)} />
                </div>
                <div>
                    <label style={labelStyle}>Significance</label>
                    <select style={inputStyle} value={data.significance} onChange={e => handleUpdate('significance', e.target.value)}>
                        <option value="">Select Significance</option>
                        <option value="1 Core">1 Core</option>
                        <option value="2 Supporting">2 Supporting</option>
                        <option value="3 Featured">3 Featured</option>
                        <option value="4 Background">4 Background</option>
                        {/* Fallback for old custom strings */}
                        {!["1 Core", "2 Supporting", "3 Featured", "4 Background", ""].includes(data.significance) && <option value={data.significance}>{data.significance}</option>}
                    </select>
                </div>
                <div>
                    <label style={labelStyle}>Role</label>
                    <input type="text" style={inputStyle} value={data.role} onChange={e => handleUpdate('role', e.target.value)} />
                </div>
                <div>
                    <label style={labelStyle}>Status</label>
                    <input type="text" style={inputStyle} value={data.status} onChange={e => handleUpdate('status', e.target.value)} />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                    <StringArrayEditor title="Locations (Linked)" items={data.locations || []} onChange={items => handleUpdate('locations', items)} category="Location" />
                </div>
            </div>

            <hr style={{ borderColor: "rgba(255,255,255,0.1)", margin: "8px 0" }} />

            <div>
                <label style={labelStyle}>Point Total</label>
                <input type="text" style={{...inputStyle, width: "150px"}} value={data.pointTotal || ""} onChange={e => handleUpdate('pointTotal', e.target.value)} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <RelationEditorList title="Relations" items={data.relations || []} onChange={items => handleUpdate('relations', items)} />
                <StringArrayEditor title="Appearances (Episodes/Chapters)" items={data.appearances || []} onChange={items => handleUpdate('appearances', items)} category="Story" />
                <AttributeEditorList 
                    title="Attributes" 
                    items={(data.attributes || []).map(a => typeof a === 'string' ? a : JSON.stringify(a))} 
                    onChange={(val) => handleUpdate('attributes', val)} 
                />
                <SkillEditorList 
                    title="Skills" 
                    items={(data.skills || []).map(s => typeof s === 'string' ? s : JSON.stringify(s))} 
                    onChange={(val) => handleUpdate('skills', val)} 
                />
                <TraitEditorList 
                    title="Advantages & Perks" 
                    items={(data.advantages || []).map(a => typeof a === 'string' ? a : JSON.stringify(a))} 
                    onChange={(val) => handleUpdate('advantages', val)} 
                />
                <TraitEditorList 
                    title="Disadvantages & Quirks" 
                    items={(data.disadvantages || []).map(d => typeof d === 'string' ? d : JSON.stringify(d))} 
                    onChange={(val) => handleUpdate('disadvantages', val)} 
                />
                <GearEditorList 
                    title="Gear & Weapons" 
                    items={(data.gear || []).map(g => typeof g === 'string' ? g : JSON.stringify(g))} 
                    onChange={(val) => handleUpdate('gear', val)} 
                />
                <ImageArrayEditor title="Image Links" items={data.images || []} onChange={(val) => handleUpdate('images', val)} documentPath={documentPath} />
            </div>

            <hr style={{ borderColor: "rgba(255,255,255,0.1)", margin: "8px 0" }} />

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                    <label style={labelStyle}>Appearance</label>
                    <MDEditor value={data.appearance} onChange={val => handleUpdate('appearance', val || "")} height={150} preview="edit" />
                </div>
                <div>
                    <label style={labelStyle}>Personality & Quirks</label>
                    <MDEditor value={data.personality} onChange={val => handleUpdate('personality', val || "")} height={150} preview="edit" />
                </div>
                <div>
                    <label style={labelStyle}>Motivation & Drive</label>
                    <MDEditor value={data.motivation} onChange={val => handleUpdate('motivation', val || "")} height={150} preview="edit" />
                </div>
                <div>
                    <label style={labelStyle}>Speech & Quotes</label>
                    <MDEditor value={data.speech} onChange={val => handleUpdate('speech', val || "")} height={150} preview="edit" />
                </div>
                <div>
                    <label style={labelStyle}>Combat Tactics & AI</label>
                    <MDEditor value={data.tactics} onChange={val => handleUpdate('tactics', val || "")} height={200} preview="live" />
                </div>
                <div>
                    <label style={labelStyle}>Hit Locations & DR</label>
                    {typeof data.hitLocations === 'string' ? (
                       <MDEditor value={data.hitLocations} onChange={val => handleUpdate('hitLocations', val || "")} height={200} preview="live" />
                    ) : (
                       <HitLocationEditorList 
                           title="Hit Locations (JSON Objects)" 
                           items={(data.hitLocations || []).map((h: any) => typeof h === 'string' ? h : JSON.stringify(h))} 
                           onChange={(val) => handleUpdate('hitLocations', val)} 
                       />
                    )}
                </div>
                <div>
                    <label style={labelStyle}>PC Hooks</label>
                    <MDEditor value={data.pcHooks} onChange={val => handleUpdate('pcHooks', val || "")} height={150} preview="live" />
                </div>
                <div>
                    <label style={labelStyle}>GM Summary (Hidden Archive)</label>
                    <MDEditor value={data.gmSummary} onChange={val => handleUpdate('gmSummary', val || "")} height={150} preview="edit" />
                </div>
            </div>
            {/* Variations omitted for now unless heavily used. We could add a complex editor if needed. */}
        </div>
    );
}
