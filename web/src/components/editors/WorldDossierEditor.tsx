import { useState, useEffect } from 'react';
import MDEditor from '@uiw/react-md-editor';
import type { WorldDossierJSON } from '../../lib/types';
import { StringArrayEditor } from './StringArrayEditor';
import { ImageArrayEditor } from './ImageArrayEditor';

type Props = {
    value: string;
    onChange: (val: string) => void;
    documentPath?: string;
};

export function WorldDossierEditor({ value, onChange, documentPath = "" }: Props) {
    const [data, setData] = useState<WorldDossierJSON | null>(null);

    useEffect(() => {
        try {
            const parsed = JSON.parse(value) as WorldDossierJSON;
            setData(parsed);
        } catch (e) {
            console.error("Parse error in WorldDossierEditor:", e);
        }
    }, []);

    const handleUpdate = (field: keyof WorldDossierJSON, val: any) => {
        if (!data) return;
        const newData = { ...data, [field]: val };
        setData(newData);
        onChange(JSON.stringify(newData, null, 2));
    };

    if (!data) return <div style={{ padding: "20px" }}>Invalid JSON data. Cannot render editor.</div>;

    return (
        <div className="editor-glass-panel" data-color-mode="dark">
            <h2 className="editor-section-title">World Settings</h2>
            <div className="editor-grid-3">
                <div className="editor-field" style={{ gridColumn: "span 2" }}>
                    <label className="editor-label">World Name</label>
                    <input type="text" className="editor-input" style={{ fontSize: "1.2em" }} value={data.name || ""} onChange={e => handleUpdate('name', e.target.value)} />
                </div>
                <div className="editor-field">
                    <label className="editor-label">World Type</label>
                    <input type="text" className="editor-input" value={data.worldType || ""} onChange={e => handleUpdate('worldType', e.target.value)} />
                </div>
                <div className="editor-field">
                    <label className="editor-label">Scale of Play</label>
                    <input type="text" className="editor-input" value={data.scaleOfPlay || ""} onChange={e => handleUpdate('scaleOfPlay', e.target.value)} />
                </div>
                <div className="editor-field">
                    <label className="editor-label">Baseline TL</label>
                    <input type="text" className="editor-input" value={data.baselineTL || ""} onChange={e => handleUpdate('baselineTL', e.target.value)} />
                </div>
                <div className="editor-field">
                    <label className="editor-label">Baseline Mana</label>
                    <input type="text" className="editor-input" value={data.baselineMana || ""} onChange={e => handleUpdate('baselineMana', e.target.value)} />
                </div>
                <div className="editor-field" style={{ gridColumn: "span 3" }}>
                    <label className="editor-label">Tone & Genre</label>
                    <input type="text" className="editor-input" value={data.toneAndGenre || ""} onChange={e => handleUpdate('toneAndGenre', e.target.value)} />
                </div>
            </div>

            <h2 className="editor-section-title">Core Identity</h2>
            <div className="editor-field" style={{ marginBottom: "16px" }}>
                <label className="editor-label">Elevator Pitch</label>
                <MDEditor value={data.elevatorPitch || ""} onChange={val => handleUpdate('elevatorPitch', val || "")} height={150} preview="edit" />
            </div>

            <h2 className="editor-section-title">Lore & Details</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div className="editor-field">
                    <label className="editor-label">World Meta (GM Notes)</label>
                    <MDEditor value={data.worldMeta || ""} onChange={val => handleUpdate('worldMeta', val || "")} height={200} preview="edit" />
                </div>
                <div className="editor-field">
                    <label className="editor-label">Physical Reality & Constraints</label>
                    <MDEditor value={data.physicalReality || ""} onChange={val => handleUpdate('physicalReality', val || "")} height={150} preview="edit" />
                </div>
                <div className="editor-field">
                    <label className="editor-label">Metaphysics & The Weird</label>
                    <MDEditor value={data.metaphysics || ""} onChange={val => handleUpdate('metaphysics', val || "")} height={150} preview="edit" />
                </div>
                <div className="editor-field">
                    <label className="editor-label">People, Culture & Everyday Life</label>
                    <MDEditor value={data.peopleAndCulture || ""} onChange={val => handleUpdate('peopleAndCulture', val || "")} height={150} preview="edit" />
                </div>
                <div className="editor-field">
                    <label className="editor-label">Deep Lore (Secrets)</label>
                    <MDEditor value={data.deepLore || ""} onChange={val => handleUpdate('deepLore', val || "")} height={200} preview="edit" />
                </div>
            </div>

            <h2 className="editor-section-title">Tags & Arrays</h2>
            <div className="editor-grid-2">
                <StringArrayEditor title="Themes" items={data.themes || []} onChange={(val) => handleUpdate('themes', val)} compact={true} />
                <StringArrayEditor title="Tags" items={data.tags || []} onChange={(val) => handleUpdate('tags', val)} compact={true} />
                <div style={{ gridColumn: "span 2" }}>
                    <StringArrayEditor title="Core Premises & Truths" items={data.corePremises || []} onChange={(val) => handleUpdate('corePremises', val)} />
                </div>
            </div>

            <h2 className="editor-section-title">Media</h2>
            <ImageArrayEditor title="Image Links" items={data.images || []} onChange={(val) => handleUpdate('images', val)} documentPath={documentPath} />
        </div>
    );
}
