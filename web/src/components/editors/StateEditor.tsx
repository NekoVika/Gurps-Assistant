import { useState, useEffect } from 'react';
import MDEditor from '@uiw/react-md-editor';
import type { StateJSON } from '../../lib/types';
import { StringArrayEditor } from './StringArrayEditor';

type Props = {
    value: string;
    onChange: (val: string) => void;
    documentPath?: string;
};

export function StateEditor({ value, onChange }: Props) {
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
                    <label className="editor-label">Campaign Name</label>
                    <input type="text" className="editor-input" style={{ fontSize: "1.2em" }} value={data.campaignName || ""} onChange={e => handleUpdate('campaignName', e.target.value)} />
                </div>
                <div className="editor-field">
                    <label className="editor-label">Current Date</label>
                    <input type="text" className="editor-input" value={data.currentDate || ""} onChange={e => handleUpdate('currentDate', e.target.value)} />
                </div>
                <div className="editor-field" style={{ gridColumn: "span 3" }}>
                    <label className="editor-label">Current Location</label>
                    <input type="text" className="editor-input" value={data.currentLocation || ""} onChange={e => handleUpdate('currentLocation', e.target.value)} />
                </div>
            </div>

            <h2 className="editor-section-title">Logs & Summaries</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div className="editor-field">
                    <label className="editor-label">Recent Events (Last Session Summary)</label>
                    <MDEditor value={Array.isArray(data.recentEvents) ? data.recentEvents.join('\n') : (data.recentEvents as unknown as string || "")} onChange={val => handleUpdate('recentEvents', val ? val.split('\n') : [])} height={200} preview="edit" />
                </div>
                <div className="editor-field">
                    <label className="editor-label">Active Quests / Objectives</label>
                    <MDEditor value={Array.isArray(data.activeQuests) ? data.activeQuests.join('\n') : (data.activeQuests as unknown as string || "")} onChange={val => handleUpdate('activeQuests', val ? val.split('\n') : [])} height={150} preview="edit" />
                </div>
            </div>

            <h2 className="editor-section-title">Party Status</h2>
            <div className="editor-grid-2">
                <StringArrayEditor title="Inventory / Shared Gear" items={data.inventory || []} onChange={(val) => handleUpdate('inventory', val)} />
                <div className="editor-field">
                    <label className="editor-label">Reputation</label>
                    <MDEditor value={data.reputation || ""} onChange={val => handleUpdate('reputation', val || "")} height={150} preview="edit" />
                </div>
            </div>
            
            <h2 className="editor-section-title">Notes</h2>
            <div className="editor-field">
                <MDEditor value={data.notes || ""} onChange={val => handleUpdate('notes', val || "")} height={200} preview="edit" />
            </div>
        </div>
    );
}
