import { useState, useEffect } from 'react';
import MDEditor from '@uiw/react-md-editor';
import type { SystemRulesJSON } from '../../lib/types';
import { StringArrayEditor } from './StringArrayEditor';

type Props = {
    value: string;
    onChange: (val: string) => void;
    documentPath?: string;
};

export function SystemRulesEditor({ value, onChange }: Props) {
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
            <div className="editor-grid-3">
                <div className="editor-field" style={{ gridColumn: "span 2" }}>
                    <label className="editor-label">System Title</label>
                    <input type="text" className="editor-input" style={{ fontSize: "1.2em" }} value={data.title || ""} onChange={e => handleUpdate('title', e.target.value)} />
                </div>
                <div className="editor-field">
                    <label className="editor-label">Base System</label>
                    <input type="text" className="editor-input" value={data.baseSystem || ""} onChange={e => handleUpdate('baseSystem', e.target.value)} />
                </div>
            </div>

            <h2 className="editor-section-title">Rules & Mechanics</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div className="editor-field">
                    <label className="editor-label">House Rules</label>
                    <MDEditor value={data.houseRules || ""} onChange={val => handleUpdate('houseRules', val || "")} height={150} preview="edit" />
                </div>
                <div className="editor-field">
                    <label className="editor-label">Custom Mechanics</label>
                    <MDEditor value={data.customMechanics || ""} onChange={val => handleUpdate('customMechanics', val || "")} height={150} preview="edit" />
                </div>
            </div>

            <h2 className="editor-section-title">Options & Budget</h2>
            <div className="editor-grid-3">
                <div className="editor-field">
                    <label className="editor-label">Allowed Options</label>
                    <input type="text" className="editor-input" value={data.allowedOptions || ""} onChange={e => handleUpdate('allowedOptions', e.target.value)} />
                </div>
                <div className="editor-field">
                    <label className="editor-label">Forbidden Options</label>
                    <input type="text" className="editor-input" value={data.forbiddenOptions || ""} onChange={e => handleUpdate('forbiddenOptions', e.target.value)} />
                </div>
                <div className="editor-field">
                    <label className="editor-label">Point Budget</label>
                    <input type="text" className="editor-input" value={data.pointBudget || ""} onChange={e => handleUpdate('pointBudget', e.target.value)} />
                </div>
            </div>
            
            <h2 className="editor-section-title">Core Books</h2>
            <div className="editor-field">
                <StringArrayEditor title="Required Books" items={data.coreBooks || []} onChange={(val) => handleUpdate('coreBooks', val)} />
            </div>
        </div>
    );
}
