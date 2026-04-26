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
                    <input type="text" className="editor-input" style={{ fontSize: "1.2em" }} value={data.title || ""} onChange={e => handleUpdate('title', e.target.value)} />
                </div>
                <div className="editor-field">
                    <label className="editor-label">Current Status</label>
                    <input type="text" className="editor-input" value={data.status || ""} onChange={e => handleUpdate('status', e.target.value)} />
                </div>
                <div className="editor-field" style={{ gridColumn: "span 2" }}>
                    <label className="editor-label">Tone & Genre</label>
                    <input type="text" className="editor-input" value={data.toneAndGenre || ""} onChange={e => handleUpdate('toneAndGenre', e.target.value)} />
                </div>
                <div className="editor-field">
                    <label className="editor-label">Tech & Mana Baseline</label>
                    <input type="text" className="editor-input" value={data.techAndMana || ""} onChange={e => handleUpdate('techAndMana', e.target.value)} />
                </div>
            </div>

            <h2 className="editor-section-title">Party & Players</h2>
            <div className="editor-grid-2">
                <StringArrayEditor title="Player Names" items={data.players || []} onChange={(val) => handleUpdate('players', val)} compact={true} />
                <StringArrayEditor title="Player Characters" items={data.pcs || []} onChange={(val) => handleUpdate('pcs', val)} category="Character" />
            </div>

            <h2 className="editor-section-title">Campaign Details</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div className="editor-field">
                    <label className="editor-label">Synopsis / Premise</label>
                    <MDEditor value={data.synopsis || ""} onChange={val => handleUpdate('synopsis', val || "")} height={150} preview="edit" />
                </div>
                <div className="editor-field">
                    <label className="editor-label">Current Arc Summary</label>
                    <MDEditor value={data.currentArcSummary || ""} onChange={val => handleUpdate('currentArcSummary', val || "")} height={150} preview="edit" />
                </div>
                <div className="editor-field">
                    <label className="editor-label">Episode Index</label>
                    <MDEditor value={data.episodeIndex || ""} onChange={val => handleUpdate('episodeIndex', val || "")} height={200} preview="edit" />
                </div>
                <div className="editor-field">
                    <label className="editor-label">Timeline Beats</label>
                    <MDEditor value={data.timelineBeats || ""} onChange={val => handleUpdate('timelineBeats', val || "")} height={150} preview="edit" />
                </div>
                <div className="editor-field">
                    <label className="editor-label">Open Threads & Hooks</label>
                    <MDEditor value={data.openThreads || ""} onChange={val => handleUpdate('openThreads', val || "")} height={150} preview="edit" />
                </div>
            </div>

            <h2 className="editor-section-title">Media</h2>
            <ImageArrayEditor title="Image Links" items={data.images || []} onChange={(val) => handleUpdate('images', val)} documentPath={documentPath} />
        </div>
    );
}
