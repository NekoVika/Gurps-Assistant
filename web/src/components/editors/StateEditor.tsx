import { useState, useEffect } from 'react';
import MDEditor from '@uiw/react-md-editor';
import type { StateJSON } from '../../lib/types';
import { StringArrayEditor } from './StringArrayEditor';

type Props = {
    value: string;
    onChange: (val: string) => void;
    documentPath?: string;
};

export function StateEditor({ value, onChange, documentPath = "" }: Props) {
    const [data, setData] = useState<StateJSON | null>(null);

    useEffect(() => {
        try {
            const parsed = JSON.parse(value) as StateJSON;
            setData(parsed);
        } catch (e) {
            console.error("Parse error in StateEditor:", e);
        }
    }, []);

    const handleUpdate = (field: keyof StateJSON, val: any) => {
        if (!data) return;
        const newData = { ...data, [field]: val };
        setData(newData);
        onChange(JSON.stringify(newData, null, 2));
    };

    if (!data) return <div style={{ padding: "20px" }}>Invalid JSON data. Cannot render editor.</div>;

    return (
        <div className="editor-glass-panel" data-color-mode="dark">
            <h2 className="editor-section-title">Current Campaign State</h2>
            <div className="editor-grid-3">
                <div className="editor-field" style={{ gridColumn: "span 2" }}>
                    <label className="editor-label">Current Chapter</label>
                    <input type="text" className="editor-input" style={{ fontSize: "1.2em" }} value={data.currentChapter} onChange={e => handleUpdate('currentChapter', e.target.value)} />
                </div>
                <div className="editor-field">
                    <label className="editor-label">In-Game Date</label>
                    <input type="text" className="editor-input" value={data.inGameDate} onChange={e => handleUpdate('inGameDate', e.target.value)} />
                </div>
            </div>

            <h2 className="editor-section-title">Logs & Summaries</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div className="editor-field">
                    <label className="editor-label">Recent Events (Last Session Summary)</label>
                    <MDEditor value={data.recentEvents} onChange={val => handleUpdate('recentEvents', val || "")} height={200} preview="edit" />
                </div>
                <div className="editor-field">
                    <label className="editor-label">Active Quests / Objectives</label>
                    <MDEditor value={data.activeQuests} onChange={val => handleUpdate('activeQuests', val || "")} height={150} preview="edit" />
                </div>
                <div className="editor-field">
                    <label className="editor-label">Party Status (Health, Gear, Tension)</label>
                    <MDEditor value={data.partyStatus} onChange={val => handleUpdate('partyStatus', val || "")} height={150} preview="edit" />
                </div>
            </div>

            <h2 className="editor-section-title">Flags & Notes</h2>
            <div className="editor-grid-2">
                <StringArrayEditor title="Active Flags/Triggers" items={data.flags || []} onChange={(val) => handleUpdate('flags', val)} />
                <StringArrayEditor title="GM Notes" items={data.gmNotes || []} onChange={(val) => handleUpdate('gmNotes', val)} />
            </div>
        </div>
    );
}
