import { useState, useEffect } from 'react';
import MDEditor from '@uiw/react-md-editor';
import type { CampaignOverviewJSON } from '../../lib/types';
import { StringArrayEditor } from './StringArrayEditor';
import { ImageArrayEditor } from './ImageArrayEditor';

type Props = {
    value: string;
    onChange: (val: string) => void;
    documentPath?: string;
};

export function CampaignOverviewEditor({ value, onChange, documentPath = "" }: Props) {
    const [data, setData] = useState<CampaignOverviewJSON | null>(null);

    useEffect(() => {
        try {
            const parsed = JSON.parse(value) as CampaignOverviewJSON;
            setData(parsed);
        } catch (e) {
            console.error("Parse error in CampaignOverviewEditor:", e);
        }
    }, []);

    const handleUpdate = (field: keyof CampaignOverviewJSON, val: any) => {
        if (!data) return;
        const newData = { ...data, [field]: val };
        setData(newData);
        onChange(JSON.stringify(newData, null, 2));
    };

    if (!data) return <div style={{ padding: "20px" }}>Invalid JSON data. Cannot render editor.</div>;

    return (
        <div className="editor-glass-panel" data-color-mode="dark">
            <h2 className="editor-section-title">Campaign Identity</h2>
            <div className="editor-grid-3">
                <div className="editor-field" style={{ gridColumn: "span 2" }}>
                    <label className="editor-label">Campaign Title</label>
                    <input type="text" className="editor-input" style={{ fontSize: "1.2em" }} value={data.title} onChange={e => handleUpdate('title', e.target.value)} />
                </div>
                <div className="editor-field">
                    <label className="editor-label">Genre</label>
                    <input type="text" className="editor-input" value={data.genre} onChange={e => handleUpdate('genre', e.target.value)} />
                </div>
                <div className="editor-field">
                    <label className="editor-label">Current Year / Date</label>
                    <input type="text" className="editor-input" value={data.currentYear} onChange={e => handleUpdate('currentYear', e.target.value)} />
                </div>
                <div className="editor-field">
                    <label className="editor-label">Tone</label>
                    <input type="text" className="editor-input" value={data.tone} onChange={e => handleUpdate('tone', e.target.value)} />
                </div>
            </div>

            <h2 className="editor-section-title">Campaign Details</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div className="editor-field">
                    <label className="editor-label">Premise</label>
                    <MDEditor value={data.premise} onChange={val => handleUpdate('premise', val || "")} height={150} preview="edit" />
                </div>
                <div className="editor-field">
                    <label className="editor-label">Core Themes</label>
                    <MDEditor value={data.coreThemes} onChange={val => handleUpdate('coreThemes', val || "")} height={150} preview="edit" />
                </div>
            </div>

            <h2 className="editor-section-title">Party & Mechanics</h2>
            <div className="editor-grid-2">
                <div className="editor-field">
                    <label className="editor-label">Starting Points</label>
                    <input type="text" className="editor-input" value={data.startingPoints} onChange={e => handleUpdate('startingPoints', e.target.value)} />
                </div>
                <div className="editor-field">
                    <label className="editor-label">Tech Level / Magic</label>
                    <input type="text" className="editor-input" value={data.techLevelMagic} onChange={e => handleUpdate('techLevelMagic', e.target.value)} />
                </div>
                <StringArrayEditor title="Player Characters" items={data.playerCharacters || []} onChange={(val) => handleUpdate('playerCharacters', val)} category="Character" />
            </div>

            <h2 className="editor-section-title">Media</h2>
            <ImageArrayEditor title="Image Links" items={data.images || []} onChange={(val) => handleUpdate('images', val)} documentPath={documentPath} />
        </div>
    );
}
