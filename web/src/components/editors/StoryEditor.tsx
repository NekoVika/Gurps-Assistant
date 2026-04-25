import { useState, useEffect } from 'react';
import MDEditor from '@uiw/react-md-editor';
import type { StoryJSON } from '../../lib/types';
import { ImageArrayEditor } from './ImageArrayEditor';

type Props = {
    value: string;
    onChange: (val: string) => void;
    documentPath?: string;
};

export function StoryEditor({ value, onChange, documentPath = "" }: Props) {
    const [data, setData] = useState<StoryJSON | null>(null);

    useEffect(() => {
        try {
            const parsed = JSON.parse(value) as StoryJSON;
            setData(parsed);
        } catch (e) {
            console.error("Parse error in StoryEditor:", e);
        }
    }, []);

    const handleUpdate = (field: keyof StoryJSON, val: any) => {
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
                <div style={{ gridColumn: "span 2" }}>
                    <label style={labelStyle}>Title</label>
                    <input type="text" style={{...inputStyle, fontSize: "1.2em"}} value={data.title} onChange={e => handleUpdate('title', e.target.value)} />
                </div>
                <div>
                    <label style={labelStyle}>Type</label>
                    <select style={inputStyle} value={data.type} onChange={e => handleUpdate('type', e.target.value)}>
                        <option value="Episode">Episode</option>
                        <option value="Chapter">Chapter</option>
                        <option value="Encounter">Encounter</option>
                        <option value="Story">Story</option>
                    </select>
                </div>
                <div>
                    <label style={labelStyle}>Status</label>
                    <select style={inputStyle} value={data.status} onChange={e => handleUpdate('status', e.target.value)}>
                        <option value="Draft">Draft</option>
                        <option value="Active">Active</option>
                        <option value="Completed">Completed</option>
                        <option value="Archived">Archived</option>
                        {!["Draft", "Active", "Completed", "Archived"].includes(data.status) && data.status !== "" && <option value={data.status}>{data.status}</option>}
                    </select>
                </div>
                <div>
                    <label style={labelStyle}>Primary Location</label>
                    <input type="text" style={inputStyle} value={data.primaryLocation} onChange={e => handleUpdate('primaryLocation', e.target.value)} />
                </div>
            </div>

            <ImageArrayEditor title="Image Links" items={data.images || []} onChange={(val) => handleUpdate('images', val)} documentPath={documentPath} />

            <hr style={{ borderColor: "rgba(255,255,255,0.1)", margin: "8px 0" }} />

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                    <label style={labelStyle}>GM Brief (Hidden)</label>
                    <MDEditor value={data.gmBrief} onChange={val => handleUpdate('gmBrief', val || "")} height={150} preview="edit" />
                </div>
                <div>
                    <label style={labelStyle}>Premise & Setup</label>
                    <MDEditor value={data.premise} onChange={val => handleUpdate('premise', val || "")} height={150} preview="edit" />
                </div>
                <div>
                    <label style={labelStyle}>Main Objectives</label>
                    <MDEditor value={data.objectives} onChange={val => handleUpdate('objectives', val || "")} height={150} preview="edit" />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    <div>
                        <label style={labelStyle}>Stakes & Antagonists</label>
                        <MDEditor value={data.stakesAndAntagonists} onChange={val => handleUpdate('stakesAndAntagonists', val || "")} height={150} preview="edit" />
                    </div>
                    <div>
                        <label style={labelStyle}>Mechanics & Hazards</label>
                        <MDEditor value={data.mechanicsAndHazards} onChange={val => handleUpdate('mechanicsAndHazards', val || "")} height={150} preview="edit" />
                    </div>
                    <div>
                        <label style={labelStyle}>Clues & Props</label>
                        <MDEditor value={data.cluesAndProps} onChange={val => handleUpdate('cluesAndProps', val || "")} height={150} preview="edit" />
                    </div>
                    <div>
                        <label style={labelStyle}>Rewards (Loot/Points)</label>
                        <MDEditor value={data.rewards} onChange={val => handleUpdate('rewards', val || "")} height={150} preview="edit" />
                    </div>
                </div>

                <hr style={{ borderColor: "rgba(255,255,255,0.1)", margin: "8px 0" }} />

                <div>
                    <label style={labelStyle}>Main Outline / Expected Path</label>
                    <MDEditor value={data.mainOutline} onChange={val => handleUpdate('mainOutline', val || "")} height={200} preview="live" />
                </div>
                <div>
                    <label style={labelStyle}>Branching Path (Optional variants)</label>
                    <MDEditor value={data.branchingPath} onChange={val => handleUpdate('branchingPath', val || "")} height={150} preview="edit" />
                </div>
                
                <hr style={{ borderColor: "rgba(255,255,255,0.1)", margin: "8px 0" }} />

                <div>
                    <label style={labelStyle}>Child Links (Chapters/Encounters)</label>
                    <MDEditor value={data.childLinks} onChange={val => handleUpdate('childLinks', val || "")} height={150} preview="edit" />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    <div>
                        <label style={labelStyle}>Assumptions (Prerequisites)</label>
                        <MDEditor value={data.assumptions} onChange={val => handleUpdate('assumptions', val || "")} height={150} preview="edit" />
                    </div>
                    <div>
                        <label style={labelStyle}>Open Questions (Unresolved)</label>
                        <MDEditor value={data.openQuestions} onChange={val => handleUpdate('openQuestions', val || "")} height={150} preview="edit" />
                    </div>
                </div>

                <div>
                    <label style={labelStyle}>PC Hooks</label>
                    <MDEditor value={data.pcHooks} onChange={val => handleUpdate('pcHooks', val || "")} height={150} preview="edit" />
                </div>
                <div>
                    <label style={labelStyle}>Outcomes & Consequences</label>
                    <MDEditor value={data.outcomes} onChange={val => handleUpdate('outcomes', val || "")} height={150} preview="edit" />
                </div>
            </div>
        </div>
    );
}
