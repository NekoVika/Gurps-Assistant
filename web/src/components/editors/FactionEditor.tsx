import { useState, useEffect } from 'react';
import MDEditor from '@uiw/react-md-editor';
import type { FactionJSON } from '../../lib/types';
import { StringArrayEditor } from './StringArrayEditor';
import { ImageArrayEditor } from './ImageArrayEditor';
import { EntityRelationEditorList } from './StructuredArrayEditors';

type Props = {
    value: string;
    onChange: (val: string) => void;
    documentPath?: string;
};

export function FactionEditor({ value, onChange, documentPath = "" }: Props) {
    const [data, setData] = useState<FactionJSON | null>(null);

    useEffect(() => {
        try {
            const parsed = JSON.parse(value) as FactionJSON;
            setData(parsed);
        } catch (e) {
            console.error("Parse error in FactionEditor:", e);
        }
    }, []);

    const handleUpdate = (field: keyof FactionJSON, val: any) => {
        if (!data) return;
        const newData = { ...data, [field]: val };
        setData(newData);
        onChange(JSON.stringify(newData, null, 2));
    };

    if (!data) return <div style={{ padding: "20px" }}>Invalid JSON data. Cannot render editor.</div>;

    return (
        <div className="editor-glass-panel" data-color-mode="dark">
            <h2 className="editor-section-title">Faction Core</h2>
            <div className="editor-grid-3">
                <div className="editor-field" style={{ gridColumn: "span 2" }}>
                    <label className="editor-label">Name</label>
                    <input type="text" className="editor-input" style={{ fontSize: "1.2em" }} value={data.name} onChange={e => handleUpdate('name', e.target.value)} />
                </div>
                <div className="editor-field">
                    <label className="editor-label">Type</label>
                    <input type="text" className="editor-input" value={data.type} onChange={e => handleUpdate('type', e.target.value)} />
                </div>
                <div className="editor-field">
                    <label className="editor-label">Status</label>
                    <input type="text" className="editor-input" value={data.status} onChange={e => handleUpdate('status', e.target.value)} />
                </div>
                <div className="editor-field">
                    <label className="editor-label">Headquarters</label>
                    <input type="text" className="editor-input" value={data.headquarters} onChange={e => handleUpdate('headquarters', e.target.value)} />
                </div>
                <div className="editor-field">
                    <label className="editor-label">Leader</label>
                    <input type="text" className="editor-input" value={data.leader} onChange={e => handleUpdate('leader', e.target.value)} />
                </div>
            </div>

            <h2 className="editor-section-title">Overview & Goals</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div className="editor-field">
                    <label className="editor-label">Overview</label>
                    <MDEditor value={data.overview} onChange={val => handleUpdate('overview', val || "")} height={200} preview="edit" />
                </div>
                <div className="editor-field">
                    <label className="editor-label">Goals</label>
                    <MDEditor value={data.goals} onChange={val => handleUpdate('goals', val || "")} height={150} preview="edit" />
                </div>
            </div>

            <h2 className="editor-section-title">Relationships & Assets</h2>
            <div className="editor-grid-2">
                <EntityRelationEditorList title="Character Relations" items={data.characterRelations || []} onChange={items => handleUpdate('characterRelations', items)} targetCategory="Character" />
                <EntityRelationEditorList title="Faction Relations" items={data.factionRelations || []} onChange={items => handleUpdate('factionRelations', items)} targetCategory="Faction" />
                <EntityRelationEditorList title="Location Relations" items={data.locationRelations || []} onChange={items => handleUpdate('locationRelations', items)} targetCategory="Location" />
                <StringArrayEditor title="Story Appearances" items={data.storyAppearances || []} onChange={items => handleUpdate('storyAppearances', items)} category="Story" />

                {data.allies && data.allies.length > 0 && (
                    <StringArrayEditor title="Allies (Legacy)" items={data.allies} onChange={(val) => handleUpdate('allies', val)} category="Faction" />
                )}
                {data.enemies && data.enemies.length > 0 && (
                    <StringArrayEditor title="Enemies (Legacy)" items={data.enemies} onChange={(val) => handleUpdate('enemies', val)} category="Faction" />
                )}
                {data.notableMembers && data.notableMembers.length > 0 && (
                    <StringArrayEditor title="Notable Members (Legacy)" items={data.notableMembers} onChange={(val) => handleUpdate('notableMembers', val)} category="Character" />
                )}
                <StringArrayEditor title="Assets" items={data.assets || []} onChange={(val) => handleUpdate('assets', val)} />
            </div>

            <h2 className="editor-section-title">Media</h2>
            <ImageArrayEditor title="Image Links" items={data.images || []} onChange={(val) => handleUpdate('images', val)} documentPath={documentPath} />
        </div>
    );
}
