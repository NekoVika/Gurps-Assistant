import { useState, useEffect } from 'react';
import MDEditor from '@uiw/react-md-editor';
import type { StoryJSON } from '../../lib/types';
import { ImageArrayEditor } from './ImageArrayEditor';
import { EntityLinkListEditor } from './StructuredArrayEditors';

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

    return (
        <div className="editor-glass-panel" data-color-mode="dark">
            <h2 className="editor-section-title">Story Overview</h2>
            <div className="editor-grid-3">
                <div className="editor-field" style={{ gridColumn: "span 2" }}>
                    <label className="editor-label">Title</label>
                    <input type="text" className="editor-input" style={{ fontSize: "1.2em" }} value={data.title} onChange={e => handleUpdate('title', e.target.value)} />
                </div>
                <div className="editor-field">
                    <label className="editor-label">Type</label>
                    <select className="editor-select" value={data.type} onChange={e => handleUpdate('type', e.target.value)}>
                        <option value="Episode">Episode</option>
                        <option value="Chapter">Chapter</option>
                        <option value="Encounter">Encounter</option>
                        <option value="Story">Story</option>
                    </select>
                </div>
                <div className="editor-field">
                    <label className="editor-label">Status</label>
                    <select className="editor-select" value={data.status} onChange={e => handleUpdate('status', e.target.value)}>
                        <option value="Draft">Draft</option>
                        <option value="Active">Active</option>
                        <option value="Completed">Completed</option>
                        <option value="Archived">Archived</option>
                        {!["Draft", "Active", "Completed", "Archived"].includes(data.status) && data.status !== "" && <option value={data.status}>{data.status}</option>}
                    </select>
                </div>
                <div className="editor-field" style={{ gridColumn: "span 2" }}>
                    <label className="editor-label">Primary Location</label>
                    <input type="text" className="editor-input" value={data.primaryLocation} onChange={e => handleUpdate('primaryLocation', e.target.value)} />
                </div>
            </div>

            <h2 className="editor-section-title">Involved Entities</h2>
            <div className="editor-grid-3">
                <EntityLinkListEditor title="Characters" items={data.characters || []} onChange={items => handleUpdate('characters', items)} targetCategory="Character" />
                <EntityLinkListEditor title="Locations" items={data.locations || []} onChange={items => handleUpdate('locations', items)} targetCategory="Location" />
                <EntityLinkListEditor title="Factions" items={data.factions || []} onChange={items => handleUpdate('factions', items)} targetCategory="Faction" />
            </div>

            <h2 className="editor-section-title">Core Content</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div className="editor-field">
                    <label className="editor-label">GM Brief (Hidden)</label>
                    <MDEditor value={data.gmBrief} onChange={val => handleUpdate('gmBrief', val || "")} height={150} preview="edit" />
                </div>
                <div className="editor-field">
                    <label className="editor-label">Premise & Setup</label>
                    <MDEditor value={data.premise} onChange={val => handleUpdate('premise', val || "")} height={150} preview="edit" />
                </div>
                <div className="editor-field">
                    <label className="editor-label">Main Objectives</label>
                    <MDEditor value={data.objectives} onChange={val => handleUpdate('objectives', val || "")} height={150} preview="edit" />
                </div>
            </div>

            <h2 className="editor-section-title">Encounters & Mechanics</h2>
            <div className="editor-grid-2">
                <div className="editor-field">
                    <label className="editor-label">Stakes & Antagonists</label>
                    <MDEditor value={data.stakesAndAntagonists} onChange={val => handleUpdate('stakesAndAntagonists', val || "")} height={150} preview="edit" />
                </div>
                <div className="editor-field">
                    <label className="editor-label">Mechanics & Hazards</label>
                    <MDEditor value={data.mechanicsAndHazards} onChange={val => handleUpdate('mechanicsAndHazards', val || "")} height={150} preview="edit" />
                </div>
                <div className="editor-field">
                    <label className="editor-label">Clues & Props</label>
                    <MDEditor value={data.cluesAndProps} onChange={val => handleUpdate('cluesAndProps', val || "")} height={150} preview="edit" />
                </div>
                <div className="editor-field">
                    <label className="editor-label">Rewards (Loot/Points)</label>
                    <MDEditor value={data.rewards} onChange={val => handleUpdate('rewards', val || "")} height={150} preview="edit" />
                </div>
            </div>

            <h2 className="editor-section-title">Progression</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div className="editor-field">
                    <label className="editor-label">Main Outline / Expected Path</label>
                    <MDEditor value={data.mainOutline} onChange={val => handleUpdate('mainOutline', val || "")} height={200} preview="live" />
                </div>
                <div className="editor-field">
                    <label className="editor-label">Branching Path (Optional variants)</label>
                    <MDEditor value={data.branchingPath} onChange={val => handleUpdate('branchingPath', val || "")} height={150} preview="edit" />
                </div>
                <EntityLinkListEditor title="Child Links (Chapters/Encounters)" items={Array.isArray(data.childLinks) ? data.childLinks : []} onChange={items => handleUpdate('childLinks', items)} targetCategory="Story" />
            </div>

            <h2 className="editor-section-title">Resolution & Hooks</h2>
            <div className="editor-grid-2">
                <div className="editor-field">
                    <label className="editor-label">Assumptions (Prerequisites)</label>
                    <MDEditor value={data.assumptions} onChange={val => handleUpdate('assumptions', val || "")} height={150} preview="edit" />
                </div>
                <div className="editor-field">
                    <label className="editor-label">Open Questions (Unresolved)</label>
                    <MDEditor value={data.openQuestions} onChange={val => handleUpdate('openQuestions', val || "")} height={150} preview="edit" />
                </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "16px" }}>
                <div className="editor-field">
                    <label className="editor-label">PC Hooks</label>
                    <MDEditor value={data.pcHooks} onChange={val => handleUpdate('pcHooks', val || "")} height={150} preview="edit" />
                </div>
                <div className="editor-field">
                    <label className="editor-label">Outcomes & Consequences</label>
                    <MDEditor value={data.outcomes} onChange={val => handleUpdate('outcomes', val || "")} height={150} preview="edit" />
                </div>
            </div>

            <h2 className="editor-section-title">Media</h2>
            <ImageArrayEditor title="Image Links" items={data.images || []} onChange={(val) => handleUpdate('images', val)} documentPath={documentPath} />
        </div>
    );
}
