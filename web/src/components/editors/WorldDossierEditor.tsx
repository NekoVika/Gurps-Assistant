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
                    <input type="text" className="editor-input" style={{ fontSize: "1.2em" }} value={data.worldName} onChange={e => handleUpdate('worldName', e.target.value)} />
                </div>
                <div className="editor-field">
                    <label className="editor-label">Genre</label>
                    <input type="text" className="editor-input" value={data.genre} onChange={e => handleUpdate('genre', e.target.value)} />
                </div>
                <div className="editor-field">
                    <label className="editor-label">Tech Level (TL)</label>
                    <input type="text" className="editor-input" value={data.techLevel} onChange={e => handleUpdate('techLevel', e.target.value)} />
                </div>
                <div className="editor-field">
                    <label className="editor-label">Mana Level</label>
                    <input type="text" className="editor-input" value={data.manaLevel} onChange={e => handleUpdate('manaLevel', e.target.value)} />
                </div>
            </div>

            <h2 className="editor-section-title">Lore & History</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div className="editor-field">
                    <label className="editor-label">General Overview</label>
                    <MDEditor value={data.generalOverview} onChange={val => handleUpdate('generalOverview', val || "")} height={200} preview="edit" />
                </div>
                <div className="editor-field">
                    <label className="editor-label">Cosmology</label>
                    <MDEditor value={data.cosmology} onChange={val => handleUpdate('cosmology', val || "")} height={150} preview="edit" />
                </div>
                <div className="editor-field">
                    <label className="editor-label">Recent History</label>
                    <MDEditor value={data.recentHistory} onChange={val => handleUpdate('recentHistory', val || "")} height={150} preview="edit" />
                </div>
            </div>

            <h2 className="editor-section-title">Key Entities</h2>
            <div className="editor-grid-2">
                <StringArrayEditor title="Key Factions" items={data.keyFactions || []} onChange={(val) => handleUpdate('keyFactions', val)} category="Faction" />
                <StringArrayEditor title="Key Locations" items={data.keyLocations || []} onChange={(val) => handleUpdate('keyLocations', val)} category="Location" />
                <StringArrayEditor title="Important Figures" items={data.importantFigures || []} onChange={(val) => handleUpdate('importantFigures', val)} category="Character" />
                <StringArrayEditor title="Custom Mechanics" items={data.customMechanics || []} onChange={(val) => handleUpdate('customMechanics', val)} />
            </div>

            <h2 className="editor-section-title">Media</h2>
            <ImageArrayEditor title="Image Links" items={data.images || []} onChange={(val) => handleUpdate('images', val)} documentPath={documentPath} />
        </div>
    );
}
