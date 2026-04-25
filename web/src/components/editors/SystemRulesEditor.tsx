import { useState, useEffect } from 'react';
import MDEditor from '@uiw/react-md-editor';
import type { SystemRulesJSON } from '../../lib/types';

type Props = {
    value: string;
    onChange: (val: string) => void;
    documentPath?: string;
};

export function SystemRulesEditor({ value, onChange, documentPath = "" }: Props) {
    const [data, setData] = useState<SystemRulesJSON | null>(null);

    useEffect(() => {
        try {
            const parsed = JSON.parse(value) as SystemRulesJSON;
            setData(parsed);
        } catch (e) {
            console.error("Parse error in SystemRulesEditor:", e);
        }
    }, []);

    const handleUpdate = (field: keyof SystemRulesJSON, val: any) => {
        if (!data) return;
        const newData = { ...data, [field]: val };
        setData(newData);
        onChange(JSON.stringify(newData, null, 2));
    };

    if (!data) return <div style={{ padding: "20px" }}>Invalid JSON data. Cannot render editor.</div>;

    return (
        <div className="editor-glass-panel" data-color-mode="dark">
            <h2 className="editor-section-title">System Instructions</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div className="editor-field">
                    <label className="editor-label">Core Prompt</label>
                    <MDEditor value={data.corePrompt} onChange={val => handleUpdate('corePrompt', val || "")} height={200} preview="edit" />
                </div>
                <div className="editor-field">
                    <label className="editor-label">Formatting Rules</label>
                    <MDEditor value={data.formattingRules} onChange={val => handleUpdate('formattingRules', val || "")} height={150} preview="edit" />
                </div>
                <div className="editor-field">
                    <label className="editor-label">Mechanics Rules</label>
                    <MDEditor value={data.mechanicsRules} onChange={val => handleUpdate('mechanicsRules', val || "")} height={150} preview="edit" />
                </div>
                <div className="editor-field">
                    <label className="editor-label">Tone & Style</label>
                    <MDEditor value={data.toneAndStyle} onChange={val => handleUpdate('toneAndStyle', val || "")} height={150} preview="edit" />
                </div>
            </div>
        </div>
    );
}
